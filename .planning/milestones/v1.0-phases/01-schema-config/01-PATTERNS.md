# Phase 1: Schema & Config - Pattern Map

**Mapped:** 2026-04-28
**Files analyzed:** 7 new/modified files
**Analogs found:** 6 / 7

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `get-shit-done/bin/lib/config-schema.cjs` | config | request-response | self (additive edit) | exact |
| `sdk/src/query/config-schema.ts` | config | request-response | self (additive edit) | exact |
| `get-shit-done/bin/lib/config.cjs` (`buildNewProjectConfig`) | config | request-response | self (additive edit) | exact |
| `sdk/src/config.ts` (`WorkflowConfig`, `GSDConfig`) | model | request-response | self (additive edit) | exact |
| `docs/CONFIGURATION.md` | config | transform | self (additive edit) | exact |
| `get-shit-done/bin/gsd-tools.cjs` (template case) | utility | request-response | `get-shit-done/bin/gsd-tools.cjs` lines 548-571 | exact |
| `get-shit-done/templates/sme.md` | config | file-I/O | `get-shit-done/templates/spec.md` | role-match |

---

## Pattern Assignments

### `get-shit-done/bin/lib/config-schema.cjs` (config, additive edit)

**Analog:** Self — additive insertions into existing data structures.

**Existing VALID_CONFIG_KEYS set pattern** (lines 16-71):
```javascript
const VALID_CONFIG_KEYS = new Set([
  // ... existing keys (last entry before closing paren) ...
  'workflow.code_review',
  'workflow.code_review_depth',
  'workflow.code_review_command',
  // ...
  'runtime',
  // ADD HERE:
  'workflow.use_sme_agents',
  'sme.blocking',
]);
```

**Existing DYNAMIC_KEY_PATTERNS array pattern** (lines 77-86):
```javascript
const DYNAMIC_KEY_PATTERNS = [
  { topLevel: 'agent_skills',  test: (k) => /^agent_skills\.[a-zA-Z0-9_-]+$/.test(k),  description: 'agent_skills.<agent-type>' },
  { topLevel: 'review',        test: (k) => /^review\.models\.[a-zA-Z0-9_-]+$/.test(k), description: 'review.models.<cli-name>' },
  // ... existing entries ...
  // ADD HERE:
  {
    topLevel: 'sme',
    test: (k) => /^sme\.processes\.[a-zA-Z0-9_-]+\.block_mode$/.test(k),
    description: 'sme.processes.<process-name>.block_mode',
  },
];
```

**Key constraint:** The `topLevel` field is informational metadata. The parity test checks `test.source` (CJS regex `.source`), NOT `topLevel`. Both must be added atomically with the SDK mirror and docs updates.

---

### `sdk/src/query/config-schema.ts` (config, additive edit)

**Analog:** Self — additive insertions mirroring the CJS schema exactly.

**Existing VALID_CONFIG_KEYS set pattern** (lines 18-73):
```typescript
export const VALID_CONFIG_KEYS: ReadonlySet<string> = new Set([
  // ... existing keys matching CJS exactly ...
  'workflow.code_review',
  // ...
  'runtime',
  // ADD HERE (must match CJS verbatim):
  'workflow.use_sme_agents',
  'sme.blocking',
]);
```

**Existing DYNAMIC_KEY_PATTERNS array pattern** (lines 86-113) — note the required `source` field:
```typescript
export const DYNAMIC_KEY_PATTERNS: readonly DynamicKeyPattern[] = [
  {
    source: '^agent_skills\\.[a-zA-Z0-9_-]+$',
    description: 'agent_skills.<agent-type>',
    test: (k) => /^agent_skills\.[a-zA-Z0-9_-]+$/.test(k),
  },
  // ... existing entries ...
  // ADD HERE:
  {
    source: '^sme\\.processes\\.[a-zA-Z0-9_-]+\\.block_mode$',
    description: 'sme.processes.<process-name>.block_mode',
    test: (k) => /^sme\.processes\.[a-zA-Z0-9_-]+\.block_mode$/.test(k),
  },
];
```

**Critical:** `source` must be the literal string of the CJS regex `.source` property — double-escaped backslashes. The `config-schema-sdk-parity.test.cjs` CI guard compares `source` strings between CJS and SDK.

---

### `get-shit-done/bin/lib/config.cjs` — `buildNewProjectConfig` (config, additive edit)

**Analog:** Self — insert into the `workflow` and `sme` objects within `hardcoded`.

**Existing workflow defaults block pattern** (lines 99-127):
```javascript
const hardcoded = {
  // ...
  workflow: {
    research: true,
    plan_check: true,
    verifier: true,
    // ... existing flags ...
    code_review: true,
    code_review_depth: 'standard',
    code_review_command: null,
    pattern_mapper: true,
    // ...
    // ADD HERE (opt-in, must be explicit false per D-05/CONFIG-01):
    use_sme_agents: false,
  },
  // ADD NEW TOP-LEVEL KEY:
  sme: {
    blocking: 'soft',
  },
  // ... rest of hardcoded ...
};
```

**Pattern rule:** All workflow feature flags that are opt-in (not on by default) are set to `false` explicitly here. The key `use_sme_agents: false` must be explicit — absent keys in the defaults still allow the SDK's `WorkflowConfig` type to reflect undefined behavior. Do NOT set `use_sme_agents: true` or omit it.

---

### `sdk/src/config.ts` — `WorkflowConfig` and `GSDConfig` (model, additive edit)

**Analog:** Self — insert new field into `WorkflowConfig` interface and `GSDConfig` interface.

**Existing WorkflowConfig interface pattern** (lines 22-49):
```typescript
export interface WorkflowConfig {
  research: boolean;
  plan_check: boolean;
  verifier: boolean;
  // ... existing fields ...
  context_coverage_gate: boolean;
  // ADD HERE:
  use_sme_agents: boolean;
}
```

**Existing GSDConfig interface pattern** (lines 55-74):
```typescript
export interface GSDConfig {
  model_profile: string;
  // ... existing typed fields ...
  workflow: WorkflowConfig;
  hooks: HooksConfig;
  agent_skills: Record<string, unknown>;
  project_code?: string | null;
  mode?: string;
  _auto_chain_active?: boolean;
  [key: string]: unknown;  // existing index signature covers sme at runtime
  // ADD named sme property for TypeScript consumers:
  sme?: {
    blocking?: string;
    [key: string]: unknown;
  };
}
```

**Existing CONFIG_DEFAULTS pattern** (lines 78-118) — add `use_sme_agents` to the `workflow` defaults object:
```typescript
export const CONFIG_DEFAULTS: GSDConfig = {
  // ...
  workflow: {
    research: true,
    // ... existing defaults ...
    context_coverage_gate: true,
    // ADD:
    use_sme_agents: false,
  },
  // ...
};
```

---

### `docs/CONFIGURATION.md` (config, additive edit)

**Analog:** Self — insert rows into the Workflow Toggles table (line ~172+).

**Existing Workflow Toggles table row pattern** (lines 194, 203):
```markdown
## Workflow Toggles

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `workflow.research` | boolean | `true` | Domain investigation before planning each phase |
| `workflow.code_review` | boolean | `true` | Enable `/gsd-code-review` and `/gsd-code-review-fix` commands. When `false`, the commands exit with a configuration gate message. Added in v1.34 |
| `workflow.tdd_mode` | boolean | `false` | Enable TDD pipeline as a first-class execution mode. ... Added in v1.36 |
```

**New rows to insert** (insert after existing `workflow.*` rows, before the table ends):
```markdown
| `workflow.use_sme_agents` | boolean | `false` | Enable SME (Subject Matter Expert) agent framework. When `false` (default), all SME workflow steps are unconditionally skipped. Opt-in — existing projects are unaffected until this is set to `true`. |
```

**New SME Settings section** (add after Workflow Toggles section):
```markdown
## SME Settings

Settings for the SME (Subject Matter Expert) agent framework. Requires `workflow.use_sme_agents true`.

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `sme.blocking` | string | `soft` | Default block mode for newly created SME documents. `soft` = warnings only; `strict` = blocks plan-phase on BLOCKER findings. Can be overridden per process via `sme.processes.<name>.block_mode`. |
| `sme.processes.<process-name>.block_mode` | string | (inherits `sme.blocking`) | Per-process block mode override. `<process-name>` must match `[a-zA-Z0-9_-]+`. |
```

**Critical:** The parity test (`config-schema-docs-parity.test.cjs`) checks for each exact key wrapped in backticks (`` `workflow.use_sme_agents` ``, `` `sme.blocking` ``) anywhere in the file. The dynamic pattern `sme.processes.<process-name>.block_mode` does not need to appear as an exact backtick-wrapped key — the description form is sufficient.

---

### `get-shit-done/bin/gsd-tools.cjs` — template case block (utility, request-response)

**Analog:** `get-shit-done/bin/gsd-tools.cjs` lines 548-571 — the existing `template` case block.

**Existing template case block** (lines 548-571):
```javascript
case 'template': {
  const subcommand = args[1];
  if (subcommand === 'select') {
    template.cmdTemplateSelect(cwd, args[2], raw);
  } else if (subcommand === 'fill') {
    const templateType = args[2];
    const { phase, plan, name, type, wave, fields: fieldsRaw } = parseNamedArgs(args, ['phase', 'plan', 'name', 'type', 'wave', 'fields']);
    let fields = {};
    if (fieldsRaw) {
      const { safeJsonParse } = require('./lib/security.cjs');
      const result = safeJsonParse(fieldsRaw, { label: '--fields' });
      if (!result.ok) error(result.error);
      fields = result.value;
    }
    template.cmdTemplateFill(cwd, templateType, {
      phase, plan, name, fields,
      type: type || 'execute',
      wave: wave || '1',
    }, raw);
  } else {
    error('Unknown template subcommand. Available: select, fill');
  }
  break;
}
```

**New `sme` branch to insert** (insert before the final `else` that throws the unknown-subcommand error):
```javascript
} else if (subcommand === 'sme') {
  // D-07: output template to stdout; caller redirects to target path
  const tmplPath = path.resolve(__dirname, '..', 'templates', 'sme.md');
  if (!fs.existsSync(tmplPath)) {
    error('SME template not found: ' + tmplPath);
  }
  const content = fs.readFileSync(tmplPath, 'utf-8');
  process.stdout.write(content);
```

**Also update the error message** to include `sme` in the available subcommands list:
```javascript
error('Unknown template subcommand. Available: select, fill, sme');
```

**Pattern rule:** D-07 explicitly requires stdout output, NOT `fs.writeFileSync`. The existing `fill` subcommand writes to disk via `template.cmdTemplateFill` — the new `sme` subcommand must NOT use that path. Use `process.stdout.write(content)` exclusively.

**Path resolution:** `__dirname` in `get-shit-done/bin/gsd-tools.cjs` resolves to `get-shit-done/bin/`. The template lives one directory up at `get-shit-done/templates/sme.md`, so `path.resolve(__dirname, '..', 'templates', 'sme.md')` is the correct resolution (matching how other template paths are resolved in this file).

---

### `get-shit-done/templates/sme.md` (config, file-I/O) — NEW FILE

**Analog:** `get-shit-done/templates/spec.md` — existing template with structured sections, YAML frontmatter, and HTML-comment guidance for creators.

**Frontmatter pattern** (from spec.md and D-04):
```markdown
---
process_name: [PROCESS_NAME]
last_analyzed_commit: [COMMIT_HASH]
block_mode: soft
created_date: [DATE]
finding_counts:
  blocker: 0
  warning: 0
  watch: 0
---
```

**Nested YAML note:** `reconstructFrontmatter` in `frontmatter.cjs` (lines 135-151) handles nested objects using 2-space indentation. The `finding_counts` object will round-trip correctly through frontmatter get/set operations at this indentation level.

**Section structure pattern** (D-03 — six flat H2 sections in fixed order):
```markdown
# [PROCESS_NAME] SME Document

## Process Overview

[Prose description of this process: what it does, who uses it, key invariants,
and the main code paths involved. Written by the creator agent after analysis.]

## Identified Risks

<!-- [BLOCKER] **Example risk title** — Brief description of the risk.
  *Evidence:* `src/path/to/file.ts:LINE` — what makes this a risk
  *Mitigation:* Specific action to address it -->

## Test Gaps

<!-- [WARNING] **Example gap title** — Brief description of what is not tested.
  *Evidence:* `tests/path/to/test.ts:LINE` — what coverage is missing
  *Mitigation:* Specific test or assertion to add -->

## Outdated Logic

<!-- [WATCH] **Example outdated pattern** — Brief description of stale logic.
  *Evidence:* `src/path/to/file.ts:LINE` — the outdated code
  *Mitigation:* How to modernize or document the pattern -->

## Edge Cases

<!-- [WARNING] **Example edge case** — Brief description of the edge case.
  *Evidence:* `src/path/to/file.ts:LINE` — where this can be triggered
  *Mitigation:* Defensive handling required -->

## Known Blockers

<!-- [BLOCKER] **Example known blocker** — Brief description of a known blocker.
  *Evidence:* Reference to issue, PR, or code location
  *Mitigation:* What must change before this process can be safely modified -->
```

**Finding format per D-01/D-02** (all four fields required on every finding):
```markdown
- [BLOCKER] **Race condition in payment lock acquisition** — Concurrent checkout requests can acquire the
  same lock ID when stock falls to exactly 1 unit.
  *Evidence:* `src/payments/checkout.ts:142` — lock check is not atomic
  *Mitigation:* Wrap lock check + acquire in a database transaction with `SELECT FOR UPDATE`
```

**HTML comment guidance pattern** (from spec.md): Each section that expects findings gets an HTML-commented example demonstrating the complete required format. The comment is stripped when the creator agent fills in real findings.

---

## Shared Patterns

### Config Key Parity (Three-File Atomic Rule)
**Source:** `tests/config-schema-docs-parity.test.cjs` + `tests/config-schema-sdk-parity.test.cjs`
**Apply to:** All config key additions — `config-schema.cjs`, `config-schema.ts`, `docs/CONFIGURATION.md` must be updated in a single commit.

The parity tests enforce:
1. Every key in `config-schema.cjs` VALID_CONFIG_KEYS appears backtick-wrapped in `docs/CONFIGURATION.md`
2. Every key in `config-schema.cjs` VALID_CONFIG_KEYS also exists in `sdk/src/query/config-schema.ts`
3. Every dynamic pattern's `test.source` in the CJS file equals the `source` string in the SDK mirror

**Run to verify:** `node --test tests/config-schema-docs-parity.test.cjs && node --test tests/config-schema-sdk-parity.test.cjs`

### Workflow Flag Default Convention
**Source:** `get-shit-done/bin/lib/config.cjs` lines 99-127, `sdk/src/config.ts` lines 92-118
**Apply to:** `workflow.use_sme_agents` in both `buildNewProjectConfig` and `CONFIG_DEFAULTS`

Opt-in flags (features that could break existing workflows if enabled by default) are explicitly set to `false`. Do NOT rely on `undefined` / absent key to mean disabled — the convention is an explicit `false` in both the CJS `hardcoded` object and the SDK `CONFIG_DEFAULTS`.

### YAML Frontmatter Nested Object
**Source:** `get-shit-done/bin/lib/frontmatter.cjs` lines 135-151 (`reconstructFrontmatter`)
**Apply to:** `get-shit-done/templates/sme.md` frontmatter `finding_counts` field

Nested objects serialize as:
```
finding_counts:
  blocker: 0
  warning: 0
  watch: 0
```
Two-space indentation per level, no quotes on numeric values. Three-level nesting is supported (object → subkey → sub-subkey).

### stdout Template Delivery
**Source:** `get-shit-done/bin/gsd-tools.cjs` lines 548-571 (existing template case structure)
**Apply to:** New `sme` branch in the template case block

Use `process.stdout.write(content)` followed by `break` (no return). Do NOT call `template.cmdTemplateFill` — that function writes directly to disk and contradicts D-07. The caller is responsible for capturing stdout and redirecting to the target path.

---

## No Analog Found

No files in this phase lack an analog. All seven files either edit existing structures with clear insertion points or have a close template analog (`spec.md`).

---

## Metadata

**Analog search scope:** `get-shit-done/bin/lib/`, `get-shit-done/bin/`, `get-shit-done/templates/`, `sdk/src/`, `sdk/src/query/`, `docs/`
**Files scanned:** 7 primary files (all read directly)
**Pattern extraction date:** 2026-04-28
