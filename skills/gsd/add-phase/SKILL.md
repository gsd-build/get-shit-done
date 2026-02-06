---
name: add-phase
description: Add phase to end of current milestone in roadmap
license: MIT
metadata:
  author: get-shit-done
  version: "1.0"
  category: project-management
allowed-tools: 
---

# add-phase Skill

## Objective

Add a new integer phase to the end of the current milestone in the roadmap.
This command appends sequential phases to the current milestone's phase list, automatically calculating the next phase number based on existing phases.
Purpose: Add planned work discovered during execution that belongs at the end of current milestone.
@.planning/ROADMAP.md
@.planning/STATE.md

## When to Use



## Process

Parse the command arguments:
- All arguments become the phase description
- Example: `/gsd:add-phase Add authentication` → description = "Add authentication"
- Example: `/gsd:add-phase Fix critical performance issues` → description = "Fix critical performance issues"
If no arguments provided:
```
ERROR: Phase description required
Usage: /gsd:add-phase 
Example: /gsd:add-phase Add authentication system
```
Exit.
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
Parse the roadmap to find the current milestone section:
1. Locate the "## Current Milestone:" heading
2. Extract milestone name and version
3. Identify all phases under this milestone (before next "---" separator or next milestone heading)
4. Parse existing phase numbers (including decimals if present)
Example structure:
```
## Current Milestone: v1.0 Foundation
### Phase 4: Focused Command System
### Phase 5: Path Routing & Validation
### Phase 6: Documentation & Distribution
```

## Success Criteria

Phase addition is complete when:
- [ ] Phase directory created: `.planning/phases/{NN}-{slug}/`
- [ ] Roadmap updated with new phase entry
- [ ] STATE.md updated with roadmap evolution note
- [ ] New phase appears at end of current milestone
- [ ] Next phase number calculated correctly (ignoring decimals)
- [ ] User informed of next steps
      

## Anti-Patterns

- Don't modify phases outside current milestone
- Don't renumber existing phases
- Don't use decimal numbering (that's /gsd:insert-phase)
- Don't create plans yet (that's /gsd:plan-phase)
- Don't commit changes (user decides when to commit)
  
Phase addition is complete when:
- [ ] Phase directory created: `.planning/phases/{NN}-{slug}/`
- [ ] Roadmap updated with new phase entry
- [ ] STATE.md updated with roadmap evolution note
- [ ] New phase appears at end of current milestone
- [ ] Next phase number calculated correctly (ignoring decimals)
- [ ] User informed of next steps
      

## Examples

### Example Usage
\[TBD: Add specific examples of when and how to use this skill\]

## Error Handling

- If required files are missing: Display clear error messages with setup instructions
- If arguments are invalid: Show usage examples and exit gracefully
- If operations fail: Provide detailed error information and suggest remedies
