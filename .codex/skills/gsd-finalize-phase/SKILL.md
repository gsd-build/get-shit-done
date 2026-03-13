---
name: "gsd-finalize-phase"
description: "Finalize a completed phase — verify gates, merge to main, cleanup worktree"
metadata:
  short-description: "Finalize a completed phase — verify gates, merge to main, cleanup worktree"
---

<codex_skill_adapter>
Codex skills-first mode:
- This skill is invoked by mentioning `$gsd-finalize-phase`.
- Treat all user text after `$gsd-finalize-phase` as `{{GSD_ARGS}}`.
- If no arguments are present, treat `{{GSD_ARGS}}` as empty.

Legacy orchestration compatibility:
- Any `Task(...)` pattern in referenced workflow docs is legacy syntax.
- Implement equivalent behavior with Codex collaboration tools: `spawn_agent`, `wait`, `send_input`, and `close_agent`.
- Treat legacy `subagent_type` names as role hints in the spawned message.
</codex_skill_adapter>

<objective>
Finalize a completed phase by verifying all gates pass (UAT, tests, verification), merging the phase branch to main, and cleaning up the git worktree.

This ensures a phase is properly closed out before moving to the next phase.
</objective>

<execution_context>
@./.codex/get-shit-done/workflows/finalize-phase.md
@./.codex/get-shit-done/references/ui-brand.md
</execution_context>

<context>
Phase: {{GSD_ARGS}}

**Gates verified:**
1. UAT passed (or not required for infrastructure phases)
2. Tests pass (if test suite exists)
3. Verification passed

**Actions performed:**
1. Merge phase branch to main (--no-ff)
2. Remove git worktree (if applicable)
3. Delete phase branch (it's merged)
4. Update STATE.md
</context>

<process>
Execute the finalize-phase workflow from @./.codex/get-shit-done/workflows/finalize-phase.md end-to-end.
Preserve all workflow gates (UAT check, verification check, tests, merge, cleanup).
</process>
