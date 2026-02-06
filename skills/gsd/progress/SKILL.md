---
name: progress
description: Check project progress, show context, and route to next action (execute or plan)
license: MIT
metadata:
  author: get-shit-done
  version: "1.0"
  category: project-management
allowed-tools: 
---

# progress Skill

## Objective

Check project progress, summarize recent work and what's ahead, then intelligently route to the next action - either executing an existing plan or creating the next one.
Provides situational awareness before continuing work.
**Verify planning structure exists:**
--
Read its `` section.
```
---
## ▶ Next Up
**{phase}-{plan}: [Plan Name]** — [objective summary from PLAN.md]
`/gsd:execute-plan [full-path-to-PLAN.md]`

## When to Use



## Process

**Verify planning structure exists:**
If no `.planning/` directory:
```
No planning structure found.
Run /gsd:new-project to start a new project.
```
Exit.
If missing STATE.md or ROADMAP.md: inform what's missing, suggest running `/gsd:new-project`.
**Load full project context:**
- Read `.planning/STATE.md` for living memory (position, decisions, issues)
- Read `.planning/ROADMAP.md` for phase structure and objectives
- Read `.planning/PROJECT.md` for current state (What This Is, Core Value, Requirements)
  
**Gather recent work context:**
- Find the 2-3 most recent SUMMARY.md files
- Extract from each: what was accomplished, key decisions, any issues logged
- This shows "what we've been working on"
  
**Parse current position:**
- From STATE.md: current phase, plan number, status
- Calculate: total plans, completed plans, remaining plans
- Note any blockers, concerns, or deferred issues
- Check for CONTEXT.md: For phases without PLAN.md files, check if `{phase}-CONTEXT.md` exists in phase directory
- Count pending todos: `ls .planning/todos/pending/*.md 2>/dev/null | wc -l`
- Check for active debug sessions: `ls .planning/debug/*.md 2>/dev/null | grep -v resolved | wc -l`
  
**Present rich status report:**
```
# [Project Name]

## Success Criteria

- [ ] Rich context provided (recent work, decisions, issues)
- [ ] Current position clear with visual progress
- [ ] What's next clearly explained
- [ ] Smart routing: /gsd:execute-plan if plan exists, /gsd:plan-phase if not
- [ ] User confirms before any action
- [ ] Seamless handoff to appropriate gsd command
      

## Anti-Patterns



## Examples

### Example Usage
\[TBD: Add specific examples of when and how to use this skill\]

## Error Handling

- If required files are missing: Display clear error messages with setup instructions
- If arguments are invalid: Show usage examples and exit gracefully
- If operations fail: Provide detailed error information and suggest remedies
