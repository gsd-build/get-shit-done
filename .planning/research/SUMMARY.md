# Project Research Summary

**Project:** declare-cc (Declare)
**Domain:** Future-driven declarative planning engine (DAG-based agentic development)
**Researched:** 2026-02-15
**Confidence:** MEDIUM

## Executive Summary

Declare is a meta-prompting engine that brings Werner Erhard's ontological model (future-based language, integrity as workability, performance = alignment x integrity) to AI-assisted development. Unlike traditional project management that plans forward from requirements, Declare works backward from declared futures through a three-layer DAG (declarations > milestones > actions). The system asks "what must be true?" and "what actions would cause that truth?" rather than "what tasks are next?"

The core technical challenge is building a backward-derivation engine that produces materially different plans from traditional forward planning—not just adding ontological vocabulary to regular task lists. This requires a custom DAG implementation (general-purpose graph libraries don't model Declare's causal hierarchy), sophisticated AI prompting that guides users through ontological distinctions without teaching philosophy, and careful forking from GSD to preserve proven execution patterns while replacing the planning model entirely.

The primary risk is ontology leakage: if users encounter Erhard/Vanto terminology before experiencing the value, they bounce. The ontology must be embedded in structure (how the system works) not exposed in surface (what users name or categorize). A secondary risk is declarative planning collapsing into imperative planning with extra steps—building "declare a future" is trivial; building a system that genuinely derives from futures is genuinely hard. Success requires investing 60%+ of architecture effort in the backward-reasoning engine, not the declaration UX.

## Key Findings

### Recommended Stack

**Philosophy: Zero-dependency core, vendored when needed.** GSD's runtime is dependency-free; Declare preserves this by bundling all dependencies via esbuild into a single distributable file. The published npm package stays zero-dependency. Users never run npm install in their `.claude/` directory.

**Core technologies:**
- **Node.js >= 18.0.0**: LTS baseline with native fetch, structuredClone, node:test. Broader compatibility than requiring Node 22.
- **JavaScript (CommonJS) + JSDoc**: TypeScript adds build complexity for files executed directly in `~/.claude/`. JSDoc + @ts-check gives 80% of TS benefits with zero build overhead.
- **Custom DAG engine**: General-purpose graph libraries (graphlib, dagre) don't model Declare's domain-specific 3-layer hierarchy. The operations needed (topological sort, cycle detection, critical path) are implementable in ~300 lines. The DAG is Declare's core differentiator—outsourcing it creates permanent impedance mismatch.
- **gray-matter (^4.0.3)**: De facto standard for YAML frontmatter. Replaces GSD's hand-rolled parsing (~100 lines of regex) with tested edge-case handling.
- **yaml (^2.8.2)**: Modern YAML 1.2 serialization for structured config beyond frontmatter (DAG state, integrity logs).
- **zod (^4.3.6)**: Schema validation for DAG state, config files, frontmatter. Catches corrupted state at load time.
- **esbuild (^0.27.0)**: Already in GSD. Bundles dependencies into single CJS files with sub-second builds.

**What NOT to use:**
- TypeScript, ESM (conflicts with Claude Code/OpenCode/Gemini config directory expectations)
- CLI frameworks (commander, yargs) — Declare is AI-agent-invoked, not user-facing
- chalk/picocolors — output consumed by AI agents, raw ANSI codes sufficient
- graphlib/dagre — general-purpose, doesn't model causal hierarchy
- SQLite/LevelDB — file-based state is human-readable and git-diffable
- jest/vitest — node:test built-in and sufficient

**Total bundled size:** ~150KB minified (gray-matter ~30KB, yaml ~60KB, zod ~50KB, toposort ~2KB if used).

### Expected Features

**Must have (table stakes):**
- **Future Declaration System**: Guided creation flow where users declare constellation of truths true when project succeeds. The entire product promise.
- **Three-Layer DAG**: Declarations > Milestones > Actions with edges representing causation (actions CAUSE milestones, milestones REALIZE declarations).
- **Backward Derivation Engine**: AI-assisted derivation of "what must be true?" from declarations to milestones, "what must be done?" from milestones to actions.
- **DAG-Aware Execution**: Topological sort for ordering, parallel execution of independent branches, wave-based scheduling.
- **Integrity Tracking**: Commitments made explicit, honor protocol when broken (acknowledge, inform, clean up, renegotiate). Not punitive—about wholeness.
- **Alignment Tracking**: Shared future document both human and AI reference. Active checks when work diverges from declared future.
- **Performance Scoring**: alignment x integrity = performance. Start qualitative (HIGH/MEDIUM/LOW) before numerical.
- **CLI Integration**: Slash commands for Claude Code, forked from GSD infrastructure.
- **State Persistence**: `.planning/` directory with DAG as readable markdown, git-diffable.

**Should have (competitive differentiators):**
- **Past-Detection Engine**: Detects when "futures" are actually past-derived ("I want X because Y sucks") and guides through clearing. The killer feature—no other tool does this.
- **Occurrence Checks**: AI periodically asks "does this still occur as what we declared?" Catches drift before it compounds.
- **Causal Reasoning (Why-Chain)**: Every action traces through milestones to declaration. "Why am I doing this?" always has an answer.
- **Declaration Constellation Visualization**: DAG view showing declarations as interconnected web, not list. CLI-first means ASCII/text-based initially.
- **Renegotiation Protocol**: When integrity breaks, system guides through structured renegotiation, not just logging failure.
- **Integrity Cascade Warnings**: When one commitment breaks, show what else is at risk via DAG traversal.

**Defer (v2+):**
- **Clearing Conversations**: Sophisticated conversational AI through Vanto's Assess > Clear > Create cycle. High risk of being preachy if done poorly.
- **Default Future Detection**: Requires meaningful velocity data from multiple projects to project where things are actually headed vs. declared.
- **Declaration-Driven Prioritization**: Score actions by causal contribution to declarations. Needs mature DAG with enough actions to make prioritization non-trivial.
- **Team/Multi-User Mode**: Alignment model becomes dramatically more complex with multiple humans. Validate solo first.

**Anti-features (deliberately NOT building):**
- Gantt charts/timeline views (contradict declarative model)
- Time estimates/story points (anchor in past, become constraining commitments)
- Sprint/iteration cycles (arbitrary time-boxes fragment future-driven work)
- Kanban boards (reduces work to status transitions, loses causal WHY)
- Jira/Linear/Asana integration (embody the past-derived model Declare replaces)
- Detailed progress percentages (false precision; 50% actions ≠ 50% future realized)

### Architecture Approach

**Core pattern: Three-layer DAG engine wrapped in meta-prompting CLI shell, forked from GSD's proven orchestration patterns.**

**Major components:**
1. **DAG Engine** (`declare-tools.cjs`): Heart of system. Stores declarations/milestones/actions as nodes with upward causation edges (action → milestone → declaration). Operations: parse, validate, topological sort, derive-milestones, derive-actions, add-node, add-edge, wave-plan, impact analysis, coverage checks.
2. **Artifact Layer** (`.planning/`): Git-backed markdown persistence. FUTURE.md (declarations only, aspirational), DAG.md (graph structure, operational), INTEGRITY.md (commitment state machine), ALIGNMENT.md (drift detection), milestone-scoped directories for PLAN.md files.
3. **Agent Pool**: Extended from GSD with additions. `declare-deriver` replaces `gsd-roadmapper` with backward derivation. New agents: `declare-aligner` (occurrence checks), `declare-integrity-keeper` (honor protocol), `declare-assessor` (past-detection).
4. **Integrity Tracker**: State machine for commitments (ACTIVE → KEPT/HONORED/BROKEN/RENEGOTIATED). Honors Erhard's model where honoring broken commitments preserves integrity.
5. **Alignment Monitor**: Drift detection triggers when action has no causation path to declaration, declaration has no milestones, or occurrence check reveals declaration no longer resonates.
6. **CLI Shell**: Slash commands mapped from GSD. `/declare:new-project` initializes with futures not requirements. `/declare:derive` does backward derivation. `/declare:execute` runs DAG wave. New: `/declare:future`, `/declare:integrity`, `/declare:align`, `/declare:honor`.
7. **Orchestrator**: Workflow sequencing, agent spawning, gate enforcement. Mediates between CLI, agents, DAG engine, and artifacts.

**Key architectural decisions:**
- Markdown tables for DAG storage (not JSON/database) — human-readable, git-diffable, agent-parseable
- Separate FUTURE.md (stable, aspirational) from DAG.md (operational, changes constantly)
- Milestone-scoped directories (not phase-numbered) — reflects DAG structure over linear sequence
- Upward edges (causes/realizes) with inverted traversal for execution ordering
- Integrity as state machine (not boolean) — captures full Erhard model
- Alignment as continuous monitoring (not one-time check) — drift accumulates silently

**Data flow:** User declares future → deriver derives milestones ("what must be true?") → deriver derives actions ("what causes truth?") → DAG engine registers graph → topological sort produces execution waves → planner creates PLAN.md → executor runs → verifier checks upward causation → integrity/alignment scoring updates.

### Critical Pitfalls

1. **The Ontology Becomes the Product Instead of a Lens**: System surfaces Erhard/Vanto terminology as UI concepts users must learn. Becomes philosophy course, not productivity tool. **Prevention:** Ontology must be invisible until useful. Design around verbs not nouns. Test with people who never read Erhard. Keep 3-term jargon budget max.

2. **Declarative Planning Collapses Into Imperative Planning With Extra Steps**: "Declare future, plan toward it" degrades into "write goal, make task list." System adds ceremony but produces same linear plans. **Prevention:** Define concretely what "future-derived" means computationally. Build derivation-diff tests proving plans differ structurally from requirements-driven approach. Invest 60%+ effort in backward-reasoning engine.

3. **DAG Complexity Overwhelms the User**: Rich dependency graph becomes too complex to understand, modify, or debug. Users can't answer "why is this here?" **Prevention:** Hard cap 3 node types in v1 (declarations, milestones, actions). DAG should be implicit—users edit declarations, system manages graph. Aggressive pruning of completed paths.

4. **Integrity Tracking Becomes Punitive**: System presents commitments as scorecard/judgment. Tool makes users feel bad, they avoid it. **Prevention:** Never display integrity as score. Response to broken commitments: "What do you want to do about it?" not "Your reliability is down 5%." Build full integrity cycle: declare → breakdown → acknowledge → restore. Tone: trusted sparring partner, not disappointed parent.

5. **Fork Drift Makes GSD Patterns Unreachable**: Immediate divergence from GSD core patterns (file structure, agent protocols, state management) makes merging GSD improvements impossible. Lose battle-tested execution model. **Prevention:** Write FORK-BOUNDARY.md before any code changes. List exactly which modules keep as-is, extend, or replace. Keep GSD as upstream remote. Extend don't replace—wrap GSD commands, don't rewrite.

6. **"Future Detection" Becomes AI Hallucination Factory**: AI tries to classify "past-derived" vs "genuine future" declarations. Classification unreliable, users lose trust, argue with system about intentions. **Prevention:** DO NOT BUILD A FUTURE DETECTOR. The distinction lives in the person, not the text. Build Socratic prompts that help users make the distinction: "Is this something you're reacting to, or creating?" AI asks questions, never renders verdict.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Foundation (Data Model + Core Infrastructure)
**Rationale:** Everything depends on the data model and storage format. Getting this wrong means rebuilding everything later. The DAG is Declare's differentiator—it must be right from day one.

**Delivers:**
- Artifact layer (`.planning/` directory structure, templates)
- DAG engine core (parse, validate, add-node, add-edge operations)
- FUTURE.md + DAG.md format specification
- Fork boundary definition (FORK-BOUNDARY.md)

**Addresses from research:**
- Custom DAG implementation (not graphlib) with 3-node-type structure
- Markdown-first persistence (human-readable, git-diffable)
- Separation of aspirational (FUTURE.md) from operational (DAG.md)

**Avoids:**
- **Pitfall 3** (DAG complexity) — hard cap 3 node types, keep structure minimal
- **Pitfall 5** (fork drift) — define boundary before any code changes
- **Pitfall 9** (ignoring CLI-first) — text commands and markdown as UI
- **Pitfall 13** (premature abstraction) — minimal Future data type

### Phase 2: Backward Derivation (The Core Innovation)
**Rationale:** This IS the product. If backward derivation doesn't work, everything else is just GSD with different words. Must prove the engine produces materially different plans from traditional forward planning before building any other features.

**Delivers:**
- Declaration parsing (FUTURE.md authoring UX)
- Backward derivation engine (`declare-deriver` agent)
- DAG population (milestones from declarations, actions from milestones)
- Derivation-diff tests (proof system differs from forward planning)

**Uses from stack:**
- gray-matter for frontmatter parsing
- Custom DAG operations (derive-milestones, derive-actions)
- AI prompting patterns for backward reasoning

**Implements:**
- Backward derivation pattern (architecture)
- Upward edge verification pattern
- Commitment-as-edge pattern

**Avoids:**
- **Pitfall 1** (ontology as product) — no jargon in UX, verbs not nouns
- **Pitfall 2** (collapse to imperative) — derivation-diff tests mandatory
- **Pitfall 6** (future detection) — Socratic prompts only, no classification
- **Pitfall 8** (tracking before engine) — NO integrity tracking yet

### Phase 3: Execution Pipeline (Leverage GSD Patterns)
**Rationale:** Most of GSD's execution machinery (planning, execution, verification) can be reused. The difference is execution respects DAG topology (waves from topological sort) instead of linear phase sequence. This phase has lowest uncertainty—GSD already solved these problems.

**Delivers:**
- Topological sort + wave planning (execution ordering from DAG)
- Action planning (`declare-planner` agent, PLAN.md creation)
- Action execution (`declare-executor` agent, reuses GSD executor)
- Upward verification (`declare-verifier` agent, checks causation chain)

**Uses from stack:**
- GSD's plan-as-prompt pattern
- GSD's atomic commit model
- GSD's goal-backward verification
- node:child_process for git operations

**Implements:**
- DAG-aware execution (respects topology, not linear order)
- Wave-based parallel execution (inherited from GSD)
- Upward edge verification after each action

**Avoids:**
- **Pitfall 5** (fork drift) — wraps GSD executors, doesn't replace
- **Pitfall 7** (meta-prompting depth) — max 2 prompt layers, plans stay editable

### Phase 4: Integrity System (Erhard Model Implementation)
**Rationale:** Can only be layered on after execution works. Integrity tracking without working execution is tracking commitments to plans that aren't genuinely future-derived. Must prove the core loop (declare → derive → execute → verify) before adding integrity layer.

**Delivers:**
- Commitment tracking (INTEGRITY.md, state machine)
- Honor protocol (break detection, guided resolution)
- Integrity scoring (qualitative: HIGH/MEDIUM/LOW)
- `/declare:integrity` and `/declare:honor` commands

**Uses from stack:**
- node:crypto for commitment hashing
- yaml for structured integrity logs

**Implements:**
- Integrity tracker component (state machine: ACTIVE → KEPT/HONORED/BROKEN/RENEGOTIATED)
- Commitment-as-edge pattern (DAG edges are implicit commitments)

**Avoids:**
- **Pitfall 4** (punitive tracking) — no scores, full restore cycle, sparring partner tone
- **Pitfall 8** (building before engine works) — deferred until after Phase 3
- **Pitfall 14** (underestimating restoration UX) — build restoration flow first

### Phase 5: Alignment System (The Novel Component)
**Rationale:** Most novel and uncertain component. Needs both execution and integrity working to be meaningful. Alignment is the multiplication factor in performance equation—but it's the hardest to make non-fuzzy. Defer until core loop proven.

**Delivers:**
- Alignment monitoring (ALIGNMENT.md, drift detection)
- Occurrence checks (`declare-aligner` agent)
- Drift detection triggers (action without declaration linkage, orphaned future, stale declarations)
- Performance scoring (alignment x integrity = performance)
- `/declare:align` command

**Uses from stack:**
- AI prompting for occurrence checks
- DAG traversal for coverage analysis

**Implements:**
- Alignment monitor component
- Occurrence check pattern (periodic "does this still occur as declared?")

**Avoids:**
- **Pitfall 11** (alignment checks that always pass) — use prompts not gates, soft signals not hard blocks

### Phase 6: CLI Polish + Past-Detection (Advanced Features)
**Rationale:** Polish and advanced ontological features after core loop proven. Past-detection is the killer differentiating feature but it's also the riskiest to get wrong. Defer until the system works without it, then add as enhancement.

**Delivers:**
- Full slash command suite (all `/declare:*` commands)
- Past-detection engine (`declare-assessor` agent)
- Future language coaching (guide from goal/requirement language to declarative language)
- GSD migration path (import existing `.planning/`, map phases to milestones)

**Implements:**
- CLI shell fully mapped from GSD
- Past-detection heuristics (negation, reactive framing, "fixing" language)
- Socratic clearing prompts (not diagnostic classification)

**Avoids:**
- **Pitfall 6** (future detection) — Socratic only, never diagnostic, no confidence scores
- **Pitfall 10** (methodology as feature list) — max 3 distinctions: declared vs default future, integrity as workability, commitment as speech act

### Phase Ordering Rationale

**Dependency chain:** Foundation (1) → Derivation Engine (2) → Execution (3) → Integrity (4) → Alignment (5) → Polish (6)

- Phase 1 must come first—data model wrong means rebuild everything
- Phase 2 must prove backward derivation works before building anything else on top
- Phase 3 can leverage GSD's proven execution patterns with minimal changes
- Phase 4 deferred until execution proven (tracking commits to bad plans is meaningless)
- Phase 5 is most novel/uncertain, needs full working system underneath to validate
- Phase 6 is polish and risk mitigation (past-detection) after core proven

**Critical path:** Phases 1-2-3 are mandatory sequential. Phases 4-5 can partially overlap (integrity and alignment are independent). Phase 6 is pure enhancement.

### Research Flags

**Phases likely needing deeper research during planning:**
- **Phase 2**: Backward derivation prompting patterns. This is novel territory—no standard patterns exist for AI-assisted backward planning from futures. Will need experimentation and iteration.
- **Phase 5**: Occurrence check implementation. Highly uncertain how to make "does this still occur as declared?" useful rather than annoying. May need user studies.

**Phases with standard patterns (skip research-phase):**
- **Phase 1**: File I/O, markdown parsing, basic graph operations. All standard CS.
- **Phase 3**: Execution pipeline. GSD already solved this comprehensively.
- **Phase 4**: State machines, commitment tracking. Well-understood patterns.

**External validation needed:**
- Test Phase 2 derivation engine output with users who know Vanto methodology—does it feel genuinely future-derived or just relabeled forward planning?
- Test Phase 1 DAG complexity with 10+ declaration projects—does 3-node-type limit hold or does real use reveal need for more structure?

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Versions verified via npm registry. Zero-dependency + bundling approach proven by GSD. Custom DAG decision well-justified by domain mismatch with general libraries. |
| Features | MEDIUM | Table stakes well-defined from GSD patterns + Erhard model. Differentiators novel—past-detection and occurrence checks unproven. Anti-features list strong (avoids feature creep). MVP scope clear. |
| Architecture | MEDIUM | Seven-component model builds sensibly on GSD. Three-layer DAG with upward edges matches ontology. Markdown-based persistence proven. Main uncertainty: backward derivation engine implementation (novel, no existing patterns to copy). |
| Pitfalls | MEDIUM-HIGH | Pitfall analysis synthesizes domain knowledge well. Top 6 critical pitfalls (ontology leakage, declarative collapse, DAG complexity, punitive integrity, fork drift, future detection) directly actionable. Phase-specific warnings provide clear guidance. Meta-pitfall ("building for yourself") correctly identifies core product risk. |

**Overall confidence:** MEDIUM

Research synthesis is solid but constrained by lack of web verification (no access to current Vanto Group materials, recent DAG planning tool landscape, or npm ecosystem trends). Core recommendations stand on GSD codebase analysis (HIGH confidence) and ontological model from PROJECT.md (documented with academic sources), but implementation details for novel components (especially backward derivation engine) will need iteration during development.

### Gaps to Address

**During Phase 1 planning:**
- Validate `@dagrejs/graphlib` fork status if considering it as alternative to custom DAG (research couldn't verify maintenance status)
- Manual check for DAG-specific npm packages published late 2025/early 2026 that research couldn't verify
- Confirm esbuild bundling works correctly with zod and gray-matter (high confidence but not tested)

**During Phase 2 planning:**
- Deep dive into backward reasoning AI prompt patterns. This is the highest-risk unknown. Research provides direction but no proven patterns exist to copy. Consider dedicated `/gsd:research-phase` before planning Phase 2.
- Test derivation output quality early with users who understand ontological model. The "derivation-diff" test (does backward-from-future produce different plans than forward-from-requirements?) must be empirically validated, not assumed.

**During Phase 5 planning:**
- Occurrence check frequency and trigger patterns need experimentation. "Does this still occur as declared?" could be profound or annoying depending on implementation. User research required.
- Alignment scoring methodology unclear. Research recommends qualitative (HIGH/MEDIUM/LOW) over numerical but doesn't provide concrete rubrics. Will need definition during planning.

**Ongoing validation:**
- Monitor fork boundary throughout development. GSD as upstream remote should remain mergeable for at least first 6 months. If merge conflicts become unresolvable, fork boundary violated.
- Test with ontology newcomers continuously. If 3+ concepts require explanation before first productive use, ontology is leaking (Pitfall 1).

## Sources

### Primary (HIGH confidence)
- GSD codebase direct analysis: agent architecture (`/Users/guilherme/Projects/get-shit-done/get-shit-done/agents/`), workflow patterns, tools layer (`bin/gsd-tools.cjs`), artifact format (`.planning/` templates), state management, install patterns
- PROJECT.md for Declare: `/Users/guilherme/Projects/get-shit-done/.planning/PROJECT.md` — project definition, requirements, ontological model citations
- npm registry verification (via `npm view`): gray-matter 4.0.3, yaml 2.8.2, zod 4.3.6, esbuild 0.27.3, toposort 2.0.2, graphlib 2.1.8, commander 14.0.3, simple-git 3.31.1, dagre 0.8.5

### Secondary (MEDIUM confidence)
- Erhard, W., Jensen, M.C., & Zaffron, S. (2010). "Integrity: A Positive Model that Incorporates the Normative Phenomena of Morality, Ethics, and Legality." SSRN #1263835 — integrity as workability model (cited in PROJECT.md)
- Erhard, W. & Jensen, M.C. (2017). "Putting Integrity Into Finance: A Purely Positive Approach." SSRN #1542759 — performance = alignment x integrity formula (cited in PROJECT.md)
- Vanto Group Three Laws of Performance training data: default future vs declared future, five-stage process (Assess > Clear > Create > Align > Implement), three laws structure

### Tertiary (LOW confidence)
- DAG-based planning tools ecosystem: training data only, no web verification available. Dagger/Nx/Turborepo use DAGs for build orchestration; no verified examples of DAG-based project planning in Declare's sense
- AI-assisted project management tools landscape: training data only, space evolving rapidly, current state unverified
- npm weekly download counts and ecosystem trends: recommendations based on training data knowledge, not live verification
- Node.js LTS schedule: Node 18 LTS status from training data (MEDIUM confidence)

**Note on research constraints:** Web search unavailable during research session. All external source verification done via local file reading (GSD codebase, PROJECT.md) and npm registry queries. Ecosystem trends, Vanto Group current materials, and recent tooling developments could not be verified. Recommendations prioritize stable, proven technologies and patterns over cutting-edge options requiring web validation.

---
*Research completed: 2026-02-15*
*Ready for roadmap: yes*
