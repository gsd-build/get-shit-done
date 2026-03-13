---
name: "gsd-progress"
description: "Check project progress, show context, and route to next action (execute or plan)"
metadata:
  short-description: "Check project progress, show context, and route to next action (execute or plan)"
---

<codex_skill_adapter>
Codex skills-first mode:
- This skill is invoked by mentioning `$gsd-progress`.
- Treat all user text after `$gsd-progress` as `{{GSD_ARGS}}`.
- If no arguments are present, treat `{{GSD_ARGS}}` as empty.

Legacy orchestration compatibility:
- Any `Task(...)` pattern in referenced workflow docs is legacy syntax.
- Implement equivalent behavior with Codex collaboration tools: `spawn_agent`, `wait`, `send_input`, and `close_agent`.
- Treat legacy `subagent_type` names as role hints in the spawned message.
</codex_skill_adapter>

<objective>
Check project progress, summarize recent work and what's ahead, then intelligently route to the next action - either executing an existing plan or creating the next one.

Provides situational awareness before continuing work.
</objective>

<execution_context>
@./.codex/get-shit-done/workflows/progress.md
</execution_context>

<process>
Execute the progress workflow from @./.codex/get-shit-done/workflows/progress.md end-to-end.
Preserve all routing logic (Routes A through F) and edge case handling.
</process>
