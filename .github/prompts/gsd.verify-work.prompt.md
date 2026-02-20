---
name: gsd.verify-work
description: "Validate built features through conversational UAT"
argument-hint: "[phase number, e.g., '4']"
tools: ['agent', 'edit', 'execute', 'read', 'search']
agent: agent
---

<!-- GENERATED FILE — DO NOT EDIT.
Source: commands/gsd/verify-work.md
Regenerate: node scripts/generate-prompts.mjs
-->

<!-- upstream-tools: ["Read","Bash","Glob","Grep","Edit","Write","Task"] -->

## Preflight (required)

If the local GSD install does not exist in this workspace, do this **once**:

1. Check for: `./.claude/get-shit-done/`
2. If missing, run:

```bash
npx get-shit-done-cc --claude --local
```

3. Then re-run the slash command: `/gsd.verify-work`

---

<objective>
Validate built features through conversational testing with persistent state.

Purpose: Confirm what Claude built actually works from user's perspective. One test at a time, plain text responses, no interrogation. When issues are found, automatically diagnose, plan fixes, and prepare for execution.

Output: {phase_num}-UAT.md tracking all test results. If issues found: diagnosed gaps, verified fix plans ready for /gsd:execute-phase
</objective>

<execution_context>
- Read file at: ../.claude/get-shit-done/workflows/verify-work.md
- Read file at: ../.claude/get-shit-done/templates/UAT.md
</execution_context>

<context>
Phase: $ARGUMENTS (optional)
- If provided: Test specific phase (e.g., "4")
- If not provided: Check for active sessions or prompt for phase
- Read file at: .planning/STATE.md
- Read file at: .planning/ROADMAP.md
</context>

<process>
Execute the verify-work workflow from @../.claude/get-shit-done/workflows/verify-work.md end-to-end.
Preserve all workflow gates (session management, test presentation, diagnosis, fix planning, routing).
</process>
