<purpose>
Display comprehensive project statistics including phases, plans, requirements, git metrics, and timeline.
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context before starting.
</required_reading>

<process>

<step name="gather_stats">
Gather project statistics:

```bash
STATS=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" stats json)
if [[ "$STATS" == @file:* ]]; then STATS=$(cat "${STATS#@file:}"); fi
```

Extract fields from JSON: `milestone_version`, `milestone_name`, `phases`, `phases_completed`, `phases_total`, `total_plans`, `total_summaries`, `percent`, `plan_percent`, `requirements_total`, `requirements_complete`, `git_commits`, `git_first_commit_date`, `last_activity`.
</step>

<step name="present_stats">
Present to the user with this format:

```
# 📊 Project Statistics — {milestone_version} {milestone_name}

## Progress
[████████░░] X/Y phases (Z%)

## Plans
X/Y plans complete (Z%)

## Phases
| Phase | Name | Plans | Completed | Status |
|-------|------|-------|-----------|--------|
| ...   | ...  | ...   | ...       | ...    |

## Requirements
✅ X/Y requirements complete

## Git
- **Commits:** N
- **Started:** YYYY-MM-DD
- **Last activity:** YYYY-MM-DD

## Timeline
- **Project age:** N days
```

If no `.planning/` directory exists, inform the user to run `/gsd-new-project` first.
</step>

</process>

<success_criteria>
- [ ] Statistics gathered from project state
- [ ] Results formatted clearly
- [ ] Displayed to user
</success_criteria>
