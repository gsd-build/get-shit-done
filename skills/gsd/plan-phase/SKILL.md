---
name: plan-phase
description: Create detailed execution plan for a phase (PLAN.md)
license: MIT
metadata:
  author: get-shit-done
  version: "1.0"
  category: project-management
allowed-tools: 
---

# plan-phase Skill

## Objective

Create executable phase prompt with discovery, context injection, and task breakdown.
Purpose: Break down roadmap phases into concrete, executable PLAN.md files that Claude can execute.
Output: One or more PLAN.md files in the phase directory (.planning/phases/XX-name/{phase}-{plan}-PLAN.md)
@~/.claude/get-shit-done/workflows/plan-phase.md
@~/.claude/get-shit-done/templates/phase-prompt.md
@~/.claude/get-shit-done/references/plan-format.md

## When to Use



## Process

1. Check .planning/ directory exists (error if not - user should run /gsd:new-project)
2. If phase number provided via $ARGUMENTS, validate it exists in roadmap
3. If no phase number, detect next unplanned phase from roadmap
4. Follow plan-phase.md workflow:
   - Load project state and accumulated decisions
   - Perform mandatory discovery (Level 0-3 as appropriate)
   - Read project history (prior decisions, issues, concerns)
   - Break phase into tasks
   - Estimate scope and split into multiple plans if needed
   - Create PLAN.md file(s) with executable structure
- One or more PLAN.md files created in .planning/phases/XX-name/
- Each plan has: objective, execution_context, context, tasks, verification, success_criteria, output
- Tasks are specific enough for Claude to execute
- User knows next steps (execute plan or review/adjust)
  

## Success Criteria

- One or more PLAN.md files created in .planning/phases/XX-name/
- Each plan has: objective, execution_context, context, tasks, verification, success_criteria, output
- Tasks are specific enough for Claude to execute
- User knows next steps (execute plan or review/adjust)
  

## Anti-Patterns



## Examples

### Example Usage
\[TBD: Add specific examples of when and how to use this skill\]

## Error Handling

- If required files are missing: Display clear error messages with setup instructions
- If arguments are invalid: Show usage examples and exit gracefully
- If operations fail: Provide detailed error information and suggest remedies
