---
name: gsd.set-profile
description: "Switch model profile for GSD agents (quality/balanced/budget)"
argument-hint: "<profile>"
tools: ['edit', 'execute', 'read']
agent: agent
---

<!-- upstream-tools: ["Read","Write","Bash"] -->

## Path Resolution 

  The GSD workflow files contain bash commands that reference `$HOME/.claude/get-shit-done/bin/gsd-tools.cjs`. 
  **In this workspace, the module lives at `.claude/get-shit-done/bin/gsd-tools.cjs` relative to the workspace root — `$HOME` does not apply.
  ** When executing or interpreting any bash snippet from a workflow file, mentally substitute `$HOME/.claude/` → `.claude/` (workspace-relative).
  ---

<objective>
Switch the model profile used by GSD agents. Controls which Claude model each agent uses, balancing quality vs token spend.

Routes to the set-profile workflow which handles:
- Argument validation (quality/balanced/budget)
- Config file creation if missing
- Profile update in config.json
- Confirmation with model table display
</objective>

<execution_context>
- Read file at: ./.claude/get-shit-done/workflows/set-profile.md
</execution_context>

<process>
**Follow the set-profile workflow** from `@./.claude/get-shit-done/workflows/set-profile.md`.

The workflow handles all logic including:
1. Profile argument validation
2. Config file ensuring
3. Config reading and updating
4. Model table generation from MODEL_PROFILES
5. Confirmation display
</process>
