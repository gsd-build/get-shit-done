---
name: remove-phase
description: Remove a future phase from roadmap and renumber subsequent phases
license: MIT
metadata:
  author: get-shit-done
  version: "1.0"
  category: project-management
allowed-tools: 
---

# remove-phase Skill

## Objective

Remove an unstarted future phase from the roadmap and renumber all subsequent phases to maintain a clean, linear sequence.
Purpose: Clean removal of work you've decided not to do, without polluting context with cancelled/deferred markers.
Output: Phase deleted, all subsequent phases renumbered, git commit as historical record.
@.planning/ROADMAP.md
@.planning/STATE.md

## When to Use



## Process

Parse the command arguments:
- Argument is the phase number to remove (integer or decimal)
- Example: `/gsd:remove-phase 17` → phase = 17
- Example: `/gsd:remove-phase 16.1` → phase = 16.1
If no argument provided:
```
ERROR: Phase number required
Usage: /gsd:remove-phase 
Example: /gsd:remove-phase 17
```
Exit.
Load project state:
```bash
cat .planning/STATE.md 2>/dev/null
cat .planning/ROADMAP.md 2>/dev/null
```
Parse current phase number from STATE.md "Current Position" section.
Verify the target phase exists in ROADMAP.md:
1. Search for `### Phase {target}:` heading
2. If not found:
   ```
   ERROR: Phase {target} not found in roadmap
   Available phases: [list phase numbers]
   ```
   Exit.
Verify the phase is a future phase (not started):
1. Compare target phase to current phase from STATE.md
2. Target must be > current phase number
If target <= current phase:

## Success Criteria

Phase removal is complete when:
- [ ] Target phase validated as future/unstarted
- [ ] Phase directory deleted (if existed)
- [ ] All subsequent phase directories renumbered
- [ ] Files inside directories renamed ({old}-01-PLAN.md → {new}-01-PLAN.md)
- [ ] ROADMAP.md updated (section removed, all references renumbered)
- [ ] STATE.md updated (phase count, progress percentage)
- [ ] Dependency references updated in subsequent phases
- [ ] Changes committed with descriptive message
- [ ] No gaps in phase numbering
- [ ] User informed of changes

## Anti-Patterns

- Don't remove completed phases (have SUMMARY.md files)
- Don't remove current or past phases
- Don't leave gaps in numbering - always renumber
- Don't add "removed phase" notes to STATE.md - git commit is the record
- Don't ask about each decimal phase - just renumber them
- Don't modify completed phase directories
**Removing a decimal phase (e.g., 17.1):**
- Only affects other decimals in same series (17.2 → 17.1, 17.3 → 17.2)
- Integer phases unchanged
- Simpler operation
**No subsequent phases to renumber:**
- Removing the last phase (e.g., Phase 20 when that's the end)
- Just delete and update ROADMAP.md, no renumbering needed

## Examples

### Example Usage
\[TBD: Add specific examples of when and how to use this skill\]

## Error Handling

- If required files are missing: Display clear error messages with setup instructions
- If arguments are invalid: Show usage examples and exit gracefully
- If operations fail: Provide detailed error information and suggest remedies
