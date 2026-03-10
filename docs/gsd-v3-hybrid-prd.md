# GSD v3.0 Hybrid Runtime Modernization - Product Requirements Document

**Version:** 1.0
**Date:** 2026-03-11
**Author:** Maurice van der Merwe
**Status:** Draft
**Depends on:** v2.0 Web Dashboard (production feedback informs design)

---

## Executive Summary

GSD v3.0 modernizes the runtime while preserving GSD's proven intellectual property. The current gsd-tools.cjs (5400+ lines of synchronous JavaScript) is replaced with a TypeScript-first agent runtime built on modern multi-agent frameworks. All markdown prompts (agents/, workflows/, templates/) carry forward unchanged. The result is an API-first, observable, database-backed system that runs anywhere — not just inside Claude Code.

---

## Problem Statement

GSD v1.x/v2.0 has limitations rooted in its CLI-first, Claude Code-dependent architecture:

1. **Claude Code dependency** — Agents can only run inside Claude Code's Agent tool
2. **Synchronous JavaScript** — gsd-tools.cjs blocks on operations, no async patterns
3. **Markdown state** — STATE.md/ROADMAP.md parsed on every read, no caching
4. **No observability** — Can't trace agent decisions, debug failures, or measure performance
5. **Limited testing** — No unit tests for agent behavior, only E2E
6. **Single-threaded** — Wave execution is sequential within Claude Code context
7. **No API** — MCP Server is bolted on, not native

---

## Goals & Success Metrics

### Goals

1. **Runtime independence** — Run GSD agents outside Claude Code (CLI, API, Dashboard)
2. **Observable agents** — Trace every decision, tool call, and checkpoint
3. **Database-backed state** — Fast queries, proper migrations, concurrent access
4. **Type safety** — Full TypeScript with strict mode
5. **Testable agents** — Unit test agent logic without API calls
6. **API-first** — REST/WebSocket API is primary, CLI wraps API

### Success Metrics

| Metric | Target |
|--------|--------|
| Agent execution outside Claude Code | 100% of workflows |
| Type coverage | 100% strict TypeScript |
| Agent logic unit test coverage | 80%+ |
| State query latency | <10ms (vs 100ms+ markdown parsing) |
| Trace visibility | Every tool call, checkpoint, decision |
| Breaking changes to prompts | 0 (all agents/*.md unchanged) |

---

## What We Keep (GSD IP)

These artifacts represent years of prompt engineering and are preserved unchanged:

### Markdown Prompts

| Directory | Purpose | Files |
|-----------|---------|-------|
| `agents/gsd-*.md` | Specialized subagent definitions | 15+ |
| `get-shit-done/workflows/*.md` | Multi-step orchestration logic | 20+ |
| `get-shit-done/templates/*.md` | Document structure definitions | 10+ |
| `get-shit-done/references/*.md` | Shared knowledge and patterns | 10+ |
| `commands/gsd/*.md` | Slash command entry points | 25+ |

### Core Principles

1. **Questioning → Research → Requirements → Roadmap** — Discovery flow
2. **Phase-based execution** — Atomic units of work with success criteria
3. **Wave-based parallelization** — Independent plans execute concurrently
4. **Checkpoint-first HITL** — Human approval at critical decision points
5. **Verification before completion** — Goal-backward validation
6. **TDD enforcement** — Red-Green-Refactor for code tasks

### File Conventions

- `.planning/` directory structure
- `XX-YY-PLAN.md` naming for phase plans
- `CONTEXT.md`, `RESEARCH.md`, `VERIFICATION.md` artifacts
- Frontmatter patterns in state files

---

## What We Replace

### Current Architecture (v1.x/v2.0)

```
┌─────────────────────────────────────────────────────────┐
│                    Claude Code                           │
│  ┌─────────────────────────────────────────────────┐    │
│  │              Agent Tool (subagent)               │    │
│  │  ┌─────────────────────────────────────────┐    │    │
│  │  │         Markdown Prompt Loaded          │    │    │
│  │  │    (agents/gsd-executor.md, etc.)       │    │    │
│  │  └─────────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────┘    │
│                         │                                │
│                         ▼                                │
│  ┌─────────────────────────────────────────────────┐    │
│  │              gsd-tools.cjs (5400 LOC)            │    │
│  │  • Synchronous JavaScript                        │    │
│  │  • Markdown parsing on every read                │    │
│  │  • File system state                             │    │
│  │  • No observability                              │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

### Target Architecture (v3.0)

```
┌─────────────────────────────────────────────────────────┐
│                    GSD Agent Runtime                     │
├─────────────────────────────────────────────────────────┤
│  Agent Definitions (Markdown — unchanged)               │
│  ├── agents/gsd-executor.md                             │
│  ├── agents/gsd-planner.md                              │
│  ├── workflows/execute-phase.md                         │
│  └── ...                                                │
├─────────────────────────────────────────────────────────┤
│  Agent Runtime (TypeScript — new)                       │
│  ├── Prompt Loader — parses markdown into agent config  │
│  ├── Agent Graph — LangGraph/Vercel AI SDK orchestration│
│  ├── Tool Registry — typed tool definitions             │
│  ├── Checkpoint Manager — pause/resume with DB state    │
│  ├── Tracer — OpenTelemetry-compatible traces           │
│  └── State Manager — Drizzle ORM + SQLite/PostgreSQL    │
├─────────────────────────────────────────────────────────┤
│  API Layer                                              │
│  ├── REST API (Hono) — CRUD for projects, phases, plans│
│  ├── WebSocket (Socket.IO) — streaming, checkpoints    │
│  └── CLI (Commander) — thin wrapper over API            │
├─────────────────────────────────────────────────────────┤
│  Consumers                                              │
│  ├── GSD Dashboard (v2.0) — web UI                      │
│  ├── Claude Code — via MCP Server                       │
│  ├── CLI — gsd command                                  │
│  └── External tools — API integration                   │
└─────────────────────────────────────────────────────────┘
```

---

## Core Features

### F1: Agent Runtime Engine

**Priority:** P0 (Must Have)

TypeScript runtime that loads markdown prompts and executes agents.

**Requirements:**

- F1.1: Load agent definitions from `agents/*.md` with frontmatter parsing
- F1.2: Execute agent graph with typed state transitions
- F1.3: Support tool calling with typed inputs/outputs
- F1.4: Handle checkpoints with pause/resume across sessions
- F1.5: Stream agent output to consumers (WebSocket, CLI)
- F1.6: Integrate with Claude API (Anthropic SDK) and other providers

**Acceptance Criteria:**

- [ ] Agent executes identically whether called from CLI, API, or Dashboard
- [ ] Checkpoints persist to database, resumable after process restart
- [ ] Tool calls are traced with inputs, outputs, and timing

---

### F2: Prompt Loader

**Priority:** P0 (Must Have)

Parse markdown prompts into executable agent configurations.

**Requirements:**

- F2.1: Parse YAML frontmatter for agent metadata
- F2.2: Extract system prompt from markdown body
- F2.3: Resolve `@file` references to include external content
- F2.4: Support template variables (`{phase_number}`, `{project_path}`)
- F2.5: Validate prompt structure against schema
- F2.6: Hot-reload prompts in development mode

**Acceptance Criteria:**

- [ ] All existing `agents/*.md` files parse without modification
- [ ] Template variables resolve correctly at runtime
- [ ] Invalid prompts produce clear error messages

---

### F3: State Management

**Priority:** P0 (Must Have)

Database-backed state replacing markdown file parsing.

**Requirements:**

- F3.1: SQLite for local development, PostgreSQL for production
- F3.2: Drizzle ORM for type-safe queries and migrations
- F3.3: Store project, phase, plan, and execution state
- F3.4: Maintain backward compatibility with `.planning/` markdown files
- F3.5: Bidirectional sync between database and markdown (for CLI users)
- F3.6: Sub-10ms query latency for common operations

**Acceptance Criteria:**

- [ ] Database schema covers all STATE.md, ROADMAP.md fields
- [ ] Markdown files stay in sync for users who read them directly
- [ ] Migrations run automatically on version upgrade

---

### F4: Observability

**Priority:** P0 (Must Have)

Trace agent execution for debugging and performance analysis.

**Requirements:**

- F4.1: OpenTelemetry-compatible traces for all agent operations
- F4.2: Trace tool calls with input, output, duration, and status
- F4.3: Trace checkpoint events with user response time
- F4.4: Trace LLM calls with token counts and latency
- F4.5: Local trace viewer (web UI) for development
- F4.6: Export traces to external systems (Jaeger, Honeycomb)

**Acceptance Criteria:**

- [ ] Every agent execution produces a complete trace
- [ ] Traces include parent-child relationships for subagents
- [ ] Local viewer shows trace waterfall without external dependencies

---

### F5: Agent Framework Integration

**Priority:** P0 (Must Have)

Build on proven multi-agent framework rather than custom implementation.

**Requirements:**

- F5.1: Evaluate and select framework (LangGraph, Vercel AI SDK, Mastra)
- F5.2: Map GSD workflow patterns to framework primitives
- F5.3: Support parallel agent execution (wave-based)
- F5.4: Support agent-to-agent communication (orchestrator → subagent)
- F5.5: Maintain GSD checkpoint semantics within framework
- F5.6: Framework must support TypeScript natively

**Evaluation Criteria:**

| Framework | Language | Checkpoints | Streaming | Observability | Complexity |
|-----------|----------|-------------|-----------|---------------|------------|
| LangGraph | Python | Native | Yes | LangSmith | High |
| Vercel AI SDK | TypeScript | Manual | Native | Custom | Medium |
| Mastra | TypeScript | Native | Yes | Built-in | Medium |
| Claude Agent SDK | TypeScript | Manual | Native | Custom | Low |

**Recommendation:** Evaluate Vercel AI SDK and Mastra during v2.0, decide based on production experience.

---

### F6: API-First Design

**Priority:** P0 (Must Have)

REST and WebSocket API as primary interface.

**Requirements:**

- F6.1: REST API for all CRUD operations (projects, phases, plans)
- F6.2: WebSocket API for streaming and checkpoints
- F6.3: OpenAPI specification with TypeScript types generated
- F6.4: Authentication layer (optional, for multi-user deployments)
- F6.5: Rate limiting and request validation
- F6.6: CLI implemented as API client, not separate logic

**Acceptance Criteria:**

- [ ] Every CLI command maps to an API endpoint
- [ ] OpenAPI spec is auto-generated and always current
- [ ] API works identically whether called from CLI, Dashboard, or external tool

---

### F7: CLI Wrapper

**Priority:** P1 (Should Have)

Thin CLI that wraps the API.

**Requirements:**

- F7.1: Commander-based CLI with subcommands
- F7.2: All commands call API endpoints
- F7.3: Streaming output for long-running operations
- F7.4: Interactive prompts for checkpoints
- F7.5: Configuration via environment variables and config file
- F7.6: Backward-compatible with existing `/gsd:*` commands

**Acceptance Criteria:**

- [ ] `gsd progress` returns same output as current system
- [ ] `gsd execute-phase 13` streams logs to terminal
- [ ] Checkpoints prompt in terminal, response sent via API

---

### F8: Testing Infrastructure

**Priority:** P1 (Should Have)

Unit and integration tests for agent logic.

**Requirements:**

- F8.1: Mock LLM responses for deterministic agent tests
- F8.2: Test agent state transitions without API calls
- F8.3: Snapshot testing for prompt rendering
- F8.4: Integration tests with real API (using test account)
- F8.5: CI pipeline with test coverage reporting
- F8.6: Playwright tests for Dashboard integration

**Acceptance Criteria:**

- [ ] Agent logic has 80%+ unit test coverage
- [ ] Tests run in <60 seconds without network calls
- [ ] CI blocks merge on test failure

---

## Technical Architecture

### Technology Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Language | TypeScript 5.x | Type safety, modern async |
| Runtime | Node.js 22+ | Native ESM, performance |
| Agent Framework | Vercel AI SDK / Mastra | TypeScript-native, streaming |
| LLM Integration | Anthropic SDK | Official Claude API |
| Database | SQLite (dev) / PostgreSQL (prod) | Simple → scalable |
| ORM | Drizzle | Type-safe, fast, migrations |
| API Framework | Hono | Fast, TypeScript-first |
| WebSocket | Socket.IO | Reliable, auto-reconnect |
| CLI | Commander | Standard Node.js CLI |
| Tracing | OpenTelemetry | Industry standard |
| Testing | Vitest | Fast, TypeScript-native |
| Build | tsup / esbuild | Fast bundling |
| Monorepo | Turborepo + pnpm | Shared packages |

### Package Structure

```
gsd/
├── packages/
│   ├── core/                 # Agent runtime, state, tracing
│   │   ├── src/
│   │   │   ├── agents/       # Agent graph definitions
│   │   │   ├── prompts/      # Prompt loader
│   │   │   ├── state/        # Database, Drizzle schema
│   │   │   ├── tools/        # Tool implementations
│   │   │   ├── trace/        # OpenTelemetry integration
│   │   │   └── index.ts
│   │   └── package.json
│   ├── api/                  # REST + WebSocket server
│   │   ├── src/
│   │   │   ├── routes/       # Hono routes
│   │   │   ├── ws/           # Socket.IO handlers
│   │   │   └── index.ts
│   │   └── package.json
│   ├── cli/                  # Command-line interface
│   │   ├── src/
│   │   │   ├── commands/     # Commander subcommands
│   │   │   └── index.ts
│   │   └── package.json
│   ├── dashboard/            # Web UI (from v2.0)
│   │   └── ...
│   └── shared/               # Shared types, utilities
│       ├── src/
│       │   ├── types/        # TypeScript interfaces
│       │   └── utils/        # Shared utilities
│       └── package.json
├── prompts/                  # Markdown prompts (unchanged from v2.0)
│   ├── agents/
│   ├── workflows/
│   ├── templates/
│   └── references/
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

### Data Flow

```
User Command (CLI/Dashboard/API)
         │
         ▼
┌─────────────────┐
│    API Layer    │
│  (Hono + WS)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Agent Runtime  │
│  ┌───────────┐  │
│  │  Prompt   │  │ ← Load from prompts/*.md
│  │  Loader   │  │
│  └─────┬─────┘  │
│        ▼        │
│  ┌───────────┐  │
│  │  Agent    │  │ ← Execute graph (Vercel AI SDK)
│  │  Graph    │  │
│  └─────┬─────┘  │
│        │        │
│   ┌────┴────┐   │
│   ▼         ▼   │
│ Tools    Checkpoints
│   │         │   │
│   ▼         ▼   │
│ ┌─────┐ ┌─────┐ │
│ │Trace│ │State│ │ ← OpenTelemetry + Drizzle
│ └─────┘ └─────┘ │
└─────────────────┘
         │
         ▼
┌─────────────────┐
│    Database     │
│ (SQLite/PG)     │
└─────────────────┘
```

---

## Migration Strategy

### Phase 1: Parallel Implementation

- Build v3.0 runtime alongside existing gsd-tools.cjs
- Both systems read/write same `.planning/` files
- v3.0 is opt-in via `gsd3` command

### Phase 2: Feature Parity

- All `/gsd:*` commands work in v3.0
- Dashboard switches to v3.0 API
- Performance and correctness validated

### Phase 3: Deprecation

- v2.0 commands emit deprecation warnings
- Documentation points to v3.0
- gsd-tools.cjs enters maintenance mode

### Phase 4: Removal

- v2.0 runtime removed
- gsd-tools.cjs archived
- v3.0 becomes `gsd`

---

## Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| Cold start time | <500ms |
| Agent response latency | <100ms (excluding LLM) |
| Database query latency | <10ms |
| Memory usage (idle) | <100MB |
| Concurrent executions | 10+ (limited by LLM rate limits) |
| Trace storage | 30 days default |
| TypeScript strict mode | Required |
| Node.js version | 22+ (native ESM) |

---

## Out of Scope (v3.0)

1. **Multi-tenant SaaS** — Single-user focus maintained
2. **Custom LLM providers** — Claude API only (extensible later)
3. **Visual agent builder** — Markdown prompts are the interface
4. **Agent marketplace** — Use existing skills ecosystem
5. **Kubernetes deployment** — Docker Compose is sufficient

---

## Milestones

| Milestone | Duration | Deliverables |
|-----------|----------|--------------|
| M1: Core Runtime | 3 weeks | Prompt loader, agent graph, basic tools |
| M2: State Management | 2 weeks | Drizzle schema, migrations, markdown sync |
| M3: Observability | 2 weeks | Tracing, local viewer, exports |
| M4: API Layer | 2 weeks | REST API, WebSocket, OpenAPI spec |
| M5: CLI | 1 week | Commander CLI, API client |
| M6: Dashboard Integration | 2 weeks | Migrate Dashboard to v3.0 API |
| M7: Migration & Polish | 2 weeks | Testing, docs, deprecation |

**Total estimated duration: 14 weeks**

---

## Appendix

### A. Framework Evaluation Criteria

| Criterion | Weight | Notes |
|-----------|--------|-------|
| TypeScript support | High | Must be native, not wrapper |
| Checkpoint support | High | GSD's core pattern |
| Streaming | High | Dashboard requires it |
| Observability | Medium | Can add custom tracing |
| Community | Medium | Documentation, examples |
| Complexity | Medium | Team learning curve |
| Lock-in risk | Low | Prompts are portable |

### B. Related Documents

- GSD v2.0 Dashboard PRD (`docs/gsd-dashboard-prd.md`)
- GSD v2.0 Dashboard Spec (`docs/gsd-dashboard-spec.md`)
- MCP Server API (Phase 12)

### C. Glossary

| Term | Definition |
|------|------------|
| Agent Graph | Directed graph of agent states and transitions |
| Checkpoint | Pause point requiring human input |
| Prompt Loader | System that parses markdown into agent config |
| Trace | Record of all operations in an agent execution |
| Wave | Group of plans that execute in parallel |

---
*Document created: 2026-03-11*
