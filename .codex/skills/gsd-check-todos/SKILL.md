---
name: "gsd-check-todos"
description: "List pending todos and select one to work on"
metadata:
  short-description: "List pending todos and select one to work on"
---

<codex_skill_adapter>
Codex skills-first mode:
- This skill is invoked by mentioning `$gsd-check-todos`.
- Treat all user text after `$gsd-check-todos` as `{{GSD_ARGS}}`.
- If no arguments are present, treat `{{GSD_ARGS}}` as empty.

Legacy orchestration compatibility:
- Any `Task(...)` pattern in referenced workflow docs is legacy syntax.
- Implement equivalent behavior with Codex collaboration tools: `spawn_agent`, `wait`, `send_input`, and `close_agent`.
- Treat legacy `subagent_type` names as role hints in the spawned message.
</codex_skill_adapter>

<objective>
List all pending todos, allow selection, load full context for the selected todo, and route to appropriate action.

Routes to the check-todos workflow which handles:
- Todo counting and listing with area filtering
- Interactive selection with full context loading
- Roadmap correlation checking
- Action routing (work now, add to phase, brainstorm, create phase)
- STATE.md updates and git commits
</objective>

<execution_context>
@./.codex/get-shit-done/workflows/check-todos.md
</execution_context>

<context>
Arguments: {{GSD_ARGS}} (optional area filter)

Todo state and roadmap correlation are loaded in-workflow using `init todos` and targeted reads.
</context>

<process>
**Follow the check-todos workflow** from `@./.codex/get-shit-done/workflows/check-todos.md`.

The workflow handles all logic including:
1. Todo existence checking
2. Area filtering
3. Interactive listing and selection
4. Full context loading with file summaries
5. Roadmap correlation checking
6. Action offering and execution
7. STATE.md updates
8. Git commits
</process>
