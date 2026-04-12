---
name: gsd:graphify
description: "Build, query, and inspect the project knowledge graph in .planning/graphs/"
argument-hint: "[build|query <term>|status|diff]"
allowed-tools:
  - Read
  - Bash
  - Task
---

**STOP -- DO NOT READ THIS FILE. You are already reading it. This prompt was injected into your context by Claude Code's command system. Using the Read tool on this file wastes tokens. Begin executing Step 0 immediately.**

## Step 0 -- Banner

**Before ANY tool calls**, display this banner:

```
GSD > GRAPHIFY
```

Then proceed to Step 1.

## Step 1 -- Config Gate

Check if graphify is enabled by reading `.planning/config.json` directly using the Read tool.

**DO NOT use the gsd-tools config get-value command** -- it hard-exits on missing keys.

1. Read `.planning/config.json` using the Read tool
2. If the file does not exist: display the disabled message below and **STOP**
3. Parse the JSON content. Check if `config.graphify && config.graphify.enabled === true`
4. If `graphify.enabled` is NOT explicitly `true`: display the disabled message below and **STOP**
5. If `graphify.enabled` is `true`: proceed to Step 2

**Disabled message:**

```
GSD > GRAPHIFY

Knowledge graph is disabled. To activate:

  node $HOME/.claude/get-shit-done/bin/gsd-tools.cjs config-set graphify.enabled true

Then run /gsd-graphify build to create the initial graph.
```

---

## Step 2 -- Parse Argument

Parse `$ARGUMENTS` to determine the operation mode:

| Argument | Action |
|----------|--------|
| `build` | Spawn graphify-builder agent (Step 3) |
| `query <term>` | Run inline query (Step 2a) |
| `status` | Run inline status check (Step 2b) |
| `diff` | Run inline diff check (Step 2c) |
| No argument or unknown | Show usage message |

**Usage message** (shown when no argument or unrecognized argument):

```
GSD > GRAPHIFY

Usage: /gsd-graphify <mode>

Modes:
  build           Build or rebuild the knowledge graph
  query <term>    Search the graph for a term
  status          Show graph freshness and statistics
  diff            Show changes since last build
```

### Step 2a -- Query

Run:

```bash
node $HOME/.claude/get-shit-done/bin/gsd-tools.cjs graphify query <term>
```

Parse the JSON output and display results:
- If the output contains `"disabled": true`, display the disabled message from Step 1 and **STOP**
- If the output contains `"error"` field, display the error message and **STOP**
- If no nodes found, display: `No graph matches for '<term>'. Try /gsd-graphify build to create or rebuild the graph.`
- Otherwise, display matched nodes grouped by type, with edge relationships and confidence tiers (EXTRACTED/INFERRED/AMBIGUOUS)

**STOP** after displaying results. Do not spawn an agent.

### Step 2b -- Status

Run:

```bash
node $HOME/.claude/get-shit-done/bin/gsd-tools.cjs graphify status
```

Parse the JSON output and display:
- If `exists: false`, display the message field
- Otherwise show last build time, node/edge/hyperedge counts, and STALE or FRESH indicator

**STOP** after displaying status. Do not spawn an agent.

### Step 2c -- Diff

Run:

```bash
node $HOME/.claude/get-shit-done/bin/gsd-tools.cjs graphify diff
```

Parse the JSON output and display:
- If `no_baseline: true`, display the message field
- Otherwise show node and edge change counts (added/removed/changed)

If no snapshot exists, suggest running `build` twice (first to create, second to generate a diff baseline).

**STOP** after displaying diff. Do not spawn an agent.

---

## Step 3 -- Build (Agent Spawn)

Run pre-flight check first:

```
PREFLIGHT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" graphify build)
```

If pre-flight returns `disabled: true` or `error`, display the message and **STOP**.

If pre-flight returns `action: "spawn_agent"`, display:

```
GSD > Spawning graphify-builder agent...
```

Spawn a Task:

```
Task(
  description="Build or rebuild the project knowledge graph",
  prompt="You are the graphify-builder agent. Your job is to build or rebuild the project knowledge graph using the graphify CLI.

Project root: ${CWD}
gsd-tools path: $HOME/.claude/get-shit-done/bin/gsd-tools.cjs

## Instructions

1. **Invoke graphify:**
   Run from the project root:
   ```
   graphify . --update
   ```
   This builds the knowledge graph with SHA256 incremental caching.
   Timeout: up to 5 minutes (or as configured via graphify.build_timeout).

2. **Validate output:**
   Check that graphify-out/graph.json exists and is valid JSON with nodes[] and edges[] arrays.
   If graphify exited non-zero or graph.json is not parseable, output:
   ## GRAPHIFY BUILD FAILED
   Include the stderr output for debugging. Do NOT delete .planning/graphs/ -- prior valid graph remains available.

3. **Copy artifacts to .planning/graphs/:**
   ```
   cp graphify-out/graph.json .planning/graphs/graph.json
   cp graphify-out/graph.html .planning/graphs/graph.html
   cp graphify-out/GRAPH_REPORT.md .planning/graphs/GRAPH_REPORT.md
   ```
   These three files are the build output consumed by query, status, and diff commands.

4. **Write diff snapshot:**
   ```
   node \"$HOME/.claude/get-shit-done/bin/gsd-tools.cjs\" graphify build snapshot
   ```
   This creates .planning/graphs/.last-build-snapshot.json for future diff comparisons.

5. **Report build summary:**
   ```
   node \"$HOME/.claude/get-shit-done/bin/gsd-tools.cjs\" graphify status
   ```
   Display the node count, edge count, and hyperedge count from the status output.

When complete, output: ## GRAPHIFY BUILD COMPLETE with the summary counts.
If something fails at any step, output: ## GRAPHIFY BUILD FAILED with details."
)
```

Wait for the agent to complete.

---

## Anti-Patterns

1. DO NOT spawn an agent for query/status/diff operations -- these are inline CLI calls
2. DO NOT modify graph files directly -- the build agent handles writes
3. DO NOT skip the config gate check
4. DO NOT use gsd-tools config get-value for the config gate -- it exits on missing keys
