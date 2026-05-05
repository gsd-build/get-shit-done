# Phase 6: Plan-Phase Gate - Pattern Map

**Mapped:** 2026-04-30
**Files analyzed:** 3 new/modified files
**Analogs found:** 3 / 3

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `get-shit-done/workflows/plan-phase.md` | workflow (orchestration) | event-driven, request-response | `get-shit-done/workflows/plan-phase.md` step 5.55 (security gate) and step 10 (plan-checker spawn) | exact — same file, same gate-insertion pattern |
| `commands/gsd/plan-phase.md` | command (presentation) | request-response | `commands/gsd/plan-phase.md` (current argument-hint line) | exact — same file, single field update |
| `tests/sme-gate-plan-phase.test.cjs` | test (structural) | batch (read-assert) | `tests/plan-phase-ui-redirect.test.cjs`, `tests/gates-taxonomy.test.cjs` | exact — CJS node:test structural test for plan-phase.md |

---

## Pattern Assignments

### `get-shit-done/workflows/plan-phase.md` — new step 12.6 SME Audit Gate

**Analog:** Same file, step 5.55 (Security Threat Model Gate) for config-read + skip guard + banner pattern; step 10 (Spawn gsd-plan-checker) for Task() invocation pattern; step 12.5 (Plan Bounce) for insertion point context.

**Config-read + skip guard pattern** (plan-phase.md lines 435-441):
```markdown
## 5.55. Security Threat Model Gate

> Skip if `workflow.security_enforcement` is explicitly `false`. Absent = enabled.

```bash
SECURITY_CFG=$(gsd-sdk query config-get workflow.security_enforcement --raw 2>/dev/null || echo "true")
SECURITY_ASVS=$(gsd-sdk query config-get workflow.security_asvs_level --raw 2>/dev/null || echo "1")
SECURITY_BLOCK=$(gsd-sdk query config-get workflow.security_block_on --raw 2>/dev/null || echo "high")
```

**If `SECURITY_CFG` is `false`:** Skip to step 5.6.
```

Apply this pattern for SME gate as:
```markdown
## 12.6. SME Audit Gate

> Skip if `workflow.use_sme_agents` is not `true`. Absent = disabled (false).

```bash
SME_AGENTS=$(gsd-sdk query config-get workflow.use_sme_agents --raw 2>/dev/null || echo "false")
```

**If `SME_AGENTS` is not `true`:** Skip to step 13.
```

**Banner pattern** (plan-phase.md lines 343-348, used at every major step):
```markdown
Display banner:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► SECTION NAME
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Action description...
```
```

Apply for SME gate as:
```markdown
Display banner:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► SME AUDIT GATE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Detecting relevant processes...
```
```

**Task() spawn + ORCHESTRATOR RULE pattern** (plan-phase.md lines 1071-1081):
```markdown
```
Task(
  prompt=checker_prompt,
  subagent_type="gsd-plan-checker",
  model="{checker_model}",
  description="Verify Phase {phase} plans"
)
```

> **ORCHESTRATOR RULE — CODEX RUNTIME**: After calling Task() above, stop working on this task immediately. Do not read more files, edit code, or run tests related to this task while the subagent is active. Wait for the subagent to return its result. This prevents duplicate work, conflicting edits, and wasted context. Only resume when the subagent result is available.
```

Apply for auditor spawn as:
```markdown
```
Task(
  prompt="""${SME_CONTEXT_BLOCKS}

PLAN.md path: ${PHASE_DIR}/${PADDED_PHASE}-PLAN.md

Phase: ${phase_name}
""",
  subagent_type="gsd-sme-auditor",
  model="${checker_model}",
  description="SME audit Phase ${PHASE}"
)
```

> **ORCHESTRATOR RULE — CODEX RUNTIME**: After calling Task() above, stop working...
```

**Return marker handling pattern** (plan-phase.md lines 1082-1086):
```markdown
## 11. Handle Checker Return

- **`## VERIFICATION PASSED`:** Display confirmation, proceed to step 13.
- **`## ISSUES FOUND`:** Display issues, check iteration count, proceed to step 12.
- **Empty / truncated / no recognized marker:** → Filesystem fallback (step 11a).
```

Apply for auditor return as:
```markdown
**`## SME_APPROVED`:** Display approval, proceed to step 13.

**`## SME_CONCERNS`:** [route on block_mode — see below]

**No marker / empty return:** Log warning. Offer: 1) Retry audit, 2) Skip audit, 3) Stop.
```

**AskUserQuestion escalation pattern** (plan-phase.md lines 1146-1156 — stall detection escalation):
```markdown
Ask user:
  Question: "Issues remain after {N} revision attempts with no progress. Proceed with current output?"
  Options: "Proceed anyway" | "Adjust approach"
```

Apply for strict-mode block as:
```markdown
AskUserQuestion(
  header: "SME Audit: BLOCKERs Found",
  question: "SME audit found unaddressed domain risks...",
  options:
    - "Acknowledge risk and proceed" — documented in output
    - "Revise plan" — return to step 8 for replanning
)
```

**Flag parsing in step 2** (plan-phase.md lines 57-58):
```markdown
## 2. Parse and Normalize Arguments

Extract from $ARGUMENTS: phase number (integer or decimal like `2.1`), flags (`--research`, `--skip-research`, `--gaps`, `--skip-verify`, `--skip-ui`, `--prd <filepath>`, `--reviews`, `--text`, `--bounce`, `--skip-bounce`, `--chunked`).
```

Add `--acknowledge-sme-risk` to this extract line, and add:
```markdown
Set `ACKNOWLEDGE_SME_RISK=true` if `--acknowledge-sme-risk` is present in $ARGUMENTS.
```

**Step insertion point** (plan-phase.md lines 1205-1276 — current step 12.5 Plan Bounce):
```markdown
## 12.5. Plan Bounce (Optional External Refinement)

**Skip if:** `--skip-bounce` flag, `--gaps` flag, or bounce is not activated.
...
```

The new SME Audit Gate is inserted AFTER this step as `## 12.6. SME Audit Gate`, immediately before `## 13. Requirements Coverage Gate` (line 1276).

---

### `commands/gsd/plan-phase.md` — argument-hint update

**Analog:** Same file, lines 1-16 (current frontmatter).

**Current argument-hint pattern** (commands/gsd/plan-phase.md lines 1-5):
```markdown
---
name: gsd:plan-phase
description: Create detailed phase plan (PLAN.md) with verification loop
argument-hint: "[phase] [--auto] [--research] [--skip-research] [--gaps] [--skip-verify] [--prd <file>] [--reviews] [--text] [--tdd]"
agent: gsd-planner
```

Update to:
```markdown
argument-hint: "[phase] [--auto] [--research] [--skip-research] [--gaps] [--skip-verify] [--prd <file>] [--reviews] [--text] [--tdd] [--acknowledge-sme-risk]"
```

---

### `tests/sme-gate-plan-phase.test.cjs` — new structural test file

**Analog 1:** `tests/plan-phase-ui-redirect.test.cjs` (lines 1-51) — structural tests that read plan-phase.md and assert on workflow content.

**Analog 2:** `tests/gates-taxonomy.test.cjs` (lines 1-124) — structural tests that read reference files and assert on section/content presence.

**File-header + boilerplate pattern** (tests/plan-phase-ui-redirect.test.cjs lines 1-16):
```javascript
'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

describe('plan-phase UI-SPEC missing behavior', () => {
  const workflowPath = path.join(
    __dirname,
    '..',
    'get-shit-done',
    'workflows',
    'plan-phase.md'
  );
```

**ROOT constant + multi-file paths pattern** (tests/gates-taxonomy.test.cjs lines 12-13):
```javascript
const ROOT = path.join(__dirname, '..');
const GATES_REF = path.join(ROOT, 'get-shit-done', 'references', 'gates.md');
```

Apply for SME gate test as:
```javascript
'use strict';
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PLAN_PHASE = path.join(ROOT, 'get-shit-done', 'workflows', 'plan-phase.md');
const PLAN_PHASE_CMD = path.join(ROOT, 'commands', 'gsd', 'plan-phase.md');
```

**describe/test + readFileSync + assert.ok pattern** (tests/gates-taxonomy.test.cjs lines 22-32):
```javascript
test('defines all 4 canonical gate types', () => {
  const content = fs.readFileSync(GATES_REF, 'utf-8');
  const gateTypes = ['Pre-flight Gate', 'Revision Gate', 'Escalation Gate', 'Abort Gate'];

  for (const gate of gateTypes) {
    assert.ok(
      content.includes(`### ${gate}`),
      `gates.md must define "${gate}" as an h3 heading`
    );
  }
});
```

**Positional assertion pattern** (tests/plan-phase-ui-redirect.test.cjs lines 21-31):
```javascript
test('does NOT contain hard-blocking exit redirect to /gsd-ui-phase', () => {
  const text = fs.readFileSync(workflowPath, 'utf8');
  const hardExitPattern = /Generate UI-SPEC first.*Exit workflow/s;
  assert.ok(
    !hardExitPattern.test(text),
    'plan-phase.md must NOT contain a hard "Generate UI-SPEC first → Exit workflow" redirect. ...'
  );
});
```

Apply for positional ordering assertions in SME gate test as:
```javascript
test('SME Audit Gate appears after plan-bounce and before requirements coverage', () => {
  const content = fs.readFileSync(PLAN_PHASE, 'utf-8');
  const bounceIdx = content.indexOf('Plan Bounce');
  const smeGateIdx = content.indexOf('SME Audit Gate');
  const reqCoverageIdx = content.indexOf('Requirements Coverage Gate');
  assert.ok(bounceIdx < smeGateIdx, 'SME gate must appear after plan-bounce step');
  assert.ok(smeGateIdx < reqCoverageIdx, 'SME gate must appear before requirements coverage gate');
});
```

**JSDoc banner pattern** (tests/gates-taxonomy.test.cjs lines 1-10 and tests/secure-phase.test.cjs lines 1-12):
```javascript
/**
 * Validates the gates taxonomy reference document (#1715).
 *
 * Ensures the reference file exists, defines all 4 canonical gate types,
 * includes the gate matrix table, and is cross-referenced from workflows.
 */
```

Apply for SME gate test:
```javascript
/**
 * Structural validation tests for Phase 6 SME Audit Gate in plan-phase workflow.
 *
 * Tests verify static structure of plan-phase.md and commands/gsd/plan-phase.md —
 * not runtime behavior. All tests read files from the repo root using absolute paths.
 *
 * Requirements covered:
 *   GATE-01 — Step 12.x SME audit gate exists after plan-checker, before finalization
 *   GATE-02 — Gate calls sme.detect-processes
 *   GATE-03 — Gate spawns gsd-sme-auditor
 *   GATE-04 — Soft mode: warning + proceed path exists
 *   GATE-05 — Strict mode: halt + AskUserQuestion path exists
 *   GATE-06 — --acknowledge-sme-risk flag in argument-hint + step 2
 *   GATE-07 — No SME found → warn + /gsd-create-sme → never block
 *   GATE-08 — SME context blocks injected before PLAN.md path in prompt
 *   CONFIG-04 — No SME documents → warning + /gsd-create-sme → never block
 */
```

---

## Shared Patterns

### Step Skip Guard
**Source:** `get-shit-done/workflows/plan-phase.md` lines 435-441 (step 5.55)
**Apply to:** New step 12.6 in plan-phase.md
```markdown
> Skip if `workflow.use_sme_agents` is not `true`. Absent = disabled (false).

```bash
SME_AGENTS=$(gsd-sdk query config-get workflow.use_sme_agents --raw 2>/dev/null || echo "false")
```

**If `SME_AGENTS` is not `true`:** Skip to step 13.
```

### Banner Display
**Source:** `get-shit-done/workflows/plan-phase.md` lines 343-348 (step 5 Research banner)
**Apply to:** New step 12.6 header display
```markdown
Display banner:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► {SECTION TITLE}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ {action description}...
```
```

### Task() + ORCHESTRATOR RULE
**Source:** `get-shit-done/workflows/plan-phase.md` lines 1071-1081 (step 10 plan-checker spawn)
**Apply to:** Auditor spawn in step 12.6
```markdown
```
Task(
  prompt=...,
  subagent_type="gsd-{agent-name}",
  model="{checker_model}",
  description="Description Phase {phase}"
)
```

> **ORCHESTRATOR RULE — CODEX RUNTIME**: After calling Task() above, stop working on this task immediately. ...
```

### TEXT_MODE Conditional Presentation
**Source:** `get-shit-done/workflows/plan-phase.md` lines 228-237 (step 4 — TEXT_MODE branch for AskUserQuestion)
**Apply to:** AskUserQuestion calls in step 12.6 strict-mode halt
```markdown
If `TEXT_MODE` is true, present as a plain-text numbered list. Otherwise use AskUserQuestion.
```

### CJS Test File Structure
**Source:** `tests/plan-phase-ui-redirect.test.cjs` (entire file) + `tests/gates-taxonomy.test.cjs` (entire file)
**Apply to:** `tests/sme-gate-plan-phase.test.cjs`
- JSDoc comment block at top identifying requirements covered
- `'use strict';` declaration
- `require('node:test')`, `require('node:assert/strict')`, `require('fs')`, `require('path')`
- `ROOT = path.join(__dirname, '..')` constant for repo root
- Named constants for each file path under test
- One `describe()` block per GATE-XX requirement
- `fs.readFileSync(filePath, 'utf-8')` inside each `test()` (do not hoist reads to describe scope)
- `assert.ok(content.includes('...'), 'descriptive failure message')` for presence checks
- `assert.ok(idxA < idxB, '...')` for positional ordering checks

---

## No Analog Found

All three files have strong analogs in the codebase. No files require falling back to RESEARCH.md patterns exclusively.

---

## Key Observations for Planner

1. **Step numbering conflict is real.** `## 12.5. Plan Bounce` already exists. The new step MUST be `## 12.6. SME Audit Gate` — do not renumber the bounce step. The planner must verify no existing test asserts on a specific step number for bounce.

2. **ORCHESTRATOR RULE is mandatory.** Every Task() call in plan-phase.md is followed by the full "stop working immediately" rule block. The SME auditor Task() call must include it verbatim.

3. **TEXT_MODE branch applies.** Any AskUserQuestion in the strict-mode halt path must also have a TEXT_MODE plain-text numbered list fallback, consistent with all other AskUserQuestion calls in plan-phase.md.

4. **Gate Matrix in gates.md needs a new row.** The gates-taxonomy test (`tests/gates-taxonomy.test.cjs` line 51-68) validates the Gate Matrix exists and references plan-phase. Adding a new gate row for step 12.6 is consistent with existing rows (e.g., `| plan-phase | Step 12 | Revision | PLAN.md quality | Loop to planner (max 3) |`).

5. **checker_model is reused.** The auditor is spawned with `model="{checker_model}"` — no new model config key. This follows the same pattern as `gsd-plan-checker` in step 10.

6. **GATE-08 prompt ordering is structural.** `${SME_CONTEXT_BLOCKS}` appears FIRST in the auditor prompt string, before `PLAN.md path:`. Tests assert on `content.indexOf('SME_CONTEXT_BLOCKS') < content.indexOf('PLAN.md path:')`.

---

## Metadata

**Analog search scope:** `get-shit-done/workflows/`, `commands/gsd/`, `tests/`, `agents/`, `get-shit-done/references/`
**Files scanned:** 7 (plan-phase.md workflow, plan-phase.md command, plan-phase-ui-redirect.test.cjs, gates-taxonomy.test.cjs, gsd-sme-auditor.md, gates.md, sme-auditor-structure.test.ts)
**Pattern extraction date:** 2026-04-30
