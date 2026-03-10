---
name: gsd-add-tests
description: Generate tests for a completed phase based on UAT criteria and implementation
argument-hint: "<phase> [additional instructions]"
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Task, AskUserQuestion
---

<objective>
Generate unit and E2E tests for a completed phase, using its SUMMARY.md, CONTEXT.md, and VERIFICATION.md as specifications.

Analyzes implementation files, classifies them into TDD (unit), E2E (browser), or Skip categories, presents a test plan for user approval, then generates tests following RED-GREEN conventions.

Output: Test files committed with message `test(phase-{N}): add unit and E2E tests from add-tests command`
</objective>

<execution_context>
@.github/get-shit-done/workflows/add-tests.md
</execution_context>

<context>
Phase: $ARGUMENTS

@.planning/STATE.md
@.planning/ROADMAP.md
</context>

<process>
Execute the add-tests workflow from @.github/get-shit-done/workflows/add-tests.md end-to-end.
Preserve all workflow gates (classification approval, test plan approval, RED-GREEN verification, gap reporting).
</process>
