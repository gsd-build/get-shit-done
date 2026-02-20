---
name: gsd.insert-phase
description: "Insert urgent work as decimal phase (e.g., 72.1) between existing phases"
argument-hint: "<after> <description>"
tools: ['edit', 'execute', 'read']
agent: agent
---

<!-- GENERATED FILE — DO NOT EDIT.
Source: commands/gsd/insert-phase.md
Regenerate: node scripts/generate-prompts.mjs
-->
<!-- upstream-tools: ["read","write","bash"] -->

## Preflight (required)

If the local GSD install does not exist in this workspace, do this **once**:

1. Check for: `./.claude/get-shit-done/`
2. If missing, run:

```bash
npx get-shit-done-cc --claude --local
```

3. Then re-run the slash command: `/gsd.insert-phase`

---


<objective>
Insert a decimal phase for urgent work discovered mid-milestone that must be completed between existing integer phases.

Uses decimal numbering (72.1, 72.2, etc.) to preserve the logical sequence of planned phases while accommodating urgent insertions.

Purpose: Handle urgent work discovered during execution without renumbering entire roadmap.
</objective>

<execution_context>- Read file at: ../.claude/get-shit-done/workflows/insert-phase.md
</execution_context>

<context>
Arguments: $ARGUMENTS (format: <after-phase-number> <description>)- Read file at: .planning/ROADMAP.md- Read file at: .planning/STATE.md
</context>

<process>
Execute the insert-phase workflow from @../.claude/get-shit-done/workflows/insert-phase.md end-to-end.
Preserve all validation gates (argument parsing, phase verification, decimal calculation, roadmap updates).
</process>
