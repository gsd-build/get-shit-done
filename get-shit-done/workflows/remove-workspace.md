<purpose>
Remove a GSD workspace, cleaning up git worktrees and deleting the workspace directory.
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context before starting.
</required_reading>

<process>

## 1. Setup

Extract workspace name from $ARGUMENTS.

```bash
INIT=$(gsd-sdk query init.remove-workspace "$WORKSPACE_NAME")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Parse JSON for: `workspace_name`, `workspace_path`, `has_manifest`, `strategy`, `repos`, `repo_count`, `dirty_repos`, `has_dirty_repos`.

**If no workspace name provided:**

First run `/gsd-list-workspaces` to show available workspaces, then ask:


**Text mode (`workflow.text_mode: true` in config or `--text` flag):** Set `TEXT_MODE=true` if `--text` is present in `$ARGUMENTS` OR `text_mode` from init JSON is `true`. When TEXT_MODE is active, replace every `AskUserQuestion` call with a plain-text numbered list and ask the user to type their choice number. This is required for non-Claude runtimes (OpenAI Codex, Gemini CLI, etc.) where `AskUserQuestion` is not available.
Use AskUserQuestion:
- header: "Remove Workspace"
- question: "Which workspace do you want to remove?"
- requireAnswer: true

Re-run init with the provided name.

## 2. Safety Checks

**If `has_dirty_repos` is true:**

```
Cannot remove workspace "$WORKSPACE_NAME" — the following repos have uncommitted changes:

  - repo1
  - repo2

Commit or stash changes in these repos before removing the workspace:
  cd "$WORKSPACE_PATH/repo1"
  git stash   # or git commit
```

Exit. Do NOT proceed.

## 3. Confirm Removal

Use AskUserQuestion:
- header: "Confirm Removal"
- question: "Remove workspace '$WORKSPACE_NAME' at $WORKSPACE_PATH? This will delete all files in the workspace directory. Type the workspace name to confirm:"
- requireAnswer: true

**If answer does not match `$WORKSPACE_NAME`:** Exit with "Removal cancelled."

## 4. Clean Up Worktrees

**If strategy is `worktree`:**

For each repo in the workspace:

```bash
cd "$SOURCE_REPO_PATH"
git worktree remove "$WORKSPACE_PATH/$REPO_NAME" 2>&1 || true
```

If `git worktree remove` fails, warn but continue:
```
Warning: Could not remove worktree for $REPO_NAME — source repo may have been moved or deleted.
```

## 5. Delete Workspace Directory

```bash
rm -rf "$WORKSPACE_PATH"
```

## 6. Report

```
Workspace "$WORKSPACE_NAME" removed.

  Path: $WORKSPACE_PATH (deleted)
  Repos: $REPO_COUNT worktrees cleaned up
```

</process>
