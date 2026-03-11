# Roadmap: GSD Enhancements

## Milestones

- ✅ **v1.9.0 GSD Enhancements** — Phases 1-14 (shipped 2026-02-19)
- ✅ **v1.9.1 Upstream Sync** — Phases 18-20 (completed 2026-02-19)
- ✅ **v1.10.0 Autonomous Phase Discussion** — Phases 21-25, 33 (shipped 2026-02-21)
- ✅ **v1.11.0 System Hardening** — Phases 26-30 (completed 2026-02-20)
  - 26: Telegram MCP Reliability · 27: Knowledge Quality · 28: Compression Observability · 29: Session Fix · 30: Milestone Archival
- ✅ **v1.12.0 Autonomous Quality & Flow** — Phases 34-40 (completed 2026-03-11)
  - 34: Checkpoint & Plan-Structure Gates · 35: Test & Coverage Enforcement · 36: Migration Safety & Error Taxonomy
  - 37: PRD Traceability & Flow Context · 38: Dev Server Lifecycle & Knowledge Feedback
  - 39: Execution Intelligence · 40: Observability & Analytics
- 🚧 **v1.13.0 Product Discovery & Docs Automation** — Phases 41-43 (in progress)
  - 41: gsd:prd Workflow · 42: Milestone PRD Integration · 43: Docs Automation

## Phases

<details>
<summary>✅ v1.9.0 GSD Enhancements (Phases 1-14) — SHIPPED 2026-02-19</summary>

- [x] Phase 1: Auto Mode Foundation (9/9 plans) — completed 2026-02-16
- [x] Phase 2: Auto Mode Refinement (6/6 plans) — completed 2026-02-16
- [x] Phase 3: Knowledge System Foundation (5/5 plans) — completed 2026-02-16
- [x] Phase 4: Knowledge Extraction & Hooks (6/6 plans) — completed 2026-02-16
- [x] Phase 5: Knowledge Permissions & Safety (6/6 plans) — completed 2026-02-16
- [x] Phase 6: Autonomous Execution Core (6/6 plans) — completed 2026-02-16
- [x] Phase 7: Autonomous Execution Optimization (6/6 plans) — completed 2026-02-16
- [x] Phase 8: Notifications & Observability (8/8 plans) — completed 2026-02-16
- [x] Phase 8.1: Telegram MCP Server (6/6 plans) — completed 2026-02-16
- [x] Phase 9: Doc Compression Hooks (5/5 plans) — completed 2026-02-17
- [x] Phase 10: GSD Installation System (4/4 plans) — completed 2026-02-17
- [x] Phase 10.1: Multi-Instance MCP Safety (4/4 plans) — completed 2026-02-17
- [x] Phase 11: Session-End Knowledge Extraction (4/4 plans) — completed 2026-02-17
- [x] Phase 12: Historical Conversation Mining (3/3 plans) — completed 2026-02-18
- [x] Phase 13: Cross-Phase Integration Fixes (1/1 plans) — completed 2026-02-18
- [x] Phase 14: Telegram MCP Audit & Rework (6/6 plans) — completed 2026-02-18

Full details: `.planning/milestones/v1.9.0-ROADMAP.md`

</details>

<details>
<summary>✅ v1.9.1 Upstream Sync (Phases 18-20) — COMPLETE 2026-02-19</summary>

**Milestone Goal:** Review glittercowboy/get-shit-done upstream commits and port the most valuable improvements into this fork without breaking fork-specific features (auto routing, knowledge system, Telegram MCP, autonomous execution).

#### Phase 18: Upstream Audit — COMPLETE
**Goal**: Developer can see exactly what upstream has added since the fork diverged, with every change categorized and evaluated for portability
**Depends on**: Nothing (first phase of milestone)
**Requirements**: AUDT-01, AUDT-02
**Plans**: 1/1

Plans:
- [x] 18-01: Fetch upstream, compare commit history, produce UPSTREAM-DIFF.md — completed 2026-02-19

#### Phase 19: Bug Fixes & Context Window Management — COMPLETE
**Goal**: All upstream stability fixes and context window improvements are running in the fork with no regressions to existing fork-specific features
**Depends on**: Phase 18
**Requirements**: BUGF-01, BUGF-02, CTXT-01
**Plans**: 2/2

Plans:
- [x] 19-01: Port upstream bug fixes to shared code paths — completed 2026-02-19
- [x] 19-02: Port upstream context window management improvements — completed 2026-02-19

#### Phase 20: Git Branching & Autonomous Execution — COMPLETE
**Goal**: GSD creates feature branches at phase start and any compatible upstream execution improvements are integrated without breaking the fork's sub-coordinator design
**Depends on**: Phase 19
**Requirements**: GIT-01, GIT-02, EXEC-01, EXEC-02
**Plans**: 2/2

Plans:
- [x] 20-01: Implement early git branching at phase start — completed 2026-02-19
- [x] 20-02: Port compatible upstream autonomous execution improvements — completed 2026-02-19

</details>

<details>
<summary>✅ v1.10.0 Autonomous Phase Discussion (Phases 21-25, 33) — SHIPPED 2026-02-21</summary>

- [x] Phase 21: Knowledge Global Migration (3/3 plans) — completed 2026-02-19
- [x] Phase 22: Discuss Step & Meta-Answerer (4/4 plans) — completed 2026-02-19
- [x] Phase 23: Telegram Escalation (2/2 plans) — completed 2026-02-19
- [x] Phase 24: Telegram Notifications (4/4 plans) — completed 2026-02-19
- [x] Phase 25: End-to-End Validation (4/4 plans) — completed 2026-02-19
- [x] Phase 33: v1.10.0 Tech Debt Closure (2/2 plans) — completed 2026-02-21

Full details: `.planning/milestones/v1.10.0-ROADMAP.md`

</details>

<details>
<summary>✅ v1.11.0 System Hardening (Phases 26-32) — COMPLETE 2026-02-21</summary>

#### Phase 26: Telegram MCP Reliability
**Goal**: Fix three silent failure modes in the Telegram MCP daemon that cause polling callers to always wait full timeouts, questions to be lost on daemon restart, and timed-out questions to disappear without user notification
**Depends on**: Phase 25 (validation complete)
**Requirements**: TREL-01, TREL-02, TREL-03
**Success Criteria** (what must be TRUE):
  1. `check_question_answers` with `wait_seconds` wakes immediately when an answer arrives — confirmed by timing a reply that arrives before the timeout
  2. Restarting the Telegram daemon while a question is pending restores the question state and the next `check_question_answers` poll returns it as still-pending
  3. When a question times out, a message appears in the Telegram thread ("Question timed out after N minutes") before the question is removed from internal state
**Plans**: 3 plans

Plans:
- [x] 26-01: Fix EventEmitter glob listener — add `anyAnswer` event to `QuestionService.deliverAnswer()`, replace `once('answer:*')` with `once('anyAnswer')` in `daemon/index.ts`
- [x] 26-02: Daemon restart question persistence — serialize `questions` map to `~/.claude/knowledge/question-state.jsonl` on every `ask()`/`deliverAnswer()`, restore on startup in `daemon/index.ts`
- [x] 26-03: Timeout notification — send thread message before `cleanUpQuestion()` fires, with DM-mode fallback via `sendToGroup()`

#### Phase 27: Knowledge System Quality
**Goal**: Close three gaps in the knowledge pipeline: near-duplicate entries accumulating due to skipped embedding dedup, meta-answerer escalating to Telegram on questions it could answer with broader queries, and no mechanism to prune stale low-utility entries
**Depends on**: Phase 26
**Requirements**: KQUAL-01, KQUAL-02, KQUAL-03
**Success Criteria** (what must be TRUE):
  1. Writing two semantically identical but differently-worded entries to the knowledge DB results in only one entry being stored (embedding similarity dedup fires at write time)
  2. The meta-answerer runs a `--type decision` query and a keyword-broadened query before assigning confidence 0.0 — reducing unnecessary Telegram escalations on sparse KB
  3. Running `gsd-tools knowledge prune` reports entries deleted by the staleness rules, and the command runs automatically when the DB exceeds 10MB
**Plans**: 3 plans

Plans:
- [x] 27-01: Stage-3 embedding dedup — call `generateEmbeddingCached()` with `Promise.race` 2s timeout in `knowledge-writer.js` before `checkDuplicate()`, pass result as third argument — completed 2026-02-20
- [x] 27-02: Meta-answerer multi-pass fallback — add `--type decision` pass and keyword-broadened pass in `agents/gsd-meta-answerer.md` before conceding confidence 0.0 — completed 2026-02-20
- [x] 27-03: Knowledge DB pruning — add `pruneStaleEntries()` to `knowledge-lifecycle.js`, `knowledge prune [--dry-run]` CLI command, auto-trigger at 10MB from `knowledge-checkpoint.js` — completed 2026-02-20

#### Phase 28: Compression & Observability
**Goal**: Make the doc compression pipeline actually observable — write the metrics it was designed to track, measure token reduction instead of char reduction, and add query-context-aware paragraph scoring to improve coverage on long prose files
**Depends on**: Phase 26
**Requirements**: COBS-01, COBS-02, COBS-03
**Success Criteria** (what must be TRUE):
  1. After doc compression runs, `gsd-tools compress metrics` returns real data (timestamps, files, reduction percentages) instead of "No compression metrics yet"
  2. The metrics output includes `originalTokensEst` and `compressedTokensEst` alongside char counts, calculated via `Math.ceil(length / 4)`
  3. When a query context string is available in the hook input, `HeaderExtractor` scores paragraphs by term overlap and selects the highest-scoring ones rather than always taking the first 300 chars per section
**Plans**: 3 plans

Plans:
- [x] 28-01: Write compression metrics JSONL — add `fs.appendFileSync` to `compression-metrics.jsonl` after `recordSuccess()` in `doc-compression-hook.js` with `{timestamp, file, originalChars, compressedChars, reductionPercent}`
- [x] 28-02: Token-based metrics — add `estimateTokens(text)` helper, log `originalTokensEst`/`compressedTokensEst` in metrics JSONL and `compress metrics` CLI output
- [x] 28-03: Semantic paragraph scoring — add `selectiveExtract(content, queryContext)` to `header-extractor.js` scoring paragraphs by term overlap; fall back to structural extraction when no query context

#### Phase 29: Session Extraction Fix
**Goal**: Fix the session-end knowledge extraction hook so it actually fires when Claude Code sessions end — currently wired to SIGTERM which Claude Code does not send, meaning the entire Phase 11/12 session extraction pipeline is silently inactive
**Depends on**: Phase 28
**Requirements**: SFIX-01
**Success Criteria** (what must be TRUE):
  1. After a Claude Code session ends, a new entry appears in the knowledge DB extracted from that session's responses — confirmed by checking DB before/after a session that contains a decision
  2. The hook fires via the Claude Code `Stop` hook mechanism (registered in `~/.claude/settings.json`) not SIGTERM
**Plans**: 1 plan

Plans:
- [x] 29-01: Session-end Stop hook — create `bin/hooks/session-end-standalone.js` reading from Claude Code hook JSON on stdin, accumulate via temp file keyed on `CLAUDE_SESSION_ID`, register as `Stop` hook in `install.js` — completed 2026-02-20

#### Phase 30: Milestone Summary & Archival
**Goal**: After a milestone completes, an automated step generates a structured milestone summary (what was built, decisions made, plan count, duration) and archives completed phase artifacts to a milestone subfolder for fast future reference
**Depends on**: Phase 29
**Requirements**: ARCH-01, ARCH-02, ARCH-03
**Success Criteria** (what must be TRUE):
  1. Running `/gsd:complete-milestone` after a milestone produces a milestone summary document written to `.planning/milestones/{version}-SUMMARY.md` containing a one-liner per phase, total plan count, total duration, and key decisions
  2. Completed phase directories are moved (not copied) to `.planning/milestones/{version}/phases/` on archival, leaving only the milestone summary in `.planning/milestones/`
  3. The milestone summary is committed to the repo as a readable artifact and optionally broadcast via Telegram if a telegram_topic_id is active
  4. Re-running `/gsd:complete-milestone` on an already-archived milestone is idempotent — no duplicate moves or overwrites
**Plans**: 1 plan

Plans:
- [x] 30-01: Milestone summarize & archive-phases commands — completed 2026-02-20

#### Phase 31: Per-Task Model Routing

**Goal:** When model_profile is "auto", each task in a PLAN.md gets assigned an optimal model tier (haiku/sonnet/opus) by the planner's post-draft routing pass, and the coordinator spawns per-task executors at those tiers with lightweight runtime quota downgrade — making the executor a mini-orchestrator rather than a single-tier runner
**Depends on:** Phase 30
**Plans:** 3/3 plans complete

Plans:
- [x] 31-01-PLAN.md — Add routing pass to gsd-planner: post-draft tier tagging of task names when model_profile="auto"
- [ ] 31-02-PLAN.md — Update gsd-phase-coordinator: parse per-task tier tags, apply quota downgrade, spawn per-task executors, add routing stats to Telegram notification
- [ ] 31-03-PLAN.md — Update gsd-executor: haiku→sonnet escalation on retry, routing tier tracking in SUMMARY.md

#### Phase 32: Reliability & Quality Gap Fixes

**Goal:** Close nine specific gaps identified by post-v1.11.0 audit: Telegram replies written to CONTEXT.md but never injected into the knowledge DB; silent Telegram topic creation failure swallowing all notifications for an entire roadmap run; session-end hook .done race condition allowing duplicate extraction; answered questions accumulating in question-state.jsonl forever; IPC server buffering unbounded partial JSON; embedding dedup timeout hardcoded at 2s; knowledge evolution running without a transaction; compression cache never invalidating on file modification; and knowledge search claiming RRF but performing sequential FTS-then-vector
**Depends on:** Phase 31
**Requirements**: GAP-01 through GAP-09
**Success Criteria** (what must be TRUE):
  1. After a Telegram escalation, a new knowledge DB entry appears with confidence 1.0 for the question+answer pair — confirmed by querying the DB immediately after escalation completes
  2. When `create_topic` fails at roadmap start, a visible warning is emitted to the execution log and Telegram notifications are explicitly disabled (not silently no-op) for that run
  3. Two concurrent Stop hook invocations for the same session produce exactly one knowledge extraction — confirmed by running two simultaneous invocations and checking DB entry count
  4. Restarting the Telegram daemon after answering two questions leaves question-state.jsonl with zero answered entries (pruned on startup)
  5. Sending 2MB of partial JSON to the IPC server closes the socket before the process exceeds 50MB RSS increase
  6. Setting `knowledge.embedding_timeout_ms: 500` in config.json causes `GSD_DEBUG=1` logs to show the configured timeout being used
  7. Writing two entries where the second write fails mid-operation (vector table update) leaves the DB with either both tables updated or neither — no orphaned main-table entries
  8. After modifying a compressed doc, the next hook invocation produces a fresh compression result (cache miss) rather than serving the stale cached version
  9. A search query that matches 3 documents in FTS at ranks [1,2,5] and the same documents in vector at ranks [3,1,2] produces a merged result ranked by RRF score rather than FTS rank alone
**Plans:** 4/4 complete

Plans:
- [x] 32-01-PLAN.md — GAP-03 atomic .done guard + GAP-05 IPC buffer cap + GAP-07 evolution mutex — completed 2026-02-21
- [x] 32-02-PLAN.md — GAP-04 question-state prune on startup + GAP-02 create_topic failure warning — completed 2026-02-21
- [x] 32-03-PLAN.md — GAP-06 embedding timeout configurable + GAP-01 Telegram escalation answers to KB — completed 2026-02-21
- [x] 32-04-PLAN.md — GAP-08 compression cache mtime verification + GAP-09 searchKnowledgeAsync + RRF — completed 2026-02-21

#### Phase 33: v1.10.0 Tech Debt Closure

**Goal:** Fix the confidence type contract bug in query-knowledge output (string "medium" returned instead of numeric float, breaking meta-answerer scoring when KB has entries) and update REQUIREMENTS.md traceability + SUMMARY.md frontmatter to accurately reflect v1.10.0 completion
**Depends on:** Phase 32
**Success Criteria** (what must be TRUE):
  1. `query-knowledge` returns `confidence: 0.7` (float) as the fallback when a KB entry lacks `metadata.confidence` — confirmed by inserting a test entry without confidence metadata and querying it
  2. REQUIREMENTS.md traceability table shows all 25 v1.10.0 requirements as "Complete" and all 25 checkboxes checked `[x]`
  3. Plans 22-02, 22-03, 22-04, 23-01, 24-02, 24-03, 24-04 each have correct `requirements-completed` arrays in their SUMMARY.md frontmatter matching the requirements they implemented
**Plans:** 2/2 plans complete

Plans:
- [x] 33-01-PLAN.md — Fix `confidence` string/float bug in `gsd-tools.js` line 8947 + update REQUIREMENTS.md traceability (20 Pending → Complete, 20 checkboxes) — completed 2026-02-21
- [x] 33-02-PLAN.md — Backfill `requirements-completed` in 7 SUMMARY.md files (22-02, 22-03, 22-04, 23-01, 24-02, 24-03, 24-04) — completed 2026-02-21

</details>

<details>
<summary>✅ v1.12.0 Autonomous Quality & Flow (Phases 34-40) — COMPLETE 2026-03-11</summary>

#### Phase 34: Checkpoint & Plan-Structure Gates

**Goal:** The coordinator refuses to advance through its lifecycle when plans are structurally incomplete — plan execution is blocked when test tasks are absent, phase completion is blocked when VERIFICATION.md is missing or not passed, and CHECKPOINT.json semantics are standardized so the coordinator's step tracking is unambiguous
**Depends on:** Phase 33
**Requirements:** QGATE-01, QGATE-02, QGATE-06, QGATE-09
**Success Criteria** (what must be TRUE):
  1. Submitting a plan that lacks `tdd="true"` test tasks to the coordinator's plan step causes `gsd-tools.js verify plan-structure` to emit a non-zero exit and the coordinator halts before spawning an executor
  2. Calling `gsd-tools.js phase complete` when the phase directory has no VERIFICATION.md (or VERIFICATION.md `status` is not `passed`) returns an error and refuses to mark the phase done
  3. `gsd-tools.js phase complete` also fails when any PLAN.md in the phase directory lacks a matching SUMMARY.md or when CHECKPOINT.json `last_step` is not `verify`
  4. CHECKPOINT.json `step_status: "complete"` is documented to mean the step ran — outcome is always read from VERIFICATION.md `status`, not inferred from checkpoint alone; coordinator prompt updated to reflect this contract
**Plans:** 2/2 plans complete

Plans:
- [ ] 34-01: Add `verify plan-structure` subcommand to gsd-tools.js — checks tdd and ui-qa task presence; wire into coordinator plan step as hard gate
- [ ] 34-02: Add phase completeness validation to `phase complete` subcommand — VERIFICATION.md existence + status, SUMMARY.md coverage, CHECKPOINT.json last_step; document CHECKPOINT semantics in coordinator checkpoint_protocol

#### Phase 35: Test & Coverage Enforcement

**Goal:** Executors and verifiers enforce hard quality standards — the test suite runs after every plan, Charlotte sweeps web projects unconditionally, coverage thresholds are configurable and enforced, and the verifier hard-fails when implementation files have no corresponding test files
**Depends on:** Phase 34
**Requirements:** QGATE-03, QGATE-04, QGATE-07, QGATE-08, QGATE-10
**Success Criteria** (what must be TRUE):
  1. After all tasks in a plan complete, the executor runs the full project test suite; if any test fails, SUMMARY.md is not created and the plan is marked failed
  2. For a project with React/Next.js/Vue/Svelte detected in package.json, Charlotte UX sweep runs after every plan's executor phase regardless of whether the coordinator happened to notice .tsx in SUMMARY.md
  3. When `testing.coverage_threshold` is set in config.json, the executor reads it and blocks SUMMARY.md creation if the measured coverage falls below the threshold
  4. The verifier marks a phase `gaps_found` (not warning) when SUMMARY.md key-files includes .tsx/.jsx but no Charlotte QA session entry appears in the phase record
  5. The verifier hard-fails (`gaps_found`) when a .ts/.tsx/.js implementation file listed in SUMMARY.md key-files has no corresponding test file — a warning is never emitted for this condition
**Plans:** 3/3 complete

Plans:
- [x] 35-01: Executor post-plan test suite gate — run test command after task completion, block SUMMARY.md on failure; add coverage threshold check when config.testing.coverage_threshold is set
- [x] 35-02: Charlotte mandatory sweep — detect web framework in package.json; unconditional Charlotte step in executor for web projects; add coverage threshold enforcement
- [x] 35-03: Verifier hard-fail rules — gaps_found on missing Charlotte QA for UI files; gaps_found on implementation files with no test counterpart

#### Phase 36: Migration Safety & Error Taxonomy

**Goal:** Migration timestamp conflicts are caught before they reach the commit and VERIFICATION.md gaps carry structured type information so the gap-closure planner can route fixes intelligently rather than treating all gaps as equivalent
**Depends on:** Phase 34
**Requirements:** QGATE-05, FLOW-03
**Success Criteria** (what must be TRUE):
  1. Running `gsd-tools.js verify migration-timestamps` before commit scans all migration files, detects duplicate timestamps, and auto-resolves conflicts by incrementing the conflicting timestamp — the scan runs as part of the verifier step for projects with a migrations directory
  2. VERIFICATION.md gap entries include a `failure_type` field set to one of the documented enum values (`stub | unwired | missing_artifact | semantic_stub | broken_chain | regression | missing_test`) — the verifier populates this field; gaps without a type are rejected as malformed
  3. The gap-closure planner reads `failure_type` from each gap and selects a fix strategy accordingly — stub gaps get a different plan template than regression gaps
**Plans:** 2/2 plans complete

Plans:
- [ ] 36-01: Migration timestamp conflict detection — add `verify migration-timestamps` subcommand to gsd-tools.js; auto-resolve by incrementing duplicate timestamps; wire into verifier for projects with migrations directory
- [ ] 36-02: VERIFICATION.md failure_type enum — update verifier agent prompt to populate failure_type on each gap; update gap-closure planner to route by type

#### Phase 37: PRD Traceability & Flow Context

**Goal:** Plans built on PRD input are traceable to their source requirements, and Wave 2+ executors within a phase receive accurate context about what was actually built in prior waves rather than relying on what earlier plans assumed they would build
**Depends on:** Phase 34
**Requirements:** FLOW-02, FLOW-04
**Success Criteria** (what must be TRUE):
  1. Running the PRD Express Path in plan-phase produces a PRD-TRACE.md file mapping each PRD requirement to its REQ-ID; the verifier reads PRD-TRACE.md and flags intent mismatches between the PRD requirement and the implementation SUMMARY.md
  2. When a phase contains multiple waves, the coordinator injects a `<completed_plans_context>` block into each Wave 2+ executor spawn — the block contains the key-files and decisions from each completed plan's SUMMARY.md, not the original plan assumptions
  3. PRD-TRACE.md is included in the audit-milestone cross-reference output alongside REQUIREMENTS.md
**Plans:** 2/2 plans complete

Plans:
- [ ] 37-01: PRD-TRACE.md generation — add PRD-TRACE.md write step to plan-phase PRD Express Path; update verifier to check intent alignment against PRD-TRACE.md when present
- [ ] 37-02: Wave context carry-forward — add completed_plans_context assembly in coordinator between waves; inject into Wave 2+ executor spawns; update audit-milestone to include PRD-TRACE.md

#### Phase 38: Dev Server Lifecycle & Knowledge Feedback

**Goal:** Dev server management is unified so every part of GSD that needs a running server uses the same config-driven module, and the knowledge DB is continuously fed from phase execution so decisions and anti-patterns discovered during a run are persisted immediately rather than only at session end
**Depends on:** Phase 35
**Requirements:** FLOW-05, FLOW-06
**Success Criteria** (what must be TRUE):
  1. A `dev_servers` registry in config.json defines named servers with start command, health endpoint, and port; `gsd-tools.js service-health start <name>` starts the server and waits for the health endpoint, and `service-health stop <name>` cleanly terminates it after phase completion
  2. Charlotte QA, the coordinator UI loop, and the post-phase UX sweep all reference `service-health` rather than spawning their own server processes — no duplicate server starts for the same phase
  3. After each phase completes, the transition workflow writes decisions from SUMMARY.md key decisions into the knowledge DB as `source_type: decision` entries; the verifier writes identified anti-patterns as `source_type: anti_pattern` entries with `confidence: 0.9`
**Plans:** TBD

Plans:
- [ ] 38-01: service-health module in gsd-tools.js — config.json dev_servers registry; start/stop/status subcommands with health polling; update coordinator, Charlotte, and UX sweep references
- [ ] 38-02: Knowledge DB feedback from execution — transition workflow writes SUMMARY.md decisions to KB; verifier writes anti-patterns; wire into both agent prompts

#### Phase 39: Execution Intelligence

**Goal:** The executor and coordinator detect problems before they cause failures — dependency drift is caught before a phase starts, file conflicts between parallel phases are surfaced in the execution plan, and inter-task type errors are caught and auto-fixed within a plan before they accumulate
**Depends on:** Phase 35
**Requirements:** FLOW-01, FLOW-07, FLOW-08
**Success Criteria** (what must be TRUE):
  1. Before executing a phase, `gsd-tools.js verify dependency-stability <phase>` checks that key files from depended-on phases have not been modified by intervening phases; a drift report is produced and the coordinator surfaces it before proceeding
  2. When `roadmap analyze` identifies parallel-eligible phases, the output includes a `file_conflicts` section listing files claimed by more than one parallel phase — shown in the execution plan confirmation prompt before the run starts
  3. The executor runs `tsc --noEmit` (or equivalent) between tasks; a type error triggers one auto-fix attempt before the error is logged as a gap and execution continues to the next task — type errors never abort the entire plan
**Plans:** 3/3 complete

Plans:
- [x] 39-01: Dependency drift detection — add `verify dependency-stability <phase>` subcommand to gsd-tools.js; wire into coordinator pre-execution check; emit drift report
- [x] 39-02: Parallel file conflict detection — update `roadmap analyze` to compute file_conflicts across parallel-eligible phases; add to execution plan confirmation output
- [x] 39-03: Inter-task type checking — add tsc step between tasks in executor; one auto-fix retry; log as gap on second failure; never abort plan

#### Phase 40: Observability & Analytics

**Goal:** Execution is observable in real time through context budget monitoring with automatic mode switching, and historically through an analytics command that generates reports from accumulated execution data and self-tunes config thresholds from actual history
**Depends on:** Phase 39
**Requirements:** FLOW-09, FLOW-10
**Success Criteria** (what must be TRUE):
  1. When the coordinator's context window reaches 60% usage, it switches to compressed response mode and sends a Telegram notification; at 80% it considers spawning the verifier as a fresh subagent with a context handoff summary
  2. Running `gsd-tools.js analytics report` produces a summary from EXECUTION_LOG.md and SUMMARY metrics including phase durations, plan counts, failure rates, and model tier distribution
  3. Running `gsd-tools.js analytics calibrate` reads actual execution history and updates config.json thresholds (e.g. complexity tier boundaries, coverage thresholds) based on observed outcomes — a dry-run flag shows proposed changes without writing
  4. `execute-roadmap` automatically runs `analytics report` at completion and appends the summary to the execution log
**Plans:** TBD

Plans:
- [ ] 40-01: Context budget monitoring — add context usage tracking to coordinator; compressed mode at 60%; fresh-subagent consideration at 80%; Telegram notification on mode switch
- [ ] 40-02: Analytics command group — `analytics report` from EXECUTION_LOG.md + SUMMARY metrics; `analytics calibrate` updates config thresholds from history; auto-run report at execute-roadmap completion

</details>

### v1.13.0 Product Discovery & Docs Automation (Phases 41-43)

**Milestone Goal:** Add a structured PRD maturation workflow (`gsd:prd`) that takes raw product ideas through PM/PO/tech stages to produce product-oriented PRDs, update `gsd:new-milestone` to consume PRDs autonomously, and embed mandatory docs updates into the phase execution and verification cycle.

**Dependency note:** Phase 42 depends on Phase 41 (needs `.planning/prds/` structure defined first). Phase 43 is independent and can execute in parallel with Phase 41.

#### Phase 41: gsd:prd Workflow

**Goal:** User can mature a raw product concept into a structured PRD through three sequential PM/PO/tech stages with confidence-driven Q&A, producing a stored product-oriented PRD at `.planning/prds/pending/` that is ready for milestone planning
**Depends on:** Phase 40 (v1.12.0 complete)
**Requirements:** PRD-01, PRD-02, PRD-03, PRD-04, PRD-05, PRD-06
**Success Criteria** (what must be TRUE):
  1. User runs `gsd:prd` with a concept description (text input, file path, or URL) and the workflow starts without error, entering the PM Discovery stage
  2. PM Discovery stage performs competitive web research, then conducts multi-round Q&A (max 4 questions per round) stating current confidence and blocking gaps explicitly each round — Q&A stops only when confidence is sufficient to advance, not after a fixed number of rounds
  3. PO/BA Scoping stage reads the existing codebase and `.planning/prds/done/` for context before defining user stories and acceptance criteria through Q&A, and draws an explicit MVP vs Phase 2 boundary
  4. HL Tech Discovery stage identifies technology candidates and architectural constraints — the output contains no schemas, API routes, or implementation code
  5. A completed PRD file appears at `.planning/prds/pending/{name}.md` containing problem statement, goals, user stories, acceptance criteria, tech candidates, open questions, and an explicit assumptions list
**Plans:** TBD

Plans:
- [ ] 41-01: Scaffold `gsd:prd` workflow + `.planning/prds/` directory structure + PRD output template
- [ ] 41-02: PM Discovery stage — web research step + confidence-driven multi-round Q&A loop
- [ ] 41-03: PO/BA Scoping stage — codebase + done-PRD context read + user story / acceptance criteria Q&A + MVP boundary
- [ ] 41-04: HL Tech Discovery stage — research step + tech candidate output with no-HOW guard

#### Phase 42: Milestone PRD Integration

**Goal:** When starting a new milestone, the user is offered existing pending PRDs as selectable options, and selecting one drives fully autonomous phase decomposition with a single approval checkpoint before any branch or planning files are created
**Depends on:** Phase 41 (`.planning/prds/` structure must exist)
**Requirements:** MILE-01, MILE-02, MILE-03, MILE-04
**Success Criteria** (what must be TRUE):
  1. Running `gsd:new-milestone` when `.planning/prds/pending/` contains one or more PRD files presents those PRDs as numbered options before asking "what to build next"
  2. Selecting a PRD produces a complete phase decomposition (phase names, goals, requirement coverage, dependency ordering) without the user defining any phases manually
  3. User sees a single approval screen showing the proposed roadmap before any branch or planning files are created — nothing is written until the user approves
  4. After roadmap approval, the selected PRD file moves from `.planning/prds/pending/` to `.planning/prds/done/` — the pending folder no longer contains that PRD
**Plans:** TBD

Plans:
- [ ] 42-01: Detect and present pending PRDs in `gsd:new-milestone` — scan `.planning/prds/pending/`, present as options, fall through to manual input when none found
- [ ] 42-02: Autonomous phase decomposition from PRD — read selected PRD, derive phases with dependency ordering, present single approval checkpoint
- [ ] 42-03: PRD lifecycle on approval — move PRD from pending to done on roadmap approval; update REQUIREMENTS.md traceability

#### Phase 43: Docs Automation

**Goal:** Every phase execution automatically produces appropriately-scoped documentation as a mandatory final step, and the verifier gates phase completion on docs being present and proportionate to what was built
**Depends on:** Phase 40 (v1.12.0 complete — independent of Phases 41 and 42)
**Requirements:** DOCS-01, DOCS-02, DOCS-03, DOCS-04, DOCS-05
**Success Criteria** (what must be TRUE):
  1. After all feature tasks complete in the final execution wave, a Haiku docs agent runs as the last mandatory task — it is not skippable and fires regardless of what was built
  2. Docs output scales to build scope: a new API endpoint produces a file in `api/`; a new UI surface produces a file in `frontend-operator/` or `frontend-player/`; an architectural decision appends to `architecture/`; an internal refactoring produces only a minimal changelog entry
  3. The docs agent reads existing `/docs` templates and frontmatter conventions from the target project before writing any content, and its output matches the established project style
  4. The phase verifier marks the phase `gaps_found` when the docs agent was skipped or when docs scope does not match build scope (e.g., new endpoint built but no `api/` doc entry produced)
  5. When `/docs` does not exist in the project, the agent creates the folder and seeds it with content covering what was built; when `/docs` exists, the agent updates existing files where relevant and creates new files only for new surfaces — no padding or invented content in either case
**Plans:** TBD

Plans:
- [ ] 43-01: `gsd-docs-updater` Haiku agent — reads `/docs` conventions, scales output to build scope, guards against padding and invented content
- [ ] 43-02: Executor final-wave integration — wire docs agent as last mandatory task after feature work is committed; pass SUMMARY.md build scope as context
- [ ] 43-03: Verifier docs validation gate — check docs appropriateness relative to build scope; `gaps_found` on skip or scope mismatch

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Auto Mode Foundation | v1.9.0 | 9/9 | Complete | 2026-02-16 |
| 2. Auto Mode Refinement | v1.9.0 | 6/6 | Complete | 2026-02-16 |
| 3. Knowledge System Foundation | v1.9.0 | 5/5 | Complete | 2026-02-16 |
| 4. Knowledge Extraction & Hooks | v1.9.0 | 6/6 | Complete | 2026-02-16 |
| 5. Knowledge Permissions & Safety | v1.9.0 | 6/6 | Complete | 2026-02-16 |
| 6. Autonomous Execution Core | v1.9.0 | 6/6 | Complete | 2026-02-16 |
| 7. Autonomous Execution Optimization | v1.9.0 | 6/6 | Complete | 2026-02-16 |
| 8. Notifications & Observability | v1.9.0 | 8/8 | Complete | 2026-02-16 |
| 8.1. Telegram MCP Server | v1.9.0 | 6/6 | Complete | 2026-02-16 |
| 9. Doc Compression Hooks | v1.9.0 | 5/5 | Complete | 2026-02-17 |
| 10. GSD Installation System | v1.9.0 | 4/4 | Complete | 2026-02-17 |
| 10.1. Multi-Instance MCP Safety | v1.9.0 | 4/4 | Complete | 2026-02-17 |
| 11. Session-End Knowledge Extraction | v1.9.0 | 4/4 | Complete | 2026-02-17 |
| 12. Historical Conversation Mining | v1.9.0 | 3/3 | Complete | 2026-02-18 |
| 13. Cross-Phase Integration Fixes | v1.9.0 | 1/1 | Complete | 2026-02-18 |
| 14. Telegram MCP Audit & Rework | v1.9.0 | 6/6 | Complete | 2026-02-18 |
| 18. Upstream Audit | v1.9.1 | 1/1 | Complete | 2026-02-19 |
| 19. Bug Fixes & Context Window Management | v1.9.1 | 2/2 | Complete | 2026-02-19 |
| 20. Git Branching & Autonomous Execution | v1.9.1 | 2/2 | Complete | 2026-02-19 |
| 21. Knowledge Global Migration | v1.10.0 | 3/3 | Complete | 2026-02-19 |
| 22. Discuss Step & Meta-Answerer | v1.10.0 | 4/4 | Complete | 2026-02-19 |
| 23. Telegram Escalation | v1.10.0 | 2/2 | Complete | 2026-02-19 |
| 24. Telegram Notifications | v1.10.0 | 4/4 | Complete | 2026-02-19 |
| 25. End-to-End Validation | v1.10.0 | 4/4 | Complete | 2026-02-19 |
| 26. Telegram MCP Reliability | v1.11.0 | 3/3 | Complete | 2026-02-20 |
| 27. Knowledge System Quality | v1.11.0 | 3/3 | Complete | 2026-02-20 |
| 28. Compression & Observability | v1.11.0 | 3/3 | Complete | 2026-02-20 |
| 29. Session Extraction Fix | v1.11.0 | 1/1 | Complete | 2026-02-20 |
| 30. Milestone Summary & Archival | v1.11.0 | 1/1 | Complete | 2026-02-20 |
| 31. Per-Task Model Routing | v1.11.0 | 3/3 | Complete | 2026-02-21 |
| 32. Reliability & Quality Gap Fixes | v1.11.0 | 4/4 | Complete | 2026-02-21 |
| 33. v1.10.0 Tech Debt Closure | v1.10.0 | 2/2 | Complete | 2026-02-21 |
| 34. Checkpoint & Plan-Structure Gates | v1.12.0 | 2/2 | Complete | 2026-03-10 |
| 35. Test & Coverage Enforcement | v1.12.0 | 3/3 | Complete | 2026-03-11 |
| 36. Migration Safety & Error Taxonomy | v1.12.0 | 2/2 | Complete | 2026-03-10 |
| 37. PRD Traceability & Flow Context | v1.12.0 | 2/2 | Complete | 2026-03-10 |
| 38. Dev Server Lifecycle & Knowledge Feedback | v1.12.0 | 2/2 | Complete | 2026-03-11 |
| 39. Execution Intelligence | v1.12.0 | 3/3 | Complete | 2026-03-11 |
| 40. Observability & Analytics | v1.12.0 | 2/2 | Complete | 2026-03-11 |
| 41. gsd:prd Workflow | v1.13.0 | 0/TBD | Not started | - |
| 42. Milestone PRD Integration | v1.13.0 | 0/TBD | Not started | - |
| 43. Docs Automation | v1.13.0 | 0/TBD | Not started | - |

---
*Roadmap created: 2026-02-15 | Last updated: 2026-03-11 — v1.13.0 Product Discovery & Docs Automation phases 41-43 added*
