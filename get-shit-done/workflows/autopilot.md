<purpose>
Run the full GSD pipeline for remaining phases in the current milestone — automatically. Thin loop that ensures context exists (via synthetic discuss) then spawns the existing auto-advance chain (plan → execute → verify → transition) for each phase.

This workflow does NOT duplicate logic from discuss-phase, plan-phase, or execute-phase. It's a coordinator that: (a) ensures context exists via synthetic discuss, (b) spawns the existing auto-advance chain, (c) catches return status, and (d) loops.
</purpose>

<core_principle>
One command. Full autopilot. The complexity is in the existing workflows — this just chains them together with fresh context between phases.
</core_principle>

<process>

<step name="initialize" priority="first">
Parse arguments to determine phase range:

- No argument → run from current phase through end of milestone
- Single number (e.g., `5`) → run starting from phase 5
- Range (e.g., `3-7`) → run phases 3 through 7

```bash
INIT=$(node ~/.claude/get-shit-done/bin/gsd-tools.cjs init progress)
```

Parse JSON for: `phases`, `current_phase`, `milestone_version`, `milestone_name`, `phase_count`, `completed_count`, `roadmap_exists`, `state_exists`.

**If `roadmap_exists` is false:** Error — no roadmap found. Run `/gsd:new-project` first.

```bash
ROADMAP=$(node ~/.claude/get-shit-done/bin/gsd-tools.cjs roadmap analyze)
```

Parse roadmap analysis for all phases with goals, status, and completion info.

**Determine phase list:**

Filter to incomplete phases within the requested range. Skip phases already marked complete.

If no incomplete phases remain:
```
All phases in range are complete.

Run /gsd:progress to see status, or /gsd:complete-milestone if milestone is done.
```
Exit.
</step>

<step name="ensure_auto_advance">
Persist auto-advance to config so the entire chain honors it:

```bash
node ~/.claude/get-shit-done/bin/gsd-tools.cjs config-set workflow.auto_advance true
```

Display launch banner:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► AUTOPILOT
 Milestone: ${milestone_version} ${milestone_name}
 Phases: ${start_phase} → ${end_phase} (${remaining_count} remaining)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
</step>

<step name="phase_loop">
For each incomplete phase in the range:

```
For phase in ${INCOMPLETE_PHASES}:

  1. Display phase header:
     ┌─────────────────────────────────────┐
     │ Phase ${N}: ${NAME}                 │
     │ ${GOAL}                             │
     └─────────────────────────────────────┘

  2. Check if CONTEXT.md exists for this phase
     → Use init phase-op or check disk directly

  3. If no CONTEXT.md → run synthetic discuss (step: run_auto_discuss)

  4. Spawn auto-advance chain (step: run_phase_chain)

  5. Check result → continue, stop, or handle error (step: handle_result)
```
</step>

<step name="run_auto_discuss">
Spawn synthetic discuss when a phase has no CONTEXT.md.

```
Task(
  prompt="
    <objective>
    Generate implementation context for Phase ${PHASE}: ${PHASE_NAME} using synthetic multi-agent discuss.
    </objective>

    <execution_context>
    @~/.claude/get-shit-done/workflows/auto-discuss.md
    </execution_context>

    <arguments>
    PHASE=${PHASE}
    </arguments>

    <instructions>
    1. Read auto-discuss.md for your complete workflow
    2. Follow ALL steps: initialize, gather inputs, analyze gray areas, assign perspectives, spawn debate, synthesize, write context
    3. Return: CONTEXT GENERATED (success) or ERROR (failure with details)
    </instructions>
  ",
  subagent_type="general-purpose",
  description="Auto-discuss Phase ${PHASE}"
)
```

**Handle result:**
- **CONTEXT GENERATED** → Continue to phase chain
- **ERROR** → Stop autopilot, report which phase failed and why
</step>

<step name="run_phase_chain">
Spawn the existing auto-advance chain starting from discuss-phase (which chains to plan → execute → verify → transition).

Since CONTEXT.md now exists (either pre-existing or just generated), we start from plan-phase with auto-advance:

```
Task(
  prompt="
    <objective>
    You are the plan-phase orchestrator. Create executable plans for Phase ${PHASE}: ${PHASE_NAME}, then auto-advance to execution.
    </objective>

    <execution_context>
    @~/.claude/get-shit-done/workflows/plan-phase.md
    @~/.claude/get-shit-done/references/ui-brand.md
    @~/.claude/get-shit-done/references/model-profile-resolution.md
    </execution_context>

    <arguments>
    PHASE=${PHASE}
    ARGUMENTS='${PHASE} --auto'
    </arguments>

    <instructions>
    1. Read plan-phase.md from execution_context for your complete workflow
    2. Follow ALL steps: initialize, validate, load context, research, plan, verify, auto-advance
    3. When spawning agents (gsd-phase-researcher, gsd-planner, gsd-plan-checker), use Task with specified subagent_type and model
    4. For step 14 (auto-advance to execute): spawn execute-phase as a Task with DIRECT file reference — tell it to read execute-phase.md. Include @file refs to execute-phase.md, checkpoints.md, tdd.md, model-profile-resolution.md. Pass --no-transition flag so execute-phase returns results instead of chaining further.
    5. Do NOT use the Skill tool or /gsd: commands. Read workflow .md files directly.
    6. Return: PHASE COMPLETE (full pipeline success), PLANNING COMPLETE (planning done but execute failed/skipped), PLANNING INCONCLUSIVE, or GAPS FOUND
    </instructions>
  ",
  subagent_type="general-purpose",
  description="Plan+Execute Phase ${PHASE}"
)
```
</step>

<step name="handle_result">
Process the return from the phase chain:

**PHASE COMPLETE:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 ✓ Phase ${PHASE} Complete
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Run transition to mark complete and advance state:
```bash
# Transition is needed since we used --no-transition in the chain
TRANSITION=$(node ~/.claude/get-shit-done/bin/gsd-tools.cjs phase complete "${PHASE}")
```

Commit transition:
```bash
node ~/.claude/get-shit-done/bin/gsd-tools.cjs commit "docs(phase-${PHASE}): complete phase execution" --files .planning/ROADMAP.md .planning/STATE.md .planning/REQUIREMENTS.md
```

Continue to next phase in the loop.

**PLANNING COMPLETE (execution didn't finish):**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 ⚠ Phase ${PHASE}: Planning complete, execution incomplete
 Stopping autopilot.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Continue manually: /gsd:execute-phase ${PHASE}
```
Stop the loop.

**GAPS FOUND:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 ⚠ Phase ${PHASE}: Verification gaps found
 Stopping autopilot.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Fix gaps: /gsd:plan-phase ${PHASE} --gaps
Then resume: /gsd:autopilot ${NEXT_PHASE}
```
Stop the loop.

**CHECKPOINT (human-action):**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 ⏸ Phase ${PHASE}: Human action required
 Stopping autopilot.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Complete the required action, then resume: /gsd:autopilot ${PHASE}
```
Stop the loop.

**Any other failure:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 ✗ Phase ${PHASE}: Unexpected failure
 Stopping autopilot.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Check /gsd:progress for current state.
```
Stop the loop.
</step>

<step name="milestone_complete">
When all phases in range complete successfully:

```bash
# Clear auto-advance at milestone boundary
node ~/.claude/get-shit-done/bin/gsd-tools.cjs config-set workflow.auto_advance false
```

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► AUTOPILOT COMPLETE
 Milestone: ${milestone_version} ${milestone_name}
 Phases completed: ${completed_list}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

All phases in range finished successfully.

Next: /gsd:complete-milestone — archive and prepare for next
```
</step>

</process>

<stop_conditions>
Autopilot stops when ANY of these occur:
1. **Milestone complete** — all phases in range finished
2. **human-action checkpoint** — requires manual intervention (auth gates, etc.)
3. **Gaps found** — verification failed, needs gap closure
4. **Execution failure** — plan or execution didn't complete
5. **Critical error** — unexpected failure in any step
</stop_conditions>

<context_management>
Each phase gets fresh context via Task() subagents. The autopilot orchestrator stays lean — it only tracks:
- Which phases remain
- The result status from each phase
- Whether to continue or stop

All heavy lifting happens in subagents with their own 200k context windows.
</context_management>

<success_criteria>
- [ ] Phase range parsed correctly from arguments
- [ ] Auto-advance config enabled for the chain
- [ ] Each phase gets CONTEXT.md (existing or synthetic)
- [ ] Auto-advance chain spawned correctly per phase
- [ ] Results handled: continue on success, stop on failure/gaps/checkpoint
- [ ] Milestone boundary stops autopilot and clears auto-advance
- [ ] User knows exactly where things stopped and how to resume
</success_criteria>
