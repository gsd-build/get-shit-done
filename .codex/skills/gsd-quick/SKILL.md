---
name: "gsd-quick"
description: "Execute a quick task with GSD guarantees (atomic commits, state tracking) but skip optional agents"
metadata:
  short-description: "Execute a quick task with GSD guarantees (atomic commits, state tracking) but skip optional agents"
---

<codex_skill_adapter>
Codex skills-first mode:
- This skill is invoked by mentioning `$gsd-quick`.
- Treat all user text after `$gsd-quick` as `{{GSD_ARGS}}`.
- If no arguments are present, treat `{{GSD_ARGS}}` as empty.

Legacy orchestration compatibility:
- Any `Task(...)` pattern in referenced workflow docs is legacy syntax.
- Implement equivalent behavior with Codex collaboration tools: `spawn_agent`, `wait`, `send_input`, and `close_agent`.
- Treat legacy `subagent_type` names as role hints in the spawned message.
</codex_skill_adapter>

<objective>
Execute small, ad-hoc tasks with GSD guarantees (atomic commits, STATE.md tracking).

Quick mode is the same system with a shorter path:
- Spawns gsd-planner (quick mode) + gsd-executor(s)
- Quick tasks live in `.planning/quick/` separate from planned phases
- Updates STATE.md "Quick Tasks Completed" table (NOT ROADMAP.md)

**Default:** Skips research, plan-checker, verifier. Use when you know exactly what to do.

**`--full` flag:** Enables plan-checking (max 2 iterations) and post-execution verification. Use when you want quality guarantees without full milestone ceremony.
</objective>

<execution_context>
@./.codex/get-shit-done/workflows/quick.md
</execution_context>

<context>
{{GSD_ARGS}}

Context files are resolved inside the workflow (`init quick`) and delegated via `<files_to_read>` blocks.
</context>

<process>
Execute the quick workflow from @./.codex/get-shit-done/workflows/quick.md end-to-end.
Preserve all workflow gates (validation, task description, planning, execution, state updates, commits).
</process>
