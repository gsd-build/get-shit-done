<purpose>
Create an isolated workspace directory with git repo copies (worktrees or clones) and an independent `.planning/` directory. Supports multi-repo orchestration and single-repo feature branch isolation.
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context before starting.
</required_reading>

<process>

## 1. Setup

**MANDATORY FIRST STEP — Execute init command:**

```bash
INIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init new-workspace)
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Parse JSON for: `default_workspace_base`, `child_repos`, `child_repo_count`, `worktree_available`, `is_git_repo`, `cwd_repo_name`, `project_root`.

## 2. Parse Arguments

Extract from $ARGUMENTS:
- `--name` → `WORKSPACE_NAME` (required)
- `--repos` → `REPO_LIST` (comma-separated paths or names)
- `--path` → `TARGET_PATH` (defaults to `$default_workspace_base/$WORKSPACE_NAME`)
- `--strategy` → `STRATEGY` (defaults to `worktree`)
- `--branch` → `BRANCH_NAME` (defaults to `workspace/$WORKSPACE_NAME`)
- `--auto` → skip interactive questions

**If `--name` is missing and not `--auto`:**


**Text mode (`workflow.text_mode: true` in config or `--text` flag):** Set `TEXT_MODE=true` if `--text` is present in `$ARGUMENTS` OR `text_mode` from init JSON is `true`. When TEXT_MODE is active, replace every `AskUserQuestion` call with a plain-text numbered list and ask the user to type their choice number. This is required for non-Claude runtimes (OpenAI Codex, Gemini CLI, etc.) where `AskUserQuestion` is not available.
Use AskUserQuestion:
- header: "Workspace Name"
- question: "What should this workspace be called?"
- requireAnswer: true

## 3. Select Repos

**If `--repos` is provided:** Parse comma-separated values. For each value:
- If it's an absolute path, use it directly
- If it's a relative path or name, resolve against `$project_root`
- Special case: `.` means current repo (use `$project_root`, name it `$cwd_repo_name`)

**If `--repos` is NOT provided and not `--auto`:**

**If `child_repo_count` > 0:**

Present child repos for selection:

Use AskUserQuestion:
- header: "Select Repos"
- question: "Which repos should be included in the workspace?"
- options: List each child repo from `child_repos` array by name
- multiSelect: true

**If `child_repo_count` is 0 and `is_git_repo` is true:**

Use AskUserQuestion:
- header: "Current Repo"
- question: "No child repos found. Create a workspace with the current repo?"
- options:
  - "Yes — create workspace with current repo" → use current repo
  - "Cancel" → exit

**If `child_repo_count` is 0 and `is_git_repo` is false:**

Error:
```
No git repos found in the current directory and this is not a git repo.

Run this command from a directory containing git repos, or specify repos explicitly:
  /gsd-new-workspace --name my-workspace --repos /path/to/repo1,/path/to/repo2
```
Exit.

**If `--auto` and `--repos` is NOT provided:**

Error:
```
Error: --auto requires --repos to specify which repos to include.

Usage:
  /gsd-new-workspace --name my-workspace --repos repo1,repo2 --auto
```
Exit.

## 4. Select Strategy

**If `--strategy` is provided:** Use it (validate: must be `worktree` or `clone`).

**If `--strategy` is NOT provided and not `--auto`:**

Use AskUserQuestion:
- header: "Strategy"
- question: "How should repos be copied into the workspace?"
- options:
  - "Worktree (recommended) — lightweight, shares .git objects with source repo" → `worktree`
  - "Clone — fully independent copy, no connection to source repo" → `clone`

**If `--auto`:** Default to `worktree`.

## 5. Validate

Before creating anything, validate:

1. **Target path** — must not exist or must be empty:
```bash
if [ -d "$TARGET_PATH" ] && [ "$(ls -A "$TARGET_PATH" 2>/dev/null)" ]; then
  echo "Error: Target path already exists and is not empty: $TARGET_PATH"
  echo "Choose a different --name or --path."
  exit 1
fi
```

2. **Source repos exist and are git repos** — for each repo path:
```bash
if [ ! -d "$REPO_PATH/.git" ]; then
  echo "Error: Not a git repo: $REPO_PATH"
  exit 1
fi
```

3. **Worktree availability** — if strategy is `worktree` and `worktree_available` is false:
```
Error: git is not available. Install git or use --strategy clone.
```

Report all validation errors at once, not one at a time.

## 6. Create Workspace

```bash
mkdir -p "$TARGET_PATH"
```

### For each repo:

**Worktree strategy:**
```bash
cd "$SOURCE_REPO_PATH"
git worktree add "$TARGET_PATH/$REPO_NAME" -b "$BRANCH_NAME" 2>&1
```

If `git worktree add` fails because the branch already exists, try with a timestamped branch:
```bash
TIMESTAMP=$(date +%Y%m%d%H%M%S)
git worktree add "$TARGET_PATH/$REPO_NAME" -b "${BRANCH_NAME}-${TIMESTAMP}" 2>&1
```

If that also fails, report the error and continue with remaining repos.

**Clone strategy:**
```bash
git clone "$SOURCE_REPO_PATH" "$TARGET_PATH/$REPO_NAME" 2>&1
cd "$TARGET_PATH/$REPO_NAME"
git checkout -b "$BRANCH_NAME" 2>&1
```

Track results: which repos succeeded, which failed, what branch was used.

## 7. Write WORKSPACE.md

Write the workspace manifest at `$TARGET_PATH/WORKSPACE.md`:

```markdown
# Workspace: $WORKSPACE_NAME

Created: $DATE
Strategy: $STRATEGY

## Member Repos

| Repo | Source | Branch | Strategy |
|------|--------|--------|----------|
| $REPO_NAME | $SOURCE_PATH | $BRANCH | $STRATEGY |
...for each repo...

## Notes

[Add context about what this workspace is for]
```

## 8. Initialize .planning/

```bash
mkdir -p "$TARGET_PATH/.planning"
```

## 9. Report and Next Steps

**If all repos succeeded:**

```
Workspace created: $TARGET_PATH

  Repos: $REPO_COUNT
  Strategy: $STRATEGY
  Branch: $BRANCH_NAME

Next steps:
  cd "$TARGET_PATH"
  /gsd-new-project    # Initialize GSD in the workspace
```

**If some repos failed:**

```
Workspace created with $SUCCESS_COUNT of $TOTAL_COUNT repos: $TARGET_PATH

  Succeeded: repo1, repo2
  Failed: repo3 (branch already exists), repo4 (not a git repo)

Next steps:
  cd "$TARGET_PATH"
  /gsd-new-project    # Initialize GSD in the workspace
```

**Offer to initialize GSD (if not `--auto`):**

Use AskUserQuestion:
- header: "Initialize GSD"
- question: "Would you like to initialize a GSD project in the new workspace?"
- options:
  - "Yes — run /gsd-new-project" → tell user to `cd "$TARGET_PATH"` first, then run `/gsd-new-project`
  - "No — I'll set it up later" → done

</process>

<success_criteria>
- [ ] Workspace directory created at target path
- [ ] All specified repos copied (worktree or clone) into workspace
- [ ] WORKSPACE.md manifest written with correct repo table
- [ ] `.planning/` directory initialized at workspace root
- [ ] User informed of workspace path and next steps
</success_criteria>
