# Phase 9: Post-Execution Refresh - Pattern Map

**Mapped:** 2026-04-30
**Files analyzed:** 3 (2 modified, 1 new)
**Analogs found:** 3 / 3

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `get-shit-done/workflows/execute-phase.md` | workflow/orchestrator | event-driven (step insertion) | `get-shit-done/workflows/execute-phase.md` — `auto_copy_learnings` + `close_phase_todos` steps | exact (same file, adjacent steps) |
| `get-shit-done/workflows/plan-phase.md` | workflow/orchestrator | request-response (gate sub-check) | `get-shit-done/workflows/plan-phase.md` — step 12.6 SME Audit Gate | exact (same file, same section) |
| `tests/sme-post-execution-refresh.test.cjs` | test (structural) | batch (file read + assert) | `tests/sme-gate-plan-phase.test.cjs`, `tests/sme-new-milestone-detect.test.cjs` | exact |

---

## Pattern Assignments

### `get-shit-done/workflows/execute-phase.md` — new `<step name="sme_refresh">` (after `update_project_md`, before `offer_next`)

**Analog 1 — `auto_copy_learnings` step** (`execute-phase.md` lines 1484–1505):
Config-gate at top, feature-flag skip to next step, failure must not block completion.

**Config-gate pattern** (lines 1491–1495):
```bash
GL_ENABLED=$(gsd-sdk query config-get features.global_learnings --raw 2>/dev/null || echo "false")
```
**If `GL_ENABLED` is not `true`:** Skip this step entirely (feature disabled by default).

Copy this exact gate shape for `sme_refresh`, substituting:
- Query key: `workflow.use_sme_agents`
- Variable name: `SME_AGENTS`
- Skip target: `offer_next`

**Analog 2 — `close_phase_todos` step** (`execute-phase.md` lines 1507–1537):
Runs after `update_roadmap`, commits docs with explicit `--files`, silently skips when nothing to do, never blocks completion.

**Commit pattern** (line 1530):
```bash
gsd-sdk query commit "docs(phase-${PHASE_NUMBER}): auto-close ${#CLOSED[@]} todo(s) resolved by this phase" \
  --files .planning/todos/completed/ .planning/STATE.md || true
```

Copy this commit shape for `sme_refresh`, substituting:
- Message: `"docs(phase-${PHASE_NUMBER}): refresh SME documents after execution"`
- Files: explicit list of updated `.planning/smes/*.md` files

**Analog 3 — `create-sme.md` `spawn_creator` step** (lines 106–139):
Resolves creator model, resolves agent skills, spawns blocking Task(), checks return marker.

**Model + skills resolution** (lines 12–13):
```bash
CREATOR_MODEL=$(gsd-sdk query resolve-model gsd-sme-creator --raw)
AGENT_SKILLS_CREATOR=$(gsd-sdk query agent-skills gsd-sme-creator)
```

**Task() spawn pattern** (lines 119–133):
```
Task(
  subagent_type="gsd-sme-creator",
  model="{CREATOR_MODEL}",
  description="Create SME for {PROCESS_NAME}",
  prompt="Process: {PROCESS_NAME}
Today: {date}

{if UPDATE_MODE is true: 'UPDATE MODE: An SME already exists at .planning/smes/{PROCESS_NAME}-SME.md. Refresh it with the current code state. Preserve historical findings that still apply.'}

{AGENT_SKILLS_CREATOR}"
)
```

**Return marker check** (`create-sme.md` lines 144–151):
```
If `## SME Creation Complete`:
  Parse return for process name, finding counts, output path
  Continue to commit step

If no return marker or error text:
  Display warning and continue to next process (never block)
```

**Commit gate** (`create-sme.md` lines 155–159):
```bash
# Only commit if commit_docs from init context is true
gsd-sdk query commit "feat: create ${PROCESS_NAME} SME document" \
  --files ".planning/smes/${PROCESS_NAME}-SME.md"
```

**Analog 4 — plan-phase.md step 12.6 — `sme.detect-processes` call** (lines 1297–1308):
Collect `files_modified` from PLAN.md frontmatter, call detect-processes with file paths and goal.

**Detect-processes pattern** (lines 1301–1306):
```bash
PLAN_FILES=$(grep -h "files_modified:" "${PHASE_DIR}"/*-PLAN.md 2>/dev/null \
  | tr ' ' '\n' | grep "^\s*-" | sed 's/^\s*-\s*//' | tr '\n' ' ')
PHASE_GOAL=$(gsd-sdk query roadmap.get-phase "${PHASE}" --pick goal 2>/dev/null || echo "")

SME_DETECT=$(gsd-sdk query sme.detect-processes \
  --file-paths ${PLAN_FILES} \
  --goal "${PHASE_GOAL}" 2>/dev/null \
  || echo '{"data":{"enabled":false,"matches":[]}}')
```

Copy verbatim into `sme_refresh`. Note: use `${PHASE_NUMBER}` (execute-phase variable name) instead of `${PHASE}` (plan-phase variable name).

**Step positioning** (execute-phase.md lines 1484–1561):
```xml
<step name="auto_copy_learnings">   ← line 1484
<step name="close_phase_todos">     ← line 1507
<step name="update_project_md">     ← line 1539
<step name="sme_refresh">           ← INSERT HERE (new, after line 1559)
<step name="offer_next">            ← line 1561
```

**Banner pattern** (plan-phase.md lines 1289–1295):
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► SME AUDIT GATE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Detecting relevant processes...
```

Adapt for `sme_refresh`:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► SME REFRESH
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Detecting which processes this phase touched...
```

**Budget constraint (critical):** `execute-phase.md` is in the XL tier (budget 1800 lines). Current line count ~1622. Headroom: ~178 lines. Keep `sme_refresh` step to 40–60 lines of prose + bash. If the step cannot fit, extract it to `get-shit-done/workflows/execute-phase/steps/sme-refresh.md` and lazy-load it (following `post-merge-gate.md` pattern in that directory).

---

### `get-shit-done/workflows/plan-phase.md` — staleness sub-check inside existing step 12.6 SME Audit Gate

**Analog — step 12.6 existing structure** (`plan-phase.md` lines 1278–1423):
The section already calls `sme.list` (line 1317), `sme.detect-processes` (line 1305), and iterates matches (lines 1343–1348). The staleness check reuses those existing results.

**Existing `sme.list` call** (line 1317):
```bash
SME_LIST=$(gsd-sdk query sme.list 2>/dev/null || echo '{"data":{"enabled":true,"smes":[]}}')
```

**Existing matches iteration** (lines 1343–1348):
```bash
SME_CONTEXT_BLOCKS=""
for match in matches; do
  PROCESS_NAME=$(extract process_name from match)
  CTX=$(gsd-sdk query sme.context-block "${PROCESS_NAME}" 2>/dev/null || echo "")
  SME_CONTEXT_BLOCKS="${SME_CONTEXT_BLOCKS}${CTX_BLOCK}"
done
```

**Insertion point:** Between `### Determine Effective Block Mode` (line ~1351) and `### Spawn Auditor` (line ~1364). The staleness check must run AFTER matches are iterated (so process names are available) and BEFORE the auditor is spawned.

**Staleness check pattern** (derived from Pattern 5 in RESEARCH.md, reusing existing variables):
```bash
# Staleness pre-flight check (REFRESH-04) — warning only, never blocks
CURRENT_HEAD=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
STALE_SMES=""

# Reuse $SME_LIST (already fetched above for CONFIG-04 / GATE-07)
for match in matches; do
  PROCESS_NAME=$(extract process_name from match)
  LAST_COMMIT=$(extract last_analyzed_commit for PROCESS_NAME from SME_LIST)
  if [ -n "$LAST_COMMIT" ] && [ "$CURRENT_HEAD" != "unknown" ] && \
     [ "$LAST_COMMIT" != "$CURRENT_HEAD" ]; then
    STALE_SMES="${STALE_SMES}${PROCESS_NAME} (${LAST_COMMIT:0:8}) "
  fi
done

if [ -n "$STALE_SMES" ]; then
  echo "⚠ Stale SME(s): ${STALE_SMES}"
  echo "  These documents were analyzed at an older commit. The audit proceeds but"
  echo "  findings may not reflect recent code changes."
  echo "  SME documents are automatically refreshed after each phase execution."
fi
# Proceed to Spawn Auditor regardless of staleness — never block
```

**Key constraints from analog:**
- Never add `AskUserQuestion` or halt in the staleness section (contrast with strict-mode halt at lines 1394–1420 which is a different concern)
- Warning text must include "stale" or "Stale" (required by REFRESH-04 test assertion)
- Must reference `last_analyzed_commit` (required by REFRESH-04 test assertion)
- Must reference `rev-parse HEAD` or `CURRENT_HEAD` (required by REFRESH-04 test assertion)

---

### `tests/sme-post-execution-refresh.test.cjs` (new structural test file)

**Analog 1 — `tests/sme-gate-plan-phase.test.cjs`** (full file, lines 1–217):
Exact pattern match. Same framework, same file structure, same assertion style.

**File header pattern** (lines 1–27):
```javascript
/**
 * Structural validation tests for Phase 6 SME Audit Gate in plan-phase workflow.
 *
 * Tests verify static structure of plan-phase.md and commands/gsd/plan-phase.md —
 * not runtime behavior. All tests read files from the repo root using absolute paths.
 *
 * Requirements covered:
 *   GATE-01 — ...
 */
'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PLAN_PHASE = path.join(ROOT, 'get-shit-done', 'workflows', 'plan-phase.md');
const PLAN_PHASE_CMD = path.join(ROOT, 'commands', 'gsd', 'plan-phase.md');
const GATES_REF = path.join(ROOT, 'get-shit-done', 'references', 'gates.md');
```

Adapt header for Phase 9:
- Doc comment: list REFRESH-01 through REFRESH-04
- Constants: `EXECUTE_PHASE` and `PLAN_PHASE` (two target files)

**`describe` / `test` block pattern** (lines 30–62, positioning test):
```javascript
describe('GATE-01: SME Audit Gate step exists and is positioned correctly', () => {
  test('plan-phase.md contains an SME Audit Gate heading', () => {
    const content = fs.readFileSync(PLAN_PHASE, 'utf-8');
    assert.ok(
      content.includes('SME Audit Gate'),
      'plan-phase.md must contain an "SME Audit Gate" heading'
    );
  });

  test('SME Audit Gate appears AFTER Plan Bounce (step 12.5) in file position', () => {
    const content = fs.readFileSync(PLAN_PHASE, 'utf-8');
    const bounceIdx = content.indexOf('Plan Bounce');
    const smeGateIdx = content.indexOf('SME Audit Gate');
    assert.ok(bounceIdx < smeGateIdx,
      'SME Audit Gate must appear AFTER Plan Bounce in plan-phase.md'
    );
  });
});
```

For REFRESH-01/02/03 (execute-phase): use `content.indexOf('sme_refresh')` / `content.indexOf('offer_next')` to extract the refresh section, then assert on content of that substring (following REFRESH-03 substring pattern from RESEARCH.md lines 306–313).

**Analog 2 — `tests/sme-new-milestone-detect.test.cjs`** (full file, lines 1–98):
Shows the lazy-load dispatch test pattern (checking that a parent workflow references a sub-file). Not directly applicable to Phase 9 (no lazy-load for refresh step), but confirms the `describe` naming convention: `'DETECT-XX: human-readable description'` → adapt to `'REFRESH-XX: human-readable description'`.

**Test file path constants for new file:**
```javascript
const ROOT = path.join(__dirname, '..');
const EXECUTE_PHASE = path.join(ROOT, 'get-shit-done', 'workflows', 'execute-phase.md');
const PLAN_PHASE = path.join(ROOT, 'get-shit-done', 'workflows', 'plan-phase.md');
```

**Run command:**
```bash
node --test tests/sme-post-execution-refresh.test.cjs
```

---

## Shared Patterns

### Config Gate (use_sme_agents)

**Source:** `get-shit-done/workflows/plan-phase.md` lines 1280–1286 AND `execute-phase.md` lines 1491–1495
**Apply to:** Both the `sme_refresh` step (execute-phase) and the staleness sub-check (plan-phase, already has it)

```bash
SME_AGENTS=$(gsd-sdk query config-get workflow.use_sme_agents --raw 2>/dev/null || echo "false")
# If SME_AGENTS is not "true": skip this step entirely
```

### commit_docs Gate

**Source:** `get-shit-done/workflows/execute-phase.md` lines 737–742 AND `create-sme.md` lines 154–159
**Apply to:** The SME commit sub-step inside `sme_refresh`

```bash
# Check commit_docs — available from init context (parsed at execute-phase init, line 75)
# If commit_docs is "false": skip commit, SME files updated on disk but not committed
```

The `commit_docs` value is already in scope from the execute-phase init context (line 75). Do NOT re-query it.

### gsd-sdk query commit Pattern

**Source:** `get-shit-done/workflows/execute-phase.md` lines 815, 1530, 1555
**Apply to:** SME refresh commit in `sme_refresh` step

```bash
gsd-sdk query commit "docs(phase-${PHASE_NUMBER}): refresh SME documents after execution" \
  --files .planning/smes/${PROCESS_1}-SME.md .planning/smes/${PROCESS_2}-SME.md
```

Note: use `|| true` suffix on commit call to ensure failure never blocks `offer_next` (following pattern at line 1530).

### Warning-Only Pattern (no AskUserQuestion, no halt)

**Source:** `get-shit-done/workflows/plan-phase.md` lines 1322–1336 (CONFIG-04 / GATE-07 warning blocks)
**Apply to:** Staleness warning in plan-phase step 12.6

```
◆ No SME found for processes detected in this phase.
  Create one with: /gsd-create-sme [process-name]
  Skipping SME audit for this phase.
```

Adapt for staleness: emit warning text and proceed. The `AskUserQuestion` halt is reserved exclusively for strict-mode BLOCKER findings (lines 1394–1420), not informational warnings.

---

## No Analog Found

All three files have close analogs in the codebase. No entries.

---

## Metadata

**Analog search scope:** `get-shit-done/workflows/`, `tests/`, `agents/`
**Files read:** `tests/sme-gate-plan-phase.test.cjs`, `tests/sme-new-milestone-detect.test.cjs`, `get-shit-done/workflows/create-sme.md` (lines 1–160), `get-shit-done/workflows/execute-phase.md` (lines 730–743, 1484–1583), `get-shit-done/workflows/plan-phase.md` (lines 1278–1424)
**Pattern extraction date:** 2026-04-30
