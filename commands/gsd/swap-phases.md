---
name: gsd:swap-phases
description: Swap two phases to change priority ordering while respecting dependencies
argument-hint: <phase1> <phase2>
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
---

<objective>
Reorder phases to prioritize one phase over another, while maintaining all dependency constraints and minimizing the number of phase movements.

When the user runs `/gsd:swap-phases 2 4`, they are requesting **priority inversion**:
- "I want Phase 4 content to come BEFORE Phase 2 content"
- The exact final positions depend on dependency constraints
- This is NOT a simple position exchange

Purpose: Enable priority-based reordering with dependency awareness when project priorities shift.
Output: Phases reordered, all references updated, user informed of changes (no auto-commit).
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
- First argument: integer phase number (phase1)
- Second argument: integer phase number (phase2)

Example: `/gsd:swap-phases 2 4`
→ phase1 = 2
→ phase2 = 4
→ Goal: Phase 4 content should come BEFORE Phase 2 content

Validation:

```bash
if [ $# -ne 2 ]; then
  echo "ERROR: Two phase numbers required"
  echo "Usage: /gsd:swap-phases <phase1> <phase2>"
  echo "Example: /gsd:swap-phases 2 4"
  echo ""
  echo "This command reorders phases so that Phase 2 content comes BEFORE Phase 1 content."
  exit 1
fi

phase1=$1
phase2=$2

# Validate both are integers
if ! [[ "$phase1" =~ ^[0-9]+$ ]]; then
  echo "ERROR: First argument must be an integer phase number (got: $phase1)"
  echo "Decimal phases (like 2.1) cannot be swapped directly - they move with their parent integer phase."
  exit 1
fi

if ! [[ "$phase2" =~ ^[0-9]+$ ]]; then
  echo "ERROR: Second argument must be an integer phase number (got: $phase2)"
  echo "Decimal phases (like 2.1) cannot be swapped directly - they move with their parent integer phase."
  exit 1
fi

# Validate different phases
if [ "$phase1" -eq "$phase2" ]; then
  echo "ERROR: Cannot swap a phase with itself"
  exit 1
fi
```

</step>

<step name="load_state">
Load project state:

```bash
if [ ! -f .planning/ROADMAP.md ]; then
  echo "ERROR: No roadmap found (.planning/ROADMAP.md)"
  echo "Initialize a project first with /gsd:new-project"
  exit 1
fi

if [ ! -f .planning/STATE.md ]; then
  echo "ERROR: No state file found (.planning/STATE.md)"
  exit 1
fi
```

Read both files:
- ROADMAP.md: parse all phase headings, dependencies, and structure
- STATE.md: parse current position and total phase count

Build a list of all phases with:
- Phase number (integer and decimal)
- Phase name/description
- Dependencies (list of phase numbers)
- Completion status (has SUMMARY.md files)
</step>

<step name="validate_phases_exist">
Verify both target phases exist in the roadmap:

Search for `### Phase {phase}:` headings (with zero-padded or non-padded format):

```bash
# Check for Phase N in various formats
grep -qE "^###\s+Phase\s+0?${phase1}:" .planning/ROADMAP.md || {
  echo "ERROR: Phase ${phase1} not found in roadmap"
  echo ""
  echo "Available phases:"
  grep -oE "^###\s+Phase\s+[0-9]+(\.[0-9]+)?:" .planning/ROADMAP.md | sed 's/.*Phase /  - Phase /' | sed 's/:$//'
  exit 1
}

grep -qE "^###\s+Phase\s+0?${phase2}:" .planning/ROADMAP.md || {
  echo "ERROR: Phase ${phase2} not found in roadmap"
  echo ""
  echo "Available phases:"
  grep -oE "^###\s+Phase\s+[0-9]+(\.[0-9]+)?:" .planning/ROADMAP.md | sed 's/.*Phase /  - Phase /' | sed 's/:$//'
  exit 1
}
```

</step>

<step name="build_dependency_graph">
Parse ROADMAP.md to build a dependency graph:

1. Extract all phases with their `**Depends on**:` fields (case-insensitive search for "depends on")
2. Build a directed graph where edges represent "depends on" relationships
3. Normalize decimal dependencies to integer parents (e.g., "Phase 2.1" → Phase 2)

Dependency parsing patterns:
- `**Depends on**: Phase 2` → depends on [2]
- `**Depends on**: Phase 2, Phase 4` → depends on [2, 4]
- `**Depends on**: Nothing` or `**Depends on**: None` → depends on []
- No dependency field → depends on []

For each phase, store:
- `phase_number`: integer phase number
- `phase_name`: description from heading
- `depends_on`: list of integer phase numbers this phase depends on
- `dependents`: list of phases that depend on this phase (computed)

Build the graph both ways:
- Forward: phase → list of phases it depends on
- Reverse: phase → list of phases that depend on it (dependents)
</step>

<step name="check_transitive_dependency">
Check if phase2 transitively depends on phase1. If so, the swap is impossible.

Use BFS/DFS to traverse the dependency graph starting from phase2:

```
function has_transitive_dependency(from_phase, to_phase, graph):
    visited = set()
    queue = [from_phase]
    path = {}  # track path for error message

    while queue not empty:
        current = queue.pop()
        if current == to_phase:
            return True, reconstruct_path(path, from_phase, to_phase)

        for dep in graph[current].depends_on:
            if dep not in visited:
                visited.add(dep)
                queue.append(dep)
                path[dep] = current

    return False, []
```

If phase2 transitively depends on phase1:

```
ERROR: Cannot swap Phase {phase1} and Phase {phase2}

Phase {phase2} ({name}) has a transitive dependency on Phase {phase1} ({name}):
  Phase {phase2} → depends on → Phase {X} → depends on → Phase {phase1}

No valid reordering exists where Phase {phase2} comes before Phase {phase1}.
```

Exit.
</step>

<step name="identify_completion_status">
Identify which phases are completed by checking for SUMMARY.md files:

```bash
# Check if phase has any completed plans
is_completed() {
  local phase=$1
  # Check for SUMMARY.md files in phase directory
  ls .planning/phases/${phase}-*/*-SUMMARY.md 2>/dev/null | head -1 > /dev/null
  return $?
}
```

For each integer phase, store whether it's completed.

Also check decimal phases - they share completion status with their parent integer:
- If 2.1 has SUMMARY.md, phase 2 group is partially completed
- For swap purposes, if ANY decimal under an integer has SUMMARY.md, the integer is "completed"
</step>

<step name="compute_valid_reorderings">
Use a greedy algorithm to find valid reorderings where:
1. Phase2 comes before Phase1 (priority inversion achieved)
2. All dependency constraints satisfied (no phase comes before its dependencies)
3. No completed phases change position
4. Maximum 5 integer phases moved

**Greedy Algorithm:**

The goal is to move phase2 and its required predecessors before phase1, while keeping phase1 and its required successors after.

1. Identify the "phase2 group": phase2 plus all phases that phase2 depends on (transitively)
2. Identify the "phase1 group": phase1 plus all phases that depend on phase1 (transitively)
3. Find phases that must stay in place:
   - Completed phases
   - Phases not involved in either group (minimize disruption)

4. Generate candidate orderings:
   - Take current order
   - Move phase2 group to be contiguous and before phase1 group
   - Preserve relative order within each group
   - Ensure dependencies are satisfied

5. Validate each candidate:
   - Check all dependency constraints (every phase comes after its dependencies)
   - Check no completed phase moved from its original position
   - Count number of phases that changed position

6. Filter and sort:
   - Remove candidates exceeding 5 moves
   - Sort by number of moves (ascending)
   - Keep top 3 solutions

If no valid solutions found:
- If blocked by completed phase: explain which completed phase would need to move
- If blocked by move limit: explain count and suggest alternatives
</step>

<step name="handle_no_solutions">
If no valid reorderings exist, report the reason:

**Blocked by completed phase:**
```
ERROR: Cannot complete swap of Phase {phase1} and Phase {phase2}

A valid reordering would require moving Phase {N} ({name}),
but Phase {N} is completed and cannot be renumbered.

Completed phases cannot be moved because:
- Git commit history references these phase numbers
- Renumbering would make historical commits inaccurate

Options:
1. Complete the blocking phases first, then restructure
2. Consider if the swap is still necessary
```

**Blocked by move limit:**
```
ERROR: Swap requires too many phase movements

Reordering Phase {phase1} and Phase {phase2} would require moving {count} phases,
which exceeds the limit of 5.

Consider:
1. Breaking the change into smaller swaps
2. Manual reorganization of the roadmap
3. Using /gsd:insert-new-phase for incremental changes
```

Exit.
</step>

<step name="show_confirmation">
Present the operation based on number of solutions:

**Single solution:**
```
Swap request: Prioritize Phase {phase2} ({name}) over Phase {phase1} ({name})

Proposed reordering ({N} phases moved):

  Phase 1: Foundation (unchanged)
  Phase 2: UI (was Phase 4) ← PRIORITIZED
  Phase 3: Polish (was Phase 5)
  Phase 4: Auth (was Phase 2) ← DEPRIORITIZED
  Phase 5: API (was Phase 3)
    └─ Dependency updated: Phase 4 (was Phase 2)

Decimal phases moving with parents:
  - Phase 2.1 → Phase 4.1

Proceed? (y/n)
```

**Multiple solutions (up to 3):**
```
Swap request: Prioritize Phase {phase2} ({name}) over Phase {phase1} ({name})

Found {N} valid reorderings:

Option A ({N} phases moved):
  Phase 1: Foundation (unchanged)
  Phase 2: Metrics (was 4) ← PRIORITIZED
  Phase 3: Logging (unchanged)
  Phase 4: Auth (was 2) ← DEPRIORITIZED
  Phase 5: API (was 5)
    └─ Dependency updated: Phase 4

Option B ({M} phases moved):
  Phase 1: Foundation (unchanged)
  Phase 2: Metrics (was 4) ← PRIORITIZED
  Phase 3: Auth (was 2) ← DEPRIORITIZED
  Phase 4: API (was 5)
  Phase 5: Logging (was 3)
    └─ Dependency updated: Phase 3

Select option (A/B/C) or cancel (x):
```

Wait for user selection before proceeding. If user cancels, exit gracefully.
</step>

<step name="gather_affected_phases">
Based on selected solution, collect all phases that need renumbering:

1. List all integer phases that change position
2. List all decimal phases under each moving integer (they move as a unit)
3. Calculate the mapping: old_number → new_number for each phase
4. Identify all dependencies that need updating

Store:
- List of (old_number, new_number, name) for each moving phase
- List of decimal phases moving with their parents
- Count of directories to rename
- Count of files to rename
- List of dependency updates needed
</step>

<step name="renumber_directories">
Rename all affected phase directories using a safe two-pass approach to avoid conflicts:

**Pass 1: Rename to temporary names**
```bash
# Example: swapping phases 2 and 4
mv ".planning/phases/02-auth" ".planning/phases/tmp-02-auth"
mv ".planning/phases/02.1-hotfix" ".planning/phases/tmp-02.1-hotfix"
mv ".planning/phases/03-api" ".planning/phases/tmp-03-api"
mv ".planning/phases/04-ui" ".planning/phases/tmp-04-ui"
```

**Pass 2: Rename to final names**
```bash
mv ".planning/phases/tmp-04-ui" ".planning/phases/02-ui"
mv ".planning/phases/tmp-02-auth" ".planning/phases/04-auth"
mv ".planning/phases/tmp-02.1-hotfix" ".planning/phases/04.1-hotfix"
mv ".planning/phases/tmp-03-api" ".planning/phases/05-api"
```

Handle both:
- Integer phases: `02-slug` → `04-slug`
- Decimal phases: `02.1-slug` → `04.1-slug`

Use zero-padded format for single-digit phases (01, 02, ..., 09).
</step>

<step name="rename_files_in_directories">
For each renamed directory, rename files containing the phase number:

```bash
# Inside 04-auth (was 02-auth):
mv "02-01-PLAN.md" "04-01-PLAN.md"
mv "02-02-PLAN.md" "04-02-PLAN.md"
mv "02-01-SUMMARY.md" "04-01-SUMMARY.md"  # if exists
mv "02-CONTEXT.md" "04-CONTEXT.md"        # if exists
mv "02-RESEARCH.md" "04-RESEARCH.md"      # if exists
mv "02-VERIFICATION.md" "04-VERIFICATION.md"  # if exists
mv "02-UAT.md" "04-UAT.md"                # if exists
```

Also handle decimal phase files:
```bash
# Inside 04.1-hotfix (was 02.1-hotfix):
mv "02.1-01-PLAN.md" "04.1-01-PLAN.md"
```

Files without phase prefixes don't need renaming.
</step>

<step name="update_file_contents">
Update phase references inside all `.planning/` files. Process from highest old phase number to lowest to avoid double-replacement issues.

**Patterns to update (in order of specificity):**

1. **Plan/file references** (most specific first):
   - `02-01` → `04-01` (phase-plan references)
   - `02.1-01` → `04.1-01` (decimal phase-plan references)

2. **Phase directory/file prefixes**:
   - `02-` → `04-` (at start of filenames in references)
   - `02.1-` → `04.1-` (decimal phase prefixes)

3. **Frontmatter fields**:
   - `phase: 02` → `phase: 04`
   - `phase: 2` → `phase: 4`
   - `depends_on: [02-01]` → `depends_on: [04-01]`

4. **Prose references**:
   - `Phase 2` → `Phase 4`
   - `phase 2` → `phase 4`
   - `Phase 02` → `Phase 04`

5. **ROADMAP.md specific**:
   - `### Phase 02:` → `### Phase 04:`
   - `### Phase 2:` → `### Phase 4:`
   - Dependency lines (handled in next step)

Process files in this order:
1. PLAN.md files (frontmatter + body)
2. SUMMARY.md files (frontmatter + body)
3. CONTEXT.md, RESEARCH.md, VERIFICATION.md, UAT.md files
4. ROADMAP.md (phase headings and references)
5. STATE.md
6. REQUIREMENTS.md (if exists)
</step>

<step name="update_dependencies">
Update `**Depends on**:` lines in ROADMAP.md:

For each phase whose dependencies reference a moved phase:
- Find the `**Depends on**:` line
- Update phase numbers according to the mapping

Example:
```
Before: **Depends on**: Phase 2
After:  **Depends on**: Phase 4

Before: **Depends on**: Phase 2, Phase 3
After:  **Depends on**: Phase 4, Phase 5
```

Also update any multi-dependency phases:
```
Before: **Depends on**: Phase 1, Phase 3
After:  **Depends on**: Phase 1, Phase 5  (if 3→5)
```

Preserve the exact formatting (bold markers, spacing).
</step>

<step name="reorder_roadmap_sections">
Reorder the phase sections in ROADMAP.md to match the new phase numbers:

1. Parse ROADMAP.md into sections (each `### Phase N:` starts a section)
2. Reorder sections according to new phase numbers
3. Ensure sections appear in ascending numeric order
4. Preserve the phase overview list at the top (update it too)

The phase overview list (if present):
```
Before:
- [ ] **Phase 2: Auth** - Authentication system
- [ ] **Phase 3: API** - API layer
- [ ] **Phase 4: UI** - User interface

After:
- [ ] **Phase 2: UI** - User interface
- [ ] **Phase 3: Polish** - Final polish
- [ ] **Phase 4: Auth** - Authentication system
- [ ] **Phase 5: API** - API layer
```
</step>

<step name="update_state">
Update STATE.md:

1. **Update current position** (if current phase was affected):
   - If current phase was renumbered, update the position
   - `Phase: X of Y` → update X if needed (Y stays same - no phases added/removed)

2. **Add roadmap evolution entry** under "## Accumulated Context" → "### Roadmap Evolution":
   ```
   - Phases reordered: Prioritized Phase {new_phase2} ({name}) over Phase {new_phase1} ({name})
   ```

   If "Roadmap Evolution" section doesn't exist, create it.

Write updated STATE.md.
</step>

<step name="update_requirements">
If `.planning/REQUIREMENTS.md` exists, update phase numbers in the requirements traceability table:

Search for phase references in the table and update them according to the mapping:
- `| 02 |` → `| 04 |`
- `| Phase 2 |` → `| Phase 4 |`

Only update phases that were moved.

Write updated REQUIREMENTS.md if changes were made.
</step>

<step name="completion">
Present completion summary (do NOT auto-commit):

```
Phases reordered: Prioritized Phase {new_phase2} over Phase {new_phase1}

Changes made:
- Moved: {count} phases
- Renamed: {dir_count} directories, {file_count} files
- Updated: {content_count} files with phase references
- Dependencies updated: {dep_count} phases

New phase order:
  Phase 1: Foundation (unchanged)
  Phase 2: UI (was Phase 4)
  Phase 3: Polish (was Phase 5)
  Phase 4: Auth (was Phase 2)
  Phase 5: API (was Phase 3)

Files changed (not yet committed):
  .planning/ROADMAP.md
  .planning/STATE.md
  .planning/phases/02-ui/ (was 04-ui/)
  .planning/phases/03-polish/ (was 05-polish/)
  .planning/phases/04-auth/ (was 02-auth/)
  .planning/phases/05-api/ (was 03-api/)

---

When ready to commit:

git add .planning/ && git commit -m "refactor: reorder phases (prioritize {name2} over {name1})

Phase changes:
- Phase 2: UI (was Phase 4)
- Phase 3: Polish (was Phase 5)
- Phase 4: Auth (was Phase 2)
- Phase 5: API (was Phase 3)

Dependencies updated accordingly."

---
```
</step>

</process>

<anti_patterns>

- Don't allow decimal phases as arguments (only integers) - decimals move with their parent
- Don't skip the confirmation step - show preview first
- Don't partially complete (all-or-nothing operation) - if failure occurs, user can `git checkout .planning/` to restore
- Don't move completed phases - block the operation instead
- Don't exceed the 5-phase move limit without blocking
- Don't auto-commit changes (user decides when to commit)
- Don't silently pick a solution when multiple valid reorderings exist - let user choose
- Don't ignore dependency constraints - validate before executing
- Don't update git commit hashes/references (immutable history)
- Don't ask about each file individually - batch the operation
</anti_patterns>

<edge_cases>

**Same phase twice:**
- ERROR: Cannot swap a phase with itself
- Exit immediately

**Phase doesn't exist:**
- ERROR with list of available phases from ROADMAP.md
- Exit gracefully

**Decimal phase as argument:**
- ERROR: Must specify integer phases
- Explain that decimal phases move with their parent integer
- Example: "To reorder Phase 2.1, swap Phase 2 instead"

**Transitive dependency:**
- ERROR with full dependency chain explanation
- Show the path: Phase 4 → Phase 3 → Phase 2
- Explain that no valid reordering exists

**Completed phase must move:**
- ERROR explaining which specific phase blocks the operation
- Suggest alternatives (complete blocking phases first, or reconsider)

**Both phases completed:**
- ERROR: Both phases are completed and cannot be moved
- Completed phases' positions are frozen

**No ROADMAP.md:**
- ERROR: No project initialized
- Suggest running `/gsd:new-project` first

**Move limit exceeded:**
- ERROR with count of required moves
- Suggest breaking into smaller swaps or manual reorganization

**No dependencies defined:**
- Treat all phases as freely movable relative to each other
- Only constraint: phase2 must come before phase1

**Adjacent phases with no dependencies:**
- Simple swap (2 moves)
- Fastest path

**Phase has decimal children:**
- Decimals move with their parent integer as a unit
- 2.1, 2.2 become 4.1, 4.2 when phase 2 becomes phase 4

**Circular dependency (data corruption):**
- ERROR: Circular dependency detected in roadmap
- List the cycle
- Suggest manual repair of ROADMAP.md

**Phase directory doesn't exist yet:**
- Phase may be in ROADMAP.md but directory not created until planning
- Only update ROADMAP.md references
- Skip directory operations for that phase

</edge_cases>

<success_criteria>
Phase swap is complete when:

- [ ] Arguments parsed and validated (two different integer phases)
- [ ] Both phases verified to exist in ROADMAP.md
- [ ] Dependency graph built from ROADMAP.md (case-insensitive parsing)
- [ ] Transitive dependency check passed (swap is possible)
- [ ] Completion status identified for all phases
- [ ] Valid reorderings computed (≤5 moves, no completed phase moves)
- [ ] User selected option (if multiple) or confirmed (if single)
- [ ] All affected phase directories renamed (via temp names)
- [ ] All files inside directories renamed with new phase numbers
- [ ] All file contents updated with new phase references
- [ ] Dependency references updated in ROADMAP.md
- [ ] Phase sections reordered in ROADMAP.md
- [ ] STATE.md updated (position if affected, evolution note)
- [ ] REQUIREMENTS.md updated if it exists
- [ ] No gaps in phase numbering
- [ ] User informed of changes and provided commit command
</success_criteria>
