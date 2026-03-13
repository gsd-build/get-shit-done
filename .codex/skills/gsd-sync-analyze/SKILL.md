---
name: "gsd-sync-analyze"
description: "Show upstream commits grouped by directory or feature"
metadata:
  short-description: "Show upstream commits grouped by directory or feature"
---

<codex_skill_adapter>
Codex skills-first mode:
- This skill is invoked by mentioning `$gsd-sync-analyze`.
- Treat all user text after `$gsd-sync-analyze` as `{{GSD_ARGS}}`.
- If no arguments are present, treat `{{GSD_ARGS}}` as empty.

Legacy orchestration compatibility:
- Any `Task(...)` pattern in referenced workflow docs is legacy syntax.
- Implement equivalent behavior with Codex collaboration tools: `spawn_agent`, `wait`, `send_input`, and `close_agent`.
- Treat legacy `subagent_type` names as role hints in the spawned message.
</codex_skill_adapter>

# $gsd-sync-analyze

Show upstream commits organized by directory (default) or by feature type (--by-feature).

## Usage

```
$gsd-sync-analyze              # Group by directory (default)
$gsd-sync-analyze --by-feature # Group by conventional commit type
```

## What It Does

1. Fetches commit data from upstream
2. Groups commits by:
   - **Directory (default):** Which directories are affected (lib/, commands/, etc.)
   - **Feature (--by-feature):** Conventional commit types (feat, fix, refactor, etc.)
3. Shows multi-touch commits under each affected area

## Output

Directory grouping shows which parts of codebase changed:
- `lib/` - Core library changes
- `commands/` - New or modified commands
- `templates/` - Template updates

Feature grouping shows what kind of changes:
- Features - New capabilities
- Fixes - Bug corrections
- Refactors - Code improvements

## Implementation

```bash
node get-shit-done/bin/gsd-tools.cjs upstream analyze $ARGS
```
