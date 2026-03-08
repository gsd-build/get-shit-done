---
name: gsd:sync
description: Sync .planning indexes with target branch so the merge is clean - no rebase needed
argument-hint: "[--dry-run] [--target=<branch>]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
---

<objective>
Prepare the current branch for a clean merge into a target branch (default: main) by resolving
.planning index collisions before they become merge conflicts.

Specifically:
1. Detect phase/quick index numbers that exist on both branches (collision)
2. Absorb phase entries from the target's ROADMAP.md that aren't in the local one (pre-empts ROADMAP.md merge conflicts)
3. Renumber branch-local phases and quicks to start after the target's highest index
4. Rename all affected directories and files to match

After running this, merging produces zero .planning conflicts.
</objective>

<execution_context>
Arguments: $ARGUMENTS
- --dry-run: show all planned changes but make none
- --target=<branch>: base branch to sync against (default: main)
</execution_context>

<process>

## Step 1: Parse arguments and safety checks

Parse --dry-run and --target=<branch> from $ARGUMENTS. Default target to `main`.

Run `git branch --show-current` to get current branch name.
If current branch equals target branch: output error and stop.
  "Already on [target]. Switch to your feature branch first."

Run `git status --short` and note any uncommitted changes. If dirty, warn the user but continue.

## Step 2: Read target branch state

Run these commands to read the target branch without switching to it:

```bash
git ls-tree --name-only <target> -- .planning/phases/
git ls-tree --name-only <target> -- .planning/quick/
git ls-tree -r --name-only <target> -- .planning/milestones/
git show <target>:.planning/ROADMAP.md
git show <target>:.planning/STATE.md
```

If .planning/ doesn't exist on target yet, treat all as empty.

Extract:
- **target_phases**: list of phase directory names from `.planning/phases/` (e.g. `["01-foundation", "18-feature-a"]`)
- **target_quicks**: list of quick directory names (e.g. `["1-fix-sidebar", "3-update-config"]`)
- **target_archived_phase_nums**: integer phase numbers found in `.planning/milestones/<version>-phases/<NN-slug>/`
  paths — extract the numeric prefix from the deepest directory name matching `/milestones\/[^/]+-phases\/(\d+[^/]*)\//`
- **target_roadmap**: full ROADMAP.md text from target
- **target_all_phase_nums**: integer parts of numbers from target_phases UNION target_archived_phase_nums
- **target_max_phase**: highest number in target_all_phase_nums
- **target_max_quick**: highest integer quick number in target_quicks

## Step 3: Read local branch state

List `.planning/phases/` and `.planning/quick/` directories.
List `.planning/milestones/` recursively to find archived phase directories (pattern `<version>-phases/<NN-slug>/`).
Read `.planning/ROADMAP.md` and `.planning/STATE.md`.

Extract:
- **local_phases**: list of active phase directory names from `.planning/phases/`
- **local_quicks**: list of quick directory names
- **local_archived_phases**: list of `{ version, dir_name }` for each phase found under `.planning/milestones/<version>-phases/`
  e.g. `[{ version: "v1.8", dir_name: "22-data-fields" }, { version: "v1.8", dir_name: "23-compile-pipeline" }]`
- **local_all_phase_dirs**: local_phases UNION local_archived_phases dir_names

## Step 4: Identify what needs to change

**Branch-local phases** = local_all_phase_dirs entries whose directory name does NOT appear in target_phases
  AND whose directory name does NOT appear in target_archived_phase directories.
  This covers both active phases and milestone-archived phases unique to this branch.

**Branch-local quicks** = local_quicks entries whose directory name does NOT appear in target_quicks.

**Target-only phases** = target_phases entries whose directory name does NOT appear in local_all_phase_dirs.
  These are phases the target has that the current branch doesn't know about yet — their ROADMAP
  entries need to be absorbed locally so git doesn't conflict on them.

For each branch-local phase, extract its numeric prefix using pattern `/^(\d+(?:\.\d+)*)-/`.
Note whether each branch-local phase is **active** (in `.planning/phases/`) or **archived**
(in `.planning/milestones/<version>-phases/`) — this determines which directory gets renamed in Step 8.

**Conflicting phases** = branch-local phases whose numeric prefix matches any number in target_all_phase_nums.
**Conflicting quicks** = branch-local quicks whose numeric prefix matches any numeric prefix in target_quicks.

If there are no conflicting phases, no conflicting quicks, and no target-only phases to absorb:
  Output: "Nothing to sync — no index conflicts with [target]."
  Exit successfully.

## Step 5: Compute new indexes

For conflicting branch-local phases:
- Compute `all_retained_phase_numbers` = integer parts of all phase numbers from target_phases
  UNION integer parts of all non-conflicting branch-local phase numbers
- Compute `next_available = max(all_retained_phase_numbers) + 1` (or 1 if the set is empty)
- Sort conflicting phases by current phase number ascending (numerically, not lexicographically)
- Assign each conflicting phase the current `next_available`, then increment by 1
- Non-conflicting branch-local phases are left at their current number
- Example: target has 18, 20 — local has 18 (conflicting), 19 (non-conflicting), 20 (conflicting)
  → all_retained = {18, 20} ∪ {19} = {18, 19, 20} → next_available = 21
  → 18 → 21, 20 → 22. No collisions by construction.

For conflicting branch-local quicks:
- Same logic: `all_retained_quick_numbers` = target quick numbers ∪ non-conflicting local quick numbers
- `next_available = max(all_retained_quick_numbers) + 1`

Build a rename map: `{ old_name: new_name }` for both phases and quicks.

## Step 6: Present plan and confirm

Print the full plan before touching anything:

```
GSD Sync Plan
=============
Target branch : main
Current branch: feature/my-work
Max phase on main : 18
Max quick on main : 4

PHASES
  Absorb from main (ROADMAP only, no dir copy):
    Phase 18: feature-a  ← will be inserted into local ROADMAP.md

  Rename (directory + files inside):
    phases/18-feature-b/          → phases/19-feature-b/
      18-01-PLAN.md               → 19-01-PLAN.md
      18-01-SUMMARY.md            → 19-01-SUMMARY.md
      18-VERIFICATION.md          → 19-VERIFICATION.md

QUICKS
  Rename (directory + files inside):
    quick/4-fix-something/        → quick/5-fix-something/
      4-PLAN.md                   → 5-PLAN.md
      4-SUMMARY.md                → 5-SUMMARY.md

ROADMAP.md
  Insert  "### Phase 18: feature-a" section (absorbed from main)
  Rename  "### Phase 18: feature-b" → "### Phase 19: feature-b"

STATE.md
  Update phase number references 18 → 19
```

If --dry-run: print plan and stop. Do not touch anything.

Otherwise: ask user to confirm before proceeding.

## Step 7: Absorb target-only ROADMAP entries

**Do this before renaming** so the inserted entries get the correct final numbers.

For each target-only phase (exists on target, not locally):
  - Extract the full phase section from target_roadmap. A phase section runs from its
    `### Phase N:` heading up to (but not including) the next `### Phase` heading.
  - Insert the extracted section into local ROADMAP.md at the correct sorted position
    (ordered by phase number, before any branch-local phases being renumbered).

This means the local branch already contains the target's new phase entries before the merge.
Git will see them as already present → no conflict on those lines.

## Step 8: Rename phase directories and files

For each phase in the rename map (old → new):

Determine whether the phase is **active** or **archived**:
- Active: directory is in `.planning/phases/<old_name>/`
- Archived: directory is in `.planning/milestones/<version>-phases/<old_name>/`

The old file prefix is the full numeric part of the directory name followed by a hyphen
(e.g. directory `18-slug` → prefix `18-`, directory `18.1-slug` → prefix `18.1-`).
The new file prefix is the new integer phase number followed by a hyphen (e.g. `19-`).

**For active phases:**
1. Rename files inside the directory first. For each file in `.planning/phases/<old_name>/`
   whose name starts with the old file prefix:
   - Run: `git mv ".planning/phases/<old_name>/<old_file>" ".planning/phases/<old_name>/<new_file>"`
2. Rename the directory:
   - Run: `git mv ".planning/phases/<old_name>" ".planning/phases/<new_name>"`

**For archived phases** (in `.planning/milestones/<version>-phases/`):
1. Rename files inside the archive directory. For each file in
   `.planning/milestones/<version>-phases/<old_name>/` whose name starts with the old file prefix:
   - Run: `git mv ".planning/milestones/<version>-phases/<old_name>/<old_file>" ".../<new_file>"`
2. Rename the archive directory:
   - Run: `git mv ".planning/milestones/<version>-phases/<old_name>" ".planning/milestones/<version>-phases/<new_name>"`
3. Also update the milestone ROADMAP archive if it exists:
   - Read `.planning/milestones/<version>-ROADMAP.md`
   - Replace phase number references (headings, checkboxes, table rows) old → new
   - Write the updated file

Use `git mv` for all renames so git tracks them as renames rather than delete+add.

## Step 9: Rename quick directories and files

For each quick in the rename map (old → new):

1. Rename files inside first. List all files in `.planning/quick/<old_name>/`.
   The old file prefix is the old quick number followed by a hyphen (e.g. `4-`). The new file prefix is the new quick number followed by a hyphen (e.g. `5-`).
   For each file whose name starts with the old file prefix:
   - Compute the new filename by replacing the old prefix with the new prefix
   - Run: `git mv ".planning/quick/<old_name>/<old_file>" ".planning/quick/<old_name>/<new_file>"`

2. Rename the directory:
   - Run: `git mv ".planning/quick/<old_name>" ".planning/quick/<new_name>"`

## Step 10: Update ROADMAP.md

For each phase rename, update all references in local ROADMAP.md:
- Phase heading: `### Phase 18:` → `### Phase 19:`
- Checkbox entries: `**Phase 18:**` → `**Phase 19:**`
- Dependency references: `Depends on: Phase 18` → `Depends on: Phase 19`
- Table rows: `| 18.` → `| 19.` (be precise to avoid collateral changes)

Write the updated file.

## Step 11: Update STATE.md

Read `.planning/STATE.md`. For each phase rename:
- Update `**Current Phase:** 18` → `**Current Phase:** 19` (if applicable)
- Update phase references in progress tables

Write the updated file.

## Step 12: Report

Print what was done:

```
GSD Sync Complete
=================
✓ Absorbed 1 ROADMAP entry from main (Phase 18: feature-a)
✓ Renamed 1 phase: 18-feature-b → 19-feature-b (3 files)
✓ Renamed 1 quick: 4-fix-something → 5-fix-something (2 files)
✓ Updated ROADMAP.md
✓ Updated STATE.md

Ready to merge into main. No .planning conflicts expected.
Suggested next step: open your PR or run `git merge <this-branch>` from main.
```

Do NOT commit. Do NOT push. Leave that to the user.

</process>

<success_criteria>
- No branch-local phase or quick index overlaps with target branch after sync — including archived phases in `.planning/milestones/`
- Target branch's ROADMAP.md phase entries are absorbed into local ROADMAP.md
- All renamed directories (active and archived) have their internal files renamed to match
- Milestone archive ROADMAP files updated to reflect new phase numbers
- ROADMAP.md and STATE.md reflect the new numbers
- --dry-run shows the full plan with zero filesystem changes
- User confirmed before any changes were made (unless --dry-run)
- git mv used for all renames (preserves history)
</success_criteria>

<critical_rules>
- NEVER rename phases that exist on both branches — only branch-local ones
- NEVER copy phase directories from target — absorb ROADMAP entries only
- ALWAYS absorb target ROADMAP entries BEFORE renaming local phases (order matters for numbering)
- Use `git mv` for all renames, not plain `mv`
- Do NOT commit or push — leave staging and committing to the user
- Do NOT touch any files outside .planning/
- --dry-run must make ZERO filesystem changes
- If a branch-local phase has no numeric conflict with target, leave it at its current number
</critical_rules>
