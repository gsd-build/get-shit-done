---
name: "gsd-new-project"
description: "Initialize a new project with deep context gathering and PROJECT.md"
metadata:
  short-description: "Initialize a new project with deep context gathering and PROJECT.md"
---

<codex_skill_adapter>
Codex skills-first mode:
- This skill is invoked by mentioning `$gsd-new-project`.
- Treat all user text after `$gsd-new-project` as `{{GSD_ARGS}}`.
- If no arguments are present, treat `{{GSD_ARGS}}` as empty.

Legacy orchestration compatibility:
- Any `Task(...)` pattern in referenced workflow docs is legacy syntax.
- Implement equivalent behavior with Codex collaboration tools: `spawn_agent`, `wait`, `send_input`, and `close_agent`.
- Treat legacy `subagent_type` names as role hints in the spawned message.
</codex_skill_adapter>

<context>
**Flags:**
- `--auto` — Automatic mode. After config questions, runs research → requirements → roadmap without further interaction. Expects idea document via @ reference.
</context>

<objective>
Initialize a new project through unified flow: questioning → research (optional) → requirements → roadmap.

**Creates:**
- `.planning/PROJECT.md` — project context
- `.planning/config.json` — workflow preferences
- `.planning/research/` — domain research (optional)
- `.planning/REQUIREMENTS.md` — scoped requirements
- `.planning/ROADMAP.md` — phase structure
- `.planning/STATE.md` — project memory

**After this command:** Run `$gsd-plan-phase 1` to start execution.
</objective>

<execution_context>
@./.codex/get-shit-done/workflows/new-project.md
@./.codex/get-shit-done/references/questioning.md
@./.codex/get-shit-done/references/ui-brand.md
@./.codex/get-shit-done/templates/project.md
@./.codex/get-shit-done/templates/requirements.md
</execution_context>

<process>
Execute the new-project workflow from @./.codex/get-shit-done/workflows/new-project.md end-to-end.
Preserve all workflow gates (validation, approvals, commits, routing).
</process>
