---
name: "gsd-verify-work"
description: "Validate built features through conversational UAT"
metadata:
  short-description: "Validate built features through conversational UAT"
---

<codex_skill_adapter>
Codex skills-first mode:
- This skill is invoked by mentioning `$gsd-verify-work`.
- Treat all user text after `$gsd-verify-work` as `{{GSD_ARGS}}`.
- If no arguments are present, treat `{{GSD_ARGS}}` as empty.

Legacy orchestration compatibility:
- Any `Task(...)` pattern in referenced workflow docs is legacy syntax.
- Implement equivalent behavior with Codex collaboration tools: `spawn_agent`, `wait`, `send_input`, and `close_agent`.
- Treat legacy `subagent_type` names as role hints in the spawned message.
</codex_skill_adapter>

<objective>
Validate built features through conversational testing with persistent state.

Purpose: Confirm what Claude built actually works from user's perspective. One test at a time, plain text responses, no interrogation. When issues are found, automatically diagnose, plan fixes, and prepare for execution.

Output: {phase_num}-UAT.md tracking all test results. If issues found: diagnosed gaps, verified fix plans ready for $gsd-execute-phase
</objective>

<execution_context>
@./.codex/get-shit-done/workflows/verify-work.md
@./.codex/get-shit-done/templates/UAT.md
</execution_context>

<context>
Phase: {{GSD_ARGS}} (optional)
- If provided: Test specific phase (e.g., "4")
- If not provided: Check for active sessions or prompt for phase

Context files are resolved inside the workflow (`init verify-work`) and delegated via `<files_to_read>` blocks.
</context>

<process>
Execute the verify-work workflow from @./.codex/get-shit-done/workflows/verify-work.md end-to-end.
Preserve all workflow gates (session management, test presentation, diagnosis, fix planning, routing).
</process>
