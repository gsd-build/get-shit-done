---
name: "gsd-resume-work"
description: "Resume work from previous session with full context restoration"
metadata:
  short-description: "Resume work from previous session with full context restoration"
---

<codex_skill_adapter>
Codex skills-first mode:
- This skill is invoked by mentioning `$gsd-resume-work`.
- Treat all user text after `$gsd-resume-work` as `{{GSD_ARGS}}`.
- If no arguments are present, treat `{{GSD_ARGS}}` as empty.

Legacy orchestration compatibility:
- Any `Task(...)` pattern in referenced workflow docs is legacy syntax.
- Implement equivalent behavior with Codex collaboration tools: `spawn_agent`, `wait`, `send_input`, and `close_agent`.
- Treat legacy `subagent_type` names as role hints in the spawned message.
</codex_skill_adapter>

<objective>
Restore complete project context and resume work seamlessly from previous session.

Routes to the resume-project workflow which handles:

- STATE.md loading (or reconstruction if missing)
- Checkpoint detection (.continue-here files)
- Incomplete work detection (PLAN without SUMMARY)
- Status presentation
- Context-aware next action routing
  </objective>

<execution_context>
@./.codex/get-shit-done/workflows/resume-project.md
</execution_context>

<process>
**Follow the resume-project workflow** from `@./.codex/get-shit-done/workflows/resume-project.md`.

The workflow handles all resumption logic including:

1. Project existence verification
2. STATE.md loading or reconstruction
3. Checkpoint and incomplete work detection
4. Visual status presentation
5. Context-aware option offering (checks CONTEXT.md before suggesting plan vs discuss)
6. Routing to appropriate next command
7. Session continuity updates
   </process>
