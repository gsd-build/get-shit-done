---
name: "gsd-plan-phase"
description: "Create detailed phase plan (PLAN.md) with verification loop"
metadata:
  short-description: "Create detailed phase plan (PLAN.md) with verification loop"
---

<codex_skill_adapter>
Codex skills-first mode:
- This skill is invoked by mentioning `$gsd-plan-phase`.
- Treat all user text after `$gsd-plan-phase` as `{{GSD_ARGS}}`.
- If no arguments are present, treat `{{GSD_ARGS}}` as empty.

Legacy orchestration compatibility:
- Any `Task(...)` pattern in referenced workflow docs is legacy syntax.
- Implement equivalent behavior with Codex collaboration tools: `spawn_agent`, `wait`, `send_input`, and `close_agent`.
- Treat legacy `subagent_type` names as role hints in the spawned message.
</codex_skill_adapter>

<objective>
Create executable phase prompts (PLAN.md files) for a roadmap phase with integrated research and verification.

**Default flow:** Research (if needed) → Plan → Verify → Done

**Orchestrator role:** Parse arguments, validate phase, research domain (unless skipped), spawn gsd-planner, verify with gsd-plan-checker, iterate until pass or max iterations, present results.
</objective>

<execution_context>
@./.codex/get-shit-done/workflows/plan-phase.md
@./.codex/get-shit-done/references/ui-brand.md
</execution_context>

<context>
Phase number: {{GSD_ARGS}} (optional — auto-detects next unplanned phase if omitted)

**Flags:**
- `--research` — Force re-research even if RESEARCH.md exists
- `--skip-research` — Skip research, go straight to planning
- `--gaps` — Gap closure mode (reads VERIFICATION.md, skips research)
- `--skip-verify` — Skip verification loop
- `--prd <file>` — Use a PRD/acceptance criteria file instead of discuss-phase. Parses requirements into CONTEXT.md automatically. Skips discuss-phase entirely.

Normalize phase input in step 2 before any directory lookups.
</context>

<process>
Execute the plan-phase workflow from @./.codex/get-shit-done/workflows/plan-phase.md end-to-end.
Preserve all workflow gates (validation, research, planning, verification loop, routing).
</process>
