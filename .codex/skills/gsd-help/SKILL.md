---
name: "gsd-help"
description: "Show available GSD commands and usage guide"
metadata:
  short-description: "Show available GSD commands and usage guide"
---

<codex_skill_adapter>
Codex skills-first mode:
- This skill is invoked by mentioning `$gsd-help`.
- Treat all user text after `$gsd-help` as `{{GSD_ARGS}}`.
- If no arguments are present, treat `{{GSD_ARGS}}` as empty.

Legacy orchestration compatibility:
- Any `Task(...)` pattern in referenced workflow docs is legacy syntax.
- Implement equivalent behavior with Codex collaboration tools: `spawn_agent`, `wait`, `send_input`, and `close_agent`.
- Treat legacy `subagent_type` names as role hints in the spawned message.
</codex_skill_adapter>

<objective>
Display the complete GSD command reference.

Output ONLY the reference content below. Do NOT add:
- Project-specific analysis
- Git status or file context
- Next-step suggestions
- Any commentary beyond the reference
</objective>

<execution_context>
@./.codex/get-shit-done/workflows/help.md
</execution_context>

<process>
Output the complete GSD command reference from @./.codex/get-shit-done/workflows/help.md.
Display the reference content directly — no additions or modifications.
</process>
