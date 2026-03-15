<purpose>
Show all phases in the current milestone with status overview. Quick, read-only view — no routing logic or next-action suggestions.
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context before starting.
</required_reading>

<process>

<step name="init">
**Check project exists and get milestone info:**

```bash
INIT_RAW=$(node ~/.claude/get-shit-done/bin/gsd-tools.cjs init progress --include config)
if [[ "$INIT_RAW" == @file:* ]]; then
  INIT_FILE="${INIT_RAW#@file:}"
  INIT=$(cat "$INIT_FILE")
  rm -f "$INIT_FILE"
else
  INIT="$INIT_RAW"
fi
```

Extract `project_exists` from the JSON.

If `project_exists` is false:

```
No planning structure found.

Run /gsd:new-project to start a new project.
```

Exit.

Extract `milestone_name` and `milestone_version` from the JSON for the header.
Also extract `current_phase` number to mark the current phase in the table.
</step>

<step name="analyze">
**Get all phase data:**

```bash
ROADMAP=$(node ~/.claude/get-shit-done/bin/gsd-tools.cjs roadmap analyze)
```

This returns JSON with:
- `phases[]` — each phase with: `number`, `name`, `goal`, `depends_on`, `plan_count`, `summary_count`, `disk_status`, `has_context`, `has_research`
- `phase_count`, `completed_phases`, `total_plans`, `total_summaries`, `progress_percent`
- `current_phase` — the current phase number

Compute the progress bar from the analyze data: use `completed_phases`, `phase_count`, and `progress_percent` to build a simple `{completed_phases}/{phase_count} phases` summary.
</step>

<step name="display">
**Render the phase table.**

Use this format:

```
# Phases — {milestone_name} ({milestone_version})

| #  | Phase                            | Status      | Plans   | Depends on |
|----|----------------------------------|-------------|---------|------------|
| 1  | Security Hardening               | ○ Empty     | 0/0     | —          |
| ...                                                                        |

{phase_count} phases · {completed_phases} complete · {progress_percent}% plans executed
```

**Status icon mapping** (from `disk_status` field in roadmap analyze):

| disk_status    | Icon + Label    |
|----------------|-----------------|
| `complete`     | `✓ Complete`    |
| `partial`      | `▸ Partial`     |
| `planned`      | `◐ Planned`     |
| `discussed`    | `◑ Discussed`   |
| `empty`        | `○ Empty`       |
| `no_directory` | `· Pending`     |

**Plans column:** Show `{summary_count}/{plan_count}` (executed/total).

**Depends on column:** Show `depends_on` from the phase data. Use `—` if null or empty.

**Current phase indicator:** Prefix the current phase row's `#` column with `▸` (e.g., `▸ 5` instead of `5`). The current phase number comes from the `current_phase` field in the roadmap analyze output.

**Phase name cleanup:** Strip any trailing ` ✓` from phase names (the status column already shows completion).

</step>

</process>

<success_criteria>
- [ ] Table shows all phases with correct status icons
- [ ] Summary line includes completion count and plan percentage
- [ ] Current phase is marked with ▸ indicator
- [ ] Plans column shows executed/total counts
- [ ] Summary line shows totals
- [ ] Works gracefully when no .planning/ exists (shows helpful message)
- [ ] No routing logic or next-action suggestions — just the phase list
</success_criteria>