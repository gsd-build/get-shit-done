---
name: gsd.cleanup
description: "Archive accumulated phase directories from completed milestones"
argument-hint: ""
tools: []
agent: agent
---

<!-- GENERATED FILE — DO NOT EDIT.
Source: commands/gsd/cleanup.md
Regenerate: node scripts/generate-prompts.mjs
-->
<!-- upstream-tools: null (field absent in upstream command) -->

## Preflight (required)

If the local GSD install does not exist in this workspace, do this **once**:

1. Check for: `./.claude/get-shit-done/`
2. If missing, run:

```bash
npx get-shit-done-cc --claude --local
```

3. Then re-run the slash command: `/gsd.cleanup`

---


<objective>
Archive phase directories from completed milestones into `.planning/milestones/v{X.Y}-phases/`.

Use when `.planning/phases/` has accumulated directories from past milestones.
</objective>

<execution_context>- Read file at: ../.claude/get-shit-done/workflows/cleanup.md
</execution_context>

<process>
Follow the cleanup workflow at @../.claude/get-shit-done/workflows/cleanup.md.
Identify completed milestones, show a dry-run summary, and archive on confirmation.
</process>
