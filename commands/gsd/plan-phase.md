---
name: gsd:plan-phase
description: Create detailed phase plan (PLAN.md) with verification loop
argument-hint: "[phase] [--auto] [--research] [--skip-research] [--gaps] [--skip-verify] [--prd <file>] [--reviews] [--text]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - Task
  - AskUserQuestion
---
<objective>
Create executable phase prompts (PLAN.md files) for a roadmap phase with integrated research and verification.

**Default flow:** Research (if needed) -> Plan -> Verify -> Done

**Orchestrator role:** Thin dispatcher — parse arguments, validate phase, spawn a general-purpose subagent with the plan-phase workflow, manage checkpoint lifecycle for resumability.
<!-- general-purpose is intentional: the subagent runs the full workflow
     which internally spawns gsd-planner, gsd-phase-researcher, and
     gsd-plan-checker as named agents. -->
</objective>

<runtime_note>
**Copilot (VS Code):** Use `vscode_askquestions` wherever this workflow calls `AskUserQuestion`. They are equivalent — `vscode_askquestions` is the VS Code Copilot implementation of the same interactive question API. Do not skip questioning steps because `AskUserQuestion` appears unavailable; use `vscode_askquestions` instead.
</runtime_note>

<context>
Phase number: $ARGUMENTS (optional — auto-detects next unplanned phase if omitted)

**Flags:**
- `--auto` — Automated mode: skip interactive prompts, auto-chain to next phase
- `--research` — Force re-research even if RESEARCH.md exists
- `--skip-research` — Skip research, go straight to planning
- `--gaps` — Gap closure mode (reads VERIFICATION.md, skips research)
- `--skip-verify` — Skip verification loop
- `--prd <file>` — Use a PRD/acceptance criteria file instead of discuss-phase. Parses requirements into CONTEXT.md automatically. Skips discuss-phase entirely.
- `--reviews` — Replan incorporating cross-AI review feedback from REVIEWS.md (produced by `/gsd:review`)
- `--text` — Use plain-text numbered lists instead of TUI menus (required for `/rc` remote sessions)

Normalize phase input in step 2 before any directory lookups.
</context>

<process>
1. Parse `$ARGUMENTS` for phase number. Run `gsd-sdk query init.plan-phase "$PHASE"` to get `phase_dir`.
2. Check `{phase_dir}/dispatch-state.json`:
   - Missing: fresh run.
   - Present but `timestamp` older than 24 hours: ignore (stale), start fresh.
   - Present and recent: pass as resume context to subagent.
<!-- general-purpose is intentional: see rationale in <objective>. -->
3. Spawn a `general-purpose` subagent with prompt:

You are executing the GSD plan-phase workflow.
Arguments: {$ARGUMENTS}
Phase directory: {phase_dir}
{if checkpoint: "Resume from checkpoint stage: {last_completed}, iteration {iteration}. Skip completed stages and continue from after that stage."}
Read ~/.claude/get-shit-done/workflows/plan-phase.md and execute end-to-end.
After each stage, write {phase_dir}/dispatch-state.json:
{"workflow":"plan-phase","phase":"{slug}","last_completed":"{stage}","iteration":{N},"timestamp":"{ISO}"}
Valid last_completed values: "init", "research", "planning", "verification"
On success, delete {phase_dir}/dispatch-state.json.
Return summary of produced artifacts (RESEARCH.md, PLAN.md, VERIFICATION.md).
If the workflow file does not exist, report the error and stop.
</process>
