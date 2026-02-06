---
name: discuss-phase
description: Gather phase context through adaptive questioning before planning
license: MIT
metadata:
  author: get-shit-done
  version: "1.0"
  category: project-management
allowed-tools: 
---

# discuss-phase Skill

## Objective

Help the user articulate their vision for a phase through collaborative thinking.
Purpose: Understand HOW the user imagines this phase working — what it looks like, what's essential. You're a thinking partner helping them crystallize their vision, not an interviewer gathering technical requirements.
Output: {phase}-CONTEXT.md capturing the user's vision for the phase
@~/.claude/get-shit-done/workflows/discuss-phase.md
@~/.claude/get-shit-done/templates/context.md

## When to Use



## Process

1. Validate phase number argument (error if missing or invalid)
2. Check if phase exists in roadmap
3. Check if CONTEXT.md already exists (offer to update if yes)
4. Follow discuss-phase.md workflow with **ALL questions using AskUserQuestion**:
   - Present phase from roadmap
   - Use AskUserQuestion: "How do you imagine this working?" with interpretation options
   - Use AskUserQuestion to follow their thread — probe what excites them
   - Use AskUserQuestion to sharpen the core — what's essential for THIS phase
   - Use AskUserQuestion for decision gate (ready / ask more / let me add context)
   - Create CONTEXT.md capturing their vision
5. Offer next steps (research or plan the phase)
**CRITICAL: ALL questions use AskUserQuestion. Never ask inline text questions.**
User is the visionary, you are the builder:
- Ask about vision, feel, essential outcomes
- DON'T ask about technical risks (you figure those out)
- DON'T ask about codebase patterns (you read the code)
- DON'T ask about success metrics (too corporate)
- DON'T interrogate about constraints they didn't mention
- Phase validated against roadmap
- Vision gathered through collaborative thinking (not interrogation)
- CONTEXT.md captures: how it works, what's essential
- User knows next steps (research or plan the phase)

## Success Criteria

- Phase validated against roadmap
- Vision gathered through collaborative thinking (not interrogation)
- CONTEXT.md captures: how it works, what's essential
- User knows next steps (research or plan the phase)

## Anti-Patterns



## Examples

### Example Usage
\[TBD: Add specific examples of when and how to use this skill\]

## Error Handling

- If required files are missing: Display clear error messages with setup instructions
- If arguments are invalid: Show usage examples and exit gracefully
- If operations fail: Provide detailed error information and suggest remedies
