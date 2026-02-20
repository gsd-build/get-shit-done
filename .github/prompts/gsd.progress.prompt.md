---
name: gsd.progress
description: "Check project progress, show context, and route to next action (execute or plan)"
argument-hint: ""
tools: ['execute', 'read', 'search']
agent: agent
---

<!-- GENERATED FILE — DO NOT EDIT.
Source: commands/gsd/progress.md
Regenerate: node scripts/generate-prompts.mjs
-->

<!-- upstream-tools: ["Read","Bash","Grep","Glob","SlashCommand"] -->
<!-- omitted-tools: ["slashcommand"] — no Copilot equivalent found -->

## Preflight (required)

If the local GSD install does not exist in this workspace, do this **once**:

1. Check for: `./.claude/get-shit-done/`
2. If missing, run:

```bash
npx get-shit-done-cc --claude --local
```

3. Then re-run the slash command: `/gsd.progress`

---

<objective>
Check project progress, summarize recent work and what's ahead, then intelligently route to the next action - either executing an existing plan or creating the next one.

Provides situational awareness before continuing work.
</objective>

<execution_context>
- Read file at: ../.claude/get-shit-done/workflows/progress.md
</execution_context>

<process>
Execute the progress workflow from @../.claude/get-shit-done/workflows/progress.md end-to-end.
Preserve all routing logic (Routes A through F) and edge case handling.
</process>
