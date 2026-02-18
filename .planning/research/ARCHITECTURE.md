# Architecture Patterns

**Domain:** Future-driven declarative planning engine (DAG-based agentic development)
**Researched:** 2026-02-15
**Confidence:** MEDIUM (training data + GSD codebase analysis; no web verification available)

## Recommended Architecture

Declare is a **three-layer DAG engine** wrapped in a **meta-prompting CLI shell**, forked from GSD's proven agent orchestration patterns. The architecture separates into seven major components with clear boundaries.

### System Overview

```
                         CLI Layer (Slash Commands)
                                |
                    +--- Orchestrator Layer ---+
                    |                          |
              Agent Pool                 DAG Engine
           (researchers,              (core data model)
            derivers,                      |
            planners,              +-------+-------+
            executors,             |       |       |
            verifiers,       Declarations  |    Actions
            aligners)          (top)   Milestones  (bottom)
                                      (middle)
                    |                          |
              Integrity          Alignment     |
              Tracker            Monitor       |
                    |                          |
                    +--- Artifact Layer -------+
                         (Git-backed markdown)
```

### Component Boundaries

| Component | Responsibility | Communicates With | Owns |
|-----------|---------------|-------------------|------|
| **CLI Shell** | Slash command routing, argument parsing, user interaction | Orchestrator (down) | Command definitions (`commands/declare/`) |
| **Orchestrator** | Workflow sequencing, agent spawning, gate enforcement | CLI (up), Agent Pool (down), DAG Engine (read), Artifact Layer (write) | Workflow definitions (`workflows/`) |
| **DAG Engine** | Three-layer graph: declarations -> milestones -> actions. Topological sort, dependency resolution, backward derivation | Orchestrator (queried), Integrity Tracker (feeds), Alignment Monitor (feeds) | `declare-tools.cjs` (or equivalent) + DAG state in markdown |
| **Agent Pool** | Specialized subagents for each workflow stage | Orchestrator (spawned by), DAG Engine (reads), Artifact Layer (writes) | Agent prompt files (`agents/`) |
| **Integrity Tracker** | Commitment state machine, honor protocol triggers, break detection | DAG Engine (reads commitments), Orchestrator (triggers alerts), Artifact Layer (persists state) | `INTEGRITY.md`, commitment records |
| **Alignment Monitor** | Drift detection, occurrence checks, shared future coherence scoring | DAG Engine (reads declarations), Agent Pool (queried by agents), Artifact Layer (persists) | `ALIGNMENT.md`, drift history |
| **Artifact Layer** | Git-backed markdown persistence, frontmatter CRUD, template rendering | All components (read/write), Git (commits) | `.planning/` directory tree |

## Data Flow

### Primary Flow: Declaration to Action (Backward Derivation)

This is the core inversion from GSD. GSD flows forward (requirements -> phases -> plans -> execution). Declare flows backward (future -> what must be true -> what must be done).

```
1. User declares future ──> FUTURE.md (constellation of declarations)
                                |
2. Deriver agent works    ──> "What must be true for each declaration?"
   backward                    |
                          Milestones derived (causal, not sequential)
                                |
3. Deriver continues      ──> "What actions cause each milestone?"
   backward                    |
                          Actions derived (concrete, executable)
                                |
4. DAG Engine registers   ──> Three-layer graph with upward edges:
   all nodes + edges           action --causes--> milestone --realizes--> declaration
                                |
5. Topological sort       ──> Execution ordering respecting dependencies
                                |
6. Planner creates        ──> PLAN.md files (GSD-compatible format)
   executable plans            |
7. Executor runs plans    ──> Code changes, commits
                                |
8. Verifier checks        ──> Does reality match what was declared?
                                |
9. Integrity/Alignment    ──> Score: alignment x integrity = performance
   scoring updates
```

### Edge Direction Convention

Edges represent **causation** and flow upward:

- Action A **causes** Milestone M (A -> M)
- Milestone M **realizes** Declaration D (M -> D)

This is the opposite of typical dependency graphs (where edges point to prerequisites). The reason: Declare asks "what causes what?" not "what depends on what?" The future causes the present, not the other way around.

For execution ordering, the DAG Engine inverts edges to derive topological order: "To realize D, first complete M. To complete M, first do A."

### Secondary Flow: Integrity Tracking

```
1. Commitment created    ──> Agent/human makes promise (in PLAN.md or action)
                               |
2. Tracker registers     ──> Commitment added to INTEGRITY.md with:
                              - Who committed
                              - What was committed
                              - When (deadline if any)
                              - Status: ACTIVE
                               |
3. On completion/break   ──> Status transitions:
                              ACTIVE -> KEPT (completed as promised)
                              ACTIVE -> BROKEN (not completed, not renegotiated)
                              ACTIVE -> HONORED (broken but honor protocol followed)
                              ACTIVE -> RENEGOTIATED (scope/timeline changed with notice)
                               |
4. Honor protocol        ──> When BROKEN detected:
   (automatic)                a. Acknowledge the break
                              b. Identify affected nodes in DAG
                              c. Clean up consequences (re-derive affected milestones)
                              d. Offer renegotiation
```

### Tertiary Flow: Alignment Monitoring

```
1. FUTURE.md is the     ──> Shared reference document
   single source              |
2. Before each action   ──> Alignment check: "Does this action serve a declaration?"
                              If YES: proceed
                              If NO: flag drift, pause for human decision
                               |
3. Periodic occurrence  ──> AI asks: "Does this still occur as what we declared?"
   checks                     Surfaces when reality has shifted the context
                               |
4. Drift accumulation   ──> Small drifts compound. Monitor tracks:
                              - Number of actions without clear declaration linkage
                              - Time since last alignment check
                              - Declaration coverage (% of declarations with active milestones)
```

## DAG Storage: Markdown Representation

The DAG must be stored in markdown files that are human-readable, git-diffable, and parseable by both the tools layer and agent prompts. This is the most critical design decision.

### Recommended Approach: FUTURE.md + DAG.md + Individual Node Files

**FUTURE.md** (the top layer -- declarations only):

```markdown
# Future: [Project Name]

## Declarations

### DECL-01: [Title]
**When this project succeeds, it is true that:**
[Statement in present tense, as if already real]

**Assessment:** [Genuine / Past-derived / Needs clearing]
**Status:** Active

### DECL-02: [Title]
**When this project succeeds, it is true that:**
[Statement]

**Assessment:** Genuine
**Status:** Active
```

**DAG.md** (the graph structure -- edges and index):

```markdown
# DAG: [Project Name]

## Graph

### Declarations
| ID | Title | Status | Realized By |
|----|-------|--------|-------------|
| DECL-01 | [title] | Active | MS-01, MS-02 |
| DECL-02 | [title] | Active | MS-03 |

### Milestones
| ID | Title | Status | Realizes | Caused By | Depends On |
|----|-------|--------|----------|-----------|------------|
| MS-01 | [title] | Not started | DECL-01 | ACT-01, ACT-02 | - |
| MS-02 | [title] | Not started | DECL-01 | ACT-03 | MS-01 |
| MS-03 | [title] | Not started | DECL-02 | ACT-04, ACT-05 | - |

### Actions
| ID | Title | Status | Causes | Depends On | Plan |
|----|-------|--------|--------|------------|------|
| ACT-01 | [title] | Not started | MS-01 | - | 01-01-PLAN.md |
| ACT-02 | [title] | Not started | MS-01 | ACT-01 | 01-01-PLAN.md |
| ACT-03 | [title] | Not started | MS-02 | ACT-01 | 01-02-PLAN.md |

## Execution Order

Based on topological sort of inverted edges:

1. Wave 1: ACT-01, ACT-04 (no dependencies)
2. Wave 2: ACT-02, ACT-05 (depend on wave 1)
3. Wave 3: ACT-03 (depends on ACT-01 from wave 1)

## Performance

| Declaration | Alignment | Integrity | Performance |
|-------------|-----------|-----------|-------------|
| DECL-01 | 0.8 | 1.0 | 0.80 |
| DECL-02 | 0.9 | 0.9 | 0.81 |
| **Overall** | **0.85** | **0.95** | **0.81** |
```

**Why this split:**

- FUTURE.md stays clean and inspirational -- it is the "shared future document" read by all agents
- DAG.md is the structural graph -- parseable by tools, updatable by orchestrators
- Individual PLAN.md files (in phase directories) hold executable detail, just like GSD
- Separation means FUTURE.md changes are meaningful (ontological shifts), while DAG.md changes are operational (progress tracking)

### Alternative Considered: Single File

Putting everything in one file was considered and rejected. A single file conflates the aspirational layer (declarations) with the operational layer (milestones, actions, progress). The declaration layer should feel permanent and weighty -- changing it is a significant act. The DAG layer changes constantly as work progresses.

### Alternative Considered: JSON/YAML DAG

Storing the DAG in a structured data format (JSON, YAML) was considered and rejected. Markdown tables are:
- Human-readable in any editor or GitHub
- Git-diffable with meaningful diffs
- Parseable by simple regex (GSD's `gsd-tools.cjs` already does this for roadmaps)
- Editable by agents without special serialization

The tools layer (`declare-tools.cjs`) parses these tables into in-memory graph structures for operations like topological sort, cycle detection, and path finding.

## Component Deep Dives

### 1. DAG Engine (`declare-tools.cjs`)

The heart of the system. A Node.js CLI tool (like GSD's `gsd-tools.cjs`) that provides atomic operations on the DAG.

**Core operations:**

```
dag parse                    Parse DAG.md into JSON graph
dag validate                 Check for cycles, orphan nodes, broken edges
dag topo-sort                Topological sort for execution ordering
dag derive-milestones <decl> Suggest milestones for a declaration (AI-assisted)
dag derive-actions <ms>      Suggest actions for a milestone (AI-assisted)
dag add-node <type> <data>   Add declaration/milestone/action
dag add-edge <from> <to>     Add causation edge
dag remove-node <id>         Remove node and cascade edges
dag status <id>              Get node status with upstream/downstream context
dag wave-plan                Group actions into parallel execution waves
dag impact <id>              Show all nodes affected by a change to <id>
dag coverage                 Which declarations lack milestones? Which milestones lack actions?
dag path <from> <to>         Show causation path between two nodes
```

**In-memory representation:**

```typescript
interface DagNode {
  id: string;           // DECL-01, MS-01, ACT-01
  type: 'declaration' | 'milestone' | 'action';
  title: string;
  status: 'active' | 'in-progress' | 'complete' | 'broken' | 'renegotiated';
  metadata: Record<string, unknown>;  // type-specific data
}

interface DagEdge {
  from: string;         // source node (action or milestone)
  to: string;           // target node (milestone or declaration)
  type: 'causes' | 'realizes';
}

interface Dag {
  nodes: Map<string, DagNode>;
  edges: DagEdge[];
  // Derived indexes (rebuilt on parse)
  upward: Map<string, string[]>;    // node -> nodes it causes/realizes
  downward: Map<string, string[]>;  // node -> nodes that cause/realize it
  layers: {
    declarations: string[];
    milestones: string[];
    actions: string[];
  };
}
```

**Build order implication:** This is the foundational component. Nothing else works without it. Build first.

### 2. Declaration Parser & Past-Detection

Declarations need validation beyond syntax. The Vanto methodology distinguishes:

- **Genuine future declarations:** Create possibility, not derived from past complaints
- **Past-derived declarations:** "I want X because Y is broken" -- these are reactions disguised as futures

The past-detection engine is an AI-assisted analysis (agent, not tooling) that:

1. Reads each declaration in FUTURE.md
2. Checks for past-derived markers (complaint language, reactive framing, "because [past problem]")
3. Guides the user through assessment/clearing if needed
4. Tags each declaration with assessment status

**This is an agent responsibility, not a tools responsibility.** The tools layer stores the assessment tag; the agent layer performs the analysis.

### 3. Integrity Tracker

**State file: `.planning/INTEGRITY.md`**

```markdown
# Integrity Record

## Active Commitments

| ID | Commitment | By | Created | Deadline | Status |
|----|-----------|-----|---------|----------|--------|
| CMT-01 | Deliver auth system | Agent | 2026-02-15 | - | ACTIVE |

## History

### CMT-00: Initial project setup
**Status:** KEPT
**Committed:** 2026-02-14
**Completed:** 2026-02-14
**By:** Agent

## Honor Protocol Activations

None yet.

## Integrity Score

Commitments kept or honored: 1/1 (1.00)
Commitments broken (not honored): 0
```

**State machine:**

```
ACTIVE ──> KEPT (completed as promised)
ACTIVE ──> HONORED (broken, but: acknowledged + informed + cleaned up + renegotiated)
ACTIVE ──> BROKEN (broken without honor protocol)
ACTIVE ──> RENEGOTIATED (scope/timeline changed proactively, before break)
```

**Key insight:** HONORED is not a failure state. Per the Erhard model, honoring your word when you cannot keep it preserves integrity. The system should make honor protocol easy, not punitive.

**Tools operations:**

```
integrity add <commitment> [--by agent|human] [--deadline date]
integrity complete <id>
integrity break <id> --reason "..."
integrity honor <id> --acknowledge "..." --cleanup "..." --renegotiate "..."
integrity renegotiate <id> --new-terms "..."
integrity score [--scope declaration|milestone|overall]
```

### 4. Alignment Monitor

**State file: `.planning/ALIGNMENT.md`**

```markdown
# Alignment Record

## Shared Future Reference

See: FUTURE.md (last reviewed: 2026-02-15)

## Alignment Checks

| Date | Agent | Declaration | Aligned? | Notes |
|------|-------|-------------|----------|-------|
| 2026-02-15 | Executor | DECL-01 | Yes | Action serves declaration directly |

## Drift Events

None yet.

## Occurrence Checks

| Date | Declaration | Still Occurring? | Notes |
|------|-------------|-----------------|-------|
| 2026-02-15 | DECL-01 | Yes | Future still inspires action |

## Alignment Score

Actions aligned / Total actions: 5/5 (1.00)
Declarations with active coverage: 2/2 (1.00)
Overall alignment: 1.00
```

**Drift detection triggers:**

1. An action has no clear causation path to any declaration
2. A declaration has no milestones (orphaned future)
3. An occurrence check reveals the declaration no longer resonates
4. Execution diverges from plan without renegotiation

**Tools operations:**

```
alignment check <action-id>          Does this action serve a declaration?
alignment occurrence <declaration-id> Trigger occurrence check
alignment score                      Calculate alignment scores
alignment drift-report               List all drift events
```

### 5. Agent Pool (Extended from GSD)

GSD agents map to Declare agents with additions:

| GSD Agent | Declare Agent | Changes |
|-----------|---------------|---------|
| `gsd-project-researcher` | `declare-researcher` | Same role, researches domain |
| `gsd-roadmapper` | `declare-deriver` | **Major change:** derives milestones/actions from declarations (backward), not phases from requirements (forward) |
| `gsd-planner` | `declare-planner` | Creates PLAN.md files from actions, similar to GSD but references DAG nodes |
| `gsd-executor` | `declare-executor` | Same role, executes plans. Adds alignment check before each action |
| `gsd-verifier` | `declare-verifier` | Verifies against declarations (not just phase goals). Checks: did this action cause the milestone it claimed to? |
| (new) | `declare-aligner` | Runs occurrence checks, drift detection, alignment scoring |
| (new) | `declare-integrity-keeper` | Monitors commitments, triggers honor protocol |
| (new) | `declare-assessor` | Past-detection engine, guides declaration clearing |

### 6. CLI Shell (Slash Commands)

Mapped from GSD with ontological changes:

| GSD Command | Declare Command | Purpose |
|-------------|-----------------|---------|
| `/gsd:new-project` | `/declare:new-project` | Initialize with future declarations instead of requirements |
| `/gsd:plan-phase` | `/declare:derive` | Backward derivation from declarations to milestones to actions |
| `/gsd:execute-phase` | `/declare:execute` | Execute action wave (grouped by DAG topology, not phase number) |
| `/gsd:verify-work` | `/declare:verify` | Verify actions caused milestones, milestones realized declarations |
| `/gsd:progress` | `/declare:status` | DAG status with integrity/alignment scores |
| (new) | `/declare:future` | Edit/assess declarations in FUTURE.md |
| (new) | `/declare:integrity` | View/manage integrity record |
| (new) | `/declare:align` | Run alignment check or occurrence check |
| (new) | `/declare:honor` | Activate honor protocol for a broken commitment |
| `/gsd:discuss-phase` | `/declare:discuss` | Discuss a milestone or declaration |

### 7. Artifact Layer (`.planning/` Directory)

```
.planning/
  FUTURE.md              # Declarations (the shared future)
  DAG.md                 # Graph structure (nodes, edges, execution order)
  INTEGRITY.md           # Commitment tracking
  ALIGNMENT.md           # Drift detection, occurrence checks
  STATE.md               # Current position, session continuity
  PROJECT.md             # Project context (carried from GSD)
  config.json            # Workflow preferences
  research/              # Domain research (same as GSD)
  milestones/            # Milestone-scoped directories
    ms-01-[slug]/
      01-01-PLAN.md      # Action plan
      01-01-SUMMARY.md   # Execution summary
      01-VERIFICATION.md # Milestone verification
    ms-02-[slug]/
      ...
```

**Key change from GSD:** Directories are organized by **milestone** (DAG node), not by **phase number** (linear sequence). This reflects the shift from sequential phases to a causal graph. Multiple milestones can be in progress simultaneously if they have no dependencies between them.

## Patterns to Follow

### Pattern 1: Backward Derivation

**What:** Start from the desired end state and work backward to concrete actions.
**When:** Creating milestones from declarations, creating actions from milestones.
**Why:** This is the core ontological inversion. Forward planning produces task lists. Backward derivation produces causal chains.

**Example agent prompt pattern:**

```markdown
Given declaration DECL-01: "[declaration text]"

What must be TRUE in the world for this declaration to be realized?
List 2-5 milestones, each stating a condition that must hold.

For each milestone, what ACTIONS would cause that condition to become true?
List 1-3 concrete, executable actions per milestone.
```

### Pattern 2: Upward Edge Verification

**What:** After executing an action, verify the causation chain upward.
**When:** After every action completion, during milestone verification.
**Why:** Task completion does not equal goal achievement (GSD already knows this). In Declare, this extends further: action completion does not guarantee milestone causation.

**Verification chain:**
```
1. Action ACT-01 completed -> Does MS-01 now have what it needs?
2. All actions for MS-01 complete -> Is the milestone condition TRUE?
3. All milestones for DECL-01 complete -> Is the declaration REALIZED?
```

### Pattern 3: Commitment-as-Edge

**What:** Every edge in the DAG is implicitly a commitment. "ACT-01 causes MS-01" means the executor of ACT-01 is committing that their work will contribute to MS-01.
**When:** Edge creation (during derivation) and execution.
**Why:** This ties the integrity system directly to the DAG structure. A broken edge (action did not cause milestone) is an integrity event.

### Pattern 4: Wave-Based Parallel Execution (Inherited from GSD)

**What:** Group independent actions into waves for parallel execution.
**When:** Execution planning.
**Why:** GSD already does this for plans within phases. Declare extends it to actions across milestones. If ACT-01 and ACT-04 serve different milestones and have no dependencies, execute them in parallel.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Linear Phase Fallback

**What:** Silently converting the DAG into a linear phase sequence because it is familiar.
**Why bad:** Destroys the core value proposition. If milestones are independent, they should execute in parallel, not sequentially.
**Instead:** Use topological sort to derive execution waves. Only serialize when there are actual dependencies.

### Anti-Pattern 2: Integrity as Punishment

**What:** Making broken commitments feel like failures, discouraging honest reporting.
**Why bad:** The Erhard model explicitly distinguishes keeping your word (ideal) from honoring your word (acceptable). If the system punishes breaks, agents will hide them.
**Instead:** Make the honor protocol frictionless. A broken-and-honored commitment should feel like a normal, healthy part of the workflow.

### Anti-Pattern 3: Monolithic DAG File

**What:** Putting all node details (plans, verification results, summaries) in DAG.md.
**Why bad:** DAG.md becomes enormous and unmaintainable. Merge conflicts on every operation.
**Instead:** DAG.md is an index (IDs, titles, edges, status). Detail lives in milestone directories, just like GSD's phase directories.

### Anti-Pattern 4: Over-Engineering the Graph

**What:** Building a full graph database, visual query language, or complex traversal APIs before the basic workflow works.
**Why bad:** The DAG is stored in markdown tables. It will have at most ~50-100 nodes for a typical project. Simple array operations suffice. Do not build infrastructure for scale you will never hit.
**Instead:** Parse markdown tables into arrays. Use simple loops for traversal. Add complexity only when the simple approach fails.

### Anti-Pattern 5: Forgetting the Human Layer

**What:** Making declarations, integrity, and alignment purely AI-managed with no human touchpoints.
**Why bad:** The ontological model requires human participation. Declarations must come from the human. Integrity acknowledgment must be conscious. Occurrence checks must involve human reflection.
**Instead:** Design clear human gates: declaration authoring, integrity acknowledgment, occurrence responses. AI assists but does not replace human agency.

## Suggested Build Order

Based on component dependencies:

```
Phase 1: Foundation
  - Artifact Layer (directory structure, templates)
  - DAG Engine core (parse, validate, add-node, add-edge)
  - FUTURE.md + DAG.md format specification
  Rationale: Everything depends on the data model and storage format.

Phase 2: Declaration Flow
  - Declaration parsing (FUTURE.md authoring)
  - Backward derivation (declare-deriver agent)
  - DAG population (milestones and actions from declarations)
  Rationale: The core ontological flow must work before execution.

Phase 3: Execution Pipeline
  - Topological sort + wave planning
  - Action planning (declare-planner agent, PLAN.md creation)
  - Action execution (declare-executor agent)
  - Upward verification (declare-verifier agent)
  Rationale: Reuses most of GSD's execution machinery.

Phase 4: Integrity System
  - Commitment tracking (INTEGRITY.md)
  - Honor protocol (break detection, guided resolution)
  - Integrity scoring
  Rationale: Can be layered on after execution works.

Phase 5: Alignment System
  - Alignment monitoring (ALIGNMENT.md)
  - Occurrence checks
  - Drift detection
  - Performance scoring (alignment x integrity)
  Rationale: The most novel component. Needs execution + integrity working first.

Phase 6: CLI Polish + Past-Detection
  - Full slash command suite
  - Past-detection engine (declare-assessor agent)
  - GSD compatibility/migration layer
  Rationale: Polish and advanced features after core loop works.
```

**Critical dependency chain:** Artifact Layer -> DAG Engine -> Derivation -> Execution -> Integrity -> Alignment

## Scalability Considerations

| Concern | At 5 declarations | At 20 declarations | At 50+ declarations |
|---------|-------------------|--------------------|--------------------|
| DAG.md size | ~50 lines, trivial | ~200 lines, manageable | Split into multiple DAG files per declaration cluster |
| Topological sort | Array loop, <1ms | Array loop, <5ms | Still fine -- DAGs with <500 nodes are trivial |
| Execution waves | 2-3 waves | 5-10 waves | May need wave batching to avoid agent spawn limits |
| Integrity tracking | Single file | Single file | May need archival of completed commitments |
| Alignment checks | Per-action inline | Per-action inline | May need sampling instead of exhaustive checks |

**Realistic ceiling:** A solo developer + AI project will have 3-10 declarations, 10-30 milestones, and 30-100 actions. The markdown-table approach handles this comfortably. Do not optimize for enterprise scale.

## Key Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| Fork GSD's meta-prompting shell, replace planning ontology | Proven agent orchestration, CLI integration, artifact management. Only the planning model changes. |
| Markdown tables for DAG storage (not JSON/YAML/database) | Human-readable, git-diffable, agent-parseable, consistent with GSD patterns |
| Separate FUTURE.md from DAG.md | Declarations are aspirational and stable; the graph is operational and changes constantly |
| Milestone-scoped directories (not phase-numbered) | Reflects DAG structure, not linear sequence |
| Upward edges (causes/realizes) with inverted traversal for execution | Matches ontological model: actions cause milestones, milestones realize futures |
| Integrity as state machine, not boolean | KEPT/HONORED/BROKEN/RENEGOTIATED captures the full Erhard model |
| Alignment as continuous monitoring, not one-time check | Drift accumulates silently; continuous monitoring catches it early |

## Sources

- GSD codebase analysis (direct file reading): agent architecture, workflow patterns, tools layer, artifact format, state management
- Erhard/Jensen/Zaffron ontological model (as described in PROJECT.md): integrity as wholeness, honor protocol, future-based language
- Vanto Group Three Laws of Performance (as described in PROJECT.md): default future vs declared future, five-stage process
- DAG theory and topological sorting: standard computer science (training data, HIGH confidence)
- Note: Web search was unavailable during this research session. Specific library recommendations for DAG manipulation should be validated in phase-specific research.
