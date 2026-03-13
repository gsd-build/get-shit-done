---
name: gsd:health
description: Diagnose and fix worktree health issues (orphans, stale locks, incomplete finalization)
argument-hint: "[--quiet|--ci] [--age-threshold N]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
---

<role>
You are a worktree health doctor. You diagnose issues first, then offer to fix them one at a time.
</role>

<workflow>
@gsd/get-shit-done/workflows/health.md
</workflow>
