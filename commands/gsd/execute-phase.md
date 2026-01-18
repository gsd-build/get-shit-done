---
name: gsd:execute-phase
description: Execute all plans in a phase with wave-based parallelization
argument-hint: "<phase-number> [--gaps-only]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - Task
  - TodoWrite
  - AskUserQuestion
---

<objective>
Execute all plans in a phase using wave-based parallel execution.

Orchestrator stays lean: discover plans, analyze dependencies, group into waves, spawn subagents, collect results. Each subagent loads the full execute-plan context and handles its own plan.

Context budget: ~15% orchestrator, 100% fresh per subagent.
</objective>

<execution_context>
@~/.claude/get-shit-done/references/ui-brand.md
@~/.claude/get-shit-done/workflows/execute-phase.md
</execution_context>

<context>
Phase: $ARGUMENTS

**Flags:**
- `--gaps-only` — Execute only gap closure plans (plans with `gap_closure: true` in frontmatter). Use after verify-work creates fix plans.

@.planning/ROADMAP.md
@.planning/STATE.md
</context>

<process>
1. **Load config**
   ```bash
   cat .planning/config.json 2>/dev/null
   ```
   Extract `mode` field: "yolo" or "interactive" (default: "interactive")

2. **Validate phase exists**
   - Find phase directory matching argument
   - Count PLAN.md files
   - Error if no plans found

3. **Discover plans**
   - List all *-PLAN.md files in phase directory
   - Check which have *-SUMMARY.md (already complete)
   - If `--gaps-only`: filter to only plans with `gap_closure: true`
   - Build list of incomplete plans

4. **Group by wave**
   - Read `wave` from each plan's frontmatter
   - Group plans by wave number
   - Report wave structure to user

5. **Execute waves**
   For each wave in order:
   - Spawn `gsd-executor` for each plan in wave (parallel Task calls)
   - Wait for completion (Task blocks)
   - Verify SUMMARYs created
   - Proceed to next wave

6. **Aggregate results**
   - Collect summaries from all plans
   - Report phase completion status

7. **Commit any orchestrator corrections**
   Check for uncommitted changes before verification:
   ```bash
   git status --porcelain
   ```

   **If changes exist:** Orchestrator made corrections between executor completions. Commit them:
   ```bash
   git add -u && git commit -m "fix({phase}): orchestrator corrections"
   ```

   **If clean:** Continue to verification.

8. **Verify phase goal**
   - Spawn `gsd-verifier` subagent with phase directory and goal
   - Verifier checks must_haves against actual codebase (not SUMMARY claims)
   - Creates VERIFICATION.md with detailed report
   - Route by status:
     - `passed` → continue to step 9
     - `human_needed` → present items, get approval or feedback
     - `gaps_found` → present gaps, offer `/gsd:plan-phase {X} --gaps`

9. **Update roadmap and state**
   - Update ROADMAP.md, STATE.md

10. **Update requirements**
    Mark phase requirements as Complete:
    - Read ROADMAP.md, find this phase's `Requirements:` line (e.g., "AUTH-01, AUTH-02")
    - Read REQUIREMENTS.md traceability table
    - For each REQ-ID in this phase: change Status from "Pending" to "Complete"
    - Write updated REQUIREMENTS.md
    - Skip if: REQUIREMENTS.md doesn't exist, or phase has no Requirements line

11. **Commit phase completion**
    Bundle all phase metadata updates in one commit:
    - Stage: `git add .planning/ROADMAP.md .planning/STATE.md`
    - Stage REQUIREMENTS.md if updated: `git add .planning/REQUIREMENTS.md`
    - Commit: `docs({phase}): complete {phase-name} phase`

12. **Route to next action**
    Based on config mode and verification status (see `<offer_next>`)
</process>

<offer_next>
Route based on config mode and verification status.

## Mode Detection

Read mode from config.json (loaded in step 1):
- `"yolo"` → Auto-continue without asking
- `"interactive"` (default) → Use AskUserQuestion to present options

## Routing Table

| Status | Mode | Action |
|--------|------|--------|
| `gaps_found` | any | Route C (gap closure) - always ask, gaps need attention |
| `human_needed` | any | Present checklist, wait for approval |
| `passed` + more phases | yolo | **Auto-continue**: Run `/gsd:execute-phase {Z+1}` |
| `passed` + more phases | interactive | Route A with AskUserQuestion |
| `passed` + last phase | yolo | **Auto-continue**: Run `/gsd:audit-milestone` |
| `passed` + last phase | interactive | Route B with AskUserQuestion |

---

## YOLO Mode: Auto-Continue

**If mode is "yolo" and verification passed:**

Output completion banner, then immediately continue:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► PHASE {Z} COMPLETE ✓ → Continuing to Phase {Z+1}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Then execute next phase directly (no user input required):
- If more phases → Run `/gsd:execute-phase {Z+1}`
- If last phase → Run `/gsd:audit-milestone`

---

## Interactive Mode: Use AskUserQuestion

**Route A: Phase verified, more phases remain**

Output completion banner:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► PHASE {Z} COMPLETE ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Phase {Z}: {Name}**

{Y} plans executed
Goal verified ✓

───────────────────────────────────────────────────────────────

Then use AskUserQuestion:

```json
{
  "questions": [{
    "header": "Next Step",
    "question": "Phase {Z} complete. What's next?",
    "multiSelect": false,
    "options": [
      { "label": "Continue to Phase {Z+1} (Recommended)", "description": "Execute next phase: {Phase Z+1 Name}" },
      { "label": "Review what was built", "description": "See execution summary before continuing" },
      { "label": "Take a break", "description": "Pause work, can resume later with /gsd:resume-work" }
    ]
  }]
}
```

**Handle response:**
- "Continue to Phase {Z+1}" → Run `/gsd:execute-phase {Z+1}`
- "Review what was built" → Show summary, then ask again
- "Take a break" → Run `/gsd:pause-work`

───────────────────────────────────────────────────────────────

**Route B: Phase verified, milestone complete**

Output completion banner:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► MILESTONE COMPLETE 🎉
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**v1.0**

{N} phases completed
All phase goals verified ✓

───────────────────────────────────────────────────────────────

Then use AskUserQuestion:

```json
{
  "questions": [{
    "header": "Milestone Done",
    "question": "All phases complete! What's next?",
    "multiSelect": false,
    "options": [
      { "label": "Audit milestone (Recommended)", "description": "Verify requirements, cross-phase integration, E2E flows" },
      { "label": "Complete milestone", "description": "Skip audit, archive directly" },
      { "label": "Manual testing first", "description": "Run /gsd:verify-work before archiving" }
    ]
  }]
}
```

**Handle response:**
- "Audit milestone" → Run `/gsd:audit-milestone`
- "Complete milestone" → Run `/gsd:complete-milestone`
- "Manual testing first" → Run `/gsd:verify-work`

───────────────────────────────────────────────────────────────

**Route C: Gaps found — need additional planning**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► PHASE {Z} GAPS FOUND ⚠
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Phase {Z}: {Name}**

Score: {N}/{M} must-haves verified
Report: .planning/phases/{phase_dir}/{phase}-VERIFICATION.md

### What's Missing

{Extract gap summaries from VERIFICATION.md}

───────────────────────────────────────────────────────────────

Use AskUserQuestion (even in yolo mode - gaps need attention):

```json
{
  "questions": [{
    "header": "Gaps Found",
    "question": "Phase has gaps. How to proceed?",
    "multiSelect": false,
    "options": [
      { "label": "Plan gap closure (Recommended)", "description": "Create plans to fix missing items" },
      { "label": "See full report", "description": "Review VERIFICATION.md before deciding" },
      { "label": "Skip gaps, continue anyway", "description": "Accept incomplete phase, move on" }
    ]
  }]
}
```

**Handle response:**
- "Plan gap closure" → Run `/gsd:plan-phase {Z} --gaps`
- "See full report" → Show VERIFICATION.md, then ask again
- "Skip gaps, continue anyway" → Proceed to next phase (with warning logged)

───────────────────────────────────────────────────────────────
</offer_next>

<wave_execution>
**Parallel spawning:**

Spawn all plans in a wave with a single message containing multiple Task calls:

```
Task(prompt="Execute plan at {plan_01_path}\n\nPlan: @{plan_01_path}\nProject state: @.planning/STATE.md", subagent_type="gsd-executor")
Task(prompt="Execute plan at {plan_02_path}\n\nPlan: @{plan_02_path}\nProject state: @.planning/STATE.md", subagent_type="gsd-executor")
Task(prompt="Execute plan at {plan_03_path}\n\nPlan: @{plan_03_path}\nProject state: @.planning/STATE.md", subagent_type="gsd-executor")
```

All three run in parallel. Task tool blocks until all complete.

**No polling.** No background agents. No TaskOutput loops.
</wave_execution>

<checkpoint_handling>
Plans with `autonomous: false` have checkpoints. The execute-phase.md workflow handles the full checkpoint flow:
- Subagent pauses at checkpoint, returns structured state
- Orchestrator presents to user, collects response
- Spawns fresh continuation agent (not resume)

See `@~/.claude/get-shit-done/workflows/execute-phase.md` step `checkpoint_handling` for complete details.
</checkpoint_handling>

<deviation_rules>
During execution, handle discoveries automatically:

1. **Auto-fix bugs** - Fix immediately, document in Summary
2. **Auto-add critical** - Security/correctness gaps, add and document
3. **Auto-fix blockers** - Can't proceed without fix, do it and document
4. **Ask about architectural** - Major structural changes, stop and ask user

Only rule 4 requires user intervention.
</deviation_rules>

<commit_rules>
**Per-Task Commits:**

After each task completes:
1. Stage only files modified by that task
2. Commit with format: `{type}({phase}-{plan}): {task-name}`
3. Types: feat, fix, test, refactor, perf, chore
4. Record commit hash for SUMMARY.md

**Plan Metadata Commit:**

After all tasks in a plan complete:
1. Stage plan artifacts only: PLAN.md, SUMMARY.md
2. Commit with format: `docs({phase}-{plan}): complete [plan-name] plan`
3. NO code files (already committed per-task)

**Phase Completion Commit:**

After all plans in phase complete (step 7):
1. Stage: ROADMAP.md, STATE.md, REQUIREMENTS.md (if updated), VERIFICATION.md
2. Commit with format: `docs({phase}): complete {phase-name} phase`
3. Bundles all phase-level state updates in one commit

**NEVER use:**
- `git add .`
- `git add -A`
- `git add src/` or any broad directory

**Always stage files individually.**
</commit_rules>

<success_criteria>
- [ ] All incomplete plans in phase executed
- [ ] Each plan has SUMMARY.md
- [ ] Phase goal verified (must_haves checked against codebase)
- [ ] VERIFICATION.md created in phase directory
- [ ] STATE.md reflects phase completion
- [ ] ROADMAP.md updated
- [ ] REQUIREMENTS.md updated (phase requirements marked Complete)
- [ ] User informed of next steps
</success_criteria>
