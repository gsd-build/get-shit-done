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

## Why This Matters

Without `--ws`, gsd-tools resolves to `.planning/` (flat mode). With `--ws foo`, it resolves to `.planning/workstreams/foo/`. The init JSON returns the correct paths either way — workflows just need to use them.
