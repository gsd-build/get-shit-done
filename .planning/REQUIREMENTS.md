# Requirements: GSD Reflect v1.17

**Defined:** 2026-03-02
**Core Value:** The system never makes the same mistake twice — signals capture what went wrong, spikes resolve uncertainty empirically, and the knowledge base surfaces relevant lessons before they're needed.

## v1.17 Requirements

Requirements for v1.17 Automation Loop. Each maps to roadmap phases.

**Motivation types:** `signal:` KB signal ID | `pattern:` reflection pattern | `lesson:` KB lesson ID | `research:` research finding | `deliberation:` design decision from deliberation | `user:` direct user request | `philosophy:` principle from philosophical deliberation (see `.planning/deliberations/philosophy/INDEX.md`)

### CI Awareness

- [ ] **CI-01**: CI wiring test fixed — `wiring-validation.test.js` checks `agents/` (npm source) not `.claude/agents/` (install target), with meta-test preventing recurrence
  - *Motivation:* `signal: sig-2026-03-02-ci-failures-ignored-throughout-v116` — 5 consecutive CI failures bypassed via admin push throughout v1.16
- [ ] **CI-02**: CI status displayed at session start via SessionStart hook — background `gh run list` check with result cached and surfaced in statusline
  - *Motivation:* `signal: sig-2026-03-02-ci-failures-ignored-throughout-v116` — system had no mechanism to make CI failures visible
  - *Motivation:* `philosophy: cybernetics/error-as-information` — error status is information the operator needs to act; display should present CI failure as actionable, not accusatory
- [ ] **CI-03**: CI sensor agent (`gsd-ci-sensor.md`) detects failed GitHub Actions runs, returning signal candidates via the standard sensor contract
  - *Motivation:* `pattern: CI failures undetected` — no sensor covers CI/CD; artifact and git sensors only analyze local artifacts
  - *Motivation:* `philosophy: falsificationism/theory-laden-observation` — sensor embeds a theory (GitHub Actions status = code quality indicator); spec should document this commitment and its blind spots
- [ ] **CI-04**: CI sensor includes `gh auth status` pre-flight with graceful degradation (empty signals + human-readable warning when unauthenticated)
  - *Motivation:* `research: PITFALLS.md #2` — gh auth assumption is a critical pitfall; sensor must not silently report "no issues" when unable to check
  - *Motivation:* `philosophy: falsificationism/auxiliary-assumptions` — sensor hypothesis depends on auth assumption; must distinguish "checked and found nothing" from "unable to check" (Duhem-Quine in miniature)
- [ ] **CI-05**: CI sensor detects branch protection bypass — commits pushed without passing CI checks are flagged as signals
  - *Motivation:* `signal: sig-2026-03-02-ci-failures-ignored-throughout-v116` — all 5 failures were admin-pushed bypassing branch protection
  - *Motivation:* `philosophy: pragmatism/abductive-inference` — sensor generates hypothesis ("protection bypassed"), not verdict ("developer violated process"); signal should include disconfirmation conditions
- [ ] **CI-06**: CI sensor detects test regression — test count drops between runs flagged as signals
  - *Motivation:* `research: FEATURES.md D-3` — beyond pass/fail, detecting removed/skipped tests catches silent quality regression

### Automation Levels

- [ ] **AUTO-01**: Unified automation level system (0=manual, 1=nudge, 2=prompt, 3=auto) configurable via `automation.level` in config.json
  - *Motivation:* `deliberation: v1.17-plus-roadmap-deliberation.md` — user identified need for coherent automation model vs scattered boolean toggles
  - *Motivation:* `philosophy: dialectics/internal-contradiction` — more automation improves coverage but consumes context needed for work; this is a permanent tension to manage, not a bug to fix; the four levels make the contradiction explicit and configurable
- [ ] **AUTO-02**: Per-feature overrides — individual features can be bumped up or down from global level via `automation.overrides`
  - *Motivation:* `deliberation: v1.17-plus-roadmap-deliberation.md` — user requested "unified levels + per-feature overrides + more refined customization"
- [ ] **AUTO-03**: Fine-grained knobs per feature — thresholds, frequencies, and intervals configurable regardless of level (e.g., `automation.reflection.threshold_phases`)
  - *Motivation:* `deliberation: v1.17-plus-roadmap-deliberation.md` — user requested finer control beyond level + override
- [ ] **AUTO-04**: Context-aware auto-triggering — if context usage exceeds configurable threshold, auto (level 3) downgrades to nudge for that session
  - *Motivation:* `deliberation: design tension #1` — auto-triggering consumes context; system must be smart enough to defer when context is scarce
  - *Motivation:* `philosophy: cybernetics/observer-effect` — observation consumes resources needed for the work being observed; context-aware deferral is the system choosing action over observation when resources are scarce
  - *Motivation:* `philosophy: dialectics/negation-of-negation` — auto-triggering (negation of manual) creates context exhaustion (new contradiction); deferral (second negation) resolves without reverting to manual
- [ ] **AUTO-05**: Runtime-aware effective levels — statusline shows effective automation level based on runtime capability matrix (e.g., "Level 3 (eff: 2)" on Codex)
  - *Motivation:* `deliberation: design tension #5` — 2 of 4 runtimes lack hooks; users must see what level is actually achievable
  - *Motivation:* `philosophy: cybernetics/requisite-variety` — the gap between configured and effective level shows exactly which capabilities are missing; honest reporting of actual regulatory variety
- [ ] **AUTO-06**: Automation statistics tracking — lightweight counters per feature (fires, skips, skip reasons, last_triggered timestamps) persisted in config
  - *Motivation:* `deliberation: design tension #7` + `user: "how can we track how a feature is being utilized?"` — seeds data for M-B meta-observability
  - *Motivation:* `philosophy: pragmatism/cash-value` — a feature that fires but never changes behavior has no pragmatic value; statistics enable evaluating whether automated features matter, not just whether they run
- [ ] **AUTO-07**: Feature manifest updated with automation config schema — all new config keys declared with types, defaults, and descriptions
  - *Motivation:* `lesson: manifest-driven config migration` — all config additions must be declared in manifest for upgrade/migration support

### Signal Collection Automation

- [ ] **SIG-01**: Signal collection auto-triggers after phase execution via execute-phase workflow postlude (not hooks), respecting automation level
  - *Motivation:* `user: "biggest automation gap"` + `pattern: signals never collected unless user remembers` — execute-phase ends without mentioning signal collection
  - *Motivation:* `philosophy: pragmatism/inquiry-cycle` — the signal-to-lesson pipeline is Dewey's inquiry cycle, currently broken at step 1 (automatic detection); without SIG-01 the system waits for the developer to notice problems, which took 23 days in the CI failure case
- [ ] **SIG-02**: Auto-collection includes CI sensor in parallel spawn alongside artifact and git sensors
  - *Motivation:* `research: ARCHITECTURE.md` — CI sensor slots into existing parallel-sensor pattern in collect-signals workflow
- [ ] **SIG-03**: Reentrancy guard prevents feedback loops — lockfile-based with configurable TTL, source-tagged triggers (only phase-completion triggers collection); source-tags must also exclude reflection-generated artifacts (REFL-01 produces reports that artifact sensor would otherwise re-ingest as inputs) `[PHIL-INTERVENTION:PI-04]`
  - *Motivation:* `research: PITFALLS.md #1` — auto-collect → auto-reflect → artifacts → re-trigger creates unbounded execution chains
  - *Motivation:* `philosophy: dialectics/negation-of-negation` — auto-collection (first negation of manual-only) creates feedback loops as its own contradiction; the reentrancy guard is the dialectical completion, not a patch; constraint should be specified alongside the feature it constrains
  - *Motivation:* `philosophy: contradictions/structural-not-bugs` — second-order reentrancy (collection → reflection → artifacts → collection) identified during contradictions analysis; the source-tag mechanism must generalize beyond first-order loops
- [ ] **SIG-04**: Command-invocation fallback for runtimes without hooks — workflow postlude works on all 4 runtimes
  - *Motivation:* `research: PITFALLS.md #4` — OpenCode and Codex CLI users get zero auto-triggering without fallback paths
  - *Motivation:* `philosophy: cybernetics/requisite-variety` — if the system only triggers via hooks, its regulatory variety is less than the variety of its runtime environments; the fallback maintains feedback closure across heterogeneous environments
- [ ] **SIG-05**: Auto-collection deferred when context exceeds threshold — nudge message instead ("run `/gsd:collect-signals` in fresh session")
  - *Motivation:* `deliberation: design tension #1` — context-aware deferral prevents context exhaustion
- [ ] **SIG-06**: Observation regime changes recorded as knowledge base entries — when auto-collection is enabled, new sensors activated, automation level changes, or signal types added, a `regime_change` entry is written to the KB with timestamp, description, and expected baseline impact
  - *Motivation:* `philosophy: cybernetics/observer-effect` — v1.17 introduces auto-collection (SIG-01), fundamentally changing the signal baseline; trend analysis across this boundary is invalid without explicit regime segmentation
  - *Motivation:* `philosophy: falsificationism/auxiliary-assumptions` — pre/post signal count comparisons assume stable observation conditions; regime changes violate this assumption and must be marked

### Reflection Automation

- [ ] **REFL-01**: Reflection auto-triggers after configurable N phases (default: 3), respecting automation level and opt-in default (`auto_reflect: false`)
  - *Motivation:* `user: "No automatic reflection cadence"` + `research: FEATURES.md D-1` — reflection accumulates value over time; auto-triggering prevents signal debt
  - *Motivation:* `philosophy: pragmatism/inquiry-cycle` — reflection is the problematization-and-hypothesis phase of Dewey's inquiry cycle; manual initiation breaks the cycle at its most critical juncture
- [ ] **REFL-02**: Counter-based scheduling — `phases_since_last_reflect` persisted in config, incremented by execute-phase postlude, reset after reflection runs
  - *Motivation:* `research: STACK.md` — counter-based scheduling survives session restarts unlike in-memory timers
- [ ] **REFL-03**: Minimum signal threshold for auto-reflection — reflection only triggers if accumulated untriaged signals exceed configurable minimum (default: 5)
  - *Motivation:* `research: PITFALLS.md #1` — threshold prevents reflection from firing with insufficient data
  - *Motivation:* `philosophy: dialectics/negative-dialectics` — resist premature synthesis; reflection on too few signals produces pattern claims without sufficient grounding; the threshold enforces that synthesis waits for enough material to be genuinely challenged by counter-evidence
- [ ] **REFL-04**: Session-scoped cooldown — maximum one auto-reflection per session to prevent context exhaustion
  - *Motivation:* `research: PITFALLS.md #1` + `lesson: les-2026-03-02-context-bloat-requires-progressive-disclosure` — reflection is expensive; one per session maximum
- [ ] **REFL-05**: Lesson confidence is mutable with directional updates — when auto-reflection runs, signals matching a lesson's predictions increase confidence one step, signals contradicting predictions decrease confidence one step; milestones where lesson was untestable produce no update; changes recorded in `confidence_history` field on lesson
  - *Motivation:* `philosophy: bayesian/belief-updating` — confidence that never changes is a label, not a credence; auto-reflection (REFL-01) produces lessons at higher frequency, requiring confidence to evolve with evidence
  - *Motivation:* `philosophy: falsificationism/corroboration-not-confirmation` — lessons that survive falsification attempts earn corroboration, not confirmation; surviving severe tests should raise confidence more than surviving weak ones
  - *Motivation:* `philosophy: pragmatism/warranted-assertibility` — a lesson untested in practice has no warrant; confidence should reflect actual use, not initial assessment
  - *Motivation:* `philosophy: dialectics/aufhebung` — lesson evolution through successive refinements is Aufhebung; each confidence update preserves the lesson while transcending its prior certainty level

### Health Score & Automation

- [ ] **HEALTH-01**: Health score combines infrastructure health (binary: CI, config, KB, state freshness) and workflow health (weighted signal accumulation) into composite indicator
  - *Motivation:* `deliberation: design tension #4` — health is two-dimensional; infrastructure (binary) + workflow (weighted)
  - *Motivation:* `philosophy: cybernetics/viable-system` — maps to Beer's System 3 (infrastructure regulation) + System 3* (workflow audit); keeping dimensions separate preserves their different operational meanings
- [ ] **HEALTH-02**: Workflow health uses weighted signal accumulation — critical=1.0, notable=0.3, minor=0.1 — with pattern-level deduplication before weighting
  - *Motivation:* `user: "non-critical signals should contribute to threshold"` + `deliberation: weighted accumulation analysis`
  - *Motivation:* `philosophy: bayesian/prior-sensitivity` — severity weights are an implicit prior about how much each signal class shifts health assessment; weights should be treated as calibratable, not fixed; pattern dedup prevents correlated evidence from inflating the score
- [ ] **HEALTH-03**: Health score displayed in statusline as traffic light (green/yellow/red) derived from composite score; health check output includes standing caveat: "Health checks measure known categories. Absence of findings does not mean absence of problems." `[PHIL-INTERVENTION:PI-03]`
  - *Motivation:* `deliberation: design tension #4` — separates awareness (constant, cheap display) from diagnosis (occasional, expensive check)
  - *Motivation:* `philosophy: contradictions/health-is-instrument` — health metrics are practical instruments, not metaphysical claims about system state; the caveat prevents a green light from creating false confidence about unmeasured dimensions
- [ ] **HEALTH-04**: Health check auto-triggers at session start when frequency is `on-resume`, respecting automation level, with session dedup via timestamp
  - *Motivation:* `research: FEATURES.md TS-4` — config already promises `on-resume` frequency but nothing wires it to hooks
- [ ] **HEALTH-05**: Health check auto-triggers as execute-phase workflow step when frequency is `every-phase`
  - *Motivation:* `research: FEATURES.md TS-4` — config already promises `every-phase` frequency but nothing wires it
- [ ] **HEALTH-06**: Reactive health check triggered on fresh session start when health score drops below configurable threshold
  - *Motivation:* `user: "can't we have it triggered by certain things going wrong?"` — reactive triggers on low health score
- [ ] **HEALTH-07**: Health check verifies automation system is functioning — checks `last_triggered` timestamps against expected cadence, surfaces stale automation as finding
  - *Motivation:* `deliberation: design tension #2 (who watches the watchmen)` — timestamp-based watchdog without infinite regress
  - *Motivation:* `philosophy: cybernetics/second-order-observation` — the observer observing the observation apparatus; deliberately one-level-deep recursion, not an oversight; deeper meta-observation deferred until evidence suggests sensor accuracy is a real problem
- [ ] **HEALTH-08**: Signal-to-resolution ratio tracked as workflow health metric — ratio of signals detected to signals resolved (triaged + remediated + verified), surfaced in health check output when ratio exceeds configurable threshold (default: 5:1); ratio computation respects SIG-06 regime boundaries (regime changes reset the accumulation window to avoid conflating detection improvement with resolution degradation) `[PHIL-INTERVENTION:PI-02]`
  - *Motivation:* `philosophy: pragmatism/inquiry-cycle` — a system that detects signals faster than it resolves them is not conducting effective inquiry; the ratio indicates whether the automation loop is completing or merely generating noise
  - *Motivation:* `philosophy: cybernetics/error-as-information` — unresolved signals are unconsumed information; the ratio measures information throughput, not just information generation
  - *Motivation:* `philosophy: contradictions/health-is-instrument` — regime-awareness added after contradictions analysis identified that HEALTH-08 was regime-insensitive while HEALTH-09 was regime-aware; without this, enabling auto-collection would spike the ratio due to detection improvement, not resolution degradation
- [ ] **HEALTH-09**: Signal density trend tracked within observation regime — signals-per-phase computed and compared to rolling average within current regime, with upward trend flagged as health finding
  - *Motivation:* `philosophy: cybernetics/observer-effect` — trend analysis only valid within stable observation regimes; requires SIG-06 regime boundaries
  - *Motivation:* `philosophy: lakatos/degeneration-detection` — increasing signal density within a stable regime suggests remediation is not preventing recurrence (degenerating); decreasing density suggests the improvement loop is working (progressive)

### Extensible Sensor Architecture

- [ ] **EXT-01**: Sensor auto-discovery — collect-signals workflow discovers sensors by scanning for `gsd-*-sensor.md` files in agents directory
  - *Motivation:* `user: "enable our system to adapt and self-modify relatively easily"` + `deliberation: 6-touch-point problem` — adding a sensor currently requires editing 6 files
  - *Motivation:* `philosophy: pragmatism/do-not-block-inquiry` — Peirce's first rule of logic: never have a closed set of things the system can notice; hardcoded sensor wiring is epistemological closure
  - *Motivation:* `philosophy: cybernetics/requisite-variety` — auto-discovery makes variety expansion cheap; the system's sensor variety should grow toward matching the problem space's variety
- [ ] **EXT-02**: Standardized sensor contract defined — input format (phase, config), output format (JSON in `## SENSOR OUTPUT` delimiters), error handling (empty array on failure), timeout behavior
  - *Motivation:* `deliberation: extensible architecture` — auto-discovery needs a contract to be reliable
  - *Motivation:* `philosophy: falsificationism/theory-laden-observation` — the contract is where theoretical commitments become operational; sensors should declare what theory of failure they embody
- [ ] **EXT-03**: Sensor enable/disable via config — each sensor has a config toggle, disabled sensors are discovered but not spawned
  - *Motivation:* `research: ARCHITECTURE.md` — existing pattern from feature-manifest, applied to sensors
- [ ] **EXT-04**: `gsd-tools.js sensors list` command — shows discovered sensors, their enabled/disabled status, last run time, and signal count
  - *Motivation:* `deliberation: extensible architecture` — auto-discovery is harder to debug; CLI command provides observability
  - *Motivation:* `philosophy: cybernetics/autopoietic-categories` — the system defines its own perceptual field through sensors; `sensors list` makes this boundary visible to the operator, enabling blind spot audits
- [ ] **EXT-05**: Existing artifact and git sensors retroactively conformed to the standardized sensor contract
  - *Motivation:* `deliberation: extensible architecture` — consistency across all sensors validates the contract
- [ ] **EXT-06**: CI sensor built as first sensor under the new extensible model — validates the auto-discovery and contract system
  - *Motivation:* `deliberation: extensible architecture` — CI sensor is the proving ground for the new model
  - *Motivation:* `philosophy: lakatos/novel-prediction` — the extensible architecture predicts CI sensor can be built without framework modification; if special-case handling is needed, the architecture's prediction failed and the belt needs modification
- [ ] **EXT-07**: Sensor contract (EXT-02) includes a `blind_spots` declaration — each sensor agent spec documents what classes of problems the sensor is structurally unable to detect, making sensor limitations visible and enabling gap analysis
  - *Motivation:* `philosophy: falsificationism/theory-laden-observation` — every sensor embodies a theory about what counts as a problem; documenting blind spots makes theory-ladenness visible and auditable
  - *Motivation:* `philosophy: cybernetics/requisite-variety` — the gap between sensor variety and problem variety can only be assessed when sensor limitations are explicit
  - *Motivation:* `philosophy: pragmatism/abductive-inference` — sensors generate hypotheses from observations; the quality of abduction depends on knowing the observation's limitations

### Plan Intelligence

- [ ] **PLAN-01**: Plan checker validates tool subcommand existence — extracts gsd-tools.js invocations from plan actions, verifies subcommands exist via allowlist
  - *Motivation:* `signal: sig-2026-03-01-plan-checker-misses-tool-api-assumptions` — plan 34-03 referenced `frontmatter extract` subcommand that doesn't exist
  - *Motivation:* `philosophy: falsificationism/falsifiable-predictions` — every plan that invokes a tool subcommand implicitly predicts "this subcommand exists"; the checker converts implicit, untested claims into explicit, tested ones
- [ ] **PLAN-02**: Plan checker validates config key existence — extracts config key references from plan actions, validates against feature-manifest.json schema
  - *Motivation:* `signal: sig-2026-03-01-plan-checker-misses-second-order-effects` — plans referenced config keys that don't exist
- [ ] **PLAN-03**: Plan checker validates directory existence — checks `files_modified` paths have valid parent directories, with temporal awareness for intra-plan creates
  - *Motivation:* `lesson: les-2026-02-28-plans-must-verify-system-behavior-not-assume` — plans assert paths exist without checking
- [ ] **PLAN-04**: Plan checker validates signal references — `resolves_signals` IDs in plan frontmatter validated against KB signal index
  - *Motivation:* `research: FEATURES.md D-5` — unvalidated signal references create false remediation claims
- [ ] **PLAN-05**: All semantic validation findings are advisory severity (not blocker) — findings carry typed IDs for future correlation with execution signals
  - *Motivation:* `research: PITFALLS.md #5` — semantic checks on current state fail for plans describing future state; advisory prevents false rejections
  - *Motivation:* `philosophy: dialectics/negative-dialectics` — advisory findings resist premature synthesis ("this plan is wrong"); the plan may accommodate the anomaly in a later step; typed IDs preserve findings as open questions, not closed judgments
  - *Motivation:* `philosophy: lakatos/no-crucial-test` — no single validation finding proves a plan is bad; advisory approach tracks findings for pattern detection across plans rather than treating each as decisive

### Template Traceability

- [ ] **TMPL-01**: Requirements template includes motivation citation field — each requirement cites its source (signal, pattern, lesson, research, deliberation, user request, philosophy)
  - *Motivation:* `signal: sig-2026-03-02-requirements-lack-motivation-traceability` — requirements had no formal linkage to motivating evidence
  - *Motivation:* `philosophy: dialectics/praxis` — the motivation field is the mechanism that makes praxis visible; theory and practice united through a traceable chain; every requirement without a motivation is a break in the praxis circuit
- [ ] **TMPL-02**: SUMMARY.md template includes `model` field in frontmatter — records which model executed the plan, enabling model-quality correlation
  - *Motivation:* `signal: sig-2026-03-02-quality-profile-sonnet-executor-mismatch` + `pattern: Config/Model Selection Mismatches` — SUMMARY.md has no model field
- [ ] **TMPL-03**: SUMMARY.md template includes `context_used_pct` field — records context window usage at plan completion, enabling context efficiency analysis
  - *Motivation:* `deliberation: design tension #1` — context usage is displayed but never persisted
- [ ] **TMPL-04**: Reflection report links findings to requirement IDs where applicable — closed-loop traceability from signal → reflection → requirement → phase → verification
  - *Motivation:* `deliberation: requirement motivation traceability` — the loop needs to close in both directions
  - *Motivation:* `philosophy: pragmatism/inquiry-cycle` — closes the inquiry cycle backward; TMPL-01 traces requirements to evidence (forward), TMPL-04 traces findings back to requirements (backward); without TMPL-04 the system cannot evaluate whether a requirement's implementation resolved the motivating problem
- [ ] **TMPL-05**: Feature specifications include an "Internal Tensions" section for architecturally significant features — identifies what contradiction or new problem the feature introduces and what constraint mechanism addresses it; applied selectively (not to wiring or infrastructure requirements); tensions that resist template capture should be recorded in deliberation documents instead `[PHIL-INTERVENTION:PI-05]`
  - *Motivation:* `philosophy: dialectics/negation-of-negation` — every fix introduces its own contradiction; a spec that does not identify the contradiction it creates is incomplete
  - *Motivation:* `philosophy: dialectics/internal-contradiction` — making tensions explicit prevents surprise when constraint mechanisms are needed; already implicitly followed in v1.17 (SIG-03 names the feedback loop, AUTO-04 names context exhaustion) but should be a standard template section
  - *Motivation:* `philosophy: contradictions/structural-not-bugs` — TMPL-05's own tension (formalization vs domestication of contradiction) acknowledged; selectivity clause and deliberation escape hatch prevent the template from reducing all tensions to checkboxes

## Future Requirements

Deferred to later milestones. Tracked but not in current roadmap.

### Meta-Observability (M-B)

- **META-01**: Log sensor implementation — parse session JSONL for tool failures, retries, frustration patterns
- **META-02**: Metrics sensor — aggregate token usage, context consumption, duration per plan
- **META-03**: Feature utilization tracking — command invocation logging with frequency analysis
- **META-04**: Token/context usage trending — historical context consumption data for efficiency analysis
- **META-05**: Falsification conditions on lessons — `falsification_conditions` field defining what would disprove the lesson (`philosophy: falsificationism/falsifiable-predictions`)
- **META-06**: Severe test preference — verification distinguishes weak tests (non-recurrence) from severe tests (non-recurrence despite triggering conditions) (`philosophy: falsificationism/severe-tests`)
- **META-07**: Corroboration tracking — survived-falsification-attempt count on lessons, replacing/supplementing static confidence (`philosophy: falsificationism/corroboration-not-confirmation`)
- **META-08**: Graduated epistemic status — lesson lifecycle: conjectured → weakly-corroborated → corroborated → falsified → superseded (`philosophy: falsificationism/verisimilitude-through-revision`)
- **META-09**: Warrant decay on lessons — `last_validated` timestamp, dormant/expired states for untested lessons (`philosophy: pragmatism/warranted-assertibility`)
- **META-10**: Lesson effectiveness tracking — surfacing count vs influence on plans, measuring cash value (`philosophy: pragmatism/cash-value`)
- **META-11**: Active verification — check for presence of predicted improvement, not just absence of recurrence (`philosophy: pragmatism/inquiry-cycle`)
- **META-12**: Prediction outcome tracking — record predictions and their outcomes for calibration (`philosophy: bayesian/calibration`)
- **META-13**: Evidence independence assessment at lesson creation — flag correlated evidence sources (`philosophy: bayesian/evidence-independence`)
- **META-14**: Improvement trajectory assessment — milestone-level progressive vs degenerating analysis (`philosophy: lakatos/programme-trajectory`)
- **META-15**: Developer adaptation tracking — signal rate changes after lessons surfaced (`philosophy: cybernetics/structural-coupling`)
- **META-16**: Degenerating spiral detection — long-term trend analysis across milestones (`philosophy: cybernetics/degenerating-spiral`)

### Deliberation Intelligence (M-C)

- **DELIB-01**: Formalize deliberation system — schema, index, freshness tracking, `/gsd:deliberate` command
- **DELIB-02**: Conversation trace capture from session logs — auto-extract decisions, ideas, rejected alternatives
- **DELIB-03**: Deliberation → milestone pipeline — deliberations auto-surface during `/gsd:new-milestone`
- **DELIB-04**: Backlog integration — `/gsd:backlog` slash command, integration with reflect/execute-phase
- **DELIB-05**: Lab/experiment workflow — structured experimentation bigger than spikes, with branch management
- **DELIB-06**: Hypothesis framing for `resolves_signals` — record auxiliary assumptions alongside remediation claims (`philosophy: falsificationism/auxiliary-assumptions`)
- **DELIB-07**: Lesson lineage and supersession tracking — track how lessons evolve through successive refinements (`philosophy: falsificationism/verisimilitude-through-revision`)
- **DELIB-08**: Asymmetric dismissal justification — elevated justification when signal contradicts lesson (`philosophy: falsificationism/asymmetric-evidence`)
- **DELIB-09**: Cross-project contradiction detection — identify conflicting lessons across projects (`philosophy: pragmatism/community-of-inquiry`)
- **DELIB-10**: Lesson coherence checks — detect local inconsistencies within the KB (`philosophy: bayesian/coherence`)
- **DELIB-11**: Programme trajectory assessment — retrospective metrics across milestones (`philosophy: lakatos/programme-trajectory`)
- **DELIB-12**: Hard core vs protective belt distinction in retrospectives (`philosophy: lakatos/hard-core-protection`)
- **DELIB-13**: Novel prediction requirements for major features (`philosophy: lakatos/novel-prediction`)
- **DELIB-14**: Positive heuristic protection — proactive-to-reactive ratio tracking (`philosophy: lakatos/positive-heuristic`)
- **DELIB-15**: Signal type taxonomy as living boundary — periodic review of perceptual categories (`philosophy: cybernetics/autopoietic-categories`)
- **DELIB-16**: Praxis circuit formalization — deliberation → requirement → signal → deliberation tracking (`philosophy: dialectics/praxis`)
- **DELIB-17**: Preserve the non-identical — residue field in pattern output for signals that resist synthesis (`philosophy: dialectics/negative-dialectics`)
- **DELIB-18**: Name contradictions in design documents — template requirement for tension documentation (`philosophy: dialectics/internal-contradiction`)

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
| CI-01 | Phase 36 | Pending |
| CI-02 | Phase 39 | Pending |
| CI-03 | Phase 39 | Pending |
| CI-04 | Phase 39 | Pending |
| CI-05 | Phase 39 | Pending |
| CI-06 | Phase 39 | Pending |
| AUTO-01 | Phase 37 | Pending |
| AUTO-02 | Phase 37 | Pending |
| AUTO-03 | Phase 37 | Pending |
| AUTO-04 | Phase 37 | Pending |
| AUTO-05 | Phase 37 | Pending |
| AUTO-06 | Phase 37 | Pending |
| AUTO-07 | Phase 37 | Pending |
| SIG-01 | Phase 40 | Pending |
| SIG-02 | Phase 40 | Pending |
| SIG-03 | Phase 40 | Pending |
| SIG-04 | Phase 40 | Pending |
| SIG-05 | Phase 40 | Pending |
| SIG-06 | Phase 40 | Pending |
| REFL-01 | Phase 42 | Pending |
| REFL-02 | Phase 42 | Pending |
| REFL-03 | Phase 42 | Pending |
| REFL-04 | Phase 42 | Pending |
| REFL-05 | Phase 42 | Pending |
| HEALTH-01 | Phase 41 | Pending |
| HEALTH-02 | Phase 41 | Pending |
| HEALTH-03 | Phase 41 | Pending |
| HEALTH-04 | Phase 41 | Pending |
| HEALTH-05 | Phase 41 | Pending |
| HEALTH-06 | Phase 41 | Pending |
| HEALTH-07 | Phase 41 | Pending |
| HEALTH-08 | Phase 41 | Pending |
| HEALTH-09 | Phase 41 | Pending |
| EXT-01 | Phase 38 | Pending |
| EXT-02 | Phase 38 | Pending |
| EXT-03 | Phase 38 | Pending |
| EXT-04 | Phase 38 | Pending |
| EXT-05 | Phase 38 | Pending |
| EXT-06 | Phase 39 | Pending |
| EXT-07 | Phase 38 | Pending |
| PLAN-01 | Phase 43 | Pending |
| PLAN-02 | Phase 43 | Pending |
| PLAN-03 | Phase 43 | Pending |
| PLAN-04 | Phase 43 | Pending |
| PLAN-05 | Phase 43 | Pending |
| TMPL-01 | Phase 43 | Pending |
| TMPL-02 | Phase 43 | Pending |
| TMPL-03 | Phase 43 | Pending |
| TMPL-04 | Phase 43 | Pending |
| TMPL-05 | Phase 43 | Pending |

**Coverage:**
- v1.17 requirements: 49 total (43 original + 6 philosophically-motivated)
- Mapped to phases: 49
- Unmapped: 0
- Requirements with philosophical annotations: 26 of 49

## Philosophical Interventions

Traceable modifications made during the contradictions analysis (2026-03-03). Each is tagged `[PHIL-INTERVENTION:PI-NN]` in the requirement text for grepability. These interventions are tracked separately so future milestones can empirically evaluate whether philosophy-driven changes produced better outcomes than they would have without the intervention.

**Evaluation method:** During v1.17 verification and post-milestone reflection, compare intervention-tagged requirements against non-intervention requirements on: rework rate, deviation count during execution, and whether the intervention's specific prediction held.

| ID | Requirement | Intervention | Falsifiable Prediction | Source |
|----|------------|--------------|----------------------|--------|
| PI-01 | REFL-05, SIG-06, HEALTH-08, HEALTH-09, EXT-07, TMPL-05 | 6 new requirements added from philosophical praxis recommendations | Philosophically-motivated requirements will have equal or lower rework rates than signal/research-motivated requirements | `contradictions-in-v17-requirements.md` meta-contradiction |
| PI-02 | HEALTH-08 | Added regime-awareness to resolution ratio (respects SIG-06 boundaries) | Without this, enabling auto-collection would produce a misleading ratio spike that triggers unnecessary health warnings | `contradictions-in-v17-requirements.md` contradiction #3 |
| PI-03 | HEALTH-03 | Added standing caveat to health check output ("absence of findings ≠ absence of problems") | The caveat will prevent at least one instance of false confidence from a green health check during v1.17 | `contradictions-in-v17-requirements.md` contradiction #3, Adornian analysis |
| PI-04 | SIG-03 | Extended reentrancy guard to exclude reflection-generated artifacts | Without this, the REFL-01 → artifact sensor → SIG-01 second-order loop would fire within the first 3 phases of auto-collection being active | `contradictions-in-v17-requirements.md` contradiction #4 |
| PI-05 | TMPL-05 | Added selectivity clause and deliberation escape hatch | Without selectivity, >50% of TMPL-05 sections would be perfunctory ("no tensions identified") on simple wiring requirements, providing no design insight | `contradictions-in-v17-requirements.md` contradiction #5, Adornian analysis |

### Structural Tensions (Carried, Not Resolved)

These contradictions were identified during philosophical analysis and deliberately NOT resolved with additional requirements. They are structural features of a self-observing system. Resolution would falsify the situation (`philosophy: contradictions/structural-not-bugs`).

| Tension | Why it resists resolution | How to monitor |
|---------|--------------------------|----------------|
| Auto-triggering vs context conservation | No neutral standpoint for evaluating the tradeoff; the system judges by its own categories | Track whether nudge-mode (degraded) actually leads to user action; if nudges are always ignored, the degradation is ad hoc (`lakatos/degeneration-detection`) |
| Self-improvement vs self-perpetuation | System cannot step outside its own categories to evaluate category adequacy | Signal density trend (HEALTH-09) provides partial evidence; user judgment remains irreducible (`contradictions/user-irreducibility`) |
| Health as totalizing concept | Every new dimension confesses the previous formulation was inadequate | Track whether health findings produce actionable responses; if green lights coexist with user-reported problems, the concept is degenerating |

---
*Requirements defined: 2026-03-02*
*Last updated: 2026-03-03 after roadmap creation (49/49 requirements mapped to Phases 36-43)*
