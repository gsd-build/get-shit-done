# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-27)

**Core value:** The system never makes the same mistake twice -- signals capture what went wrong, spikes resolve uncertainty empirically, and the knowledge base surfaces relevant lessons before they're needed.
**Current focus:** v1.16 Signal Lifecycle & Reflection -- Phase 35 Complete (Spike Audit & Lightweight Mode)

## Current Position

Phase: 35 of 35 (Spike Audit & Lightweight Mode)
Plan: 4 of 4 in current phase
Status: Complete
Last activity: 2026-03-02 -- Plan 35-04 complete (installer sync + phase verification)

Progress: [██████████] 100% (Phase 35 -- v1.16 Complete)

## Performance Metrics

**v1.12 Final:**
- Total plans completed: 25
- Average duration: 2.8min
- Total execution time: 70min

**v1.13 Final:**
- Total plans completed: 18
- Average duration: ~4.4min
- Total execution time: ~70min

**v1.14 Final (initial + gap closure):**
- Plans completed: 18 (10 initial + 8 gap closure + 1 quick fix)
- Duration: ~75min (46min initial + 29min gap closure)

**v1.15 Final (initial + gap closure):**
- Plans completed: 24 (18 initial + 6 gap closure)
- Timeline: 13 days (2026-02-11 -> 2026-02-23)

**v1.16:**
| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 31 | 01 | 4min | 3 | 5 |
| 31 | 02 | 4min | 2 | 2 |
| 31 | 03 | 6min | 2 | 4 |
| 31 | 04 | 4min | 4 | 4 |
| 32 | 01 | 4min | 2 | 6 |
| 32 | 03 | 2min | 1 | 1 |
| 32 | 02 | 4min | 2 | 1 |
| 32 | 04 | 4min | 2 | 2 |
| 33 | 02 | 2min | 2 | 2 |
| 33 | 01 | 4min | 2 | 1 |
| 33 | 03 | 4min | 1 | 1 |
| 33 | 04 | 2min | 1 | 4 |
| 34 | 01 | 2min | 2 | 2 |
| 34 | 02 | 2min | 2 | 2 |
| 34 | 03 | 3min | 2 | 2 |
| 34 | 04 | 5min | 3 | 7 |
| 35 | 02 | 2min | 2 | 3 |
| 35 | 01 | 3min | 2 | 4 |
| 35 | 03 | 4min | 2 | 4 |
| 35 | 04 | 2min | 2 | 7 |

## Accumulated Context

### Decisions

Full decision log in PROJECT.md Key Decisions table.
v1.13-v1.15 decisions archived in milestones/ directories.

Recent decisions affecting current work:
- v1.16 roadmap: 5 phases derived from 36 requirements across SCHEMA/SENSOR/REFLECT/LIFECYCLE/SPIKE categories
- v1.16 ordering: Schema first (foundation), then sensors, then reflector (highest value), then linkage (closes loop), spikes last (independent)
- Critical pitfall: Build reflector BEFORE adding more sensors -- reflector is the bottleneck, not detection
- P31-01: Four severity tiers (critical/notable/minor/trace) with tiered epistemic rigor
- P31-01: Lifecycle state machine: detected->triaged->remediated->verified + invalidated terminal
- P31-01: Mutability boundary: frozen detection payload + mutable lifecycle fields (agent-enforced)
- P31-01: signal_category authoritative over polarity; dismissed is triage decision, not lifecycle state
- P31-02: Moved single auto-fix/minor file differences/task order changes from trace to minor severity (now persisted to KB)
- P31-02: signal_category replaces polarity as primary positive/negative indicator; polarity retained for backward compatibility
- P31-02: Trace non-persistence enforcement deferred to Phase 32 synthesizer; documented explicitly
- P31-02: Anti-pattern 10.6 updated to detection-payload-frozen / lifecycle-fields-mutable boundary
- P31-03: Signal schema machine-enforceable via FRONTMATTER_SCHEMAS with conditional validation (critical requires evidence)
- P31-03: kb-rebuild-index.sh lifecycle_state column with "detected" default for existing signals
- P31-04: backward_compat keyed on lifecycle_state absence; evidence content validation for empty objects; Phase 33 triage constraint documented
- P32-01: Artifact sensor returns ALL candidates including trace -- synthesizer is single enforcement point for trace non-persistence
- P32-01: Log sensor ships disabled with spike question rather than being omitted -- documents the unknown (SENSOR-07)
- P32-01: Delimited sensor output format (## SENSOR OUTPUT / ## END SENSOR OUTPUT) with structured JSON
- P32-03: Synthesizer is sole KB writer; sensors never write directly to KB
- P32-03: Per-project cap not enforced (documented as future gap); per-phase cap of 10 is primary constraint
- P32-03: Post-write validation deletes malformed files rather than leaving broken state
- [Phase 32]: Git sensor uses expandable commit window (100 then 300) for fix-chain detection
- P32-04: Orchestrator passes file PATHS to sensors (not CONTENTS) to prevent context bloat
- P32-04: JSON extraction uses delimiter protocol (## SENSOR OUTPUT) with fenced code block fallback
- [Phase 33]: P33-02: SIG-format signals counted in separate Legacy row to prevent inflating Untriaged count
- [Phase 33]: P33-02: YOLO triage auto-approve limited to address and dismiss only; defer and investigate always prompt
- [Phase 33]: P33-02: Per-run triage cap of 10 signals to bound first-run bulk operations
- [Phase 33]: P33-02: Remediation suggestions are advisory; Phase 34 handles actual lifecycle transitions via resolves_signals
- [Phase 33]: P33-01: Weighted score thresholds 3.0/4.0/5.0 for critical/notable/minor replace raw count thresholds
- [Phase 33]: P33-01: Section 8 taxonomy declared authoritative; legacy categories mapped (debugging->testing, performance->architecture, other->workflow)
- [Phase 33]: P33-01: Counter-evidence bounded to 3 examples per pattern using index-first search; spike candidates triggered by investigate triage, low confidence, or marginal score
- [Phase 33]: P33-03: Two-pass signal reading (index pass via shell commands, detail pass for qualifying clusters only) to manage context budget
- [Phase 33]: P33-03: Reflector authorized mutations limited to lifecycle fields only; roundtrip validation before bulk triage writes
- [Phase 33]: P33-03: Spike candidates identified but not created; remediation suggestions are plan-level advisory only
- P34-01: resolves_signals is documentation-only -- no gsd-tools.js code changes needed (FRONTMATTER_SCHEMAS.plan allows unknown fields)
- P34-01: Recurrence escalation applies to the new signal, not the original (original severity is frozen detection payload)
- P34-01: verification_window range 1-10 with default 3 phases
- P34-02: Signal awareness section placed after knowledge_surfacing in planner agent
- P34-02: Triaged signal loading skipped for --gaps mode
- P34-02: Signal context capped at 10 files prioritized by severity
- P34-02: Triaged signals passed inline in planning_context block
- [Phase 34]: P34-03: Signal remediation happens at workflow level (execute-plan.md), not in executor agent
- [Phase 34]: P34-03: Recurrence detection uses same matching algorithm as cross-sensor dedup (signal_type + 2+ tags)
- [Phase 34]: P34-03: Passive verification uses configurable verification_window (default 3 phases)
- [Phase 34]: P34-03: Recurrence regression resets matched signal to detected state, not triaged
- [Phase 34]: P34-04: KB signal files are external to repo (~/.gsd/knowledge/) -- lifecycle demo changes persisted but not git-committed
- [Phase 35]: Research mode handled inline in run-spike.md Step 5b for interactive spikes, and via mode: research in DESIGN.md for runner-invoked spikes
- [Phase 35]: Step 5.5 advisory-only by default (auto_trigger: false) -- spikes suggested but not auto-executed
- [Phase 35]: Researcher Open Questions restructured globally (Resolved/Genuine Gaps/Still Open) -- affects all future research
- [Phase 35]: Config keys use nested spike.sensitivity format (not flat spike_sensitivity) matching manifest schema
- [Phase 35]: P35-03: Claude Code session data stored at ~/.claude/projects/{dash-encoded-path}/*.jsonl (JSONL) and ~/.claude/debug/*.txt (plain text)
- [Phase 35]: P35-03: SENSOR-07 should be enabled with streaming reads for recent sessions; format treated as best-effort (no Anthropic stability guarantee)
- [Phase 35]: P35-04: All 5 SPIKE requirements verified and approved; spike system fully operational in runtime

### Pending Todos

2 pending:
- [MEDIUM] Feature manifest system for declarative feature initialization (architecture)
- [HIGH] Dual-install Phase 2: update flow, hook awareness, and version-pinned suppression (tooling)

### Blockers/Concerns

- NPM_TOKEN config (pre-existing from v1.12, not blocking)
- Gitignore friction (pre-existing from v1.12, not blocking)
- 11 tech debt items from v1.15 audit (0 blockers) -- see milestones/v1.15-MILESTONE-AUDIT.md
- Nested YAML parsing risk: extractFrontmatter() may not handle deep nesting (triage.decision, evidence.supporting) -- test early in Phase 31

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 001 | Update installer branding for GSD Reflect | 2026-02-09 | c82ce23 | [001-update-installer-branding-for-gsd-reflect](./quick/001-update-installer-branding-for-gsd-reflect/) |
| 002 | Fix 2 failing install.test.js tests (signal.md -> reflect.md) | 2026-02-15 | ac3f385 | [2-fix-the-2-failing-install-test-js-tests](./quick/2-fix-the-2-failing-install-test-js-tests/) |
| 003 | Fix 6 critical PR#4 bugs (migrateKB collision, dangling symlink, Codex regex, 3 capability guards) | 2026-02-16 | 509936e | [3-fix-6-critical-pr4-bugs-migratekb-collis](./quick/3-fix-6-critical-pr4-bugs-migratekb-collis/) |
| 004 | Create /gsd:release command for automated version bump, changelog, tag, and GitHub Release | 2026-02-16 | 7902519 | [4-create-gsd-release-command-for-automated](./quick/4-create-gsd-release-command-for-automated/) |
| 005 | Remove C7-C10 self-fulfilling tests (15 tests removed, suite now 140 passing) | 2026-02-16 | 001e7aa | [5-rewrite-c7-c10-self-fulfilling-tests-to-](./quick/5-rewrite-c7-c10-self-fulfilling-tests-to-/) |
| 006 | Release v1.15.0 to npm with reflect- tag prefix | 2026-02-24 | 7fc4a7c | [6-release-v1-15-0-to-npm-with-reflect-tag-](./quick/6-release-v1-15-0-to-npm-with-reflect-tag-/) |
| 007 | Dual-install detection/awareness (Phase 1): VERSION comparison, cross-scope warning, description injection, reference doc | 2026-02-25 | 0346ac6 | [7-implement-dual-installation-detection-an](./quick/7-implement-dual-installation-detection-an/) |
| 008 | Recover lost code: knowledge-store.md + dual-install in resume-project.md to npm source | 2026-02-26 | 9c7e7a9 | [8-recover-lost-code-from-deleted-local-pat](./quick/8-recover-lost-code-from-deleted-local-pat/) |
| 009 | Fix installer local patch detection false positives (pruneRedundantPatches) | 2026-02-26 | b979680 | [9-fix-installer-local-patch-detection-to-a](./quick/9-fix-installer-local-patch-detection-to-a/) |
| 010 | Fix pre-v1.16 tech debt: add agent-protocol refs to 5 agents, copy kb-templates to npm source | 2026-02-27 | 824c6c1 | [10-fix-pre-v1-16-tech-debt-add-agent-protoc](./quick/10-fix-pre-v1-16-tech-debt-add-agent-protoc/) |
| 011 | Add DEV indicator for local dev installs (VERSION+dev suffix, statusline tag, version check fix) | 2026-03-01 | be5a1e4 | [11-add-dev-indicator-to-statusline-when-usi](./quick/11-add-dev-indicator-to-statusline-when-usi/) |
| 012 | Persist reflection reports to ~/.gsd/knowledge/reflections/ | 2026-03-01 | ea9a758 | [12-add-persistent-report-file-output-to-ref](./quick/12-add-persistent-report-file-output-to-ref/) |

### Roadmap Evolution

v1.12 complete (Phases 0-6). v1.13 complete (Phases 7-12). v1.14 complete (Phases 13-21). v1.15 complete (Phases 22-30). v1.16 complete (Phases 31-35). All planned phases shipped.

### Key Artifacts

- Tag `reflect-v1.12.2-pre-sync` -- immutable rollback point on main
- Tag `reflect-v1.13.0` -- annotated release tag on commit d6a250b
- Tag `reflect-v1.14.0` -- annotated release tag for multi-runtime interop
- Tag `reflect-v1.15.0` -- annotated release tag for backlog & update experience
- **Tag convention:** Fork tags use `reflect-v*` prefix to avoid collision with upstream tags. Upstream remote configured with `--no-tags`.
- PR #3 -- sync/v1.13-upstream to main (https://github.com/loganrooks/get-shit-done-reflect/pull/3)
- `.planning/FORK-STRATEGY.md` -- conflict resolution runbook + Merge Decision Log
- `.planning/FORK-DIVERGENCES.md` -- per-file merge stances, post-merge risk recalibration

## Session Continuity

Last session: 2026-03-02
Stopped at: Completed 35-04-PLAN.md (installer sync + phase verification). Phase 35 complete. v1.16 milestone complete (Phases 31-35).
Resume file: None
