---
name: gsd:autonomous
description: Execute GSD workflows autonomously with minimal human intervention, TDD, aggressive parallelism, and full verification
argument-hint: "[--phase=N | --from=N --to=N] [-N=<max_iterations>] [user guidance]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - Task
  - AskUserQuestion
---
<objective>
Execute GSD workflows autonomously with minimal human intervention. Spawns specialized subagents that work independently until the task is truly complete.

**Default Mode:** Ad-hoc (runs until complete). Specify phases via `--from=N --to=N` or in prose.

**Default Behaviors:**
1. TDD-First: When tests can be written before implementation, use TDD approach
2. Aggressive Parallelism: Spawn subagents in parallel whenever dependencies allow
3. Full Verification: Never claim complete until verification shows PASS
4. Honest Reporting: Report PARTIAL or FAIL if that's the truth
5. Loop Until Complete: By default, keeps iterating until verification passes. Use `-N=<n>` to limit iterations.

**Key Principle:** Always use Task tool to spawn subagents. Never work inline.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/autonomous.md
</execution_context>

<context>
$ARGUMENTS

Context files are resolved inside the workflow and delegated via `<files_to_read>` blocks.
</context>

<process>
Execute the autonomous workflow from @~/.claude/get-shit-done/workflows/autonomous.md end-to-end.
Preserve all workflow gates (argument parsing, context loading, execution, verification, reporting).
</process>
