---
name: "gsd-add-todo"
description: "Capture idea or task as todo from current conversation context"
metadata:
  short-description: "Capture idea or task as todo from current conversation context"
---

<codex_skill_adapter>
Codex skills-first mode:
- This skill is invoked by mentioning `$gsd-add-todo`.
- Treat all user text after `$gsd-add-todo` as `{{GSD_ARGS}}`.
- If no arguments are present, treat `{{GSD_ARGS}}` as empty.

Legacy orchestration compatibility:
- Any `Task(...)` pattern in referenced workflow docs is legacy syntax.
- Implement equivalent behavior with Codex collaboration tools: `spawn_agent`, `wait`, `send_input`, and `close_agent`.
- Treat legacy `subagent_type` names as role hints in the spawned message.
</codex_skill_adapter>

<objective>
Capture an idea, task, or issue that surfaces during a GSD session as a structured todo for later work.

Routes to the add-todo workflow which handles:
- Directory structure creation
- Content extraction from arguments or conversation
- Area inference from file paths
- Duplicate detection and resolution
- Todo file creation with frontmatter
- STATE.md updates
- Git commits
</objective>

<execution_context>
@./.codex/get-shit-done/workflows/add-todo.md
</execution_context>

<context>
Arguments: {{GSD_ARGS}} (optional todo description)

State is resolved in-workflow via `init todos` and targeted reads.
</context>

<process>
**Follow the add-todo workflow** from `@./.codex/get-shit-done/workflows/add-todo.md`.

The workflow handles all logic including:
1. Directory ensuring
2. Existing area checking
3. Content extraction (arguments or conversation)
4. Area inference
5. Duplicate checking
6. File creation with slug generation
7. STATE.md updates
8. Git commits
</process>
