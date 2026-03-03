# Roadmap: GSD Reflect

## Milestones

- <details><summary>v1.12 GSD Reflect (Phases 0-6) -- SHIPPED 2026-02-09</summary>See milestones/v1.12-ROADMAP.md</details>
- <details><summary>v1.13 Upstream Sync & Validation (Phases 7-12) -- SHIPPED 2026-02-11</summary>See milestones/v1.13-ROADMAP.md</details>
- <details><summary>v1.14 Multi-Runtime Interop (Phases 13-21) -- SHIPPED 2026-02-16</summary>See milestones/v1.14-ROADMAP.md</details>
- <details><summary>v1.15 Backlog & Update Experience (Phases 22-30) -- SHIPPED 2026-02-23</summary>See milestones/v1.15-ROADMAP.md</details>
- <details><summary>v1.16 Signal Lifecycle & Reflection (Phases 31-35) -- SHIPPED 2026-03-02</summary>See milestones/v1.16-ROADMAP.md</details>
- **v1.17 Automation Loop (Phases 36-43) -- IN PROGRESS**

### v1.17 Automation Loop

**Milestone Goal:** Make the self-improvement system actually self-triggering -- auto-collect signals after phases, detect CI failures, trigger reflection automatically, and close the gap between signal detection and action.

**Phase Numbering:**
- Integer phases (36, 37, 38...): Planned milestone work
- Decimal phases (37.1, 37.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

**Divergences from research recommendation:**
Research SUMMARY.md proposed 6 phases (Foundation Fix → CI Awareness → Plan Intelligence → Health Check Wiring → Auto-Collection Loop → Auto-Reflection). This roadmap expands to 8 phases with two structural changes:

1. **Phase 37 (Automation Framework) inserted before CI work.** The 7 AUTO-* requirements define a coherent subsystem (unified levels, per-feature overrides, context-aware deferral, effective level display) that every subsequent auto-triggering phase references ("respecting automation level"). Building it once, early, prevents scattered config wiring across later phases and avoids the research's implicit assumption that automation config would be built incrementally alongside features.

2. **Phase 38 (Extensible Sensor Architecture) separated from CI sensor.** Research bundled sensor architecture with the CI sensor in a single phase. But EXT-01 through EXT-07 define a framework (auto-discovery, contract, enable/disable, CLI observability, blind spots) that must exist before CI sensor is built under it — EXT-06 explicitly requires "built as first sensor under the new extensible model." Separating them validates the architecture before depending on it.

## Phases

- [ ] **Phase 36: Foundation Fix** - Restore CI trust by fixing the broken wiring test and preventing recurrence
- [ ] **Phase 37: Automation Framework** - Establish the unified automation level system that all auto-triggering features depend on
- [ ] **Phase 38: Extensible Sensor Architecture** - Build the sensor discovery and contract system so new sensors can be added without framework modification
- [ ] **Phase 39: CI Awareness** - Build the CI sensor under the extensible model and surface CI status at session start
- [ ] **Phase 40: Signal Collection Automation** - Auto-trigger signal collection after phase execution with reentrancy protection and cross-runtime fallback
- [ ] **Phase 41: Health Score & Automation** - Compute and display health score, auto-trigger health checks, and track signal resolution metrics
- [ ] **Phase 42: Reflection Automation** - Auto-trigger reflection after configurable phase count with confidence updates on lessons
- [ ] **Phase 43: Plan Intelligence & Templates** - Semantic plan validation and template improvements for closed-loop traceability

## Phase Details

### Phase 36: Foundation Fix
**Goal**: CI pipeline is trustworthy -- tests check the right directories, a meta-test prevents path recurrence, and CI is green on main
**Depends on**: Nothing (first phase)
**Requirements**: CI-01
**Success Criteria** (what must be TRUE):
  1. `wiring-validation.test.js` asserts against `agents/` (npm source directory), not `.claude/agents/` (install target)
  2. A meta-test exists that fails if any test file uses `.claude/` as a primary assertion path
  3. CI pipeline passes on main branch without admin bypass
**Plans**: TBD

Plans:
- [ ] 36-01: Fix wiring test paths and add meta-test for recurrence prevention

### Phase 37: Automation Framework
**Goal**: Users can configure automation behavior at a global level and per-feature, with the system honestly reporting effective levels per runtime
**Depends on**: Phase 36
**Requirements**: AUTO-01, AUTO-02, AUTO-03, AUTO-04, AUTO-05, AUTO-06, AUTO-07
**Success Criteria** (what must be TRUE):
  1. User can set `automation.level` to 0 (manual), 1 (nudge), 2 (prompt), or 3 (auto) in config.json and all automation features respect this setting
  2. User can override the global level for individual features via `automation.overrides` (e.g., signal collection at level 3 while global is level 1)
  3. Fine-grained knobs (thresholds, frequencies, intervals) are configurable per feature regardless of automation level
  4. When context usage exceeds threshold, level-3 features automatically downgrade to nudge for that session
  5. Statusline shows effective automation level accounting for runtime capabilities (e.g., "Level 3 (eff: 2)" on Codex where hooks are unavailable)
**Plans**: TBD

Plans:
- [ ] 37-01: Automation level config schema, manifest declaration, and level resolution logic
- [ ] 37-02: Per-feature overrides, fine-grained knobs, and context-aware deferral
- [ ] 37-03: Runtime-aware effective levels, automation statistics tracking, and statusline display

### Phase 38: Extensible Sensor Architecture
**Goal**: New sensors can be added by dropping a file into the agents directory -- no framework modification required, existing sensors conform to the standard contract
**Depends on**: Phase 37 (sensor enable/disable uses automation config)
**Requirements**: EXT-01, EXT-02, EXT-03, EXT-04, EXT-05, EXT-07
**Success Criteria** (what must be TRUE):
  1. collect-signals workflow discovers sensors by scanning for `gsd-*-sensor.md` files in the agents directory instead of hardcoding sensor names
  2. A standardized sensor contract defines input format, output format (`## SENSOR OUTPUT` JSON delimiters), error handling (empty array on failure), timeout behavior, and `blind_spots` declaration
  3. Each sensor can be enabled or disabled via config toggle; disabled sensors are discovered but not spawned
  4. `gsd-tools.js sensors list` shows discovered sensors with enabled/disabled status, last run time, and signal count
  5. Existing artifact and git sensors conform to the standardized contract
**Plans**: TBD

Plans:
- [ ] 38-01: Sensor contract definition, auto-discovery in collect-signals, and enable/disable config
- [ ] 38-02: Retrofit existing sensors to contract, sensors list CLI command, blind spots documentation

### Phase 39: CI Awareness
**Goal**: CI failures are detected automatically by the new CI sensor and surfaced to the user at session start before more work is committed on a broken build
**Depends on**: Phase 38 (CI sensor is the first sensor built under the extensible model)
**Requirements**: CI-02, CI-03, CI-04, CI-05, CI-06, EXT-06
**Success Criteria** (what must be TRUE):
  1. CI sensor (`gsd-ci-sensor.md`) detects failed GitHub Actions runs and returns signal candidates via the standardized sensor contract, validating the extensible architecture (EXT-06)
  2. CI sensor runs `gh auth status` pre-flight and degrades gracefully when unauthenticated -- empty signals plus a human-readable warning, never a silent false-negative
  3. CI sensor detects branch protection bypass (commits pushed without passing CI) and test regression (test count drops between runs)
  4. CI status is displayed at session start via SessionStart hook, showing the latest run status before the user begins work
**Plans**: TBD

Plans:
- [ ] 39-01: CI sensor agent spec with gh auth pre-flight, failure detection, and graceful degradation
- [ ] 39-02: Branch protection bypass detection, test regression detection, and SessionStart hook for CI status display

### Phase 40: Signal Collection Automation
**Goal**: Signal collection runs automatically after every phase execution without manual invocation, with reentrancy protection preventing feedback loops and cross-runtime fallback ensuring all 4 runtimes are covered
**Depends on**: Phase 39 (CI sensor available for parallel collection), Phase 37 (automation levels respected)
**Requirements**: SIG-01, SIG-02, SIG-03, SIG-04, SIG-05, SIG-06
**Research flag**: Reentrancy lockfile design has non-obvious edge cases (stale locks, location, atomicity). Resolve during planning or via pre-phase spike.
**Success Criteria** (what must be TRUE):
  1. After phase execution completes, signal collection auto-triggers as a workflow postlude step (not via hooks), with CI sensor included in parallel alongside artifact and git sensors
  2. Reentrancy guard (lockfile-based with configurable TTL) prevents feedback loops -- source-tagged triggers ensure only phase-completion triggers collection, and reflection-generated artifacts are excluded from re-ingestion
  3. On runtimes without hooks (OpenCode, Codex CLI), the workflow postlude fallback delivers the same auto-collection behavior
  4. When context exceeds threshold, auto-collection defers with a nudge message instead of executing
  5. When auto-collection is enabled or observation conditions change, a `regime_change` entry is written to the KB with timestamp and expected baseline impact
**Plans**: TBD

Plans:
- [ ] 40-01: Execute-phase postlude for auto-collection with CI sensor in parallel spawn
- [ ] 40-02: Reentrancy lockfile, source-tagged triggers, reflection artifact exclusion
- [ ] 40-03: Cross-runtime fallback, context-aware deferral, and observation regime tracking

### Phase 41: Health Score & Automation
**Goal**: Health is computed as a two-dimensional score (infrastructure + workflow), displayed as a traffic light in the statusline, and auto-triggered at session start and per-phase -- with signal resolution metrics tracking whether the automation loop is actually completing
**Depends on**: Phase 40 (SIG-06 regime boundaries needed for HEALTH-08, HEALTH-09), Phase 37 (automation levels)
**Requirements**: HEALTH-01, HEALTH-02, HEALTH-03, HEALTH-04, HEALTH-05, HEALTH-06, HEALTH-07, HEALTH-08, HEALTH-09
**Success Criteria** (what must be TRUE):
  1. Health score combines infrastructure health (binary: CI, config, KB, state freshness) and workflow health (weighted signal accumulation with pattern deduplication) into a composite indicator
  2. Health score displayed in statusline as traffic light (green/yellow/red) with standing caveat: "Health checks measure known categories. Absence of findings does not mean absence of problems."
  3. Health check auto-triggers at session start when frequency is `on-resume` and as an execute-phase workflow step when frequency is `every-phase`, with session dedup via timestamp
  4. Reactive health check triggers on fresh session start when health score drops below configurable threshold
  5. Health check verifies automation system is functioning by checking `last_triggered` timestamps against expected cadence
**Plans**: TBD

Plans:
- [ ] 41-01: Health score model -- infrastructure and workflow dimensions with weighted signal accumulation
- [ ] 41-02: Health display (statusline traffic light with caveat) and auto-trigger wiring (session start, per-phase)
- [ ] 41-03: Reactive triggers, automation watchdog, signal-to-resolution ratio, and signal density trend

### Phase 42: Reflection Automation
**Goal**: Reflection triggers automatically after a configurable number of phases, with lesson confidence evolving through evidence rather than remaining static labels
**Depends on**: Phase 40 (auto-collection working so signals accumulate), Phase 37 (automation levels)
**Research flag**: Stop hook counter interaction and state machine need explicit design before coding. Resolve during planning.
**Requirements**: REFL-01, REFL-02, REFL-03, REFL-04, REFL-05
**Success Criteria** (what must be TRUE):
  1. Reflection auto-triggers after configurable N phases (default 3), with opt-in default (`auto_reflect: false`) and automation level respected
  2. `phases_since_last_reflect` counter persists in config, increments after each phase execution, and resets after reflection runs
  3. Auto-reflection only fires when accumulated untriaged signals exceed configurable minimum (default 5), preventing reflection on insufficient data
  4. Maximum one auto-reflection per session (session-scoped cooldown) to prevent context exhaustion
  5. Lesson confidence updates directionally -- signals matching predictions increase confidence one step, contradictions decrease confidence one step, with changes recorded in `confidence_history`
**Plans**: TBD

Plans:
- [ ] 42-01: Counter-based reflection scheduling with config persistence and threshold gating
- [ ] 42-02: Session cooldown, cross-runtime fallback, and mutable lesson confidence with directional updates

### Phase 43: Plan Intelligence & Templates
**Goal**: Plans are validated for semantic correctness before execution, and templates capture the provenance information needed to close the traceability loop from signal to reflection to requirement to verification
**Depends on**: Phase 38 (sensor contract for PLAN-04 signal reference validation), Phase 37 (automation config for PLAN-02 config key validation)
**Requirements**: PLAN-01, PLAN-02, PLAN-03, PLAN-04, PLAN-05, TMPL-01, TMPL-02, TMPL-03, TMPL-04, TMPL-05
**Success Criteria** (what must be TRUE):
  1. Plan checker validates tool subcommand existence, config key existence (against feature-manifest schema), directory existence (with temporal awareness for intra-plan creates), and signal reference validity against KB index
  2. All semantic validation findings are advisory severity (not blocker) with typed IDs for future correlation
  3. Requirements template includes motivation citation field, SUMMARY.md template includes model and context_used_pct fields
  4. Reflection reports link findings to requirement IDs for closed-loop traceability
  5. Architecturally significant feature specs include an "Internal Tensions" section identifying what contradiction the feature introduces, applied selectively (not to wiring or infrastructure requirements)
**Plans**: TBD

Plans:
- [ ] 43-01: Plan checker semantic dimensions -- tool refs, config refs, directory refs, signal refs (all advisory)
- [ ] 43-02: Template enhancements -- motivation field, model/context fields, reflection-to-requirement linkage, internal tensions section

## Progress

**Execution Order:**
Phases execute in numeric order: 36 -> 37 -> 38 -> 39 -> 40 -> 41 -> 42 -> 43

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 36. Foundation Fix | 0/1 | Not started | - |
| 37. Automation Framework | 0/3 | Not started | - |
| 38. Extensible Sensor Architecture | 0/2 | Not started | - |
| 39. CI Awareness | 0/2 | Not started | - |
| 40. Signal Collection Automation | 0/3 | Not started | - |
| 41. Health Score & Automation | 0/3 | Not started | - |
| 42. Reflection Automation | 0/2 | Not started | - |
| 43. Plan Intelligence & Templates | 0/2 | Not started | - |

## Overall Progress

| Milestone | Phases | Plans | Status | Shipped |
|-----------|--------|-------|--------|---------|
| v1.12 GSD Reflect | 0-6 | 25 | Complete | 2026-02-09 |
| v1.13 Upstream Sync | 7-12 | 18 | Complete | 2026-02-11 |
| v1.14 Multi-Runtime | 13-21 | 18 | Complete | 2026-02-16 |
| v1.15 Backlog & Update | 22-30 | 24 | Complete | 2026-02-23 |
| v1.16 Signal Lifecycle | 31-35 | 20 | Complete | 2026-03-02 |
| v1.17 Automation Loop | 36-43 | 0/18 | In progress | - |

**Totals:** 6 milestones, 43 phases, 105 plans completed, 18 planned
