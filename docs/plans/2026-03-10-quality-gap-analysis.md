# GSD Quality Gap Analysis

## Executive Summary

The GSD autonomous development workflow system has strong architectural bones -- goal-backward verification, multi-agent delegation, wave-based execution, and structured checkpoint protocols. However, a recent 11-phase execution (Phases 74-84 of an iGaming Responsible Gambling module) exposed systemic enforcement gaps: the planner's testing mandates exist as instructions but lack hard gates to prevent plans shipping without tests; Charlotte UI QA is fully wired in the coordinator's checkpoint handling code but depends on planners actually emitting `checkpoint:ui-qa` tasks, which they failed to do in 6/11 phases; PLAN.md creation was soft-verified (the fix to hard-verify is already in place); and checkpoint semantics ("complete" vs "passed") are muddled because the coordinator writes `CHECKPOINT.json` with `step_status` while the verifier writes `VERIFICATION.md` with a different `status` field, and no gate ties them together. The core problem is that quality controls exist as advisory text in agent prompts but are not enforced by hard gates -- the system trusts agents to follow instructions rather than verifying compliance at transition boundaries.

## Root Cause Analysis

### 1. Frontend Testing Enforcement

**Where it breaks:** `agents/gsd-planner.md` lines 216-254 (Testing Mandate section) and `agents/gsd-executor.md` lines 317-382 (test_task_handling)

**Why it breaks:** The planner has a "Testing Mandate" section that says "Every plan that produces user-facing behavior MUST include" a `tdd='true'` test task AND a `checkpoint:ui-qa` task. The validate_plan step (planner line 1276) even says "Also verify: plans with API endpoints have a `tdd='true'` task. If missing, add one." However, this is advisory text in the planner's prompt -- there is no programmatic gate that rejects a plan lacking test tasks. The planner is a subagent that may run under context pressure and skip the audit. The executor handles `tdd="true"` tasks by spawning `gsd-test-writer` (executor lines 317-382), but if the planner never created those tasks, the executor has nothing to trigger.

**Current behavior:** The planner MAY include `tdd="true"` tasks and `checkpoint:ui-qa` tasks based on the "Testing Mandate" section. The validate_plan step mentions checking for missing test tasks, but this is an inline instruction in the planner prompt, not a gate enforced by `gsd-tools.js`. In the 11-phase execution, plans were created without test tasks and without `checkpoint:ui-qa` tasks for UI-heavy phases, and nothing blocked execution.

**Required behavior:** Plan validation MUST be a hard gate: `gsd-tools.js verify plan-structure` should check (1) every plan with API endpoints or business logic has a `tdd="true"` task, (2) every plan that modifies `.tsx`/`.jsx`/`.vue`/`.svelte` files has a `checkpoint:ui-qa` task, and (3) the coordinator's pre-flight check rejects plans that fail this validation.

**Fix:**
1. In `gsd-tools.js`, extend the `verify plan-structure` command to check for test tasks and UI-QA checkpoints based on `files_modified` patterns. Return `{ valid: false, errors: ["missing_test_task", "missing_ui_qa_checkpoint"] }` when violations found.
2. In `agents/gsd-phase-coordinator.md`, in the `plan` step (line 561), after the `PLAN_COUNT` check, add a loop calling `gsd-tools.js verify plan-structure` for each plan and blocking execution if any plan fails.
3. In `agents/gsd-planner.md`, at the `validate_plan` step (line 1276), change "Also verify" to a hard check: read the output of `gsd-tools.js verify plan-structure` and fix violations before committing.

### 2. Backend Testing Enforcement

**Where it breaks:** `agents/gsd-executor.md` lines 317-382 (test_task_handling) and `agents/gsd-planner.md` lines 216-254 (Testing Mandate)

**Why it breaks:** The executor correctly handles `tdd="true"` tasks when they exist -- spawning `gsd-test-writer`, running tests, retrying once on failure, and recording results in SUMMARY.md. But there are two gaps: (a) no coverage threshold is enforced anywhere -- tests pass/fail but no gate says "coverage must be >80% for new files," and (b) the planner's test task inclusion is advisory (see issue 1). The verifier (`gsd-verifier.md` lines 330-358, Step 8b) runs the test suite and records failures as gaps, but only flags "no test suite found" as a warning, never a hard stop.

**Current behavior:** If a plan has `tdd="true"` tasks, the executor spawns test-writer and records results. If a plan lacks test tasks, nothing happens. The verifier runs the project's test suite at the end but treats no-tests as a warning. There are no coverage gates anywhere in the system.

**Required behavior:** (a) The executor should run the project's test suite after completing all tasks in a plan (not just TDD-tagged tasks) and fail if any tests break. (b) Coverage thresholds should be enforceable via `config.json` settings (e.g., `testing.coverage_threshold: 80`). (c) The verifier should hard-fail (not just warn) when a phase produces implementation files but no corresponding test files exist.

**Fix:**
1. In `agents/gsd-executor.md`, add a `post_plan_test_gate` step after `execute_tasks`: run the project's test command (from `package.json` or `deno.json`), and if tests fail, do NOT proceed to SUMMARY creation. Record as a blocking error.
2. In `.planning/config.json` template, add `testing.coverage_threshold` (default: 0, meaning disabled). When set, the executor runs coverage and fails if below threshold.
3. In `agents/gsd-verifier.md` Step 8b, change the "no test suite found" path from warning to `gaps_found` when the phase created implementation files (check `key-files` in SUMMARY.md for `.ts`, `.tsx`, `.py`, etc. but no corresponding `.test.` or `.spec.` files).

### 3. Charlotte E2E Enforcement

**Note:** GSD uses Charlotte exclusively for all UI/UX and E2E testing. There is no Playwright/Cypress — Charlotte (gsd-charlotte-qa) handles all browser-based validation locally.

**Where it breaks:** Three places in the coordinator (`agents/gsd-phase-coordinator.md`): the `checkpoint_ui_qa_loop` (line 806), the `post_phase_ux_sweep` (line 1011), and the `post_phase_e2e` (line 1047).

**Why it breaks:** The system has three mechanisms for UI/E2E testing:
1. **Inline checkpoint:ui-qa** -- triggered when the executor hits a `checkpoint:ui-qa` task in a plan. The coordinator runs the Charlotte 3-round QA loop.
2. **post_phase_ux_sweep** -- after all plans complete, scans SUMMARY.md for `.tsx`/`.jsx` files and auto-runs Charlotte if web UI was produced.
3. **post_phase_e2e** -- collects `e2e_flows` from plan frontmatters and runs Charlotte in `e2e` mode.

The problem is layered: (a) if the planner never emits `checkpoint:ui-qa` tasks, mechanism 1 never fires; (b) the `post_phase_ux_sweep` depends on the coordinator actually reaching that step -- under context pressure, the coordinator may skip or truncate; (c) `e2e_flows` in plan frontmatter is optional and newly added, so existing plans lack them.

**Current behavior:** Charlotte runs IF the planner includes `checkpoint:ui-qa` tasks OR the coordinator reaches `post_phase_ux_sweep`. Both are skippable under context pressure.

**Required behavior:** (a) The `post_phase_ux_sweep` should be a HARD GATE, not skippable. (b) The coordinator should ALWAYS run the UX sweep for web projects, not just when it finds `.tsx` in SUMMARY.md -- detect project type from `package.json`. (c) Charlotte E2E flows (from `e2e_flows` frontmatter) should block phase verification on failure.

**Fix:**
1. In `agents/gsd-phase-coordinator.md`, make `post_phase_ux_sweep` non-skippable: detect web project via `package.json` (React/Next.js/Vue/Svelte dependencies), ALWAYS run the sweep for web projects. Move it BEFORE `verify`.
2. In `agents/gsd-verifier.md`, add a Step 8c: if phase SUMMARY.md lists `.tsx`/`.jsx` files in key-files but no Charlotte QA was recorded, mark as `gaps_found`.
3. In the `execute-roadmap.md` completion quality gates, confirm Charlotte E2E sweep is included.

### 4. PLAN.md Enforcement

**Where it breaks:** `agents/gsd-phase-coordinator.md` lines 526-587 (plan step)

**Why it breaks:** In the original version, the coordinator could plan inline "in context" instead of spawning the planner subagent. This was fixed: the current coordinator says "Spawn gsd-planner explicitly -- do NOT plan inline in context" (line 537) and has a hard verification after the planner returns (lines 561-569): `PLAN_COUNT=$(ls ... | wc -l)` and "If PLAN_COUNT == 0: CRITICAL -- do NOT proceed to execute."

**Current behavior:** The fix is correct and complete. The coordinator spawns the planner, then hard-verifies PLAN.md files exist on disk. If zero plans found, it returns failure state. This prevents the 6/11 PLAN.md-missing failure mode.

**Required behavior:** The existing fix is sufficient. One additional hardening: the pre-flight check in the `execute` step (line 592-596) also checks `PLAN_COUNT`. This double-check is good.

**Fix:** No change needed. The fix is already implemented. Confirm it stays -- do not allow future refactors to weaken the hard gate.

### 5. Migration/Database Safety

**Where it breaks:** Nowhere in the GSD source -- GSD does not generate migration timestamps. This is a downstream issue: the executor creates migration files using whatever timestamp the migration tool (Prisma, Drizzle, Supabase, etc.) generates at runtime.

**Why it breaks:** When two phases execute concurrently (or in rapid sequence), their migration tools generate timestamps based on wall-clock time. If two migrations are created within the same second (or if the tool uses a format like `YYYYMMDDHHMMSS`), timestamps collide. Additionally, alphabetical ordering of migration files may not match logical dependency order when phases produce independent but order-dependent schema changes.

**Current behavior:** GSD has no migration-specific logic. The `references/verification-patterns.md` has a "Database Migrations" checklist (line 640-653) covering column names, RLS, indexes, etc., but nothing about timestamp uniqueness or ordering.

**Required behavior:** (a) Migration files should incorporate phase number to guarantee uniqueness across phases (e.g., `{timestamp}_{phase_number}_{name}.sql`). (b) The verifier should detect migration file conflicts (same timestamp, wrong alphabetical order). (c) The executor should add a brief sleep or use phase-number-based prefixes when creating migrations across sequential plans.

**Fix:**
1. In `references/verification-patterns.md`, add a `<database_migration_safety>` section with: "When creating migrations, prefix the migration name with the plan identifier (e.g., `p74_01_create_limits_table`) to guarantee uniqueness across concurrent phases."
2. In `agents/gsd-executor.md`, add to the `task_commit_protocol` pre-commit scan: "Migration timestamp check: if this task created a migration file, verify no other migration file in the directory has the same timestamp. If conflict detected, regenerate with a 1-second offset."
3. In `agents/gsd-verifier.md`, add to Step 7 anti-patterns: detect duplicate migration timestamps across all migration files in the project.

### 6. Checkpoint Integrity

**Where it breaks:** `agents/gsd-phase-coordinator.md` lines 1180-1202 (checkpoint_protocol) and lines 1083-1148 (verify step)

**Why it breaks:** There are two separate checkpoint concepts conflated in the system:

1. **CHECKPOINT.json** -- written by the coordinator after each step (discuss, research, plan, execute, verify). Contains `step_status` values: "complete", "skipped", "gray_areas_identified", "failed". The `resume_from` field tells a restarted coordinator where to pick up.

2. **VERIFICATION.md** -- written by the verifier. Contains `status` values: "passed", "gaps_found", "human_needed". This is the authoritative judgment of whether the phase achieved its goal.

The confusion: "complete" in CHECKPOINT.json means "step finished executing" (regardless of outcome), while "passed" in VERIFICATION.md means "all must-haves verified." In the observed issue, Phase 80 had CHECKPOINT.json showing `last_step: "execute"` with `resume_from: "verify"` but was treated as done -- because the coordinator checks `step_status: "complete"` and moves on, never reaching the `verify` step.

**Current behavior:** The coordinator writes CHECKPOINT.json with step-level status. The verifier writes VERIFICATION.md with goal-level status. There is no gate preventing a phase from being marked "done" in ROADMAP.md without a VERIFICATION.md with `status: passed`.

**Required behavior:** The `update_roadmap` step in `execute-phase.md` (line 443) calls `gsd-tools.js phase complete`. This command should REQUIRE that VERIFICATION.md exists AND has `status: passed` before marking the phase complete. Without this, a phase can be "completed" (all plans executed) but not "verified" (goal achieved).

**Fix:**
1. In `gsd-tools.js`, modify the `phase complete` command to check for VERIFICATION.md with `status: passed` before allowing completion. If VERIFICATION.md is missing or has `gaps_found`, refuse to complete and return an error.
2. In `agents/gsd-phase-coordinator.md`, standardize the semantics: CHECKPOINT.json `step_status` should ONLY be "complete" (step ran), "skipped" (step not needed), or "failed" (step errored). The `verify` step's `step_status: "complete"` means the verifier ran -- the outcome is in VERIFICATION.md `status`.
3. In `execute-roadmap.md`, the `verify_phase_goal` step (line 375) correctly gates on VERIFICATION.md status. Ensure this step is never skipped.

### 7. Documentation Completeness

**Where it breaks:** `agents/gsd-executor.md` lines 426-501 (summary_creation) and `agents/gsd-phase-coordinator.md` lines 784-803 (spot-check)

**Why it breaks:** The executor creates SUMMARY.md after all tasks complete, and the coordinator spot-checks it (verifies first 2 files exist, checks git commits, checks for Self-Check: FAILED). But there is no definitive list of "what MUST exist in a phase directory before it can be considered complete." Phase 83 (21 files, 212 tests) had ONLY a CHECKPOINT.json -- meaning the executor either crashed before creating SUMMARY.md, or the coordinator treated the checkpoint as sufficient.

**Current behavior:** The executor creates SUMMARY.md as part of its normal flow. The coordinator spot-checks it. But if the executor crashes mid-execution, the coordinator may have a CHECKPOINT.json showing "execute: in_progress" and either retry or skip. The required artifacts for phase completion are implicit (scattered across agent prompts), not explicit.

**Required behavior:** A phase directory is complete ONLY when it contains:
- At least one `*-PLAN.md` file
- A matching `*-SUMMARY.md` for every PLAN.md
- A `*-VERIFICATION.md` with `status: passed`
- A `CHECKPOINT.json` with `last_step: "verify"` and `step_status: "complete"`

**Fix:**
1. In `gsd-tools.js`, add a `verify phase-completeness <phase>` command (the grep at line 85 shows it may already exist but needs verification) that checks all four required artifacts. Return `{ complete: false, missing: ["SUMMARY for plan 03", "VERIFICATION.md"] }` if any are missing.
2. In `agents/gsd-phase-coordinator.md`, before returning success state, call `gsd-tools.js verify phase-completeness`. Hard-stop if any required artifact is missing.
3. In `execute-roadmap.md`, the `update_roadmap` step should call `verify phase-completeness` as a pre-condition to `phase complete`.

### 8. Autonomous Quality Gates

**Where it breaks:** Throughout the system -- quality gates exist as advisory text rather than programmatic enforcement.

**Why it breaks:** The GSD system uses markdown prompt files to instruct agents. These prompts contain "MUST" and "CRITICAL" language, but agents under context pressure can skip steps. The system lacks hard programmatic gates at agent boundaries (coordinator -> executor, executor -> verifier, verifier -> roadmap update).

**Current behavior:** Soft checks that depend on agents following instructions:
- Planner SHOULD include test tasks (soft -- no programmatic check)
- Executor SHOULD run tests (soft -- only TDD-tagged tasks trigger it)
- Coordinator SHOULD run Charlotte (soft -- depends on checkpoint:ui-qa tasks existing)
- Verifier SHOULD run test suite (soft -- treats no-tests as warning)
- Phase SHOULD have VERIFICATION.md (soft -- coordinator returns success based on step status)

Hard checks that exist and work:
- PLAN.md must exist on disk (coordinator hard-checks PLAN_COUNT)
- Pre-flight PLAN.md check before execute (coordinator hard-checks)
- Branch guard (execute-roadmap blocks main branch)
- Pre-PR quality gates in execute-roadmap (lint, type-check, tests, build -- run twice)

**Required behavior:** Every quality dimension should have a programmatic gate enforced by `gsd-tools.js`, not by agent prompt compliance.

**Fix:** See "New Quality Gates to Add" section below.

## Recommended Changes by Priority

### P0 -- Blocking Quality Issues (implement immediately)

1. **Hard gate: plan validation** -- `gsd-tools.js verify plan-structure` must check for test tasks and UI-QA checkpoints. Coordinator must block on validation failure.
   - File: `get-shit-done/bin/gsd-tools.js` (extend `verify plan-structure`)
   - File: `agents/gsd-phase-coordinator.md` (add validation call in `plan` step after PLAN_COUNT check)

2. **Hard gate: phase completion requires VERIFICATION.md** -- `gsd-tools.js phase complete` must refuse without `status: passed` in VERIFICATION.md.
   - File: `get-shit-done/bin/gsd-tools.js` (modify `phase complete` command)
   - File: `agents/gsd-phase-coordinator.md` (no change needed -- already calls `phase complete`)

3. **Hard gate: post-plan test suite execution** -- Executor must run the project's test suite after completing all tasks and block SUMMARY creation on failure.
   - File: `agents/gsd-executor.md` (add `post_plan_test_gate` between `execute_tasks` and `summary_creation`)

4. **Hard gate: post-phase UX sweep is mandatory for web projects** -- Not skippable under context pressure.
   - File: `agents/gsd-phase-coordinator.md` (make `post_phase_ux_sweep` unconditional for web projects; add project-type detection)

### P1 -- High Impact Quality Improvements

5. **Migration timestamp safety** -- Executor detects and resolves timestamp conflicts; verifier checks for duplicates.
   - File: `agents/gsd-executor.md` (add to `task_commit_protocol`)
   - File: `agents/gsd-verifier.md` (add to Step 7)
   - File: `get-shit-done/references/verification-patterns.md` (add migration safety section)

6. **Phase completeness check** -- `gsd-tools.js verify phase-completeness` enforces required artifact list.
   - File: `get-shit-done/bin/gsd-tools.js` (add or extend command)
   - File: `agents/gsd-phase-coordinator.md` (call before returning success)

7. **Charlotte E2E enforcement** -- Verifier checks that Charlotte ran for any phase that produced UI files.
   - File: `agents/gsd-verifier.md` (add Step 8c: UI files without Charlotte QA = gaps_found)
   - File: `get-shit-done/workflows/execute-roadmap.md` (confirm Charlotte E2E sweep in pre-PR gates)

8. **Coverage threshold support** -- Optional coverage enforcement via config.
   - File: `get-shit-done/templates/config.json` (add `testing.coverage_threshold`)
   - File: `agents/gsd-executor.md` (read config, run coverage after tests)

### P2 -- Process Improvements

9. **Standardize checkpoint semantics** -- Document that CHECKPOINT.json `step_status` is execution status, VERIFICATION.md `status` is outcome status.
   - File: `agents/gsd-phase-coordinator.md` (add explicit documentation in `checkpoint_protocol`)

10. **Branch enforcement in phase coordinator** -- The coordinator does not create branches. The `execute-phase.md` workflow has branch guards, but the coordinator (spawned by execute-roadmap) inherits whatever branch exists.
    - File: `get-shit-done/workflows/execute-roadmap.md` (already has branch_guard -- confirm it fires before any phase execution)

11. **Verifier hard-fail on no-tests** -- Change from warning to `gaps_found` when implementation exists without tests.
    - File: `agents/gsd-verifier.md` (Step 8b, change warning path)

## New Quality Gates to Add

### Gate 1: Plan Validation Gate

**Where:** `agents/gsd-phase-coordinator.md`, `plan` step, after `PLAN_COUNT` check (line 567)

**What it checks:**
- Every plan with `files_modified` containing `.tsx`/`.jsx`/`.vue`/`.svelte` has a `checkpoint:ui-qa` task
- Every plan with API endpoints (files matching `route.ts`, `api/`, `functions/`) has a `tdd="true"` task
- Every plan has `requirements` field populated (if phase has requirements)
- `must_haves` frontmatter is non-empty

**What happens on failure:** Hard stop. Return `{ status: "failed", step: "plan", reason: "Plan validation failed: {details}" }`. The coordinator does not proceed to execute.

**Example implementation (coordinator prompt addition after PLAN_COUNT check):**
```bash
for plan in .planning/phases/{phase_dir}/*-PLAN.md; do
  VALIDATION=$(node ~/.claude/get-shit-done/bin/gsd-tools.js verify plan-structure "$plan")
  VALID=$(echo "$VALIDATION" | jq -r '.valid')
  if [ "$VALID" = "false" ]; then
    ERRORS=$(echo "$VALIDATION" | jq -r '.errors | join(", ")')
    # HARD STOP
    return { status: "failed", step: "plan", reason: "Plan validation failed for $plan: $ERRORS" }
  fi
done
```

### Gate 2: Post-Plan Test Gate

**Where:** `agents/gsd-executor.md`, new step between `execute_tasks` and `summary_creation`

**What it checks:**
- Run project test suite (detected from package.json `scripts.test` or `deno.json` `tasks.test`)
- All tests pass (exit code 0)
- No test regressions (new test failures vs baseline)

**What happens on failure:** Hard stop. Do NOT create SUMMARY.md. Return failure to coordinator with test output.

**Example implementation (executor prompt addition):**
```
<step name="post_plan_test_gate">
After all tasks complete, before creating SUMMARY.md:

1. Detect test command:
   - package.json: scripts.test or scripts["test:ci"]
   - deno.json: tasks.test or tasks["test:ci"]

2. Run tests with timeout:
   timeout 300 {TEST_CMD} 2>&1
   TEST_EXIT=$?

3. If TEST_EXIT != 0:
   Record failing tests. Do NOT proceed to summary_creation.
   Return: "PLAN BLOCKED: {N} tests failing after execution. Fix required."

4. If TEST_EXIT == 0: Proceed to summary_creation.
</step>
```

### Gate 3: Phase Completeness Gate

**Where:** `agents/gsd-phase-coordinator.md`, before returning success state (after verify step)

**What it checks:**
- Every PLAN.md has a matching SUMMARY.md
- VERIFICATION.md exists with `status: passed`
- CHECKPOINT.json has `last_step: verify`
- No SUMMARY.md has `## Self-Check: FAILED`

**What happens on failure:** Hard stop. Return `{ status: "failed", reason: "Phase incomplete: {missing}" }`.

**Example implementation:**
```bash
COMPLETENESS=$(node ~/.claude/get-shit-done/bin/gsd-tools.js verify phase-completeness {phase_number})
IS_COMPLETE=$(echo "$COMPLETENESS" | jq -r '.complete')
if [ "$IS_COMPLETE" = "false" ]; then
  MISSING=$(echo "$COMPLETENESS" | jq -r '.missing | join(", ")')
  return { status: "failed", reason: "Phase incomplete: $MISSING" }
fi
```

### Gate 4: Web Project UX Sweep Gate

**Where:** `agents/gsd-phase-coordinator.md`, `post_phase_ux_sweep` step (line 1011)

**What it checks:**
- Detects web project (presence of `package.json` with react/next/vue/svelte/angular dependencies, or `.tsx`/`.jsx` files in SUMMARY key-files)
- Runs Charlotte UX audit on all pages built/modified in this phase
- Critical/high severity issues block phase completion

**What happens on failure:** Charlotte issues with severity critical or high prevent the phase from proceeding to verify. Fix subagent must resolve them first.

**Example implementation (make unconditional):**
Change the current conditional logic:
```
// BEFORE: "If any found: this phase produced web UI"
// AFTER: Always check project type
IS_WEB=$(jq -e '.dependencies.react // .dependencies.next // .dependencies.vue // .dependencies.svelte' package.json 2>/dev/null && echo true || echo false)
if [ "$IS_WEB" = "true" ]; then
  # Run post_phase_ux_sweep (existing logic)
fi
```

### Gate 5: Migration Conflict Gate

**Where:** `agents/gsd-executor.md`, `task_commit_protocol` (before committing tasks that include migration files)

**What it checks:**
- No two migration files in the project have the same timestamp
- Migration files are in correct alphabetical/chronological order relative to their logical dependencies

**What happens on failure:** Warning with auto-fix. Regenerate migration with offset timestamp. If auto-fix fails, block commit and report.

## Testing Strategy Recommendations

### Backend Testing (per phase)

| Phase Type | Testing Action | Who Does It | Gate Type |
|------------|---------------|-------------|-----------|
| API/business logic | Planner includes `tdd="true"` tasks | gsd-planner | Hard (plan validation gate) |
| API/business logic | Executor runs test-writer | gsd-executor | Auto (tdd task triggers it) |
| Any implementation | Executor runs full test suite post-plan | gsd-executor | Hard (post-plan test gate) |
| Database/schema | Verifier checks migration safety | gsd-verifier | Hard (anti-pattern scan) |
| Any implementation | Verifier runs test suite | gsd-verifier | Hard (gaps_found if failing) |

### Frontend Testing (per phase)

| Phase Type | Testing Action | Who Does It | Gate Type |
|------------|---------------|-------------|-----------|
| Web UI creation | Planner includes `checkpoint:ui-qa` | gsd-planner | Hard (plan validation gate) |
| Web UI creation | Coordinator runs Charlotte QA loop | gsd-phase-coordinator | Auto (checkpoint triggers it) |
| Web UI (any) | Coordinator runs post-phase UX sweep | gsd-phase-coordinator | Hard (web project gate) |
| Component tests | Executor runs unit tests for components | gsd-executor | Hard (post-plan test gate) |

### E2E Testing (per phase)

| Phase Type | Testing Action | Who Does It | Gate Type |
|------------|---------------|-------------|-----------|
| Full user journey | Planner adds `e2e_flows` to frontmatter | gsd-planner | Soft (optional but encouraged) |
| Full user journey | Coordinator runs Charlotte E2E mode | gsd-phase-coordinator | Auto (e2e_flows triggers it) |
| UI files produced | Verifier checks Charlotte QA was run | gsd-verifier | Hard (gaps_found if skipped) |
| Pre-PR (roadmap complete) | Execute-roadmap runs full check suite | execute-roadmap.md | Hard (blocks PR) |

### Quality Gate Summary (ordered by execution sequence)

```
PLAN STEP:
  [HARD] Plan validation: test tasks exist, ui-qa checkpoints present, must_haves non-empty
    -> Block: refuse to execute without valid plans

EXECUTE STEP (per plan):
  [AUTO] TDD tasks trigger test-writer
  [HARD] Post-plan test suite: all tests must pass before SUMMARY creation
    -> Block: no SUMMARY = plan considered failed

POST-EXECUTION (per phase):
  [HARD] Post-phase UX sweep: Charlotte audits all web UI (web projects only)
    -> Block: critical/high issues must be fixed
  [AUTO] Post-phase E2E: Charlotte runs e2e_flows from frontmatter
    -> Block: critical flow failures create gaps

VERIFY STEP:
  [HARD] Verifier runs test suite: failures = gaps_found
  [HARD] Verifier checks Charlotte ran for UI phases: skipped = gaps_found
  [HARD] Verifier checks no-tests: implementation without tests = gaps_found
  [HARD] Phase completeness: PLAN + SUMMARY + VERIFICATION all present

ROADMAP UPDATE:
  [HARD] phase complete requires VERIFICATION.md status: passed
    -> Block: cannot mark phase done without verification
```
