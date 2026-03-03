# Requirements: GSD Reflect v1.17

**Defined:** 2026-03-02
**Core Value:** The system never makes the same mistake twice — signals capture what went wrong, spikes resolve uncertainty empirically, and the knowledge base surfaces relevant lessons before they're needed.

## v1.17 Requirements

Requirements for v1.17 Automation Loop. Each maps to roadmap phases.

**Motivation types:** `signal:` KB signal ID | `pattern:` reflection pattern | `lesson:` KB lesson ID | `research:` research finding | `deliberation:` design decision from deliberation | `user:` direct user request

### CI Awareness

- [ ] **CI-01**: CI wiring test fixed — `wiring-validation.test.js` checks `agents/` (npm source) not `.claude/agents/` (install target), with meta-test preventing recurrence
  - *Motivation:* `signal: sig-2026-03-02-ci-failures-ignored-throughout-v116` — 5 consecutive CI failures bypassed via admin push throughout v1.16
- [ ] **CI-02**: CI status displayed at session start via SessionStart hook — background `gh run list` check with result cached and surfaced in statusline
  - *Motivation:* `signal: sig-2026-03-02-ci-failures-ignored-throughout-v116` — system had no mechanism to make CI failures visible
- [ ] **CI-03**: CI sensor agent (`gsd-ci-sensor.md`) detects failed GitHub Actions runs, returning signal candidates via the standard sensor contract
  - *Motivation:* `pattern: CI failures undetected` — no sensor covers CI/CD; artifact and git sensors only analyze local artifacts
- [ ] **CI-04**: CI sensor includes `gh auth status` pre-flight with graceful degradation (empty signals + human-readable warning when unauthenticated)
  - *Motivation:* `research: PITFALLS.md #2` — gh auth assumption is a critical pitfall; sensor must not silently report "no issues" when unable to check
- [ ] **CI-05**: CI sensor detects branch protection bypass — commits pushed without passing CI checks are flagged as signals
  - *Motivation:* `signal: sig-2026-03-02-ci-failures-ignored-throughout-v116` — all 5 failures were admin-pushed bypassing branch protection
- [ ] **CI-06**: CI sensor detects test regression — test count drops between runs flagged as signals
  - *Motivation:* `research: FEATURES.md D-3` — beyond pass/fail, detecting removed/skipped tests catches silent quality regression

### Automation Levels

- [ ] **AUTO-01**: Unified automation level system (0=manual, 1=nudge, 2=prompt, 3=auto) configurable via `automation.level` in config.json
  - *Motivation:* `deliberation: v1.17-plus-roadmap-deliberation.md` — user identified need for coherent automation model vs scattered boolean toggles
- [ ] **AUTO-02**: Per-feature overrides — individual features can be bumped up or down from global level via `automation.overrides`
  - *Motivation:* `deliberation: v1.17-plus-roadmap-deliberation.md` — user requested "unified levels + per-feature overrides + more refined customization"
- [ ] **AUTO-03**: Fine-grained knobs per feature — thresholds, frequencies, and intervals configurable regardless of level (e.g., `automation.reflection.threshold_phases`)
  - *Motivation:* `deliberation: v1.17-plus-roadmap-deliberation.md` — user requested finer control beyond level + override
- [ ] **AUTO-04**: Context-aware auto-triggering — if context usage exceeds configurable threshold, auto (level 3) downgrades to nudge for that session
  - *Motivation:* `deliberation: design tension #1` — auto-triggering consumes context; system must be smart enough to defer when context is scarce
- [ ] **AUTO-05**: Runtime-aware effective levels — statusline shows effective automation level based on runtime capability matrix (e.g., "Level 3 (eff: 2)" on Codex)
  - *Motivation:* `deliberation: design tension #5` — 2 of 4 runtimes lack hooks; users must see what level is actually achievable
- [ ] **AUTO-06**: Automation statistics tracking — lightweight counters per feature (fires, skips, skip reasons, last_triggered timestamps) persisted in config
  - *Motivation:* `deliberation: design tension #7` + `user: "how can we track how a feature is being utilized?"` — seeds data for M-B meta-observability
- [ ] **AUTO-07**: Feature manifest updated with automation config schema — all new config keys declared with types, defaults, and descriptions
  - *Motivation:* `lesson: manifest-driven config migration` — all config additions must be declared in manifest for upgrade/migration support

### Signal Collection Automation

- [ ] **SIG-01**: Signal collection auto-triggers after phase execution via execute-phase workflow postlude (not hooks), respecting automation level
  - *Motivation:* `user: "biggest automation gap"` + `pattern: signals never collected unless user remembers` — execute-phase ends without mentioning signal collection
- [ ] **SIG-02**: Auto-collection includes CI sensor in parallel spawn alongside artifact and git sensors
  - *Motivation:* `research: ARCHITECTURE.md` — CI sensor slots into existing parallel-sensor pattern in collect-signals workflow
- [ ] **SIG-03**: Reentrancy guard prevents feedback loops — lockfile-based with configurable TTL, source-tagged triggers (only phase-completion triggers collection)
  - *Motivation:* `research: PITFALLS.md #1` — auto-collect → auto-reflect → artifacts → re-trigger creates unbounded execution chains
- [ ] **SIG-04**: Command-invocation fallback for runtimes without hooks — workflow postlude works on all 4 runtimes
  - *Motivation:* `research: PITFALLS.md #4` — OpenCode and Codex CLI users get zero auto-triggering without fallback paths
- [ ] **SIG-05**: Auto-collection deferred when context exceeds threshold — nudge message instead ("run `/gsd:collect-signals` in fresh session")
  - *Motivation:* `deliberation: design tension #1` — context-aware deferral prevents context exhaustion

### Reflection Automation

- [ ] **REFL-01**: Reflection auto-triggers after configurable N phases (default: 3), respecting automation level and opt-in default (`auto_reflect: false`)
  - *Motivation:* `user: "No automatic reflection cadence"` + `research: FEATURES.md D-1` — reflection accumulates value over time; auto-triggering prevents signal debt
- [ ] **REFL-02**: Counter-based scheduling — `phases_since_last_reflect` persisted in config, incremented by execute-phase postlude, reset after reflection runs
  - *Motivation:* `research: STACK.md` — counter-based scheduling survives session restarts unlike in-memory timers
- [ ] **REFL-03**: Minimum signal threshold for auto-reflection — reflection only triggers if accumulated untriaged signals exceed configurable minimum (default: 5)
  - *Motivation:* `research: PITFALLS.md #1` — threshold prevents reflection from firing with insufficient data
- [ ] **REFL-04**: Session-scoped cooldown — maximum one auto-reflection per session to prevent context exhaustion
  - *Motivation:* `research: PITFALLS.md #1` + `lesson: les-2026-03-02-context-bloat-requires-progressive-disclosure` — reflection is expensive; one per session maximum

### Health Score & Automation

- [ ] **HEALTH-01**: Health score combines infrastructure health (binary: CI, config, KB, state freshness) and workflow health (weighted signal accumulation) into composite indicator
  - *Motivation:* `deliberation: design tension #4` — health is two-dimensional; infrastructure (binary) + workflow (weighted)
- [ ] **HEALTH-02**: Workflow health uses weighted signal accumulation — critical=1.0, notable=0.3, minor=0.1 — with pattern-level deduplication before weighting
  - *Motivation:* `user: "non-critical signals should contribute to threshold"` + `deliberation: weighted accumulation analysis`
- [ ] **HEALTH-03**: Health score displayed in statusline as traffic light (green/yellow/red) derived from composite score
  - *Motivation:* `deliberation: design tension #4` — separates awareness (constant, cheap display) from diagnosis (occasional, expensive check)
- [ ] **HEALTH-04**: Health check auto-triggers at session start when frequency is `on-resume`, respecting automation level, with session dedup via timestamp
  - *Motivation:* `research: FEATURES.md TS-4` — config already promises `on-resume` frequency but nothing wires it to hooks
- [ ] **HEALTH-05**: Health check auto-triggers as execute-phase workflow step when frequency is `every-phase`
  - *Motivation:* `research: FEATURES.md TS-4` — config already promises `every-phase` frequency but nothing wires it
- [ ] **HEALTH-06**: Reactive health check triggered on fresh session start when health score drops below configurable threshold
  - *Motivation:* `user: "can't we have it triggered by certain things going wrong?"` — reactive triggers on low health score
- [ ] **HEALTH-07**: Health check verifies automation system is functioning — checks `last_triggered` timestamps against expected cadence, surfaces stale automation as finding
  - *Motivation:* `deliberation: design tension #2 (who watches the watchmen)` — timestamp-based watchdog without infinite regress

### Extensible Sensor Architecture

- [ ] **EXT-01**: Sensor auto-discovery — collect-signals workflow discovers sensors by scanning for `gsd-*-sensor.md` files in agents directory
  - *Motivation:* `user: "enable our system to adapt and self-modify relatively easily"` + `deliberation: 6-touch-point problem` — adding a sensor currently requires editing 6 files
- [ ] **EXT-02**: Standardized sensor contract defined — input format (phase, config), output format (JSON in `## SENSOR OUTPUT` delimiters), error handling (empty array on failure), timeout behavior
  - *Motivation:* `deliberation: extensible architecture` — auto-discovery needs a contract to be reliable
- [ ] **EXT-03**: Sensor enable/disable via config — each sensor has a config toggle, disabled sensors are discovered but not spawned
  - *Motivation:* `research: ARCHITECTURE.md` — existing pattern from feature-manifest, applied to sensors
- [ ] **EXT-04**: `gsd-tools.js sensors list` command — shows discovered sensors, their enabled/disabled status, last run time, and signal count
  - *Motivation:* `deliberation: extensible architecture` — auto-discovery is harder to debug; CLI command provides observability
- [ ] **EXT-05**: Existing artifact and git sensors retroactively conformed to the standardized sensor contract
  - *Motivation:* `deliberation: extensible architecture` — consistency across all sensors validates the contract
- [ ] **EXT-06**: CI sensor built as first sensor under the new extensible model — validates the auto-discovery and contract system
  - *Motivation:* `deliberation: extensible architecture` — CI sensor is the proving ground for the new model

### Plan Intelligence

- [ ] **PLAN-01**: Plan checker validates tool subcommand existence — extracts gsd-tools.js invocations from plan actions, verifies subcommands exist via allowlist
  - *Motivation:* `signal: sig-2026-03-01-plan-checker-misses-tool-api-assumptions` — plan 34-03 referenced `frontmatter extract` subcommand that doesn't exist
- [ ] **PLAN-02**: Plan checker validates config key existence — extracts config key references from plan actions, validates against feature-manifest.json schema
  - *Motivation:* `signal: sig-2026-03-01-plan-checker-misses-second-order-effects` — plans referenced config keys that don't exist
- [ ] **PLAN-03**: Plan checker validates directory existence — checks `files_modified` paths have valid parent directories, with temporal awareness for intra-plan creates
  - *Motivation:* `lesson: les-2026-02-28-plans-must-verify-system-behavior-not-assume` — plans assert paths exist without checking
- [ ] **PLAN-04**: Plan checker validates signal references — `resolves_signals` IDs in plan frontmatter validated against KB signal index
  - *Motivation:* `research: FEATURES.md D-5` — unvalidated signal references create false remediation claims
- [ ] **PLAN-05**: All semantic validation findings are advisory severity (not blocker) — findings carry typed IDs for future correlation with execution signals
  - *Motivation:* `research: PITFALLS.md #5` — semantic checks on current state fail for plans describing future state; advisory prevents false rejections

## Future Requirements

Deferred to later milestones. Tracked but not in current roadmap.

### Meta-Observability (M-B)

- **META-01**: Log sensor implementation — parse session JSONL for tool failures, retries, frustration patterns
- **META-02**: Metrics sensor — aggregate token usage, context consumption, duration per plan
- **META-03**: Feature utilization tracking — command invocation logging with frequency analysis
- **META-04**: Token/context usage trending — historical context consumption data for efficiency analysis

### Deliberation Intelligence (M-C)

- **DELIB-01**: Formalize deliberation system — schema, index, freshness tracking, `/gsd:deliberate` command
- **DELIB-02**: Conversation trace capture from session logs — auto-extract decisions, ideas, rejected alternatives
- **DELIB-03**: Deliberation → milestone pipeline — deliberations auto-surface during `/gsd:new-milestone`
- **DELIB-04**: Backlog integration — `/gsd:backlog` slash command, integration with reflect/execute-phase
- **DELIB-05**: Lab/experiment workflow — structured experimentation bigger than spikes, with branch management

### Cross-Platform Parity (M-D)

- **XPLAT-01**: Runtime behavioral testing — validate degraded workflows on Codex/Gemini/OpenCode
- **XPLAT-02**: E2E test implementation — replace `it.todo()` stubs with real tests
- **XPLAT-03**: Capability check expansion — bake `has_capability()` checks into more workflows

### Parallelization (M-E)

- **PAR-01**: Research worktree-based phase parallelism
- **PAR-02**: Roadmapper identifies parallelizable phases
- **PAR-03**: Progressive context disclosure adopted broadly

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Real-time CI webhook listener | GSD is a CLI tool, not a service — poll-based is sufficient |
| Auto-remediation without human judgment | Premature automation risks masking root causes |
| Log sensor / metrics sensor | M-B milestone scope — requires separate design and spikes |
| Continuous background CI monitoring | Marginal value vs session-start + collection-time checks |
| Plan checker code quality assessment | CI's job, not plan checker's — different concern |
| PostToolUse hooks for signal collection | Hooks are synchronous, would freeze session — workflow postlude instead |
| Adaptive plan checker escalation (advisory → blocker) | Deferred to future milestone — v1.17 ships advisory-only with typed IDs for future correlation |
| Cross-project CI monitoring | Single-developer tool, per-project scope sufficient |
| Dialectical reasoning / contradiction detection | Future direction captured in deliberation, not v1.17 scope |
| Lab/experiment branch workflow | Needs worktree support (M-E) — captured in deliberation |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CI-01 | — | Pending |
| CI-02 | — | Pending |
| CI-03 | — | Pending |
| CI-04 | — | Pending |
| CI-05 | — | Pending |
| CI-06 | — | Pending |
| AUTO-01 | — | Pending |
| AUTO-02 | — | Pending |
| AUTO-03 | — | Pending |
| AUTO-04 | — | Pending |
| AUTO-05 | — | Pending |
| AUTO-06 | — | Pending |
| AUTO-07 | — | Pending |
| SIG-01 | — | Pending |
| SIG-02 | — | Pending |
| SIG-03 | — | Pending |
| SIG-04 | — | Pending |
| SIG-05 | — | Pending |
| REFL-01 | — | Pending |
| REFL-02 | — | Pending |
| REFL-03 | — | Pending |
| REFL-04 | — | Pending |
| HEALTH-01 | — | Pending |
| HEALTH-02 | — | Pending |
| HEALTH-03 | — | Pending |
| HEALTH-04 | — | Pending |
| HEALTH-05 | — | Pending |
| HEALTH-06 | — | Pending |
| HEALTH-07 | — | Pending |
| EXT-01 | — | Pending |
| EXT-02 | — | Pending |
| EXT-03 | — | Pending |
| EXT-04 | — | Pending |
| EXT-05 | — | Pending |
| EXT-06 | — | Pending |
| PLAN-01 | — | Pending |
| PLAN-02 | — | Pending |
| PLAN-03 | — | Pending |
| PLAN-04 | — | Pending |
| PLAN-05 | — | Pending |

**Coverage:**
- v1.17 requirements: 39 total
- Mapped to phases: 0
- Unmapped: 39

---
*Requirements defined: 2026-03-02*
*Last updated: 2026-03-02 after initial definition*
