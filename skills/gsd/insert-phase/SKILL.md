---
name: insert-phase
description: Insert urgent work as decimal phase (e.g., 72.1) between existing phases
license: MIT
metadata:
  author: get-shit-done
  version: "1.0"
  category: project-management
allowed-tools: 
---

# insert-phase Skill

## Objective

Insert a decimal phase for urgent work discovered mid-milestone that must be completed between existing integer phases.
Uses decimal numbering (72.1, 72.2, etc.) to preserve the logical sequence of planned phases while accommodating urgent insertions.
Purpose: Handle urgent work discovered during execution without renumbering entire roadmap.
@.planning/ROADMAP.md
@.planning/STATE.md

## When to Use



## Process

Parse the command arguments:
- First argument: integer phase number to insert after
- Remaining arguments: phase description
Example: `/gsd:insert-phase 72 Fix critical auth bug`
→ after = 72
→ description = "Fix critical auth bug"
Validation:
```bash
if [ $# -lt 2 ]; then
  echo "ERROR: Both phase number and description required"
  echo "Usage: /gsd:insert-phase  "
  echo "Example: /gsd:insert-phase 72 Fix critical auth bug"
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
  echo "ERROR: Phase number must be an integer"
  exit 1
fi
```
Load the roadmap file:
```bash
if [ -f .planning/ROADMAP.md ]; then
  ROADMAP=".planning/ROADMAP.md"
else
  echo "ERROR: No roadmap found (.planning/ROADMAP.md)"
  exit 1
fi
```
Read roadmap content for parsing.

## Success Criteria

Phase insertion is complete when:
- [ ] Phase directory created: `.planning/phases/{N.M}-{slug}/`
- [ ] Roadmap updated with new phase entry (includes "(INSERTED)" marker)
- [ ] Phase inserted in correct position (after target phase, before next integer phase)
- [ ] STATE.md updated with roadmap evolution note
- [ ] Decimal number calculated correctly (based on existing decimals)
- [ ] User informed of next steps and dependency implications
      

## Anti-Patterns

- Don't use this for planned work at end of milestone (use /gsd:add-phase)
- Don't insert before Phase 1 (decimal 0.1 makes no sense)
- Don't renumber existing phases
- Don't modify the target phase content
- Don't create plans yet (that's /gsd:plan-phase)
- Don't commit changes (user decides when to commit)
  
Phase insertion is complete when:
- [ ] Phase directory created: `.planning/phases/{N.M}-{slug}/`
- [ ] Roadmap updated with new phase entry (includes "(INSERTED)" marker)
- [ ] Phase inserted in correct position (after target phase, before next integer phase)
- [ ] STATE.md updated with roadmap evolution note
- [ ] Decimal number calculated correctly (based on existing decimals)
- [ ] User informed of next steps and dependency implications
      

## Examples

### Example Usage
\[TBD: Add specific examples of when and how to use this skill\]

## Error Handling

- If required files are missing: Display clear error messages with setup instructions
- If arguments are invalid: Show usage examples and exit gracefully
- If operations fail: Provide detailed error information and suggest remedies
