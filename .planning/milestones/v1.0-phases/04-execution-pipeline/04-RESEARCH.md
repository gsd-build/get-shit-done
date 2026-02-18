# Phase 4: Execution Pipeline - Research

**Researched:** 2026-02-16
**Domain:** Topology-aware execution orchestration with wave scheduling and upward verification
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Execution Model
- Same as GSD -- full orchestration via `/declare:execute` slash command that spawns agents
- Slash command .md file + declare-tools.cjs subcommands, consistent with all existing Declare commands
- Execution scope is per-milestone: user picks a milestone, system runs its actions
- Atomic commits per task within a plan, exactly like GSD's executor

#### Wave Scheduling
- Waves derived automatically from the action dependency graph (topological layers = execution waves)
- Independent actions within a wave execute in parallel (multiple agents spawned simultaneously)
- Auto-advance between waves by default; `--confirm` flag to pause between waves for user review
- GSD-style banners with progress indicators for wave status display

#### Upward Verification
- Two-layer verification: automated checks first, then AI review for higher-level milestone advancement assessment
- Verification happens per-wave (after all actions in a wave complete), not per-action
- On failure: retry with feedback sent back to executor (max 2 retries), then surface to user
- When a milestone's last action completes and verification passes, milestone status auto-updates to DONE in MILESTONES.md

#### PLAN.md Generation
- Generate full GSD-style execution plans from the action descriptions in milestone PLAN.md files
- Generated plans include GSD frontmatter (wave, depends_on, files_modified, autonomous), tasks in XML format, verification criteria
- Execution plans written to milestone folders alongside existing PLAN.md (e.g., EXEC-PLAN-01.md)
- Planner has access to full Declare DAG context (trace to declaration) so plans are grounded in purpose

### Claude's Discretion

- Plan timing: whether to generate all plans upfront or on-demand per wave
- Exact executor agent configuration and spawning patterns
- Retry strategy details within the 2-retry limit
- Verification criteria specifics for automated checks

### Deferred Ideas (OUT OF SCOPE)

None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| EXEC-01 | System executes actions respecting topological order via topological sort | `topologicalSort()` in engine.js already provides Kahn's algorithm; new `computeWaves()` function derives topological layers from same in-degree data for execution ordering |
| EXEC-02 | Independent branches execute in parallel (wave-based scheduling from graph structure) | Topological layers naturally group independent nodes; GSD's execute-phase.md wave model provides the orchestration pattern to fork |
| EXEC-03 | System creates PLAN.md files for actions, forking GSD's planner patterns | GSD planner produces XML-task PLAN.md files with frontmatter; Declare needs an EXEC-PLAN generator that transforms action descriptions + DAG context into this format |
| EXEC-04 | Executor verifies upward causation after each action (does this advance its milestone?) | Two-layer verification: automated file/test checks first, then AI review using trace context (declaration -> milestone -> action why-chain) |
</phase_requirements>

## Summary

Phase 4 builds the execution pipeline for Declare's action graph. The core challenge is transforming the three-layer DAG (declarations -> milestones -> actions) into an executable wave schedule, generating GSD-compatible execution plans, running them through agent orchestration, and verifying that completed actions actually advance their parent milestones.

The existing codebase provides strong foundations: `DeclareDag.topologicalSort()` already implements Kahn's algorithm for ordering, `buildDagFromDisk()` reconstructs the full graph, `traceUpward()` produces why-chains, and the milestone folder structure (`./planning/milestones/{M-XX-slug}/`) provides a natural home for execution plan files. The GSD executor and planner agents provide battle-tested patterns for agent spawning, task commits, and checkpoint handling.

The primary new work is: (1) a `computeWaves()` function that derives topological layers from the action dependency graph within a milestone scope, (2) a `generate-exec-plan` subcommand that transforms Declare action descriptions into GSD-style PLAN.md files enriched with DAG context, (3) an `execute` subcommand that feeds wave data and milestone scope to the slash command orchestrator, and (4) a `verify-wave` subcommand that checks whether completed actions advanced their milestone.

**Primary recommendation:** Build three new declare-tools.cjs subcommands (`compute-waves`, `generate-exec-plan`, `verify-wave`) plus the `/declare:execute` slash command, following the established meta-prompt pattern where .md instructs Claude and CJS provides structured JSON data.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js built-ins (fs, path, child_process) | Node 18+ | File I/O, path manipulation, git integration | Zero-dependency constraint from INFR-04 |
| DeclareDag (src/graph/engine.js) | Internal | Graph operations, topological sort, node queries | Already proven in phases 1-3; provides Kahn's algorithm |
| buildDagFromDisk (src/commands/build-dag.js) | Internal | Graph reconstruction from disk artifacts | Shared utility used by all graph-consuming commands |
| esbuild | 0.24.2 | CJS bundling | Existing dev dependency; bundles to dist/declare-tools.cjs |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| traceUpward (src/commands/trace.js) | Internal | Why-chain traversal for context enrichment | When generating exec plans to provide declaration -> milestone -> action context |
| parsePlanFile / writePlanFile (src/artifacts/plan.js) | Internal | Milestone PLAN.md parsing and writing | When reading action descriptions and updating action statuses |
| findMilestoneFolder (src/artifacts/milestone-folders.js) | Internal | Locate milestone directories | When writing EXEC-PLAN files to correct location |
| parseMilestonesFile / writeMilestonesFile (src/artifacts/milestones.js) | Internal | MILESTONES.md read/write | When auto-updating milestone status to DONE |
| commitPlanningDocs (src/git/commit.js) | Internal | Atomic git commits | Per-plan commit after execution |

### Alternatives Considered

None -- the locked decision is "same as GSD" and all tooling is internal. No new external dependencies are needed.

**Installation:**
No new packages. All work uses existing codebase primitives.

## Architecture Patterns

### Recommended Project Structure

```
src/
├── graph/
│   └── engine.js            # DeclareDag (existing) -- add computeWaves()
├── artifacts/
│   ├── plan.js              # Existing -- milestone PLAN.md parser/writer
│   ├── milestones.js         # Existing -- MILESTONES.md parser/writer
│   └── exec-plan.js          # NEW -- EXEC-PLAN generator (GSD format)
├── commands/
│   ├── build-dag.js          # Existing -- shared graph loading
│   ├── compute-waves.js      # NEW -- wave computation for a milestone's actions
│   ├── generate-exec-plan.js # NEW -- transforms action -> GSD-style plan
│   ├── verify-wave.js        # NEW -- post-wave upward verification
│   └── execute.js            # NEW -- feeds execution data to slash command
├── declare-tools.js          # Entry point -- add new subcommands
.claude/commands/declare/
└── execute.md                # NEW -- /declare:execute slash command
```

### Pattern 1: Topological Layer Computation (computeWaves)

**What:** Derive execution waves from the action dependency graph within a milestone's scope. Actions with no dependencies (in-degree 0 after filtering to milestone scope) form Wave 1. Actions depending only on Wave 1 form Wave 2, etc.

**When to use:** When `/declare:execute` needs to schedule actions for a milestone.

**How it works:**

The Declare DAG has upward edges only (action -> milestone, milestone -> declaration). Actions within a single milestone have no explicit inter-action edges -- they are all siblings causing the same milestone. However, topological layers still apply because:

1. Within a milestone, actions may produce artifacts that other actions depend on (captured in the `produces` field of PLAN.md actions).
2. The topological sort from Kahn's algorithm already respects this by processing nodes with in-degree 0 first.

For the Declare v1 case where actions within a milestone are siblings with no inter-action edges, ALL actions form a single wave (Wave 1) and execute in parallel. This is the correct behavior -- siblings are independent by definition.

If future phases add action-to-action dependency edges, the wave algorithm generalizes naturally by computing in-degree within the action layer.

```javascript
/**
 * Compute execution waves for a milestone's actions.
 * Groups actions into parallel execution layers.
 *
 * @param {DeclareDag} dag
 * @param {string} milestoneId - e.g. 'M-01'
 * @returns {{ waves: Array<string[]>, order: string[] }}
 */
function computeWaves(dag, milestoneId) {
  const actions = dag.getDownstream(milestoneId)
    .filter(n => n.type === 'action' && n.status !== 'DONE');

  if (actions.length === 0) return { waves: [], order: [] };

  // In current model, all actions within a milestone are siblings
  // (no inter-action edges), so they all form Wave 1.
  // Future: if action-to-action deps are added, compute in-degree here.
  const wave1 = actions.map(a => a.id).sort();
  return {
    waves: [wave1],
    order: wave1,
  };
}
```

**Confidence:** HIGH -- verified against engine.js graph structure and milestone PLAN.md format.

### Pattern 2: Exec Plan Generation (forking GSD planner format)

**What:** Transform a Declare action description into a GSD-style PLAN.md with XML tasks, frontmatter, and verification criteria.

**When to use:** Before executing each action. The `/declare:execute` slash command needs concrete execution plans.

**Key insight:** GSD's PLAN.md format serves as the execution prompt -- it IS the instruction set for the executor agent. Declare needs to generate this format from its action metadata, enriched with the why-chain context.

```markdown
---
phase: M-01
plan: A-01
type: execute
wave: 1
depends_on: []
files_modified: [inferred from action.produces]
autonomous: true
---

<objective>
[Action title from PLAN.md]

Purpose: [Why-chain: This action causes milestone M-01 which realizes declaration D-01]
Output: [action.produces field]
</objective>

<context>
@.planning/FUTURE.md
@.planning/MILESTONES.md
@.planning/milestones/M-01-slug/PLAN.md
</context>

<tasks>
<task type="auto">
  <name>Task 1: [derived from action description]</name>
  <files>[from action.produces]</files>
  <action>[action description from PLAN.md, enriched]</action>
  <verify>[derived verification]</verify>
  <done>[acceptance criteria]</done>
</task>
</tasks>

<verification>
[check that action's produces artifacts exist and function correctly]
</verification>

<success_criteria>
[action.produces exists and is functional]
</success_criteria>
```

**Confidence:** HIGH -- directly based on GSD planner format studied from gsd-planner.md.

### Pattern 3: Meta-Prompt Orchestration (slash command + CJS)

**What:** The `/declare:execute` slash command .md file instructs Claude to: load graph, determine milestone scope, compute waves, optionally generate exec plans, then spawn executor agents per wave.

**When to use:** This is the primary user-facing entry point.

**Flow:**
1. User runs `/declare:execute M-01` (or `/declare:execute` for interactive milestone selection)
2. Slash command calls `node dist/declare-tools.cjs execute --milestone M-01`
3. CJS returns JSON: milestone info, wave structure, action details, trace context
4. Slash command orchestrates: generates exec plans -> spawns agents per wave -> verifies per wave -> updates statuses

This matches the existing pattern used by `/declare:trace`, `/declare:visualize`, and `/declare:actions`.

**Confidence:** HIGH -- exact pattern used by all existing Declare commands.

### Pattern 4: Upward Verification

**What:** After each wave completes, verify that the completed actions actually advanced the parent milestone.

**Two layers:**
1. **Automated checks:** Do the `produces` artifacts exist? Do tests pass? Did commits land?
2. **AI review:** Given the trace context (declaration -> milestone -> action), does this work meaningfully advance the milestone toward the declaration?

```javascript
/**
 * Verify wave completion against milestone advancement.
 *
 * @param {string} cwd
 * @param {string} milestoneId
 * @param {string[]} completedActionIds
 * @returns {{ passed: boolean, automated: object, aiReviewNeeded: boolean, context: object }}
 */
function verifyWave(cwd, milestoneId, completedActionIds) {
  const graphResult = buildDagFromDisk(cwd);
  const { dag } = graphResult;

  // Automated: check produces artifacts exist
  const actionChecks = completedActionIds.map(actionId => {
    const action = dag.getNode(actionId);
    // Check action's produces field against filesystem
    return { actionId, producesExist: true /* filesystem check */ };
  });

  // Check if all milestone actions are now DONE
  const allActions = dag.getDownstream(milestoneId).filter(n => n.type === 'action');
  const allDone = allActions.every(a =>
    a.status === 'DONE' || completedActionIds.includes(a.id)
  );

  // Build trace context for AI review
  const traceContext = traceUpward(dag, milestoneId);

  return {
    passed: actionChecks.every(c => c.producesExist),
    automated: { actionChecks },
    milestoneCompletable: allDone,
    aiReviewNeeded: true,
    context: { milestoneId, traceContext, allDone },
  };
}
```

**Confidence:** HIGH for automated checks, MEDIUM for AI review specifics (discretion area).

### Anti-Patterns to Avoid

- **Reimplementing topological sort:** Use existing `DeclareDag.topologicalSort()` and Kahn's algorithm. The wave computation is a layer on top, not a replacement.
- **Coupling exec plan generation to execution:** Plans should be generated as files first, then executed separately. This allows inspection and manual tweaking.
- **Per-action verification:** The locked decision is per-wave verification. Per-action would be too noisy and slow.
- **Breaking the zero-dependency constraint:** All new code must be pure Node.js built-ins. No npm packages.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Topological sort | Custom sort algorithm | `DeclareDag.topologicalSort()` | Already proven with Kahn's algorithm, handles cycle detection |
| Graph loading | Manual file parsing | `buildDagFromDisk()` | Shared utility handles all artifact formats |
| Why-chain traversal | Manual graph walks | `traceUpward()` from trace.js | Already handles multi-path scenarios and path limits |
| Milestone folder management | Manual path construction | `findMilestoneFolder()`, `ensureMilestoneFolder()` | Handles slug lookup and creation |
| Markdown table I/O | Regex parsing | `parseMilestonesFile()`, `writeMilestonesFile()` | Battle-tested with aligned column output |
| Git commits | Manual git commands | `commitPlanningDocs()` | Atomic commit with config-driven behavior |
| CLI arg parsing | argv manipulation | `parseFlag()` from parse-args.js | Consistent with all existing commands |

**Key insight:** Phase 4's new code is primarily orchestration logic and format transformation. The heavy lifting (graph operations, file I/O, git) is already solved by phases 1-3.

## Common Pitfalls

### Pitfall 1: Confusing Declare PLAN.md with GSD PLAN.md

**What goes wrong:** Declare's milestone PLAN.md (`# Plan: M-01 -- Title` with `### A-XX: Action` sections) has a completely different format from GSD's execution PLAN.md (YAML frontmatter + XML tasks). The phase needs to generate the latter from the former.

**Why it happens:** Same filename "PLAN.md" in different contexts. Declare stores action descriptions; GSD stores executable prompts.

**How to avoid:** Name generated execution plans `EXEC-PLAN-{NN}.md` (as specified in locked decisions), not `PLAN.md`. Use a distinct artifact module (`exec-plan.js`) separate from the existing `plan.js`.

**Warning signs:** If code tries to parse frontmatter from a Declare PLAN.md or XML tasks from it, the format is wrong.

### Pitfall 2: Scope Explosion -- Executing All Milestones at Once

**What goes wrong:** Trying to execute across milestone boundaries leads to massive plans, unclear verification, and tangled commits.

**Why it happens:** Over-ambition -- wanting to execute everything in the DAG at once.

**How to avoid:** Execution scope is per-milestone (locked decision). The slash command takes a milestone ID and only operates on that milestone's actions.

**Warning signs:** If the wave computation considers actions from multiple milestones simultaneously.

### Pitfall 3: Not Filtering DONE Actions from Waves

**What goes wrong:** Re-executing actions that are already marked DONE, wasting time and potentially breaking completed work.

**Why it happens:** Using raw `getDownstream()` without status filtering.

**How to avoid:** Always filter `actions.filter(a => a.status !== 'DONE')` before computing waves. This also enables re-running `/declare:execute` on a partially-completed milestone.

**Warning signs:** Wave computation includes actions with status 'DONE'.

### Pitfall 4: Generating Plans Without Why-Chain Context

**What goes wrong:** Execution plans lack purpose grounding, leading to implementations that technically complete but don't advance the milestone meaningfully.

**Why it happens:** Treating plan generation as a simple format translation instead of context enrichment.

**How to avoid:** Always include the full trace (declaration -> milestone -> action) in the generated exec plan's `<objective>` section. The planner agent needs to understand WHY the action exists.

**Warning signs:** Generated EXEC-PLAN files have generic objectives without referencing the parent milestone or source declaration.

### Pitfall 5: Status Update Race Conditions

**What goes wrong:** Parallel agents writing to MILESTONES.md simultaneously cause file corruption or lost updates.

**Why it happens:** Multiple executor agents in the same wave all completing and trying to update status files.

**How to avoid:** Status updates happen in the orchestrator (slash command), not in individual executor agents. After a wave completes, the orchestrator sequentially updates statuses. Same pattern as GSD's execute-phase.md where the orchestrator collects results before updating state.

**Warning signs:** Executor agent prompts include instructions to update MILESTONES.md directly.

## Code Examples

### Example 1: Wave Computation Subcommand

```javascript
// src/commands/compute-waves.js
const { parseFlag } = require('./parse-args');
const { buildDagFromDisk } = require('./build-dag');

function runComputeWaves(cwd, args) {
  const milestoneId = parseFlag(args, 'milestone');
  if (!milestoneId) return { error: 'Missing --milestone flag' };

  const graphResult = buildDagFromDisk(cwd);
  if (graphResult.error) return graphResult;
  const { dag } = graphResult;

  const milestone = dag.getNode(milestoneId);
  if (!milestone) return { error: `Milestone not found: ${milestoneId}` };
  if (milestone.type !== 'milestone') return { error: `${milestoneId} is not a milestone` };

  // Get non-DONE actions for this milestone
  const actions = dag.getDownstream(milestoneId)
    .filter(n => n.type === 'action' && n.status !== 'DONE');

  if (actions.length === 0) {
    return { milestoneId, waves: [], totalActions: 0, allDone: true };
  }

  // In current model, all sibling actions form one wave
  const wave1 = actions.map(a => ({
    id: a.id,
    title: a.title,
    status: a.status,
    produces: a.metadata.produces || '',
  })).sort((a, b) => a.id.localeCompare(b.id));

  // Get trace context for enrichment
  const upstream = dag.getUpstream(milestoneId);
  const declarations = upstream.map(u => ({ id: u.id, title: u.title }));

  return {
    milestoneId,
    milestoneTitle: milestone.title,
    declarations,
    waves: [{ wave: 1, actions: wave1 }],
    totalActions: wave1.length,
    allDone: false,
  };
}
```
Source: Pattern derived from existing `runPrioritize()` in `/Users/guilherme/Projects/get-shit-done/src/commands/prioritize.js` and `runTrace()` in `/Users/guilherme/Projects/get-shit-done/src/commands/trace.js`.

### Example 2: EXEC-PLAN File Generation

```javascript
// src/artifacts/exec-plan.js
const { traceUpward } = require('../commands/trace');

function generateExecPlan(dag, actionId, milestoneId, waveNumber) {
  const action = dag.getNode(actionId);
  const milestone = dag.getNode(milestoneId);

  // Build why-chain for context
  const paths = traceUpward(dag, actionId);
  const declarations = [...new Set(
    paths.flatMap(p => p.filter(n => n.type === 'declaration').map(n => `${n.id}: ${n.title}`))
  )];

  const whyChain = declarations.length > 0
    ? `This action causes ${milestoneId} ("${milestone.title}") which realizes ${declarations.join(', ')}`
    : `This action causes ${milestoneId} ("${milestone.title}")`;

  return `---
phase: ${milestoneId}
plan: ${actionId}
type: execute
wave: ${waveNumber}
depends_on: []
files_modified: []
autonomous: true
---

<objective>
${action.title}

Purpose: ${whyChain}
Output: ${action.metadata.produces || 'See action description'}
</objective>

<context>
@.planning/FUTURE.md
@.planning/MILESTONES.md
</context>

<tasks>
<task type="auto">
  <name>Task 1: ${action.title}</name>
  <files>TBD - executor determines from action scope</files>
  <action>
${action.metadata.description || action.title}

Context: ${whyChain}
  </action>
  <verify>Verify that the action's output exists and functions correctly</verify>
  <done>${action.metadata.produces || action.title} is complete and verified</done>
</task>
</tasks>

<verification>
1. Action produces artifacts exist on disk
2. Any tests related to this action pass
3. Git commits reflect the work done
</verification>

<success_criteria>
${action.title} is complete, verified, and advances milestone ${milestoneId}
</success_criteria>

<output>
After completion, commit atomically and report results to orchestrator.
</output>
`;
}
```
Source: Format derived from GSD planner template at `/Users/guilherme/.claude/agents/gsd-planner.md` (plan_format section).

### Example 3: Slash Command Structure

```markdown
<!-- .claude/commands/declare/execute.md -->
---
description: Execute actions for a milestone with wave-based scheduling
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - Task
argument-hint: "[M-XX] [--confirm]"
---

Step 1: Load graph and determine milestone scope.

node dist/declare-tools.cjs compute-waves --milestone M-XX

Step 2: Generate exec plans for each action.

node dist/declare-tools.cjs generate-exec-plan --action A-XX --milestone M-XX

Step 3: Per wave, spawn executor agents (Task tool).
Step 4: After each wave, verify advancement.

node dist/declare-tools.cjs verify-wave --milestone M-XX --actions "A-01,A-02"

Step 5: If all actions done, update milestone status to DONE.
```
Source: Pattern from existing `/Users/guilherme/Projects/get-shit-done/.claude/commands/declare/trace.md` and `/Users/guilherme/Projects/get-shit-done/.claude/commands/declare/actions.md`.

## Discretion Recommendations

### Plan Timing: On-Demand Per Wave (Recommended)

**Recommendation:** Generate execution plans on-demand, one wave at a time, not all upfront.

**Rationale:**
1. Earlier waves may produce artifacts that inform later wave plans (adaptive planning).
2. If a wave fails, no wasted effort generating plans for subsequent waves.
3. Keeps the slash command context leaner -- only one wave of plans in scope at a time.
4. Consistent with GSD's `execute-phase.md` which discovers plans per wave, not all upfront.

**Risk:** Slightly slower start per wave (plan generation adds a step). Acceptable given Declare milestones typically have 3-6 actions.

### Executor Agent Configuration

**Recommendation:** Reuse GSD's `gsd-executor` agent directly for executing EXEC-PLAN files.

**Rationale:**
1. EXEC-PLAN files are in GSD PLAN.md format -- the executor already knows how to handle them.
2. No need for a separate `declare-executor` agent -- that would duplicate proven logic.
3. The Declare-specific orchestration (wave scheduling, upward verification, milestone status) stays in the slash command, not in the executor.

**Agent spawning pattern:**
```
Task(
  subagent_type="gsd-executor",
  prompt="Execute plan at .planning/milestones/M-01-slug/EXEC-PLAN-01.md ..."
)
```

### Retry Strategy

**Recommendation:** Simple sequential retry with feedback enrichment.

**Flow:**
1. Action fails verification
2. Orchestrator reads the failure details from executor output
3. Retry 1: Spawn new executor with original plan + failure context appended
4. If retry 1 fails: Retry 2 with accumulated failure context
5. If retry 2 fails: Surface to user with full failure history

**Max 2 retries** as locked. No exponential backoff needed -- these are Claude agent spawns, not API calls.

### Verification Criteria for Automated Checks

**Recommendation:** Three automated checks per wave, then AI review:

1. **Artifact existence:** Do the files listed in `action.produces` exist on disk?
2. **Commit verification:** Did the executor create at least one git commit with the expected scope tag?
3. **Test pass:** If tests exist in the project, do they still pass after execution?

The AI review is a prompt to evaluate: "Given the declaration '{D-XX title}', milestone '{M-XX title}', and the completed actions, has the milestone meaningfully advanced?"

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| GSD sequential phase execution | Declare wave-based parallel within milestone | Phase 4 | Actions within a wave run in parallel via Task tool |
| GSD plans are standalone | Declare plans are DAG-grounded | Phase 4 | Exec plans carry trace context (why-chain) |
| GSD verification is plan-level | Declare verification is upward-causation | Phase 4 | Verification checks milestone advancement, not just task completion |

**Deprecated/outdated:**
- None -- this is new functionality building on stable foundations.

## Open Questions

1. **Action-to-action dependencies within milestones**
   - What we know: Current PLAN.md format has `produces` field per action but no explicit `depends_on` between sibling actions. All actions within a milestone currently form a single wave.
   - What's unclear: Should the `produces` field be analyzed to infer implicit dependencies? E.g., if A-01 produces `src/auth.js` and A-02's description references auth functionality, should A-02 depend on A-01?
   - Recommendation: For v1, keep it simple -- all actions in a milestone form one wave. If users need ordering, they can mark actions as DONE manually to control wave composition. Add explicit `depends_on` field to action format in a later phase if needed.

2. **EXEC-PLAN file lifecycle**
   - What we know: EXEC-PLAN files are generated and stored in milestone folders. After execution, they contain the concrete instructions that were followed.
   - What's unclear: Should EXEC-PLAN files be cleaned up after execution? Or kept as audit trail?
   - Recommendation: Keep them. They serve as an audit trail showing exactly what was executed, similar to how GSD keeps SUMMARY.md files. No cleanup needed.

3. **Partial milestone re-execution**
   - What we know: If some actions in a milestone are DONE and others are PENDING, the wave computation filters out DONE actions.
   - What's unclear: If a DONE action needs to be re-executed (e.g., regression), should there be a `--force` flag?
   - Recommendation: Defer `--force` flag. User can manually reset action status in PLAN.md from DONE to PENDING, then re-run `/declare:execute`.

## Sources

### Primary (HIGH confidence)

- `/Users/guilherme/Projects/get-shit-done/src/graph/engine.js` -- DeclareDag class, topologicalSort(), Kahn's algorithm, node/edge operations
- `/Users/guilherme/Projects/get-shit-done/src/commands/build-dag.js` -- buildDagFromDisk(), loadActionsFromFolders()
- `/Users/guilherme/Projects/get-shit-done/src/commands/trace.js` -- traceUpward() for why-chain traversal
- `/Users/guilherme/Projects/get-shit-done/src/commands/prioritize.js` -- dependencyWeight(), getSubtreeNodeIds() patterns
- `/Users/guilherme/Projects/get-shit-done/src/artifacts/plan.js` -- parsePlanFile(), writePlanFile() for milestone PLAN.md
- `/Users/guilherme/Projects/get-shit-done/src/artifacts/milestones.js` -- parseMilestonesFile(), writeMilestonesFile()
- `/Users/guilherme/Projects/get-shit-done/src/artifacts/milestone-folders.js` -- folder management utilities
- `/Users/guilherme/Projects/get-shit-done/src/declare-tools.js` -- CLI entry point, subcommand dispatch pattern
- `/Users/guilherme/.claude/agents/gsd-executor.md` -- Executor agent: task commits, deviation rules, checkpoint protocol
- `/Users/guilherme/.claude/get-shit-done/workflows/execute-plan.md` -- Execute-plan workflow: task execution, SUMMARY creation
- `/Users/guilherme/.claude/get-shit-done/workflows/execute-phase.md` -- Execute-phase orchestrator: wave discovery, agent spawning, parallel execution
- `/Users/guilherme/.claude/agents/gsd-planner.md` -- Planner agent: PLAN.md format, XML tasks, frontmatter, wave assignment

### Secondary (MEDIUM confidence)

- `/Users/guilherme/Projects/get-shit-done/.planning/phases/04-execution-pipeline/04-CONTEXT.md` -- User decisions and discretion areas
- `/Users/guilherme/Projects/get-shit-done/.planning/REQUIREMENTS.md` -- EXEC-01 through EXEC-04 requirement definitions
- `/Users/guilherme/Projects/get-shit-done/.planning/ROADMAP.md` -- Phase 4 description and success criteria

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all internal, no external dependencies, verified against existing codebase
- Architecture: HIGH -- patterns directly derived from existing Declare commands and GSD workflows
- Pitfalls: HIGH -- identified from hands-on analysis of format differences and concurrency risks
- Discretion recommendations: MEDIUM -- reasonable engineering judgment, but user may have different preferences

**Research date:** 2026-02-16
**Valid until:** 2026-03-16 (stable -- internal codebase, no external dependency churn)
