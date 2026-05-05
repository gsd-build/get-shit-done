---
phase: 01-schema-config
reviewed: 2026-04-28T00:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - docs/CONFIGURATION.md
  - get-shit-done/bin/gsd-tools.cjs
  - get-shit-done/bin/lib/config.cjs
  - get-shit-done/bin/lib/config-schema.cjs
  - get-shit-done/templates/sme.md
  - sdk/src/config.ts
  - sdk/src/query/config-mutation.ts
  - sdk/src/query/config-schema.ts
findings:
  critical: 1
  warning: 4
  info: 3
  total: 8
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-04-28
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

This phase introduces schema/config scaffolding for the SME agent framework: a new `workflow.use_sme_agents` toggle, `sme.blocking` default, and per-process `sme.processes.<name>.block_mode` dynamic key. The schema additions are correctly mirrored between the CJS and SDK layers and gated behind the parity CI test.

However, review uncovered one critical bug (a secret-masking regression in the SDK `configSet` path), one pre-existing logic error that this phase did not introduce but touches (wrong enum applied to the `context` key), and several divergences between the CJS `configNewProject` and the SDK `configNewProject` implementations that will produce different on-disk configs for new projects.

---

## Critical Issues

### CR-01: SDK `configSet` returns plaintext API keys in response body

**File:** `sdk/src/query/config-mutation.ts:237-245`
**Issue:** The SDK `configSet` handler returns the raw `parsedValue` in `data.value` for every key, including the secret keys `brave_search`, `firecrawl`, and `exa_search`. The CJS counterpart in `get-shit-done/bin/lib/config.cjs` (lines 370-382) explicitly calls `maskSecret()` before writing to stdout. The SDK layer has no equivalent masking. Any caller consuming the SDK query response for a `config-set brave_search <api-key>` invocation will receive the plaintext key in the JSON `data.value` field.

**Fix:**
```typescript
// At the top of the file, add:
const SECRET_CONFIG_KEYS = new Set(['brave_search', 'firecrawl', 'exa_search']);

function maskSecret(value: unknown): string {
  if (value === null || value === undefined || value === '') return '(unset)';
  const s = String(value);
  if (s.length < 8) return '****';
  return '****' + s.slice(-4);
}

// In configSet, replace the final data construction block (~line 237):
const isSecret = SECRET_CONFIG_KEYS.has(keyPath);
const data: Record<string, unknown> = {
  updated: true,
  key: keyPath,
  value: isSecret ? maskSecret(parsedValue) : parsedValue,
  ...(isSecret ? { masked: true } : {}),
};
if (previousValue !== undefined) {
  data.previousValue = isSecret ? maskSecret(previousValue) : previousValue;
}
return { data };
```

---

## Warnings

### WR-01: `context` key validated against wrong enum — should be `context_profile`

**File:** `get-shit-done/bin/lib/config.cjs:342-345` and `sdk/src/query/config-mutation.ts:208-214`
**Issue:** Both implementations apply the `['dev', 'research', 'review']` enum restriction to the config key named `context`. But `context` is documented in `docs/CONFIGURATION.md` (line 126) as a free-form text field: "Custom context string injected into every agent prompt." The `dev/research/review` enum belongs to `context_profile` (documented at line 123 of CONFIGURATION.md), which is a separate key. This means any attempt to `config-set context "My project uses React"` is rejected with an invalid-value error, breaking the documented behavior entirely. `context_profile` is not listed in `VALID_CONFIG_KEYS` at all, so it cannot be set via `config-set` either.

**Fix:**

In `get-shit-done/bin/lib/config.cjs` remove the `context` enum guard (lines 342-345) and add `context_profile` to VALID_CONFIG_KEYS with its enum validation:
```javascript
// Remove:
// const VALID_CONTEXT_VALUES = ['dev', 'research', 'review'];
// if (keyPath === 'context' && !VALID_CONTEXT_VALUES.includes(String(parsedValue))) {
//   error(`Invalid context value '${value}'. ...`);
// }

// Add (after the keyPath validation block):
const VALID_CONTEXT_PROFILE_VALUES = ['dev', 'research', 'review'];
if (keyPath === 'context_profile' && !VALID_CONTEXT_PROFILE_VALUES.includes(String(parsedValue))) {
  error(`Invalid context_profile value '${value}'. Valid values: ${VALID_CONTEXT_PROFILE_VALUES.join(', ')}`);
}
```

Apply the same change to `sdk/src/query/config-mutation.ts` lines 208-214, and add `'context_profile'` to both `VALID_CONFIG_KEYS` sets (`get-shit-done/bin/lib/config-schema.cjs` and `sdk/src/query/config-schema.ts`).

---

### WR-02: `parallelization` default is `1` (number) in SDK `configNewProject`, not `true` (boolean)

**File:** `sdk/src/query/config-mutation.ts:365`
**Issue:** The `defaults` object inside `configNewProject` sets `parallelization: 1`. Every other reference — `sdk/src/config.ts:88` (`true`), `get-shit-done/bin/lib/core.cjs:255` (`true`), and CJS `buildNewProjectConfig` via `CONFIG_DEFAULTS.parallelization` — uses `true`. When `configNewProject` is invoked from the SDK path, new projects receive `parallelization: 1` in their `config.json`. Downstream config readers that check `if (config.parallelization === true)` will not match, potentially disabling parallel execution silently.

**Fix:**
```typescript
// sdk/src/query/config-mutation.ts line 365 — change:
parallelization: 1,
// to:
parallelization: true,
```

---

### WR-03: `configEnsureSection` in SDK performs an unguarded read-modify-write without a lock

**File:** `sdk/src/query/config-mutation.ts:460-482`
**Issue:** `configEnsureSection` reads `config.json`, conditionally adds a section, and writes it back without acquiring a state lock. `configSet` and `configSetModelProfile` in the same file both use `acquireStateLock` / `releaseStateLock` (lines 218, 277). In a concurrent scenario (two agents initializing the same section simultaneously), one write will silently overwrite the other, potentially dropping keys that the first writer added.

**Fix:**
```typescript
export const configEnsureSection: QueryHandler = async (args, projectDir, workstream) => {
  const sectionName = args[0];
  if (!sectionName) {
    throw new GSDError('Usage: config-ensure-section <section>', ErrorClassification.Validation);
  }

  const paths = planningPaths(projectDir, workstream);
  const lockPath = await acquireStateLock(paths.config);
  try {
    let config: Record<string, unknown> = {};
    try {
      const raw = await readFile(paths.config, 'utf-8');
      config = JSON.parse(raw) as Record<string, unknown>;
    } catch { /* Start with empty config */ }

    if (!(sectionName in config)) {
      config[sectionName] = {};
      await atomicWriteConfig(paths.config, config);
    }
  } finally {
    await releaseStateLock(lockPath);
  }

  return { data: { ensured: true, section: sectionName } };
};
```

---

### WR-04: `workflow.build_command` and `workflow.test_command` documented but not in `VALID_CONFIG_KEYS`

**File:** `get-shit-done/bin/lib/config-schema.cjs:16-73` and `sdk/src/query/config-schema.ts:18-75`
**Issue:** `docs/CONFIGURATION.md` lines 214-215 document `workflow.build_command` and `workflow.test_command` as user-configurable string fields added in v1.39, with example shell commands. Neither key is present in `VALID_CONFIG_KEYS` in either schema file. Any attempt to `config-set workflow.build_command "npm run build"` will be rejected with "Unknown config key." The full schema example at the top of CONFIGURATION.md (lines 57-58) also shows these keys at their default values.

**Fix:** Add both keys to `VALID_CONFIG_KEYS` in both schema files:
```javascript
// get-shit-done/bin/lib/config-schema.cjs  (and the identical SDK file)
'workflow.build_command',
'workflow.test_command',
```

---

## Info

### IN-01: `context_profile` and `model_overrides` documented in schema example but not settable via `config-set`

**File:** `docs/CONFIGURATION.md:18,123`
**Issue:** The full schema example at the top of CONFIGURATION.md shows `"model_overrides": {}` as a top-level key. The Core Settings table documents `context_profile` with valid values. Neither key is in `VALID_CONFIG_KEYS`, and `model_overrides` has no dynamic-pattern entry. Users who follow the documentation to set these values will get an "Unknown config key" error. Both keys are meaningful runtime fields that the CJS `loadConfig` reads from disk — they just cannot be written through `config-set`.

**Fix:** Add `model_overrides` as a dynamic key pattern (since it maps arbitrary agent-type strings to model IDs) and `context_profile` as an exact-match key in both schema files. A value validator for `context_profile` should accept `['dev', 'research', 'review']` (see WR-01 above, which is the prerequisite fix).

---

### IN-02: `workflow.subagent_timeout` default unit mismatch between SDK `config.ts` and documentation

**File:** `sdk/src/config.ts:115` vs `docs/CONFIGURATION.md:210`
**Issue:** `sdk/src/config.ts` sets the default `subagent_timeout` to `300000` with the comment "Subagent timeout in ms." CONFIGURATION.md documents the same setting with a default of `600` described as "Timeout in seconds." The CJS `get-shit-done/bin/lib/core.cjs:265` also uses `300000` milliseconds (5 minutes). The documentation says 600 seconds (10 minutes). At minimum, the documentation's stated default does not match the actual default value baked into code. If consumers of the TypeScript type interface treat the number as seconds (following the docs), they will compute a 300,000-second timeout.

**Fix:** Align documentation: change `docs/CONFIGURATION.md:210` to read `500` (matching 300,000 ms) and clarify the unit explicitly: `300000` (milliseconds). Alternatively, change the field to store seconds everywhere and divide at the call site. Also add a unit annotation to the TypeScript interface:
```typescript
/** Subagent timeout in milliseconds. Default: 300000 (5 minutes). */
subagent_timeout: number;
```

---

### IN-03: SME template comment markers use HTML comment syntax that may not hide content in all renderers

**File:** `get-shit-done/templates/sme.md:22`
**Issue:** The placeholder sections in the SME template (`## Identified Risks`, `## Test Gaps`, etc.) wrap example content in `<!-- ... -->` HTML comments. In standard Markdown renderers these are hidden. However, some AI agents read raw Markdown rather than rendered HTML, and will see the commented example content as if it were real findings. If an agent reads this template expecting to parse actual SME findings, the example content may be mistakenly treated as real blockers.

This is low severity — the template is intentionally illustrative — but worth noting for any agent that auto-parses SME documents.

**Fix:** Consider adding a frontmatter field like `template: true` or a top-level prose note ("This is a template document — fill in findings below") so automated parsers can skip example content without needing to strip HTML comments.

---

_Reviewed: 2026-04-28_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
