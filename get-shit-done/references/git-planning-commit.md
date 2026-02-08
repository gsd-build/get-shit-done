# Git Planning Commit

Check whether to commit planning artifacts, then commit if enabled.

## Check Configuration

```bash
# Check config.json first
COMMIT_PLANNING_DOCS=$(cat .planning/config.json 2>/dev/null | grep -o '"commit_docs"[[:space:]]*:[[:space:]]*[^,}]*' | grep -o 'true\|false' || echo "true")

# Auto-detect gitignored (overrides config)
git check-ignore -q .planning 2>/dev/null && COMMIT_PLANNING_DOCS=false
```

Default: `true` if not set or config missing.

## Conditional Commit

Only run git operations if `COMMIT_PLANNING_DOCS=true`:

```bash
if [ "$COMMIT_PLANNING_DOCS" = "true" ]; then
  git add .planning/STATE.md .planning/ROADMAP.md
  git commit -m "$(cat <<'EOF'
docs({scope}): {description}

{optional body}

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
fi
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
