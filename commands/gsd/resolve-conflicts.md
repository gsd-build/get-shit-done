---
name: gsd:resolve-conflicts
description: AI-assisted code conflict resolution guided by merged .planning/ documents
allowed-tools:
  - Read
  - Bash
  - Edit
  - Grep
  - Glob
---

# /gsd-resolve-conflicts

Resolve git merge conflicts using the merged `.planning/` documents as the source of truth.

## When to Use

After completing a workstream merge (`.planning/` files merged back to root), when merging the workstream's code branch into main produces git conflicts.

## Step 1: Detect Conflicts

Run `git diff --name-only --diff-filter=U` to list all files with unresolved merge conflicts.

If no conflicts found, inform the user and exit.

## Step 2: Load Planning Context

Read the merged `.planning/` documents to understand what each workstream built:

1. Read `PROJECT.md` — understand the combined project decisions, validated requirements, and key decisions
2. Read `ROADMAP.md` — understand which phases/features were completed
3. Read `MILESTONES.md` — understand completed milestones and their scope
4. If available, read `REQUIREMENTS.md` — understand which requirements are active/validated

Build a mental model of:
- What each workstream was responsible for
- What the final desired behavior should be based on the merged planning docs
- Which requirements are validated (must be preserved in code)
- Key architectural decisions that inform conflict resolution

## Step 3: Resolve Each Conflict

For each conflicting file:

1. **Read the file** with conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`)
2. **Analyze both sides** of each conflict:
   - Identify which workstream/branch each side came from
   - Understand what each change does
3. **Consult planning docs** to determine the correct resolution:
   - Which requirements does each side serve?
   - Are both changes needed (merge both)?
   - Does one supersede the other?
   - Do the Key Decisions in PROJECT.md inform the choice?
4. **Present recommendation** to the user using AskUserQuestion:
   - Show the conflict
   - Explain which side(s) should be kept and why (referencing specific planning doc sections)
   - Options: Accept recommendation / Keep ours / Keep theirs / Manual edit
5. **Apply resolution** based on user's choice

## Step 4: Verify

After resolving all conflicts:

1. Run `git diff --name-only --diff-filter=U` to confirm no conflicts remain
2. Suggest: `git add . && git commit` to complete the merge
3. Remind user to verify the merged code works as expected

## Important Principles

- The merged `.planning/` documents are the **single source of truth** for what the code should do
- If both sides of a conflict implement features described in the planning docs, **both changes should be preserved** (merge both)
- If one side implements a requirement that was moved to "Out of Scope", that side should be dropped
- Key Decisions table in PROJECT.md may directly inform architectural choices in conflict resolution
- When in doubt, prefer the change that aligns with validated requirements
