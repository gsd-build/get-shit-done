---
name: "gsd-sync-resolve"
description: "Address structural conflicts (renames/deletes) before merge"
metadata:
  short-description: "Address structural conflicts (renames/deletes) before merge"
---

<codex_skill_adapter>
Codex skills-first mode:
- This skill is invoked by mentioning `$gsd-sync-resolve`.
- Treat all user text after `$gsd-sync-resolve` as `{{GSD_ARGS}}`.
- If no arguments are present, treat `{{GSD_ARGS}}` as empty.

Legacy orchestration compatibility:
- Any `Task(...)` pattern in referenced workflow docs is legacy syntax.
- Implement equivalent behavior with Codex collaboration tools: `spawn_agent`, `wait`, `send_input`, and `close_agent`.
- Treat legacy `subagent_type` names as role hints in the spawned message.
</codex_skill_adapter>

# $gsd-sync-resolve

Address rename and delete conflicts that require explicit acknowledgment before merge.

## Usage

```
$gsd-sync-resolve              # List all structural conflicts
$gsd-sync-resolve --ack 1      # Acknowledge conflict #1
$gsd-sync-resolve --ack-all    # Acknowledge all conflicts
$gsd-sync-resolve --status     # Check if ready to merge
```

## What It Does

1. Detects renames where upstream moved a file you modified
2. Detects deletes where upstream removed a file you modified
3. Shows similarity percentage for renames (e.g., "92% similar")
4. Shows your modifications that would be affected
5. Requires explicit acknowledgment before merge can proceed

## Why Acknowledgment?

Structural conflicts can cause silent data loss:
- **Rename:** Your changes in `old.cjs` won't automatically move to `new.cjs`
- **Delete:** Your additions to a deleted file will be lost

Acknowledgment ensures you've seen the warning and decided how to proceed.

## Workflow

1. Run `$gsd-sync-preview` to see all issues
2. Run `$gsd-sync-resolve` to see structural conflicts
3. For each conflict, decide:
   - Extract your changes first, or
   - Accept the loss
4. Run `$gsd-sync-resolve --ack N` for each reviewed conflict
5. Run `$gsd-sync-resolve --status` to confirm ready to merge

## Implementation

```bash
node get-shit-done/bin/gsd-tools.cjs upstream resolve $ARGS
```
