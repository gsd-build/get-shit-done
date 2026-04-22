---
name: gsd:analyze-dependencies
description: Analyze phase dependencies and suggest Depends on entries for ROADMAP.md
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
---
<objective>
Analyze the phase dependency graph for the current milestone. For each phase pair, determine if there is a dependency relationship based on:
- File overlap (phases that modify the same files must be ordered)
- Semantic dependencies (a phase that uses an API built by another phase)
- Data flow (a phase that consumes output from another phase)

Then suggest `Depends on` updates to ROADMAP.md.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/analyze-dependencies.md
</execution_context>

<context>
No arguments required. Requires an active milestone with ROADMAP.md.

Run this command BEFORE `/gsd:manager` to fill in missing `Depends on` fields and prevent merge conflicts from unordered parallel execution.
</context>

<process>
Execute the analyze-dependencies workflow from @~/.claude/get-shit-done/workflows/analyze-dependencies.md end-to-end.
Present dependency suggestions clearly and apply confirmed updates to ROADMAP.md.
</process>
