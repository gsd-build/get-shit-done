---
name: "gsd-sync-preview"
description: "Preview merge conflicts and binary changes before sync"
metadata:
  short-description: "Preview merge conflicts and binary changes before sync"
---

<codex_skill_adapter>
Codex skills-first mode:
- This skill is invoked by mentioning `$gsd-sync-preview`.
- Treat all user text after `$gsd-sync-preview` as `{{GSD_ARGS}}`.
- If no arguments are present, treat `{{GSD_ARGS}}` as empty.

Legacy orchestration compatibility:
- Any `Task(...)` pattern in referenced workflow docs is legacy syntax.
- Implement equivalent behavior with Codex collaboration tools: `spawn_agent`, `wait`, `send_input`, and `close_agent`.
- Treat legacy `subagent_type` names as role hints in the spawned message.
</codex_skill_adapter>

# $gsd-sync-preview

Preview what would happen if you merged upstream changes right now.

## Usage

```
$gsd-sync-preview
```

## What It Does

1. Uses `git merge-tree` to predict conflicts without modifying your working tree
2. Shows conflict regions with full `<<<<<<<`/`=======`/`>>>>>>>` markers
3. Assigns risk score: EASY, MODERATE, or HARD
4. Detects binary file changes and categorizes by risk level
5. Saves analysis state for $gsd-sync-resolve

## Output

- **Conflict Preview:** Files that would conflict, with regions shown
- **Risk Assessment:** Overall difficulty of the merge
- **Suggestions:** Context-aware advice based on conflict types
- **Binary Changes:** Safe (images), Review (archives), Dangerous (executables)

## Requirements

- Git 2.38+ for conflict preview (graceful fallback for older versions)
- Upstream configured via $gsd-sync-configure

## Implementation

```bash
node get-shit-done/bin/gsd-tools.cjs upstream preview
```
