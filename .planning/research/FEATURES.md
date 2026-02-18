# Feature Research

**Domain:** Future-driven declarative planning / meta-prompting engine for agentic development
**Researched:** 2026-02-15
**Confidence:** MEDIUM (ecosystem research based on training data; GSD codebase analysis is HIGH confidence)

## Feature Landscape

### Table Stakes (Users Expect These)

Features that must exist for Declare to deliver on its promise. Without these, it's just GSD with different vocabulary.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Future Declaration System** | The entire product promise. Users declare a constellation of truths that are true when the project succeeds. Without this, there's no "Declare." | MEDIUM | Guided creation flow: prompt user for futures, validate they're future-based not past-derived, store as structured data. Must feel different from writing requirements. |
| **Three-Layer DAG (declarations > milestones > actions)** | Core data structure. Replaces GSD's linear phases with a causal graph. The DAG IS the product. | HIGH | Declarations at top, causative milestones in middle, concrete actions at bottom. Edges flow upward (actions cause milestones, milestones realize declarations). Must support multiple milestones serving one declaration, and one milestone serving multiple declarations. |
| **Backward Derivation Engine** | Users expect the system to derive "what must be true" from declarations, not force them to sequence work manually. The declarative promise requires this. | HIGH | Two-stage: declarations to milestones ("what must be true for this to be realized?"), milestones to actions ("what must be done for this to be true?"). Must feel generative, not like filling in blanks. |
| **DAG-Aware Execution** | If the DAG exists, execution must respect it. Cannot just flatten to linear and run GSD phases. | HIGH | Topological sort for execution ordering. Parallel execution of independent branches. Wave-based scheduling (similar to GSD's wave system but derived from DAG structure rather than manually assigned). |
| **Integrity Tracking (Commitment + Honor Protocol)** | Central to the ontological model. "Performance = alignment x integrity" is meaningless without measuring integrity. | MEDIUM | Commitments made explicit at action/milestone level. When broken: system activates honor protocol (acknowledge, inform, clean up, renegotiate). Not punitive -- about wholeness. |
| **Alignment Tracking (Shared Future Document)** | The other half of the performance equation. Without alignment tracking, it's just a task manager with fancy words. | MEDIUM | Shared future doc that both human and AI reference. Active checks that surface when work diverges from declared future. Must be structural, not just a document sitting there. |
| **Performance Scoring** | The multiplication of alignment and integrity must be visible. This is the core feedback loop. | LOW | Computed metric at project/milestone/action levels. alignment x integrity = performance. Simple formula, hard to get the inputs right. Start with qualitative (HIGH/MEDIUM/LOW) before attempting numerical. |
| **CLI Integration (Slash Commands)** | Declare is a meta-prompting engine for Claude Code. CLI-first is a hard constraint. Users of GSD expect this interaction model. | MEDIUM | Fork GSD's command infrastructure. Replace `/gsd:*` with `/declare:*` (or similar). Must work as Claude Code slash commands installed via the same mechanism. |
| **State Persistence (Markdown Artifacts)** | GSD users expect `.planning/` directory with readable markdown. The "everything is a prompt" philosophy must carry forward. | LOW | DAG stored as markdown/YAML. Readable by humans, parseable by agents. No database required. Git-friendly (diffable). |
| **GSD Migration Path** | If forking GSD, existing GSD users need a path. Not full compatibility, but acknowledgment. | LOW | Import existing `.planning/` structure. Map phases to milestones. Map phase goals to declarations (with past-detection warnings). One-time migration, not ongoing compatibility. |

### Differentiators (Competitive Advantage)

Features that make Declare fundamentally different from GSD, linear planners, and traditional PM tools.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Past-Detection Engine** | The killer feature. Detects when "declared futures" are actually past-derived ("I want X because Y sucks") and guides users through clearing. No other tool does this. | HIGH | NLP/heuristic analysis of declaration language. Markers: negation of current state, reactive framing, "fixing" language, comparison to competitors. Guide user through Vanto's Assess > Clear > Create cycle. Must be helpful, not preachy. |
| **Occurrence Checks** | AI periodically verifies "does this still occur as what we declared?" Catches drift before it compounds. This is the AI as co-holder of the future, not just executor. | MEDIUM | Scheduled or triggered checks during execution. AI reads current state, compares against declared future, surfaces drift. Different from verification (which checks task completion) -- this checks whether the future still lands as declared. |
| **Causal Reasoning (Why-Chain)** | Every action traces to a declaration through milestones. "Why am I doing this?" always has an answer. No orphan tasks. | MEDIUM | DAG edges carry causal reasoning. Any node can be traced upward to show its purpose. If an action doesn't trace to a declaration, it's either misplaced or reveals a missing declaration. |
| **Declaration Constellation Visualization** | Show the full future as an interconnected web, not a list. The constellation metaphor makes the abstract tangible. | MEDIUM | DAG visualization showing declarations as stars, milestones as connections, actions as ground-level work. Must convey the wholeness of the future, not just a dependency graph. CLI-first means ASCII/text-based initially. |
| **Renegotiation Protocol** | When integrity breaks (missed commitment), the system doesn't just log a failure -- it guides through renegotiation. This is the "honor" in honor protocol. | LOW | Structured flow: acknowledge the break, inform affected nodes in DAG, assess consequences on dependent milestones/declarations, propose new commitment. Automatically updates DAG with renegotiated timelines/scope. |
| **Default Future Detection** | Surfaces the "default future" (what will happen if nothing changes) alongside the declared future. Makes the gap visible and actionable. | HIGH | Analyzes current trajectory, velocity, patterns. Projects where the project is actually headed vs. where it's declared to go. The gap between default and declared future is where intervention is needed. |
| **Declaration-Driven Prioritization** | Instead of "what's next in the phase list," prioritization comes from "which actions most advance the declared future?" Fundamentally different decision framework. | MEDIUM | Score actions by their causal contribution to declarations. Actions that serve multiple declarations or critical-path milestones rank higher. Replaces sequential phase ordering with impact ordering. |
| **Integrity Cascade Warnings** | When one commitment breaks, show what else is at risk. The DAG makes cascading impacts visible. | LOW | Traverse DAG upward from broken commitment. Show which milestones are jeopardized. Show which declarations are at risk. This is the structural advantage of a DAG over linear planning. |
| **Future Language Coaching** | Help users write declarations in future-based language rather than goal/requirement language. The distinction matters ontologically. | MEDIUM | Not "we will build X" (plan) or "the system shall Y" (requirement) but "X is true" (declaration). Guide users from planning language to declarative language. Subtle but transformative for how the work occurs. |
| **Clearing Conversations** | When past-detection fires, guide the user through a structured clearing conversation to move from past-derived to future-created. Based on Vanto's clearing process. | HIGH | Conversational AI flow: surface the past-based concern, acknowledge it, distinguish it from the future, create a new declaration. This is coaching, not task management. Must handle emotional/personal content respectfully. |

### Anti-Features (Commonly Requested, Often Problematic)

Features to deliberately NOT build. These would dilute the ontological core or replicate what already exists.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Gantt Charts / Timeline Views** | Familiar PM visualization. People expect timelines. | Timelines are past-derived planning artifacts. They sequence work by time, not by causal structure. Contradict the declarative model. | DAG visualization shows causal structure. Execution order derived from topology, not calendar. |
| **Time Estimates / Story Points** | "How long will this take?" is the first question PMs ask. | Time estimates anchor in the past ("last time this took X"). They become commitments that constrain rather than enable. The Erhard model treats time as a factor of integrity, not prediction. | Track actual velocity (like GSD does). Let the DAG reveal scope, not impose timelines. |
| **Sprint/Iteration Cycles** | Agile muscle memory. Two-week cadences feel productive. | Sprints are arbitrary time-boxes that fragment future-driven work. They optimize for velocity metrics, not for realizing declared futures. | Milestones are defined by causal necessity, not calendar intervals. Work continues until a milestone is realized. |
| **Kanban Boards / Status Columns** | Visual workflow management. Satisfying to move cards. | Reduces work to status transitions (todo/doing/done). Loses the WHY (which declaration is this serving?). Flattens the DAG to a list. | DAG view shows work in context of its purpose. Status is a property of DAG nodes, not the organizing principle. |
| **Team Roles / Permissions / RACI** | Enterprise PM muscle memory. "Who's responsible?" | Solo mode first. Adding team complexity before validating the ontological model is premature. Also: the Erhard model treats responsibility differently (everyone is 100% responsible). | Solo mode: human + AI agent. Both hold the full future. Team features are a future milestone, not v1. |
| **Jira/Linear/Asana Integration** | "Sync with our existing tools." | These tools embody the past-derived planning model Declare is replacing. Integration would compromise the ontological integrity. | Export capabilities if needed, but Declare should be the source of truth, not a frontend for conventional tools. |
| **Detailed Progress Percentages** | "Are we 73% done?" feels precise and reassuring. | False precision. Progress toward a declared future isn't linear. 50% of actions complete doesn't mean 50% of the future is realized. | Binary milestone realization (realized/not-realized). Performance score (alignment x integrity). Qualitative assessments. |
| **Automated Scope Creep Detection** | "Alert me when scope grows." | Scope in a declarative model isn't fixed -- it's derived from declarations. New actions arising from deeper understanding of a declaration is emergence, not creep. | Past-detection on new declarations. If new work is past-derived ("we need this because X broke"), flag it. If it's future-derived ("realizing this declaration requires Y"), embrace it. |
| **Notification/Alert System** | "Ping me when things change." | Push notifications create reactivity. The tool should be pulled into, not pushing outward. Solo mode doesn't need notifications -- the human is already in the loop. | Occurrence checks surface drift when the user engages. State is always current when accessed. |
| **Natural Language Task Creation** | "Just type what you want and AI figures it out." | Undermines the discipline of declaration. The structured creation process IS the value -- it forces ontological clarity. A "just type anything" interface loses the distinction between past and future language. | Guided declaration flow with past-detection. The structure is a feature, not friction. |

## Feature Dependencies

```
[Future Declaration System]
    |
    +--requires--> [Past-Detection Engine]
    |                  |
    |                  +--enhances--> [Clearing Conversations]
    |
    +--produces--> [Three-Layer DAG]
    |                  |
    |                  +--requires--> [Backward Derivation Engine]
    |                  |
    |                  +--enables--> [DAG-Aware Execution]
    |                  |                 |
    |                  |                 +--requires--> [CLI Integration]
    |                  |                 |
    |                  |                 +--requires--> [State Persistence]
    |                  |
    |                  +--enables--> [Causal Reasoning (Why-Chain)]
    |                  |
    |                  +--enables--> [Integrity Cascade Warnings]
    |                  |
    |                  +--enables--> [Declaration-Driven Prioritization]
    |                  |
    |                  +--enables--> [Declaration Constellation Visualization]
    |
    +--requires--> [Future Language Coaching]

[Integrity Tracking]
    |
    +--enables--> [Renegotiation Protocol]
    |
    +--enables--> [Performance Scoring]
    |
    +--enables--> [Integrity Cascade Warnings]

[Alignment Tracking]
    |
    +--enables--> [Occurrence Checks]
    |
    +--enables--> [Performance Scoring]
    |
    +--enables--> [Default Future Detection]

[CLI Integration]
    +--requires--> [State Persistence]
    +--enables--> [GSD Migration Path]
```

### Dependency Notes

- **Future Declaration System requires Past-Detection Engine:** Declarations without past-detection are just requirements with a different name. The detection IS what makes them declarations.
- **Three-Layer DAG requires Backward Derivation:** The DAG isn't manually constructed -- it's derived backward from declarations. Without derivation, users are just drawing dependency graphs.
- **DAG-Aware Execution requires CLI Integration + State Persistence:** Execution needs the command infrastructure (fork from GSD) and persistent state (markdown artifacts).
- **Performance Scoring requires both Integrity and Alignment Tracking:** The formula is alignment x integrity = performance. Neither input alone produces the score.
- **Occurrence Checks require Alignment Tracking:** Checks compare current state against the shared future -- alignment tracking provides the reference point.
- **Clearing Conversations enhance Past-Detection:** Past-detection identifies the problem; clearing conversations resolve it. Can ship past-detection without clearing, but clearing without detection is impossible.
- **Default Future Detection requires Alignment Tracking:** Default future is projected from current trajectory. Alignment tracking provides the "declared future" comparison point.

## MVP Definition

### Launch With (v1)

Minimum viable product -- what's needed to validate the ontological model in an agentic development context.

- [ ] **Future Declaration System** -- the core interaction. User declares futures, system stores them as structured constellation.
- [ ] **Past-Detection Engine (basic)** -- heuristic detection of past-derived language. Doesn't need to be perfect; needs to demonstrate the concept.
- [ ] **Three-Layer DAG** -- declarations > milestones > actions stored as markdown/YAML.
- [ ] **Backward Derivation Engine** -- AI-assisted derivation of milestones from declarations, actions from milestones.
- [ ] **DAG-Aware Execution** -- topological sort, wave-based scheduling, parallel branch execution.
- [ ] **CLI Integration** -- slash commands for Claude Code, forked from GSD infrastructure.
- [ ] **State Persistence** -- `.planning/` directory with DAG as readable markdown.
- [ ] **Integrity Tracking (basic)** -- commitments at action level, simple honor protocol on breaks.
- [ ] **Alignment Tracking (basic)** -- shared future doc, manual drift checks.
- [ ] **Performance Scoring (qualitative)** -- HIGH/MEDIUM/LOW for alignment and integrity, simple multiplication.

### Add After Validation (v1.x)

Features to add once core is working and the ontological model proves valuable.

- [ ] **Occurrence Checks** -- trigger: users report drift going unnoticed until late. Adds periodic AI-driven alignment verification.
- [ ] **Causal Reasoning (Why-Chain)** -- trigger: users ask "why am I doing this?" during execution. Adds trace-to-declaration capability.
- [ ] **Declaration Constellation Visualization** -- trigger: DAGs become complex enough that text representation is insufficient. ASCII/text-based first.
- [ ] **Renegotiation Protocol** -- trigger: users handle broken commitments outside the system. Structured renegotiation flow.
- [ ] **Integrity Cascade Warnings** -- trigger: broken commitments cause surprises downstream. DAG traversal for impact analysis.
- [ ] **Future Language Coaching** -- trigger: users consistently write requirements instead of declarations. Active coaching during creation.
- [ ] **GSD Migration Path** -- trigger: existing GSD users want to try Declare. One-time import with past-detection on migrated goals.

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] **Clearing Conversations** -- requires sophisticated conversational AI and ontological understanding. High risk of being preachy or patronizing if done poorly. Defer until past-detection is proven.
- [ ] **Default Future Detection** -- requires meaningful velocity and trajectory data. Needs multiple projects worth of data to project meaningfully.
- [ ] **Declaration-Driven Prioritization** -- requires a mature DAG with enough actions to make prioritization non-trivial. In v1, the DAG is small enough that prioritization is obvious.
- [ ] **Team/Multi-User Mode** -- the alignment model becomes dramatically more complex with multiple humans. Validate solo first.
- [ ] **Web Dashboard** -- CLI-first means proving the model without UI polish. Dashboard is a different product surface.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Future Declaration System | HIGH | MEDIUM | P1 |
| Three-Layer DAG | HIGH | HIGH | P1 |
| Backward Derivation Engine | HIGH | HIGH | P1 |
| Past-Detection Engine (basic) | HIGH | MEDIUM | P1 |
| CLI Integration (fork from GSD) | HIGH | MEDIUM | P1 |
| DAG-Aware Execution | HIGH | HIGH | P1 |
| State Persistence | HIGH | LOW | P1 |
| Integrity Tracking (basic) | MEDIUM | MEDIUM | P1 |
| Alignment Tracking (basic) | MEDIUM | LOW | P1 |
| Performance Scoring | LOW | LOW | P1 |
| Occurrence Checks | MEDIUM | MEDIUM | P2 |
| Causal Reasoning (Why-Chain) | MEDIUM | LOW | P2 |
| Constellation Visualization | MEDIUM | MEDIUM | P2 |
| Renegotiation Protocol | LOW | LOW | P2 |
| Integrity Cascade Warnings | LOW | LOW | P2 |
| Future Language Coaching | MEDIUM | MEDIUM | P2 |
| GSD Migration Path | LOW | LOW | P2 |
| Clearing Conversations | MEDIUM | HIGH | P3 |
| Default Future Detection | MEDIUM | HIGH | P3 |
| Declaration-Driven Prioritization | MEDIUM | MEDIUM | P3 |
| Team Mode | HIGH (later) | HIGH | P3 |

**Priority key:**
- P1: Must have for launch -- validates the ontological model
- P2: Should have, add when patterns emerge from use
- P3: Nice to have, future consideration after model is proven

## Competitor Feature Analysis

| Feature | GSD (current) | Linear/Jira | Vanto Group Programs | Declare (our approach) |
|---------|---------------|-------------|----------------------|----------------------|
| Planning model | Linear phases | Backlog + sprints | Programs > Projects > Milestones > Actions | DAG: Declarations > Milestones > Actions |
| Work derivation | Forward (requirements > phases) | Forward (stories > tasks) | Backward (future > milestones > actions) | Backward (declarations > milestones > actions) |
| Integrity | Not tracked | Status tracking only | Explicit honor protocol | Structural honor protocol with cascade |
| Alignment | Implicit (shared docs) | Shared boards | Active coaching + enrollment | Shared future doc + occurrence checks |
| Past vs Future | Not distinguished | Not distinguished | Core distinction (coaching) | Automated detection (past-detection engine) |
| Performance model | Velocity (plans/time) | Velocity (points/sprint) | Alignment x Integrity | Alignment x Integrity (computed) |
| Execution | Sequential phases | Sprint-based | Coaching + accountability | DAG-aware with parallel branches |
| AI role | Executor (builds what's planned) | Not applicable | Not applicable | Co-holder of future (detects drift, derives milestones) |
| Target user | Solo dev + AI | Teams | Organizations (with coaches) | Solo dev + AI (teams later) |

**Key insight from competitor analysis:** Declare occupies a unique position -- it takes Vanto's ontological model (which is delivered via human coaching in large organizations) and makes it structural and computable for a solo developer working with an AI agent. No existing tool does this. The closest analogues are:

- **GSD** -- has the meta-prompting/agentic infrastructure but uses past-derived linear planning
- **Vanto Group programs** -- has the ontological model but delivers via human coaches, not software
- **Linear/Jira** -- has the project management tooling but embodies the exact model Declare replaces

## Sources

- GSD codebase analysis (HIGH confidence): `/Users/guilherme/Projects/get-shit-done/` -- full codebase review of commands, agents, templates, workflows
- PROJECT.md for Declare (HIGH confidence): `/Users/guilherme/Projects/get-shit-done/.planning/PROJECT.md` -- project definition and requirements
- Erhard/Jensen/Zaffron ontological model (MEDIUM confidence): training data, not verified against current publications. Key sources referenced in PROJECT.md: SSRN #1263835 and #1542759
- Vanto Group Three Laws of Performance (MEDIUM confidence): training data. The five-stage process (Assess > Clear > Create > Align > Implement) and three laws are well-documented in published work
- DAG-based planning tools ecosystem (LOW confidence): training data only. No web search available to verify current landscape. Dagger, Nx, Turborepo use DAGs for build orchestration; no verified examples of DAG-based project planning tools in the Declare sense
- AI-assisted project management tools (LOW confidence): training data only. The space is evolving rapidly; current state unverified

---
*Feature research for: future-driven declarative planning / meta-prompting engine*
*Researched: 2026-02-15*
