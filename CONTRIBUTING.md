# Contributing to Get Shit Done

No enterprise theater. Ship useful code.

---

## Philosophy

GSD optimizes for **solo developer + Claude workflow**. The release process follows the same principle: complexity lives in automation, not your workflow.

**What this means:**
- No sprint ceremonies or release committees
- No multi-week stabilization branches
- Checkpoints before risky changes, not bureaucratic gates
- Ship when ready, batch when sensible

---

## Branch Strategy

Two branches. That's it.

```
main ════════════════════════════════════════════►
         ▲         ▲         ▲         ▲
         │         │         │         │
      v1.9.0    v1.9.1    v1.10.0   v2.0.0
         │         │         │
      hotfix   batched    minor
               fixes    features
```

### `main`

Production. Always installable via `npx get-shit-done-cc`.

| Rule | Why |
|------|-----|
| No direct commits | Forces checkpoint thinking |
| PRs required | Creates revert points |
| Must pass CI | Catches Windows/path issues |

### Feature Work

Branch → PR → Merge. No `develop` branch. No release branches.

```bash
# Start work
git checkout -b feat/model-profiles
# or fix/windows-paths
# or docs/checkpoint-examples

# Ship it
git push origin feat/model-profiles
# Open PR, get review, merge
```

**Branch naming:**
- `feat/description` — New capability
- `fix/description` — Bug fix
- `docs/description` — Documentation only
- `refactor/description` — Internal changes, no behavior change
- `hotfix/version-description` — Emergency production fix

---

## When to Branch vs. Direct Commit

**Use a branch when:**
- Adding new commands or workflows
- Changing core behavior (orchestrator, context loading)
- Touching multiple files
- You'd want a clean revert point

**Direct commit to main (maintainers only):**
- Typo fixes
- README updates
- Single-line bug fixes with obvious correctness

---

## Commits

Use conventional commits. Claude already does this.

```
feat(checkpoints): add rollback capability
fix(install): use absolute paths on Windows (#207)
docs(readme): update installation instructions
refactor(orchestrator): extract context loading
chore: remove old planning files
revert: remove codebase intelligence system
```

**Format:** `type(scope): description`

| Type | Use |
|------|-----|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation |
| `refactor` | Code change without behavior change |
| `chore` | Maintenance, dependencies |
| `revert` | Undoing previous commit |

---

## Releases & Tags

### Tag Sparingly

**Current problem:** 131 tags in one month. Too noisy.

**New rule:** Tag stable milestones, not every commit.

| Change Type | Tag? | Version Bump |
|-------------|------|--------------|
| Breaking change | Yes | MAJOR (2.0.0) |
| New feature | Yes | MINOR (1.10.0) |
| Bug fix | Batch | PATCH (1.9.x) |
| Documentation | No | — |
| Refactor | No | — |

### Version Cadence

- **Minor releases (1.X.0):** When features are ready. No fixed schedule.
- **Patch releases (1.9.X):** Batch fixes weekly, or immediately for critical bugs.
- **Major releases (X.0.0):** Breaking changes only. Rare.

### Pre-release Tags for Risky Features

The codebase intelligence system added 3,065 lines and a 21MB dependency. It got reverted. Pre-release tags prevent this:

```bash
# Experimental feature
git tag -a v1.10.0-alpha.1 -m "Alpha: experimental codebase intelligence"

# After testing
git tag -a v1.10.0-beta.1 -m "Beta: codebase intelligence stabilized"

# Ready for production
git tag -a v1.10.0 -m "Release: codebase intelligence"
```

Users opt-in: `npm install get-shit-done-cc@1.10.0-alpha.1`

**If it doesn't work out:** Delete pre-release tags, no messy public revert on main.

### Creating a Release

```bash
# Update version
npm version minor  # or patch, or major

# Update CHANGELOG.md (already follows Keep a Changelog format)

# Commit
git add package.json CHANGELOG.md
git commit -m "chore: release v1.10.0"

# Tag
git tag -a v1.10.0 -m "Release v1.10.0"
git push origin main --tags

# Publish
npm publish
```

### GitHub Releases

Create formal releases for minor+ versions. Copy the CHANGELOG section.

```
Go to: github.com/glittercowboy/get-shit-done/releases/new
Select tag: v1.10.0
Title: v1.10.0
Description: [paste from CHANGELOG.md]
```

---

## Large Changes

If a feature touches >500 lines or adds dependencies, use a branch and PR. This creates a review point before the change lands on main.

---

## Hotfixes

Production broken? Skip the normal flow.

```bash
# Branch from main
git checkout main
git checkout -b hotfix/1.9.4-windows-crash

# Fix it
# ... make changes ...

# Ship immediately
git commit -m "fix(install): handle Windows UNC paths"
git push origin hotfix/1.9.4-windows-crash

# PR → merge → tag
npm version patch
git tag -a v1.9.5 -m "Hotfix: Windows UNC paths"
git push origin main --tags
npm publish
```

---

## Pull Request Guidelines

### Title

Use conventional commit format:
```
feat(checkpoints): add rollback capability
fix(install): use absolute paths on Windows
```

### Description

```markdown
## What

[One sentence: what does this PR do?]

## Why

[One sentence: why is this change needed?]

## Testing

[How did you verify it works?]

## Breaking Changes

[List any, or "None"]
```

### Review Checklist

- [ ] Follows GSD style (no enterprise patterns, no filler)
- [ ] Updates CHANGELOG.md for user-facing changes
- [ ] Doesn't add unnecessary dependencies
- [ ] Works on Windows (test paths with backslashes)

---

## What NOT to Do

Borrowed from GSD-STYLE.md:

**Enterprise Patterns (Banned):**
- Story points
- Sprint ceremonies
- RACI matrices
- Release committees
- Multi-week stabilization branches
- Change advisory boards

**Temporal Language (Banned in Code/Docs):**
- "We changed X to Y"
- "Previously"
- "No longer"
- "Instead of"

Exception: CHANGELOG.md, MIGRATION.md, git commits

**Vague Contributions (Banned):**
```
# BAD
"Improve performance"
"Fix bugs"
"Update documentation"

# GOOD
"Reduce orchestrator context load from 12KB to 4KB"
"Fix Windows path handling in hook commands (#207)"
"Add checkpoint rollback examples to README"
```

---

## Quick Reference

| I want to... | Do this |
|--------------|---------|
| Add a feature | Branch `feat/x` → PR → merge |
| Fix a bug | Branch `fix/x` → PR → merge |
| Fix production NOW | Branch `hotfix/version-x` → PR → merge → tag |
| Release features | `npm version minor` → tag → publish |
| Release fixes | Batch weekly, or `npm version patch` for critical |
| Try experimental feature | Tag as `v1.X.0-alpha.1` |
| Revert a mistake | `git revert` → PR → merge |

---

## Setting Up Development

```bash
# Clone
git clone https://github.com/glittercowboy/get-shit-done.git
cd get-shit-done

# Install
npm install

# Test locally
npm link
npx get-shit-done-cc

# Run tests
npm test
```

---

## Getting Help

- **Issues:** Bug reports, feature requests
- **Discussions:** Questions, ideas, show & tell
- **Discord:** [Link if exists]

---

*"The complexity is in the system, not in your workflow."*

— TÂCHES
