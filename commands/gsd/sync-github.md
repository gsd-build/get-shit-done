---
name: gsd:sync-github
description: Reconcile .planning/ phases and milestones with GitHub Issues + Milestones (one-way mirror). Uses the project's github_sync config; safe by default (--dry-run).
argument-hint: "[--dry-run | --apply | --seed-historical | --repair | --help]"
allowed-tools:
  - Bash
  - Read
---
<objective>
Project the GSD planning state (`.planning/`) onto GitHub Issues and Milestones as a one-way mirror. Useful for: stakeholder visibility on the GitHub project board, drift repair, historical seeding, and full resync after manual edits.

GSD remains the source of truth. GitHub is a read-only reflection of phase state.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/sync-github.md
</execution_context>

Execute the sync-github workflow from @~/.claude/get-shit-done/workflows/sync-github.md.

The implementation is a small bash script that respects the `github_sync` block in `.planning/config.json` and the standard env vars (`GSD_SYNC_DRYRUN=1`, `GSD_SYNC_SANDBOX=1`, `GSD_SYNC_VERBOSE=1`).

Run:

```bash
get-shit-done/bin/sync-github-impl.sh $ARGUMENTS
```

If `$ARGUMENTS` is empty, the default mode is `--dry-run`.
