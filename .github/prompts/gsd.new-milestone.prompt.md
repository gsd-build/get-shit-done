---
name: gsd.new-milestone
description: "Start a new milestone cycle — update PROJECT.md and route to requirements"
argument-hint: "[milestone name, e.g., 'v1.1 Notifications']"
tools: ['agent', 'edit', 'execute', 'read', 'vscode/askQuestions']
agent: agent
---

<!-- GENERATED FILE — DO NOT EDIT.
Source: commands/gsd/new-milestone.md
Regenerate: node scripts/generate-prompts.mjs
-->
<!-- upstream-tools: ["read","write","bash","task","askuserquestion"] -->

## Preflight (required)

If the local GSD install does not exist in this workspace, do this **once**:

1. Check for: `./.claude/get-shit-done/`
2. If missing, run:

```bash
npx get-shit-done-cc --claude --local
```

3. Then re-run the slash command: `/gsd.new-milestone`

---

## Copilot Runtime Adapter (important)

Upstream GSD command sources may reference an `AskUserQuestion` tool (Claude/OpenCode runtime concept).

In VS Code Copilot, **do not attempt to call a tool named `AskUserQuestion`**.
Instead, whenever the upstream instructions say "Use AskUserQuestion", use **#tool:vscode/askQuestions** with:

- Combine the **Header** and **Question** into a single clear question string.
- If the upstream instruction specifies **Options**, present them as numbered choices.
- If no options are specified, ask as a freeform question.

**Rules:**
1. If the options include "Other", "Something else", or "Let me explain", and the user selects it, follow up with a freeform question via #tool:vscode/askQuestions.
2. Follow the upstream branching and loop rules exactly as written (e.g., "if X selected, do Y; otherwise continue").
3. If the upstream flow says to **exit/stop** and run another command, tell the user to run that slash command next, then stop.
4. Use #tool:vscode/askQuestions freely — do not guess or assume user intent.

---

<objective>
Start a new milestone: questioning → research (optional) → requirements → roadmap.

Brownfield equivalent of new-project. Project exists, PROJECT.md has history. Gathers "what's next", updates PROJECT.md, then runs requirements → roadmap cycle.

**Creates/Updates:**
- `.planning/PROJECT.md` — updated with new milestone goals
- `.planning/research/` — domain research (optional, NEW features only)
- `.planning/REQUIREMENTS.md` — scoped requirements for this milestone
- `.planning/ROADMAP.md` — phase structure (continues numbering)
- `.planning/STATE.md` — reset for new milestone

**After:** `/gsd:plan-phase [N]` to start execution.
</objective>

<execution_context>- Read file at: ../.claude/get-shit-done/workflows/new-milestone.md- Read file at: ../.claude/get-shit-done/references/questioning.md- Read file at: ../.claude/get-shit-done/references/ui-brand.md- Read file at: ../.claude/get-shit-done/templates/project.md- Read file at: ../.claude/get-shit-done/templates/requirements.md
</execution_context>

<context>
Milestone name: $ARGUMENTS (optional - will prompt if not provided)

**Load project context:**- Read file at: .planning/PROJECT.md- Read file at: .planning/STATE.md- Read file at: .planning/MILESTONES.md- Read file at: .planning/config.json
**Load milestone context (if exists, from /gsd:discuss-milestone):**- Read file at: .planning/MILESTONE-CONTEXT.md
</context>

<process>
Execute the new-milestone workflow from @../.claude/get-shit-done/workflows/new-milestone.md end-to-end.
Preserve all workflow gates (validation, questioning, research, requirements, roadmap approval, commits).
</process>
