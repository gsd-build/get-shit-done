---

description: Execute all plans in a phase with intelligent parallelization

---

<objective>
Execute all unexecuted plans in a phase with parallel agent spawning.

Analyzes plan dependencies to identify independent plans that can run concurrently.
Spawns background agents for parallel execution, each agent commits its own tasks atomically.

**Critical constraint:** One subagent per plan, always. This is for context isolation, not parallelization. Even strictly sequential plans spawn separate subagents so each starts with fresh 200k context at 0%.

Use this command when:
- Phase has 2+ unexecuted plans
- Want "walk away, come back to completed work" execution
- Plans have clear dependency boundaries
</objective>

<execution_context>
@~/.config/opencode/gsd/workflows/execute-plan.md
@~/.config/opencode/gsd/workflows/execute-phase.md
@~/.config/opencode/gsd/templates/summary.md
@~/.config/opencode/gsd/references/checkpoints.md
@~/.config/opencode/gsd/references/tdd.md
</execution_context>

<context>
Phase number: $ARGUMENTS (required)

@.planning/STATE.md
@.planning/config.json
</context>

<process>
1. Validate phase exists in roadmap
2. Find all PLAN.md files without matching SUMMARY.md
3. If 0 or 1 plans: suggest /gsd/execute-plan instead
4. If 2+ plans: follow execute-phase.md workflow
5. Monitor parallel agents until completion
6. Present results and next steps
</process>

<execution_strategies>
**Strategy A: Fully Autonomous** (no checkpoints)

- Spawn subagent to execute entire plan
- Subagent creates SUMMARY.md and commits
- Main context: orchestration only (~5% usage)

**Strategy B: Segmented** (has verify-only checkpoints)

- Execute in segments between checkpoints
- Subagent for autonomous segments
- Main context for checkpoints
- Aggregate results → SUMMARY → commit

**Strategy C: Decision-Dependent** (has decision checkpoints)

- Execute in main context
- Decision outcomes affect subsequent tasks
- Quality maintained through small scope (2-3 tasks per plan)
</execution_strategies>

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
- [ ] All independent plans executed in parallel
- [ ] Dependent plans executed after dependencies complete
- [ ] Each task committed individually (feat/fix/test/refactor)
- [ ] All SUMMARY.md files created
- [ ] Metadata committed by orchestrator
- [ ] Phase progress updated
</success_criteria>
