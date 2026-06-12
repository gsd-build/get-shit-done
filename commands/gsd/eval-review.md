---
name: gsd:eval-review
description: 审计已执行 AI 阶段的评估覆盖率并生成 EVAL-REVIEW.md 补救计划
argument-hint: "[phase number]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - Agent
  - AskUserQuestion
requires: [phase]
---
<objective>
Conduct a retroactive evaluation coverage audit of a completed AI phase.
Checks whether the evaluation strategy from AI-SPEC.md was implemented.
Produces EVAL-REVIEW.md with score, verdict, gaps, and remediation plan.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/eval-review.md
@~/.claude/get-shit-done/references/ai-evals.md
</execution_context>

<context>
Phase: $ARGUMENTS — optional, defaults to last completed phase.
</context>

<process>
Execute end-to-end.
Preserve all workflow gates.
</process>
