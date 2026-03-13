---
name: "gsd-health"
description: "Diagnose planning directory health and optionally repair issues"
metadata:
  short-description: "Diagnose planning directory health and optionally repair issues"
---

<codex_skill_adapter>
Codex skills-first mode:
- This skill is invoked by mentioning `$gsd-health`.
- Treat all user text after `$gsd-health` as `{{GSD_ARGS}}`.
- If no arguments are present, treat `{{GSD_ARGS}}` as empty.

Legacy orchestration compatibility:
- Any `Task(...)` pattern in referenced workflow docs is legacy syntax.
- Implement equivalent behavior with Codex collaboration tools: `spawn_agent`, `wait`, `send_input`, and `close_agent`.
- Treat legacy `subagent_type` names as role hints in the spawned message.
</codex_skill_adapter>

<objective>
Validate `.planning/` directory integrity and report actionable issues. Checks for missing files, invalid configurations, inconsistent state, and orphaned plans.
</objective>

<execution_context>
@./.codex/get-shit-done/workflows/health.md
</execution_context>

<process>
Execute the health workflow from @./.codex/get-shit-done/workflows/health.md end-to-end.
Parse --repair flag from arguments and pass to workflow.
</process>
