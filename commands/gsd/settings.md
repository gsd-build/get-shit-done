---
name: gsd:settings
description: Configure GSD workflow toggles and model profile
allowed-tools:
  - Read
  - Write
  - Bash
  - AskUserQuestion
---

<objective>
Interactive configuration of GSD workflow agents and model profile via multi-question prompt.

Routes to the settings workflow which handles:
- Config existence ensuring
- Current settings reading and parsing
- Interactive settings prompt in 2 rounds (respecting AskUserQuestion 4-question limit)
- Round 1: model, research, plan_check, verifier (4 questions)
- Round 2: TDD, security compliance, branching (3 questions)
- Config merging and writing
- Confirmation display with quick command references
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/settings.md
</execution_context>

<process>
**Follow the settings workflow** from `@~/.claude/get-shit-done/workflows/settings.md`.

The workflow handles all logic including:
1. Config file creation with defaults if missing
2. Current config reading
3. Interactive settings presentation in 2 rounds with pre-selection
4. Answer parsing and config merging
5. File writing
6. Confirmation display
</process>
