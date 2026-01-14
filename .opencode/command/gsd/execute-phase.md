---

description: Execute all plans in a phase with wave-based parallelization

---

<objective>
Execute all plans in a phase using wave-based parallel execution.

Orchestrator stays lean: discover plans, analyze dependencies, group into waves, spawn subagents, collect results. Each subagent loads the full execute-plan context and handles its own plan.

Context budget: ~15% orchestrator, 100% fresh per subagent.
</objective>

<execution_context>
@~/.config/opencode/gsd/workflows/execute-phase.md
@~/.config/opencode/gsd/templates/subagent-task-prompt.md
</execution_context>

<context>
Phase: $ARGUMENTS

@.planning/ROADMAP.md
@.planning/STATE.md
</context>

<process>
1. **Validate phase exists**
   - Find phase directory matching argument
   - Count PLAN.md files
   - Error if no plans found

2. **Discover plans**
   - List all *-PLAN.md files in phase directory
   - Check which have *-SUMMARY.md (already complete)
   - Build list of incomplete plans

3. **Group by wave**
   - Read `wave` from each plan's frontmatter
   - Group plans by wave number
   - Report wave structure to user

4. **Execute waves**
   For each wave in order:
   - Fill subagent-task-prompt template for each plan
   - Spawn all agents in wave simultaneously (parallel Task calls)
   - Wait for completion (Task blocks)
   - Verify SUMMARYs created
   - Proceed to next wave

5. **Aggregate results**
   - Collect summaries from all plans
   - Report phase completion status
   - Update ROADMAP.md

6. **Offer next steps**
   - More phases → `/gsd/plan-phase {next}`
   - Milestone complete → `/gsd/complete-milestone`
</process>

<wave_execution>
**Parallel spawning:**

Spawn all plans in a wave with a single message containing multiple Task calls:

```
Task(prompt=filled_template_for_plan_01, subagent_type="general-purpose")
Task(prompt=filled_template_for_plan_02, subagent_type="general-purpose")
Task(prompt=filled_template_for_plan_03, subagent_type="general-purpose")
```

All three run in parallel. Task tool blocks until all complete.

**No polling.** No background agents. No TaskOutput loops.
</wave_execution>

<checkpoint_handling>
Plans with `autonomous: false` in frontmatter have checkpoints:
- Run in their assigned wave (can be parallel with other plans)
- Pause at checkpoint, return to orchestrator
- Orchestrator presents checkpoint to user
- User responds, orchestrator resumes agent
</checkpoint_handling>

<deviation_rules>
During execution, handle discoveries automatically:

1. **Auto-fix bugs** - Fix immediately, document in Summary
2. **Auto-add critical** - Security/correctness gaps, add and document
3. **Auto-fix blockers** - Can't proceed without fix, do it and document
4. **Ask about architectural** - Major structural changes, stop and ask user
5. **Log enhancements** - Nice-to-haves, log to ISSUES.md, continue

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

After all tasks complete:
1. Stage planning artifacts only: PLAN.md, SUMMARY.md, STATE.md, ROADMAP.md
2. Commit with format: `docs({phase}-{plan}): complete [plan-name] plan`
3. NO code files (already committed per-task)

**NEVER use:**
- `git add .`
- `git add -A`
- `git add src/` or any broad directory

**Always stage files individually.**
</commit_rules>

<success_criteria>
- [ ] All incomplete plans in phase executed
- [ ] Each plan has SUMMARY.md
- [ ] STATE.md reflects phase completion
- [ ] ROADMAP.md updated
- [ ] User informed of next steps
</success_criteria>
