# Workstream Flag Passthrough

When workflows invoke `gsd-tools.cjs`, they MUST pass `--ws` if the user specified a workstream. This ensures all path resolution uses the correct workstream directory.

## Pattern: Extract and Pass WS Flag

At the start of every workflow, extract `--ws` from `$ARGUMENTS`:

```bash
# Extract --ws flag from arguments
WS_NAME=""
GSD_WS=""
if echo "$ARGUMENTS" | grep -qE '\-\-ws[= ]'; then
  WS_NAME=$(echo "$ARGUMENTS" | grep -oE '\-\-ws[= ][^ ]+' | sed 's/--ws[= ]//')
  GSD_WS="--ws $WS_NAME"
fi
```

Then append `${GSD_WS}` to ALL `gsd-tools.cjs` invocations:

```bash
INIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init execute-phase "${PHASE}" ${GSD_WS})
```

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "message" --files ${state_path} ${roadmap_path} ${GSD_WS}
```

## Pattern: Use Paths from Init JSON

Init commands return workstream-aware paths. Use them instead of hardcoded `.planning/`:

```bash
# Extract paths from init JSON
STATE_PATH=$(echo "$INIT" | jq -r '.state_path')
ROADMAP_PATH=$(echo "$INIT" | jq -r '.roadmap_path')
CONFIG_PATH=$(echo "$INIT" | jq -r '.config_path')
PHASE_DIR=$(echo "$INIT" | jq -r '.phase_dir')
```

**In `<files_to_read>` blocks for subagents:**
```
- ${state_path} (State)
- ${config_path} (Config, if exists)
```

**In commit commands:**
```bash
node ... commit "message" --files ${state_path} ${roadmap_path} ${GSD_WS}
```

**In shell commands:**
```bash
ls ${PHASE_DIR}/*-PLAN.md
```

## Concurrent Instances: GSD_WORKSTREAM Environment Variable

When running multiple Claude Code instances on the same codebase, the `active-workstream` file (`.planning/active-workstream`) is a **shared singleton** — the last writer wins. This causes race conditions when two instances auto-detect the active workstream.

**Resolution priority:**
1. `--ws` flag (explicit, always wins)
2. `GSD_WORKSTREAM` environment variable (per-terminal, safe for concurrency)
3. `active-workstream` file (shared, last-writer-wins)
4. `null` (flat mode)

**Usage:** Set the env var before launching Claude Code in each terminal:

```bash
# Terminal 1
export GSD_WORKSTREAM=feature-auth
claude

# Terminal 2
export GSD_WORKSTREAM=feature-dashboard
claude
```

Each instance will automatically route all GSD commands to its own workstream without needing `--ws` on every command. The `--ws` flag still overrides the env var if needed.

## Why This Matters

Without `--ws` or `GSD_WORKSTREAM`, gsd-tools resolves to `.planning/` (flat mode). With `--ws foo` or `GSD_WORKSTREAM=foo`, it resolves to `.planning/workstreams/foo/`. The init JSON returns the correct paths either way — workflows just need to use them.
