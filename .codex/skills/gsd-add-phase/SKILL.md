---
name: "gsd-add-phase"
description: "Add phase to end of current milestone in roadmap"
metadata:
  short-description: "Add phase to end of current milestone in roadmap"
---

<codex_skill_adapter>
Codex skills-first mode:
- This skill is invoked by mentioning `$gsd-add-phase`.
- Treat all user text after `$gsd-add-phase` as `{{GSD_ARGS}}`.
- If no arguments are present, treat `{{GSD_ARGS}}` as empty.

Legacy orchestration compatibility:
- Any `Task(...)` pattern in referenced workflow docs is legacy syntax.
- Implement equivalent behavior with Codex collaboration tools: `spawn_agent`, `wait`, `send_input`, and `close_agent`.
- Treat legacy `subagent_type` names as role hints in the spawned message.
</codex_skill_adapter>

<objective>
Add a new integer phase to the end of the current milestone in the roadmap.

Routes to the add-phase workflow which handles:
- Phase number calculation (next sequential integer)
- Directory creation with slug generation
- Roadmap structure updates
- STATE.md roadmap evolution tracking
</objective>

<execution_context>
@./.codex/get-shit-done/workflows/add-phase.md
</execution_context>

<context>
Arguments: {{GSD_ARGS}} (phase description)

Roadmap and state are resolved in-workflow via `init phase-op` and targeted tool calls.
</context>

<process>
**Follow the add-phase workflow** from `@./.codex/get-shit-done/workflows/add-phase.md`.

The workflow handles all logic including:
1. Argument parsing and validation
2. Roadmap existence checking
3. Current milestone identification
4. Next phase number calculation (ignoring decimals)
5. Slug generation from description
6. Phase directory creation
7. Roadmap entry insertion
8. STATE.md updates
</process>
