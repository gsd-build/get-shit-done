# Health Check and Repair Workflow

This workflow implements the `$gsd-health` command per CONTEXT.md decisions:
- Single command detects and offers to fix all worktree issues
- Default is interactive (prompt for each fix)
- --quiet/--ci flag for non-interactive mode (exit codes only)

<purpose>
Diagnose and repair worktree health issues including orphan detection, stale locks, incomplete finalization, and planning directory integrity.
</purpose>

<required_reading>
Read STATE.md before starting to understand current project state.
</required_reading>

<process>

<step name="parse_arguments">
Parse command arguments:
- `--quiet` or `--ci`: Non-interactive mode, exit with code only
- `--age-threshold N`: Override default 7-day threshold for age_exceeded detection
- `--repair`: Legacy flag for planning-only health (auto-fix enabled)

```bash
QUIET_MODE=false
AGE_THRESHOLD=""

for arg in "$@"; do
  case $arg in
    --quiet|--ci) QUIET_MODE=true ;;
    --age-threshold) shift; AGE_THRESHOLD="$1" ;;
  esac
done
```
</step>

<step name="run_health_check">
Run comprehensive health check:

```bash
HEALTH_ARGS=""
if [ -n "$AGE_THRESHOLD" ]; then
  HEALTH_ARGS="--age-threshold $AGE_THRESHOLD"
fi

HEALTH_RESULT=$(node gsd/get-shit-done/bin/gsd-tools.cjs health check $HEALTH_ARGS --raw)
```

Parse result to get:
- `status`: healthy | degraded | broken
- `issues`: Array of detected issues
- `exit_code`: 0 | 1 | 2 | 3 | 4
- `summary`: { orphan_count, stale_lock_count, incomplete_count }
</step>

<step name="display_diagnosis">
Display health diagnosis in "doctor" format:

**If healthy (no issues):**
```
Worktree Health Check
=====================
Status: HEALTHY

No issues detected. All worktrees are properly tracked.
```

**If issues found:**
```
Worktree Health Check
=====================
Status: DEGRADED (or BROKEN)

Issues Found:
+-------+-------------------+--------------------------+------------------+
| Phase | Type              | Path/Branch              | Suggested Action |
+-------+-------------------+--------------------------+------------------+
| 3     | path_missing      | /path/to/deleted         | Remove registry  |
| 5     | stale_lock        | phase-5-feature (PID 123)| Release lock     |
| 2     | incomplete_final  | merge completed, cleanup | Resume cleanup   |
+-------+-------------------+--------------------------+------------------+

Summary: 2 orphans, 1 incomplete finalization
```

Table format per CONTEXT.md: "Report orphans in detailed table format showing path, branch, age, and suggested action"
</step>

<step name="ci_mode_exit">
**If --quiet/--ci mode:**

Exit immediately with appropriate code:
- 0: Healthy
- 1: Orphans only
- 2: Incomplete finalization only
- 3: Both orphans and incomplete
- 4+: Runtime errors

```bash
if [ "$QUIET_MODE" = "true" ]; then
  exit $EXIT_CODE
fi
```

No prompts, no interactive repair in CI mode.
</step>

<step name="interactive_repair">
**For each issue, one at a time** (per CONTEXT.md: "Process one orphan at a time"):

```markdown
Issue 1 of N: Orphaned Worktree
-------------------------------
Type: path_missing
Phase: 3
Registry Path: /path/that/no/longer/exists
Suggested Action: Remove registry entry and release lock

Fix this issue? (y/n):
```

Use `AskUserQuestion` tool to get confirmation.

**If user confirms (y):**
```bash
REPAIR_RESULT=$(node gsd/get-shit-done/bin/gsd-tools.cjs health repair '${ISSUE_JSON}' --raw)
```

Report result:
- Success: "Fixed: Registry entry removed."
- Failure: "Failed: ${reason}. ${details}"

**If user declines (n):**
- Skip to next issue
- Note: "Skipped. Run $gsd-health again to retry."

Continue to next issue until all processed.
</step>

<step name="final_summary">
After processing all issues:

```
Health Check Complete
=====================
Issues fixed: 2
Issues skipped: 1
Issues failed: 0

Run $gsd-health again to verify all issues resolved.
```

If any issues remain, exit with non-zero code per the exit code specification.
</step>

</process>

<exit_codes>
Per CONTEXT.md decision:
- 0: Healthy (no issues, or all issues fixed)
- 1: Orphans remain
- 2: Incomplete finalization remains
- 3: Both types remain
- 4+: Runtime/repair errors
</exit_codes>

<safety_notes>
- NEVER delete worktree with uncommitted changes (cmdHealthRepair enforces this)
- Stale locks from different hostname require --force confirmation
- merge_in_progress requires manual resolution (offer `git merge --abort` guidance)
- Failed repairs trigger rollback - system remains in known state
</safety_notes>

<issue_types>

| Type | Description | Auto-Repairable | Repair Action |
|------|-------------|-----------------|---------------|
| path_missing | Registry entry points to deleted path | Yes | Remove registry entry + lock |
| not_in_git | Path exists but not in git worktree list | Yes | git worktree prune + mark removed |
| not_in_registry | Git worktree not in registry | Yes | Add to registry as 'untracked' |
| stale_lock | Lock from dead process | Yes (same host) | Release lock + remove lock dir |
| age_exceeded | Worktree older than threshold | Yes (if clean) | Remove worktree + registry + lock |
| incomplete_finalization | Marker file from interrupted finalization | Yes | Resume pending steps |
| merge_in_progress | MERGE_HEAD exists | No | Requires human decision |

</issue_types>
