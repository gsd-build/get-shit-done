---
name: "gsd-plan-milestone-gaps"
description: "Create phases to close all gaps identified by milestone audit"
metadata:
  short-description: "Create phases to close all gaps identified by milestone audit"
---

<codex_skill_adapter>
Codex skills-first mode:
- This skill is invoked by mentioning `$gsd-plan-milestone-gaps`.
- Treat all user text after `$gsd-plan-milestone-gaps` as `{{GSD_ARGS}}`.
- If no arguments are present, treat `{{GSD_ARGS}}` as empty.

Legacy orchestration compatibility:
- Any `Task(...)` pattern in referenced workflow docs is legacy syntax.
- Implement equivalent behavior with Codex collaboration tools: `spawn_agent`, `wait`, `send_input`, and `close_agent`.
- Treat legacy `subagent_type` names as role hints in the spawned message.
</codex_skill_adapter>

<objective>
Create all phases necessary to close gaps identified by `$gsd-audit-milestone`.

Reads MILESTONE-AUDIT.md, groups gaps into logical phases, creates phase entries in ROADMAP.md, and offers to plan each phase.

One command creates all fix phases — no manual `$gsd-add-phase` per gap.
</objective>

<execution_context>
@./.codex/get-shit-done/workflows/plan-milestone-gaps.md
</execution_context>

<context>
**Audit results:**
Glob: .planning/v*-MILESTONE-AUDIT.md (use most recent)

Original intent and current planning state are loaded on demand inside the workflow.
</context>

<process>
Execute the plan-milestone-gaps workflow from @./.codex/get-shit-done/workflows/plan-milestone-gaps.md end-to-end.
Preserve all workflow gates (audit loading, prioritization, phase grouping, user confirmation, roadmap updates).
</process>
