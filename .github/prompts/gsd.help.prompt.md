---
name: gsd.help
description: "Show available GSD commands and usage guide"
argument-hint: ""
tools: []
agent: agent
---

<!-- GENERATED FILE — DO NOT EDIT.
Source: commands/gsd/help.md
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

3. Then re-run the slash command: `/gsd.help`

---


<objective>
Display the complete GSD command reference.

Output ONLY the reference content below. Do NOT add:
- Project-specific analysis
- Git status or file context
- Next-step suggestions
- Any commentary beyond the reference
</objective>

<execution_context>- Read file at: ../.claude/get-shit-done/workflows/help.md
</execution_context>

<process>
Output the complete GSD command reference from @../.claude/get-shit-done/workflows/help.md.
Display the reference content directly — no additions or modifications.
</process>
