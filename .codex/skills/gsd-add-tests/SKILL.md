---
name: "gsd-add-tests"
description: "Generate tests for a completed phase based on UAT criteria and implementation"
metadata:
  short-description: "Generate tests for a completed phase based on UAT criteria and implementation"
---

<codex_skill_adapter>
Codex skills-first mode:
- This skill is invoked by mentioning `$gsd-add-tests`.
- Treat all user text after `$gsd-add-tests` as `{{GSD_ARGS}}`.
- If no arguments are present, treat `{{GSD_ARGS}}` as empty.

Legacy orchestration compatibility:
- Any `Task(...)` pattern in referenced workflow docs is legacy syntax.
- Implement equivalent behavior with Codex collaboration tools: `spawn_agent`, `wait`, `send_input`, and `close_agent`.
- Treat legacy `subagent_type` names as role hints in the spawned message.
</codex_skill_adapter>

<objective>
Generate unit and E2E tests for a completed phase, using its SUMMARY.md, CONTEXT.md, and VERIFICATION.md as specifications.

Analyzes implementation files, classifies them into TDD (unit), E2E (browser), or Skip categories, presents a test plan for user approval, then generates tests following RED-GREEN conventions.

Output: Test files committed with message `test(phase-{N}): add unit and E2E tests from add-tests command`
</objective>

<execution_context>
@./.codex/get-shit-done/workflows/add-tests.md
</execution_context>

<context>
Phase: {{GSD_ARGS}}

@.planning/STATE.md
@.planning/ROADMAP.md
</context>

<process>
Execute the add-tests workflow from @./.codex/get-shit-done/workflows/add-tests.md end-to-end.
Preserve all workflow gates (classification approval, test plan approval, RED-GREEN verification, gap reporting).
</process>
