---
name: gsd.execute-phase
description: "Execute all plans in a phase with wave-based parallelization"
argument-hint: "<phase-number> [--gaps-only]"
tools: ['agent', 'edit', 'execute', 'read', 'search', 'todo', 'vscode/askQuestions']
agent: agent
---

<!-- GENERATED FILE — DO NOT EDIT.
Source: commands/gsd/execute-phase.md
Regenerate: node scripts/generate-prompts.mjs
-->

<!-- upstream-tools: ["Read","Write","Edit","Glob","Grep","Bash","Task","TodoWrite","AskUserQuestion"] -->

## Preflight (required)

If the local GSD install does not exist in this workspace, do this **once**:

1. Check for: `./.claude/get-shit-done/`
2. If missing, run:

```bash
npx get-shit-done-cc --claude --local
```

3. Then re-run the slash command: `/gsd.execute-phase`

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
Execute all plans in a phase using wave-based parallel execution.

Orchestrator stays lean: discover plans, analyze dependencies, group into waves, spawn subagents, collect results. Each subagent loads the full execute-plan context and handles its own plan.

Context budget: ~15% orchestrator, 100% fresh per subagent.
</objective>

<execution_context>
- Read file at: ../.claude/get-shit-done/workflows/execute-phase.md
- Read file at: ../.claude/get-shit-done/references/ui-brand.md
</execution_context>

<context>
Phase: $ARGUMENTS

**Flags:**
- `--gaps-only` — Execute only gap closure plans (plans with `gap_closure: true` in frontmatter). Use after verify-work creates fix plans.
- Read file at: .planning/ROADMAP.md
- Read file at: .planning/STATE.md
</context>

<process>
Execute the execute-phase workflow from @../.claude/get-shit-done/workflows/execute-phase.md end-to-end.
Preserve all workflow gates (wave execution, checkpoint handling, verification, state updates, routing).
</process>
