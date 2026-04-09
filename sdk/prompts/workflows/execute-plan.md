<purpose>
Execute a phase plan (PLAN.md) and create the outcome summary (SUMMARY.md).
Headless SDK variant — runs autonomously without interactive checkpoints or user prompts.
</purpose>

<process>

<step name="init_context" priority="first">
Load execution context from the session's injected context files. Extract: phase directory, phase number, plans, summaries, incomplete plans, state path, config path.

If planning directory is missing: report error via event stream.
</step>

<step name="identify_plan">
Find the first PLAN without a matching SUMMARY. Decimal phases supported (e.g., `01.1-hotfix/`).

Proceed autonomously — no user confirmation needed.
</step>

<step name="record_start_time">
Record plan start timestamp for duration tracking.
</step>

<step name="parse_segments">
Check for checkpoint types in the plan:

**Routing by checkpoint type:**

| Checkpoints | Pattern | Execution |
|-------------|---------|-----------|
| None | A (autonomous) | Execute full plan + SUMMARY |
| Verify-only | B (segmented) | Execute segments autonomously; log verification results instead of pausing |
| Decision | C (main) | Make decisions autonomously based on available context |

In headless mode, all checkpoint types are handled autonomously:
- **human-verify** checkpoints: run automated verification, log results, continue
- **decision** checkpoints: select the recommended option (first option), log the choice, continue
- **human-action** checkpoints: log as a blocker if it requires credentials/auth; otherwise continue with best-effort automation
</step>

<step name="load_prompt">
Read the PLAN.md file. This IS the execution instructions. Follow exactly.

**If plan contains `<interfaces>` block:** Use pre-extracted type definitions directly — do not re-read source files to discover types.
</step>

<step name="execute">
Deviations are normal — handle via rules below.

1. Read context files from prompt
2. Per task:
   - **MANDATORY read_first gate:** If the task has a `<read_first>` field, read every listed file BEFORE making edits.
   - `type="auto"`: Implement with deviation rules. Verify done criteria.
   - `type="checkpoint:*"`: Handle autonomously per parse_segments routing above.
   - **MANDATORY acceptance_criteria check:** After completing each task, verify EVERY criterion before moving to the next task.
3. Run `<verification>` checks
4. Confirm `<success_criteria>` met
5. Document deviations in Summary
</step>

<authentication_gates>
Auth errors during execution are interaction points, not failures.

**Indicators:** "Not authenticated", "Unauthorized", 401/403, "Please run {tool} login", "Set {ENV_VAR}"

**Headless protocol:**
1. Recognize auth gate
2. Log the authentication requirement as a blocker event
3. Continue with remaining non-blocked tasks
4. Report blocked tasks in summary
</authentication_gates>

<deviation_rules>
| Rule | Trigger | Action | Permission |
|------|---------|--------|------------|
| **1: Bug** | Broken behavior, errors, type errors, security vulns | Fix inline, track `[Rule 1 - Bug]` | Auto |
| **2: Missing Critical** | Missing error handling, validation, auth, CSRF/CORS | Add inline, track `[Rule 2 - Missing Critical]` | Auto |
| **3: Blocking** | Prevents completion: missing deps, wrong types, broken imports | Fix blocker, track `[Rule 3 - Blocking]` | Auto |
| **4: Architectural** | Structural change: new DB table, schema change, new service | Log as blocker event; do NOT proceed with architectural changes autonomously | Report |
</deviation_rules>

<step name="verification_failure_gate">
If verification fails, attempt repair autonomously:
1. Analyze the failure
2. Attempt fix (budget: 2 attempts)
3. If repair succeeds: continue
4. If repair exhausted: log failure, continue with remaining tasks, report in summary
</step>

<step name="create_summary">
Create SUMMARY.md with:
- Frontmatter: phase, plan, subsystem, tags, dependency graph, tech-stack, key-files, key-decisions, duration, completion timestamp
- Substantive one-liner (not vague)
- Task completion details
- Deviations documentation
- Any blocked items from auth gates or architectural decisions
</step>

</process>

<success_criteria>
- All tasks from PLAN.md completed (or blocked items documented)
- All verifications pass (or failures documented)
- SUMMARY.md created with substantive content
- Deviations tracked and documented
</success_criteria>
