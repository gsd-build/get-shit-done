---
name: "gsd-settings"
description: "Configure GSD workflow toggles and model profile"
metadata:
  short-description: "Configure GSD workflow toggles and model profile"
---

<codex_skill_adapter>
Codex skills-first mode:
- This skill is invoked by mentioning `$gsd-settings`.
- Treat all user text after `$gsd-settings` as `{{GSD_ARGS}}`.
- If no arguments are present, treat `{{GSD_ARGS}}` as empty.

Legacy orchestration compatibility:
- Any `Task(...)` pattern in referenced workflow docs is legacy syntax.
- Implement equivalent behavior with Codex collaboration tools: `spawn_agent`, `wait`, `send_input`, and `close_agent`.
- Treat legacy `subagent_type` names as role hints in the spawned message.
</codex_skill_adapter>

<objective>
Interactive configuration of GSD workflow agents and model profile via multi-question prompt.

Routes to the settings workflow which handles:
- Config existence ensuring
- Current settings reading and parsing
- Interactive 5-question prompt (model, research, plan_check, verifier, branching)
- Config merging and writing
- Confirmation display with quick command references
</objective>

<execution_context>
@./.codex/get-shit-done/workflows/settings.md
</execution_context>

<process>
**Follow the settings workflow** from `@./.codex/get-shit-done/workflows/settings.md`.

The workflow handles all logic including:
1. Config file creation with defaults if missing
2. Current config reading
3. Interactive settings presentation with pre-selection
4. Answer parsing and config merging
5. File writing
6. Confirmation display
</process>
