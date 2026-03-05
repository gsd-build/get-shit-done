# PR Draft: feat: add /gsd:sync for clean parallel-branch merges

> **Instructions for submitting:**
> 1. Fork `glittercowboy/get-shit-done` on GitHub (if you haven't already)
> 2. Push this branch to your fork
> 3. Open a PR from your fork's branch to `glittercowboy/get-shit-done:main`
> 4. Copy the text below the line as the PR body
> 5. Delete this file before committing (or add it to .gitignore)
>
> **Related issues to reference:** #64 (worktrees, closed), #707 (quick branching, open)
>
> **README note:** See bottom of this file for suggested README.md addition.

---

## feat: add `/gsd:sync` for clean parallel-branch merges

### Problem

GSD's `.planning` indexes are computed at runtime by scanning the filesystem — phase numbers from `ROADMAP.md`, quick task numbers from the `quick/` directory. There's no central counter. This works perfectly for linear, single-branch development, but creates real friction when development isn't linear:

- Solo developers running multiple agents in parallel on different branches
- Git worktrees (one per feature, one per environment, etc.)
- Any workflow where two branches independently run `/gsd:add-phase` or `/gsd:quick`

Both branches compute the same "next" number from the same base, producing index collisions:

```
main at phase 17, quick task 3

branch-A: /gsd:add-phase  →  creates phases/18-feature-a/
branch-B: /gsd:add-phase  →  creates phases/18-feature-b/   ← same number

branch-A merges first. Now branch-B needs to merge.
Result: ROADMAP.md conflict, ambiguous directories, manual renaming across
        phases/, PLAN files, SUMMARY files, ROADMAP.md, STATE.md.
```

This was discussed in #64 and is a recurring pain point as GSD usage grows beyond strictly sequential single-context workflows. Modern AI-assisted development — including GSD's own parallel wave execution — naturally produces parallel workstreams.

### Solution

`/gsd:sync [--dry-run] [--target=<branch>]`

A pre-merge preparation command that resolves index collisions **before** they become merge conflicts, using git to read the target branch's state without switching to it.

**How it works:**

1. Reads target branch's `.planning/` state via `git ls-tree` / `git show <target>:...` — no branch switch required
2. Identifies branch-local phases and quicks (present locally, absent on target)
3. Detects which ones have conflicting index numbers
4. **Absorbs target's ROADMAP.md phase entries into the local ROADMAP** — so git sees them as already present on both sides, eliminating the ROADMAP.md merge conflict entirely
5. Renumbers conflicting branch-local phases and quicks to start after the target's highest index
6. Renames directories and all internal files (`git mv`, preserving history)
7. Updates `ROADMAP.md` and `STATE.md` references to match

**Result:** merge (not rebase) produces zero `.planning` conflicts.

**Example:**

```
# On feature-branch, after branch-A has already merged phase 18:

/gsd:sync

GSD Sync Plan
=============
Target branch : main (max phase: 18, max quick: 4)
Current branch: feature-branch

PHASES
  Absorb from main:  Phase 18: feature-a  →  inserted into local ROADMAP.md
  Rename:            phases/18-feature-b/ →  phases/19-feature-b/
                       18-01-PLAN.md      →    19-01-PLAN.md
                       18-01-SUMMARY.md   →    19-01-SUMMARY.md

QUICKS
  Rename:            quick/4-fix-x/       →  quick/5-fix-x/

Proceed? (y/n): y

✓ Absorbed 1 ROADMAP entry from main
✓ Renamed 1 phase: 18 → 19
✓ Renamed 1 quick: 4 → 5
✓ Updated ROADMAP.md, STATE.md

Ready to merge. No .planning conflicts expected.
```

**`--dry-run`** shows the full plan with zero changes — useful before opening a PR or during code review.

### Why not change the naming scheme?

An alternative approach is slug-only phase directories (dropping numeric prefixes entirely). That's a cleaner long-term architecture but a breaking change requiring migration of all existing projects. `/gsd:sync` is additive — zero impact on users who work linearly, opt-in for those who don't.

### Files changed

- `commands/gsd/sync.md` — new command

### Testing notes

Tested against a project with:
- Two branches both adding phases from the same base
- Quick task collisions
- Target branch with ROADMAP entries the local branch hadn't seen

---

## README.md — suggested addition

Add to the **Utilities** table (after `/gsd:health`):

```markdown
| `/gsd:sync [--dry-run] [--target=<branch>]` | Resolve .planning index conflicts before merging parallel branches |
```

Optionally, a short note in the **Git Branching** configuration section:

```markdown
> **Working in parallel?** If you use git worktrees or run multiple agents on
> different branches simultaneously, run `/gsd:sync` before merging to resolve
> any `.planning` index collisions automatically.
```

This surfaces the feature to users who configure `branching_strategy` — the most likely audience.
