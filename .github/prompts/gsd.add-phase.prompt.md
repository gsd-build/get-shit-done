---
name: gsd.add-phase
description: "Add phase to end of current milestone in roadmap"
argument-hint: "<description>"
tools: ['edit', 'execute', 'read']
agent: agent
---

<!-- GENERATED FILE — DO NOT EDIT.
Source: commands/gsd/add-phase.md
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

3. Then re-run the slash command: `/gsd.add-phase`

---


<objective>
Add a new integer phase to the end of the current milestone in the roadmap.

Routes to the add-phase workflow which handles:
- Phase number calculation (next sequential integer)
- Directory creation with slug generation
- Roadmap structure updates
- STATE.md roadmap evolution tracking
</objective>

<execution_context>- Read file at: .planning/ROADMAP.md- Read file at: .planning/STATE.md- Read file at: ../.claude/get-shit-done/workflows/add-phase.md
</execution_context>

<process>
**Follow the add-phase workflow** from `@../.claude/get-shit-done/workflows/add-phase.md`.

The workflow handles all logic including:
1. Argument parsing and validation
2. Roadmap existence checking
3. Current milestone identification
4. Next phase number calculation (ignoring decimals)
5. Slug generation from description
6. Phase directory creation
7. Roadmap entry insertion
8. STATE.md updates
</process>
