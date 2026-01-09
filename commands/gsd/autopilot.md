---
name: gsd:autopilot
description: Run autonomous build loop - plans and executes all phases without intervention
allowed-tools:
  - Read
  - Bash
  - Grep
  - Glob
  - Task
  - Edit
  - Write
---

<objective>
Run the entire GSD workflow autonomously using parallel subagents.

Architecture:
- **Executor**: Main thread, plans and executes phases serially
- **Planner**: Background agent, stays one phase ahead
- **Committer**: Background agent, commits completed work
- **Documenter**: Background agent, updates changelog

For yolo-mode users who want speed without babysitting.
</objective>

<process>

<step name="verify">
**Verify project is ready:**

```bash
[ -f .planning/ROADMAP.md ] || { echo "ERROR: No ROADMAP.md. Run /gsd:new-project first."; exit 1; }
```

Read current state:
- `.planning/STATE.md` - current position
- `.planning/ROADMAP.md` - total phases, what's next
</step>

<step name="parse_state">
**Determine current position:**

From STATE.md, extract:
- Current phase number
- Current plan number
- Total phases from ROADMAP.md

Calculate:
- `CURRENT_PHASE`: Phase currently being worked on
- `NEXT_PHASE`: CURRENT_PHASE + 1 (for pipelined planning)
- `TOTAL_PHASES`: Total count from roadmap
</step>

<step name="spawn_planner">
**Spawn background planner (if next phase exists):**

If NEXT_PHASE <= TOTAL_PHASES and next phase has no PLAN.md yet:

```
Launch Task:
  subagent_type: "general-purpose"
  run_in_background: true
  prompt: |
    You are the PLANNER agent. Your job is to plan ahead while the executor works.

    Read:
    - .planning/ROADMAP.md (get phase {NEXT_PHASE} details)
    - .planning/PROJECT.md (project context)
    - .planning/STATE.md (current state)

    Then run: /gsd:plan-phase {NEXT_PHASE}

    Do NOT execute the plan. Just create it and exit.
    The executor will handle execution when ready.
```

Store the planner's output_file path for later checking.
</step>

<step name="execute_current">
**Execute current phase (main thread, blocking):**

Find the next unexecuted PLAN.md in current phase:

```bash
# Find plans without matching summaries
for plan in .planning/phases/{CURRENT_PHASE}-*/*-PLAN.md; do
  summary="${plan%-PLAN.md}-SUMMARY.md"
  [ ! -f "$summary" ] && echo "$plan" && break
done
```

If a plan needs execution:
- Run `/gsd:execute-plan {path-to-PLAN.md}` (blocking - wait for completion)

If no plans exist for current phase:
- Run `/gsd:plan-phase {CURRENT_PHASE}` first (blocking)
- Then execute the created plan
</step>

<step name="spawn_cleanup">
**After each plan completes, spawn cleanup crew:**

**Committer agent (background):**
```
Launch Task:
  subagent_type: "Bash"
  run_in_background: true
  prompt: |
    Commit the work just completed.

    1. git add -A
    2. Read the most recent SUMMARY.md to understand what was done
    3. Create a commit with a descriptive message based on the summary
    4. Format: "feat(phase-N): brief description of what was built"

    Do NOT push. Just commit locally.
```

**Documenter agent (background):**
```
Launch Task:
  subagent_type: "general-purpose"
  run_in_background: true
  prompt: |
    You are the DOCUMENTER agent. Update project documentation.

    1. Read the most recent SUMMARY.md in .planning/phases/
    2. If CHANGELOG.md exists in project root, add an entry for this work
    3. If README.md exists and has a "Features" or "Status" section, update it

    Keep updates minimal and factual. Don't over-document.
    If no docs need updating, just exit.
```
</step>

<step name="check_planner">
**Check if planner finished (non-blocking):**

If planner was spawned earlier, check its output_file:
- If complete: Next phase is ready to execute when we get there
- If still running: That's fine, it'll finish before we need it

This is pipelining - planner stays ahead of executor.
</step>

<step name="loop_or_complete">
**Determine next action:**

Check if current phase is complete:
```bash
plans=$(ls .planning/phases/{CURRENT_PHASE}-*/*-PLAN.md 2>/dev/null | wc -l)
summaries=$(ls .planning/phases/{CURRENT_PHASE}-*/*-SUMMARY.md 2>/dev/null | wc -l)
```

If summaries < plans:
- More plans to execute in current phase
- Go back to execute_current step

If summaries = plans (phase complete):
- Increment CURRENT_PHASE
- If CURRENT_PHASE > TOTAL_PHASES: Build complete!
- Otherwise: Go back to spawn_planner step for next iteration
</step>

<step name="completion">
**When all phases done:**

```
═══════════════════════════════════════════════════════════
                    BUILD COMPLETE
═══════════════════════════════════════════════════════════

All {TOTAL_PHASES} phases executed.

Background agents may still be finishing:
- Check committer: tail .claude/tasks/{committer_id}.output
- Check documenter: tail .claude/tasks/{documenter_id}.output

Review:
  git log --oneline -20    # See commits made
  cat CHANGELOG.md         # See documentation updates

Next:
  /gsd:verify-work         # Manual UAT testing
  /gsd:complete-milestone  # When ready to ship
```
</step>

</process>

<execution_model>
```
Timeline:
═════════════════════════════════════════════════════════════►

Executor:   [██ Plan P1 ██][████ Execute P1 ████][████ Execute P2 ████][███...]
Planner:                   [██ Plan P2 ██]       [██ Plan P3 ██]
Committer:                              [█]                   [█]
Documenter:                              [██]                  [██]

Legend:
[██] = Working
Executor blocks, others run in background
Planner stays ~1 phase ahead
Cleanup crew fires after each execution
```
</execution_model>

<success_criteria>
- [ ] All phases planned and executed
- [ ] Commits created for each completed plan
- [ ] Documentation updated where appropriate
- [ ] No blocking on cleanup tasks
- [ ] Planner stayed ahead of executor
</success_criteria>
