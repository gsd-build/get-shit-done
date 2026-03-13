---
name: "gsd-update"
description: "Update GSD to latest version with changelog display"
metadata:
  short-description: "Update GSD to latest version with changelog display"
---

<codex_skill_adapter>
Codex skills-first mode:
- This skill is invoked by mentioning `$gsd-update`.
- Treat all user text after `$gsd-update` as `{{GSD_ARGS}}`.
- If no arguments are present, treat `{{GSD_ARGS}}` as empty.

Legacy orchestration compatibility:
- Any `Task(...)` pattern in referenced workflow docs is legacy syntax.
- Implement equivalent behavior with Codex collaboration tools: `spawn_agent`, `wait`, `send_input`, and `close_agent`.
- Treat legacy `subagent_type` names as role hints in the spawned message.
</codex_skill_adapter>

<objective>
Check for GSD updates, install if available, and display what changed.

Routes to the update workflow which handles:
- Version detection (local vs global installation)
- npm version checking
- Changelog fetching and display
- User confirmation with clean install warning
- Update execution and cache clearing
- Restart reminder
</objective>

<execution_context>
@./.codex/get-shit-done/workflows/update.md
</execution_context>

<process>
**Follow the update workflow** from `@./.codex/get-shit-done/workflows/update.md`.

The workflow handles all logic including:
1. Installed version detection (local/global)
2. Latest version checking via npm
3. Version comparison
4. Changelog fetching and extraction
5. Clean install warning display
6. User confirmation
7. Update execution
8. Cache clearing
</process>
