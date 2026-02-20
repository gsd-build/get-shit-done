<purpose>
Execute entire ROADMAP.md autonomously with Opus coordinator spawning sub-coordinators per phase.
</purpose>

<core_principle>
Coordinator stays lean — parses roadmap, tracks DAG, spawns phases. Each phase gets fresh 200k context. No context rot across multi-phase execution.
</core_principle>

<required_reading>
Read STATE.md before any operation to load project context.
</required_reading>

<process>

<step name="initialize" priority="first">
Load roadmap context:

```bash
INIT_FILE="/tmp/gsd-roadmap-init-$$.json"
node ~/.claude/get-shit-done/bin/gsd-tools.js init execute-roadmap > "$INIT_FILE"
```

Parse JSON for:
- `roadmap_exists`: boolean — if false, error and exit
- `total_phases`: number of phases
- `execution_order`: ordered array of phase numbers
- `parallel_opportunities`: phases that can run together
- `next_executable`: phases immediately runnable
- `blocked_phases`: phases with unmet dependencies
- `has_execution_log`: whether previous execution exists
- `resume_state`: if previous incomplete execution found, resume context
- `coordinator_model`: model for this coordinator (opus)

**If `roadmap_exists` is false:** Error — ".planning/ROADMAP.md not found. Initialize project first."

**If `resume_state` is set:** Present resume prompt before continuing (see `<step name="resume_capability">`).
</step>

<step name="confirm_execution">
Present execution plan to user before any autonomous action:

```
## Roadmap Execution Plan

**Total phases:** {total_phases}
**Execution order:** {execution_order}
**Parallel opportunities:** {parallel_opportunities}

### Phase Sequence

| # | Phase | Status | Dependencies |
|---|-------|--------|--------------|
| 1 | {name} | {disk_status} | {depends_on} |
...

**Estimated duration:** ~{N * 5-15} minutes (varies by phase complexity)

Confirm autonomous execution? This will execute all incomplete phases sequentially.

Type "yes" to begin, "skip {N}" to skip a phase, or "stop" to cancel.
```

If user types "stop": exit cleanly.
If user types "skip {N}": mark phase N as skipped in execution log, continue.
If user types "yes": proceed to `initialize_execution_log`.
</step>

<step name="initialize_execution_log">
Create or append to `.planning/EXECUTION_LOG.md`:

```bash
node ~/.claude/get-shit-done/bin/gsd-tools.js execution-log event \
  --type roadmap_start \
  --data '{"total_phases": {N}, "execution_order": [...], "timestamp": "..."}'
```

Log format: JSONL lines after markdown header, enabling streaming append:
```
# Execution Log
{"type":"roadmap_start","timestamp":"...","total_phases":8,"execution_order":[1,3,2,4,5,6,7,8]}
```

**Create Telegram forum topic for this execution:**

Derive `roadmap_name` from the first heading in ROADMAP.md (`# Roadmap: {name}` → strip "Roadmap: " prefix). Fallback to "Roadmap" if not found.

If the Telegram MCP is available, create a dedicated forum topic to receive all execution notifications:

```
telegram_topic_id = null
try:
  topic_result = mcp__telegram__create_topic({
    title: "GSD: {roadmap_name} — {current_date}"
  })
  telegram_topic_id = topic_result.threadId
  // Store thread_id in execution log so phase coordinators can read it
  node ~/.claude/get-shit-done/bin/gsd-tools.js execution-log event \
    --type telegram_topic_created \
    --data '{"thread_id": {telegram_topic_id}, "title": "GSD: {roadmap_name} — {current_date}"}'
except (MCP not available / TELEGRAM_BOT_TOKEN not set):
  // No Telegram configured — silent, expected case
  telegram_topic_id = null

except (any other error — e.g. bot not admin, group not found, API error):
  // Telegram IS configured but create_topic failed — notify user visibly
  telegram_topic_id = null
  node ~/.claude/get-shit-done/bin/gsd-tools.js execution-log event \
    --type telegram_topic_failed \
    --data '{"reason": "{error.message}", "timestamp": "{ISO}"}'
  // Write a visible warning to the execution output:
  console.warn("WARNING: Telegram notifications disabled for this run — create_topic failed: {error.message}")
  // Also attempt to send a plain group message (no thread) if bot token is set:
  try:
    mcp__telegram__send_message({
      text: "WARNING: Failed to create forum topic for this roadmap run. Notifications are disabled.\nReason: {error.message}"
    })
  except: pass  // Best-effort only
```

if telegram_topic_id is null AND TELEGRAM_BOT_TOKEN is set:
  // Telegram is configured but not operational for this run
  // All subsequent `if telegram_topic_id is not null:` guards will correctly suppress notifications
  log.warn("Telegram topic creation failed — all thread-targeted notifications suppressed for this run")

The `telegram_topic_id` variable persists in the coordinator's context for the duration of the execution. Pass `thread_id: telegram_topic_id` (when non-null) to all subsequent `mcp__telegram__send_message` calls.

**Send execution start notification:**

```
if telegram_topic_id is not null:
  mcp__telegram__send_message({
    text: "Roadmap execution started\n\nPhases: {execution_order joined with ', '}\n\n{For each phase in execution_order: '- Phase {N}: {phase_name}'}\n\nTotal: {total_phases} phases",
    thread_id: telegram_topic_id
  })
```
</step>

<step name="execute_phases">
For each phase in execution order:

**1. Check skip list:**
- If user skipped this phase: log `phase_skipped`, continue to next

**2. Check dependencies:**
```bash
# For each dep in phase.depends_on:
node ~/.claude/get-shit-done/bin/gsd-tools.js roadmap get-phase {dep}
# Check disk_status == "complete"
```

If any dependency not complete:
- Attempt to execute dependency first (recursive)
- If dependency blocked: present blocker, wait for user resolution

**3. Log phase start:**
```bash
node ~/.claude/get-shit-done/bin/gsd-tools.js execution-log event \
  --type phase_start \
  --data '{"phase": {N}, "name": "...", "timestamp": "..."}'
```

**4. Spawn sub-coordinator (fresh context window):**

Read coordinator model from config (fallback to sonnet):
```bash
COORDINATOR_MODEL=$(jq -r '.coordinator_model // "sonnet"' .planning/config.json 2>/dev/null || echo "sonnet")
```

```
Task(
  subagent_type="gsd-phase-coordinator",
  model="{COORDINATOR_MODEL}",
  prompt="Execute Phase {N}: {name}

  Phase directory: .planning/phases/{phase_dir}/
  Phase goal: {goal}

  Full cycle: research -> plan -> execute -> verify

  @/Users/ollorin/.claude/get-shit-done/workflows/execute-phase-lifecycle.md

  Create checkpoint after each step.
  telegram_topic_id: {telegram_topic_id}
  Return structured completion state as JSON."
)
```

**5. Handle result:**
- `status: "completed"`: log `phase_complete`, continue to next phase
- `status: "failed"`: see `<step name="handle_failure">`
- `status: "blocked"`: present blocker, wait for resolution
- `status: "gaps_found"`: offer gap closure cycle, then continue
- `status: "human_needed"`: present human items, await approval

**6. Archive phase context:**
- Compress completed phase to summary (SUMMARYs already created by executor)
- Clean up ephemeral checkpoints
- Present phase completion report:

```
## Phase {N} Complete: {Name}

**Status:** Completed
**Plans executed:** {M}
**Duration:** ~{T} minutes

### What was built
{from phase SUMMARY.md one-liner}

{If more phases: "Next: Phase {N+1}: {Name}"}
```
</step>

<step name="handle_failure">
On phase failure:

1. **Log failure:**
```bash
node ~/.claude/get-shit-done/bin/gsd-tools.js execution-log event \
  --type phase_failed \
  --data '{"phase": {N}, "error": "...", "timestamp": "..."}'
```

2. **Send failure notification:**
```
if telegram_topic_id is not null:
  mcp__telegram__send_message({
    text: "Phase {N} failed\n\nError: {error}\nLast step: {step}\n\nOptions: reply 'retry', 'skip', or 'stop'",
    thread_id: telegram_topic_id
  })
```

3. **Create detailed checkpoint:**
```
## Phase {N} Failed

**Error:** {error}
**Last completed step:** {step}
**Files modified:** {files}

### Options
- "retry" — retry this phase with fresh context
- "skip" — skip this phase and continue (may block dependent phases)
- "stop" — stop execution, preserve partial state
```

4. **Store failure context for manual intervention:**
- Checkpoint file at `.planning/phases/{phase_dir}/FAILURE.md`
- Include: error, last step, files touched, suggested fixes
</step>

<step name="resume_capability">
If previous execution incomplete (resume_state set):

```
## Resume Previous Execution

A previous roadmap execution was interrupted:
- **Last phase started:** {resume_state.phase} ({resume_state.phase_name})
- **Status:** {resume_state.status}
- **Execution log:** .planning/EXECUTION_LOG.md

### Resume Options
- "resume" — continue from {next_phase_after_last}
- "restart" — start fresh from beginning (overwrites log)
- "stop" — exit without resuming
```

**Resume flow:**
1. Find last `phase_complete` event in EXECUTION_LOG.md
2. Skip all phases up to and including last complete
3. Start from next incomplete phase
4. Re-check all dependencies (may have changed)
</step>

<step name="completion">
After all phases complete (or all remaining skipped):

1. **Log roadmap complete:**
```bash
node ~/.claude/get-shit-done/bin/gsd-tools.js execution-log event \
  --type roadmap_complete \
  --data '{"completed_phases": [...], "skipped_phases": [...], "timestamp": "..."}'
```

2. **Send execution complete notification:**
```
if telegram_topic_id is not null:
  // Build one-liner per phase from SUMMARYs
  phase_lines = []
  for each completed_phase:
    summary_oneliner = read first non-blank, non-heading line from .planning/phases/{phase_dir}/*-SUMMARY.md
    phase_lines.push("- Phase {N} ({name}): {summary_oneliner}")

  mcp__telegram__send_message({
    text: "Roadmap execution complete\n\nCompleted: {completed_count}/{total_phases}\nSkipped: {skipped_count}\n\n{phase_lines joined with newline}",
    thread_id: telegram_topic_id
  })
```

3. **Present completion summary:**
```
## Roadmap Execution Complete

**Phases completed:** {N}/{total}
**Phases skipped:** {M}
**Total duration:** ~{T} minutes

### What was built
{One line per completed phase from SUMMARY.md}

### Next Steps
- Review any skipped phases
- Run /gsd:verify-work {phase} for any phase needing deeper validation
- Start a new milestone: /gsd:complete-milestone
```

3. **Clean up:**
- Remove ephemeral checkpoint files
- Preserve EXECUTION_LOG.md for history
</step>

</process>

<context_efficiency>
Coordinator: ~10-15% context. Each phase sub-coordinator: fresh 200k context window. No state leaks between phases. Execution log is the only shared state — JSONL for streaming append without full-file reads.
</context_efficiency>

<failure_handling>
- **ROADMAP.md missing:** Error immediately, no execution
- **Phase sub-coordinator fails:** Present options (retry/skip/stop), preserve partial state
- **Dependency chain breaks:** Phase N failed means Phase N+1 may also fail — user chooses continue or stop
- **Interrupted execution:** Resume via EXECUTION_LOG.md scan on next run
- **All phases fail:** Systemic issue — stop, report, suggest investigation
- **classifyHandoffIfNeeded false failure:** Agent reports failed but error is Claude Code bug — spot-check SUMMARY.md + commits — if pass, treat as success
</failure_handling>

<resumption>
Re-run `/gsd:execute-roadmap` → init detects EXECUTION_LOG.md with incomplete state → resume_state set → present resume prompt → user chooses "resume" → skip completed phases → continue from next incomplete phase.

EXECUTION_LOG.md is the source of truth for execution state. Each phase start/complete event timestamped and logged. Enables post-mortem analysis of execution history.
</resumption>

<parallel_execution>
When `parallel_opportunities` contains multiple phases:
- Phases with no mutual dependencies can run simultaneously
- Spawn multiple sub-coordinators in parallel via Task()
- Wait for all to complete before proceeding to dependent phases
- Handle mixed results: some pass, some fail, some blocked

Current implementation: sequential by default. Parallel execution requires explicit user opt-in ("run parallel? yes/no") due to complexity of failure handling.
</parallel_execution>
