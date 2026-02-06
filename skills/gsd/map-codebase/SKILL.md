---
name: map-codebase
description: Analyze codebase with parallel Explore agents to produce .planning/codebase/ documents
license: MIT
metadata:
  author: get-shit-done
  version: "1.0"
  category: project-management
allowed-tools: 
---

# map-codebase Skill

## Objective

Analyze existing codebase using parallel Explore agents to produce structured codebase documents.
This command spawns multiple Explore agents to analyze different aspects of the codebase in parallel, each with fresh context.
Output: .planning/codebase/ folder with 7 structured documents about the codebase state.
@~/.claude/get-shit-done/workflows/map-codebase.md
@~/.claude/get-shit-done/templates/codebase/stack.md

## When to Use

**Use map-codebase for:**
- Brownfield projects before initialization (understand existing code first)
- Refreshing codebase map after significant changes
- Onboarding to an unfamiliar codebase
- Before major refactoring (understand current state)
- When STATE.md references outdated codebase info
**Skip map-codebase for:**
- Greenfield projects with no code yet (nothing to map)
- Trivial codebases (<5 files)
1. Check if .planning/codebase/ already exists (offer to refresh or skip)
2. Create .planning/codebase/ directory structure
3. Spawn 4 parallel Explore agents to analyze codebase:
   - Agent 1: Stack + Integrations (technology focus)
   - Agent 2: Architecture + Structure (organization focus)
   - Agent 3: Conventions + Testing (quality focus)
   - Agent 4: Concerns (issues focus)

## Process

1. Check if .planning/codebase/ already exists (offer to refresh or skip)
2. Create .planning/codebase/ directory structure
3. Spawn 4 parallel Explore agents to analyze codebase:
   - Agent 1: Stack + Integrations (technology focus)
   - Agent 2: Architecture + Structure (organization focus)
   - Agent 3: Conventions + Testing (quality focus)
   - Agent 4: Concerns (issues focus)
4. Wait for all agents to complete, collect findings
5. Write 7 codebase documents using templates:
   - STACK.md - Languages, frameworks, key dependencies
   - ARCHITECTURE.md - System design, patterns, data flow
   - STRUCTURE.md - Directory layout, module organization
   - CONVENTIONS.md - Code style, naming, patterns
   - TESTING.md - Test structure, coverage, practices
   - INTEGRATIONS.md - APIs, databases, external services
   - CONCERNS.md - Technical debt, risks, issues
6. Offer next steps (typically: /gsd:new-project or /gsd:plan-phase)
- [ ] .planning/codebase/ directory created
- [ ] All 7 codebase documents written
- [ ] Documents follow template structure
- [ ] Parallel agents completed without errors
- [ ] User knows next steps

## Success Criteria

- [ ] .planning/codebase/ directory created
- [ ] All 7 codebase documents written
- [ ] Documents follow template structure
- [ ] Parallel agents completed without errors
- [ ] User knows next steps

## Anti-Patterns



## Examples

### Example Usage
\[TBD: Add specific examples of when and how to use this skill\]

## Error Handling

- If required files are missing: Display clear error messages with setup instructions
- If arguments are invalid: Show usage examples and exit gracefully
- If operations fail: Provide detailed error information and suggest remedies
