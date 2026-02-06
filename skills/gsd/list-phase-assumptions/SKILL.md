---
name: list-phase-assumptions
description: 
license: MIT
metadata:
  author: get-shit-done
  version: "1.0"
  category: project-management
allowed-tools: 
---

# list-phase-assumptions Skill

## Objective

Analyze a phase and present Claude's assumptions about technical approach, implementation order, scope boundaries, risk areas, and dependencies.
Purpose: Help users see what Claude thinks BEFORE planning begins - enabling course correction early when assumptions are wrong.
Output: Conversational output only (no file creation) - ends with "What do you think?" prompt
@~/.claude/get-shit-done/workflows/list-phase-assumptions.md

## When to Use



## Process

1. Validate phase number argument (error if missing or invalid)
2. Check if phase exists in roadmap
3. Follow list-phase-assumptions.md workflow:
   - Analyze roadmap description
   - Surface assumptions about: technical approach, implementation order, scope, risks, dependencies
   - Present assumptions clearly
   - Prompt "What do you think?"
4. Gather feedback and offer next steps
- Phase validated against roadmap
- Assumptions surfaced across five areas
- User prompted for feedback
- User knows next steps (discuss context, plan phase, or correct assumptions)
  

## Success Criteria

- Phase validated against roadmap
- Assumptions surfaced across five areas
- User prompted for feedback
- User knows next steps (discuss context, plan phase, or correct assumptions)
  

## Anti-Patterns



## Examples

### Example Usage
\[TBD: Add specific examples of when and how to use this skill\]

## Error Handling

- If required files are missing: Display clear error messages with setup instructions
- If arguments are invalid: Show usage examples and exit gracefully
- If operations fail: Provide detailed error information and suggest remedies
