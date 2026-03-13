---
name: "gsd-pause-work"
description: "Create context handoff when pausing work mid-phase"
metadata:
  short-description: "Create context handoff when pausing work mid-phase"
---

<codex_skill_adapter>
Codex skills-first mode:
- This skill is invoked by mentioning `$gsd-pause-work`.
- Treat all user text after `$gsd-pause-work` as `{{GSD_ARGS}}`.
- If no arguments are present, treat `{{GSD_ARGS}}` as empty.

Legacy orchestration compatibility:
- Any `Task(...)` pattern in referenced workflow docs is legacy syntax.
- Implement equivalent behavior with Codex collaboration tools: `spawn_agent`, `wait`, `send_input`, and `close_agent`.
- Treat legacy `subagent_type` names as role hints in the spawned message.
</codex_skill_adapter>

<objective>
Create `.continue-here.md` handoff file to preserve complete work state across sessions.

Routes to the pause-work workflow which handles:
- Current phase detection from recent files
- Complete state gathering (position, completed work, remaining work, decisions, blockers)
- Handoff file creation with all context sections
- Git commit as WIP
- Resume instructions
</objective>

<execution_context>
@./.codex/get-shit-done/workflows/pause-work.md
</execution_context>

<context>
State and phase progress are gathered in-workflow with targeted reads.
</context>

<process>
**Follow the pause-work workflow** from `@./.codex/get-shit-done/workflows/pause-work.md`.

The workflow handles all logic including:
1. Phase directory detection
2. State gathering with user clarifications
3. Handoff file writing with timestamp
4. Git commit
5. Confirmation with resume instructions
</process>
