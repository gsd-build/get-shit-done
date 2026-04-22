<purpose>

Archive accumulated phase directories from completed milestones into `.planning/milestones/v{X.Y}-phases/`. Identifies which phases belong to each completed milestone, shows a dry-run summary, and moves directories on confirmation.

</purpose>

<required_reading>

1. `.planning/MILESTONES.md`
2. `.planning/milestones/` directory listing
3. `.planning/phases/` directory listing

</required_reading>

<process>

<step name="identify_completed_milestones">

Read `.planning/MILESTONES.md` to identify completed milestones and their versions.

```bash
cat .planning/MILESTONES.md
```

Extract each milestone version (e.g., v1.0, v1.1, v2.0).

Check which milestone archive dirs already exist:

```bash
ls -d .planning/milestones/v*-phases 2>/dev/null || true
```

Filter to milestones that do NOT already have a `-phases` archive directory.

If all milestones already have phase archives:

```
All completed milestones already have phase directories archived. Nothing to clean up.
```

Stop here.

</step>

<step name="determine_phase_membership">

For each completed milestone without a `-phases` archive, read the archived ROADMAP snapshot to determine which phases belong to it:

```bash
cat .planning/milestones/v{X.Y}-ROADMAP.md
```

Extract phase numbers and names from the archived roadmap (e.g., Phase 1: Foundation, Phase 2: Auth).

Check which of those phase directories still exist in `.planning/phases/`:

```bash
ls -d .planning/phases/*/ 2>/dev/null || true
```

Match phase directories to milestone membership. Only include directories that still exist in `.planning/phases/`.

</step>

<step name="show_dry_run">

Present a dry-run summary for each milestone:

```
## Cleanup Summary

### v{X.Y} — {Milestone Name}
These phase directories will be archived:
- 01-foundation/
- 02-auth/
- 03-core-features/

Destination: .planning/milestones/v{X.Y}-phases/

### v{X.Z} — {Milestone Name}
These phase directories will be archived:
- 04-security/
- 05-hardening/

Destination: .planning/milestones/v{X.Z}-phases/
```

If no phase directories remain to archive (all already moved or deleted):

```
No phase directories found to archive. Phases may have been removed or archived previously.
```

Stop here.


**Text mode (`workflow.text_mode: true` in config or `--text` flag):** Set `TEXT_MODE=true` if `--text` is present in `$ARGUMENTS` OR `text_mode` from init JSON is `true`. When TEXT_MODE is active, replace every `AskUserQuestion` call with a plain-text numbered list and ask the user to type their choice number. This is required for non-Claude runtimes (OpenAI Codex, Gemini CLI, etc.) where `AskUserQuestion` is not available.
AskUserQuestion: "Proceed with archiving?" with options: "Yes — archive listed phases" | "Cancel"

If "Cancel": Stop.

</step>

<step name="archive_phases">

For each milestone, move phase directories:

```bash
mkdir -p .planning/milestones/v{X.Y}-phases
```

For each phase directory belonging to this milestone:

```bash
mv .planning/phases/{dir} .planning/milestones/v{X.Y}-phases/
```

Repeat for all milestones in the cleanup set.

</step>

<step name="commit">

Commit the changes:

```bash
gsd-sdk query commit "chore: archive phase directories from completed milestones" .planning/milestones/ .planning/phases/
```

</step>

<step name="report">

```
Archived:
{For each milestone}
- v{X.Y}: {N} phase directories → .planning/milestones/v{X.Y}-phases/

.planning/phases/ cleaned up.
```

</step>

</process>

<success_criteria>

- [ ] All completed milestones without existing phase archives identified
- [ ] Phase membership determined from archived ROADMAP snapshots
- [ ] Dry-run summary shown and user confirmed
- [ ] Phase directories moved to `.planning/milestones/v{X.Y}-phases/`
- [ ] Changes committed

</success_criteria>
