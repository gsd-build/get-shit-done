---
name: new-milestone
description: Create a new milestone with phases for an existing project
license: MIT
metadata:
  author: get-shit-done
  version: "1.0"
  category: project-management
allowed-tools: 
---

# new-milestone Skill

## Objective

Create a new milestone for an existing project with defined phases.
Purpose: After completing a milestone (or when ready to define next chunk of work), creates the milestone structure in ROADMAP.md with phases, updates STATE.md, and creates phase directories.
Output: New milestone in ROADMAP.md, updated STATE.md, phase directories created
@~/.claude/get-shit-done/workflows/create-milestone.md
@~/.claude/get-shit-done/templates/roadmap.md

## When to Use



## Process

1. Load project context (STATE.md, ROADMAP.md, MILESTONES.md)
2. Calculate next milestone version and starting phase number
3. If milestone name provided in arguments, use it; otherwise prompt
4. Gather phases (per depth setting: quick 3-5, standard 5-8, comprehensive 8-12):
   - If called from /gsd:discuss-milestone, use provided context
   - Otherwise, prompt for phase breakdown
5. Detect research needs for each phase
6. Confirm phases (respect config.json gate settings)
7. Follow create-milestone.md workflow:
   - Update ROADMAP.md with new milestone section
   - Create phase directories
   - Update STATE.md for new milestone
   - Git commit milestone creation
8. Offer next steps (discuss first phase, plan first phase, review)
- Next phase number calculated correctly (continues from previous milestone)
- Phases defined per depth setting (quick: 3-5, standard: 5-8, comprehensive: 8-12)
- Research flags assigned for each phase
- ROADMAP.md updated with new milestone section
- Phase directories created
- STATE.md reset for new milestone
- Git commit made
- User knows next steps
  

## Success Criteria

- Next phase number calculated correctly (continues from previous milestone)
- Phases defined per depth setting (quick: 3-5, standard: 5-8, comprehensive: 8-12)
- Research flags assigned for each phase
- ROADMAP.md updated with new milestone section
- Phase directories created
- STATE.md reset for new milestone
- Git commit made
- User knows next steps
  

## Anti-Patterns



## Examples

### Example Usage
\[TBD: Add specific examples of when and how to use this skill\]

## Error Handling

- If required files are missing: Display clear error messages with setup instructions
- If arguments are invalid: Show usage examples and exit gracefully
- If operations fail: Provide detailed error information and suggest remedies
