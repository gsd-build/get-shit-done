# Phase 10: Fix New-Milestone SME Creator Integration - Pattern Map

**Mapped:** 2026-05-04
**Files analyzed:** 4 modified files (no new files created)
**Analogs found:** 4 / 4

---

## File Classification

| Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---------------|------|-----------|----------------|---------------|
| `get-shit-done/workflows/new-milestone/sme-step.md` | workflow/orchestrator | request-response (spawns sub-agent Task) | `get-shit-done/workflows/execute-phase.md` lines 1597-1621 | exact — same role, same Task() + marker check pattern |
| `agents/gsd-sme-creator.md` | agent definition | request-response (reads config, writes file) | `get-shit-done/workflows/execute-phase.md` + `get-shit-done/workflows/new-milestone/sme-step.md` line 12 (config-get usage) | role-match — same config-get query pattern |
| `tests/sme-new-milestone-detect.test.cjs` | test (structural, CJS) | batch (reads files, asserts strings) | `tests/sme-new-milestone-detect.test.cjs` itself (adding new describe blocks) | exact — same file, same test runner, same assertion style |
| `sdk/src/agents/sme-creator-structure.test.ts` | test (structural, Vitest TS) | batch (reads files, asserts strings) | `sdk/src/agents/sme-creator-structure.test.ts` itself (adding new describe block) | exact — same file, same describe/beforeAll/it/expect pattern |

---

## Pattern Assignments

### `get-shit-done/workflows/new-milestone/sme-step.md` (workflow/orchestrator, request-response)

**Analog:** `get-shit-done/workflows/execute-phase.md` lines 1597-1621
**Secondary analog:** `get-shit-done/workflows/create-sme.md` lines 12-13 (init_context step)

**Fix 1 — Resolve model and skills before Task() spawn**

The pattern from `execute-phase.md` lines 1597-1601 (exact copy to insert before the Task() call in sme-step.md step 5, between the validation block and the Task() call):

```bash
CREATOR_MODEL=$(gsd-sdk query resolve-model gsd-sme-creator --raw 2>/dev/null || echo "inherit")
AGENT_SKILLS_CREATOR=$(gsd-sdk query agent-skills gsd-sme-creator 2>/dev/null || echo "")
```

Note: `create-sme.md` lines 12-13 uses the same commands without `2>/dev/null || echo` fallbacks. The `execute-phase.md` version with fallbacks is preferred because it never breaks the workflow on a failed query.

**Fix 2 — Marker check after Task() returns**

Current sme-step.md line 131 reads:
```
3. After creator returns: add process name to `SELECTED_SMES`.
```

Replace with the pattern from `execute-phase.md` line 1621 and `create-sme.md` `handle_return` step (lines 204-214):

```markdown
3. After creator returns: check the return for `## SME Creation Complete` marker.
   If found: add process name to `SELECTED_SMES`.
   If not found: log warning ("SME creation failed for {PROCESS_NAME} -- skipping") and
   continue without adding to SELECTED_SMES.
```

WARNING: Do not include the strings `state.update` or `state.patch` anywhere in sme-step.md (not even in comments) — the existing DETECT-05 test at `tests/sme-new-milestone-detect.test.cjs` line 72 uses a negative `!content.includes('state.update')` assertion that will fail on any occurrence of those strings.

**Core Task() pattern** (existing sme-step.md lines 119-128 — unchanged except that `{CREATOR_MODEL}` and `{AGENT_SKILLS_CREATOR}` are now resolved by the lines above):

```
Task(
  subagent_type="gsd-sme-creator",
  model="{CREATOR_MODEL}",
  description="Create SME for {PROCESS_NAME}",
  prompt="Process: {PROCESS_NAME}
Today: {date}
Analyze the '{PROCESS_NAME}' process and produce .planning/smes/{PROCESS_NAME}-SME.md.
{AGENT_SKILLS_CREATOR}"
)
```

---

### `agents/gsd-sme-creator.md` (agent definition, config-driven file write)

**Analog:** `get-shit-done/workflows/new-milestone/sme-step.md` line 12 + `get-shit-done/workflows/execute-phase.md` (config-get usage throughout)

**Fix 3 — Config-driven block_mode via config-get sme.blocking**

Insert before the `Write` call in the `synthesize_and_write` step (before line 141 of the current file), replacing the hardcoded `block_mode: soft` on line 147:

```bash
BLOCK_MODE=$(gsd-sdk query config-get sme.blocking --raw 2>/dev/null || echo "soft")
# Validate: only "soft" or "strict" are valid; default to "soft" for any other value
if [ "$BLOCK_MODE" != "soft" ] && [ "$BLOCK_MODE" != "strict" ]; then
  BLOCK_MODE="soft"
fi
```

Then in the frontmatter template (line 147), change:
```yaml
block_mode: soft
```
to:
```yaml
block_mode: {BLOCK_MODE}
```

The `sme.blocking` config key defaults to `"soft"` (confirmed in `sdk/src/query/config-mutation.ts` line 395), so the `|| echo "soft"` fallback is correct and safe.

**config-get pattern source** — `get-shit-done/workflows/new-milestone/sme-step.md` line 12:
```bash
SME_AGENTS=$(gsd-sdk query config-get workflow.use_sme_agents --raw 2>/dev/null || echo "false")
```
This is the canonical config-get usage: `--raw`, `2>/dev/null`, `|| echo <default>`.

---

### `tests/sme-new-milestone-detect.test.cjs` (structural test, CJS node:test)

**Analog:** `tests/sme-new-milestone-detect.test.cjs` (the same file — adding a new describe block)

**Imports and file-path pattern** (lines 1-23 — do not duplicate, already present):

```javascript
'use strict';
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SME_STEP = path.join(ROOT, 'get-shit-done', 'workflows', 'new-milestone', 'sme-step.md');
```

**New describe block to append** (pattern from lines 59-65, same test structure):

```javascript
describe('DETECT-04: creator spawn uses resolved model and skills (not raw placeholders)', () => {
  test('sme-step.md resolves CREATOR_MODEL via resolve-model before spawning gsd-sme-creator', () => {
    const content = fs.readFileSync(SME_STEP, 'utf-8');
    assert.ok(content.includes('resolve-model'),
      'sme-step.md must call resolve-model to resolve CREATOR_MODEL before spawning gsd-sme-creator');
  });
  test('sme-step.md resolves AGENT_SKILLS_CREATOR via agent-skills before spawning gsd-sme-creator', () => {
    const content = fs.readFileSync(SME_STEP, 'utf-8');
    assert.ok(content.includes('agent-skills'),
      'sme-step.md must call agent-skills to resolve AGENT_SKILLS_CREATOR before spawning gsd-sme-creator');
  });
  test('sme-step.md checks SME Creation Complete marker after creator returns', () => {
    const content = fs.readFileSync(SME_STEP, 'utf-8');
    assert.ok(content.includes('SME Creation Complete'),
      'sme-step.md must check for ## SME Creation Complete marker after Task() returns');
  });
});
```

**Assertion style** (pattern from lines 61-65):
- `assert.ok(content.includes('...'), 'descriptive failure message')` — positive string presence
- `assert.ok(!content.includes('...') && !content.includes('...'), '...')` — negative string absence (see line 72)
- Each `test()` reads the file fresh via `fs.readFileSync` — no shared state across tests

---

### `sdk/src/agents/sme-creator-structure.test.ts` (structural test, Vitest TypeScript)

**Analog:** `sdk/src/agents/sme-creator-structure.test.ts` (the same file — adding a new describe block)

**Imports and helpers** (lines 1-43 — do not duplicate, already present):

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..', '..');
const ORCHESTRATOR_PATH = resolve(REPO_ROOT, 'agents', 'gsd-sme-creator.md');

function readAgent(path: string): string {
  return readFileSync(path, 'utf-8');
}
```

**New describe block to append** (pattern from lines 47-95 — same describe/beforeAll/it/expect structure):

```typescript
describe('CONFIG-03: orchestrator reads sme.blocking config for block_mode (not hardcoded)', () => {
  let orchestrator: string;

  beforeAll(() => {
    orchestrator = readAgent(ORCHESTRATOR_PATH);
  });

  it('orchestrator calls config-get to read sme.blocking before writing block_mode', () => {
    expect(orchestrator).toContain('sme.blocking');
  });

  it('orchestrator does not hardcode "block_mode: soft" (must use BLOCK_MODE variable)', () => {
    expect(orchestrator).not.toContain('block_mode: soft');
  });
});
```

**Assertion style** (pattern from lines 56-95):
- `expect(content).toContain('literal string')` — positive
- `expect(content).not.toContain('literal string')` — negative
- `beforeAll` loads the file once; all `it()` blocks share the loaded string
- `ORCHESTRATOR_PATH` is already declared in the file — do not redeclare; reference the existing constant

---

## Shared Patterns

### config-get Usage
**Source:** `get-shit-done/workflows/new-milestone/sme-step.md` line 12
**Apply to:** All three fixes that read config values
```bash
VALUE=$(gsd-sdk query config-get <key> --raw 2>/dev/null || echo "<default>")
```

### resolve-model + agent-skills Before Task()
**Source:** `get-shit-done/workflows/execute-phase.md` lines 1597-1601
**Apply to:** Any workflow step that spawns `gsd-sme-creator` via Task()
```bash
CREATOR_MODEL=$(gsd-sdk query resolve-model gsd-sme-creator --raw 2>/dev/null || echo "inherit")
AGENT_SKILLS_CREATOR=$(gsd-sdk query agent-skills gsd-sme-creator 2>/dev/null || echo "")
```

### ## SME Creation Complete Marker Check
**Source:** `get-shit-done/workflows/execute-phase.md` line 1621; `get-shit-done/workflows/create-sme.md` lines 204-214
**Apply to:** Any orchestrator that synchronously awaits a `gsd-sme-creator` Task()
```
After each Task: check for `## SME Creation Complete` marker.
On failure: log warning and continue to next process (never block phase completion).
```

The marker format (from `agents/gsd-sme-creator.md` lines 186-193):
```
## SME Creation Complete

**Process:** {PROCESS_NAME}
**Output:** `.planning/smes/{PROCESS_NAME}-SME.md`
**Findings:** {blocker_count} BLOCKERs, {warning_count} WARNINGs, {watch_count} WATCHes
**Commit:** {last_analyzed_commit}
```

### block_mode Validation
**Source:** Research pattern (validated against sme-step.md input validation at lines 110-115)
**Apply to:** `gsd-sme-creator.md` synthesize_and_write step only
```bash
if [ "$BLOCK_MODE" != "soft" ] && [ "$BLOCK_MODE" != "strict" ]; then
  BLOCK_MODE="soft"
fi
```

---

## No Analog Found

All four modified files have close analogs in the codebase. No files without analogs.

---

## Critical Constraints for Planner

1. **Do not introduce `state.update` or `state.patch` strings in sme-step.md** — the DETECT-05 test (`tests/sme-new-milestone-detect.test.cjs` line 72) uses a negative string check that will fail on any occurrence, including comments.

2. **ORCHESTRATOR_PATH is already declared** in `sdk/src/agents/sme-creator-structure.test.ts` at line 25 — the new CONFIG-03 describe block must reference the existing constant, not redeclare it.

3. **resolve-model outputs JSON, not a raw model string** — `gsd-sdk query resolve-model gsd-sme-creator --raw` returns `{ "model": "sonnet", "profile": "balanced", "unknown_agent": true }` (verified at runtime). The `execute-phase.md` pattern at line 1599 captures the full JSON into `CREATOR_MODEL`. Follow execute-phase.md exactly — do not add JSON extraction logic unless the planner verifies execute-phase.md does the same.

4. **Wave 0 (tests first):** Add test assertions before modifying the source workflow/agent files. Both test files already exist — only new describe blocks are added, no new test files created.

---

## Metadata

**Analog search scope:** `get-shit-done/workflows/`, `agents/`, `tests/`, `sdk/src/agents/`
**Files scanned:** 6 (sme-step.md, create-sme.md, execute-phase.md lines 1594-1628, gsd-sme-creator.md lines 140-196, tests/sme-new-milestone-detect.test.cjs, sdk/src/agents/sme-creator-structure.test.ts)
**Pattern extraction date:** 2026-05-04
