# Phase 2: SDK Query Handlers - Pattern Map

**Mapped:** 2026-04-29
**Files analyzed:** 4 (2 new, 2 modified)
**Analogs found:** 4 / 4

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `sdk/src/query/sme.ts` | query handler (service) | request-response + file-I/O | `sdk/src/query/phase-list-queries.ts` | exact (listing + readdir + extractFrontmatter) |
| `sdk/src/query/sme.test.ts` | test | batch | `sdk/src/query/check-gates.test.ts` + `sdk/src/query/phase-list-queries.test.ts` | exact (tmp-dir fixture pattern) |
| `sdk/src/query/index.ts` | config/registry | request-response | self — pattern: lines 292-404 (`phase.list-plans` paired registration block) | exact (dotted + space aliases) |
| `sdk/src/golden/golden-policy.ts` | config/policy | — | self — `NO_CJS_SUBPROCESS_REASON` block at lines 25-54 | exact (SDK-only exception entries) |

---

## Pattern Assignments

### `sdk/src/query/sme.ts` (query handler, request-response + file-I/O)

**Primary analog:** `sdk/src/query/phase-list-queries.ts`
**Secondary analog (XML block):** `sdk/src/query/skills.ts`
**Secondary analog (config guard):** `sdk/src/query/check-auto-mode.ts`

#### Imports pattern (`phase-list-queries.ts` lines 1-17):
```typescript
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { GSDError, ErrorClassification } from '../errors.js';
import { extractFrontmatter } from './frontmatter.js';
import { planningPaths } from './helpers.js';
import type { QueryHandler } from './utils.js';
import { loadConfig } from '../config.js';
```
Note: `relative` and `toPosixPath` from `phase-list-queries.ts` are not needed in `sme.ts` — SME handlers return file names (not relative paths) and do not compose project-relative paths.

#### Config guard + graceful disabled response pattern (`check-auto-mode.ts` lines 32-49, adapted):
```typescript
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
  // ... continue with work
};
```
The `try/catch` around `loadConfig` is the same pattern used in `skills.ts` lines 59-64.

#### Safe directory listing pattern (`phase-list-queries.ts` lines 20-33, `resolvePhaseDir`):
```typescript
let files: string[];
try {
  files = await readdir(smesDir);
} catch {
  return { data: { enabled: true, smes: [] } };
}
```
The `catch` block returns a graceful empty result — not a throw. This is the canonical pattern for directories that are created lazily.

#### Frontmatter extraction loop pattern (`phase-list-queries.ts` lines 122-143):
```typescript
const planFiles = phaseFiles.filter(f => f.endsWith('-PLAN.md') || f === 'PLAN.md').sort();
const plans: Array<Record<string, unknown>> = [];
for (const planFile of planFiles) {
  const content = await readFile(join(phaseDir, planFile), 'utf-8');
  const fm = extractFrontmatter(content) as Record<string, unknown>;
  plans.push({
    // Use fm.field ?? fallback for every optional field
    wave: parseInt(String(fm.wave ?? '1'), 10) || 1,
  });
}
return { data: { phase: normalized, plans } };
```
For `sme.ts`, filter pattern is `f.endsWith('-SME.md')`, and fields are `fm.process_name ?? null`, `fm.block_mode ?? 'soft'`, etc.

#### Validation / throw pattern (`phase-list-queries.ts` lines 44-50):
```typescript
if (!args[0]) {
  throw new GSDError('phase required', ErrorClassification.Validation);
}
```
`GSDError` with `ErrorClassification.Validation` is the only case where handlers throw — for genuinely bad inputs (missing required arg). Domain failures (missing dir, unknown process) return `data.error` or empty arrays.

#### XML block emission pattern (`skills.ts` lines 125-128):
```typescript
return {
  data: `<agent_skills>\nRead these user-configured skills:\n${lines}\n</agent_skills>`,
};
```
For `sme.context-block`, replace outer tag with `<sme_context>` and embed the SME document content verbatim.

#### Path construction — always via `planningPaths`:
```typescript
// CORRECT — workstream-aware
const smesDir = join(planningPaths(projectDir, workstream).planning, 'smes');

// WRONG — bypasses workstream routing
const smesDir = join(projectDir, '.planning', 'smes');
```
Source: `planningPaths` signature at `sdk/src/query/helpers.ts` line 419: `export function planningPaths(projectDir: string, workstream?: string): PlanningPaths`.

---

### `sdk/src/query/sme.test.ts` (test, batch)

**Primary analog:** `sdk/src/query/check-gates.test.ts` (tmp-dir fixture with `config.json`)
**Secondary analog:** `sdk/src/query/phase-list-queries.test.ts` (tmp-dir fixture with structured files)

#### File-level scaffold pattern (`check-gates.test.ts` lines 1-27):
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { smeList } from './sme.js';

describe('smeList', () => {
  let projectDir: string;

  beforeEach(async () => {
    projectDir = join(
      tmpdir(),
      `gsd-sme-list-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
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
```
Key: unique tmp dir name includes `Date.now()` + random suffix to prevent parallel-test collisions.

#### Test assertion pattern (`phase-list-queries.test.ts` lines 54-70):
```typescript
it('returns empty array when smes dir is empty', async () => {
  const { data } = await smeList([], projectDir);
  const d = data as Record<string, unknown>;
  expect(d.enabled).toBe(true);
  expect(d.smes).toEqual([]);
});
```
Always cast `data` to `Record<string, unknown>` before assertion — `QueryResult<T>` uses `unknown` by default.

#### Disabled-state test pattern (copy from `check-auto-mode.test.ts` style):
```typescript
it('returns disabled result when use_sme_agents is false', async () => {
  await writeFile(
    join(projectDir, '.planning', 'config.json'),
    JSON.stringify({ workflow: { use_sme_agents: false } }),
    'utf-8',
  );
  const { data } = await smeList([], projectDir);
  const d = data as Record<string, unknown>;
  expect(d.enabled).toBe(false);
});
```

#### Missing-directory test pattern (no setup of smes dir):
```typescript
it('returns empty array when smes dir does not exist', async () => {
  // No mkdir for '.planning/smes' in this test
  const { data } = await smeList([], projectDir);
  const d = data as Record<string, unknown>;
  expect(d.enabled).toBe(true);
  expect(d.smes).toEqual([]);
});
```

---

### `sdk/src/query/index.ts` (registry config, MODIFIED)

**Pattern source:** `sdk/src/query/index.ts` lines 292-295 + 386-404

#### Import line to add (near line 94, after `detectPhaseType` import):
```typescript
import { smeList, smeDetectProcesses, smeContextBlock } from './sme.js';
```
Convention: imports are grouped by domain — place after the last decision-routing import (line 96: `checkShipReady`).

#### Registration block to append inside `createRegistry()` (after line 404, `check ship-ready` block):
```typescript
// SME query handlers (SDK-only — no `gsd-tools.cjs` mirror; see golden-policy.ts)
registry.register('sme.list', smeList);
registry.register('sme list', smeList);
registry.register('sme.detect-processes', smeDetectProcesses);
registry.register('sme detect-processes', smeDetectProcesses);
registry.register('sme.context-block', smeContextBlock);
registry.register('sme context-block', smeContextBlock);
```
Pattern rule: dotted alias first, then space-delimited alias on the next line — always in pairs. Source: `phase.list-plans` / `phase list-plans` at lines 292-293.

---

### `sdk/src/golden/golden-policy.ts` (policy config, MODIFIED)

**Pattern source:** `sdk/src/golden/golden-policy.ts` lines 25-54 (`NO_CJS_SUBPROCESS_REASON` block)

#### Entries to add to `NO_CJS_SUBPROCESS_REASON` (after line 53, before the closing `}`):
```typescript
'sme.list':
  'SDK-only SME document listing query (no `gsd-tools.cjs` mirror). Covered in sdk/src/query/sme.test.ts.',
'sme.detect-processes':
  'SDK-only SME process detection query (no `gsd-tools.cjs` mirror). Covered in sdk/src/query/sme.test.ts.',
'sme.context-block':
  'SDK-only SME context block producer (no `gsd-tools.cjs` mirror). Covered in sdk/src/query/sme.test.ts.',
```
Format rule: value is a single-line string — key is the canonical (dotted) form, NOT the space-delimited alias. `verifyGoldenPolicyComplete()` deduplicates dotted vs space aliases and checks only the canonical form. Three new entries required; missing even one causes `golden-policy.test.ts` to fail.

---

## Shared Patterns

### `QueryHandler` Function Signature
**Source:** `sdk/src/query/utils.ts` lines 30-34
**Apply to:** All three handler functions in `sme.ts`
```typescript
export type QueryHandler<T = unknown> = (
  args: string[],
  projectDir: string,
  workstream?: string,
) => Promise<QueryResult<T>>;
```

### `loadConfig` + Feature-Flag Guard
**Source:** `sdk/src/query/check-auto-mode.ts` lines 32-50 / `sdk/src/query/skills.ts` lines 59-67
**Apply to:** `smeList`, `smeDetectProcesses`, `smeContextBlock`
```typescript
let config;
try {
  config = await loadConfig(projectDir, workstream);
} catch {
  return { data: { enabled: false, /* handler-specific empty fields */ } };
}
if (!config.workflow.use_sme_agents) {
  return { data: { enabled: false, /* handler-specific empty fields */ } };
}
```

### Safe `readdir` with Missing-Directory Fallback
**Source:** `sdk/src/query/phase-list-queries.ts` lines 23-33
**Apply to:** `smeList`, `smeDetectProcesses`, `smeContextBlock`
```typescript
try {
  entries = await readdir(smesDir);
} catch {
  return { data: { /* empty/not-found result */ } };
}
```

### Input Validation with `GSDError`
**Source:** `sdk/src/query/phase-list-queries.ts` lines 44-50
**Apply to:** `smeDetectProcesses` (if `--file-paths` or `--goal` missing), `smeContextBlock` (if process name arg missing)
```typescript
throw new GSDError('<message>', ErrorClassification.Validation);
```

### Null-Coalescing Frontmatter Access
**Source:** `sdk/src/query/phase-list-queries.ts` lines 130-141
**Apply to:** All frontmatter reads in `sme.ts`
```typescript
const fm = extractFrontmatter(content) as Record<string, unknown>;
// Always use ?? fallback — frontmatter fields are optional
fm.process_name ?? null
fm.block_mode ?? 'soft'
fm.finding_counts ?? { blocker: 0, warning: 0, watch: 0 }
```

### Graceful Not-Found Response (domain failure, not throw)
**Source:** `sdk/src/query/phase-list-queries.ts` lines 112-119
**Apply to:** `smeContextBlock` when the requested SME document does not exist
```typescript
return {
  data: {
    phase: normalized,
    plans: [] as Array<Record<string, unknown>>,
    error: 'Phase not found',
  },
};
```
Adapt for `sme.context-block`: `{ found: false, process: name, block: '' }`.

---

## No Analog Found

All four files have close analogs. No files require fallback to RESEARCH.md patterns only.

---

## Metadata

**Analog search scope:** `sdk/src/query/`, `sdk/src/golden/`
**Files scanned:** 6 analog files read in full: `phase-list-queries.ts`, `detect-phase-type.ts`, `skills.ts`, `check-auto-mode.ts`, `check-gates.test.ts`, `phase-list-queries.test.ts`; `index.ts` and `golden-policy.ts` read for modification targets
**Pattern extraction date:** 2026-04-29
