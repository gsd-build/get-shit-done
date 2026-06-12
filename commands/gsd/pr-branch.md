---
name: gsd:pr-branch
description: 通过过滤 .planning/ 提交创建干净的 PR 分支，准备代码审查
argument-hint: "[target branch, default: main]"
allowed-tools:
  - Bash
  - Read
  - AskUserQuestion
requires: [review]
---

<objective>
Create a clean branch suitable for pull requests by filtering out .planning/ commits
from the current branch. Reviewers see only code changes, not GSD planning artifacts.

This solves the problem of PR diffs being cluttered with PLAN.md, SUMMARY.md, STATE.md
changes that are irrelevant to code review.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/pr-branch.md
</execution_context>

<process>
Execute end-to-end.
</process>
