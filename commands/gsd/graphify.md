---
name: gsd:graphify
description: "Build, query, and inspect the project knowledge graph in .planning/graphs/"
argument-hint: "[build|query <term>|status|diff]"
allowed-tools:
  - Read
  - Bash
requires: [config, fast, phase, update]
---

**STOP -- DO NOT READ THIS FILE. You are already reading it. This prompt was injected into your context by Claude Code's command system. Using the Read tool on this file wastes tokens. Begin executing Step 0 immediately.**

**CJS-only (graphify):** `graphify` subcommands are not registered on `gsd-sdk query`. Use `node $HOME/.claude/get-shit-done/bin/gsd-tools.cjs graphify …` as documented in this command and in `docs/CLI-TOOLS.md`. Other tooling may still use `gsd-sdk query` where a handler exists.

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

Then run /gsd:graphify build to create the initial graph.
```

---

## Step 2 -- Parse Argument

Parse `$ARGUMENTS` to determine the operation mode:

| Argument | Action |
|----------|--------|
| `build` | Run inline build (Step 3) |
| `query <term>` | Run inline query (Step 2a) |
| `status` | Run inline status check (Step 2b) |
| `diff` | Run inline diff check (Step 2c) |
| No argument or unknown | Show usage message |

**Usage message** (shown when no argument or unrecognized argument):

```
GSD > GRAPHIFY

Usage: /gsd:graphify <mode>

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
- If no nodes found, display: `No graph matches for '<term>'. Try /gsd:graphify build to create or rebuild the graph.`
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
- If `built_at_commit` is non-null, also display a `Source commit:` line:
  - `commit_stale === false` (rebuilt at HEAD): `Source commit: <built_at_commit> (current)`
  - `commit_stale === true` (graph behind HEAD): `Source commit: <built_at_commit> (<commits_behind> commits behind HEAD)`
  - `commit_stale === null` (unreachable commit / no git): `Source commit: <built_at_commit> (freshness unknown)`
- If `built_at_commit` is null (pre-graphify-v0.7 graph), omit the source-commit line entirely — do not render "Source commit: unknown"

The mtime-based STALE/FRESH flag and the commit-based `commit_stale` measure
different things and can disagree (e.g., a CI-built graph rebuilt minutes ago
against an old checkout reads as FRESH on mtime but `commit_stale: true`).
Surface both so the agent can choose.

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

## Step 3 -- Build (Inline)

Run the pre-flight check first:

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" graphify build
```

Parse the JSON output:
- If `disabled: true`: display the disabled message from Step 1 and **STOP**
- If `error`: display the error message and **STOP**
- If `action: "spawn_agent"`: pre-flight passed -- proceed with the inline build below

(The `spawn_agent` action name is historical. The skill now performs the build inline because graphify v0.7+ split the build into a fast AST-extraction phase and a separate clustering + report-write phase. Sub-agent isolation kept the cached extraction phase alive but SIGTERM'd the post-extraction phase when the agent exited, leaving the cache populated but no `graph.json` artifacts written. The CLI still emits the `spawn_agent` signal so external callers and tests keep working.)

Display:

```text
GSD > Building knowledge graph...
```

Run the build, copy artifacts, write the diff snapshot, and report the summary in a single foreground Bash call so the whole pipeline survives to completion. Use a `timeout` of `600000` ms (10 minutes), which covers the `graphify.build_timeout` ceiling (default 300 s) with margin:

```bash
graphify update . \
  && cp graphify-out/graph.json .planning/graphs/graph.json \
  && cp graphify-out/graph.html .planning/graphs/graph.html \
  && cp graphify-out/GRAPH_REPORT.md .planning/graphs/GRAPH_REPORT.md \
  && node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" graphify build snapshot \
  && node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" graphify status
```

Do NOT pass `run_in_background: true`. Typical builds complete in 15-60 seconds and the entire chain must run foreground.

If the chain fails (non-zero exit):
- Display: `## GRAPHIFY BUILD FAILED` followed by the captured stderr
- Do NOT delete `.planning/graphs/` -- the prior valid graph remains available
- **STOP**

If the chain succeeds:
- Parse the trailing `graphify status` JSON
- Display: `## GRAPHIFY BUILD COMPLETE` with the node, edge, and hyperedge counts

---

## MVP-Mode Node Rendering

**MVP-mode rendering.** When a phase has `**Mode:** mvp` in ROADMAP.md (resolved via `gsd-sdk query roadmap.get-phase --pick mode`), render its graph node with two distinct visual signals:

1. **Distinct fill color.** Use `#22c55e` (green) for MVP-mode phase nodes. Standard phases keep the default fill color. Two-channel signaling (color + label) handles color-blind and grayscale renders.
2. **`MVP` label suffix.** Append ` (MVP)` to the node's label text. Example: a phase originally labeled `Phase 1: User Auth` renders as `Phase 1: User Auth (MVP)`.

Both signals fire together — never just one. Per PRD Q5 decision, the goal is unambiguous visual distinction in any render context.

When the phase mode is null/absent, render with the standard color and label — no behavioral change for non-MVP phases.

---

## Anti-Patterns

1. DO NOT spawn an agent for any operation -- build, query, status, and diff all run inline. Sub-agent isolation terminates background bash when the agent exits, which previously truncated graphify builds mid-write and left only the cache populated (#3166).
2. DO NOT pass `run_in_background: true` for the build chain -- the operation is fast and must complete in the foreground.
3. DO NOT modify graph files directly -- always go through `graphify update .` and the snapshot CLI.
4. DO NOT skip the config gate check.
5. DO NOT use `gsd-tools config get-value` for the config gate -- it exits on missing keys.
