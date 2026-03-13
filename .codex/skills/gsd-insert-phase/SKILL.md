---
name: "gsd-insert-phase"
description: "Insert urgent work as decimal phase (e.g., 72.1) between existing phases"
metadata:
  short-description: "Insert urgent work as decimal phase (e.g., 72.1) between existing phases"
---

<codex_skill_adapter>
Codex skills-first mode:
- This skill is invoked by mentioning `$gsd-insert-phase`.
- Treat all user text after `$gsd-insert-phase` as `{{GSD_ARGS}}`.
- If no arguments are present, treat `{{GSD_ARGS}}` as empty.

Legacy orchestration compatibility:
- Any `Task(...)` pattern in referenced workflow docs is legacy syntax.
- Implement equivalent behavior with Codex collaboration tools: `spawn_agent`, `wait`, `send_input`, and `close_agent`.
- Treat legacy `subagent_type` names as role hints in the spawned message.
</codex_skill_adapter>

<objective>
Insert a decimal phase for urgent work discovered mid-milestone that must be completed between existing integer phases.

Uses decimal numbering (72.1, 72.2, etc.) to preserve the logical sequence of planned phases while accommodating urgent insertions.

Purpose: Handle urgent work discovered during execution without renumbering entire roadmap.
</objective>

<execution_context>
@./.codex/get-shit-done/workflows/insert-phase.md
</execution_context>

<context>
Arguments: {{GSD_ARGS}} (format: <after-phase-number> <description>)

Roadmap and state are resolved in-workflow via `init phase-op` and targeted tool calls.
</context>

<process>
Execute the insert-phase workflow from @./.codex/get-shit-done/workflows/insert-phase.md end-to-end.
Preserve all validation gates (argument parsing, phase verification, decimal calculation, roadmap updates).
</process>
