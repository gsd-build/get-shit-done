<purpose>
Merge a milestone branch into a target branch using squash merge. Handles both .planning/ artifact conflicts (using GSD command-aware merge logic) and code conflicts (AI-assisted, guided by merged .planning/ context). Each conflict is presented with full context, merge reasoning, and result preview — user confirms before any write.

Designed for multi-developer workflows where each developer works on their own git branch with their own .planning/ state.
</purpose>

<process>

## 1. Prerequisites & Target Branch

```bash
CURRENT_BRANCH=$(git branch --show-current)
```

Parse `$ARGUMENTS` for target branch. If not provided, use AskUserQuestion to select (main / master / custom).

**Verify prerequisites:**

```bash
# Not already on target
[ "$CURRENT_BRANCH" = "$TARGET_BRANCH" ] && echo "Error: Already on $TARGET_BRANCH. Switch to your milestone branch first." && exit 1

# Target exists
git rev-parse --verify "$TARGET_BRANCH" >/dev/null 2>&1 || git fetch origin "$TARGET_BRANCH" 2>/dev/null

# Check milestone completion — phases/ should have all summaries
PLANNING_DIR=".planning"
if [ -d "$PLANNING_DIR/phases" ]; then
  INCOMPLETE=$(find "$PLANNING_DIR/phases" -mindepth 1 -maxdepth 1 -type d | while read phase_dir; do
    phase_name=$(basename "$phase_dir")
    plans=$(ls "$phase_dir"/*-PLAN.md 2>/dev/null | wc -l)
    summaries=$(ls "$phase_dir"/*-SUMMARY.md 2>/dev/null | wc -l)
    [ "$plans" -gt 0 ] && [ "$summaries" -lt "$plans" ] && echo "$phase_name"
  done)
  if [ -n "$INCOMPLETE" ]; then
    echo "Warning: These phases have incomplete summaries: $INCOMPLETE"
    echo "Consider running /gsd-complete-milestone first."
  fi
fi

# Uncommitted changes
git diff --quiet && git diff --cached --quiet || echo "Warning: Uncommitted changes detected."
```

**If milestone not complete:** Warn the user. Use AskUserQuestion — Continue anyway / Run complete-milestone first / Cancel.

## 2. Show What Will Be Merged

```bash
COMMIT_COUNT=$(git rev-list --count $TARGET_BRANCH..HEAD 2>/dev/null || echo "?")
```

Present a comprehensive one-screen summary:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD > MERGE PREVIEW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Branch: $CURRENT_BRANCH → $TARGET_BRANCH
Commits: $COMMIT_COUNT

── Local Commits ──────────────────────────────────────
[git log --oneline $TARGET_BRANCH..HEAD]

── Files Changed (excluding ephemeral .planning/) ─────
[git diff --stat $TARGET_BRANCH...HEAD -- ':!.planning/STATE.md' ':!.planning/.lock' ':!.planning/auto.lock' ':!.planning/active-workstream' ':!.planning/WAITING.json' ':!.planning/metrics.json' ':!.planning/continue.md' ':!.planning/*-CONTINUE.md' ':!.planning/activity/' ':!.planning/runtime/' ':!.planning/worktrees/']

── Potential Conflicts ────────────────────────────────
[git diff --name-only $TARGET_BRANCH...HEAD | intersect with files changed on target since merge-base]
```

**If `--dry-run` in `$ARGUMENTS`:** Stop here.

Use AskUserQuestion:
- "Ready to merge $CURRENT_BRANCH into $TARGET_BRANCH?"
- Options: Squash merge (recommended) / Regular merge / Cancel

## 3. Execute Merge

```bash
git fetch origin $TARGET_BRANCH 2>/dev/null || true
git checkout $TARGET_BRANCH
git pull origin $TARGET_BRANCH 2>/dev/null || true
```

**Squash merge:**
```bash
git merge --squash $CURRENT_BRANCH
```

**Regular merge:**
```bash
git merge $CURRENT_BRANCH --no-edit
```

**Why squash/merge instead of rebase:** GSD workflows produce many atomic commits per phase. Rebase would replay each commit individually, requiring conflict resolution at every commit boundary. Merge surfaces **all conflicts at once** against the final state of both branches, giving the AI full context in a single pass.

**If no conflicts:** Skip to Step 7.

## 4. Gather Branch Context (Before Any Resolution)

This is the foundation for all subsequent conflict resolution. Read .planning/ artifacts from **both branches** to understand what each side built.

### 4a. Collect artifacts from both sides

Read both branches' `.planning/` artifacts directly using `git show` — no temp files needed:

- **Target branch versions**: Read from `.planning/` in the current working tree (we're on target after checkout)
- **Source branch versions**: Read via `git show $CURRENT_BRANCH:.planning/<file>` (note: use `$CURRENT_BRANCH` not `MERGE_HEAD`, since `MERGE_HEAD` doesn't exist after `--squash`)

Files to collect from source: `PROJECT.md`, `ROADMAP.md`, `REQUIREMENTS.md`, `MILESTONES.md`, `STATE.md`.

**Graceful degradation for missing files:**
- STATE.md unavailable → Infer progress from ROADMAP.md (`[x]`/`[ ]` marks) and SUMMARY.md one-liners. Note the gap, ask user to supplement if needed.
- research/, reports/, debug/, todos/ unavailable → Not critical. Skip without warning.

### 4b. Build context summary

From collected artifacts, identify:

1. **Each branch's milestone** — version, name, goal
2. **Each branch's scope** — which requirements each worked on (REQ-IDs)
3. **Each branch's progress** — phases completed, key deliverables
4. **Relationship** between branches:
   - **Independent milestones** — different goals, non-overlapping (e.g., v1.1-auth vs v1.2-perf)
   - **Same milestone, different workstreams** — same goal, divided scope
   - **Overlapping scope** — partially/fully overlapping requirements
   - **Unknown** — cannot determine

### 4c. Extract per-commit context from both sides

For a richer understanding of conflicts:

```bash
# Local (source) commits with files changed
git log --oneline --stat $TARGET_BRANCH..$CURRENT_BRANCH

# Target commits since divergence
git log --oneline --stat $(git merge-base HEAD $CURRENT_BRANCH)..HEAD
```

For each conflicting file, trace:
- Which commits on each side touched this file
- What requirement/phase drove those commits (cross-reference with .planning/)
- Whether there are dependency relationships between conflicting changes

### 4d. Present context and confirm

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD > MERGE CONTEXT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Target ($TARGET_BRANCH):
  Milestone: v[X.Y] [Name]
  Scope: [REQ-IDs or description]
  Progress: [N] phases completed

Source ($CURRENT_BRANCH):
  Milestone: v[X.Y] [Name]
  Scope: [REQ-IDs or description]
  Progress: [N] phases completed

Relationship: [independent / same-milestone / overlapping / unknown]

Conflicting files:
  .planning/: [list]
  Code: [list]
```

Use AskUserQuestion:
- "Is this understanding correct?"
- Options: Correct / Let me clarify / Show me the details

Loop until user confirms "Correct".

## 5. Resolve .planning/ Conflicts

### 5a. Auto-resolve ephemeral files

Per-developer state files — always accept target branch version. **Never delete files from the working tree**, only `git checkout --ours`.

```bash
EPHEMERAL_FILES=(
  .planning/STATE.md .planning/STATE.md.lock .planning/.lock .planning/auto.lock
  .planning/active-workstream .planning/WAITING.json .planning/metrics.json
  .planning/continue.md
)
for file in "${EPHEMERAL_FILES[@]}"; do
  git diff --name-only --diff-filter=U | grep -q "^$file$" && git checkout --ours "$file" && git add "$file"
done
# Pattern match *-CONTINUE.md, activity/*, runtime/*, worktrees/*
git diff --name-only --diff-filter=U | grep -E '\.planning/(.*-CONTINUE\.md|activity/|runtime/|worktrees/)' | while read f; do
  git checkout --ours "$f" 2>/dev/null && git add "$f" 2>/dev/null
done
```

### 5b. Smart-merge shared planning artifacts (command-aware)

**General principle:** Each GSD command encodes domain knowledge about how a file should be updated. Conflict resolution reuses that knowledge.

**Resolution mapping:**

| Conflicting File | Command Logic | Merge Strategy |
|---|---|---|
| **PROJECT.md** | `complete-milestone` → `evolve_project_full_review` | Full evolution: merge What This Is/Core Value (combine if both evolved), union Validated/Active/Out of Scope requirements, combine Key Decisions table, synthesize Context from both, update Current Milestone |
| **ROADMAP.md** | `complete-milestone` → `reorganize_roadmap` | Merge phase structures from both milestones, preserve `[x]`/`[ ]` status, re-number if collision, merge Progress table, apply `<details>` grouping for completed milestones |
| **REQUIREMENTS.md** | `new-milestone` → define requirements | Union REQ-IDs by category, preserve checkbox status (`[x]` wins over `[ ]`), merge traceability table, flag if same REQ-ID has different descriptions |
| **MILESTONES.md** | `complete-milestone` → `create_milestone_entry` | Keep all entries sorted by version. Same-version entries: merge title/accomplishments/metrics (see below) |
| **config.json** | Deep merge | Scalars: prefer ours. Nested objects: merge keys from both |
| **codebase/*** | `map-codebase` post-merge | Accept theirs; suggest `/gsd:map-codebase` in post-merge |
| **research/*** | Additive | Keep both. Rename on filename collision (append branch scope) |
| **phases/*** | Keep both | Different milestones → independent. Same milestone → cross-reference with ROADMAP |
| **milestones/*** | Keep all | Same-version archives → merge contents. Different-version → keep all |
| **intel/*** | Merge per-file | JSON files: deep merge. Markdown: semantic merge |
| **graphs/*** | Accept theirs | Generated; suggest regeneration post-merge |
| **seeds/*** | Additive | Keep all. Rename on collision |
| **todos/*** | Additive | Keep all from both sides |

### 5c. Detailed per-file merge logic

For each conflicting `.planning/` file, apply the command logic from the table above. These are structured documents — git's line-based merge produces nonsensical results. The LLM must understand the document semantics.

#### PROJECT.md — apply `evolve_project_full_review` logic

Read both sides' phase summaries and requirements, then merge section by section:

- **"What This Is"**: If both branches evolved the description differently, merge them into a combined description that captures the full product scope. If only one side changed, use that version.
- **"Core Value"**: Flag to user if both sides suggest different core values — this is a strategic decision. Present both with AskUserQuestion.
- **"Validated"**: Union of both sides' validated requirements. Each item keeps its milestone/phase version reference (e.g., "— Phase 1", "— v1.1"). Deduplicate by REQ-ID. If same REQ-ID appears in both with different phase references, keep both references.
- **"Active"**: Union of both sides, deduplicate by REQ-ID. If same REQ-ID has different descriptions, flag to user. Remove any REQ-IDs that now appear in Validated (promoted during the work).
- **"Out of Scope"**: Union from both sides. Preserve reasoning. If same exclusion appears with different reasoning, combine both reasons.
- **"Key Decisions"**: Combine tables from both sides. Sort chronologically if dates available, otherwise append source after target. If same Decision text appears in both (e.g., both evaluated "SQLite vs PostgreSQL"), use the version with the more definitive Outcome (✓ Good > — Pending > ⚠️ Revisit). Mark the source milestone for each decision if branches are independent.
- **"Context"**: Synthesize from both sides' latest state — combine technical details, user feedback, metrics. This is prose; the LLM should write a coherent merged paragraph, not mechanically concatenate.
- **"Constraints"**: Union. If same constraint area differs (e.g., both specify "Storage" but with different values), present both to user.
- **"Current Milestone"**: Use source branch's version if it's newer; otherwise flag to user.
- **"Last Updated"**: Set to today's date with `"after merge ($CURRENT_BRANCH → $TARGET_BRANCH)"`.
- **Same-version milestone cross-reference**: If both branches worked on the same milestone, after ROADMAP.md merge (which may renumber phases), scan Validated ("Completed in Phase N"), Key Decisions, and Context for stale phase references. Update to match merged ROADMAP.md numbers.

#### ROADMAP.md — apply `reorganize_roadmap` logic

- Identify which phases belong to which milestone on each side
- Preserve `[x]`/`[ ]` status marks from both sides — if one side marks a phase complete and the other doesn't, the `[x]` wins
- Apply milestone grouping: completed milestones wrapped in `<details><summary>` sections
- **Phase number collision**: If both sides added phases with the same numbers (common when both start from Phase 1), re-number the **source** branch's phases to continue from target's last phase number. E.g., target has Phases 1-5, source has Phases 1-3 → source becomes Phases 6-8
- Merge the **Progress table**: combine rows from both sides, update Phase column for re-numbered phases
- Merge the **Summary checklist** (`- [x] **Phase N:**` items): union, with re-numbered references
- If both branches have a `## Backlog` section: union the backlog items

#### REQUIREMENTS.md — apply define-requirements logic

- Parse both sides' **category groupings** (e.g., `### Authentication`, `### API`, `### Core`) and REQ-ID lists
- Merge categories: union of all categories from both sides. Preserve category ordering from target, append new categories from source at the end.
- Within each category: union of REQ-IDs. Checkbox status: `[x]` wins over `[ ]` (if either side completed a requirement, it's complete). If same REQ-ID has different description text, flag to user.
- **REQ-ID collision**: If source has REQ-IDs that collide with target's (e.g., both have AUTH-01 but with different meanings), renumber source's IDs to continue from target's max ID in that category.
- **Traceability table**: Merge rows. If same REQ-ID maps to different phases on each side, flag to user. If phases were re-numbered in ROADMAP.md merge, update phase references here too.
- **Future Requirements / Out of Scope**: Union from both sides

#### STATE.md — apply state-update logic

Note: STATE.md is often ephemeral (auto-resolved in 5a). Only apply this logic if STATE.md is in the shared artifact set for this project.

- **Current Position**: Use whichever side has the more recent `Last Activity` timestamp. If timestamps are missing, prefer the side with the higher phase number.
- **Accumulated Context**: Concatenate unique entries from both sides, deduplicate by semantic content (not exact string match — the LLM should understand that "Added auth module" and "Implemented authentication" are the same thing).
- **Quick Tasks Completed**: Merge table rows, sort by date.
- **Blockers/Concerns**: Union from both sides. Remove any blockers that were resolved (check against completed phases).
- **Deferred Items**: Union from both sides.

#### MILESTONES.md — apply `create_milestone_entry` logic

- If both branches have entries for **different versions**: Keep all, sorted by version number (reverse chronological — newest first).
- If both branches have entries for the **same milestone version** (e.g., both have v0.5.0):
  - **Title**: Combine both titles to reflect the full scope (e.g., "Markdown Rendering" + "Message Timestamps" → "Markdown Rendering & Message Timestamps")
  - **Accomplishments**: Union of both sides' accomplishment lists
  - **Metrics** (phases completed, plans executed, tasks completed): Sum counts from both branches
  - **Date/Timeline**: Use the later completion date

#### config.json — deep merge

- Scalars: prefer target (ours) unless source explicitly changed the value from the common ancestor
- Nested objects (e.g., `workflow`, `git`, `hooks`): merge keys from both sides
- Arrays (e.g., `sub_repos`): union, deduplicate
- If both sides changed the same scalar key to different values, present both to user

#### milestones/* — archive directory merge

- If both branches archived **different versions**: Keep all — no conflict
- If both branches archived the **same milestone version** (e.g., both have `milestones/v0.5.0/`):
  - **REQUIREMENTS.md archive**: Merge requirements from both branches (union of REQ-IDs and categories). Update the title to reflect combined scope.
  - **ROADMAP.md archive**: Merge phase lists from both branches. Re-number if phases collide.
  - **Other archive files**: Keep both, rename on collision (append branch scope identifier, e.g., `MILESTONE-AUDIT-auth.md`)

#### phases/* + milestones/* cross-directory reconciliation

After resolving both directories independently, check for inconsistencies:
- If one branch archived phases to `milestones/vX.Y/` but the other left those same phases in `phases/`, unify them: move to `milestones/vX.Y/` (the archived location takes precedence)
- Verify that every phase referenced in the merged ROADMAP.md exists in either `phases/` (active) or `milestones/` (archived) — flag any orphaned references

#### Phase number realignment (post all .planning/ merges)

This is a **cross-cutting concern** that runs after all individual file merges are complete:

1. Collect the final phase number mapping from ROADMAP.md (which phases were renumbered)
2. Scan and update **all** references to renumbered phases across:
   - PROJECT.md — "Validated in Phase N", Key Decisions phase mentions
   - REQUIREMENTS.md — Traceability table Phase column
   - MILESTONES.md — Phase count references
   - phases/ directory names — `NN-name/` → renumbered directory
   - Phase file internals — PLAN*.md, SUMMARY*.md, CONTEXT.md phase references

### 5d. Per-file resolution presentation

For each conflicting `.planning/` file, after applying the logic above:

1. **Read the conflict** with markers
2. **Read both branches' clean versions** (from target + $CURRENT_BRANCH, collected in Step 4)
3. **Apply the file-specific merge logic** from 5c using `$BRANCH_CONTEXT`
4. **Present the resolution:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Conflict: .planning/PROJECT.md
 Resolving with: evolve_project_full_review logic
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What each branch contributed:
- Target ($TARGET_BRANCH): [summary from $BRANCH_CONTEXT]
- Source ($CURRENT_BRANCH): [summary from $BRANCH_CONTEXT]

Merge decisions made:
1. [e.g., "Combined Validated requirements from both milestones — 3 from target + 2 from source"]
2. [e.g., "Re-numbered source phases 5-7 → 8-10 to avoid collision"]
3. [e.g., "Flagged Key Decision conflict — both sides made different choices on auth strategy"]

Merged result:
─────────────────────────────────────────────────────
[Full merged file content]
─────────────────────────────────────────────────────
```

5. **Ask user to confirm** via AskUserQuestion:

- header: "Resolve: [filename]"
- question: "Review the merged result above. Accept or adjust?"
- options:
  - "Accept" — apply the merged result
  - "Let me provide context" — user will explain intent, re-merge with guidance
  - "Skip — I'll resolve manually" — leave for manual resolution

**If "Accept":** Write the merged file and `git add $FILE_PATH`.
**If "Let me provide context":** Ask what needs changing, re-apply merge logic with user's guidance, re-present. Loop until accepted or skipped.
**If "Skip":** Leave unresolved, continue to next file.

## 6. Resolve Code Conflicts

### 6a. Identify remaining conflicts

```bash
REMAINING=$(git diff --name-only --diff-filter=U)
```

If none, skip to Step 7.

### 6b. AI-assisted resolution per file

For each conflicting code file, using `$BRANCH_CONTEXT` from Step 4:

1. **Read the conflict file** with `<<<<<<<` / `=======` / `>>>>>>>` markers
2. **Trace intent from .planning/**:
   - Which requirements drove the target side's change
   - Which requirements drove the source side's change
   - Read relevant `*-PLAN.md` files if the file path appears in any plan
   - Check if changes are independent / overlapping / contradictory
3. **Generate resolution for each conflict block:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Conflict: src/tasks.js
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Block 1 (line 5):
  Target intent: Add userId parameter for auth scoping (AUTH-01)
  Source intent: Add priority parameter for task prioritization (API-01)
  Relationship: Independent — both features needed

  Proposed resolution:
  ┌─────────────────────────────────────────────────┐
  │ function createTask(title, userId, priority) {  │
  │   priority = priority || 'medium';              │
  │   const task = { id: tasks.length + 1, title,   │
  │     priority, completed: false, userId,         │
  │     createdAt: new Date() };                    │
  └─────────────────────────────────────────────────┘

  Confidence: high
  Reason: Both features are Active requirements in merged PROJECT.md.
          Parameters are independent — combine both.

---
(repeat for each conflict block)
```

4. **Ask user to confirm** via AskUserQuestion:
   - Options: Accept all / Let me provide context / Skip (manual)

### 6c. Cross-file review

After all files resolved, run a consistency review:

1. **Cross-file consistency** — .planning/ references aligned? Phase numbers match? REQ-IDs consistent?
2. **Code + planning alignment** — Do resolved code files implement what merged .planning/ describes?
3. **Conflict markers clean** — No `<<<<<<<` / `=======` / `>>>>>>>` remaining:
   ```bash
   grep -rn '<<<<<<<\|=======\|>>>>>>>' $(git diff --cached --name-only) 2>/dev/null
   ```
4. **Import/dependency coherence** — Resolved code files: imports, function signatures, shared interfaces consistent?

Present review results. Fix any issues found before proceeding.

### 6d. Impact assessment & testing

```bash
RESOLVED_CODE=$(git diff --cached --name-only | grep -v '^\\.planning/')
```

Trace each resolved file's dependents (imports/requires). Present impact summary.

Use AskUserQuestion:
- "Run tests to verify?"
- Options: Run tests / Skip / Let me specify command

If tests fail: analyze in context of merge, offer Fix/Commit anyway/Abort.

## 7. Commit

```bash
UNRESOLVED=$(git diff --name-only --diff-filter=U)
```

If unresolved files remain, list them and stop.

Otherwise:

```bash
git commit -m "feat: merge milestone $CURRENT_BRANCH

Squash merge of $COMMIT_COUNT commits from $CURRENT_BRANCH.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

## 8. Post-Merge & Summary

### Cleanup suggestions

- **Codebase map stale?** If `codebase/*` was in the diff, suggest `/gsd:map-codebase`
- **Delete source branch?** AskUserQuestion: Delete / Keep
- **Push?** AskUserQuestion: Push $TARGET_BRANCH / Skip

### Merge Summary

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD > MERGE COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

| Detail | Value |
|--------|-------|
| Source | $CURRENT_BRANCH |
| Target | $TARGET_BRANCH |
| Type | Squash merge |
| Commits | $COMMIT_COUNT |
| .planning/ conflicts resolved | [N] files |
| Code conflicts resolved | [N] files |
| Auto-resolved (ephemeral) | [N] files |
| Skipped (manual) | [N] files |
| Tests | passed / skipped / [N] failures |
| Branch deleted | Yes / No |
| Pushed | Yes / No |

── .planning/ Merge Decisions ─────────────────────────
[Per-file summary: what was merged, what changed]

── Code Conflict Resolutions ──────────────────────────
[Per-file summary: what each side intended, how resolved]

── Recommendations ────────────────────────────────────
[Any post-merge actions: re-map codebase, re-run tests, etc.]

Next: /gsd:progress or /gsd:new-milestone
```

</process>

<success_criteria>
- [ ] Target branch determined and verified to exist
- [ ] Milestone completion status checked (warning if incomplete summaries)
- [ ] Full merge preview shown: commits, file stats, potential conflicts
- [ ] Squash or regular merge executed (never rebase — all conflicts surfaced at once)
- [ ] Branch context gathered: both branches' milestones, scope, progress, relationship identified
- [ ] User confirmed context understanding before any conflict resolution
- [ ] Ephemeral .planning/ files auto-resolved (accept ours, never delete)
- [ ] Shared .planning/ artifacts merged using command-aware logic per file type
- [ ] Same-version milestone handling: merged entries, archives, phase renumbering, cross-reference updates
- [ ] Each .planning/ resolution presented with: context, merge reasoning, result preview → user confirmed
- [ ] Code conflicts resolved using AI with .planning/ context: intent traced, relationship classified, resolution proposed
- [ ] Each code resolution presented with: both sides' intent, proposed merge, confidence level → user confirmed
- [ ] Cross-file consistency review passed (phase numbers, REQ-IDs, conflict markers, imports)
- [ ] Impact assessment performed and tests run (or explicitly skipped)
- [ ] No unresolved conflict markers in any file
- [ ] Clean commit with descriptive message
- [ ] Post-merge cleanup offered (branch deletion, push, codebase re-map)
- [ ] Comprehensive summary with all merge decisions documented
</success_criteria>
