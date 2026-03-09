<purpose>
Execute GSD workflows autonomously with minimal human intervention. Spawns specialized subagents that work independently until the task is truly complete. Integrates TDD, aggressive parallelism, and full verification by default.
</purpose>

<core_principle>
**Default Mode:** Ad-hoc (runs until complete). Specify phases via `--from=N --to=N` or in prose (e.g., "work on phases 2 to 4").

**Default Behaviors:**
1. **TDD-First**: When tests can be written before implementation, use TDD approach
2. **Aggressive Parallelism**: Spawn subagents in parallel whenever dependencies allow
3. **Full Verification**: Never claim complete until verification shows PASS
4. **Honest Reporting**: Report PARTIAL or FAIL if that's the truth
5. **Loop Until Complete**: By default, keeps iterating until verification passes. Use `-N=<n>` to limit iterations.

**Key Principle:** Always use Task tool to spawn subagents. Never work inline.
</core_principle>

<required_reading>
- .planning/ROADMAP.md - Phase definitions (if phase mode)
- .planning/STATE.md - Current position (if phase mode)
</required_reading>

<process>

<step name="parse_arguments" priority="first">
Parse options and user guidance using helper script:

```bash
eval $(node ~/.config/opencode/get-shit-done/scripts/gsd-autonomous-parse.cjs $ARGUMENTS)
```

The script outputs parsed values. Read them to determine:
- MODE (ad-hoc or phase)
- Phase range (FROM_PHASE, TO_PHASE) if specified
- USER_TASK (the user's freeform guidance)
- MAX_ITERATIONS (null = loop forever, or a number if -N was specified)

**Apply default behaviors:**
- If USER_TASK is empty, inject default guidance: "Use TDD approach when possible. Spawn subagents in parallel aggressively. Verify thoroughly."
- If MAX_ITERATIONS is null, loop until complete (default behavior)
- If MAX_ITERATIONS is set, limit to that many verification cycles
</step>

<step name="extract_task_list" priority="critical">
**CRITICAL:** Before any execution, extract and list ALL tasks/issues mentioned in user guidance.

Read the USER_TASK carefully and identify:
1. Every distinct task, issue, bug fix, feature, or improvement mentioned
2. Any phase ranges specified in prose (e.g., "work on phases 2 to 4")
3. Any implicit tasks that follow from the user's request

**Output a numbered task list:**
```markdown
## TASKS EXTRACTED FROM USER GUIDANCE

1. [Task/issue description]
2. [Task/issue description]
3. [Task/issue description]
...

Total: N tasks identified
```

**Rules:**
- Be exhaustive - do not skip or summarize tasks
- Preserve the user's exact wording where possible
- If the user mentions "phases X to Y", list each phase as a task
- If tasks seem related, list them separately anyway
- This list will be used for verification - every item must be checked

**This step prevents the common failure mode where agents silently skip tasks.**
</step>

<step name="initialize_context">
If phase mode (phases specified via flags or prose):

```bash
if [ ! -d ".planning" ]; then
  echo "ERROR: No .planning directory found. Run /gsd-new-project first."
  exit 1
fi

STATE=$(cat .planning/STATE.md 2>/dev/null || echo "No state file")
ROADMAP=$(cat .planning/ROADMAP.md 2>/dev/null || echo "No roadmap file")
```

Report current position:
- Current phase and status
- Available phases in roadmap
- Any blockers or pending items

If ad-hoc mode (no phases specified):
- Create minimal planning structure if needed: `mkdir -p .planning/ad-hoc`
- Skip roadmap/state loading
</step>

<step name="execute_workflow">
Based on MODE, execute the appropriate workflow:

**If MODE=ad-hoc (default):**

**Loop** (until verification passes or max iterations reached):

**Iteration 1 - Initial Execution:**
- Spawn gsd-executor with user guidance + default behaviors + task list
- Spawn gsd-verifier to check completion against task list
- If verification shows FAIL/PARTIAL, continue loop

**Subsequent Iterations - Gap Closure:**
- Spawn gsd-planner with --gaps flag (reads VERIFICATION.md)
- Spawn gsd-executor for gap plans
- Spawn gsd-verifier
- If verification shows FAIL/PARTIAL, continue loop

**Stop Conditions:**
- Verification shows PASS for ALL tasks → report success
- MAX_ITERATIONS reached without PASS → ask user
- No MAX_ITERATIONS set → loop forever until PASS

**If MODE=phase:**

For each phase from FROM_PHASE to TO_PHASE:

1. **Check phase status**
2. **If research needed:** Spawn gsd-phase-researcher
3. **If no plans exist:** Spawn gsd-planner
4. **Execute phase:** Spawn gsd-executor + gsd-verifier
5. **If verification fails:** Loop up to MAX_ITERATIONS (or forever if not set)

**Parallel Execution Strategy:**

When executing multiple phases or independent tasks:
- Group by dependency analysis
- Spawn independent items in parallel using multiple Task calls
- Wait for all parallel agents to complete
- Proceed to dependent items sequentially

</step>

<step name="inject_default_behaviors">
For EVERY executor and verifier spawn, inject:

**For gsd-executor:**
```xml
<user_guidance>
[Insert the user's freeform guidance text here exactly as provided]
</user_guidance>

<task_list>
[Insert the numbered task list from step 2 - EVERY item must be addressed]
</task_list>

<default_behaviors>
1. Use TDD approach when tests can be written before implementation
2. Spawn subagents in parallel aggressively when tasks are independent
3. Verify thoroughly - never claim complete without proof
4. Commit atomically after each task
5. Address EVERY item in task_list - do not skip any
</default_behaviors>

<what_to_do>
Execute all tasks in task_list. Apply default_behaviors. Check off each task as completed.
</what_to_do>
```

**For gsd-verifier:**
```xml
<user_guidance>
[Insert the user's freeform guidance text here exactly as provided]
</user_guidance>

<task_list>
[Insert the numbered task list from step 2]
</task_list>

<verification_requirements>
1. Did executor solve what user asked?
2. Are there passing tests?
3. For TDD: Did RED→GREEN→REFACTOR complete?
4. **CRITICAL: Was EVERY item in task_list addressed?**
5. Honest status: PASS / PARTIAL / FAIL
</verification_requirements>

<what_to_verify>
Check each item in task_list against actual work done.
Mark each item: ✓ Complete, ⚠ Partial, ✗ Not Done
Create VERIFICATION.md with honest status for each task.
</what_to_verify>
```
</step>

<step name="verify_task_completion">
**CRITICAL:** After execution, verify EVERY task from the task list was addressed.

For each task in the task list:
1. Check if work was done for this specific task
2. Check if tests exist and pass (if applicable)
3. Mark status: ✓ Complete, ⚠ Partial, ✗ Not Done

**Report format:**
```markdown
## TASK COMPLETION VERIFICATION

| # | Task | Status | Evidence |
|---|------|--------|----------|
| 1 | [task] | ✓ | [file:line or test name] |
| 2 | [task] | ⚠ | [what's missing] |
| 3 | [task] | ✗ | [not started] |

**Summary:** X/Y tasks complete
```

**If any task is ✗ or ⚠:**
- Do NOT report PASS
- Continue iteration loop (unless MAX_ITERATIONS reached)
- Report gaps honestly
</step>

<step name="report_results">
Report what actually happened:

```markdown
## AUTONOMOUS EXECUTION COMPLETE

**Mode:** {ad-hoc | phase}
**Phases:** {list of phases executed, if any}
**Iterations:** {N} verification cycles
**Max Iterations:** {unlimited | N}

### Task Completion

| # | Task | Status |
|---|------|--------|
| 1 | {task} | ✓ |
| 2 | {task} | ✓ |
| 3 | {task} | ⚠ |

**Summary:** {X}/{Y} tasks complete

### Artifacts Created
- SUMMARY: {path to SUMMARY.md}
- VERIFICATION: {path to VERIFICATION.md}

### Unresolved Gaps
{If any tasks incomplete, list them with details}

### Next Steps
{If gaps exist: Continue with /gsd-autonomous to close gaps}
{If complete: Ready for next task}
```

**Honesty Rule:** Never claim "complete" if any task shows ✗ or ⚠. Always report the actual status.
</step>

</process>

<subagent_prompts>

**Executor Prompt Template:**
```
<objective>
Execute {plan/phase/task} autonomously with full verification.
</objective>

<user_guidance>
{USER_TASK}
</user_guidance>

<task_list>
{NUMBERED_TASK_LIST}
</task_list>

<default_behaviors>
1. TDD-First: Write tests before implementation when applicable
2. Parallel Execution: Spawn subagents for independent tasks
3. Full Verification: Prove completion with tests or checks
4. Atomic Commits: Commit after each task
5. Complete ALL Tasks: Address every item in task_list
</default_behaviors>

<execution_context>
@~/.config/opencode/get-shit-done/workflows/execute-plan.md
@~/.config/opencode/get-shit-done/templates/summary.md
@~/.config/opencode/get-shit-done/references/tdd.md
</execution_context>

<success_criteria>
- [ ] All tasks in task_list executed
- [ ] Tests written and passing (for TDD tasks)
- [ ] Each task committed individually
- [ ] SUMMARY.md created
- [ ] Every task in task_list checked off
</success_criteria>
```

**Verifier Prompt Template:**
```
<objective>
Verify {plan/phase/task} completion with full honesty.
</objective>

<user_guidance>
{USER_TASK}
</user_guidance>

<task_list>
{NUMBERED_TASK_LIST}
</task_list>

<verification_requirements>
1. Did executor solve what user asked?
2. Are there passing tests?
3. For TDD: Did RED→GREEN→REFACTOR complete?
4. **Was EVERY item in task_list addressed?**
5. Status: PASS / PARTIAL / FAIL
</verification_requirements>

<what_to_verify>
Check each item in task_list against actual codebase.
Verify tests exist and pass.
Cross-reference requirements.
Create VERIFICATION.md with status for EACH task.
</what_to_verify>
```

</subagent_prompts>

<autonomy_rules>
1. ALWAYS spawn subagents with Task tool - never work inline
2. Extract and list ALL tasks from user guidance before execution
3. Verify EVERY task was addressed - no silent skipping
4. Include user's full guidance text in EVERY executor and verifier prompt
5. Inject default behaviors (TDD, parallelism, verification) in every spawn
6. Verification MUST show PASS for ALL tasks before claiming complete
7. Gap closure runs automatically when verification shows incomplete tasks
8. By default, loop forever until complete; use -N to limit
9. Report honestly: say "partial" or "incomplete" if any task is not done
10. For multi-phase: analyze dependencies, parallelize independent phases
</autonomy_rules>

<examples>

**Example 1: Ad-hoc task (default mode)**
```bash
/gsd-autonomous "Fix the authentication bug, update the README, and add tests for the login flow"
```
Extracts 3 tasks, executes all, verifies each was done.

**Example 2: With iteration limit**
```bash
/gsd-autonomous -N=3 "Refactor the API layer"
```
Limits to 3 verification cycles.

**Example 3: Phase range in prose**
```bash
/gsd-autonomous "work on phases 2 to 4"
```
Parses phase range from prose, executes phases 2, 3, 4.

**Example 4: Phase range via flags**
```bash
/gsd-autonomous --from=2 --to=4
```
Executes phases 2, 3, 4.

**Example 5: Multiple tasks with iteration limit**
```bash
/gsd-autonomous -N=5 "Fix bug #123, implement feature X, update docs, add tests"
```
Extracts 4 tasks, limits to 5 iterations, verifies each task.

</examples>
