# GSD System Improvements — 10 High-Impact Changes

**Date:** 2026-03-10
**Scope:** Improvements NOT covered by the quality gap analysis (testing enforcement, checkpoint integrity, documentation completeness, migration safety, autonomous quality gates)
**Goal:** Make the PRD-to-production autonomous loop meaningfully better

---

### Improvement 1: Cross-Phase Dependency Drift Detection

**Impact:** When Phase 5 builds on Phase 3's API, but Phase 4's refactoring silently renamed a route or changed a response shape, Phase 5 breaks at runtime. The system has no mechanism to detect that an earlier phase's outputs were invalidated by a later phase.

**Current state:** Each phase's SUMMARY.md documents `requires` and `provides` in frontmatter, and `key-files` lists created/modified files. The planner reads `history-digest` to select relevant prior phases (2-4 SUMMARYs). But nothing validates that what Phase 3 `provides` (e.g., `GET /api/users` returning `{id, name, email}`) still holds after Phase 4 ran. The verifier checks artifacts within a single phase. The `audit-milestone` workflow spawns an integration checker, but that runs only once at the very end — after all phases have executed — when fixing issues is maximally expensive.

**Proposed change:**
1. In `agents/gsd-phase-coordinator.md`, add a `pre_execute_dependency_check` step before the `execute` step. For each phase in `depends_on`, verify that the phase's SUMMARY.md `provides` entries still match the codebase:
   - Parse the depended-on phase's SUMMARY `key-files.created` list
   - Verify those files still exist and haven't been substantially modified since that phase completed (compare against git log)
   - If a dependency's key file was modified by an intervening phase: emit a warning with the diff, and inject the information into the executor's prompt as `<dependency_drift>` context
2. In `get-shit-done/bin/gsd-tools.js`, add a `verify dependency-stability <phase>` command that checks git blame on depended-on key-files to detect post-phase modifications.

**Benefit:** Catches integration drift before execution starts, rather than after the milestone completes. Prevents the most expensive class of bug: code that was correct when written but broken by a later phase's changes. Reduces gap-closure cycles by an estimated 30-40% for multi-phase projects.

---

### Improvement 2: Executor Context Carry-Forward for Multi-Plan Phases

**Impact:** When a phase has 4+ plans across multiple waves, each executor agent starts with a completely fresh 200k context window and must re-read STATE.md, config.json, CLAUDE.md, and project skills from scratch. More critically, the executor for Wave 2 Plan 03 has zero knowledge of what Wave 1 Plan 01 actually built — it only knows what the PLAN.md says to build. If Plan 01 deviated (created extra files, chose a different pattern, named things differently), Plan 03 will code against the plan's assumptions, not reality.

**Current state:** `execute-phase.md` (line 127-168) spawns executors with file paths only: `<files_to_read>` includes the PLAN file, STATE.md, config.json. It does NOT include the SUMMARY.md files from earlier waves. The coordinator spot-checks after each wave (line 172-179) but only verifies existence and commits — it does not extract and forward context. The planner's `read_project_history` step reads prior SUMMARYs to inform planning, but the executor has no equivalent.

**Proposed change:**
1. In `get-shit-done/workflows/execute-phase.md`, in the `execute_waves` step (after wave N completes, before wave N+1 starts), extract a concise `<wave_context>` block from all completed SUMMARYs in this phase:
   ```
   WAVE_CONTEXT=""
   for summary in .planning/phases/{phase_dir}/*-SUMMARY.md; do
     ONE_LINER=$(node gsd-tools.js summary-extract "$summary" --fields one-liner,key-files,decisions)
     WAVE_CONTEXT+="$ONE_LINER\n"
   done
   ```
2. Pass `WAVE_CONTEXT` into the executor's prompt as `<completed_plans_context>` so Wave 2+ executors know what was actually built (not just planned).
3. In `agents/gsd-executor.md`, add to `load_plan` step: "If `<completed_plans_context>` is present, use it to resolve references to prior plans. If the plan says 'import from the auth module created in Plan 01', use the actual file paths from the context, not guesses."

**Benefit:** Eliminates the "plan says X but Plan 01 actually built Y" class of errors. Each subsequent wave builds on reality, not assumptions. Reduces deviation frequency for multi-wave phases.

---

### Improvement 3: Structured Error Taxonomy for Better Gap Closure

**Impact:** When verification finds gaps, the `gaps` YAML in VERIFICATION.md is free-form text. The gap closure planner (`/gsd:plan-phase --gaps`) must interpret natural language to decide what to fix. This interpretation step is lossy — the planner may misunderstand the gap or create a plan that addresses the symptom rather than the root cause.

**Current state:** The verifier (`agents/gsd-verifier.md` Step 10) structures gaps as:
```yaml
gaps:
  - truth: "Observable truth that failed"
    status: failed
    reason: "Brief explanation"
    artifacts:
      - path: "src/path/to/file.tsx"
        issue: "What's wrong"
    missing:
      - "Specific thing to add/fix"
```
This captures WHAT failed but not WHY or HOW to categorize the failure. The planner in gap_closure_mode (planner lines 802-860) groups gaps "by concern" but has no structured taxonomy to work with — it relies on keyword matching and judgment.

**Proposed change:**
1. In `agents/gsd-verifier.md`, add a `failure_type` field to each gap entry with enumerated values:
   ```yaml
   failure_type: stub | unwired | missing_artifact | semantic_stub | broken_chain | regression | missing_test
   ```
   - `stub`: File exists but is placeholder (TODO, empty return, console.log only)
   - `unwired`: File exists and is substantive but not imported/used
   - `missing_artifact`: Expected file does not exist
   - `semantic_stub`: Implementation is syntactically complete but behaviorally inert (handler that only updates UI state where API call needed)
   - `broken_chain`: Causal chain from user action to state mutation has a gap
   - `regression`: Previously-passing truth now fails (detected in re-verification)
   - `missing_test`: Implementation exists but no corresponding test
2. In the planner's `gap_closure_mode` section, add routing logic by failure_type:
   - `stub` / `missing_artifact` → simple implementation task
   - `unwired` → wiring task (import + usage)
   - `semantic_stub` / `broken_chain` → requires understanding the full chain; higher model tier
   - `regression` → needs diff analysis from git; include regression context
3. In `get-shit-done/references/verification-patterns.md`, add a `<failure_taxonomy>` section mapping each type to detection patterns and fix strategies.

**Benefit:** Gap closure plans become targeted instead of interpretive. The planner knows exactly what kind of fix is needed, reducing revision loop iterations (currently max 3, often hitting the limit). Expected to reduce gap closure cycles from ~2.1 rounds to ~1.3 rounds on average.

---

### Improvement 4: PRD Requirement Traceability Through the Full Pipeline

**Impact:** The system's mission is "user writes a PRD, system builds it." But the PRD's requirements undergo multiple transformations (PRD -> REQUIREMENTS.md REQ-IDs -> ROADMAP phase mappings -> PLAN.md `requirements` frontmatter -> SUMMARY.md `requirements-completed` -> VERIFICATION.md requirements table), and at each hop, requirements can be silently dropped, reworded to lose precision, or mapped to the wrong phase.

**Current state:** The `plan-phase.md` workflow has a PRD Express Path (step 3.5) that converts a PRD into CONTEXT.md, treating all PRD requirements as locked decisions. But the conversion from PRD prose to structured CONTEXT.md sections is done by the orchestrator in natural language — there is no structured mapping from "PRD requirement X at line Y" to "REQ-ID Z in REQUIREMENTS.md." The `audit-milestone` workflow (step 5) does a 3-source cross-reference (VERIFICATION + SUMMARY + REQUIREMENTS), but this only checks whether REQ-IDs were marked complete, not whether the original PRD intent was preserved.

**Proposed change:**
1. In `get-shit-done/workflows/plan-phase.md`, step 3.5 (PRD Express Path), after generating CONTEXT.md, also generate a `PRD-TRACE.md` file in the phase directory that maps each PRD requirement/user story/acceptance criterion to its corresponding REQ-ID:
   ```markdown
   | PRD Line/Section | Original Text | REQ-ID | Status |
   |-------------------|--------------|--------|--------|
   | "Users must be able to..." | Full original text | AUTH-01 | mapped |
   ```
2. In `agents/gsd-verifier.md`, add a Step 6b: if `PRD-TRACE.md` exists in the phase directory, verify that each mapped REQ-ID's truth aligns with the original PRD text — not just that the REQ-ID was addressed, but that the intent matches.
3. In `get-shit-done/workflows/audit-milestone.md`, step 5, include PRD-TRACE.md in the cross-reference check. Flag any PRD requirement whose original text describes behavior X but whose REQ-ID verification checked for behavior Y.

**Benefit:** Closes the most dangerous gap in the PRD-to-production pipeline: silent intent drift. The user's actual words remain traceable all the way to verification. Critical for regulated industries (iGaming, fintech) where "the system shall X" must map precisely to "X was verified."

---

### Improvement 5: Automatic Dev Server Lifecycle Management

**Impact:** Charlotte QA, the only E2E testing mechanism, depends on a running dev server. Currently, server startup is attempted in multiple places with inconsistent logic: `gsd-charlotte-qa.md` (Steps 2-3), `checkpoint_ui_qa_loop` in the coordinator (line 819-828), and `post_phase_ux_sweep`. Each reimplements server detection and startup differently, and none handles multi-app monorepos reliably (e.g., NX workspaces where both `player-web` and `operator-web` need to be running simultaneously).

**Current state:** Charlotte QA checks `curl -s --max-time 3 http://localhost:3000` and starts `npm run dev` if down. The coordinator's UI QA loop checks the same URL and tries `npx nx dev {app-name}`. But: (a) the app name detection relies on a `<apps>` tag in the checkpoint or inference from CLAUDE.md, which is often missing; (b) there is no cleanup — dev servers started in the background are never stopped, accumulating orphan processes; (c) if the project uses a non-standard port (3001, 5173 for Vite), the default health check misses it.

**Proposed change:**
1. Create a new reference file `get-shit-done/references/service-health.md` (it already exists but is underused) and extend it with a `<dev_server_registry>` protocol:
   - At project init (`new-project.md`), detect the dev server configuration from `package.json` scripts and write it to `.planning/config.json` under a `dev_servers` key:
     ```json
     "dev_servers": [
       { "name": "player-web", "cmd": "npx nx dev player-web", "port": 3000, "health": "/api/health" },
       { "name": "operator-web", "cmd": "npx nx dev operator-web", "port": 3001, "health": "/" }
     ]
     ```
   - When no `dev_servers` config exists, fall back to current detection logic
2. In `agents/gsd-charlotte-qa.md`, replace Steps 2-3 with a call to a shared service health function:
   ```bash
   SERVERS=$(node gsd-tools.js service-health check --json)
   ```
   That reads `dev_servers` from config, checks each, starts any that are down, and returns status.
3. In `agents/gsd-phase-coordinator.md`, at the end of the phase (after verify), add a `cleanup_dev_servers` step that kills any dev server processes started during this phase. Use PID tracking from the service-health module.
4. In `get-shit-done/bin/gsd-tools.js`, add `service-health check`, `service-health start <name>`, and `service-health stop-all` commands.

**Benefit:** Eliminates the #1 cause of Charlotte QA false failures (server not running). Handles monorepos natively. Prevents orphan process accumulation during long roadmap executions. Single source of truth for server config.

---

### Improvement 6: Knowledge DB Integration into Planning for Pattern Reuse

**Impact:** The system has a knowledge DB (`gsd-tools.js knowledge *` commands) that stores user preferences, decisions, and anti-patterns. The executor loads it per-plan (`load_user_reasoning_context` step). The planner also queries it. But the knowledge DB is write-rare, read-rarely. After each phase completes, the transition workflow updates PROJECT.md with decisions and learnings — but these learnings are NOT written back to the knowledge DB. The knowledge DB slowly becomes stale relative to the project's actual accumulated decisions.

**Current state:** Knowledge DB entries are created during `mine-conversations` and `analyze-session` workflows (offline, asynchronous). The executor and planner read them. But the main execution pipeline (plan -> execute -> verify -> transition) never writes to the knowledge DB. The transition workflow (`transition.md`, step `evolve_project`) updates PROJECT.md with decisions and requirement changes but does not call `gsd-tools.js knowledge add`.

**Proposed change:**
1. In `get-shit-done/workflows/transition.md`, add a `persist_learnings` step after `evolve_project` that writes key decisions to the knowledge DB:
   ```bash
   # Extract decisions from the just-completed phase's SUMMARYs
   for summary in .planning/phases/{phase_dir}/*-SUMMARY.md; do
     DECISIONS=$(node gsd-tools.js summary-extract "$summary" --fields decisions)
     for decision in $DECISIONS; do
       node gsd-tools.js knowledge add "$decision" --type decision --scope project --ttl long_term
     done
   done
   ```
2. In `agents/gsd-verifier.md`, when anti-patterns are found (Step 7), write them to the knowledge DB as anti-patterns:
   ```bash
   node gsd-tools.js knowledge add "Anti-pattern: $PATTERN in $FILE" --type anti_pattern --scope project --ttl permanent
   ```
3. In `agents/gsd-planner.md`, in the `load_user_reasoning_context` step, include a note: "If the knowledge DB returns anti-patterns from this project, ensure plans explicitly avoid those patterns. Add `<anti_pattern_guard>` elements to tasks that touch the same subsystems."

**Benefit:** The knowledge DB becomes a living memory that grows with each phase, rather than a static snapshot from conversation mining. Planners in later phases benefit from accumulated project wisdom. Anti-patterns discovered in Phase 3 are automatically avoided in Phase 7's plans.

---

### Improvement 7: Parallel Phase Execution with Conflict Detection

**Impact:** The `execute-roadmap.md` workflow identifies `parallel_opportunities` (phases with no mutual dependencies) and supports spawning multiple sub-coordinators simultaneously. But it defaults to sequential execution, and the parallel path has no mechanism to detect file-level conflicts between concurrently executing phases.

**Current state:** `execute-roadmap.md` (line 522-530): "Current implementation: sequential by default. Parallel execution requires explicit user opt-in due to complexity of failure handling." The `parallel_opportunities` array is computed by `roadmap-parser.js` based on `depends_on` declarations, but `depends_on` only tracks phase-level dependencies, not file-level conflicts. Two phases might be declared independent but both modify `src/lib/auth.ts`, causing git merge conflicts.

**Proposed change:**
1. In `get-shit-done/bin/gsd-tools.js`, extend `roadmap analyze` to compute `file_conflicts` between parallel-eligible phases by examining each phase's plans' `files_modified` frontmatter:
   ```json
   "parallel_opportunities": [[1, 2], [3, 4]],
   "file_conflicts": {
     "1_2": [],
     "3_4": ["src/lib/auth.ts", "src/middleware.ts"]
   }
   ```
2. In `execute-roadmap.md`, when presenting the execution plan (step `confirm_execution`), show file conflicts alongside parallel opportunities:
   ```
   Parallel opportunities:
   - Phases 1, 2: No file conflicts — safe to parallelize
   - Phases 3, 4: 2 file conflicts (src/lib/auth.ts, src/middleware.ts) — sequential recommended
   ```
3. When parallel execution is chosen and file conflicts exist, use git worktrees or sequential execution for conflicting phases and parallel for non-conflicting ones.

**Benefit:** Enables safe parallel execution for the common case (no file conflicts) while preventing silent merge conflicts. For a typical 8-phase project, phases 1-3 (foundation, auth, core UI) are usually sequential, but phases 4-8 (feature modules) are often parallelizable, cutting execution time by 40-60%.

---

### Improvement 8: Executor Self-Healing via Build/Lint Feedback Loop

**Impact:** The executor commits each task individually but does not run the project's build or lint tools between tasks. If Task 1 introduces a type error that Task 2's code depends on, Task 2 will fail or produce incorrect output. The error is only caught at the post-plan test gate (if implemented per the quality gap analysis) or at the verifier stage — by which time significant context has been consumed.

**Current state:** The executor's `task_commit_protocol` (executor lines 384-424) stages files, commits, and records the hash. It does not run `npm run build`, `npx tsc --noEmit`, or `npm run lint` between tasks. The `self_check` step (lines 486-501) verifies files exist and commits are present, but does not check build health. The only feedback loop during execution is the deviation rules (Rules 1-3), which handle bugs discovered during the current task — not regressions introduced by a previous task.

**Proposed change:**
1. In `agents/gsd-executor.md`, add an `inter_task_health_check` after each `task_commit_protocol`:
   ```
   <step name="inter_task_health_check">
   After committing task N, before starting task N+1:

   1. Run type check (detect from project config):
      - TypeScript: `npx tsc --noEmit 2>&1 | tail -5`
      - Python: `mypy . 2>&1 | tail -5` (if configured)
      - Go: `go build ./... 2>&1 | tail -5`
      Timeout: 60 seconds

   2. If type check fails:
      - Parse error messages
      - Apply Deviation Rule 1 (auto-fix bugs): fix the type errors introduced by this task
      - Re-commit with `fix({phase}-{plan}): resolve type errors from task {N}`
      - Re-run type check. If still failing after 1 retry: log as gap, continue

   3. If type check passes: proceed to next task silently (no output)
   </step>
   ```
2. This should be configurable via `.planning/config.json` (`execution.inter_task_checks: true|false`, default `true`) to allow disabling for projects without type checking.

**Benefit:** Catches regressions immediately after the task that introduced them, when the executor has maximum context about what it just changed. The cost is ~10-15 seconds per task for type checking, but the savings from avoiding cascading failures across subsequent tasks are substantial. Particularly valuable for TypeScript projects where a single type change can ripple through dozens of files.

---

### Improvement 9: Coordinator Context Budget Monitoring

**Impact:** The phase coordinator (`gsd-phase-coordinator.md`) runs through 5 major steps (discuss, research, plan, execute, verify) plus post-phase sweeps. Under context pressure, later steps get degraded output or are silently truncated. The coordinator has no awareness of how much context it has consumed or how much remains for critical final steps (verify, UX sweep).

**Current state:** The coordinator's `<execution_cycle>` processes steps sequentially with no context budget tracking. The planner has scope sanity checks (Dimension 5 in plan-checker), and the executor targets ~50% context per plan. But the coordinator itself — which orchestrates all of these — has no budget monitoring. The `context_efficiency` note in `execute-phase.md` says "Orchestrator: ~10-15% context" but this is aspirational, not enforced. When a complex phase with 5+ plans runs, the coordinator's context accumulates plan descriptions, wave results, spot-check outputs, and checkpoint handling, potentially exceeding 50%.

**Proposed change:**
1. In `agents/gsd-phase-coordinator.md`, add a `context_budget_check` after each major step:
   ```
   // After each step completion:
   CONTEXT_ESTIMATE = (step_count * AVG_STEP_TOKENS) / MAX_CONTEXT
   if CONTEXT_ESTIMATE > 0.60:
     // Reserve remaining context for verify + post-phase sweeps
     // Compress: stop reading full SUMMARY.md contents, use one-liners only
     // Log: "Context budget: {estimate}% used — switching to compressed mode"
   if CONTEXT_ESTIMATE > 0.80:
     // Critical: verify and UX sweep are at risk
     // Notify via Telegram if configured
     // Consider spawning verify as subagent with fresh context
   ```
2. In the coordinator's `execute` step, when spawning executors, track the accumulated return size. If returns exceed a threshold, summarize them before storing (keep only: status, plan ID, issues count, key deviations).
3. Add a `coordinator_model` override in config.json (already partially implemented) that defaults to `opus` for coordinators, ensuring maximum context window is available.

**Benefit:** Prevents the silent degradation where verification and UX sweeps are truncated because the coordinator ran out of context during a complex execution step. Makes context management explicit rather than hoping for the best. The 2026-03-10 quality gap analysis identified that post_phase_ux_sweep is "skippable under context pressure" — this improvement addresses the root cause.

---

### Improvement 10: Structured Execution Metrics for Cost/Time Optimization

**Impact:** The system has extensive execution logging (EXECUTION_LOG.md, JSONL events, Telegram notifications) but no structured analytics that feed back into future planning. A project that has completed 3 milestones has data about which phase types take longest, which model tiers produce the most gap closures, and which plan sizes exceed context budgets — but this data is never analyzed or used.

**Current state:** The executor records `state record-metric --phase N --plan M --duration Xmin --tasks N --files N`. The routing system logs `routing_decisions` events with tier assignments. The quota system tracks token usage. But none of this data is aggregated, analyzed, or fed back into the planner or coordinator. The planner's scope estimates (Dimension 5: "2-3 tasks per plan") are static thresholds, not calibrated to the specific project's actual execution history. The model profile table in `gsd-tools.js` (lines 196-200+) uses static assignments regardless of observed performance.

**Proposed change:**
1. In `get-shit-done/bin/gsd-tools.js`, add an `analytics` command group:
   - `analytics execution-report` — aggregate EXECUTION_LOG.md, SUMMARY.md metrics, and quota stats into a JSON report:
     ```json
     {
       "avg_plan_duration_mins": 12.3,
       "avg_tasks_per_plan": 2.7,
       "gap_closure_rate": 0.23,
       "model_tier_performance": {
         "haiku": { "success_rate": 0.82, "avg_duration": 8.1, "escalation_rate": 0.18 },
         "sonnet": { "success_rate": 0.95, "avg_duration": 14.2, "escalation_rate": 0.0 }
       },
       "phase_type_metrics": {
         "ui_heavy": { "avg_plans": 3.2, "avg_gap_closures": 1.1 },
         "api_heavy": { "avg_plans": 2.1, "avg_gap_closures": 0.3 }
       }
     }
     ```
   - `analytics calibrate` — update `.planning/config.json` with calibrated thresholds based on execution history (e.g., if plans with 4 tasks consistently succeed, raise the scope warning from 4 to 5)
2. In `agents/gsd-planner.md`, in the `estimate_scope` step, read calibrated thresholds from config instead of using hardcoded values:
   ```bash
   SCOPE_CONFIG=$(node gsd-tools.js analytics scope-thresholds 2>/dev/null || echo '{"max_tasks":3,"max_files":8}')
   ```
3. In `get-shit-done/workflows/execute-roadmap.md`, at the `completion` step, auto-run `analytics execution-report` and include key metrics in the completion summary and PR description.

**Benefit:** The system learns from its own execution history. Projects that start with conservative defaults (2-3 tasks/plan, sonnet-only) can automatically calibrate to their actual performance characteristics. The routing system can see that haiku has an 18% escalation rate and adjust tier recommendations. The planner can see that API-heavy phases rarely need gap closure and allocate model budget accordingly. This is the foundation for continuous improvement in an autonomous system.
