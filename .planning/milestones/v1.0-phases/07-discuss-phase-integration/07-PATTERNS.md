# Phase 7: Discuss-Phase Integration - Pattern Map

**Mapped:** 2026-04-30
**Files analyzed:** 4 new/modified files
**Analogs found:** 4 / 4

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `get-shit-done/workflows/discuss-phase/sme-step.md` | workflow step (sub-workflow) | request-response + event-driven | `get-shit-done/workflows/plan-phase.md` lines 1278-1417 (Step 12.6 SME Audit Gate) | role-match (same SDK calls, different auditor mode) |
| `get-shit-done/workflows/discuss-phase.md` (modify) | workflow orchestrator | request-response | `get-shit-done/workflows/discuss-phase.md` lines 13-34 (progressive_disclosure table) | exact (same file, same table) |
| `get-shit-done/workflows/discuss-phase/templates/context.md` (modify) | template | transform | `get-shit-done/workflows/discuss-phase/templates/context.md` lines 20-24 (conditional sections block) | exact (same file, same pattern) |
| `tests/sme-discuss-phase.test.cjs` | test | request-response | `tests/sme-gate-plan-phase.test.cjs` | exact |

---

## Pattern Assignments

### `get-shit-done/workflows/discuss-phase/sme-step.md` (sub-workflow, request-response + event-driven)

**Analog:** `get-shit-done/workflows/plan-phase.md` — Step 12.6 SME Audit Gate (lines 1278-1417)

**Config-gate pattern** (lines 1280-1286):
```markdown
> Skip if `workflow.use_sme_agents` is not `true`. Absent = disabled (default is `false`).

```bash
SME_AGENTS=$(gsd-sdk query config-get workflow.use_sme_agents --raw 2>/dev/null || echo "false")
```

**If `SME_AGENTS` is not `true`:** Skip [to next step].
```

**Read active_smes via frontmatter.get — NOT state.json** (RESEARCH.md Pattern 2, verified in sdk/src/query/frontmatter.ts):
```bash
STATE_FM=$(gsd-sdk query frontmatter.get .planning/STATE.md 2>/dev/null || echo '{"data":{}}')
# Extract nested field: milestone.active_smes[]
ACTIVE_SMES=$(echo "$STATE_FM" | python3 -c "
import json, sys
d = json.load(sys.stdin)
data = d.get('data', d)
smes = data.get('milestone', {}).get('active_smes', [])
print('\n'.join(smes) if isinstance(smes, list) else '')
" 2>/dev/null || echo "")
# If ACTIVE_SMES is empty: skip silently
```

**Fetch context blocks per active SME** (lines 1342-1348 — adapted; skip gracefully when not found):
```bash
SME_CONTEXT_BLOCKS=""
for PROCESS_NAME in $ACTIVE_SMES; do
  CTX=$(gsd-sdk query sme.context-block "${PROCESS_NAME}" 2>/dev/null || echo '{"data":{"found":false}}')
  FOUND=$(echo "$CTX" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('data',{}).get('found', False))" 2>/dev/null || echo "False")
  if [ "$FOUND" = "True" ]; then
    BLOCK=$(echo "$CTX" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('data',{}).get('block',''))" 2>/dev/null || echo "")
    SME_CONTEXT_BLOCKS="${SME_CONTEXT_BLOCKS}${BLOCK}"
  fi
done
# If SME_CONTEXT_BLOCKS is empty: skip or warn; NEVER block
```

**Spawn auditor — probing-questions mode** (adapted from lines 1368-1380; CRITICAL: omit PLAN.md path, ask for numbered list, no SME_APPROVED/SME_CONCERNS routing):
```
Task(
  prompt="""${SME_CONTEXT_BLOCKS}

Phase goal: ${PHASE_GOAL}

Your role here is DIFFERENT from a plan audit: there is no PLAN.md to review.
Instead, produce 3-5 domain-specific probing questions that surface the highest-severity
risks from the SME findings above. The user will answer these during the discussion.

Focus on BLOCKERs first, then WARNINGs. Format as a numbered list. No ## markers.
""",
  subagent_type="gsd-sme-auditor",
  description="SME probing questions Phase ${PHASE}"
)
```

**Capture output as risk questions (NOT routing on SME_APPROVED/SME_CONCERNS):**
```markdown
Capture the numbered question list returned by the auditor as `sme_risk_areas`.
Do NOT route on `## SME_APPROVED` or `## SME_CONCERNS` markers — this is
probing-questions mode, not plan-audit mode.
Store `sme_risk_areas` for injection into `present_gray_areas` as pre-loaded domain risk areas.
```

**Lazy-load gate header** (mirrors advisor.md lines 1-7 pattern for lazy-loaded sub-workflows):
```markdown
# SME Check Step — lazy-loaded by discuss-phase

> **Lazy-loaded and gated.** `workflows/discuss-phase.md` Reads this file ONLY
> when `use_sme_agents: true` AND `milestone.active_smes` is non-empty in STATE.md.
> Skip the Read entirely when either condition is false.
```

---

### `get-shit-done/workflows/discuss-phase.md` (modify — progressive_disclosure table + step reference)

**Analog:** `get-shit-done/workflows/discuss-phase.md` lines 13-34 (same file — progressive_disclosure table)

**Existing table pattern to extend** (lines 18-31):
```markdown
| When | Read |
|---|---|
| `--power` in $ARGUMENTS | `workflows/discuss-phase/modes/power.md` (then exit standard flow) |
...
| ADVISOR_MODE = true (USER-PROFILE.md exists) | `workflows/discuss-phase/modes/advisor.md` |
| no flags above | `workflows/discuss-phase/modes/default.md` |
| in `write_context` step | `workflows/discuss-phase/templates/context.md` |
...
```

**New row to add** (insert before `in write_context step` row — 1 line):
```markdown
| `use_sme_agents: true` AND `active_smes` non-empty in STATE.md | `workflows/discuss-phase/sme-step.md` |
```

**Step dispatch pattern** (mirrors how advisor step is dispatched at line 147):
```markdown
- `use_sme_agents: true` AND active_smes non-empty → Read `workflows/discuss-phase/sme-step.md`
  after `cross_reference_todos`, before `scout_codebase`.
```

**Budget constraint:** discuss-phase.md is currently 497 lines. The `< 500` budget (enforced by `tests/workflow-size-budget.test.cjs` line 104) allows at most 2 new inline lines. One row in the progressive_disclosure table + one dispatch line in the init/step body covers the maximum.

---

### `get-shit-done/workflows/discuss-phase/templates/context.md` (modify — add sme_context conditional section)

**Analog:** `get-shit-done/workflows/discuss-phase/templates/context.md` lines 19-24 (conditional sections documentation block) and lines 41-51 (`<spec_lock>` conditional pattern)

**Existing conditional section documentation** (lines 20-24):
```markdown
## Conditional sections

- **`<spec_lock>`** — include only when `spec_loaded = true` (a `*-SPEC.md`
  was found by `check_spec`). Otherwise omit the entire `<spec_lock>` block.
- **Folded Todos / Reviewed Todos** — include subsections only when the
  `cross_reference_todos` step folded or reviewed at least one todo.
```

**New bullet to add to Conditional sections** (same style, 2 lines):
```markdown
- **`<sme_context>`** — include only when `sme_risk_areas` is non-empty (SME
  check ran and produced probing questions). Otherwise omit entirely.
```

**Existing spec_lock block pattern to copy** (lines 41-51 — shows XML tag + condition comment style):
```markdown
[If spec_loaded = true, insert this section:]
<spec_lock>
## Requirements (locked via SPEC.md)
...
</spec_lock>
```

**New sme_context block to add** (append to template body, after `<deferred>` block, before the closing `---`):
```markdown
[If sme_risk_areas exist (SME check ran and produced questions):]
<sme_context>
## SME Domain Risks Surfaced

Domain-specific risks from active SME documents, surfaced during discussion.
The planner must address these risks in the plan.

{numbered list of probing questions/risk areas surfaced by the auditor}

**Active SMEs:** {list of process names}
</sme_context>
```

---

### `tests/sme-discuss-phase.test.cjs` (test, structural)

**Analog:** `tests/sme-gate-plan-phase.test.cjs` (complete file — exact pattern match)

**File header and imports pattern** (lines 1-27 of analog):
```javascript
/**
 * Structural validation tests for Phase 7 SME Discuss-Phase Integration.
 *
 * Tests verify static structure of discuss-phase.md, sme-step.md, and context.md template —
 * not runtime behavior. All tests read files from the repo root using absolute paths.
 *
 * Requirements covered:
 *   DISCUSS-01 — sme-step.md uses frontmatter.get to read STATE.md for active_smes
 *   DISCUSS-02 — sme-step.md calls sme.context-block per active SME and spawns gsd-sme-auditor
 *   DISCUSS-03 — context.md template includes <sme_context> section
 */
'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DISCUSS_PHASE = path.join(ROOT, 'get-shit-done', 'workflows', 'discuss-phase.md');
const SME_STEP = path.join(ROOT, 'get-shit-done', 'workflows', 'discuss-phase', 'sme-step.md');
const CONTEXT_TPL = path.join(ROOT, 'get-shit-done', 'workflows', 'discuss-phase', 'templates', 'context.md');
```

**Test structure pattern** (lines 30-62 of analog — describe + test + assert.ok with message):
```javascript
describe('DISCUSS-01: discuss-phase checks for active_smes in STATE.md', () => {
  test('sme-step.md uses frontmatter.get to read STATE.md', () => {
    const content = fs.readFileSync(SME_STEP, 'utf-8');
    assert.ok(content.includes('frontmatter.get') && content.includes('STATE.md'),
      'sme-step.md must call frontmatter.get on STATE.md to read active_smes');
  });

  test('sme-step.md checks use_sme_agents config flag', () => {
    const content = fs.readFileSync(SME_STEP, 'utf-8');
    assert.ok(content.includes('use_sme_agents'),
      'sme-step.md must check workflow.use_sme_agents feature flag');
  });

  test('discuss-phase.md references sme-step.md (lazy-load dispatch)', () => {
    const content = fs.readFileSync(DISCUSS_PHASE, 'utf-8');
    assert.ok(content.includes('sme-step.md'),
      'discuss-phase.md must reference sme-step.md for lazy-load dispatch');
  });
});
```

**Position-based assertion pattern** (lines 39-61 of analog — indexOf ordering checks):
```javascript
test('SME step reference appears AFTER cross_reference_todos in file position', () => {
  const content = fs.readFileSync(DISCUSS_PHASE, 'utf-8');
  const todosIdx = content.indexOf('cross_reference_todos');
  const smeIdx = content.indexOf('sme-step.md');
  assert.ok(todosIdx > -1, 'discuss-phase.md must contain "cross_reference_todos"');
  assert.ok(smeIdx > -1, 'discuss-phase.md must reference sme-step.md');
  assert.ok(todosIdx < smeIdx, 'sme-step.md reference must appear AFTER cross_reference_todos');
});
```

**Anti-pattern assertion** (adapted from GATE-08 pattern — assert something is absent):
```javascript
test('sme-step.md does NOT contain SME_APPROVED or SME_CONCERNS markers (probing mode only)', () => {
  const content = fs.readFileSync(SME_STEP, 'utf-8');
  assert.ok(!content.includes('SME_APPROVED'),
    'sme-step.md must NOT reference SME_APPROVED — this is probing-questions mode, not plan-audit mode');
  assert.ok(!content.includes('SME_CONCERNS'),
    'sme-step.md must NOT reference SME_CONCERNS — probing mode returns a numbered list, not audit markers');
});
```

---

## Shared Patterns

### Config-Gate (use_sme_agents)
**Source:** `get-shit-done/workflows/plan-phase.md` lines 1280-1286
**Apply to:** `sme-step.md` — must be the first check; skip entire step when false
```bash
SME_AGENTS=$(gsd-sdk query config-get workflow.use_sme_agents --raw 2>/dev/null || echo "false")
# If SME_AGENTS is not "true": skip entire sme-step.md logic
```

### Graceful Skip (never block)
**Source:** `get-shit-done/workflows/plan-phase.md` lines 1322-1336 (GATE-07 pattern)
**Apply to:** `sme-step.md` — all three skip conditions (flag false, active_smes empty, context block not found)
```markdown
Never block the discuss-phase. Every skip path silently continues to the next step.
- Flag false → skip silently
- active_smes empty → skip silently (Phase 8 not yet run)
- context block not found for an SME → warn + skip that SME; continue with others
```

### Lazy-Load Sub-Workflow Header
**Source:** `get-shit-done/workflows/discuss-phase/modes/advisor.md` lines 1-7
**Apply to:** `sme-step.md` — opening gate comment explaining when this file is Read
```markdown
> **Lazy-loaded and gated.** The parent `workflows/discuss-phase.md` Reads
> this file ONLY when [condition]. Skip the Read entirely when [condition is false].
```

### Progressive Disclosure Table Row
**Source:** `get-shit-done/workflows/discuss-phase.md` lines 18-31 (the `| When | Read |` table)
**Apply to:** `discuss-phase.md` modification — add exactly 1 row to the existing table
```markdown
| `use_sme_agents: true` AND `active_smes` non-empty in STATE.md | `workflows/discuss-phase/sme-step.md` |
```

### Template Conditional Section Documentation
**Source:** `get-shit-done/workflows/discuss-phase/templates/context.md` lines 20-24
**Apply to:** `context.md` template modification — add one bullet to `## Conditional sections`, then add the block to the template body
```markdown
- **`<sme_context>`** — include only when `sme_risk_areas` is non-empty. Otherwise omit entirely.
```

### CJS Test Pattern (node:test, not Vitest)
**Source:** `tests/sme-gate-plan-phase.test.cjs` — entire file
**Apply to:** `tests/sme-discuss-phase.test.cjs`
- Uses `require('node:test')` + `require('node:assert/strict')`
- All paths constructed via `path.join(__dirname, '..')`
- `describe` wraps each requirement ID; `test` per assertion
- `assert.ok(condition, message)` — always include the message string

---

## No Analog Found

All four files have direct analogs in the codebase.

| File | Role | Data Flow | Note |
|------|------|-----------|------|
| — | — | — | All analogs found |

---

## Metadata

**Analog search scope:** `get-shit-done/workflows/`, `get-shit-done/workflows/discuss-phase/`, `tests/`
**Files scanned:** discuss-phase.md (497 lines), plan-phase.md (step 12.6 section), templates/context.md, sme-gate-plan-phase.test.cjs, discuss-phase/modes/advisor.md, tests/workflow-size-budget.test.cjs
**Pattern extraction date:** 2026-04-30
