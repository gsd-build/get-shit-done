---
name: gsd:extract-learnings
description: 从已完成阶段工件中提取决策、教训、模式和意外发现
argument-hint: <phase-number>
allowed-tools:
  - Read
  - Write
  - Bash
  - Grep
  - Glob
  - Agent
type: prompt
requires: [phase]
---
<objective>
Extract structured learnings from completed phase artifacts (PLAN.md, SUMMARY.md, VERIFICATION.md, UAT.md, STATE.md) into a LEARNINGS.md file that captures decisions, lessons learned, patterns discovered, and surprises encountered.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/extract-learnings.md
</execution_context>

Execute the extract-learnings workflow from @~/.claude/get-shit-done/workflows/extract-learnings.md end-to-end.
