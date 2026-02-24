---
name: sync-preview
description: Preview merge conflicts and binary changes before sync
arguments: []
---

# /gsd:sync-preview

Preview what would happen if you merged upstream changes right now.

## Usage

```
/gsd:sync-preview
```

## What It Does

1. Uses `git merge-tree` to predict conflicts without modifying your working tree
2. Shows conflict regions with full `<<<<<<<`/`=======`/`>>>>>>>` markers
3. Assigns risk score: EASY, MODERATE, or HARD
4. Detects binary file changes and categorizes by risk level
5. Saves analysis state for /gsd:sync-resolve

## Output

- **Conflict Preview:** Files that would conflict, with regions shown
- **Risk Assessment:** Overall difficulty of the merge
- **Suggestions:** Context-aware advice based on conflict types
- **Binary Changes:** Safe (images), Review (archives), Dangerous (executables)

## Requirements

- Git 2.38+ for conflict preview (graceful fallback for older versions)
- Upstream configured via /gsd:sync-configure

## Implementation

```bash
node get-shit-done/bin/gsd-tools.cjs upstream preview
```
