# Phase 9: Post-Execution Refresh - Research

**Researched:** 2026-04-30
**Domain:** Workflow markdown integration, SME document lifecycle, staleness detection
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REFRESH-01 | After phase execution completes, determine which processes were affected by modified files | `sme.detect-processes` (Phase 2 SDK-02) accepts `--file-paths`; `git diff --name-only` gives the changed files; the orchestrator already knows `files_modified` from PLAN.md frontmatter [VERIFIED: execute-phase.md plans[] structure, sme.ts] |
| REFRESH-02 | Spawn `gsd-sme-creator` in refresh mode to update affected SME documents | Creator agent already supports UPDATE_MODE via "Update existing" path in `create-sme.md`; `gsd-sme-creator` prompt includes `UPDATE MODE:` flag [VERIFIED: create-sme.md, gsd-sme-creator.md] |
| REFRESH-03 | Updated SME documents committed as final part of phase completion | `gsd-sdk query commit` handler accepts explicit `--files`; SME updates committed after `update_project_md` step in execute-phase [VERIFIED: execute-phase.md, sdk/src/query/commit.ts] |
| REFRESH-04 | Plan-phase gate warns if SME's `last_analyzed_commit` is behind current HEAD before running the audit | `sme.list` already returns `last_analyzed_commit` per SME; `git rev-parse HEAD` gives current HEAD; comparison is a staleness check inserted into the existing step 12.6 SME Audit Gate [VERIFIED: sdk/src/query/sme.ts line 144, plan-phase.md step 12.6] |

</phase_requirements>

---

## Summary

Phase 9 closes the SME lifecycle loop. Phases 3-8 created, audited, and queued SME documents — but SMEs grow stale as code changes during execution. Phase 9 adds two things: (1) a post-execution refresh step in `execute-phase.md` that spawns `gsd-sme-creator` in update mode for any SMEs whose processes were touched by the phase, and (2) a staleness pre-flight check inside the existing SME Audit Gate (step 12.6 of `plan-phase.md`) that warns when `last_analyzed_commit` in an SME's frontmatter is behind the current HEAD.

Both deliverables follow the same patterns established in Phases 6, 7, and 8. The post-execution refresh inserts a new `sme_refresh` step in `execute-phase.md` positioned after `update_project_md` and before `offer_next`. The staleness check is a small addition to the existing step 12.6 (which already calls `sme.list` — it just needs to compare `last_analyzed_commit` against `git rev-parse HEAD`). Structural tests follow the same CJS `node:test` pattern as `sme-gate-plan-phase.test.cjs` and `sme-new-milestone-detect.test.cjs`.

The implementation is pure workflow markdown plus CJS structural tests. Zero new npm packages are needed. All infrastructure exists: `sme.list` (SDK-01), `sme.detect-processes` (SDK-02), `gsd-sme-creator` agent, `frontmatter.merge`, and `gsd-sdk query commit`.

**Primary recommendation:** Add a `<step name="sme_refresh">` to `execute-phase.md` (after `update_project_md`, before `offer_next`) and a staleness sub-check inside the existing `## 12.6. SME Audit Gate` in `plan-phase.md`. Write CJS tests in `tests/sme-post-execution-refresh.test.cjs` covering REFRESH-01 through REFRESH-04.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Detect which processes phase touched | SDK Layer (`sme.detect-processes`) | Orchestration Layer | Phase 2 handler; accepts `--file-paths` from phase PLAN.md frontmatter [VERIFIED: sme.ts] |
| Refresh SME documents | Agent Layer (`gsd-sme-creator`) | Orchestration Layer | Creator already implements UPDATE_MODE; orchestrator spawns it with refresh prompt [VERIFIED: gsd-sme-creator.md] |
| Commit updated SME docs | SDK Layer (`gsd-sdk query commit`) | Orchestration Layer | Standard commit handler; SME files added with `--files .planning/smes/*` [VERIFIED: execute-phase.md pattern] |
| Staleness detection | Orchestration Layer (`plan-phase.md step 12.6`) | SDK Layer (`sme.list`) | `sme.list` returns `last_analyzed_commit` per SME; orchestrator compares to `git rev-parse HEAD` [VERIFIED: sme.ts line 144] |
| Feature guard | SDK Layer (`config-get`) | — | `workflow.use_sme_agents` check at entry of both refresh step and staleness sub-check [VERIFIED: all SME phases] |

---

## Standard Stack

### Core (already installed — no new deps)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Markdown + YAML frontmatter | N/A | Workflow definition format | All GSD workflows use this format [VERIFIED: repo scan] |
| `gsd-sdk query sme.list` | N/A (SDK-01) | List SMEs with `last_analyzed_commit` metadata | Phase 2; returns per-SME `last_analyzed_commit` field [VERIFIED: sdk/src/query/sme.ts line 144] |
| `gsd-sdk query sme.detect-processes` | N/A (SDK-02) | Detect which SME processes a phase touched by file paths | Phase 2; accepts `--file-paths` and `--goal` [VERIFIED: sdk/src/query/sme.ts] |
| `gsd-sme-creator` agent | N/A (Phase 3) | Refreshes existing SME documents in UPDATE_MODE | Already implements the refresh path; orchestrator injects `UPDATE MODE:` in the prompt [VERIFIED: agents/gsd-sme-creator.md, create-sme.md] |
| `gsd-sdk query commit` | N/A | Commit updated SME documents as final phase step | Used throughout all phases for atomic commit of planning artifacts [VERIFIED: execute-phase.md] |
| `git rev-parse HEAD` | N/A | Get current HEAD commit hash for staleness comparison | Standard git command; used in `gsd-sme-creator.md` to write `last_analyzed_commit` [VERIFIED: gsd-sme-creator.md line 146] |

### No New Packages Required

Phase 9 delivers workflow markdown changes and CJS structural tests. Zero new npm installs.

---

## Architecture Patterns

### System Architecture Diagram

```
execute-phase.md orchestrator
    │
    │ ... wave execution, verification, update_roadmap, update_project_md ...
    │
    ▼
<step name="sme_refresh">  ◄─── PHASE 9 INSERTION POINT (REFRESH-01,02,03)
    │
    ├── [use_sme_agents != true] ──────────────────────────────► SKIP → offer_next
    │
    ├── Collect changed files from phase PLAN.md frontmatter `files_modified`
    │     bash: aggregate files_modified from all plan files in PHASE_DIR
    │
    ├── gsd-sdk query sme.detect-processes --file-paths ${CHANGED_FILES}
    │     --goal "${PHASE_GOAL}"
    │       │
    │       ├── [matches: []] ─────────────────────────────────► No affected SMEs → SKIP
    │       │
    │       └── [matches: [...]]
    │             │
    │             └── For each matched process:
    │                   Task(gsd-sme-creator, UPDATE MODE: refresh {process_name})
    │                   Wait for "## SME Creation Complete" marker
    │
    ├── If any SMEs updated:
    │     gsd-sdk query commit "docs(phase-{X}): refresh SME documents after execution"
    │       --files .planning/smes/{process}-SME.md ...
    │
    └── ──────────────────────────────────────────────────────► offer_next


plan-phase.md step 12.6 SME Audit Gate (REFRESH-04 staleness sub-check)
    │
    │ (existing) Read use_sme_agents → skip if false
    │ (existing) Detect processes, fetch context blocks
    │
    ▼
    NEW: For each matched SME, compare last_analyzed_commit to HEAD
    │
    ├── STALE_SMES = [smes where last_analyzed_commit != HEAD]
    │
    ├── [STALE_SMES non-empty] ────────────────────────────────► Emit staleness warning
    │     "⚠ N SME(s) are stale — last analyzed at {hash[:8]}, current HEAD is {HEAD[:8]}.
    │      Consider refreshing: /gsd-execute-phase {prev_phase} to trigger auto-refresh."
    │     (warning only — never blocks; audit still proceeds with potentially stale docs)
    │
    └── [no staleness] ─────────────────────────────────────► Proceed to auditor spawn
```

### Recommended Project Structure

```
get-shit-done/workflows/
└── execute-phase.md        # MODIFIED — add <step name="sme_refresh"> after update_project_md

get-shit-done/workflows/
└── plan-phase.md           # MODIFIED — add staleness sub-check inside step 12.6

tests/
└── sme-post-execution-refresh.test.cjs   # NEW — structural tests for REFRESH-01..04
```

### Pattern 1: Config-Gated Step at Top of SME Refresh Step

The canonical config-gate pattern for all SME features [VERIFIED: plan-phase.md step 12.6, discuss-phase/sme-step.md]:

```bash
# Source: plan-phase.md step 12.6 [VERIFIED: repo]
SME_AGENTS=$(gsd-sdk query config-get workflow.use_sme_agents --raw 2>/dev/null || echo "false")
# If SME_AGENTS is not "true": skip this step entirely
```

### Pattern 2: Detect Changed Files from PLAN.md Frontmatter (REFRESH-01)

The execute-phase orchestrator already has `files_modified` per plan from `phase-plan-index` JSON. The best approach for the refresh step is to aggregate `files_modified` across all plans in the completed phase using a grep pattern (same as plan-phase.md step 12.6 uses for SME detection):

```bash
# Source: plan-phase.md step 12.6 [VERIFIED: repo]
# Aggregate files_modified from ALL PLAN.md files in the phase directory
CHANGED_FILES=$(grep -h "files_modified:" "${PHASE_DIR}"/*-PLAN.md 2>/dev/null \
  | tr ' ' '\n' | grep "^\s*-" | sed 's/^\s*-\s*//' | tr '\n' ' ')
PHASE_GOAL=$(gsd-sdk query roadmap.get-phase "${PHASE_NUMBER}" --pick goal 2>/dev/null || echo "")

SME_DETECT=$(gsd-sdk query sme.detect-processes \
  --file-paths ${CHANGED_FILES} \
  --goal "${PHASE_GOAL}" 2>/dev/null \
  || echo '{"data":{"enabled":false,"matches":[]}}')
```

**Alternative approach (more authoritative):** Use `git diff --name-only` against the pre-phase HEAD captured at execution start. This finds ALL files actually committed, not just the planned `files_modified`. However, the orchestrator does not currently capture a pre-phase HEAD snapshot. Using PLAN.md `files_modified` is the correct pragmatic approach for v1.

### Pattern 3: Creator Agent Invocation in UPDATE_MODE (REFRESH-02)

The `gsd-sme-creator` agent accepts a refresh prompt via the `UPDATE MODE:` prefix. This is the same mechanism used by `create-sme.md`'s "Update existing" path [VERIFIED: create-sme.md lines 127-131, gsd-sme-creator.md]:

```markdown
<!-- Source: create-sme.md spawn_creator step [VERIFIED] -->
Task(
  subagent_type="gsd-sme-creator",
  model="{CREATOR_MODEL}",
  description="Refresh SME for {PROCESS_NAME}",
  prompt="Process: {PROCESS_NAME}
Today: {date}

UPDATE MODE: An SME already exists at .planning/smes/{PROCESS_NAME}-SME.md.
Refresh it with the current code state. Preserve historical findings that still apply.

{AGENT_SKILLS_CREATOR}"
)
```

The creator returns `## SME Creation Complete` on success. The orchestrator waits for this marker before continuing.

CRITICAL: spawn one Task() per matched process (not all in a single call). The creator agent performs sub-agent delegation internally — spawning multiple creators in parallel could race on `.planning/smes/.tmp/` temp files.

### Pattern 4: Commit Updated SMEs (REFRESH-03)

Updated SME files are committed after all refreshes complete, as the final step before `offer_next`. This matches the `create-sme.md` commit pattern [VERIFIED: create-sme.md commit_and_complete step]:

```bash
# Source: create-sme.md commit_and_complete [VERIFIED]
gsd-sdk query commit "docs(phase-${PHASE_NUMBER}): refresh SME documents after execution" \
  --files ".planning/smes/${PROCESS_NAME_1}-SME.md" ".planning/smes/${PROCESS_NAME_2}-SME.md"
```

If `commit_docs` is false (from init context), skip the commit. The refresh still runs (SME files updated on disk), but no commit is made. This follows the existing `commit_docs` gate pattern throughout execute-phase.

### Pattern 5: Staleness Pre-Flight Check (REFRESH-04)

This is a small addition inside the existing step 12.6 SME Audit Gate in `plan-phase.md`. The step already calls `sme.list` (for CONFIG-04/GATE-07 detection). Staleness detection reuses this existing call's output — no new SDK query needed:

```bash
# Source: plan-phase.md step 12.6 [VERIFIED — sme.list already called here]
CURRENT_HEAD=$(git rev-parse HEAD 2>/dev/null || echo "unknown")

# Parse the matches from sme.detect-processes (already available in step 12.6)
# For each matched SME, check last_analyzed_commit:
STALE_SMES=""
for match in matches; do
  PROCESS=$(extract process_name from match)
  # Find this SME in the sme.list output (already fetched for CONFIG-04)
  LAST_COMMIT=$(find last_analyzed_commit for PROCESS in SME_LIST)
  if [ -n "$LAST_COMMIT" ] && [ "$LAST_COMMIT" != "$CURRENT_HEAD" ]; then
    STALE_SMES="${STALE_SMES}${PROCESS} (${LAST_COMMIT:0:8}) "
  fi
done

if [ -n "$STALE_SMES" ]; then
  echo "⚠ Stale SME(s) detected: ${STALE_SMES}"
  echo "  These SME documents were analyzed at an older commit. The audit will proceed"
  echo "  but findings may not reflect recent code changes."
  echo "  SME documents auto-refresh after each phase execution when use_sme_agents is enabled."
fi
```

The staleness check NEVER blocks the gate. It emits a warning and the audit proceeds with whatever state the SME documents are in. This matches REFRESH-04: "warns the user when an SME's `last_analyzed_commit` is behind the current HEAD before running the audit."

**Positioning within step 12.6:** Insert between "Fetch Context Blocks" and "Spawn Auditor" — after context blocks are fetched (so we have process names) but before the auditor is spawned. The warning appears just before the audit runs, making it contextually relevant.

### Pattern 6: Sequencing — Where sme_refresh Lives in execute-phase.md

The `sme_refresh` step must run AFTER verification passes and after `update_roadmap` marks the phase complete. It must NOT run before the phase is marked complete because:
1. If verification fails (gaps found), the phase is not complete and SME refresh would be premature
2. The commit for SME updates should be the LAST commit of the phase, not mixed with verification

Correct position: after `update_project_md`, before `offer_next`.

```xml
<!-- Current execute-phase.md step order (tail): -->
<step name="aggregate_results">     ← wave summary
<step name="tdd_review_checkpoint"> ← optional TDD review
<step name="handle_partial_wave_execution">
<step name="code_review_gate">
<step name="close_parent_artifacts">
<step name="regression_gate">
<step name="schema_drift_gate">
<step name="codebase_drift_gate">
<step name="verify_phase_goal">     ← verification
<step name="update_roadmap">        ← marks phase complete, commits ROADMAP/STATE/VERIFICATION
<step name="auto_copy_learnings">
<step name="close_phase_todos">
<step name="update_project_md">     ← commits PROJECT.md
<step name="sme_refresh">           ← NEW: Phase 9 insertion point
<step name="offer_next">            ← route to next
```

**CRITICAL:** Do not insert `sme_refresh` between `verify_phase_goal` and `update_roadmap`. The SME refresh is an addendum to phase completion, not part of verification. If `verify_phase_goal` returns `gaps_found`, `offer_next` routes to gap closure directly (bypassing the normal post-completion steps). The `sme_refresh` step is in the "phase-complete happy path" only.

### Pattern 7: CJS Structural Test Pattern (from sme-gate-plan-phase.test.cjs)

Tests follow the `node:test` CJS pattern. One `describe` per requirement, assertions check file content. [VERIFIED: tests/sme-gate-plan-phase.test.cjs, tests/sme-new-milestone-detect.test.cjs]

```javascript
// Source: tests/sme-gate-plan-phase.test.cjs pattern [VERIFIED]
'use strict';
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const EXECUTE_PHASE = path.join(ROOT, 'get-shit-done', 'workflows', 'execute-phase.md');
const PLAN_PHASE = path.join(ROOT, 'get-shit-done', 'workflows', 'plan-phase.md');

describe('REFRESH-01: post-execution SME process detection', () => {
  test('execute-phase.md contains sme_refresh step', () => {
    const content = fs.readFileSync(EXECUTE_PHASE, 'utf-8');
    assert.ok(content.includes('sme_refresh') || content.includes('SME Refresh'),
      'execute-phase.md must contain an SME refresh step');
  });

  test('sme_refresh step calls sme.detect-processes', () => {
    const content = fs.readFileSync(EXECUTE_PHASE, 'utf-8');
    assert.ok(content.includes('sme.detect-processes'),
      'sme_refresh step must call sme.detect-processes to find affected processes');
  });
});

describe('REFRESH-02: gsd-sme-creator spawned in refresh mode', () => {
  test('sme_refresh step references gsd-sme-creator', () => {
    const content = fs.readFileSync(EXECUTE_PHASE, 'utf-8');
    assert.ok(content.includes('gsd-sme-creator'),
      'sme_refresh step must spawn gsd-sme-creator for affected processes');
  });

  test('sme_refresh step uses UPDATE MODE', () => {
    const content = fs.readFileSync(EXECUTE_PHASE, 'utf-8');
    assert.ok(content.includes('UPDATE MODE'),
      'sme_refresh step must pass UPDATE MODE in the creator prompt');
  });
});

describe('REFRESH-03: updated SME documents committed', () => {
  test('sme_refresh step commits updated SME documents', () => {
    const content = fs.readFileSync(EXECUTE_PHASE, 'utf-8');
    // Check that commit is called referencing .planning/smes in the sme_refresh context
    const refreshStart = content.indexOf('sme_refresh');
    const offerNextStart = content.indexOf('offer_next');
    assert.ok(refreshStart > -1, 'execute-phase.md must contain sme_refresh section');
    const refreshSection = content.substring(refreshStart, offerNextStart > refreshStart ? offerNextStart : undefined);
    assert.ok(refreshSection.includes('.planning/smes') || refreshSection.includes('planning/smes'),
      'sme_refresh step must commit files from .planning/smes/');
  });
});

describe('REFRESH-04: staleness pre-flight check in plan-phase gate', () => {
  test('plan-phase.md step 12.6 checks last_analyzed_commit against HEAD', () => {
    const content = fs.readFileSync(PLAN_PHASE, 'utf-8');
    assert.ok(content.includes('last_analyzed_commit'),
      'plan-phase.md step 12.6 must check last_analyzed_commit for staleness');
  });

  test('plan-phase.md step 12.6 calls git rev-parse HEAD for current commit', () => {
    const content = fs.readFileSync(PLAN_PHASE, 'utf-8');
    assert.ok(content.includes('rev-parse HEAD') || content.includes('CURRENT_HEAD'),
      'plan-phase.md step 12.6 must compare last_analyzed_commit to current HEAD');
  });

  test('staleness check is a warning only, not a blocker', () => {
    const content = fs.readFileSync(PLAN_PHASE, 'utf-8');
    // The staleness section must include "stale" or "warning" language and proceed
    const smeGateIdx = content.indexOf('SME Audit Gate');
    const step13Idx = content.indexOf('## 13');
    const gateSection = content.substring(smeGateIdx, step13Idx);
    assert.ok(
      gateSection.includes('stale') || gateSection.includes('Stale'),
      'plan-phase.md step 12.6 must mention stale SME documents'
    );
  });
});
```

### Anti-Patterns to Avoid

- **Running sme_refresh when verification found gaps:** If `verify_phase_goal` returns `gaps_found`, the phase is not complete. The `offer_next` step routes directly to gap closure. The `sme_refresh` step should be positioned AFTER `update_project_md` so it is naturally skipped in the gaps-found branch (which exits early from `verify_phase_goal`).
- **Spawning all creator refreshes in parallel:** The `gsd-sme-creator` agent writes to `.planning/smes/.tmp/` shared temp files. Multiple parallel creators for different processes COULD race on the tmp directory. Spawn sequentially (one Task per process, block before next).
- **Blocking execute-phase completion on SME refresh failures:** If the creator fails or returns without the `## SME Creation Complete` marker, log the failure and proceed. Never let SME refresh block phase completion.
- **Re-using `git diff` against a pre-phase commit:** The orchestrator does not currently capture a pre-phase HEAD snapshot in any variable. Using PLAN.md `files_modified` is the correct approach. Do not invent a `PHASE_START_COMMIT` that doesn't exist.
- **Staleness check that blocks the audit:** REFRESH-04 is explicitly a warning only. Do not add `AskUserQuestion` or a halt here. The existing step 12.6 already has its own blocking logic (strict mode with BLOCKER findings). Staleness is advisory.
- **Fetching `last_analyzed_commit` by re-reading SME files directly:** `sme.list` already returns `last_analyzed_commit` for every SME. The staleness check reuses this existing call's output — no extra `frontmatter.get` needed.
- **Committing SME files before `update_roadmap`:** The commit order matters. Phase completion (`update_roadmap`) commits ROADMAP.md, STATE.md, REQUIREMENTS.md, and VERIFICATION.md. SME refresh commits `.planning/smes/*.md`. These are separate commits. SME refresh MUST come after `update_roadmap` to keep the final phase commit clean.
- **Overflowing execute-phase.md budget:** `execute-phase.md` is in the XL tier (budget: 1800 lines, current size: 1622 lines). That leaves 178 lines of headroom. The `sme_refresh` step content must fit within this budget. Based on pattern analysis from comparable steps (`auto_copy_learnings` is ~20 lines, `close_phase_todos` is ~30 lines), the refresh step should be ~40-60 lines of prose and bash. This fits within the 178-line headroom. [VERIFIED: tests/workflow-size-budget.test.cjs, execute-phase current line count 1622]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| List affected SME processes | Custom grep of `.planning/smes/` | `gsd-sdk query sme.detect-processes --file-paths ... --goal ...` | Case-insensitive matching, deduplication, handles missing smes dir gracefully [VERIFIED: sme.ts] |
| List SMEs with metadata | Custom frontmatter parsing | `gsd-sdk query sme.list` | Returns `last_analyzed_commit` per SME — exactly what REFRESH-04 needs [VERIFIED: sme.ts line 144] |
| Refresh SME content | New script that reads code and updates frontmatter | `gsd-sme-creator` agent in UPDATE_MODE | Creator already implements parallel sub-agent analysis and frontmatter update [VERIFIED: gsd-sme-creator.md] |
| Get current git HEAD | `cat .git/HEAD` or manual parsing | `git rev-parse HEAD` | Canonical; works in detached HEAD, worktrees, submodules [VERIFIED: gsd-sme-creator.md] |
| Commit SME files | `git add && git commit` directly | `gsd-sdk query commit "..." --files ...` | SDK handler handles `commit_docs: false` gate, co-author attribution, atomic writes [VERIFIED: execute-phase.md pattern] |

**Key insight:** Phase 9 is almost entirely orchestration markdown. It wires the already-existing `gsd-sme-creator` UPDATE_MODE into the execute-phase completion flow. The SME infrastructure from Phases 2 and 3 does all the heavy lifting.

---

## Common Pitfalls

### Pitfall 1: sme_refresh Runs When Verification Failed

**What goes wrong:** `verify_phase_goal` returns `gaps_found`. The phase is NOT complete. But the orchestrator continues past verification, runs `sme_refresh`, and commits updated SME docs — for a phase that didn't pass.

**Why it happens:** The execute-phase step sequence continues linearly. The `gaps_found` branch in `verify_phase_goal` presents gap-closure options but if `sme_refresh` is positioned after `verify_phase_goal`, it would still run.

**How to avoid:** Study the current execute-phase.md control flow. When `verify_phase_goal` returns `gaps_found`, it presents an immediate `⚠ Phase {X}: Gaps Found` block and the current implementation routes to gap closure. The `update_roadmap`, `auto_copy_learnings`, `close_phase_todos`, and `update_project_md` steps are NOT reached in the gaps-found path. By placing `sme_refresh` AFTER `update_project_md`, it naturally falls within the "phase fully complete" branch.

**Warning signs:** SME files are updated and committed even though VERIFICATION.md shows `status: gaps_found`.

### Pitfall 2: Sequential Creator Invocation Races on .tmp Directory

**What goes wrong:** Two processes are detected (e.g., "payments" and "auth"). Both `gsd-sme-creator` Task() calls are spawned in parallel with `run_in_background=true`. Both creators create `.planning/smes/.tmp/{process}-part-N.md` files. No naming collision occurs because they use different process names — BUT the tmp directory cleanup at the end of each creator (`rm -rf .planning/smes/.tmp`) could delete the OTHER creator's in-progress tmp files.

**Why it happens:** `gsd-sme-creator.md` cleanup step (step 6) runs `rm -rf .planning/smes/.tmp`. If two creators run in parallel, the first to finish deletes the tmp directory, causing the second to fail when it reads its tmp files.

**How to avoid:** Spawn creators SEQUENTIALLY. Block on `## SME Creation Complete` before spawning the next. This adds latency (each refresh is serial) but is safe. For v1, this is the correct approach — SME refresh is a background cleanup step, not a critical path.

**Warning signs:** Second creator returns "SME creation failed" or produces an empty/partial document.

### Pitfall 3: execute-phase.md Budget Overflow

**What goes wrong:** The `sme_refresh` step adds too much inline content to `execute-phase.md`, pushing it past 1800 lines. `node --test tests/workflow-size-budget.test.cjs` fails.

**Why it happens:** `execute-phase.md` is in the XL tier with a 1800-line budget. Current size is ~1622 lines. The headroom is only 178 lines. A verbose `sme_refresh` step could easily overflow this.

**How to avoid:** Keep `sme_refresh` step content to ~40-60 lines. Favor brevity over comprehensiveness in the inline step. Complex branching logic can reference patterns documented elsewhere. Check line count before committing:

```bash
wc -l get-shit-done/workflows/execute-phase.md
```

**Warning signs:** `node --test tests/workflow-size-budget.test.cjs` fails with `execute-phase (XL) exceeds 1800 lines`.

**Alternative if budget is tight:** Lazy-load the refresh logic into `get-shit-done/workflows/execute-phase/steps/sme-refresh.md` (following the `post-merge-gate.md` pattern in `execute-phase/steps/`). The main workflow reads this file and follows it. This keeps `execute-phase.md` lean.

### Pitfall 4: Staleness Check Placed Before Context Block Fetch

**What goes wrong:** REFRESH-04 staleness check is placed BEFORE `sme.detect-processes` is called. The check tries to compare `last_analyzed_commit` from `sme.list` for ALL SMEs, not just the ones that match the current phase. This floods the gate output with staleness warnings for irrelevant processes.

**Why it happens:** `sme.list` returns ALL SMEs. If staleness is checked against all SMEs before process detection, every SME in the project (even unrelated ones) generates a warning.

**How to avoid:** Staleness check must run AFTER `sme.detect-processes` returns matches. Only check `last_analyzed_commit` for SMEs in the `matches[]` array. The `matches` already contain `file` (which is the SME filename, e.g. `payments-SME.md`). Cross-reference against the `sme.list` results to find `last_analyzed_commit` for matched processes.

**Warning signs:** Gate emits staleness warnings for every SME in the project, even for processes unrelated to the current phase.

### Pitfall 5: Staleness Check Blocks on Mismatch

**What goes wrong:** The staleness check halts the gate with `AskUserQuestion` when an SME is stale, forcing the user to explicitly acknowledge staleness before the audit proceeds.

**Why it happens:** Phase 6 established that BLOCKER findings from strict-mode SMEs get an `AskUserQuestion` halt. A developer adds a similar halt for staleness, thinking it's the same severity.

**How to avoid:** REFRESH-04 says "warns" — not "blocks." Staleness is an informational concern. The SME document still contains valid domain knowledge; it's just potentially missing recent code changes. Emit a warning and proceed. Never add `AskUserQuestion` or a `STOP` condition for staleness.

### Pitfall 6: Creator Invoked for Non-Existent SME

**What goes wrong:** `sme.detect-processes` matches a process (e.g., "auth") by keyword in the phase goal, but there is no `.planning/smes/auth-SME.md` file. The refresh step tries to invoke `gsd-sme-creator` in UPDATE_MODE, but the creator finds no existing file and creates a brand-new SME.

**Why it happens:** `sme.detect-processes` detects by keyword matching against process names of existing SMEs. But if a NEW process was added to the codebase during this phase execution, `sme.detect-processes` cannot detect it (the SME doesn't exist yet). This means the refresh will only find processes whose SMEs already exist — which is the correct and safe behavior.

**However:** If `sme.detect-processes` returns a match for a process whose SME file was deleted between when it was created and now, the creator will create a fresh SME. This is acceptable behavior — a missing SME for a detected process is always worth creating.

**How to avoid:** The sme_refresh step does not need special handling for this case. The creator handles both create and update modes. The key is that the orchestrator should check the `## SME Creation Complete` marker regardless.

---

## Code Examples

### sme_refresh Step Skeleton (execute-phase.md insertion)

```xml
<!-- Source: execute-phase.md patterns + create-sme.md [VERIFIED] -->

<step name="sme_refresh">
**SME document refresh — update affected SME documents after phase execution.**

> Skip if `workflow.use_sme_agents` is not `true`.

```bash
SME_AGENTS=$(gsd-sdk query config-get workflow.use_sme_agents --raw 2>/dev/null || echo "false")
```

**If `SME_AGENTS` is not `true`:** Skip to `offer_next`.

Display banner:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► SME REFRESH
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Detecting which processes this phase touched...
```

Collect changed files from all PLAN.md files in the phase directory:

```bash
CHANGED_FILES=$(grep -h "files_modified:" "${PHASE_DIR}"/*-PLAN.md 2>/dev/null \
  | tr ' ' '\n' | grep "^\s*-" | sed 's/^\s*-\s*//' | tr '\n' ' ')
PHASE_GOAL=$(gsd-sdk query roadmap.get-phase "${PHASE_NUMBER}" --pick goal 2>/dev/null || echo "")

SME_DETECT=$(gsd-sdk query sme.detect-processes \
  --file-paths ${CHANGED_FILES} \
  --goal "${PHASE_GOAL}" 2>/dev/null \
  || echo '{"data":{"enabled":false,"matches":[]}}')
```

Parse `SME_DETECT`: extract `enabled` and `matches[]`.

**If `enabled` is false OR `matches` is empty:** Skip to `offer_next` with message "No SME processes affected by this phase."

Resolve creator model:
```bash
CREATOR_MODEL=$(gsd-sdk query resolve-model gsd-sme-creator --raw 2>/dev/null || echo "inherit")
AGENT_SKILLS_CREATOR=$(gsd-sdk query agent-skills gsd-sme-creator 2>/dev/null || echo "")
```

For each process in `matches[]` (sequentially — one Task at a time, block before next):

```
Task(
  subagent_type="gsd-sme-creator",
  model="{CREATOR_MODEL}",
  description="Refresh SME for {PROCESS_NAME} after phase {PHASE_NUMBER}",
  prompt="Process: {PROCESS_NAME}
Today: {today}

UPDATE MODE: An SME already exists at .planning/smes/{PROCESS_NAME}-SME.md.
Refresh it with the current code state after Phase {PHASE_NUMBER} execution.
Preserve historical findings that still apply.

{AGENT_SKILLS_CREATOR}"
)
```

**After each Task:** Check for `## SME Creation Complete` marker. On failure: log warning and continue to next process (never block).

After all refreshes complete, commit updated SME files (if `commit_docs` is true):

```bash
# Build list of updated SME files
UPDATED_SMES=$(for p in {matched_processes}; do echo ".planning/smes/${p}-SME.md"; done | tr '\n' ' ')
gsd-sdk query commit "docs(phase-${PHASE_NUMBER}): refresh SME documents after execution" \
  --files ${UPDATED_SMES}
```

Display completion:
```
◆ SME Refresh Complete — {N} document(s) updated.
```
</step>
```

### Staleness Sub-Check (addition to plan-phase.md step 12.6)

Insert this block AFTER "Determine Effective Block Mode" and BEFORE "Spawn Auditor":

```markdown
<!-- Source: sme.list already called in step 12.6 for CONFIG-04 [VERIFIED: plan-phase.md] -->
<!-- Insert: Staleness pre-flight check (REFRESH-04) -->

### Staleness Pre-Flight Check

```bash
CURRENT_HEAD=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
STALE_SMES=""

# Check last_analyzed_commit for each matched process using sme.list output
# (sme.list was already called above for CONFIG-04 / GATE-07 — reuse $SME_LIST)
for match in matches; do
  PROCESS_NAME=$(extract process_name from match)
  LAST_COMMIT=$(extract last_analyzed_commit for PROCESS_NAME from SME_LIST)
  if [ -n "$LAST_COMMIT" ] && [ "$CURRENT_HEAD" != "unknown" ] && [ "$LAST_COMMIT" != "$CURRENT_HEAD" ]; then
    STALE_SMES="${STALE_SMES}${PROCESS_NAME} (analyzed at ${LAST_COMMIT:0:8}) "
  fi
done
```

**If `STALE_SMES` is non-empty (warning only — never blocks):**
```
⚠ Stale SME(s): ${STALE_SMES}
  These documents were analyzed at an older commit. The audit proceeds but
  findings may not reflect code changes since ${LAST_COMMIT:0:8}.
  SME documents are automatically refreshed after each phase execution.
```

Proceed to Spawn Auditor regardless of staleness.
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| SME documents never updated after creation | SME documents refreshed automatically at phase completion when use_sme_agents is enabled | Phase 9 (this phase) | SME documents stay synchronized with code evolution |
| Plan-phase gate audits with potentially stale SME docs silently | Plan-phase gate warns explicitly when SME is behind HEAD | Phase 9 (this phase) | Developers are aware when audit findings may be outdated |
| Manual `/gsd-create-sme --update` required to keep SMEs current | Automatic refresh after each phase execution | Phase 9 (this phase) | Zero friction — SMEs maintained without developer intervention |

**Deprecated/outdated:**
- Nothing deprecated by Phase 9. This phase adds new behavior under `use_sme_agents: false` (which keeps existing behavior unchanged).

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Using PLAN.md `files_modified` frontmatter is sufficient to detect which processes were affected (rather than `git diff` against a pre-phase HEAD) | Pattern 2, Pitfall 6 | If files were modified during execution that are NOT in `files_modified` frontmatter (out-of-scope edits), those changes won't trigger SME refresh; the gap is small in practice since `files_modified` is the plan's declared scope |
| A2 | Sequential creator spawning (one at a time) is required to prevent `.tmp` directory race conditions | Anti-Patterns, Pitfall 2 | If gsd-sme-creator uses per-process tmp directories (e.g., `.tmp/{process}/`) rather than a flat `.tmp/`, parallel spawning would be safe; the current implementation uses flat `.tmp/` with process-namespaced file names, which avoids the cleanup race |
| A3 | The `sme_refresh` step fits within the 178-line execute-phase.md budget headroom | Pitfall 3 | If the step requires more prose, it must be extracted to `execute-phase/steps/sme-refresh.md` (lazy-load pattern); the lazy-load option is the safe fallback |
| A4 | `sme.detect-processes` called with PLAN.md `files_modified` paths correctly matches SME process names (substring matching) | Pattern 2, REFRESH-01 | If a process is named "payment-processing" but the SME file says "payments" (shorter name), and no file path contains "payment-processing" as a substring, the match may not fire; the goal keyword matching (`--goal "${PHASE_GOAL}"`) provides a second detection path |
| A5 | The staleness check in plan-phase gate reuses the `$SME_LIST` variable already fetched earlier in step 12.6 (for CONFIG-04/GATE-07) | Pattern 5, Code Examples | If `SME_LIST` is parsed and discarded early in the step, a second `sme.list` call is needed; the planner should verify `SME_LIST` scope in the step 12.6 prose |

---

## Open Questions

1. **Should sme_refresh run on gaps-found phases?**
   - What we know: `verify_phase_goal` returns `gaps_found` → routes to gap closure, does not continue to `update_roadmap` or later steps. The `sme_refresh` step after `update_project_md` is naturally not reached.
   - What's unclear: Should SME docs be refreshed after partial execution (gaps found)?
   - Recommendation: No. SME refresh runs only when phase is fully verified and complete. A phase with gaps found is not complete — refreshing its SMEs could introduce noise. The next gap-closure execution will trigger its own SME refresh.

2. **What if `PLAN.md files_modified` is empty or incomplete?**
   - What we know: Some plans have sparse `files_modified` declarations. If the array is empty, `sme.detect-processes` gets no file paths to match against.
   - What's unclear: Is `--goal "${PHASE_GOAL}"` sufficient as a fallback when file paths are empty?
   - Recommendation: Yes — `sme.detect-processes` accepts `--file-paths` as optional. If empty, it falls through to `--goal` keyword matching. This is sufficient for v1. If no matches from either, the step silently skips.

3. **Should `resolve-model gsd-sme-creator` be called in the refresh step or should it reuse the executor model?**
   - What we know: `create-sme.md` uses `gsd-sdk query resolve-model gsd-sme-creator --raw` to get the creator-specific model. The execute-phase orchestrator has `executor_model` in context.
   - What's unclear: Whether the refresh should use the creator model or the executor model.
   - Recommendation: Use `gsd-sdk query resolve-model gsd-sme-creator --raw` — the creator is a specialized agent that benefits from its configured model, separate from execution. This is the pattern established by `create-sme.md`.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 9 is workflow markdown changes and CJS structural tests only. All required infrastructure exists from prior phases. No external tools beyond the existing project SDK.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | CJS tests, SDK handlers | Yes | v22+ | — |
| gsd-sdk (built) | Workflow bash commands | Yes | in-repo | — |
| `sme.list` (SDK-01) | REFRESH-04 staleness | Yes (Phase 2) | — | — |
| `sme.detect-processes` (SDK-02) | REFRESH-01 | Yes (Phase 2) | — | — |
| `agents/gsd-sme-creator.md` | REFRESH-02 | Yes (Phase 3) | — | — |
| `gsd-sdk query commit` | REFRESH-03 | Yes (all phases) | — | — |
| `git rev-parse HEAD` | REFRESH-04 | Yes | any | — |

**All dependencies are satisfied.** Phase 9 has no blocking prerequisites.

---

## Validation Architecture

nyquist_validation is enabled (`workflow.nyquist_validation: true` in config). [VERIFIED: .planning/config.json]

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node.js built-in test runner (CJS `.test.cjs` files in `tests/`) |
| Config file | none — run with `node --test tests/sme-post-execution-refresh.test.cjs` |
| Quick run command | `node --test tests/sme-post-execution-refresh.test.cjs` |
| Full suite command | `node --test tests/*.test.cjs` |

Note: Structural tests for workflow `.md` files use `node:test` (CJS), NOT Vitest. Vitest is only for `sdk/src/` tests. [VERIFIED: tests/sme-gate-plan-phase.test.cjs, tests/sme-new-milestone-detect.test.cjs]

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REFRESH-01 | `execute-phase.md` contains `sme_refresh` or "SME Refresh" step | structural | `node --test tests/sme-post-execution-refresh.test.cjs` | No — Wave 0 |
| REFRESH-01 | `sme_refresh` step calls `sme.detect-processes` | structural | `node --test tests/sme-post-execution-refresh.test.cjs` | No — Wave 0 |
| REFRESH-02 | `sme_refresh` step references `gsd-sme-creator` | structural | `node --test tests/sme-post-execution-refresh.test.cjs` | No — Wave 0 |
| REFRESH-02 | `sme_refresh` step uses `UPDATE MODE` in creator prompt | structural | `node --test tests/sme-post-execution-refresh.test.cjs` | No — Wave 0 |
| REFRESH-03 | `sme_refresh` step commits files from `.planning/smes/` | structural | `node --test tests/sme-post-execution-refresh.test.cjs` | No — Wave 0 |
| REFRESH-04 | `plan-phase.md` step 12.6 checks `last_analyzed_commit` | structural | `node --test tests/sme-post-execution-refresh.test.cjs` | No — Wave 0 |
| REFRESH-04 | `plan-phase.md` step 12.6 uses `git rev-parse HEAD` or `CURRENT_HEAD` | structural | `node --test tests/sme-post-execution-refresh.test.cjs` | No — Wave 0 |
| REFRESH-04 | Staleness check is advisory (no `AskUserQuestion` in staleness section) | structural | `node --test tests/sme-post-execution-refresh.test.cjs` | No — Wave 0 |

### Sampling Rate

- **Per task commit:** `node --test tests/sme-post-execution-refresh.test.cjs`
- **Per wave merge:** `node --test tests/*.test.cjs`
- **Phase gate:** Full test suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/sme-post-execution-refresh.test.cjs` — covers REFRESH-01 through REFRESH-04 structural behaviors

*(Framework install: not needed — Node.js built-in test runner requires no install)*

---

## Security Domain

`security_enforcement` is not set to false in config — treating as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Internal developer tool, no auth surface |
| V3 Session Management | No | Agent sessions managed by SDK |
| V4 Access Control | No | No multi-user access model |
| V5 Input Validation | Yes | Process name validated by `sme.detect-processes` — only reads names from SME file registry, not user input; no path traversal possible [VERIFIED: sme.ts T-02-01] |
| V6 Cryptography | No | No cryptographic operations |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Process name from `sme.detect-processes` used as path segment | Tampering | `gsd-sme-creator` is invoked with process name as prompt text only, not as a filesystem path; the creator uses its own file discovery via grep [VERIFIED: gsd-sme-creator.md step discover_process_files] |
| `files_modified` paths from PLAN.md used in detect-processes | Tampering | PLAN.md is a developer-authored project file at project trust level (T-02-02 from Phase 2); `sme.detect-processes` uses these paths only for substring matching, not filesystem access [VERIFIED: sme.ts] |
| Commit step with `--files` containing SME paths | Tampering | `gsd-sdk query commit` uses paths constructed from `sme.detect-processes` output (registry-only filenames), not user-supplied input [VERIFIED: sme.ts T-02-01] |

**Established security decisions (from prior phases):**
- SME document content treated at project-file trust level (T-02-02) — no additional sanitization needed
- Process names use `[a-zA-Z0-9_-]+` validation enforced in SDK before path construction

---

## Sources

### Primary (HIGH confidence)

- `get-shit-done/workflows/execute-phase.md` — full step sequence confirmed; step positions after `update_project_md` and before `offer_next` [VERIFIED: repo, line 1539-1561]
- `get-shit-done/workflows/plan-phase.md` — step 12.6 SME Audit Gate content; `sme.list` already called (CONFIG-04); insertion point for staleness check [VERIFIED: repo, lines 1278-1423]
- `agents/gsd-sme-creator.md` — UPDATE_MODE prompt injection pattern; `## SME Creation Complete` return marker; sequential-safe spawning [VERIFIED: repo]
- `get-shit-done/workflows/create-sme.md` — UPDATE_MODE flow; creator spawn Task() pattern; `commit_and_complete` commit pattern [VERIFIED: repo]
- `sdk/src/query/sme.ts` — `smeList` returns `last_analyzed_commit` per SME (line 144); `smeDetectProcesses` accepts `--file-paths` and `--goal` [VERIFIED: repo]
- `tests/workflow-size-budget.test.cjs` — XL tier budget 1800 lines; `execute-phase` current count ~1622 (178 lines headroom) [VERIFIED: repo]
- `tests/sme-gate-plan-phase.test.cjs` — CJS structural test pattern for plan-phase gate [VERIFIED: repo]
- `tests/sme-new-milestone-detect.test.cjs` — CJS structural test pattern for new-milestone step [VERIFIED: repo]
- `.planning/config.json` — `workflow.use_sme_agents: false`, `workflow.nyquist_validation: true`, `commit_docs: false` [VERIFIED: repo]
- `.planning/REQUIREMENTS.md` — REFRESH-01 through REFRESH-04 requirement text [VERIFIED: repo]

### Secondary (MEDIUM confidence)

- `.planning/phases/06-plan-phase-gate/06-RESEARCH.md` — established SME gate patterns (config-gate, detect, spawn, route)
- `.planning/phases/08-new-milestone-process-detection/08-RESEARCH.md` — `frontmatter.merge` pattern for custom STATE.md fields; `use_sme_agents` guard pattern
- `get-shit-done/workflows/discuss-phase/sme-step.md` — lazy-load SME step pattern; python3 JSON parsing pattern

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all components are verified existing infrastructure from Phases 2-8
- Architecture: HIGH — execute-phase step ordering verified from direct file read; plan-phase step 12.6 content verified; budget headroom confirmed
- Pitfalls: HIGH — creator tmp dir race sourced from gsd-sme-creator.md; budget overflow sourced from workflow-size-budget.test.cjs; gaps-found branch sourced from execute-phase.md control flow

**Research date:** 2026-04-30
**Valid until:** 2026-05-30 (stable domain — internal workflow patterns and SDK conventions)
