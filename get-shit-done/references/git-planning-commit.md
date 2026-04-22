# Git Planning Commit

Commit planning artifacts via `gsd-sdk query commit`, which checks `commit_docs` config and gitignore status (same behavior as legacy `gsd-tools.cjs commit`).

## Commit via CLI

Pass the message first, then file paths (positional). Do not use `--files` for `commit` (that flag is only for `commit-to-subrepo`).

Always use this for `.planning/` files — it handles `commit_docs` and gitignore checks automatically:

```bash
gsd-sdk query commit "docs({scope}): {description}" .planning/STATE.md .planning/ROADMAP.md
```

The CLI will return `skipped` (with reason) if `commit_docs` is `false` or `.planning/` is gitignored. No manual conditional checks needed.

## Amend previous commit

To fold `.planning/` file changes into the previous commit:

```bash
gsd-sdk query commit "" .planning/codebase/*.md --amend
```

## Commit Message Patterns

| Command | Scope | Example |
|---------|-------|---------|
| plan-phase | phase | `docs(phase-03): create authentication plans` |
| execute-phase | phase | `docs(phase-03): complete authentication phase` |
| new-milestone | milestone | `docs: start milestone v1.1` |
| remove-phase | chore | `chore: remove phase 17 (dashboard)` |
| insert-phase | phase | `docs: insert phase 16.1 (critical fix)` |
| add-phase | phase | `docs: add phase 07 (settings page)` |

## When to Skip

- `commit_docs: false` in config
- `.planning/` is gitignored
- No changes to commit (check with `git status --porcelain .planning/`)
