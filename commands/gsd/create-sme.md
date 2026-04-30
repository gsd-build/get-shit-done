---
name: gsd:create-sme
description: Create or update an SME document for a named process
argument-hint: "[process-name, e.g., 'contribution']"
allowed-tools:
  - Read
  - Bash
  - Write
  - Task
  - AskUserQuestion
---

<objective>
Create a Subject Matter Expert (SME) document for a codebase process.
The SME document captures domain-specific risks, test gaps, outdated logic,
and edge cases that the plan-phase gate will enforce.

Output: .planning/smes/{PROCESS_NAME}-SME.md
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/create-sme.md
</execution_context>

<context>
Process name: $ARGUMENTS (optional - workflow presents interactive menu if not provided)
</context>

<process>
Execute the create-sme workflow from
@~/.claude/get-shit-done/workflows/create-sme.md end-to-end.
Preserve all workflow gates (validation, existence check, progress indicators, commit).
</process>
