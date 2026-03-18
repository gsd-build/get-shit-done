---
name: gsd:knowledge
description: Initialize, index, and query the project knowledge layer — persistent codebase intelligence that survives context resets
argument-hint: "<subcommand> [args]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
---

<objective>
Manage the GSD Knowledge Layer — a persistent, structured intelligence layer that indexes your codebase, tracks patterns/decisions/conventions, and provides relevance-scored context to every executor agent.
</objective>

<subcommands>

## `init`
Initialize the knowledge layer for this project. Creates `.planning/knowledge/` with schema-compliant JSON files. Safe to run multiple times.

```bash
node get-shit-done/bin/gsd-tools.cjs knowledge init
```

## `index`
Full codebase index — scans all source files, computes SHA-256 hashes, extracts exports/imports, maps modules. Use `--incremental` for fast updates.

```bash
# Full rebuild
node get-shit-done/bin/gsd-tools.cjs knowledge index

# Incremental (only changed files since last index)
node get-shit-done/bin/gsd-tools.cjs knowledge index --incremental
```

## `deps`
Build the dependency graph — forward/reverse import maps, module-level dependencies, circular dependency detection.

```bash
node get-shit-done/bin/gsd-tools.cjs knowledge deps
```

## `context`
Assemble relevance-scored context for a task. Uses stemming, synonym expansion, confidence scoring, and token budgeting.

```bash
# Basic context assembly
node get-shit-done/bin/gsd-tools.cjs knowledge context "add authentication to the API"

# With diff awareness (boosts modules with recent changes)
node get-shit-done/bin/gsd-tools.cjs knowledge context "fix the login bug" --diff

# Per-agent budget
node get-shit-done/bin/gsd-tools.cjs knowledge context "write tests" --agent executor --budget 8000
```

## `modules`
List all indexed modules with file counts.

```bash
node get-shit-done/bin/gsd-tools.cjs knowledge modules
```

## `impact`
Show which files and modules are affected by changes to a specific file (reverse dependency lookup).

```bash
node get-shit-done/bin/gsd-tools.cjs knowledge impact src/auth/middleware.js
```

## `staleness`
Check if the knowledge index is stale and needs reindexing.

```bash
node get-shit-done/bin/gsd-tools.cjs knowledge staleness
```

</subcommands>

<process>

### First-time setup
1. Run `knowledge init` to create the directory structure
2. Run `knowledge index` to scan the codebase
3. Run `knowledge deps` to build the dependency graph

### Ongoing use
- Run `knowledge index --incremental` after making changes
- Run `knowledge context "<task>"` before starting work to get relevant context
- Run `knowledge staleness` to check if reindexing is needed

### How it integrates with GSD workflows
The knowledge layer is automatically queried during:
- **execute-phase**: Each executor agent receives relevance-scored context
- **plan-phase**: Planner gets module/dependency awareness
- **verify-work**: Verifier gets impact analysis for changed files

</process>
