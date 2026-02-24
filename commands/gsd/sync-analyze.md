---
name: sync-analyze
description: Show upstream commits grouped by directory or feature
arguments:
  - name: by-feature
    description: Group by conventional commit type instead of directory
    required: false
---

# /gsd:sync-analyze

Show upstream commits organized by directory (default) or by feature type (--by-feature).

## Usage

```
/gsd:sync-analyze              # Group by directory (default)
/gsd:sync-analyze --by-feature # Group by conventional commit type
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
