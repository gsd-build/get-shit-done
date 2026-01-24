<purpose>
Execute a phase plan (PLAN.md) and create the outcome summary (SUMMARY.md).
</purpose>

<required_reading>
Read STATE.md before any operation to load project context.
Read config.json for planning behavior settings.

@~/.claude/get-shit-done/references/git-integration.md
</required_reading>

<process>

<step name="load_context">
**Load project state and config:**

```bash
cat .planning/STATE.md 2>/dev/null
cat .planning/config.json 2>/dev/null
```

Extract:
- Current position (phase, plan, status)
- Accumulated decisions and blockers
- Model profile (default: "balanced")
- commit_docs setting (default: true, overridden if .planning/ is gitignored)

**Model lookup table:**

| Agent | quality | balanced | budget |
|-------|---------|----------|--------|
| gsd-executor | opus | sonnet | sonnet |
</step>

<step name="identify_and_confirm_plan">
Find next plan to execute:
- Check ROADMAP.md for "In progress" phase
- Find first PLAN.md without matching SUMMARY.md
- Handle decimal phases (01.1-01-PLAN.md → 01.1-01-SUMMARY.md)

**If yolo mode:** Auto-approve and proceed.

**If interactive mode:** Present plan and wait for confirmation.
</step>

<step name="parse_segments">
**Intelligent segmentation: Parse plan into execution segments.**

Plans are divided by checkpoints. Each segment routes to optimal context.

**If NO checkpoints:** Spawn single subagent for entire plan (fresh 200k context).

**If checkpoints exist:** Parse into segments:

Routing rules:
- No prior checkpoint → SUBAGENT
- After checkpoint:human-verify → SUBAGENT
- After checkpoint:decision OR checkpoint:human-action → MAIN CONTEXT

**Pattern A (fully autonomous):** Single subagent executes all tasks, creates SUMMARY, commits.

**Pattern B (segmented):** Execute segment-by-segment with fresh subagents between verify checkpoints.

**Pattern C (decision-dependent):** Execute entirely in main context.

See full execute-plan.md for detailed segment execution loop.
</step>

<step name="execute_tasks">
Execute each task in the plan prompt:

1. Read @context files listed in prompt
2. For each task:

   **If type="auto":**
   - Check if tdd="true" → Follow TDD flow (RED → GREEN → REFACTOR)
   - Work toward completion
   - If authentication error → Handle as gate (see below)
   - If discover additional work → Apply deviation rules automatically
   - Run verification
   - **Commit the task** (see Task Commit Protocol)
   - Track completion and commit hash
   - Continue to next task

   **If type="checkpoint:*":**
   - STOP immediately
   - Execute checkpoint protocol (see below)
   - Wait for user response
   - Verify if possible
   - After confirmation: continue to next task

3. Run overall verification checks
4. Confirm all success criteria met
5. Document all deviations in Summary
</step>

<authentication_gates>
**When encountering auth errors during task execution:**

1. Recognize it's an auth gate (not a bug)
2. STOP current task
3. Create dynamic checkpoint:human-action
4. Provide exact authentication steps
5. Wait for user to authenticate
6. Verify authentication works
7. Retry original task
8. Continue normally

**Document as normal flow, not deviations.**
</authentication_gates>

<deviation_rules>
**Automatic Deviation Handling - Apply these rules automatically:**

**RULE 1: Auto-fix bugs**
- Trigger: Code doesn't work (broken behavior, errors, security vulnerabilities)
- Action: Fix immediately, track for Summary
- Examples: Wrong SQL, logic errors, type errors, null pointer, security issues

**RULE 2: Auto-add missing critical functionality**
- Trigger: Missing essential features for correctness/security/operation
- Action: Add immediately, track for Summary
- Examples: Error handling, input validation, auth checks, CSRF protection, indexes, logging

**RULE 3: Auto-fix blocking issues**
- Trigger: Can't complete current task
- Action: Fix immediately to unblock, track for Summary
- Examples: Missing dependencies, wrong types, broken imports, env vars, build config

**RULE 4: Ask about architectural changes**
- Trigger: Fix requires significant structural modification
- Action: STOP, present to user, wait for decision
- Examples: New database tables, schema changes, new service layers, switching frameworks, API contract changes

**Rule priority:** If Rule 4 applies → STOP and ask. If Rules 1-3 apply → Fix automatically and track.

**Track all deviations:** Document in SUMMARY.md with format `[Rule N - Type] [description]`.
</deviation_rules>

<task_commit>
**Task Commit Protocol**

After each task completes:

1. Identify modified files: `git status --short`
2. Stage files individually (NEVER `git add .` or `git add -A`)
3. Determine commit type: feat, fix, test, refactor, perf, docs, style, chore
4. Craft message: `{type}({phase}-{plan}): {task-description}`

**TDD plans use special pattern:**
- RED phase: `test({phase}-{plan}): add failing test for X`
- GREEN phase: `feat({phase}-{plan}): implement X`
- REFACTOR phase: `refactor({phase}-{plan}): clean up X` (optional)

5. Record commit hash for SUMMARY.md
</task_commit>

<checkpoint_protocol>
**Checkpoint Handling**

When encountering `type="checkpoint:*"`:

Display clearly:
```
╔═══════════════════════════════════════════════════════╗
║  CHECKPOINT: [Type]                                   ║
╚═══════════════════════════════════════════════════════╝

Progress: {X}/{Y} tasks complete
Task: [task name]

[Type-specific content]

────────────────────────────────────────────────────────
→ YOUR ACTION: [Resume signal]
────────────────────────────────────────────────────────
```

**Types:**
- **human-verify (90%):** Show what was built, verification steps, wait for "approved"
- **decision (9%):** Present options with pros/cons, wait for selection
- **human-action (1%):** Unavoidable manual step (email link, 2FA), show what was automated

**After user responds:**
- Run verification if specified
- If passes: continue to next task
- If fails: inform user, wait for resolution

See ~/.claude/get-shit-done/references/checkpoints.md for complete details.
</checkpoint_protocol>

<step name="create_summary">
Create `{phase}-{plan}-SUMMARY.md` in `.planning/phases/XX-name/`.

Use ~/.claude/get-shit-done/templates/summary.md for structure.

**Critical requirements:**
- Frontmatter: Populate all fields (phase, plan, subsystem, dependencies, tech-stack, key-files, decisions, duration)
- Title: `# Phase [X] Plan [Y]: [Name] Summary`
- One-liner: SUBSTANTIVE (e.g., "JWT auth with refresh rotation using jose library")
- Performance data: Duration, started, completed, tasks count, files count
- Deviations section: Document all auto-fixes and architectural changes
- Next Step section: Indicate if more plans exist or phase complete
</step>

<step name="update_state">
Update STATE.md:

**Current Position:**
- Update phase progress (X of Y)
- Update plan progress (N of total-in-phase)
- Update status (In progress / Phase complete)
- Update last activity date and plan completed
- Calculate and render progress bar

**Accumulated Context:**
- Extract decisions from SUMMARY.md → Add to Decisions table
- Extract blockers/concerns from SUMMARY.md → Add to Blockers section

**Session Continuity:**
- Update last session timestamp
- Update "Stopped at" to show completed plan
- Keep STATE.md under 150 lines total
</step>

<step name="commit_and_update">
**Generate USER-SETUP.md if needed:**
- Check PLAN.md frontmatter for `user_setup` field
- If exists: Create {phase}-USER-SETUP.md using template
- Generate env vars table, setup checklists, verification steps
- Track for prominent display in completion output

**Update ROADMAP.md:**
- If more plans remain: Update plan count
- If last plan: Mark phase complete, add completion date

**Commit execution metadata:**
- If commit_docs=false: Skip git operations for .planning/ files
- If commit_docs=true:
  - Stage SUMMARY.md, STATE.md, ROADMAP.md, USER-SETUP.md (if created)
  - Commit: `docs({phase}-{plan}): complete [plan-name] plan`
  - Include tasks completed list and SUMMARY path

**Update codebase map (if exists):**
- Check structural changes across task commits
- Update STRUCTURE.md, STACK.md, CONVENTIONS.md, INTEGRATIONS.md as needed
- Skip if only code changes within existing files

See git-integration.md for commit message conventions.
</step>

<step name="offer_next">
**MANDATORY verification before presenting next steps:**

**0. Check for USER-SETUP.md:**
If created, display warning block at TOP of output:
```
⚠️ USER SETUP REQUIRED

This phase introduced external services requiring manual configuration:

📋 .planning/phases/{phase-dir}/{phase}-USER-SETUP.md

Quick view:
- [ ] {ENV_VAR_1}
- [ ] {ENV_VAR_2}
...
```

**1. Count plans vs summaries in current phase:**
```bash
ls -1 .planning/phases/[phase-dir]/*-PLAN.md 2>/dev/null | wc -l
ls -1 .planning/phases/[phase-dir]/*-SUMMARY.md 2>/dev/null | wc -l
```

**2. Route based on plan completion:**
- If summaries < plans → More plans remain → Present next plan
- If summaries = plans → Go to step 3

**3. Check milestone status (only if all plans done):**
- Read ROADMAP.md
- Extract current phase and highest phase in milestone
- State: "Current phase is {X}. Milestone has {N} phases (highest: {Y})."

**4. Route based on milestone status:**
- If current < highest → Phase complete, present next phase planning
- If current = highest → Milestone complete, present `/gsd:complete-milestone`

**Yolo mode:** Auto-continue to next plan if available.

**Interactive mode:** Wait for user to run next command.
</step>

</process>

<success_criteria>
- All tasks from PLAN.md completed
- All verifications pass
- USER-SETUP.md generated if user_setup in frontmatter
- SUMMARY.md created with substantive content
- STATE.md updated (position, decisions, issues, session)
- ROADMAP.md updated
- Codebase map updated if exists (or skipped if no significant changes)
- USER-SETUP.md prominently surfaced if created
</success_criteria>
