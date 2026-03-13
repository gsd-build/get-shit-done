---
name: "gsd-set-profile"
description: "Switch model profile for GSD agents (quality/balanced/budget)"
metadata:
  short-description: "Switch model profile for GSD agents (quality/balanced/budget)"
---

<codex_skill_adapter>
Codex skills-first mode:
- This skill is invoked by mentioning `$gsd-set-profile`.
- Treat all user text after `$gsd-set-profile` as `{{GSD_ARGS}}`.
- If no arguments are present, treat `{{GSD_ARGS}}` as empty.

Legacy orchestration compatibility:
- Any `Task(...)` pattern in referenced workflow docs is legacy syntax.
- Implement equivalent behavior with Codex collaboration tools: `spawn_agent`, `wait`, `send_input`, and `close_agent`.
- Treat legacy `subagent_type` names as role hints in the spawned message.
</codex_skill_adapter>

<objective>
Switch the model profile used by GSD agents. Controls which Claude model each agent uses, balancing quality vs token spend.

Routes to the set-profile workflow which handles:
- Argument validation (quality/balanced/budget)
- Config file creation if missing
- Profile update in config.json
- Confirmation with model table display
</objective>

<execution_context>
@./.codex/get-shit-done/workflows/set-profile.md
</execution_context>

<process>
**Follow the set-profile workflow** from `@./.codex/get-shit-done/workflows/set-profile.md`.

The workflow handles all logic including:
1. Profile argument validation
2. Config file ensuring
3. Config reading and updating
4. Model table generation from MODEL_PROFILES
5. Confirmation display
</process>
