# Feature Plan: `gsd:swap-phases`

## Overview

Add a new command `/gsd:swap-phases <phase1> <phase2>` that reorders phases to prioritize one phase over another, while maintaining all dependency constraints and minimizing the number of phase movements.

**Motivation:** During project planning, priorities often shift. A phase originally planned for later may become more urgent, or the logical sequence may need adjustment for better semantic flow. The current phase commands (`add-phase`, `insert-phase`, `remove-phase`, `insert-new-phase`) don't support reordering existing phases based on priority. This command enables priority-based reordering with dependency awareness.

---

## Requirements Summary

| Requirement | Details |
|-------------|---------|
| **Command name** | `gsd:swap-phases` |
| **Arguments** | `<phase1> <phase2>` (two integer phase numbers) |
| **Semantics** | Priority inversion: Phase2 content comes BEFORE Phase1 content |
| **Dependency source** | `**Depends on:**` field in ROADMAP.md only |
| **Decimal phase handling** | Move with parent integer phase as a unit |
| **Completion constraint** | Block if any completed phase would need to move |
| **Move limit** | Maximum 5 integer phases moved; abort if more required |
| **Multiple solutions** | Show all valid options, let user choose |
| **Confirmation** | Show reordering plan, require user confirmation |
| **Git behavior** | Do NOT auto-commit (matches insert-new-phase behavior) |

---

## Core Algorithm

### Semantics of "Swap"

When the user runs `/gsd:swap-phases 2 4`, they are requesting **priority inversion**:
- "I want Phase 4 content to come BEFORE Phase 2 content"
- The exact final positions depend on dependency constraints
- This is NOT a simple position exchange

### Algorithm Steps

1. **Parse arguments**: Extract two integer phase numbers
2. **Build dependency graph**: Parse `**Depends on:**` from ROADMAP.md for all phases
3. **Normalize decimal dependencies**: Treat `depends on 5.1` as `depends on 5`
4. **Check completion status**: Identify which phases are completed (have SUMMARY.md)
5. **Compute valid reorderings**: Find all arrangements where:
   - Phase2 comes before Phase1 (priority inversion achieved)
   - All dependency constraints satisfied (no phase comes before its dependencies)
   - No completed phases change position
   - Maximum 5 integer phases moved
6. **Handle results**:
   - No valid solution → Error with explanation
   - One solution → Show preview, ask confirmation
   - Multiple solutions → Show options with move counts, let user choose
7. **Execute reordering**: Rename directories, files, update contents
8. **Update dependencies**: Fix `**Depends on:**` references in affected phases
9. **Report completion**: Summary of changes, no auto-commit

---

## Dependency Handling

### Dependency Graph Construction

Read ROADMAP.md and extract dependency information:

```markdown
### Phase 3: API Layer
**Depends on**: Phase 2
```

Build a directed graph where edges represent "depends on" relationships.

### Transitive Dependency Detection

If Phase A transitively depends on Phase B (through a chain), then Phase A can NEVER come before Phase B.

```
Phase 4 → depends on → Phase 3 → depends on → Phase 2

Result: Phase 4 cannot be prioritized over Phase 2 (transitive dependency)
```

### Multi-Dependency Phases

Phases may depend on multiple phases:

```markdown
### Phase 5: Integration
**Depends on**: Phase 2, Phase 4
```

After reordering, update all dependency references to new phase numbers.

### Phases with No Dependencies

Phases with `**Depends on**: None` or no dependency field are freely movable (no constraints on their position relative to other phases, except their own dependents).

---

## Validation Rules

### Completion Constraint

A phase is "completed" if any `*-SUMMARY.md` files exist in its directory:

```bash
ls .planning/phases/{phase}-*/*-SUMMARY.md 2>/dev/null
```

**Rule:** The algorithm must find a reordering where completed phases DON'T move. If no such reordering exists, block the operation.

### Impossible Reorderings

Block when transitive dependency prevents the requested priority inversion:

```
ERROR: Cannot swap Phase 2 and Phase 4

Phase 4 (UI) has a transitive dependency on Phase 2 (Auth):
  Phase 4 → depends on → Phase 3 → depends on → Phase 2

No valid reordering exists where Phase 4 comes before Phase 2.
```

### Completed Phase Blocking

Block when a completed phase would need to move:

```
ERROR: Cannot complete swap of Phase 2 and Phase 4

A valid reordering would require moving Phase 3 (API),
but Phase 3 is completed and cannot be renumbered.

Completed phases cannot be moved because:
- Git commit history references these phase numbers
- Renumbering would make historical commits inaccurate
```

### Move Limit Exceeded

Block when more than 5 integer phases would need to move:

```
ERROR: Swap requires too many phase movements

Reordering Phase 2 and Phase 7 would require moving 8 phases,
which exceeds the limit of 5.

Consider:
1. Breaking the change into smaller swaps
2. Manual reorganization of the roadmap
3. Using /gsd:insert-new-phase for incremental changes
```

---

## Example Scenarios

### Scenario 1: Simple Swap (Independent Phases)

**Original:**
```
Phase 1: Foundation (no deps)
Phase 2: Auth (depends on 1)
Phase 3: Logging (depends on 1) ← NOT dependent on Phase 2
Phase 4: API (depends on 2)
```

**Request:** `swap-phases 2 3` (prioritize Logging over Auth)

**Result:**
```
Phase 1: Foundation (unchanged)
Phase 2: Logging (was 3)
Phase 3: Auth (was 2)
Phase 4: API (depends on 3) ← dependency updated
```

**Moves:** 2 phases moved

---

### Scenario 2: Cascade Required

**Original:**
```
Phase 1: Foundation (no deps)
Phase 2: Auth (depends on 1)
Phase 3: API (depends on 2) ← hard dep on Auth
Phase 4: UI (depends on 1) ← no dep on Auth/API
Phase 5: Polish (depends on 1) ← no dep on swapped phases
```

**Request:** `swap-phases 2 4` (prioritize UI over Auth)

**Algorithm thinking:**
1. Goal: Phase 4 (UI) must come before Phase 2 (Auth)
2. Phase 3 (API) depends on Phase 2 (Auth), so must follow Auth
3. Phase 4 and Phase 5 have no deps on Auth/API, freely movable

**Result:**
```
Phase 1: Foundation (unchanged)
Phase 2: UI (was 4)
Phase 3: Polish (was 5)
Phase 4: Auth (was 2)
Phase 5: API (was 3, depends on 4) ← follows Auth
```

**Moves:** 4 phases moved

---

### Scenario 3: Multiple Valid Solutions

**Original:**
```
Phase 1: Foundation
Phase 2: Auth (depends on 1)
Phase 3: Logging (depends on 1)
Phase 4: Metrics (depends on 1)
Phase 5: API (depends on 2)
```

**Request:** `swap-phases 2 4` (prioritize Metrics over Auth)

**Option A (3 moves):**
```
Phase 1: Foundation
Phase 2: Metrics (was 4)
Phase 3: Logging (unchanged)
Phase 4: Auth (was 2)
Phase 5: API (was 5, depends on 4)
```

**Option B (3 moves):**
```
Phase 1: Foundation
Phase 2: Metrics (was 4)
Phase 3: Auth (was 2)
Phase 4: Logging (was 3)
Phase 5: API (depends on 3)
```

User chooses preferred option.

---

### Scenario 4: Blocked by Transitive Dependency

**Original:**
```
Phase 1: Foundation
Phase 2: Auth (depends on 1)
Phase 3: API (depends on 2)
Phase 4: UI (depends on 3)
Phase 5: Polish (depends on 4)
```

**Request:** `swap-phases 2 4` (prioritize UI over Auth)

**Result:** BLOCKED

Phase 4 transitively depends on Phase 2:
```
Phase 4 → Phase 3 → Phase 2
```

No valid reordering exists.

---

### Scenario 5: Completed Phase Stays Put

**Original:**
```
Phase 1: Foundation
Phase 2: Auth (depends on 1, incomplete)
Phase 3: Logging (depends on 1, COMPLETED)
Phase 4: API (depends on 1, incomplete)
```

**Request:** `swap-phases 2 4` (prioritize API over Auth)

**Result:**
```
Phase 1: Foundation (unchanged)
Phase 2: API (was 4)
Phase 3: Logging (COMPLETED, unchanged) ← didn't need to move
Phase 4: Auth (was 2)
```

**Moves:** 2 phases moved (completed phase untouched)

---

## Decimal Phase Handling

### Decimals Move with Parent

Decimal phases (e.g., 2.1, 2.2) are "attached" to their integer parent and move as a unit.

**Original:**
```
Phase 2: Auth
Phase 2.1: Auth Hotfix (inserted)
Phase 2.2: Auth Patch (inserted)
Phase 3: API (depends on 1)
```

**Request:** `swap-phases 2 3` (prioritize API over Auth)

**Result:**
```
Phase 2: API (was 3)
Phase 3: Auth (was 2)
Phase 3.1: Auth Hotfix (was 2.1)
Phase 3.2: Auth Patch (was 2.2)
```

### Decimal Dependencies Normalized

When parsing dependencies, treat decimal references as their integer parent:

```markdown
**Depends on**: Phase 2.1
```

Interpreted as: `Depends on: Phase 2`

---

## Confirmation Flow

### Single Solution

```
Swap request: Prioritize Phase 4 (UI) over Phase 2 (Auth)

Proposed reordering (3 phases moved):

  Phase 1: Foundation (unchanged)
  Phase 2: UI (was Phase 4)
  Phase 3: Polish (was Phase 5)
  Phase 4: Auth (was Phase 2)
  Phase 5: API (was Phase 3)
    └─ Dependency updated: Phase 4 (was Phase 2)

Decimal phases moving with parents:
  - Phase 2.1 → Phase 4.1

Proceed? (y/n)
```

### Multiple Solutions

```
Swap request: Prioritize Phase 4 (Metrics) over Phase 2 (Auth)

Found 2 valid reorderings:

Option A (3 phases moved):
  Phase 1: Foundation (unchanged)
  Phase 2: Metrics (was 4)
  Phase 3: Logging (unchanged)
  Phase 4: Auth (was 2)
  Phase 5: API (was 5)
    └─ Dependency updated: Phase 4

Option B (4 phases moved):
  Phase 1: Foundation (unchanged)
  Phase 2: Metrics (was 4)
  Phase 3: Auth (was 2)
  Phase 4: API (was 5)
  Phase 5: Logging (was 3)
    └─ Dependency updated: Phase 3

Select option (A/B) or cancel (c):
```

---

## Files Updated During Reordering

| File/Location | Updates Required |
|---------------|------------------|
| **Phase directories** | `03-slug/` → `04-slug/` (for each moved phase) |
| **Plan files** | `03-01-PLAN.md` → `04-01-PLAN.md` |
| **Summary files** | `03-01-SUMMARY.md` → `04-01-SUMMARY.md` |
| **Context files** | `03-CONTEXT.md` → `04-CONTEXT.md` |
| **Research files** | `03-RESEARCH.md` → `04-RESEARCH.md` |
| **Verification files** | `03-VERIFICATION.md` → `04-VERIFICATION.md` |
| **UAT files** | `03-UAT.md` → `04-UAT.md` |
| **Decimal directories** | `03.1-slug/` → `04.1-slug/` |
| **Decimal files** | `03.1-01-PLAN.md` → `04.1-01-PLAN.md` |
| **ROADMAP.md** | Phase headings, `**Depends on:**` lines, plan lists |
| **STATE.md** | Current position (if affected), roadmap evolution entry |
| **REQUIREMENTS.md** | Phase column in traceability table (if exists) |
| **File contents** | Phase references in frontmatter and prose |

---

## Command Implementation Steps

### Step 1: Parse Arguments

```bash
if [ $# -ne 2 ]; then
  echo "ERROR: Two phase numbers required"
  echo "Usage: /gsd:swap-phases <phase1> <phase2>"
  echo "Example: /gsd:swap-phases 2 4"
  exit 1
fi

phase1=$1
phase2=$2

# Validate both are integers
if ! [[ "$phase1" =~ ^[0-9]+$ ]] || ! [[ "$phase2" =~ ^[0-9]+$ ]]; then
  echo "ERROR: Both arguments must be integer phase numbers"
  exit 1
fi

# Validate different phases
if [ "$phase1" -eq "$phase2" ]; then
  echo "ERROR: Cannot swap a phase with itself"
  exit 1
fi
```

### Step 2: Load State and Build Dependency Graph

- Read ROADMAP.md
- Extract all phases with their `**Depends on:**` fields
- Build directed dependency graph
- Normalize decimal dependencies to integer parents
- Identify completed phases (check for SUMMARY.md files)

### Step 3: Validate Phases Exist

```
ERROR: Phase {X} not found in roadmap
Available phases: 1, 2, 3, 4, 5
```

### Step 4: Check Transitive Dependencies

If phase2 transitively depends on phase1, the swap is impossible:

```
ERROR: Cannot swap Phase {phase1} and Phase {phase2}

Phase {phase2} ({name}) has a transitive dependency on Phase {phase1} ({name}):
  Phase {phase2} → depends on → Phase {X} → depends on → Phase {phase1}

No valid reordering exists where Phase {phase2} comes before Phase {phase1}.
```

### Step 5: Compute Valid Reorderings

Algorithm:
1. Generate candidate orderings where phase2 comes before phase1
2. Filter to those satisfying all dependency constraints
3. Filter to those where no completed phase moves
4. Filter to those with ≤5 integer phases moved
5. Sort by number of moves (ascending)

### Step 6: Handle Results

**No valid solution:**
- Report why (transitive dependency, completed phase blocking, move limit exceeded)

**One solution:**
- Show preview, ask for confirmation

**Multiple solutions:**
- Show all options with move counts
- Let user select (A/B/C/...) or cancel

### Step 7: Execute Reordering

Process directory renames carefully to avoid conflicts:
1. Rename to temporary names first (e.g., `03-slug` → `tmp-03-slug`)
2. Then rename to final names (e.g., `tmp-03-slug` → `04-slug`)

Or process in correct order based on the specific reordering.

### Step 8: Rename Files Inside Directories

For each renamed directory:
```bash
mv "03-01-PLAN.md" "04-01-PLAN.md"
mv "03-CONTEXT.md" "04-CONTEXT.md"
# etc.
```

### Step 9: Update File Contents

Update phase references in all planning files:

**Frontmatter:**
- `phase: 03` → `phase: 04`
- `depends_on: [03-01]` → `depends_on: [04-01]`

**ROADMAP.md:**
- `### Phase 03:` → `### Phase 04:`
- `**Depends on**: Phase 2` → `**Depends on**: Phase 4`

**Prose:**
- "Phase 3" → "Phase 4"
- "phase 3" → "phase 4"

### Step 10: Update STATE.md

- Update current position if affected
- Add roadmap evolution entry:
  ```
  - Phases reordered: Phase 2 ↔ Phase 4 (priority swap)
  ```

### Step 11: Update REQUIREMENTS.md (if exists)

Update phase numbers in requirements traceability table.

### Step 12: Completion Summary

```
Phases reordered: Prioritized Phase 4 over Phase 2

Changes made:
- Moved: 3 phases
- Renamed: 4 directories, 12 files
- Updated: 18 files with phase references
- Dependencies updated: 2 phases

New phase order:
  Phase 1: Foundation
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

When ready to commit:

git add .planning/ && git commit -m "refactor: reorder phases (prioritize UI over Auth)

Phase changes:
- Phase 2: UI (was Phase 4)
- Phase 3: Polish (was Phase 5)
- Phase 4: Auth (was Phase 2)
- Phase 5: API (was Phase 3)

Dependencies updated accordingly."
```

---

## Edge Cases

| Case | Handling |
|------|----------|
| **Same phase twice** | ERROR: Cannot swap a phase with itself |
| **Phase doesn't exist** | ERROR with list of available phases |
| **Decimal phase as argument** | ERROR: Must specify integer phases |
| **Transitive dependency** | ERROR with dependency chain explanation |
| **Completed phase must move** | ERROR explaining which phase blocks |
| **Both phases completed** | ERROR: Both phases are completed |
| **No ROADMAP.md** | ERROR: No project initialized |
| **Move limit exceeded** | ERROR suggesting alternatives |
| **No dependencies defined** | Treat all phases as freely movable |
| **Adjacent phases, no deps** | Simple swap (2 moves) |
| **Phase has decimal children** | Decimals move with parent |

---

## Anti-Patterns

- Don't allow decimal phases as arguments (only integers)
- Don't skip the confirmation step
- Don't partially complete (all-or-nothing operation)
- Don't move completed phases
- Don't exceed the 5-phase move limit without blocking
- Don't auto-commit changes (user decides when to commit)
- Don't silently pick a solution when multiple exist (let user choose)
- Don't ignore dependency constraints
- Don't update git commit hashes/references (immutable history)

---

## Success Criteria

Phase swap is complete when:

- [ ] Arguments parsed and validated (two different integer phases)
- [ ] Both phases verified to exist in ROADMAP.md
- [ ] Dependency graph built from ROADMAP.md
- [ ] Transitive dependency check passed (swap is possible)
- [ ] Valid reorderings computed (≤5 moves, no completed phase moves)
- [ ] User selected option (if multiple) or confirmed (if single)
- [ ] All affected phase directories renamed
- [ ] All files inside directories renamed with new phase numbers
- [ ] All file contents updated with new phase references
- [ ] Dependency references updated in ROADMAP.md
- [ ] STATE.md updated (position if affected, evolution note)
- [ ] REQUIREMENTS.md updated if it exists
- [ ] User informed of changes and provided commit command

---

## Comparison with Related Commands

| Command | Purpose | Renumbers? | Creates? | Commits? |
|---------|---------|------------|----------|----------|
| `add-phase` | Append phase to end | No | Yes | No |
| `insert-phase` | Insert decimal phase (7.1) | No | Yes | No |
| `insert-new-phase` | Insert integer, renumber up | Yes (up) | Yes | No |
| `remove-phase` | Delete phase, renumber down | Yes (down) | No | Yes |
| **`swap-phases`** | Priority-based reorder | Yes (swap) | No | No |

---

## Implementation Notes

### Allowed Tools

```yaml
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
```

### Execution Context

```yaml
execution_context:
  - .planning/ROADMAP.md
  - .planning/STATE.md
  - .planning/REQUIREMENTS.md
  - .planning/phases/
```

### Detecting Phase Completion

```bash
# Check if phase has any completed plans
ls .planning/phases/{phase}-*/*-SUMMARY.md 2>/dev/null
```

If any SUMMARY.md files exist, the phase is "completed" for this command's purposes.

---

## File Structure

The command will be implemented as:

```
commands/gsd/swap-phases.md
```

Following the same structure as `insert-new-phase.md`:
- YAML frontmatter with name, description, argument-hint, allowed-tools
- `<objective>` explaining purpose
- `<execution_context>` referencing needed files
- `<process>` with step-by-step instructions
- `<anti_patterns>` to avoid
- `<edge_cases>` handling
- `<success_criteria>` checklist
