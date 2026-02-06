---
name: pause-work
description: Create context handoff when pausing work mid-phase
license: MIT
metadata:
  author: get-shit-done
  version: "1.0"
  category: project-management
allowed-tools: 
---

# pause-work Skill

## Objective

Create `.continue-here.md` handoff file to preserve complete work state across sessions.
Enables seamless resumption in fresh session with full context restoration.
@.planning/STATE.md

## When to Use



## Process

Find current phase directory from most recently modified files.
**Collect complete state for handoff:**
1. **Current position**: Which phase, which plan, which task
2. **Work completed**: What got done this session
3. **Work remaining**: What's left in current plan/phase
4. **Decisions made**: Key decisions and rationale
5. **Blockers/issues**: Anything stuck
6. **Mental context**: The approach, next steps, "vibe"
7. **Files modified**: What's changed but not committed
Ask user for clarifications if needed.
**Write handoff to `.planning/phases/XX-name/.continue-here.md`:**
```markdown
---
phase: XX-name
task: 3
total_tasks: 7
status: in_progress
last_updated: [timestamp]
---
[Where exactly are we? Immediate context]
- Task 1: [name] - Done
- Task 2: [name] - Done
- Task 3: [name] - In progress, [what's done]
  
- Task 3: [what's left]
- Task 4: Not started
- Task 5: Not started
  

## Success Criteria

- [ ] .continue-here.md created in correct phase directory
- [ ] All sections filled with specific content
- [ ] Committed as WIP
- [ ] User knows location and how to resume
```

## Anti-Patterns



## Examples

### Example Usage
\[TBD: Add specific examples of when and how to use this skill\]

## Error Handling

- If required files are missing: Display clear error messages with setup instructions
- If arguments are invalid: Show usage examples and exit gracefully
- If operations fail: Provide detailed error information and suggest remedies
