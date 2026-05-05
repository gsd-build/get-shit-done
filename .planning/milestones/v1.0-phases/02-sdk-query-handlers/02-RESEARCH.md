# Phase 2: SDK Query Handlers - Research

**Researched:** 2026-04-29
**Domain:** SDK query handler layer — TypeScript query handlers in `sdk/src/query/` registered via `createRegistry()` in `index.ts`
**Confidence:** HIGH

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SDK-01 | `sme.list` query returns all SME documents in `.planning/smes/` with their frontmatter metadata | `readdir` + `extractFrontmatter` pattern confirmed in `phase-list-queries.ts`; smes dir location confirmed in REQUIREMENTS.md |
| SDK-02 | `sme.detect-processes` query returns which processes a phase touches given file paths and phase goal keywords | Detection-by-filename-match pattern confirmed in `detect-phase-type.ts`; roadmap heading scan pattern confirmed in `detectPhaseType` |
| SDK-03 | `sme.context-block` query produces an XML block containing SME findings ready for injection into an agent prompt | XML block emission pattern confirmed in `skills.ts` (`<agent_skills>` block); SME section parsing pattern confirmed in `frontmatter.ts` + existing section-parsing handlers |
</phase_requirements>

## Summary

Phase 2 implements three SDK-only query handlers that form the data access layer for all downstream SME features. All three handlers follow the established `QueryHandler` function signature in `utils.ts` and are registered as dotted + space-delimited aliases in `createRegistry()` in `index.ts`. No new npm dependencies are needed — the handlers use `node:fs/promises`, `node:path`, and existing helpers (`planningPaths`, `extractFrontmatter`, `loadConfig`) exactly as existing handlers do.

The handlers read from `.planning/smes/` (a directory that does not yet exist at project start but is accessed gracefully — when the directory is absent, handlers return empty-array results rather than erroring). Process detection (`sme.detect-processes`) matches file paths and phase keywords against SME document `process_name` frontmatter values using simple string/regex matching, consistent with how `detect-phase-type.ts` implements its heading-based detection.

The golden policy requires that every canonical command registered in `createRegistry()` appear either in the subprocess-golden covered set or in `NO_CJS_SUBPROCESS_REASON`. Because these handlers have no `gsd-tools.cjs` counterpart, each must be added to `NO_CJS_SUBPROCESS_REASON` in `golden-policy.ts` with the SDK-only rationale and test file reference. This is the same pattern used for all other SDK-only handlers (e.g., `check.gates`, `detect.phase-type`, `phase.list-plans`).

**Primary recommendation:** Implement handlers as a single new file `sdk/src/query/sme.ts`, register all three (with dotted + space aliases) in `index.ts`, add unit test file `sdk/src/query/sme.test.ts`, and add `NO_CJS_SUBPROCESS_REASON` entries in `golden-policy.ts`. All four files per plan.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| SME document listing (`sme.list`) | SDK query layer | Filesystem | Handler reads `.planning/smes/` dir and extracts frontmatter; no UI or API tier involvement |
| Process detection (`sme.detect-processes`) | SDK query layer | Filesystem | Compares file paths + keyword args against SME `process_name` values; reads `.planning/smes/` |
| Context block production (`sme.context-block`) | SDK query layer | Filesystem | Reads SME documents and formats XML block for prompt injection; pure data transform |
| Handler registration | SDK registry (`index.ts`) | — | `createRegistry()` owns all handler registration; each new handler follows the same import + register pattern |
| Golden policy compliance | SDK golden layer (`golden-policy.ts`) | — | Every new canonical must be explicitly accounted for; no auto-registration |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.7.0 (existing) | Handler implementation | Only language for SDK query logic; `--strict` + NodeNext already configured |
| `node:fs/promises` | built-in | `readdir`, `readFile` for `.planning/smes/` | All existing handlers use this; zero new deps |
| `node:path` | built-in | `join`, `relative` for path construction | Standard across all handlers |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `extractFrontmatter` from `./frontmatter.js` | existing | Parse YAML frontmatter from SME documents | Used in `sme.list` and `sme.context-block` to extract `process_name`, `block_mode`, `finding_counts` |
| `planningPaths` from `./helpers.js` | existing | Get `join(projectDir, '.planning')` base path | Used to construct the smes dir path: `join(planningPaths(projectDir).planning, 'smes')` |
| `loadConfig` from `../config.js` | existing | Read `workflow.use_sme_agents` flag | Used in all three handlers to check if SME feature is enabled before doing any work |
| `GSDError` / `ErrorClassification` from `../errors.js` | existing | Throw typed errors for bad inputs | Consistent error classification across all handlers |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `extractFrontmatter` (last-block parser) | `extractFrontmatterLeading` (first-block parser) | Use `extractFrontmatter` (last-block) — matches how PLAN.md files are parsed throughout the query layer; SME docs have a single frontmatter block, so either works, but consistency dictates last-block |
| Simple string `includes()` for keyword matching in `sme.detect-processes` | Full regex scoring | Simple `includes` + `toLowerCase` is sufficient for v1 — same approach as heading keyword matching in `detect-phase-type.ts`; regex scoring adds complexity with minimal accuracy gain at this scale |

**Installation:** No new packages required.

## Architecture Patterns

### System Architecture Diagram

```
Caller (workflow / agent)
         │
         │ gsd-sdk query sme.list | sme.detect-processes | sme.context-block
         ▼
  normalizeQueryCommand()          ← normalize-query-command.ts
         │
         ▼
  resolveQueryArgv()               ← registry.ts (longest-prefix match)
         │
         ▼
  registry.dispatch()              ← registry.ts
         │
    ┌────┴──────────────┐
    │   sme.ts handlers │
    │  ┌──────────────┐ │
    │  │  smeList     │─┼──► readdir(.planning/smes/) → extractFrontmatter per file
    │  ├──────────────┤ │
    │  │  smeDetect   │─┼──► readdir(.planning/smes/) → match process_name vs args
    │  ├──────────────┤ │         also: scan ROADMAP heading for phase keywords
    │  │  smeContext  │─┼──► readFile(sme doc) → filter sections → build XML block
    │  └──────────────┘ │
    └───────────────────┘
         │
         ▼
  { data: ... }                    ← QueryResult<T> written to stdout as JSON
```

### Recommended Project Structure
```
sdk/src/query/
├── sme.ts              # NEW — three handlers: smeList, smeDetectProcesses, smeContextBlock
├── sme.test.ts         # NEW — unit tests for all three handlers
└── index.ts            # MODIFIED — import + register all three (dotted + space aliases)

sdk/src/golden/
└── golden-policy.ts    # MODIFIED — add NO_CJS_SUBPROCESS_REASON entries for 3 new canonicals
```

### Pattern 1: QueryHandler Function Signature
**What:** Every handler is `export const name: QueryHandler = async (args, projectDir, workstream?) => { ... }` returning `{ data: T }`.
**When to use:** Always — the `QueryHandler` type from `utils.ts` is the contract the registry enforces.
**Example:**
```typescript
// Source: sdk/src/query/utils.ts (QueryHandler type)
// Source: sdk/src/query/check-auto-mode.ts (minimal example)
import type { QueryHandler } from './utils.js';
import { loadConfig } from '../config.js';

export const smeList: QueryHandler = async (args, projectDir, workstream) => {
  const config = await loadConfig(projectDir, workstream);
  if (!config.workflow.use_sme_agents) {
    return { data: { enabled: false, smes: [] } };
  }
  // ... readdir + extractFrontmatter logic
  return { data: { enabled: true, smes: [...] } };
};
```

### Pattern 2: Safe Directory Listing (directory may not exist)
**What:** Use try/catch around `readdir` — when `.planning/smes/` doesn't exist yet, return empty array rather than throwing.
**When to use:** Any handler reading a directory that is created on first use.
**Example:**
```typescript
// Source: sdk/src/query/phase-list-queries.ts (resolvePhaseDir pattern)
import { readdir } from 'node:fs/promises';

let entries: string[];
try {
  entries = await readdir(smesDir);
} catch {
  return { data: { smes: [] } };
}
```

### Pattern 3: Frontmatter Extraction for Listing
**What:** `readFile` + `extractFrontmatter` to pull structured metadata from each file.
**When to use:** `sme.list` and `sme.context-block` — need frontmatter fields from SME documents.
**Example:**
```typescript
// Source: sdk/src/query/phase-list-queries.ts (phaseListPlans pattern)
import { readFile } from 'node:fs/promises';
import { extractFrontmatter } from './frontmatter.js';

const content = await readFile(filePath, 'utf-8');
const fm = extractFrontmatter(content) as Record<string, unknown>;
// Access: fm.process_name, fm.block_mode, fm.finding_counts, fm.last_analyzed_commit
```

### Pattern 4: XML Block Emission for Agent Prompts
**What:** Wrap content in XML tags with embedded `@`-reference style for agent consumption.
**When to use:** `sme.context-block` — the downstream consumers (auditor agent, discuss-phase) expect an XML block matching the `<agent_skills>` / `<sme_context>` convention.
**Example:**
```typescript
// Source: sdk/src/query/skills.ts (agentSkills handler — analogous XML block)
return {
  data: `<sme_context>\n${smeFindings}\n</sme_context>`,
};
```

### Pattern 5: Handler Registration (dotted + space aliases)
**What:** Every new handler gets two registrations: `'sme.list'` (dotted) and `'sme list'` (space-delimited).
**When to use:** Every new handler in `createRegistry()` — the resolver tries both forms.
**Example:**
```typescript
// Source: sdk/src/query/index.ts (phase.list-plans registration pattern)
import { smeList, smeDetectProcesses, smeContextBlock } from './sme.js';

registry.register('sme.list', smeList);
registry.register('sme list', smeList);
registry.register('sme.detect-processes', smeDetectProcesses);
registry.register('sme detect-processes', smeDetectProcesses);
registry.register('sme.context-block', smeContextBlock);
registry.register('sme context-block', smeContextBlock);
```

### Pattern 6: Golden Policy Exception (SDK-only handlers)
**What:** Every canonical command without a `gsd-tools.cjs` mirror must have an entry in `NO_CJS_SUBPROCESS_REASON` in `golden-policy.ts`. Failing to add this causes the `golden-policy.test.ts` suite to fail.
**When to use:** Any new handler that is SDK-only (no CJS equivalent). The `verifyGoldenPolicyComplete()` function checks every canonical returned by `getCanonicalRegistryCommands()` — which dedupes dotted vs space aliases and picks the canonical (dotted) form. So three new canonicals need three new entries.
**Example:**
```typescript
// Source: sdk/src/golden/golden-policy.ts (NO_CJS_SUBPROCESS_REASON)
const NO_CJS_SUBPROCESS_REASON: Record<string, string> = {
  // ... existing entries ...
  'sme.list':
    'SDK-only SME listing query (no `gsd-tools.cjs` mirror). Covered in sdk/src/query/sme.test.ts.',
  'sme.detect-processes':
    'SDK-only SME process detection query (no `gsd-tools.cjs` mirror). Covered in sdk/src/query/sme.test.ts.',
  'sme.context-block':
    'SDK-only SME context block producer (no `gsd-tools.cjs` mirror). Covered in sdk/src/query/sme.test.ts.',
};
```

### Anti-Patterns to Avoid
- **Throwing when `.planning/smes/` does not exist:** The directory is created lazily by the SME creator (Phase 3). Handlers must return `{ smes: [] }` / empty XML block when the directory is absent, not throw a `GSDError`.
- **Omitting `NO_CJS_SUBPROCESS_REASON` entries:** Adding handlers to `createRegistry()` without updating `golden-policy.ts` causes `golden-policy.test.ts` to fail. Every new canonical must be explicitly accounted for.
- **Using only dotted registration without space alias:** Handlers must be registered under both `'sme.list'` and `'sme list'` — `resolveQueryArgv` tries both forms; missing the space alias breaks CLI invocations like `gsd-sdk query sme list`.
- **Skipping `use_sme_agents` guard:** Other handlers in the feature gate-check `config.workflow.use_sme_agents` before executing. The `sme.list` and `sme.detect-processes` handlers should return a graceful disabled result (not an error) when `use_sme_agents` is `false`. This matches the CONFIG-02 requirement and the `checkAutoMode` precedent.
- **Hardcoding `.planning/smes/` path string:** Use `join(planningPaths(projectDir, workstream).planning, 'smes')` so workstream-scoped invocations work correctly.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YAML frontmatter parsing | Custom regex-based parser | `extractFrontmatter` from `./frontmatter.js` | Already handles nested YAML, inline arrays, quote-aware parsing; hand-rolled parsers break on edge cases |
| Config reading | Direct `readFile('.planning/config.json')` | `loadConfig` from `../config.js` | Handles workstream scoping, user defaults, mergeDefaults, and error cases |
| Path construction for `.planning/` files | `join(projectDir, '.planning', ...)` directly | `planningPaths(projectDir, workstream).planning` + sub-join | Workstream-aware; already handles `.planning/workstreams/<name>/` routing |
| XML block quoting | Custom escaping | Keep SME document content as-is (it's markdown, not user HTML) | SME documents are trusted author content, not user input; no escaping needed |
| Process name validation | Custom regex at detection time | Use the SME document `process_name` frontmatter value directly | Ground truth is what's in the file; don't re-derive what the document already states |

**Key insight:** The query handler layer in this codebase is deliberately thin — it composes existing utilities (`extractFrontmatter`, `loadConfig`, `planningPaths`) rather than reimplementing any of their logic. New handlers follow the same composition model.

## Common Pitfalls

### Pitfall 1: Golden Policy Test Failure
**What goes wrong:** New handlers are registered in `createRegistry()` but `NO_CJS_SUBPROCESS_REASON` in `golden-policy.ts` is not updated. The `golden-policy.test.ts` suite calls `verifyGoldenPolicyComplete()` which fails with "Missing golden coverage for: sme.list" (or similar).
**Why it happens:** The golden policy system is a compile-time/test-time contract — it discovers all registered canonicals at test time and checks each. It does not auto-accept new handlers.
**How to avoid:** After adding registrations in `index.ts`, immediately add the three `NO_CJS_SUBPROCESS_REASON` entries in `golden-policy.ts`. The entries must reference `sme.test.ts` (since that's where unit coverage lives).
**Warning signs:** `cd sdk && npx vitest run --project unit` fails with "Missing golden coverage" or "Unaccounted canonical command."

### Pitfall 2: Space-Alias Missing From Registration
**What goes wrong:** Handler only registered as `'sme.list'` (dotted) but not `'sme list'` (space-delimited). CLI invocation `gsd-sdk query sme list` falls through to the CJS fallback (which doesn't have the handler either) and produces an error.
**Why it happens:** The pattern in `index.ts` for all recent SDK-only handlers registers both forms. It's easy to miss the space form when looking at the file structure.
**How to avoid:** Always add both aliases together — search `index.ts` for `phase.list-plans` to see the correct paired pattern.
**Warning signs:** `gsd-sdk query sme list` errors but `gsd-sdk query sme.list` works.

### Pitfall 3: Smes Directory Path Ignores Workstream
**What goes wrong:** Handler constructs smes path as `join(projectDir, '.planning', 'smes')` directly. When the handler is invoked inside a workstream-scoped session (`.planning/workstreams/<name>/`), it reads the wrong directory.
**Why it happens:** Direct string construction bypasses `planningPaths()` which handles workstream routing.
**How to avoid:** Always use `join(planningPaths(projectDir, workstream).planning, 'smes')`.
**Warning signs:** Handler works in standard project but returns empty results in workstream-scoped calls.

### Pitfall 4: `use_sme_agents: false` Causes Throw Instead of Graceful Response
**What goes wrong:** Handler throws `GSDError` when `use_sme_agents` is `false`, instead of returning `{ enabled: false, smes: [] }`. Callers in workflows hit an unexpected error path.
**Why it happens:** The QUERY-HANDLERS.md convention distinguishes throw (programmer error, bad args) from `data.error` (domain failure, expected). A disabled feature gate is a domain condition, not a programmer error.
**How to avoid:** Return `{ data: { enabled: false, smes: [], ... } }` when `use_sme_agents` is `false`. Only throw `GSDError(Validation)` for genuinely invalid inputs (missing required args).
**Warning signs:** Workflows crash with "Unknown error" when SME is not enabled.

### Pitfall 5: `sme.context-block` Called With Unknown Process Name
**What goes wrong:** Caller passes a process name that has no corresponding SME file. Handler throws or returns an error object that downstream agents don't know how to handle.
**Why it happens:** `sme.context-block` is called by the gate and discuss-phase after `sme.detect-processes` determines which processes are relevant — but the SME file may not exist for a detected process.
**How to avoid:** Return `{ data: { found: false, process: name, block: '' } }` when the requested SME document does not exist. This matches the `data.error` / graceful-failure convention for "operation could not complete in this project state."
**Warning signs:** Gate crashes with unhandled error when a process is detected but has no SME.

## Code Examples

Verified patterns from official sources:

### Handler with disabled-state guard
```typescript
// Source: sdk/src/query/check-auto-mode.ts (loadConfig + graceful disabled response pattern)
export const smeList: QueryHandler = async (args, projectDir, workstream) => {
  let config;
  try {
    config = await loadConfig(projectDir, workstream);
  } catch {
    return { data: { enabled: false, smes: [] } };
  }

  if (!config.workflow.use_sme_agents) {
    return { data: { enabled: false, smes: [] } };
  }

  const smesDir = join(planningPaths(projectDir, workstream).planning, 'smes');
  let files: string[];
  try {
    files = await readdir(smesDir);
  } catch {
    return { data: { enabled: true, smes: [] } };
  }

  const smeFiles = files.filter(f => f.endsWith('-SME.md'));
  const smes: Array<Record<string, unknown>> = [];
  for (const file of smeFiles.sort()) {
    const content = await readFile(join(smesDir, file), 'utf-8');
    const fm = extractFrontmatter(content) as Record<string, unknown>;
    smes.push({
      file,
      process_name: fm.process_name ?? null,
      block_mode: fm.block_mode ?? 'soft',
      last_analyzed_commit: fm.last_analyzed_commit ?? null,
      finding_counts: fm.finding_counts ?? { blocker: 0, warning: 0, watch: 0 },
    });
  }
  return { data: { enabled: true, smes } };
};
```

### Registration pattern in index.ts
```typescript
// Source: sdk/src/query/index.ts (phase.list-plans registration — exact analog)
import { smeList, smeDetectProcesses, smeContextBlock } from './sme.js';

// In createRegistry():
registry.register('sme.list', smeList);
registry.register('sme list', smeList);
registry.register('sme.detect-processes', smeDetectProcesses);
registry.register('sme detect-processes', smeDetectProcesses);
registry.register('sme.context-block', smeContextBlock);
registry.register('sme context-block', smeContextBlock);
```

### Golden policy exception entry
```typescript
// Source: sdk/src/golden/golden-policy.ts (NO_CJS_SUBPROCESS_REASON — exact format)
'sme.list':
  'SDK-only SME document listing query (no `gsd-tools.cjs` mirror). Covered in sdk/src/query/sme.test.ts.',
'sme.detect-processes':
  'SDK-only SME process detection query (no `gsd-tools.cjs` mirror). Covered in sdk/src/query/sme.test.ts.',
'sme.context-block':
  'SDK-only SME context block producer (no `gsd-tools.cjs` mirror). Covered in sdk/src/query/sme.test.ts.',
```

### Unit test scaffold
```typescript
// Source: sdk/src/query/check-gates.test.ts (tmp dir fixture pattern — exact convention)
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { smeList } from './sme.js';

describe('smeList', () => {
  let projectDir: string;

  beforeEach(async () => {
    projectDir = join(tmpdir(), `gsd-sme-list-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(join(projectDir, '.planning', 'smes'), { recursive: true });
    await writeFile(
      join(projectDir, '.planning', 'config.json'),
      JSON.stringify({ workflow: { use_sme_agents: true } }),
      'utf-8',
    );
  });

  afterEach(async () => {
    await rm(projectDir, { recursive: true, force: true });
  });

  it('returns empty array when smes dir is empty', async () => {
    const { data } = await smeList([], projectDir);
    const d = data as Record<string, unknown>;
    expect(d.enabled).toBe(true);
    expect(d.smes).toEqual([]);
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| CJS-only command handlers | TypeScript SDK handlers in `sdk/src/query/` | Ongoing migration | New handlers go in TypeScript only; CJS fallback exists for legacy commands but new features are SDK-first |
| Manual golden policy updates | `verifyGoldenPolicyComplete()` enforcement in `golden-policy.test.ts` | Current | Every new handler must be accounted for in golden policy; test fails at CI if not updated |

**No deprecated approaches for this domain** — all three handlers are net-new with no legacy equivalent to replace.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `sme.context-block` should return an XML block (not JSON array of findings) | Architecture Patterns, Code Examples | If downstream consumers expect JSON, the block format would need to change; but `<agent_skills>` precedent and REQUIREMENTS.md `<sme_context>` reference support XML |
| A2 | `sme.detect-processes` should accept `--file-paths` and `--keywords` args (or positional args for file paths + phase goal) | Architecture Patterns | Arg format is not specified in requirements; confirmed from REQUIREMENTS.md "given a set of file paths and phase goal keywords" — positional or flags both work; recommend flags for clarity |
| A3 | All three handlers live in one file (`sme.ts`) rather than three separate files | Standard Stack | Per project conventions single-responsibility files are preferred, but three closely related handlers for one domain area is consistent with how `phase-list-queries.ts` groups `phaseListPlans` + `phaseListArtifacts` |

## Open Questions

1. **`sme.detect-processes` argument format**
   - What we know: Requirements say "given a set of file paths and phase goal keywords" (SDK-02)
   - What's unclear: Whether to use `--file-paths path1 path2 --keywords word1 word2` flags or positional args; whether phase goal is a single string or a list of keywords
   - Recommendation: Use `--file-paths` (multiple occurrences accepted) and `--goal` (single quoted string) flags — matches `phase.list-plans --with-schema` arg style and avoids ambiguity in positional parsing; detection logic splits the goal string on whitespace into keywords

2. **`sme.context-block` output depth**
   - What we know: Requirements say "SME findings ready for injection into an agent prompt" (SDK-03); `<agent_skills>` pattern in `skills.ts` emits a full XML block
   - What's unclear: Whether the block should include all sections of the SME document or only BLOCKER/WARNING findings; token budget implications for large SME documents
   - Recommendation: Include all named sections (Process Overview, Identified Risks, Test Gaps, Outdated Logic, Edge Cases, Known Blockers) verbatim — the auditor agent (Phase 5) and discuss-phase integration (Phase 7) consumers should decide what's relevant; filtering at this layer would be lossy and hard to change later

## Environment Availability

Step 2.6: SKIPPED — Phase 2 is code-only (new TypeScript source files + registry edits). No external tools, services, or CLI utilities beyond the existing project build chain are required.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.4 |
| Config file | `sdk/vitest.config.ts` |
| Quick run command | `cd sdk && npx vitest run --project unit src/query/sme.test.ts` |
| Full suite command | `cd sdk && npx vitest run --project unit` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SDK-01 | `sme.list` returns empty array when smes dir missing | unit | `cd sdk && npx vitest run --project unit src/query/sme.test.ts` | Wave 0 |
| SDK-01 | `sme.list` returns disabled result when `use_sme_agents: false` | unit | `cd sdk && npx vitest run --project unit src/query/sme.test.ts` | Wave 0 |
| SDK-01 | `sme.list` returns frontmatter metadata for each SME file | unit | `cd sdk && npx vitest run --project unit src/query/sme.test.ts` | Wave 0 |
| SDK-02 | `sme.detect-processes` returns empty when no SMEs exist | unit | `cd sdk && npx vitest run --project unit src/query/sme.test.ts` | Wave 0 |
| SDK-02 | `sme.detect-processes` matches process by file path overlap | unit | `cd sdk && npx vitest run --project unit src/query/sme.test.ts` | Wave 0 |
| SDK-02 | `sme.detect-processes` matches process by keyword in goal string | unit | `cd sdk && npx vitest run --project unit src/query/sme.test.ts` | Wave 0 |
| SDK-03 | `sme.context-block` returns empty block when SME not found | unit | `cd sdk && npx vitest run --project unit src/query/sme.test.ts` | Wave 0 |
| SDK-03 | `sme.context-block` returns XML block with all SME sections | unit | `cd sdk && npx vitest run --project unit src/query/sme.test.ts` | Wave 0 |
| All | golden-policy.test.ts passes with new canonical entries | unit | `cd sdk && npx vitest run --project unit src/golden/golden-policy.test.ts` | exists |

### Sampling Rate
- **Per task commit:** `cd sdk && npx vitest run --project unit src/query/sme.test.ts`
- **Per wave merge:** `cd sdk && npx vitest run --project unit`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `sdk/src/query/sme.test.ts` — covers all SDK-01, SDK-02, SDK-03 behaviors listed above; does not exist yet
- [ ] `sdk/src/query/sme.ts` — the handler implementations themselves; Wave 0 creates the test file, Wave 1 creates the implementation

*(Framework install: not needed — Vitest is already installed and configured in `sdk/`)*

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | Validate args (process name, file paths) are non-empty strings; no user input reaches filesystem as unvalidated paths |
| V6 Cryptography | no | — |

### Known Threat Patterns for SDK Query Handlers

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal via `--file-paths` arg | Tampering | Handlers use `planningPaths()` for the smes dir base — only filenames from `readdir` are composed with it, not user-supplied paths. `sme.detect-processes` receives file paths as match keywords, not as paths to open. |
| `process_name` frontmatter injection into XML block | Tampering | SME documents are author-created project files, not user-supplied runtime input. Same trust level as PLAN.md files read by other handlers. Accept as-is. |
| Malformed/missing frontmatter causing handler crash | Denial of Service | Wrap frontmatter access with null coalescing (`fm.process_name ?? null`); never throw on missing optional fields. |

## Sources

### Primary (HIGH confidence)
- `[VERIFIED: codebase grep]` — `sdk/src/query/` directory — complete listing of existing handlers and their patterns
- `[VERIFIED: codebase read]` — `sdk/src/query/phase-list-queries.ts` — direct analog for `sme.list` listing pattern
- `[VERIFIED: codebase read]` — `sdk/src/query/detect-phase-type.ts` — direct analog for process detection via heading/keyword matching
- `[VERIFIED: codebase read]` — `sdk/src/query/skills.ts` — direct analog for XML block emission (`<agent_skills>` pattern)
- `[VERIFIED: codebase read]` — `sdk/src/query/index.ts` — registration pattern (dotted + space aliases) and `QUERY_MUTATION_COMMANDS` set
- `[VERIFIED: codebase read]` — `sdk/src/golden/golden-policy.ts` — `NO_CJS_SUBPROCESS_REASON` format and `verifyGoldenPolicyComplete()` enforcement
- `[VERIFIED: codebase read]` — `sdk/src/query/utils.ts` — `QueryHandler` type and `QueryResult` interface
- `[VERIFIED: codebase read]` — `sdk/src/config.ts` — `GSDConfig` type with `sme?` field and `use_sme_agents` flag (Phase 1 output)
- `[VERIFIED: codebase read]` — `.planning/REQUIREMENTS.md` — exact requirement text for SDK-01, SDK-02, SDK-03
- `[VERIFIED: shell]` — `cd sdk && npx vitest run --project unit src/query/check-gates.test.ts` passes — confirms test runner works and pattern is valid

### Secondary (MEDIUM confidence)
- `[VERIFIED: codebase read]` — `.planning/research/STACK.md` and `.planning/research/PITFALLS.md` — project-level research from prior milestone planning

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries are existing project dependencies; verified via codebase grep
- Architecture: HIGH — handler structure, registration pattern, and golden policy requirement verified by reading the actual source files
- Pitfalls: HIGH — golden policy pitfall verified by reading `golden-policy.test.ts`; workstream path pitfall verified by reading `planningPaths()`; disabled-state pitfall verified by reading QUERY-HANDLERS.md error convention

**Research date:** 2026-04-29
**Valid until:** 2026-05-29 (stable domain — these are internal SDK conventions, not external dependencies)
