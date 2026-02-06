---
name: discuss-milestone
description: Gather context for next milestone through adaptive questioning
license: MIT
metadata:
  author: get-shit-done
  version: "1.0"
  category: project-management
allowed-tools: 
---

# discuss-milestone Skill

## Objective

Help you figure out what to build in the next milestone through collaborative thinking.
Purpose: After completing a milestone, explore what features you want to add, improve, or fix. Features first — scope and phases derive from what you want to build.
Output: Context gathered, then routes to /gsd:new-milestone
@~/.claude/get-shit-done/workflows/discuss-milestone.md

## When to Use



## Process

1. Verify previous milestone complete (or acknowledge active milestone)
2. Present context from previous milestone (accomplishments, phase count)
3. Follow discuss-milestone.md workflow with **ALL questions using AskUserQuestion**:
   - Use AskUserQuestion: "What do you want to add, improve, or fix?" with feature categories
   - Use AskUserQuestion to dig into features they mention
   - Use AskUserQuestion to help them articulate what matters most
   - Use AskUserQuestion for decision gate (ready / ask more / let me add context)
4. Hand off to /gsd:new-milestone with gathered context
**CRITICAL: ALL questions use AskUserQuestion. Never ask inline text questions.**
- Project state loaded and presented
- Previous milestone context summarized
- Milestone scope gathered through adaptive questioning
- Context handed off to /gsd:new-milestone
  

## Success Criteria

- Project state loaded and presented
- Previous milestone context summarized
- Milestone scope gathered through adaptive questioning
- Context handed off to /gsd:new-milestone
  

## Anti-Patterns



## Examples

### Example Usage
\[TBD: Add specific examples of when and how to use this skill\]

## Error Handling

- If required files are missing: Display clear error messages with setup instructions
- If arguments are invalid: Show usage examples and exit gracefully
- If operations fail: Provide detailed error information and suggest remedies
