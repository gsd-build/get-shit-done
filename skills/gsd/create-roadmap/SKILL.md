---
name: create-roadmap
description: Create roadmap with phases for the project
license: MIT
metadata:
  author: get-shit-done
  version: "1.0"
  category: project-management
allowed-tools: 
---

# create-roadmap Skill

## Objective

Create project roadmap with phase breakdown.
Roadmaps define what work happens in what order. Run after /gsd:new-project.
@~/.claude/get-shit-done/workflows/create-roadmap.md
@~/.claude/get-shit-done/templates/roadmap.md
@~/.claude/get-shit-done/templates/state.md

## When to Use



## Process

```bash
# Verify project exists
[ -f .planning/PROJECT.md ] || { echo "ERROR: No PROJECT.md found. Run /gsd:new-project first."; exit 1; }
```
Check if roadmap already exists:
```bash
[ -f .planning/ROADMAP.md ] && echo "ROADMAP_EXISTS" || echo "NO_ROADMAP"
```
**If ROADMAP_EXISTS:**
Use AskUserQuestion:
- header: "Roadmap exists"
- question: "A roadmap already exists. What would you like to do?"
- options:
  - "View existing" - Show current roadmap
  - "Replace" - Create new roadmap (will overwrite)
  - "Cancel" - Keep existing roadmap
If "View existing": `cat .planning/ROADMAP.md` and exit
If "Cancel": Exit
If "Replace": Continue with workflow
Follow the create-roadmap.md workflow starting from detect_domain step.
The workflow handles:
- Domain expertise detection
- Phase identification
- Research flags for each phase
- Confirmation gates (respecting config mode)
- ROADMAP.md creation
- STATE.md initialization
- Phase directory creation
- Git commit
```
Roadmap created:
- Roadmap: .planning/ROADMAP.md
- State: .planning/STATE.md
- [N] phases defined

## Success Criteria

- [ ] PROJECT.md validated
- [ ] ROADMAP.md created with phases
- [ ] STATE.md initialized
- [ ] Phase directories created
- [ ] Changes committed

## Anti-Patterns



## Examples

### Example Usage
\[TBD: Add specific examples of when and how to use this skill\]

## Error Handling

- If required files are missing: Display clear error messages with setup instructions
- If arguments are invalid: Show usage examples and exit gracefully
- If operations fail: Provide detailed error information and suggest remedies
