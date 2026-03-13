---
name: "gsd-remove-phase"
description: "Remove a future phase from roadmap and renumber subsequent phases"
metadata:
  short-description: "Remove a future phase from roadmap and renumber subsequent phases"
---

<codex_skill_adapter>
Codex skills-first mode:
- This skill is invoked by mentioning `$gsd-remove-phase`.
- Treat all user text after `$gsd-remove-phase` as `{{GSD_ARGS}}`.
- If no arguments are present, treat `{{GSD_ARGS}}` as empty.

Legacy orchestration compatibility:
- Any `Task(...)` pattern in referenced workflow docs is legacy syntax.
- Implement equivalent behavior with Codex collaboration tools: `spawn_agent`, `wait`, `send_input`, and `close_agent`.
- Treat legacy `subagent_type` names as role hints in the spawned message.
</codex_skill_adapter>

<objective>
Remove an unstarted future phase from the roadmap and renumber all subsequent phases to maintain a clean, linear sequence.

Purpose: Clean removal of work you've decided not to do, without polluting context with cancelled/deferred markers.
Output: Phase deleted, all subsequent phases renumbered, git commit as historical record.
</objective>

<execution_context>
@./.codex/get-shit-done/workflows/remove-phase.md
</execution_context>

<context>
Phase: {{GSD_ARGS}}

Roadmap and state are resolved in-workflow via `init phase-op` and targeted reads.
</context>

<process>
Execute the remove-phase workflow from @./.codex/get-shit-done/workflows/remove-phase.md end-to-end.
Preserve all validation gates (future phase check, work check), renumbering logic, and commit.
</process>
