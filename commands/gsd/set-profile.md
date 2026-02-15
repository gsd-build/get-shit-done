---
name: gsd:set-profile
description: Switch model profile for GSD agents (quality/balanced/budget)
argument-hint: <profile>
allowed-tools:
  - Read
  - Write
  - Bash
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
@~/.claude/get-shit-done/workflows/set-profile.md
</execution_context>

<process>
**Follow the set-profile workflow** from `@~/.claude/get-shit-done/workflows/set-profile.md`.

The workflow handles all logic including:
1. Profile argument validation
2. Config file ensuring
3. Config reading and updating
4. Model table generation from MODEL_PROFILES
5. Confirmation display
</process>
