# Phase 8: New-Milestone Process Detection - Pattern Map

**Mapped:** 2026-04-30
**Files analyzed:** 3 new/modified files
**Analogs found:** 3 / 3

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `get-shit-done/workflows/new-milestone/sme-step.md` | workflow step (lazy-loaded orchestration) | event-driven (config-gated, SDK query chain) | `get-shit-done/workflows/discuss-phase/sme-step.md` | exact |
| `get-shit-done/workflows/new-milestone.md` | workflow orchestrator (1-2 line modification) | request-response | `get-shit-done/workflows/new-milestone.md` (self — seed-scan step 2.5 as pattern) | exact |
| `tests/sme-new-milestone-detect.test.cjs` | structural test (CJS) | batch (read-only file assertions) | `tests/sme-discuss-phase.test.cjs` | exact |

---

## Pattern Assignments

### `get-shit-done/workflows/new-milestone/sme-step.md` (workflow step, event-driven)

**Analog:** `get-shit-done/workflows/discuss-phase/sme-step.md`

This is the primary new file. All five DETECT requirements are implemented here. Copy the structural skeleton from `discuss-phase/sme-step.md` and adapt for detection + queuing semantics rather than context-fetch + auditor semantics.

**Header / preamble pattern** (lines 1-6 of analog):
```markdown
# SME Process Detection Step -- lazy-loaded by new-milestone

> **Lazy-loaded and gated.** `workflows/new-milestone.md` reads this file ONLY
> when `use_sme_agents: true` is set in config (checked in step 1 below).
> Skip the Read entirely when the condition is false.
```

**Step 1: Config flag guard** (lines 8-15 of analog — `discuss-phase/sme-step.md`):
```bash
SME_AGENTS=$(gsd-sdk query config-get workflow.use_sme_agents --raw 2>/dev/null || echo "false")
```
If `SME_AGENTS` is not `"true"`: skip this step entirely. Return to new-milestone.md.

**Step 2: List existing SMEs** (new pattern — adapt from RESEARCH.md code examples):
```bash
SME_LIST=$(gsd-sdk query sme.list 2>/dev/null || echo '{"data":{"enabled":false,"smes":[]}}')
ENABLED=$(echo "$SME_LIST" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('data',{}).get('enabled',False))" 2>/dev/null || echo "False")
```
If `ENABLED` is not `"True"`: skip silently. Return to new-milestone.md.

```bash
ALL_PROCESSES=$(echo "$SME_LIST" | python3 -c "
import json, sys
d = json.load(sys.stdin)
smes = d.get('data', {}).get('smes', [])
for sme in smes:
    print(sme.get('process_name', ''))
" 2>/dev/null || echo "")
```

**Step 3: Detect processes from milestone goal** (new pattern — from RESEARCH.md code examples):
```bash
SME_DETECT=$(gsd-sdk query sme.detect-processes --goal "${MILESTONE_GOAL}" 2>/dev/null || echo '{"data":{"enabled":false,"matches":[]}}')
MATCHED_PROCESSES=$(echo "$SME_DETECT" | python3 -c "
import json, sys
d = json.load(sys.stdin)
matches = d.get('data', {}).get('matches', [])
print('\n'.join(m.get('process_name', '') for m in matches))
" 2>/dev/null || echo "")
```
Note: Use only `--goal "${MILESTONE_GOAL}"` — no `--file-paths` at milestone setup time.

**Step 4: User confirmation for existing matched SMEs — AskUserQuestion pattern** (analog: new-milestone.md step 2.5 seed-scan, lines 81-91):
```
AskUserQuestion(
  header: "Active SMEs",
  question: "These SME documents match your milestone goals. Which should be active for this milestone?",
  multiSelect: true,
  options: [
    { label: "{process_name}", description: "Block mode: {block_mode} | Findings: {blocker}B / {warning}W / {watch}W" },
    ...
  ]
)
```
Text mode fallback (copy from new-milestone.md step 2.5, lines 72-79):
```
Active SME candidates:
1. {process_name} ({block_mode}, {blocker}B/{warning}W/{watch}W)
Enter numbers to activate (comma-separated), or "none" to skip:
```
Auto mode: select ALL detected matches. Log: `[auto] Activated N SME(s): [list]`

**Step 5: Offer creation for uncovered processes** (analog: `create-sme.md` spawn_creator step, lines 106-138):
```
AskUserQuestion(
  header: "Missing SMEs",
  question: "These processes have no SME document. Create one now?",
  options per-process (or skip-all)
)

# For each accepted process — validate name first (from create-sme.md lines 64-69):
if [[ ! "$PROCESS_NAME" =~ ^[a-zA-Z0-9_-]+$ ]]; then
  echo "ERROR: Process name must contain only letters, digits, hyphens, and underscores."
  exit 1
fi

Task(
  subagent_type="gsd-sme-creator",
  description="Create SME for {PROCESS_NAME}",
  prompt="Process: {PROCESS_NAME} ..."
)
```

**Step 6: Write active_smes via frontmatter.merge** (DETECT-05 — CRITICAL):
```bash
ACTIVE_SMES_JSON=$(python3 -c "
import sys, json
names = [n.strip() for n in '''${SELECTED_SMES}'''.split() if n.strip()]
print(json.dumps({'milestone': {'active_smes': names}}))
")
gsd-sdk query frontmatter.merge .planning/STATE.md --data "$ACTIVE_SMES_JSON"
```
Never use `state.update` or `state.patch` here — they go through `buildStateFrontmatter` and erase `active_smes`.

**Graceful skip pattern** (analog: `discuss-phase/sme-step.md` — every step has a skip path):
- If no matched processes AND user skips creation: proceed silently without writing `active_smes`.
- Never block new-milestone setup.

**Python3 JSON parsing** (analog: `discuss-phase/sme-step.md` lines 24-30 — do NOT use jq):
```bash
python3 -c "import json, sys; d=json.load(sys.stdin); ..."
```

---

### `get-shit-done/workflows/new-milestone.md` (workflow orchestrator, 1-2 line modification)

**Analog:** `get-shit-done/workflows/new-milestone.md` — specifically the seed-scan dispatch reference at step 2.5 (lines 49-50) and compare with the discuss-phase lazy-load pattern.

**Dispatch reference pattern** (modeled on step 2.5 seed-scan header in new-milestone.md, lines 49-50, and discuss-phase lazy-load wording in sme-step.md line 2):

```markdown
## 5.5. SME Process Detection

If `workflow.use_sme_agents` is true: Read `workflows/new-milestone/sme-step.md` and execute its steps.
Otherwise skip silently.
```

**Correct insertion point:** After step 5 (`## 5. Update STATE.md`, line 174) and before step 6 (`## 6. Cleanup and Commit`, line 205). This is AFTER `state.milestone-switch` runs (which would erase `active_smes` if the step ran earlier) and BEFORE the milestone's operational work begins.

**Position verification** (the planner must assert ordering in tests):
- `state.milestone-switch` reference is in step 5 body (line 181 of new-milestone.md)
- Step 6 begins at line 205 of new-milestone.md
- Insert `## 5.5.` between these two positions

---

### `tests/sme-new-milestone-detect.test.cjs` (structural test, CJS)

**Analog:** `tests/sme-discuss-phase.test.cjs` — exact pattern match (same framework, same assertion style, same file-path construction)

**File header / imports pattern** (lines 1-23 of analog):
```javascript
'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const NEW_MILESTONE = path.join(ROOT, 'get-shit-done', 'workflows', 'new-milestone.md');
const SME_STEP = path.join(ROOT, 'get-shit-done', 'workflows', 'new-milestone', 'sme-step.md');
```

**describe/test structure pattern** (lines 25-73 of analog — one `describe` per requirement, `test` per behavioral assertion):
```javascript
describe('DETECT-01: new-milestone scans for processes milestone touches', () => {
  test('new-milestone.md references sme-step.md (lazy-load dispatch)', () => {
    const content = fs.readFileSync(NEW_MILESTONE, 'utf-8');
    assert.ok(content.includes('new-milestone/sme-step.md') || content.includes('new-milestone\\sme-step.md'),
      'new-milestone.md must dispatch to new-milestone/sme-step.md for SME detection');
  });
  test('sme-step.md calls sme.detect-processes', () => {
    const content = fs.readFileSync(SME_STEP, 'utf-8');
    assert.ok(content.includes('sme.detect-processes'),
      'sme-step.md must call sme.detect-processes to identify milestone-relevant processes');
  });
});
```

**Negative assertion pattern** (lines 92-107 of analog — assert something does NOT appear):
```javascript
test('sme-step.md must NOT use state.update or state.patch', () => {
  const content = fs.readFileSync(SME_STEP, 'utf-8');
  assert.ok(!content.includes('state.update') && !content.includes('state.patch'),
    'sme-step.md must NOT use state.update or state.patch (they erase custom frontmatter fields)');
});
```

**Ordering test pattern** (lines 56-73 of analog — verify positional order of two strings):
```javascript
test('SME step reference appears AFTER state.milestone-switch in new-milestone.md file position', () => {
  const content = fs.readFileSync(NEW_MILESTONE, 'utf-8');
  const switchIdx = content.indexOf('state.milestone-switch');
  const smeStepIdx = content.indexOf('new-milestone/sme-step.md');
  assert.ok(switchIdx > -1, 'new-milestone.md must contain "state.milestone-switch"');
  assert.ok(smeStepIdx > -1, 'new-milestone.md must contain "new-milestone/sme-step.md"');
  assert.ok(switchIdx < smeStepIdx,
    'SME step reference must appear AFTER state.milestone-switch in new-milestone.md (ordering constraint)');
});
```

**Complete test coverage map** (from RESEARCH.md Validation Architecture):

| DETECT req | Test assertion |
|------------|----------------|
| DETECT-01 | `new-milestone.md` includes `new-milestone/sme-step.md` |
| DETECT-01 | `sme-step.md` includes `sme.detect-processes` |
| DETECT-01 | `sme-step.md` includes `use_sme_agents` (config guard) |
| DETECT-02 | `sme-step.md` includes `sme.list` |
| DETECT-03 | `sme-step.md` includes `AskUserQuestion` or `multiSelect` |
| DETECT-04 | `sme-step.md` includes `gsd-sme-creator` |
| DETECT-05 | `sme-step.md` includes `frontmatter.merge` AND NOT `state.update` AND NOT `state.patch` |
| DETECT-05 | `sme-step.md` includes `active_smes` |
| DETECT-05 | `sme-step.md` includes `STATE.md` |
| ordering  | `state.milestone-switch` appears BEFORE `new-milestone/sme-step.md` in new-milestone.md |

---

## Shared Patterns

### Config flag guard (feature gate)
**Source:** `get-shit-done/workflows/discuss-phase/sme-step.md` lines 8-15
**Apply to:** `new-milestone/sme-step.md` step 1
```bash
SME_AGENTS=$(gsd-sdk query config-get workflow.use_sme_agents --raw 2>/dev/null || echo "false")
# If SME_AGENTS is not "true": skip this step entirely.
```

### Python3 JSON extraction (no jq)
**Source:** `get-shit-done/workflows/discuss-phase/sme-step.md` lines 24-30
**Apply to:** `new-milestone/sme-step.md` all JSON parsing blocks
```bash
python3 -c "
import json, sys
d = json.load(sys.stdin)
data = d.get('data', d)
# ... extract fields
" 2>/dev/null || echo ""
```

### Process name validation
**Source:** `get-shit-done/workflows/create-sme.md` (validate_process_name step, lines 64-69)
**Apply to:** `new-milestone/sme-step.md` step 5 (before spawning creator per process)
```bash
if [[ ! "$PROCESS_NAME" =~ ^[a-zA-Z0-9_-]+$ ]]; then
  echo "ERROR: Process name must contain only letters, digits, hyphens, and underscores."
  echo "Got: '$PROCESS_NAME'"
  exit 1
fi
```

### Creator agent spawn (Task call)
**Source:** `get-shit-done/workflows/create-sme.md` spawn_creator step (lines 106-138)
**Apply to:** `new-milestone/sme-step.md` step 5 (per-process creation)
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

### frontmatter.merge write pattern (DETECT-05 critical)
**Source:** RESEARCH.md Pattern 3 (verified against `sdk/src/query/frontmatter-mutation.ts`)
**Apply to:** `new-milestone/sme-step.md` step 6 (only)
**Never use:** `state.update`, `state.patch`, `state.*` mutation handlers for writing `active_smes`
```bash
ACTIVE_SMES_JSON=$(python3 -c "
import sys, json
names = [n.strip() for n in '''${SELECTED_SMES}'''.split() if n.strip()]
print(json.dumps({'milestone': {'active_smes': names}}))
")
gsd-sdk query frontmatter.merge .planning/STATE.md --data "$ACTIVE_SMES_JSON"
```

### Lazy-load dispatch reference
**Source:** `get-shit-done/workflows/new-milestone.md` step 2.5 seed-scan (lines 49-50) and `discuss-phase/sme-step.md` preamble (line 2)
**Apply to:** `get-shit-done/workflows/new-milestone.md` (the 1-2 line modification)
```markdown
## 5.5. SME Process Detection

If `workflow.use_sme_agents` is true: Read `workflows/new-milestone/sme-step.md` and execute its steps.
Otherwise skip silently.
```

### CJS structural test skeleton
**Source:** `tests/sme-discuss-phase.test.cjs` lines 1-23
**Apply to:** `tests/sme-new-milestone-detect.test.cjs` (top of file)
```javascript
'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
```

---

## No Analog Found

All three files have close analogs. No files require falling back to external reference patterns only.

---

## Critical Ordering Constraint (for executor)

The SME detection step in `new-milestone.md` MUST be positioned AFTER `state.milestone-switch` (step 5, line ~181) and BEFORE step 6 (cleanup/commit, line ~205). If placed before step 5, `stateMilestoneSwitch` rebuilds frontmatter with a fresh object that does not include `active_smes`, silently erasing the written field.

The ordering test in `sme-new-milestone-detect.test.cjs` enforces this: `state.milestone-switch` must appear before `new-milestone/sme-step.md` in the file.

---

## Metadata

**Analog search scope:** `get-shit-done/workflows/`, `tests/`
**Files scanned:** 5 (discuss-phase/sme-step.md, sme-discuss-phase.test.cjs, sme-gate-plan-phase.test.cjs, seed-scan-new-milestone.test.cjs, create-sme.md) plus full read of new-milestone.md
**Pattern extraction date:** 2026-04-30
