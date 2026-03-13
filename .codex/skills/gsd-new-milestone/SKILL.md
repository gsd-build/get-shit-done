---
name: "gsd-new-milestone"
description: "Start a new milestone cycle — update PROJECT.md and route to requirements"
metadata:
  short-description: "Start a new milestone cycle — update PROJECT.md and route to requirements"
---

<codex_skill_adapter>
Codex skills-first mode:
- This skill is invoked by mentioning `$gsd-new-milestone`.
- Treat all user text after `$gsd-new-milestone` as `{{GSD_ARGS}}`.
- If no arguments are present, treat `{{GSD_ARGS}}` as empty.

Legacy orchestration compatibility:
- Any `Task(...)` pattern in referenced workflow docs is legacy syntax.
- Implement equivalent behavior with Codex collaboration tools: `spawn_agent`, `wait`, `send_input`, and `close_agent`.
- Treat legacy `subagent_type` names as role hints in the spawned message.
</codex_skill_adapter>

<objective>
Start a new milestone: questioning → research (optional) → requirements → roadmap.

Brownfield equivalent of new-project. Project exists, PROJECT.md has history. Gathers "what's next", updates PROJECT.md, then runs requirements → roadmap cycle.

**Creates/Updates:**
- `.planning/PROJECT.md` — updated with new milestone goals
- `.planning/research/` — domain research (optional, NEW features only)
- `.planning/REQUIREMENTS.md` — scoped requirements for this milestone
- `.planning/ROADMAP.md` — phase structure (continues numbering)
- `.planning/STATE.md` — reset for new milestone

**After:** `$gsd-plan-phase [N]` to start execution.
</objective>

<execution_context>
@./.codex/get-shit-done/workflows/new-milestone.md
@./.codex/get-shit-done/references/questioning.md
@./.codex/get-shit-done/references/ui-brand.md
@./.codex/get-shit-done/templates/project.md
@./.codex/get-shit-done/templates/requirements.md
</execution_context>

<context>
Milestone name: {{GSD_ARGS}} (optional - will prompt if not provided)

Project and milestone context files are resolved inside the workflow (`init new-milestone`) and delegated via `<files_to_read>` blocks where subagents are used.
</context>

<process>
Execute the new-milestone workflow from @./.codex/get-shit-done/workflows/new-milestone.md end-to-end.
Preserve all workflow gates (validation, questioning, research, requirements, roadmap approval, commits).
</process>
