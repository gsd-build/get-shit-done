<purpose>
Execute GSD workflows autonomously with minimal human intervention. Spawns specialized subagents that work independently until the task is truly complete. Integrates TDD, aggressive parallelism, and full verification by default.
</purpose>

<core_principle>
**Default Behaviors (User-Configurable):**
1. **TDD-First**: When tests can be written before implementation, use TDD approach
2. **Aggressive Parallelism**: Spawn subagents in parallel whenever dependencies allow
3. **Full Verification**: Never claim complete until verification shows PASS
4. **Honest Reporting**: Report PARTIAL or FAIL if that's the truth

**Key Principle:** Always use Task tool to spawn subagents. Never work inline.
</core_principle>

<required_reading>
- .planning/ROADMAP.md - Phase definitions
- .planning/STATE.md - Current position
</required_reading>

<process>

<step name="parse_arguments" priority="first">
Parse options and user guidance using helper script:

```bash
# Source the parse script which outputs variables
eval $(bash /home/ubuntu/.config/opencode/get-shit-done/scripts/gsd-autonomous-parse.sh $ARGUMENTS)
```

The script outputs parsed values. Read them to determine:
- MODE (ad-hoc or phase)
- Phase range (FROM_PHASE, TO_PHASE)
- USER_TASK (the user's freeform guidance)
- Settings (MAX_ITERATIONS, UNTIL_COMPLETE, etc.)

**Apply default behaviors:**
- If USER_TASK is empty, inject default guidance: "Use TDD approach when possible. Spawn subagents in parallel aggressively. Verify thoroughly."
- If MAX_ITERATIONS not specified, use 5
- If UNTIL_COMPLETE not specified, default to true for ad-hoc tasks
</step>

<step name="initialize_context">
Load project state and planning context:

```bash
# Check for planning directory
if [ ! -d ".planning" ]; then
  echo "ERROR: No .planning directory found. Run /gsd-new-project first."
  exit 1
fi

# Load current state
STATE=$(cat .planning/STATE.md 2>/dev/null || echo "No state file")
ROADMAP=$(cat .planning/ROADMAP.md 2>/dev/null || echo "No roadmap file")
```

Report current position:
- Current phase and status
- Available phases in roadmap
- Any blockers or pending items
</step>

<step name="execute_workflow">
Based on MODE, execute the appropriate workflow:

**If MODE=ad-hoc:**

1. **Create temporary planning structure** (if needed):
   ```bash
   # For ad-hoc tasks, create minimal planning structure
   mkdir -p .planning/ad-hoc
   ```

2. **Loop** (until verification passes or max iterations):
   
   **Iteration 1 - Initial Execution:**
   - Spawn gsd-executor with user guidance + default behaviors
   - Spawn gsd-verifier to check completion
   - If verification shows FAIL/PARTIAL, continue loop
   
   **Subsequent Iterations - Gap Closure:**
   - Spawn gsd-planner with --gaps flag (reads VERIFICATION.md)
   - Spawn gsd-executor for gap plans
   - Spawn gsd-verifier
   - If verification shows FAIL/PARTIAL, continue loop
   
   **Stop Conditions:**
   - Verification shows PASS → report success
   - Max iterations reached without PASS → ask user
   - --until-complete → loop forever until PASS

**If MODE=phase:**

For each phase from FROM_PHASE to TO_PHASE:

1. **Check phase status:**
   ```bash
   PHASE_STATUS=$(node /home/ubuntu/.config/opencode/get-shit-done/bin/gsd-tools.cjs phase status "${PHASE_NUM}")
   ```

2. **If research needed:**
   - Spawn gsd-phase-researcher in parallel with other independent phases
   - Wait for research to complete

3. **If no plans exist:**
   - Spawn gsd-planner
   - Wait for plans to be created

4. **Execute phase:**
   - Spawn gsd-executor (include user guidance + default behaviors in context)
   - Spawn gsd-verifier
   - If verification fails: loop (planner → executor → verifier) up to MAX_ITERATIONS

5. **Report phase status:**
   - Verification result
   - Location of SUMMARY.md and VERIFICATION.md
   - Any unresolved gaps

**Parallel Execution Strategy:**

When executing multiple phases or independent tasks:
- Group by dependency analysis
- Spawn independent items in parallel using multiple Task calls
- Wait for all parallel agents to complete
- Proceed to dependent items sequentially

Example for multi-phase:
```
# Phases 2 and 3 are independent, spawn in parallel
Task(phase=2) + Task(phase=3) → wait for both
# Phase 4 depends on 2 and 3, spawn after
Task(phase=4) → wait
```
</step>

<step name="inject_default_behaviors">
For EVERY executor and verifier spawn, inject default behaviors:

**For gsd-executor:**
```xml
<user_guidance>
[Insert the user's freeform guidance text here exactly as provided]
</user_guidance>

<default_behaviors>
1. Use TDD approach when tests can be written before implementation
2. Spawn subagents in parallel aggressively when tasks are independent
3. Verify thoroughly - never claim complete without proof
4. Commit atomically after each task
</default_behaviors>

<what_to_do>
Execute the task described in user_guidance above. Apply default_behaviors. Make reasonable decisions.
</what_to_do>
```

**For gsd-verifier:**
```xml
<user_guidance>
[Insert the user's freeform guidance text here exactly as provided]
</user_guidance>

<verification_requirements>
1. Did executor actually solve what user asked for?
2. Are there passing tests proving the fix?
3. For TDD tasks: Did RED→GREEN→REFACTOR cycle complete?
4. Honest status: PASS / PARTIAL / FAIL
</verification_requirements>

<what_to_verify>
Verify the work meets all criteria. Be thorough and honest.
</what_to_verify>
```
</step>

<step name="report_results">
Report what actually happened:

```markdown
## AUTONOMOUS EXECUTION COMPLETE

**Mode:** {ad-hoc | phase}
**Phases:** {list of phases executed}
**Iterations:** {N} verification cycles

### Results

| Phase/Task | Status | Verification |
|------------|--------|--------------|
| {phase-1} | ✓ Complete | PASS |
| {phase-2} | ⚠ Partial | See gaps below |

### Artifacts Created
- SUMMARY: {path to SUMMARY.md}
- VERIFICATION: {path to VERIFICATION.md}

### Unresolved Gaps
{If any gaps remain, list them with details}

### Next Steps
{If gaps exist: /gsd-plan-phase {X} --gaps}
{If complete: Ready for next phase or task}
```

**Honesty Rule:** Never claim "complete" if verification shows PARTIAL or FAIL. Always report the actual status.
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

<default_behaviors>
1. TDD-First: Write tests before implementation when applicable
2. Parallel Execution: Spawn subagents for independent tasks
3. Full Verification: Prove completion with tests or checks
4. Atomic Commits: Commit after each task
</default_behaviors>

<execution_context>
@/home/ubuntu/.config/opencode/get-shit-done/workflows/execute-plan.md
@/home/ubuntu/.config/opencode/get-shit-done/templates/summary.md
@/home/ubuntu/.config/opencode/get-shit-done/references/tdd.md
@/home/ubuntu/.config/opencode/get-shit-done/references/checkpoints.md
</execution_context>

<files_to_read>
Read these files at execution start:
- {plan_file} (if phase mode)
- .planning/STATE.md
- .planning/config.json (if exists)
- ./CLAUDE.md (if exists)
- .agents/skills/ (if exists)
</files_to_read>

<success_criteria>
- [ ] All tasks executed
- [ ] Tests written and passing (for TDD tasks)
- [ ] Each task committed individually
- [ ] SUMMARY.md created
- [ ] STATE.md updated
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

<verification_requirements>
1. Did executor solve what user asked?
2. Are there passing tests?
3. For TDD: Did RED→GREEN→REFACTOR complete?
4. Status: PASS / PARTIAL / FAIL
</verification_requirements>

<what_to_verify>
Check must_haves against actual codebase.
Verify tests exist and pass.
Cross-reference requirements.
Create VERIFICATION.md with honest status.
</what_to_verify>
```

</subagent_prompts>

<autonomy_rules>
1. ALWAYS spawn subagents with Task tool - never work inline
2. Include user's full guidance text in EVERY executor and verifier prompt
3. Inject default behaviors (TDD, parallelism, verification) in every spawn
4. Verification MUST show PASS before claiming complete
5. Gap closure runs automatically when verification shows FAIL/PARTIAL
6. With --until-complete, loop forever until verification passes
7. Report honestly: say "partial" or "failed with gaps" if that's the truth
8. For multi-phase: analyze dependencies, parallelize independent phases
</autonomy_rules>

<parallel_execution>

**Dependency Analysis:**
Before spawning agents, analyze which phases/tasks can run in parallel:

```bash
# Get phase dependencies from roadmap
DEPS=$(node /home/ubuntu/.config/opencode/get-shit-done/bin/gsd-tools.cjs roadmap dependencies)
```

**Parallel Groups:**
- Group 1: Phases with no dependencies (can all run parallel)
- Group 2: Phases depending only on Group 1 (can run parallel after Group 1)
- Group 3: Phases depending on Group 2 (sequential after Group 2)

**Spawning Strategy:**
```javascript
// Pseudo-code for parallel spawning
for each group in dependency_order:
  if group.has_multiple_phases:
    // Spawn all in parallel
    Task(phase=group[0]) + Task(phase=group[1]) + ...
    await all
  else:
    // Single phase, spawn and wait
    Task(phase=group[0])
    await
```

**Context Efficiency:**
- Orchestrator: ~10-15% context (just coordination)
- Each subagent: fresh 200k context
- No context bleed between parallel agents
</parallel_execution>

<tdd_integration>

**TDD Detection:**
Before execution, determine if TDD applies:
- Can you write `expect(fn(input)).toBe(output)` before writing `fn`?
- Is there clear input/output behavior?
- Is it business logic, API, or algorithm?

**If TDD applies:**
1. Spawn executor with TDD workflow reference
2. Executor follows RED→GREEN→REFACTOR cycle
3. Verifier checks for test file existence and passing tests
4. Report TDD status in VERIFICATION.md

**TDD Workflow Reference:**
@/home/ubuntu/.config/opencode/get-shit-done/references/tdd.md

</tdd_integration>

<success_metrics>
- Subagents were spawned (not inline work)
- Default behaviors injected (TDD, parallelism, verification)
- VERIFICATION.md shows honest status
- User's guidance text was used in agent work
- SUMMARY.md created documenting what was done
- Parallel execution used when dependencies allowed
</success_metrics>

<failure_handling>
- **Verification shows PARTIAL:** Auto-spawn gap closure cycle
- **Verification shows FAIL:** Report gaps, offer to continue or stop
- **Max iterations reached:** Ask user for guidance
- **Agent fails to spawn:** Report error, offer retry
- **Dependency cycle detected:** Report, ask user to fix roadmap
</failure_handling>

<examples>

**Example 1: Ad-hoc task with defaults**
```bash
/gsd-autonomous --ad-hoc "Fix the authentication bug"
```
Injects: "Use TDD approach when possible. Spawn subagents in parallel aggressively. Verify thoroughly."
Executes: executor → verifier → (if gaps) planner → executor → verifier → ...

**Example 2: Multi-phase with parallelism**
```bash
/gsd-autonomous --from=2 --to=4
```
Analyzes: Phase 2 and 3 are independent
Spawns: Task(phase=2) + Task(phase=3) in parallel
Then: Task(phase=4) after both complete

**Example 3: With user guidance**
```bash
/gsd-autonomous --phase=3 "Focus on the archive loading error, don't refactor unrelated code"
```
Injects: User guidance + default behaviors
Executes: Single phase with focused scope

</examples>
