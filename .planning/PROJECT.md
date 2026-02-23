# GSD (Get Shit Done)

## What This Is

A meta-prompting framework that extends AI coding assistants (Claude Code, OpenCode, Gemini CLI) with structured planning, execution, and verification workflows. GSD transforms vague ideas into shipped products through a systematic flow: questioning → research → requirements → roadmap → planning → execution → verification.

## Core Value

Enable developers to ship faster by providing AI assistants with structured context and clear execution paths — turning "build me an app" into atomic, verifiable tasks with persistent state across sessions.

## Current Milestone: v1.1 Upstream Sync

**Goal:** Enable GSD fork maintainers to stay current with upstream while preserving custom enhancements.

**Target features:**
- Fetch and analyze upstream commits grouped by feature
- Deep dive mode for interactive exploration of changes
- Conflict detection before merge attempt
- Smart refactoring with diff review before commit
- Post-merge verification tests

## Requirements

### Validated

- ✓ Command-workflow-agent architecture — existing
- ✓ Multi-runtime support (Claude Code, OpenCode, Gemini CLI) — existing
- ✓ Wave-based parallel plan execution — existing
- ✓ State persistence across sessions (STATE.md) — existing
- ✓ Phase-based roadmap with requirement traceability — existing
- ✓ Codebase mapping with parallel mapper agents — existing
- ✓ Checkpoint handling for interactive flows — existing
- ✓ Auto-advance mode for continuous execution — existing
- ✓ Worktree isolation for parallel phase execution — v1.0
- ✓ Phase finalization workflow (merge + cleanup) — v1.0
- ✓ Health detection and interactive repair — v1.0

### Active

- [ ] Upstream sync tooling for GSD forks

### Out of Scope

- GUI/web interface — CLI-first design, complexity not justified
- Custom AI model hosting — relies on runtime providers
- Real-time collaboration — single-developer workflow

## Context

This is a brownfield project — GSD is being used to improve itself. The codebase is a meta-prompting system where markdown files serve as both configuration and executable prompts.

**Codebase structure:**
- `commands/gsd/*.md` — Entry points for slash commands
- `get-shit-done/workflows/*.md` — Multi-step orchestration logic
- `agents/gsd-*.md` — Specialized subagent prompts
- `get-shit-done/templates/*.md` — Document structure definitions
- `get-shit-done/references/*.md` — Shared knowledge and patterns
- `bin/gsd-tools.cjs` — Central CLI utility (~5400 lines)
- `bin/lib/*.cjs` — Modular domain modules (worktree, health, etc.)

**Tech stack:** JavaScript/Node.js with zero runtime dependencies.

## Constraints

- **No runtime deps**: All code uses Node.js built-in modules only
- **Multi-runtime**: Changes must work across Claude Code, OpenCode, Gemini CLI
- **Path conventions**: Use `~/.claude/get-shit-done/` paths for installed version

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Worktree isolation for parallel execution | Enables working on multiple phases without branch conflicts | Shipped v1.0 |
| finalize-phase as separate workflow | Clear separation between execution and merge/cleanup | Shipped v1.0 |
| Modular code structure | Match upstream's lib/ pattern for easier merges | Shipped v1.0 |

---
*Last updated: 2026-02-23 — Milestone v1.1 started*
