<purpose>
List all GSD workspaces found in ~/gsd-workspaces/ with their status.
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context before starting.
</required_reading>

<process>

## 1. Setup

```bash
# SDK resolution: prefer global gsd-sdk, fall back to local gsd-tools.cjs (#3668)
GSD_TOOLS="${RUNTIME_DIR:-$(dirname "${CLAUDE_FILE_PATHS%%:*}" 2>/dev/null)}/get-shit-done/bin/gsd-tools.cjs"
if command -v gsd-sdk >/dev/null 2>&1; then
  GSD_SDK="gsd-sdk"
elif [ -f "$GSD_TOOLS" ]; then
  GSD_SDK="node "$GSD_TOOLS""
else
  echo "ERROR: gsd-sdk not found on PATH and $GSD_TOOLS does not exist." >&2
  echo "Run: npx get-shit-done-cc@latest --claude --local" >&2
  exit 1
fi
INIT=$(gsd-sdk query init.list-workspaces)
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Parse JSON for: `workspace_base`, `workspaces`, `workspace_count`.

## 2. Display

**If `workspace_count` is 0:**

```
No workspaces found in ~/gsd-workspaces/

Create one with:
  /gsd:workspace --new --name my-workspace --repos repo1,repo2
```

Done.

**If workspaces exist:**

Display a table:

```
GSD Workspaces (~/gsd-workspaces/)

| Name | Repos | Strategy | GSD Project |
|------|-------|----------|-------------|
| feature-a | 3 | worktree | Yes |
| feature-b | 2 | clone | No |

Manage:
  cd ~/gsd-workspaces/<name>     # Enter a workspace
  /gsd-remove-workspace <name>   # Remove a workspace
```

For each workspace, show:
- **Name** — directory name
- **Repos** — count from init data
- **Strategy** — from WORKSPACE.md
- **GSD Project** — whether `.planning/PROJECT.md` exists (Yes/No)

</process>
