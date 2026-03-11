# GSD (Get Shit Done)

## What This Is

A meta-prompting framework that extends AI coding assistants (Claude Code, OpenCode, Gemini CLI) with structured planning, execution, and verification workflows. GSD transforms vague ideas into shipped products through a systematic flow: questioning → research → requirements → roadmap → planning → execution → verification.

## Core Value

Enable developers to ship faster by providing AI assistants with structured context and clear execution paths — turning "build me an app" into atomic, verifiable tasks with persistent state across sessions.

## Current Milestone: v3.0 Hybrid Runtime Modernization

**Goal:** Replace gsd-tools.cjs with a TypeScript agent runtime while preserving all markdown prompts. API-first design with database-backed state and observable agents.

**Target features:**
- Agent Runtime Engine — TypeScript runtime that loads and executes markdown prompts
- Prompt Loader — Parse agents/*.md with frontmatter, @file includes, template variables
- State Management — Drizzle ORM + SQLite/PostgreSQL replacing markdown state files
- Observability — OpenTelemetry tracing for every tool call, checkpoint, and LLM request
- Agent Framework — Vercel AI SDK integration for streaming and tool calling
- API-First Design — REST + WebSocket API, CLI becomes thin wrapper
- Testing Infrastructure — 80%+ unit test coverage for agent logic

## Previous Milestone: v2.0 GSD Web Dashboard

**Goal:** Provide a feature-rich web application that replicates and enhances the Claude Code CLI experience with visual progress tracking, real-time AI agent orchestration, and interactive checkpoint handling.

**Status:** In Progress (Phases 13-20)

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

- [x] Upstream sync tooling for GSD forks — v1.1 complete
- [~] API layer (MCP Server) for programmatic GSD access — Phase 12 in progress
- [~] GUI/web interface — v2.0 milestone started

### Future (v3.0)

- [ ] Hybrid runtime modernization — TypeScript + agent framework
- [ ] Database-backed state — Replace markdown with SQLite/PostgreSQL
- [ ] API-first architecture — CLI becomes thin wrapper
- [ ] Observable agents — Tracing, debugging, metrics

### Out of Scope
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
| v3.0 hybrid modernization | Keep GSD principles/prompts, modernize runtime with TypeScript + agent framework | Planned v3.0 |
| Ship dashboard before runtime rewrite | Production feedback from v2.0 informs v3.0 design | Decision 2026-03-11 |

## Strategic Roadmap

| Milestone | Focus | Status |
|-----------|-------|--------|
| v1.0 | Worktree Isolation | Complete |
| v1.1 | Upstream Sync | Complete |
| v2.0 | Web Dashboard | In Progress |
| v3.0 | Hybrid Runtime Modernization | Planned |

**v3.0 Vision:** Replace gsd-tools.cjs with TypeScript agent runtime while preserving all markdown prompts (agents/, workflows/). API-first design with database-backed state and observable agents.

---
*Last updated: 2026-03-11 — Added v3.0 strategic direction*
