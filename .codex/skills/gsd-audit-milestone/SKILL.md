---
name: "gsd-audit-milestone"
description: "Audit milestone completion against original intent before archiving"
metadata:
  short-description: "Audit milestone completion against original intent before archiving"
---

<codex_skill_adapter>
Codex skills-first mode:
- This skill is invoked by mentioning `$gsd-audit-milestone`.
- Treat all user text after `$gsd-audit-milestone` as `{{GSD_ARGS}}`.
- If no arguments are present, treat `{{GSD_ARGS}}` as empty.

Legacy orchestration compatibility:
- Any `Task(...)` pattern in referenced workflow docs is legacy syntax.
- Implement equivalent behavior with Codex collaboration tools: `spawn_agent`, `wait`, `send_input`, and `close_agent`.
- Treat legacy `subagent_type` names as role hints in the spawned message.
</codex_skill_adapter>

<objective>
Verify milestone achieved its definition of done. Check requirements coverage, cross-phase integration, and end-to-end flows.

**This command IS the orchestrator.** Reads existing VERIFICATION.md files (phases already verified during execute-phase), aggregates tech debt and deferred gaps, then spawns integration checker for cross-phase wiring.
</objective>

<execution_context>
@./.codex/get-shit-done/workflows/audit-milestone.md
</execution_context>

<context>
Version: {{GSD_ARGS}} (optional — defaults to current milestone)

Core planning files are resolved in-workflow (`init milestone-op`) and loaded only as needed.

**Completed Work:**
Glob: .planning/phases/*/*-SUMMARY.md
Glob: .planning/phases/*/*-VERIFICATION.md
</context>

<process>
Execute the audit-milestone workflow from @./.codex/get-shit-done/workflows/audit-milestone.md end-to-end.
Preserve all workflow gates (scope determination, verification reading, integration check, requirements coverage, routing).
</process>
