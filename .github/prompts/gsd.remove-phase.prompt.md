---
name: gsd.remove-phase
description: "Remove a future phase from roadmap and renumber subsequent phases"
argument-hint: "<phase-number>"
tools: ['edit', 'execute', 'read', 'search']
agent: agent
---

<!-- GENERATED FILE — DO NOT EDIT.
Source: commands/gsd/remove-phase.md
Regenerate: node scripts/generate-prompts.mjs
-->

<!-- upstream-tools: ["Read","Write","Bash","Glob"] -->

## Preflight (required)

If the local GSD install does not exist in this workspace, do this **once**:

1. Check for: `./.claude/get-shit-done/`
2. If missing, run:

```bash
npx get-shit-done-cc --claude --local
```

3. Then re-run the slash command: `/gsd.remove-phase`

---

<objective>
Remove an unstarted future phase from the roadmap and renumber all subsequent phases to maintain a clean, linear sequence.

Purpose: Clean removal of work you've decided not to do, without polluting context with cancelled/deferred markers.
Output: Phase deleted, all subsequent phases renumbered, git commit as historical record.
</objective>

<execution_context>
- Read file at: ../.claude/get-shit-done/workflows/remove-phase.md
</execution_context>

<context>
Phase: $ARGUMENTS
- Read file at: .planning/ROADMAP.md
- Read file at: .planning/STATE.md
</context>

<process>
Execute the remove-phase workflow from @../.claude/get-shit-done/workflows/remove-phase.md end-to-end.
Preserve all validation gates (future phase check, work check), renumbering logic, and commit.
</process>
