# Phase 3: Traceability + Navigation - Research

**Researched:** 2026-02-16
**Domain:** Graph traversal, ASCII visualization, dependency-based prioritization, CLI command patterns
**Confidence:** HIGH

## Summary

Phase 3 adds three read-only capabilities to the Declare system: (1) why-chain tracing from any node up through the graph to its source declarations, (2) ASCII/Unicode visualization of the full derivation structure, and (3) dependency-weight prioritization of actions. No graph mutations or new persistence -- this phase is purely about querying and displaying the existing graph built in Phases 1-2.

The graph engine (`DeclareDag`) already provides the primitives needed: `getUpstream(id)` for traversal toward declarations, `getDownstream(id)` for traversal toward actions, `getNode(id)` for metadata, and `topologicalSort()` for ordering. All three new commands are graph traversal algorithms layered on top of these existing APIs, combined with text-formatting output. The primary technical challenge is the visualization layout algorithm -- rendering a DAG as readable ASCII art with proper spacing and connectors.

All three commands follow the established meta-prompt pattern: a `.claude/commands/declare/*.md` slash command instructs Claude what to display, while `declare-tools.cjs` provides the raw data as JSON. The new commands (`trace`, `visualize`, `prioritize`) each get a new subcommand in `declare-tools.cjs` and a new source file in `src/commands/`.

**Primary recommendation:** Implement in this order: (1) trace command (simplest, validates traversal), (2) prioritize command (reuses traversal, adds scoring), (3) visualize command (most complex, depends on understanding the full graph shape). All three commands share a common graph-loading preamble -- extract this into a shared utility to avoid duplicating the load-graph pattern that currently exists in both `status.js` and `load-graph.js`.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Why-chain output:**
- Full chain always: Action -> Milestone -> Declaration, every trace shows the complete path
- Show names + summaries at each level (ID and title), keep it scannable
- When an action traces to multiple declarations through different milestones, show all paths
- Tree connectors (--- and --- style) for visual structure

**Graph visualization:**
- Default scope: full graph (all declarations -> milestones -> actions in one view)
- Top-down orientation: declarations at top flowing down to milestones then actions (cause flows downward)
- Status markers on nodes: [done] done, [pending] pending, [blocked] blocked -- inline with node names
- Unicode box-drawing characters (box-drawing style) for cleaner look
- Optional scope argument: `/declare:visualize D-01` zooms into that declaration's subtree; no arg = full graph

**Prioritization model:**
- Priority = dependency weight: actions that block the most other actions rank highest (unblocking power)
- Pure structure ranking: based only on graph topology, ignore completion state
- Display: ranked list with priority score visible so user understands the ranking
- Filter by declaration: flag to scope priority list to a specific declaration's subtree

**Command design:**
- Three separate slash commands: `/declare:trace`, `/declare:visualize`, `/declare:prioritize`
- `/declare:trace`: accepts node ID as argument; if no argument, shows interactive picker
- `/declare:visualize`: optional scope argument (declaration/milestone ID) to zoom into subtree
- `/declare:prioritize`: optional declaration filter flag
- All commands support `--output` flag to write to file (useful for sharing visualizations)
- Terminal output by default

### Claude's Discretion

- Exact tree layout algorithm for visualization
- Priority score formula details (how to compute dependency weight)
- Interactive picker implementation for trace command
- Color usage in terminal output (if any)

### Deferred Ideas (OUT OF SCOPE)

None -- discussion stayed within phase scope

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DAG-06 | User can trace any action through milestones to its source declaration (why-chain) | Trace command: recursive upward traversal via `getUpstream()`, multi-path BFS to find all declaration paths |
| DAG-07 | System provides ASCII/text-based visualization of the derivation structure | Visualize command: top-down tree layout with Unicode box-drawing, subtree scoping |
| DAG-08 | System prioritizes actions by causal contribution to declarations (impact ordering) | Prioritize command: dependency-weight scoring via downstream reachability count |

</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js | >= 18.0.0 | Runtime | Already established in Phase 1 |
| DeclareDag (engine.js) | internal | Graph traversal primitives | Already built -- getUpstream, getDownstream, topologicalSort |
| esbuild | ^0.24.2 | CJS bundling | Already in devDependencies, bundles new commands into dist/declare-tools.cjs |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| node:test | built-in | Test runner | Testing traversal, scoring, and layout algorithms |
| node:assert | built-in | Assertions | Test assertions |
| node:fs | built-in | File I/O | `--output` flag writes visualization to file |
| node:path | built-in | Path handling | Resolving output file paths |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom ASCII layout | cli-boxes, boxen | External dependency; the graph is simple (3 layers, max ~100 nodes). Custom layout is appropriate for this constrained topology. |
| Custom priority scoring | PageRank-style libraries | Overkill. Dependency weight is a simple reachability count, ~20 lines of BFS. |

**Installation:**
```bash
# No new dependencies needed. Phase 3 uses only existing stack.
```

## Architecture Patterns

### Recommended Project Structure (additions)

```
src/
  commands/
    trace.js          # NEW: Why-chain traversal logic
    visualize.js      # NEW: ASCII graph visualization logic
    prioritize.js     # NEW: Dependency-weight scoring logic
    load-graph.js     # EXISTING: Shared graph loading (refactor to expose DAG instance)
  declare-tools.js    # MODIFY: Add trace, visualize, prioritize subcommands

.claude/commands/declare/
  trace.md            # NEW: /declare:trace slash command
  visualize.md        # NEW: /declare:visualize slash command
  prioritize.md       # NEW: /declare:prioritize slash command
```

### Pattern 1: Recursive Upward Traversal (Why-Chain)

**What:** Starting from any node, follow `getUpstream()` recursively until reaching declarations (which have no upstream). Collect all paths.

**When to use:** The trace command (DAG-06).

**Example:**

```javascript
/**
 * Find all paths from a node upward to declarations.
 * Returns array of paths, each path is an array of node objects.
 *
 * @param {DeclareDag} dag
 * @param {string} startId
 * @returns {Array<Array<{id: string, type: string, title: string, status: string}>>}
 */
function traceUpward(dag, startId) {
  const startNode = dag.getNode(startId);
  if (!startNode) return [];

  // Declarations are endpoints -- they have no upstream
  if (startNode.type === 'declaration') {
    return [[startNode]];
  }

  const paths = [];
  const upstream = dag.getUpstream(startId);

  if (upstream.length === 0) {
    // Orphan node -- return single-node path
    return [[startNode]];
  }

  for (const parent of upstream) {
    const parentPaths = traceUpward(dag, parent.id);
    for (const parentPath of parentPaths) {
      paths.push([startNode, ...parentPath]);
    }
  }

  return paths;
}
```

**Key insight:** The graph is a strict 3-layer DAG with at most 2 hops from any action to a declaration. Recursion depth is bounded at 3 (action -> milestone -> declaration). No stack overflow risk.

### Pattern 2: Dependency-Weight Scoring (Prioritization)

**What:** For each action, count how many other nodes in the graph are reachable by traversing upward from it. Actions that contribute to more milestones and declarations score higher.

**When to use:** The prioritize command (DAG-08).

**Recommendation (Claude's Discretion -- priority score formula):**

The "unblocking power" metric should count the total number of downstream dependents -- i.e., how many other nodes transitively depend on this action being completed. In a 3-layer DAG where edges flow upward (action -> milestone -> declaration), "downstream dependents" means: for each action A, count the unique milestones reachable from A (via upEdges) plus the unique declarations reachable from those milestones (via upEdges).

```javascript
/**
 * Compute dependency weight for a single node.
 * Weight = number of unique nodes reachable via upward traversal.
 *
 * @param {DeclareDag} dag
 * @param {string} nodeId
 * @returns {number}
 */
function dependencyWeight(dag, nodeId) {
  const visited = new Set();
  const queue = [nodeId];

  while (queue.length > 0) {
    const current = queue.shift();
    if (visited.has(current)) continue;
    visited.add(current);

    const upstream = dag.getUpstream(current);
    for (const parent of upstream) {
      if (!visited.has(parent.id)) {
        queue.push(parent.id);
      }
    }
  }

  // Subtract 1 to exclude the node itself
  return visited.size - 1;
}

/**
 * Rank all actions by dependency weight (descending).
 *
 * @param {DeclareDag} dag
 * @param {string} [filterDeclarationId] - Optional: scope to a declaration's subtree
 * @returns {Array<{id: string, title: string, score: number}>}
 */
function rankActions(dag, filterDeclarationId) {
  let actions = dag.getActions();

  if (filterDeclarationId) {
    // Filter to actions within this declaration's subtree
    const subtreeNodes = getSubtreeNodeIds(dag, filterDeclarationId);
    actions = actions.filter(a => subtreeNodes.has(a.id));
  }

  const ranked = actions.map(a => ({
    id: a.id,
    title: a.title,
    score: dependencyWeight(dag, a.id),
  }));

  ranked.sort((a, b) => b.score - a.score);
  return ranked;
}
```

**Score interpretation:** An action with score 3 means it contributes to 3 other nodes (e.g., 2 milestones and 1 declaration). An action with score 1 means it only contributes to 1 milestone. Higher = more unblocking power.

### Pattern 3: Top-Down Tree Layout (Visualization)

**What:** Render the DAG as a top-down ASCII tree using Unicode box-drawing characters. Declarations at top, milestones in middle, actions at bottom.

**When to use:** The visualize command (DAG-07).

**Recommendation (Claude's Discretion -- layout algorithm):**

Use a layer-based layout approach:

1. **Layer assignment:** Declarations = layer 0, milestones = layer 1, actions = layer 2. This is already implicit in the type system.
2. **Node ordering within layers:** Sort by ID (natural order: D-01, D-02, ...) within each layer. For subtree scoping, only include nodes reachable from the scoped root.
3. **Rendering:** Process top-down. For each declaration, render its milestone children, and for each milestone, render its action children. Use tree connectors for parent-child relationships.

```javascript
/**
 * Example output format for full graph visualization:
 *
 * Declare: project-name
 *
 * D-01: Users can declare futures [ACTIVE]
 * ├── M-01: CLI accepts declaration input [PENDING]
 * │   ├── A-01: Build declaration parser [DONE]
 * │   └── A-02: Add validation rules [PENDING]
 * └── M-02: Declarations persist to disk [PENDING]
 *     └── A-03: Write FUTURE.md writer [PENDING]
 *
 * D-02: System derives milestones backward [PENDING]
 * └── M-03: Backward derivation flow works [PENDING]
 *     ├── A-04: Implement derivation prompt [PENDING]
 *     └── A-05: Wire milestone creation [PENDING]
 */
```

**Status markers mapping:**
- `DONE` -> `[done]` (checkmark unicode)
- `PENDING` -> `[pending]` (circle unicode)
- `ACTIVE` -> `[active]` (right-pointing triangle or similar)
- Blocked detection: a node is "blocked" if it has upstream dependencies that are not DONE. Show `[!]` for blocked.

**Handling many-to-many:** When an action or milestone appears under multiple parents, show it under each parent (duplicated in the tree view). This matches the user's decision to "show all paths" for trace. Alternatively, show it under its first parent and add a reference marker (e.g., "-> see M-01") under subsequent parents. The first approach is simpler and recommended.

**Subtree scoping:** When `/declare:visualize D-01` is given, traverse downward from D-01 using `getDownstream()` recursively to collect all nodes in the subtree, then render only those nodes.

```javascript
/**
 * Get all node IDs in a subtree rooted at the given node.
 * Traverses downward (toward actions).
 *
 * @param {DeclareDag} dag
 * @param {string} rootId
 * @returns {Set<string>}
 */
function getSubtreeNodeIds(dag, rootId) {
  const visited = new Set();
  const queue = [rootId];

  while (queue.length > 0) {
    const current = queue.shift();
    if (visited.has(current)) continue;
    visited.add(current);

    const downstream = dag.getDownstream(current);
    for (const child of downstream) {
      if (!visited.has(child.id)) {
        queue.push(child.id);
      }
    }
  }

  return visited;
}
```

### Pattern 4: Command Module Structure

**What:** Each new command follows the same pattern as existing commands: a `run*` function that accepts `cwd` and args, loads the graph, computes results, returns structured JSON.

**When to use:** All three new commands.

```javascript
// Pattern for all Phase 3 commands:
function runTrace(cwd, args) {
  // 1. Load graph (shared with status, load-graph)
  const graphResult = loadAndBuildDag(cwd);
  if (graphResult.error) return graphResult;
  const { dag } = graphResult;

  // 2. Parse command-specific arguments
  const nodeId = parseFlag(args, 'node') || args[0];
  const outputFile = parseFlag(args, 'output');

  // 3. Run algorithm
  const paths = traceUpward(dag, nodeId);

  // 4. Format output
  const formatted = formatTracePaths(paths);

  // 5. Optionally write to file
  if (outputFile) {
    writeFileSync(outputFile, formatted);
  }

  // 6. Return structured JSON
  return { nodeId, paths, formatted };
}
```

### Pattern 5: Shared Graph Loading

**What:** Extract the repeated graph-loading pattern (parse FUTURE.md + MILESTONES.md + PLAN.md files, build DAG) into a shared utility.

**When to use:** Shared by trace, visualize, prioritize, status, and load-graph commands.

**Current state:** The graph-loading logic is duplicated between `load-graph.js` (lines 62-121) and `status.js` (lines 81-135). Both parse the same files and build the same DAG. Phase 3 adds three more commands that need the same pattern.

```javascript
// Proposed: src/commands/build-dag.js
/**
 * Load all artifacts and build a DeclareDag instance.
 *
 * @param {string} cwd
 * @returns {{ dag: DeclareDag, declarations: Array, milestones: Array, actions: Array } | { error: string }}
 */
function buildDagFromDisk(cwd) {
  const planningDir = join(cwd, '.planning');
  if (!existsSync(planningDir)) {
    return { error: 'No Declare project found. Run /declare:init first.' };
  }

  // ... parse FUTURE.md, MILESTONES.md, load actions from folders
  // ... build DAG with nodes and edges
  // ... return { dag, declarations, milestones, actions }
}
```

This refactor reduces duplication and ensures all commands see the same graph.

### Anti-Patterns to Avoid

- **Formatting in the tool layer:** The `declare-tools.cjs` commands should return structured JSON data. The slash command `.md` files instruct Claude how to format the output for the user. Do not embed ASCII art in the JSON responses -- let Claude render it based on the structured data. Exception: the `formatted` field can contain pre-rendered text for the `--output` file write, but the primary response should be structured.
- **Ignoring many-to-many edges:** An action can serve multiple milestones, and a milestone can realize multiple declarations. Trace must show ALL paths, not just the first one found. Visualization must show nodes under all their parents.
- **Blocking on empty graph:** If the graph has no nodes, commands should return a helpful message ("No nodes in graph. Run /declare:init to get started."), not crash.
- **Deep recursion on large graphs:** The graph is 3-layer bounded, but use iterative BFS instead of recursion where possible for robustness. The trace function above uses recursion safely (max depth 3), but the subtree and reachability functions should use BFS.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Graph traversal | Custom adjacency iteration | DeclareDag.getUpstream() / getDownstream() | Already built and tested. O(1) lookups via dual adjacency lists. |
| Topological ordering | Custom sort | DeclareDag.topologicalSort() | Already implements Kahn's algorithm with cycle detection. |
| Argument parsing | Custom argv parser | Existing parseFlag() from parse-args.js | Already handles --flag value extraction. |
| Markdown table parsing | Custom table parser | Existing parseMarkdownTable() from milestones.js | Already handles permissive parsing with alignment tolerance. |
| Graph loading from disk | Inline parsing per command | Shared buildDagFromDisk() utility (new, but refactored from existing code) | Avoid 5x duplication of the same load pattern. |

**Key insight:** Phase 3 is a pure read layer on top of existing infrastructure. The graph engine, artifact parsers, and command patterns are all established. The new work is traversal algorithms (simple BFS/DFS on a 3-layer DAG) and text formatting.

## Common Pitfalls

### Pitfall 1: Many-to-Many Path Explosion in Trace

**What goes wrong:** When actions connect to multiple milestones that connect to multiple declarations, the number of paths can grow combinatorially.
**Why it happens:** A single action serving 3 milestones, each realizing 2 declarations = 6 paths. With 10 actions, this is manageable. With 50 actions and dense connectivity, output becomes overwhelming.
**How to avoid:** For typical graphs (5-20 declarations, 10-50 milestones, 20-100 actions), path count stays reasonable. Add a path limit (e.g., max 20 paths displayed) with a "and N more paths..." truncation message. The 3-layer constraint means max path length is always 3 hops.
**Warning signs:** Test only with single-path graphs. No test with many-to-many edges.

### Pitfall 2: Visualization Column Collision

**What goes wrong:** When rendering the tree, sibling nodes overlap or connector lines cross, making the output unreadable.
**Why it happens:** Naive indentation-based rendering doesn't account for varying node name lengths or deep nesting.
**How to avoid:** Use a simple indentation-based tree (like `tree` command output) rather than a full 2D box layout. The 3-layer constraint means max depth is 3 -- indentation works perfectly. Use fixed-width prefixes for connectors.
**Warning signs:** Layout code that tries to compute 2D coordinates. Keep it simple -- indentation + tree connectors.

### Pitfall 3: Blocked Status Detection Without Execution Phase

**What goes wrong:** The user wants `[!]` blocked markers, but Phase 3 has no execution system. "Blocked" is ambiguous without execution context.
**Why it happens:** In Phase 3, we only have structural status (PENDING/ACTIVE/DONE). A node is "blocked" if it depends on incomplete upstream work.
**How to avoid:** Define "blocked" structurally: a milestone is blocked if any of its actions are not DONE. An action is never structurally blocked (it's a leaf node). A declaration is blocked if any of its milestones are not DONE. This is purely status-based, not execution-based.
**Warning signs:** Trying to detect blocked state from execution queue or scheduling.

### Pitfall 4: Subtree Scoping with Shared Nodes

**What goes wrong:** When scoping visualization to D-01's subtree, a milestone that realizes both D-01 and D-02 should be included -- but its actions that ONLY serve milestones outside D-01 should NOT be.
**Why it happens:** Shared milestones create ambiguity about subtree boundaries.
**How to avoid:** Subtree scoping via downward traversal from the root automatically includes shared milestones (because they're downstream of the root). Their actions are also included. This is correct behavior -- showing the full dependency tree of the scoped declaration. If an action also serves milestones outside the scope, it still appears (because it's relevant to the scoped declaration's subtree).
**Warning signs:** Filtering logic that excludes shared nodes.

### Pitfall 5: Duplicated Graph Loading Logic

**What goes wrong:** Five commands (status, load-graph, trace, visualize, prioritize) each parse FUTURE.md + MILESTONES.md + folders independently. A bug fix in one is missed in others.
**Why it happens:** Copy-paste during Phase 1/2 when only two commands needed the graph.
**How to avoid:** Extract shared `buildDagFromDisk(cwd)` function before building Phase 3 commands. Refactor status.js and load-graph.js to use it too.
**Warning signs:** Grep for `parseFutureFile` appears in more than 3 files.

## Code Examples

### Why-Chain Output Format

```
// Example: trace A-01
// Returns structured paths for slash command to render as:

A-01: Build declaration parser [DONE]
├── M-01: CLI accepts declaration input [PENDING]
│   └── D-01: Users can declare futures [ACTIVE]
└── M-02: Declarations persist to disk [PENDING]
    └── D-01: Users can declare futures [ACTIVE]
```

The JSON output from declare-tools.cjs for the slash command to consume:

```json
{
  "nodeId": "A-01",
  "node": { "id": "A-01", "type": "action", "title": "Build declaration parser", "status": "DONE" },
  "paths": [
    [
      { "id": "A-01", "type": "action", "title": "Build declaration parser", "status": "DONE" },
      { "id": "M-01", "type": "milestone", "title": "CLI accepts declaration input", "status": "PENDING" },
      { "id": "D-01", "type": "declaration", "title": "Users can declare futures", "status": "ACTIVE" }
    ],
    [
      { "id": "A-01", "type": "action", "title": "Build declaration parser", "status": "DONE" },
      { "id": "M-02", "type": "milestone", "title": "Declarations persist to disk", "status": "PENDING" },
      { "id": "D-01", "type": "declaration", "title": "Users can declare futures", "status": "ACTIVE" }
    ]
  ],
  "pathCount": 2
}
```

### Priority Output Format

```json
{
  "ranking": [
    { "rank": 1, "id": "A-03", "title": "Wire milestone creation", "score": 4 },
    { "rank": 2, "id": "A-01", "title": "Build declaration parser", "score": 3 },
    { "rank": 3, "id": "A-02", "title": "Add validation rules", "score": 2 },
    { "rank": 4, "id": "A-04", "title": "Implement derivation prompt", "score": 2 },
    { "rank": 5, "id": "A-05", "title": "Build persistence layer", "score": 1 }
  ],
  "filter": null,
  "totalActions": 5
}
```

### Visualization Output Format

```json
{
  "scope": "full",
  "tree": [
    {
      "node": { "id": "D-01", "title": "Users can declare futures", "status": "ACTIVE" },
      "children": [
        {
          "node": { "id": "M-01", "title": "CLI accepts declaration input", "status": "PENDING" },
          "children": [
            { "node": { "id": "A-01", "title": "Build declaration parser", "status": "DONE" }, "children": [] },
            { "node": { "id": "A-02", "title": "Add validation rules", "status": "PENDING" }, "children": [] }
          ]
        }
      ]
    }
  ],
  "stats": { "declarations": 2, "milestones": 3, "actions": 5 }
}
```

### Interactive Picker for Trace (Claude's Discretion)

When `/declare:trace` is called without arguments, the slash command should list available nodes and ask the user to pick one. This is handled entirely in the `.md` slash command (not in declare-tools.cjs):

```markdown
# In trace.md slash command:
# If no $ARGUMENTS provided:
# 1. Run `node dist/declare-tools.cjs load-graph` to get all nodes
# 2. Present a numbered list of nodes grouped by type
# 3. Ask user to provide the node ID
# 4. Then run `node dist/declare-tools.cjs trace --node <selected-id>`
```

This keeps the picker logic in the meta-prompt layer (where Claude handles user interaction) and the data layer in declare-tools.cjs.

### --output Flag Implementation

```javascript
// Shared pattern for all three commands:
const outputPath = parseFlag(args, 'output');
if (outputPath) {
  const resolvedPath = path.resolve(cwd, outputPath);
  fs.writeFileSync(resolvedPath, formattedOutput, 'utf-8');
  result.outputFile = resolvedPath;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate graph loading per command | Shared buildDagFromDisk() | Phase 3 (now) | Eliminates duplication, single source of truth for graph construction |
| No traversal queries | getUpstream/getDownstream | Phase 1 | Already built, Phase 3 composes these into higher-level operations |
| No visualization | ASCII tree with Unicode connectors | Phase 3 (now) | First user-facing view of the full graph structure |

**Deprecated/outdated:**
- None. Phase 3 builds on a fresh Phase 1/2 foundation with no legacy concerns.

## Open Questions

1. **Color in terminal output**
   - What we know: The slash command `.md` instructs Claude how to present output. Claude can use markdown formatting (bold, code blocks) but not ANSI colors directly.
   - What's unclear: Whether the `--output` file write should include ANSI escapes or plain text.
   - Recommendation: **No ANSI colors.** Output plain text/Unicode only. The `--output` file should be shareable (readable in any text editor). Claude can add its own formatting when presenting to the user via the slash command. This avoids the chalk/ANSI dependency entirely.

2. **Visualization of very large graphs**
   - What we know: Typical graphs are 5-20 declarations, 10-50 milestones, 20-100 actions. Tree output with indentation handles this fine.
   - What's unclear: At what point does the tree become too long to be useful?
   - Recommendation: Default full graph view. If graph exceeds 50 nodes, add a summary header ("Showing N declarations, N milestones, N actions") and suggest using subtree scoping. No truncation by default.

3. **Blocked status detection edge cases**
   - What we know: User wants `[!]` blocked marker. We define "blocked" as a node whose children are not all DONE.
   - What's unclear: Should ACTIVE children count as "in progress" (different from blocked)? Should we have both `[!]` blocked and `[>]` in-progress?
   - Recommendation: Keep it simple per user's spec. Three markers: `[done]` DONE, `[pending]` PENDING, `[!]` blocked (has incomplete dependencies). ACTIVE nodes that have no incomplete dependencies show as `[>]` to differentiate from PENDING. This gives four visual states without overcomplicating.

## Sources

### Primary (HIGH confidence)
- `/Users/guilherme/Projects/get-shit-done/src/graph/engine.js` -- DeclareDag class with getUpstream, getDownstream, topologicalSort, validate
- `/Users/guilherme/Projects/get-shit-done/src/commands/load-graph.js` -- Existing graph loading pattern from FUTURE.md + MILESTONES.md + PLAN.md files
- `/Users/guilherme/Projects/get-shit-done/src/commands/status.js` -- Existing command structure, graph loading duplication
- `/Users/guilherme/Projects/get-shit-done/src/declare-tools.js` -- CLI entry point, subcommand dispatch pattern
- `/Users/guilherme/Projects/get-shit-done/src/commands/parse-args.js` -- Existing parseFlag utility
- `/Users/guilherme/Projects/get-shit-done/.claude/commands/declare/status.md` -- Existing slash command pattern (meta-prompt + tool invocation)
- `/Users/guilherme/Projects/get-shit-done/.planning/phases/03-traceability-navigation/03-CONTEXT.md` -- User decisions for this phase

### Secondary (MEDIUM confidence)
- Phase 1 Research (`01-RESEARCH.md`) -- Architecture patterns, slash command structure, anti-patterns
- Graph theory (BFS/DFS, topological sort, reachability) -- standard CS, well-understood algorithms

### Tertiary (LOW confidence)
- None. All findings derived from codebase analysis and standard algorithms.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all existing infrastructure
- Architecture: HIGH -- algorithms are standard graph traversal (BFS, DFS, reachability), well-bounded by 3-layer constraint
- Pitfalls: HIGH -- derived from actual codebase analysis (identified graph loading duplication, many-to-many edge handling)
- Command patterns: HIGH -- following established patterns from 5 existing commands

**Research date:** 2026-02-16
**Valid until:** 2026-03-16 (stable domain, internal codebase, no external dependency changes)
