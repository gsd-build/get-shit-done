# TaskFlow

## What This Is

A task management app for developers who want to track their work without leaving the terminal. CLI-first with optional web dashboard for visualization.

## Core Value

Fast task capture from anywhere — if adding a task takes more than 3 seconds, developers won't use it.

## Requirements

### Validated

- ✓ CLI task creation with `task add "description"` — v0.1
- ✓ List tasks with filtering `task list --tag=bug` — v0.1

### Active

- [ ] Web dashboard showing task burndown
- [ ] Real-time sync between CLI and dashboard
- [ ] GitHub issue integration for bidirectional sync

### Out of Scope

- Mobile app — complexity for limited value, CLI works via SSH
- Team features — solo developer focus, teams use Jira/Linear
- Time tracking — feature creep, use dedicated tool

## Context

Built as a personal tool that grew. Users are developers who live in terminals. Primary use case is quick capture during coding sessions. Existing solutions (Todoist, Things) require context switching to GUI.

Current user base: ~50 developers using CLI, requesting dashboard for weekly reviews.

## Constraints

- **Tech stack**: TypeScript, Next.js, SQLite — matches existing CLI codebase
- **Deployment**: Self-hosted or Vercel — users want data ownership
- **Performance**: Task add must complete in <100ms — core value
- **Compatibility**: Works offline, syncs when connected — developers travel

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| SQLite over Postgres | Simpler self-hosting, no DB server | ✓ Good |
| SSE over WebSockets | Unidirectional updates, simpler | — Pending |
| jose for JWT | ESM-native, Edge-compatible | ✓ Good |
| Prisma ORM | Type safety, migrations | ✓ Good |

---
*Last updated: 2025-01-15 after Phase 1*
