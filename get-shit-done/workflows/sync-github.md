# /gsd-sync-github — Workflow

One-way mirror of GSD planning state (`.planning/`) onto GitHub Issues and Milestones.

> **GSD is the source of truth.** GitHub is a read-only reflection. Manual edits on GitHub issue title/body/labels/milestone are overwritten on the next sync. Comments are never touched.

## Modes

| Mode | What it does | Writes to GitHub? |
|------|--------------|-------------------|
| `--dry-run` (default) | Parses `ROADMAP.md` + `.planning/phases/`, compares to live GitHub state, prints structured diff | No |
| `--apply` | Executes the diff: creates missing milestones, opens missing phase issues, transitions labels for drift, closes shipped phases | Yes |
| `--seed-historical` | One-time initialization: creates the current milestone + a single umbrella issue per milestone listing shipped phases as a closed checklist | Yes |
| `--repair` | Rebuilds `.planning/.github-sync.json` from live GitHub state (scan of issues labeled `gsd:phase` + milestones) | No (only registry writes) |
| `--help` | Show mode reference | No |

## How it works

The PostToolUse hook `hooks/gsd-github-sync.sh` reacts to GSD skill invocations and dispatches incremental sync actions:

- `gsd-new-milestone` → create GitHub milestone, ensure label set
- `gsd-add-phase` / `gsd-insert-phase` → create issue with `gsd:phase` + `gsd:status:planned` labels, assign milestone
- `gsd-execute-phase` → swap label to `gsd:status:in-progress`
- `gsd-ship` → close issue with reason `completed`, register PR number
- `gsd-complete-milestone` → close GitHub milestone
- `gsd-remove-phase` → close issue with reason `not_planned`

The `/gsd-sync-github` slash command handles drift repair, historical seeding, and full reconciliation that the hook cannot do incrementally.

## Configuration

In `.planning/config.json`:

```json
{
  "github_sync": {
    "enabled": true,
    "repo": "owner/repo",
    "label_prefix": "gsd",
    "close_on_ship": true
  }
}
```

| Key | Default | Description |
|-----|---------|-------------|
| `enabled` | `false` | Master switch. When false, hook and command are silent no-ops |
| `repo` | (required) | Target GitHub repo in `owner/repo` format |
| `label_prefix` | `"gsd"` | Prefix for created labels (`gsd:phase`, `gsd:status:*`, `gsd:milestone:*`) |
| `close_on_ship` | `true` | When `gsd-ship` runs, close the corresponding issue |

## Registry

`.planning/.github-sync.json` (versioned in git) tracks the mapping between GSD phase IDs and GitHub issue numbers:

```json
{
  "repo": "owner/repo",
  "milestones": { "v1.0": { "number": 1, "state": "open" } },
  "phases": {
    "22.4": { "issue": 158, "milestone": "v1.0", "state": "planned" }
  },
  "umbrella": { "v1_0": { "issue": 155, "state": "closed" } }
}
```

## Safety

- **Opt-in**: `enabled=false` is the default. Sync activates only when you explicitly enable it per project.
- **Never blocks**: every `gh` call is wrapped in `gsd_sync_preflight` which checks `gh auth status`, `hasIssuesEnabled`, and `rate_limit`. Any failure logs a warning to `.planning/.github-sync.log` and exits 0 — the GSD action completes regardless.
- **Idempotent**: running `--apply` twice in a row reports zero changes on the second run. Labels are created with `--force` (safe upsert).
- **Non-destructive**: never deletes issues, never touches comments, never modifies non-`gsd:phase`-labeled issues.

## Environment overrides

| Env var | Effect |
|---------|--------|
| `GSD_SYNC_DRYRUN=1` | Convert every `gh` write into an echo (visible in `.github-sync.log`). Useful for previewing what `--apply` would do. |
| `GSD_SYNC_SANDBOX=1` | Read `.planning/config.local.json` instead of `config.json`. Useful for testing against a sandbox repo without modifying the committed config. |
| `GSD_SYNC_VERBOSE=1` | Print `[gsd-sync]` lines on stderr in addition to file log. |

## First-run checklist

When enabling sync on an existing GSD project for the first time:

1. **Set the config block** in `.planning/config.json` with `enabled=true` and your `repo`.
2. **Preview**: `GSD_SYNC_DRYRUN=1 /gsd-sync-github --apply` — inspect the gh calls that would happen.
3. **Optional sandbox first**: create `.planning/config.local.json` pointing at a throwaway repo, then `GSD_SYNC_SANDBOX=1 /gsd-sync-github --seed-historical --apply` and `--apply`. Validate the umbrella + issues. Idempotency check (`--apply` 2× must be 0 changes). Tear down sandbox.
4. **Real seed**: `/gsd-sync-github --seed-historical --apply` — creates the milestone + umbrella issue (single closed issue with shipped phases checklist).
5. **Real apply**: `/gsd-sync-github --apply` — creates one open issue per planned phase.
6. **Idempotency check**: `/gsd-sync-github --apply` again — must report 0 changes.

From step 6 onwards, the PostToolUse hook handles incremental sync automatically. Reach for `/gsd-sync-github --apply` only for drift reconciliation, or `/gsd-sync-github --repair` if the registry gets corrupted.

## Implementation files

- `hooks/gsd-github-sync.sh` — PostToolUse hook entry point
- `hooks/lib/gsd-github-sync.lib.sh` — shared helpers (preflight, registry, actions, label management)
- `commands/gsd/sync-github.md` — slash command front-matter + delegation
- `get-shit-done/bin/sync-github-impl.sh` — implementation backing the slash command (the four modes)

All scripts use Node.js for JSON parsing (no `jq` dependency, matching the existing convention from `hooks/gsd-phase-boundary.sh`).

## Hook installation

To activate the PostToolUse hook for a project, add to `.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Skill",
        "hooks": [
          {
            "type": "command",
            "command": "hooks/gsd-github-sync.sh",
            "timeout": 20
          }
        ]
      }
    ]
  }
}
```

Adjust the `command` path if you place the GSD hooks dir elsewhere. (When installed via `npx get-shit-done-cc`, the install step can register this automatically; see installer integration notes in the PR.)
