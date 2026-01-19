---
name: gsd:insert-new-phase
description: Insert a true integer phase at a position, renumbering all subsequent phases
argument-hint: <after> <description>
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
---

<objective>
Insert a new integer phase at a specific position, automatically renumbering all subsequent phases and their artifacts.

Unlike `/gsd:insert-phase` which creates decimal phases (e.g., 72.1) for urgent mid-milestone work, this command creates a true integer phase and renumbers everything after it. This is appropriate for planned roadmap restructuring.

Purpose: Enable clean integer phase insertion with proper renumbering when restructuring the roadmap.
Output: New phase created, all subsequent phases renumbered, user informed of changes (no auto-commit).
</objective>

<execution_context>
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@.planning/phases/
</execution_context>

<process>

<step name="parse_arguments">
Parse the command arguments:
- First argument: integer phase number to insert after
- Remaining arguments: phase description

Example: `/gsd:insert-new-phase 2 Add user authentication`
→ after = 2
→ description = "Add user authentication"
→ new phase will be Phase 3

Validation:

```bash
if [ $# -lt 2 ]; then
  echo "ERROR: Both phase number and description required"
  echo "Usage: /gsd:insert-new-phase <after> <description>"
  echo "Example: /gsd:insert-new-phase 2 Add user authentication"
  exit 1
fi
```

Parse first argument as integer:

```bash
after_phase=$1
shift
description="$*"

# Validate after_phase is an integer
if ! [[ "$after_phase" =~ ^[0-9]+$ ]]; then
  echo "ERROR: Phase number must be an integer (cannot insert after decimal phases)"
  exit 1
fi
```

</step>

<step name="load_state">
Load project state:

```bash
if [ ! -f .planning/ROADMAP.md ]; then
  echo "ERROR: No roadmap found (.planning/ROADMAP.md)"
  exit 1
fi

if [ ! -f .planning/STATE.md ]; then
  echo "ERROR: No state file found (.planning/STATE.md)"
  exit 1
fi
```

Read both files:
- ROADMAP.md: parse all phase headings and structure
- STATE.md: parse current position and total phase count

Build a list of all phases with their numbers and completion status.
</step>

<step name="validate_target_phase">
Verify that the target phase exists in the roadmap:

**Special case: Phase 0**
- If after_phase is 0, this means "insert before Phase 1"
- Skip existence check (phase 0 doesn't exist in roadmap)
- The new phase will become Phase 1, and all existing phases renumber up

**Normal case: Phase 1+**
1. Search for `### Phase {after_phase}:` heading (with zero-padded format like `### Phase 02:`)
2. If not found:

   ```
   ERROR: Phase {after_phase} not found in roadmap
   Available phases: [list phase numbers]
   ```

   Exit.

3. Verify phase is an integer (not decimal) - already validated in parse step.
</step>

<step name="check_completion_constraint">
**Critical validation:** Block insertion if ANY completed phase would be renumbered.

Scan all phases with number > target. A phase is "completed" if it has at least one SUMMARY.md file:

```bash
# Check each phase directory after target for SUMMARY.md files
for dir in .planning/phases/*; do
  phase_num=$(basename "$dir" | grep -oE '^[0-9]+(\.[0-9]+)?' )
  if [[ "$phase_num" > "$after_phase" ]]; then
    if ls "$dir"/*-SUMMARY.md 2>/dev/null | head -1 > /dev/null; then
      # Found a completed phase that would be renumbered
      completed_phases+=("$phase_num")
    fi
  fi
done
```

If ANY completed phases found:

```
ERROR: Cannot insert phase after Phase {target}

The following completed phases would need renumbering:
- Phase {N}: {Name} (completed)
- Phase {M}: {Name} (completed)

Completed phases cannot be renumbered because:
- Git commit history references these phase numbers
- Renumbering would make historical commits inaccurate

Options:
1. Use /gsd:insert-phase {target} to insert a decimal phase (no renumbering)
2. Add phase at end with /gsd:add-phase
```

Exit.
</step>

<step name="gather_affected_phases">
Collect all phases that need renumbering:

1. Find all integer phases > target
2. Find all decimal phases > target (e.g., 3.1, 3.2 when target is 2)
3. Calculate new phase numbers (all increment by 1)
4. Calculate new phase number for insertion: `target + 1`

**Check for no subsequent phases:**
If no phases exist after the target (i.e., inserting after the last phase):

```
No phases to renumber. Use `/gsd:add-phase {description}` to append a new phase at the end.
```

Exit without making any changes. This command is specifically for insertion with renumbering.

**Normal case - phases exist to renumber:**

Example for `insert-new-phase 2`:
```
Affected phases:
- Phase 3 → Phase 4
- Phase 3.1 → Phase 4.1
- Phase 3.2 → Phase 4.2
- Phase 4 → Phase 5
- Phase 5 → Phase 6

New Phase 3 will be created
```

Store:
- `new_phase = after_phase + 1`
- List of (old_number → new_number) mappings for all affected phases
- Count of directories to rename
- Count of files to rename
- Count of files to update (content)
</step>

<step name="show_confirmation">
Present the operation summary and ask for confirmation:

```
Inserting new Phase {new_phase}: {description}

This will renumber the following phases:
  - Phase 3 → Phase 4
  - Phase 3.1 → Phase 4.1
  - Phase 4 → Phase 5
  - Phase 5 → Phase 6

Directories to rename: {count}
Files to rename: {count}
Files to update (content): {count}

Proceed? (y/n)
```

Wait for user confirmation before proceeding. If user declines, exit gracefully.
</step>

<step name="renumber_directories">
Rename all subsequent phase directories in **descending order** to avoid naming conflicts:

```bash
# Example sequence for insert-new-phase 2 (process highest first):
mv ".planning/phases/05-dashboard" ".planning/phases/06-dashboard"
mv ".planning/phases/04-auth" ".planning/phases/05-auth"
mv ".planning/phases/03.2-hotfix" ".planning/phases/04.2-hotfix"
mv ".planning/phases/03.1-bugfix" ".planning/phases/04.1-bugfix"
mv ".planning/phases/03-core" ".planning/phases/04-core"
```

For each directory:
1. Extract old phase number from directory name
2. Calculate new phase number (old + 1)
3. Replace phase number prefix in directory name
4. Rename directory

Handle both:
- Integer phases: `03-slug` → `04-slug`
- Decimal phases: `03.1-slug` → `04.1-slug`

Use zero-padded format for single-digit phases (01, 02, ..., 09).
</step>

<step name="rename_files_in_directories">
For each renumbered directory, rename files containing the phase number:

```bash
# Inside 04-core (was 03-core):
mv "03-01-PLAN.md" "04-01-PLAN.md"
mv "03-02-PLAN.md" "04-02-PLAN.md"
mv "03-01-SUMMARY.md" "04-01-SUMMARY.md"  # if exists
mv "03-CONTEXT.md" "04-CONTEXT.md"        # if exists
mv "03-RESEARCH.md" "04-RESEARCH.md"      # if exists
mv "03-VERIFICATION.md" "04-VERIFICATION.md"  # if exists
mv "03-UAT.md" "04-UAT.md"                # if exists
```

Also handle decimal phase files:
```bash
# Inside 04.1-bugfix (was 03.1-bugfix):
mv "03.1-01-PLAN.md" "04.1-01-PLAN.md"
```

Files without phase prefixes (like CONTEXT.md without prefix) don't need renaming.
</step>

<step name="update_file_contents">
Update phase references inside all `.planning/` files. Process from highest phase to lowest to avoid double-replacement issues.

**Patterns to update (in order of specificity):**

1. **Plan/file references** (most specific first):
   - `03-01` → `04-01` (phase-plan references)
   - `03.1-01` → `04.1-01` (decimal phase-plan references)

2. **Phase directory/file prefixes**:
   - `03-` → `04-` (at start of filenames in references)
   - `03.1-` → `04.1-` (decimal phase prefixes)

3. **Frontmatter fields**:
   - `phase: 03` → `phase: 04`
   - `phase: 3` → `phase: 4`
   - `depends_on: [03-01]` → `depends_on: [04-01]`
   - `affects: [phase 03]` → `affects: [phase 04]`
   - `requires: [03-01]` → `requires: [04-01]`

4. **Prose references**:
   - `Phase 3` → `Phase 4`
   - `phase 3` → `phase 4`
   - `Phase 03` → `Phase 04`

5. **ROADMAP.md specific**:
   - `### Phase 03:` → `### Phase 04:`
   - `**Depends on:** Phase 3` → `**Depends on:** Phase 4`
   - Progress table rows
   - Plan lists

Process files in this order:
1. PLAN.md files (frontmatter + body)
2. SUMMARY.md files (frontmatter + body)
3. CONTEXT.md, RESEARCH.md, VERIFICATION.md, UAT.md files
4. ROADMAP.md
5. STATE.md
6. REQUIREMENTS.md (if exists)
</step>

<step name="create_new_phase">
Generate slug from description:

```bash
slug=$(echo "$description" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//;s/-$//')
```

Create the new phase directory:

```bash
new_phase=$((after_phase + 1))
phase_dir=".planning/phases/$(printf "%02d" $new_phase)-${slug}"
mkdir -p "$phase_dir"
```

Confirm: "Created directory: $phase_dir"
</step>

<step name="update_roadmap">
Insert the new phase entry into ROADMAP.md:

1. Find insertion point: after Phase {after_phase}'s content, before the (now renumbered) next phase
2. Insert new phase section:

   ```markdown
   ### Phase {new_phase}: {Description}

   **Goal:** [To be defined during planning]
   **Depends on:** Phase {after_phase}
   **Plans:** 0 plans

   Plans:
   - [ ] TBD (run /gsd:plan-phase {new_phase} to break down)

   **Details:**
   [To be added during planning]
   ```

3. Ensure all subsequent phase headings are already renumbered (from step 9)
4. Update progress table if it exists (add row for new phase)
5. Verify no duplicate phase numbers exist

Write updated ROADMAP.md.
</step>

<step name="update_state">
Update STATE.md:

1. **Update total phase count:**
   - `Phase: X of Y` → `Phase: X of Y+1`
   - If current position was >= new_phase, increment it too

2. **Recalculate progress percentage:**
   - Based on completed plans / new total

3. **Add roadmap evolution entry** under "## Accumulated Context" → "### Roadmap Evolution":
   ```
   - Phase {new_phase} inserted after Phase {after_phase}: {description}
   ```

   If "Roadmap Evolution" section doesn't exist, create it.

Write updated STATE.md.
</step>

<step name="update_requirements">
If `.planning/REQUIREMENTS.md` exists, update phase numbers in the requirements traceability table:

Search for phase references in the table and update them:
- `| 03 |` → `| 04 |`
- `| Phase 3 |` → `| Phase 4 |`

Only update phases that were renumbered (> after_phase).

Write updated REQUIREMENTS.md if changes were made.
</step>

<step name="completion">
Present completion summary (do NOT auto-commit):

```
Phase {new_phase} inserted: {description}

Changes made:
- Created: .planning/phases/{new_phase}-{slug}/
- Renumbered: {count} phases ({old_range} → {new_range})
- Updated: {file_count} files with phase references
- Modified: ROADMAP.md, STATE.md

Files changed (not yet committed):
  .planning/ROADMAP.md
  .planning/STATE.md
  .planning/phases/04-auth/ (was 03-auth/)
  .planning/phases/05-dashboard/ (was 04-dashboard/)
  [etc.]

---

## Next Up

**Phase {new_phase}: {description}** — newly inserted

`/gsd:discuss-phase {new_phase}` or `/gsd:plan-phase {new_phase}`

<sub>`/clear` first → fresh context window</sub>

---

When ready to commit:

git add .planning/ && git commit -m "feat: insert phase {new_phase} ({description})

Renumbered phases:
- Phase 3 → Phase 4
- Phase 3.1 → Phase 4.1
- Phase 4 → Phase 5

Updated {file_count} files"

---
```
</step>

</process>

<anti_patterns>

- Don't allow insertion after decimal phases (only integers)
- Don't skip the confirmation step
- Don't partially complete (all-or-nothing operation) - if failure occurs, user can `git checkout .planning/` to restore
- Don't modify completed phase content (only pending phases' numbers)
- Don't update git commit hashes/references (immutable history)
- Don't ask about each file individually - batch the operation
- Don't auto-commit changes (user decides when to commit, matching insert-phase behavior)
- Don't renumber if ANY completed phase would be affected
</anti_patterns>

<edge_cases>

**No subsequent phases to renumber:**
- Inserting after the last phase (functionally same as add-phase)
- Exit without making any changes
- Inform user: "No phases to renumber. Use `/gsd:add-phase {description}` to append a new phase at the end."

**Multiple decimal phases:**
- Renumber all decimals with their parent integer
- 3.1 → 4.1, 3.2 → 4.2, 3.3 → 4.3

**Insert after decimal phase:**
- ERROR: Must insert after integer phase
- Suggest using the parent integer instead

**Target phase doesn't exist:**
- ERROR with list of available phases
- Exit gracefully

**No ROADMAP.md:**
- ERROR: No project initialized
- Suggest running `/gsd:new-project` first

**Phase directory doesn't exist yet:**
- Phase may be in ROADMAP.md but directory not created until planning
- Only update ROADMAP.md references
- Skip directory operations for that phase

**Insert after phase 0:**
- Interpret as "insert new Phase 1 before current Phase 1"
- All existing phases get renumbered (1→2, 2→3, etc.)
- Apply same completion constraint: block if Phase 1 (or any phase) is completed
- Phase 0 doesn't need to exist in ROADMAP.md - it's a special value meaning "at the beginning"

</edge_cases>

<success_criteria>
Phase insertion is complete when:

- [ ] Arguments parsed and validated (integer phase, description provided)
- [ ] Target phase verified to exist in ROADMAP.md
- [ ] Completion constraint checked (no completed phases after target)
- [ ] User confirmed the operation after seeing preview
- [ ] All subsequent phase directories renamed (descending order)
- [ ] All files inside directories renamed with new phase numbers
- [ ] All file contents updated with new phase references
- [ ] New phase directory created
- [ ] ROADMAP.md updated (new entry inserted, subsequent entries renumbered)
- [ ] STATE.md updated (phase count, position if affected, evolution note)
- [ ] REQUIREMENTS.md updated if it exists
- [ ] No gaps in phase numbering
- [ ] User informed of changes and provided commit command
</success_criteria>
