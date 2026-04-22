---
name: gsd:intel
description: "Query, inspect, or refresh codebase intelligence files in .planning/intel/"
argument-hint: "[query <term>|status|diff|refresh]"
allowed-tools:
  - Read
  - Bash
  - Task
---

**STOP -- DO NOT READ THIS FILE. You are already reading it. This prompt was injected into your context by Claude Code's command system. Using the Read tool on this file wastes tokens. Begin executing Step 0 immediately.**

## Step 0 -- Banner

**Before ANY tool calls**, display this banner:

```
GSD > INTEL
```

Then proceed to Step 1.

## Step 1 -- Config Gate

Check if intel is enabled by reading `.planning/config.json` directly using the Read tool.

**DO NOT use the gsd-tools config get-value command** -- it hard-exits on missing keys.

1. Read `.planning/config.json` using the Read tool
2. If the file does not exist: display the disabled message below and **STOP**
3. Parse the JSON content. Check if `config.intel && config.intel.enabled === true`
4. If `intel.enabled` is NOT explicitly `true`: display the disabled message below and **STOP**
5. If `intel.enabled` is `true`: proceed to Step 2

**Disabled message:**

```
GSD > INTEL

Intel system is disabled. To activate:

  gsd-sdk query config-set intel.enabled true

Then run /gsd:intel refresh to build the initial index.
```

---

## Step 2 -- Parse Argument

Parse `$ARGUMENTS` to determine the operation mode:

| Argument | Action |
|----------|--------|
| `query <term>` | Run inline query (Step 2a) |
| `status` | Run inline status check (Step 2b) |
| `diff` | Run inline diff check (Step 2c) |
| `refresh` | Spawn intel-updater agent (Step 3) |
| No argument or unknown | Show usage message |

**Usage message** (shown when no argument or unrecognized argument):

```
GSD > INTEL

Usage: /gsd:intel <mode>

Modes:
  query <term>  Search intel files for a term
  status        Show intel file freshness and staleness
  diff          Show changes since last snapshot
  refresh       Rebuild all intel files from codebase analysis
```

### Step 2a -- Query

Run:

```bash
gsd-sdk query intel.query <term>
```

Parse the JSON output and display results:
- If the output contains `"disabled": true`, display the disabled message from Step 1 and **STOP**
- If no matches found, display: `No intel matches for '<term>'. Try /gsd:intel refresh to build the index.`
- Otherwise, display matching entries grouped by intel file

**STOP** after displaying results. Do not spawn an agent.

### Step 2b -- Status

Run:

```bash
gsd-sdk query intel.status
```

Parse the JSON output and display each intel file with:
- File name
- Last `updated_at` timestamp
- STALE or FRESH status (stale if older than 24 hours or missing)

**STOP** after displaying status. Do not spawn an agent.

### Step 2c -- Diff

Run:

```bash
gsd-sdk query intel.diff
```

Parse the JSON output and display:
- Added entries since last snapshot
- Removed entries since last snapshot
- Changed entries since last snapshot

If no snapshot exists, suggest running `refresh` first.

**STOP** after displaying diff. Do not spawn an agent.

---

## Step 3 -- Refresh (Agent Spawn)

Display before spawning:

```
GSD > Spawning intel-updater agent to analyze codebase...
```

Spawn a Task:

```
Task(
  description="Refresh codebase intelligence files",
  prompt="You are the gsd-intel-updater agent. Your job is to analyze this codebase and write/update intelligence files in .planning/intel/.

Project root: ${CWD}
Prefer: gsd-sdk query <subcommand> (installed gsd-sdk on PATH). Legacy: node $HOME/.claude/get-shit-done/bin/gsd-tools.cjs

Instructions:
1. Analyze the codebase structure, dependencies, APIs, and architecture
2. Write JSON intel files to .planning/intel/ (stack.json, api-map.json, dependency-graph.json, file-roles.json, arch-decisions.json)
3. Each file must have a _meta object with updated_at timestamp
4. Use `gsd-sdk query intel.extract-exports <file>` to analyze source files
5. Use `gsd-sdk query intel.patch-meta <file>` to update timestamps after writing
6. Use `gsd-sdk query intel.validate` to check your output

When complete, output: ## INTEL UPDATE COMPLETE
If something fails, output: ## INTEL UPDATE FAILED with details."
)
```

Wait for the agent to complete.

---

## Step 4 -- Post-Refresh Summary

After the agent completes, run:

```bash
gsd-sdk query intel.status
```

Display a summary showing:
- Which intel files were written or updated
- Last update timestamps
- Overall health of the intel index

---

## Anti-Patterns

1. DO NOT spawn an agent for query/status/diff operations -- these are inline CLI calls
2. DO NOT modify intel files directly -- the agent handles writes during refresh
3. DO NOT skip the config gate check
4. DO NOT use the gsd-tools config get-value CLI for the config gate -- it exits on missing keys
