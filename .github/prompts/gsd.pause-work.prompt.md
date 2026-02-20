---
name: gsd.pause-work
description: "Create context handoff when pausing work mid-phase"
argument-hint: ""
tools: ['edit', 'execute', 'read']
agent: agent
---

<!-- GENERATED FILE — DO NOT EDIT.
Source: commands/gsd/pause-work.md
Regenerate: node scripts/generate-prompts.mjs
-->

<!-- upstream-tools: ["Read","Write","Bash"] -->

## Preflight (required)

If the local GSD install does not exist in this workspace, do this **once**:

1. Check for: `./.claude/get-shit-done/`
2. If missing, run:

```bash
npx get-shit-done-cc --claude --local
```

3. Then re-run the slash command: `/gsd.pause-work`

---

<objective>
Create `.continue-here.md` handoff file to preserve complete work state across sessions.

Routes to the pause-work workflow which handles:
- Current phase detection from recent files
- Complete state gathering (position, completed work, remaining work, decisions, blockers)
- Handoff file creation with all context sections
- Git commit as WIP
- Resume instructions
</objective>

<execution_context>
- Read file at: .planning/STATE.md
- Read file at: ../.claude/get-shit-done/workflows/pause-work.md
</execution_context>

<process>
**Follow the pause-work workflow** from `@../.claude/get-shit-done/workflows/pause-work.md`.

The workflow handles all logic including:
1. Phase directory detection
2. State gathering with user clarifications
3. Handoff file writing with timestamp
4. Git commit
5. Confirmation with resume instructions
</process>
