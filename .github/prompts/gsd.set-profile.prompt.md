---
name: gsd.set-profile
description: "Switch model profile for GSD agents (quality/balanced/budget)"
argument-hint: "<profile>"
tools: ['edit', 'execute', 'read']
agent: agent
---

<!-- GENERATED FILE — DO NOT EDIT.
Source: commands/gsd/set-profile.md
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

3. Then re-run the slash command: `/gsd.set-profile`

---


<objective>
Switch the model profile used by GSD agents. Controls which Claude model each agent uses, balancing quality vs token spend.

Routes to the set-profile workflow which handles:
- Argument validation (quality/balanced/budget)
- Config file creation if missing
- Profile update in config.json
- Confirmation with model table display
</objective>

<execution_context>- Read file at: ../.claude/get-shit-done/workflows/set-profile.md
</execution_context>

<process>
**Follow the set-profile workflow** from `@../.claude/get-shit-done/workflows/set-profile.md`.

The workflow handles all logic including:
1. Profile argument validation
2. Config file ensuring
3. Config reading and updating
4. Model table generation from MODEL_PROFILES
5. Confirmation display
</process>
