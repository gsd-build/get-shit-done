---
name: resume-work
description: Resume work from previous session with full context restoration
license: MIT
metadata:
  author: get-shit-done
  version: "1.0"
  category: project-management
allowed-tools: 
---

# resume-work Skill

## Objective

Restore complete project context and resume work seamlessly from previous session.
Routes to the resume-project workflow which handles:
- STATE.md loading (or reconstruction if missing)
- Checkpoint detection (.continue-here files)
- Incomplete work detection (PLAN without SUMMARY)
- Status presentation
- Context-aware next action routing
  

## When to Use



## Process

**Follow the resume-project workflow** from `@~/.claude/get-shit-done/workflows/resume-project.md`.
The workflow handles all resumption logic including:
1. Project existence verification
2. STATE.md loading or reconstruction
3. Checkpoint and incomplete work detection
4. Visual status presentation
5. Context-aware option offering (checks CONTEXT.md before suggesting plan vs discuss)
6. Routing to appropriate next command
7. Session continuity updates
   

## Success Criteria



## Anti-Patterns



## Examples

### Example Usage
\[TBD: Add specific examples of when and how to use this skill\]

## Error Handling

- If required files are missing: Display clear error messages with setup instructions
- If arguments are invalid: Show usage examples and exit gracefully
- If operations fail: Provide detailed error information and suggest remedies
