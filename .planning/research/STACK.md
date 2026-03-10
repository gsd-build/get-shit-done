# Stack Research: GSD Web Dashboard

**Domain:** Real-time AI agent orchestration dashboard
**Researched:** 2026-03-10
**Confidence:** HIGH
**Supersedes:** Previous STACK.md (Upstream Sync Tooling, 2026-02-23)

## Executive Summary

The GSD Web Dashboard requires a stack that enables real-time streaming of AI agent output, WebSocket communication, and rich UI visualization. The stack choices below prioritize:

1. **Integration with existing MCP server** (Phase 12) - direct module imports, not HTTP
2. **Streaming-first architecture** - SSE/WebSocket for agent output
3. **Minimal runtime overhead** - aligns with GSD's zero-dep philosophy for CLI
4. **Developer experience** - TypeScript throughout, modern tooling

**Key corrections to the PRD/Spec:**
- Socket.io v5 does not exist - use v4.8.x
- React 18 is outdated - Next.js 15 requires React 19
- Tailwind CSS v3 is outdated - v4 is 5x faster
- Start without BullMQ/Redis - add later if needed

## Recommended Stack

### Core Frontend

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Next.js | 15.5.x | React framework | Turbopack stable, App Router mature, excellent streaming support, shadcn/ui default |
| React | 19.2.x | UI library | Activity component for hidden states, improved DevTools, concurrent features stable |
| TypeScript | 5.5+ | Type safety | Required by all dependencies, improves DX significantly |
| Tailwind CSS | 4.2.x | Styling | CSS-first config, 5x faster builds, native container queries, OKLCH colors |

**Note:** The spec suggests React 18, but React 19 is stable since Dec 2024 and required by Next.js 15+.

### UI Components

| Library | Version | Purpose | Why Recommended |
|---------|---------|---------|-----------------|
| shadcn/ui | CLI v4 | Component library | React 19 + Tailwind 4 support, AI agent skills built-in, preset system |
| @xyflow/react | 12.10.x | Dependency graphs | Active development (v12), better than reactflow legacy, node-based UI |
| @monaco-editor/react | 4.7.0 | Code editor | VS Code parity, React 19 support in rc, file diff viewing |

**Note:** Use `@xyflow/react` (not `reactflow`) - it's the current actively developed package.

### State Management

| Library | Version | Purpose | Why Recommended |
|---------|---------|---------|-----------------|
| Zustand | 5.0.11 | Client state | React 18-19 concurrency support, minimal API, persist middleware |

**Why Zustand over alternatives:**
- Redux Toolkit: Overkill for single-user dashboard
- Jotai/Recoil: Atomic state not needed here
- React Context: Insufficient for WebSocket + streaming state

### Real-Time Communication

| Library | Version | Purpose | Why Recommended |
|---------|---------|---------|-----------------|
| Socket.io | 4.8.3 | WebSocket abstraction | Auto-reconnect, room support, fallback to long-polling |
| socket.io-client | 4.8.3 | Client-side | Typed events, React hooks compatible |

**Important:** Socket.io v5 does not exist yet. The spec's reference to v5 is incorrect - use v4.8.x.

### Backend Core

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Node.js | 22+ LTS | Runtime | Required for ES modules, native fetch, modern APIs |
| Hono | 4.x | HTTP framework | 3x faster than Express, TypeScript-first, edge-ready |

**Why Hono over Express/Fastify:**
- Express: Too slow for streaming, no native TypeScript
- Fastify: Good but Node-only, Hono is edge-ready for future
- Hono: Fastest cold starts, tiny bundle, modern async handlers

### AI Integration

| Library | Version | Purpose | Why Recommended |
|---------|---------|---------|-----------------|
| @anthropic-ai/sdk | 0.78.x | Claude API | Official SDK, streaming via SSE, tool use support |
| ai (Vercel AI SDK) | 6.x | Streaming helpers | useChat hooks, structured outputs, agent abstraction |

**Critical decision:** Use Vercel AI SDK 6 for streaming UI helpers, but call Anthropic SDK directly for tool execution. AI SDK 6's Agent abstraction simplifies the orchestration loop.

### Job Queue (Optional - Start Without)

| Library | Version | Purpose | When to Add |
|---------|---------|---------|-------------|
| BullMQ | 5.70.x | Background jobs | Phase 2+ if execution timeouts become an issue |
| Redis | 7.x | BullMQ backing | Only if BullMQ adopted |

**Recommendation:** Start without BullMQ. Use direct async execution with AbortController for cancellation. Add queue later if needed for:
- Execution timeout handling
- Multiple concurrent project execution
- Rate limiting Claude API calls

### Database

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| better-sqlite3 | 12.6.x | Dev/single-user | Zero-config, fastest SQLite for Node, synchronous API |
| Drizzle ORM | 0.41.x | Type-safe queries | Best TypeScript DX, works with SQLite and PostgreSQL |

**Why SQLite over PostgreSQL:**
- Single-user dashboard (per PRD)
- No Docker/external service needed for dev
- Can migrate to PostgreSQL later via Drizzle's dialect support

### Monorepo & Build

| Tool | Version | Purpose | Why Recommended |
|------|---------|---------|-----------------|
| pnpm | 10.32.x | Package manager | 87% disk savings, fastest installs, workspace support |
| Turborepo | 2.8.x | Build orchestration | Rust-based, parallel tasks, remote caching |

### Testing

| Tool | Version | Purpose | Coverage |
|------|---------|---------|----------|
| Vitest | 4.0.x | Unit/integration | 80% target, Vite-native, Jest compatible |
| @testing-library/react | 16.x | Component testing | RTL standard |
| Playwright | 1.59.x | E2E testing | Cross-browser, auto-waiting |

### Validation

| Library | Version | Purpose | Why Recommended |
|---------|---------|---------|-----------------|
| Zod | 4.3.x | Schema validation | 6.5x faster than v3, TypeScript inference |

**Note:** Zod v4 is significantly faster. Use `zod/v4` imports.

## Installation

```bash
# Create monorepo
pnpm create turbo@latest gsd-dashboard --example with-shadcn-ui

# Core dependencies (packages/web)
pnpm add react@19 react-dom@19 next@15 zustand@5
pnpm add @xyflow/react @monaco-editor/react socket.io-client
pnpm add tailwindcss@4 -D

# UI components
pnpm dlx shadcn@latest init --preset minimal

# Backend dependencies (packages/server)
pnpm add hono @hono/node-server socket.io
pnpm add @anthropic-ai/sdk ai
pnpm add better-sqlite3 drizzle-orm
pnpm add zod

# Dev dependencies
pnpm add -D typescript @types/node @types/better-sqlite3
pnpm add -D vitest @testing-library/react @playwright/test
pnpm add -D drizzle-kit
```

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Socket.io v5 | Does not exist | Socket.io 4.8.x |
| reactflow | Legacy, maintenance mode | @xyflow/react (v12) |
| Express | Slow, no native TypeScript | Hono |
| React 18 | Next.js 15 requires React 19 | React 19.2.x |
| Tailwind CSS v3 | v4 is 5x faster, better DX | Tailwind CSS 4.2.x |
| Zod v3 | 6.5x slower than v4 | Zod 4.3.x |
| BullMQ (initially) | Premature complexity | Direct async + AbortController |
| PostgreSQL (initially) | Requires Docker setup | better-sqlite3, migrate later |

## Integration with Existing GSD

### MCP Server Integration (Phase 12)

The dashboard server should import GSD lib modules directly, NOT via HTTP:

```typescript
// packages/server/src/gsd/wrapper.ts
import { cmdStateSnapshot } from '../../get-shit-done/bin/lib/state.cjs';
import { cmdHealth } from '../../get-shit-done/bin/lib/health.cjs';
import { cmdPhasePlanIndex } from '../../get-shit-done/bin/lib/phase.cjs';
```

**Why direct imports:**
- MCP Server uses stdio transport (not HTTP)
- Dashboard runs on same machine as GSD
- Avoids serialization overhead
- Type safety via JSDoc or .d.ts files

### gsd-tools.cjs Commands Available

The dashboard can call any gsd-tools.cjs command via child_process, but prefer direct lib imports for:
- `state load/json/get/update` - via state.cjs
- `health validate` - via health.cjs
- `roadmap analyze` - via roadmap.cjs
- `phase-plan-index` - via phase.cjs

### Shared Types

Create a shared types package:

```typescript
// packages/shared/src/types.ts
export interface GsdProject {
  path: string;
  name: string;
  milestone: string;
  currentPhase: number;
  progress: number;
  health: 'healthy' | 'degraded' | 'error';
}

export interface PhaseState {
  phase: number;
  name: string;
  status: 'pending' | 'in-progress' | 'complete';
  plans: PlanState[];
}
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Hono | Fastify | If you need maximum Node.js optimization (no edge) |
| Next.js | Vite + React Router | If you want SPA without SSR |
| Zustand | Jotai | If you need atomic state for complex forms |
| better-sqlite3 | PostgreSQL | Multi-user deployment, need concurrent writes |
| Socket.io | native WebSocket | If you don't need auto-reconnect/rooms |
| Turborepo | Nx | If you need more build analysis tools |

## Version Compatibility Matrix

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| Next.js 15.5.x | React 19.2.x | Required pairing |
| shadcn/ui CLI v4 | Tailwind CSS 4.x | Uses unified radix-ui package |
| @xyflow/react 12.x | React 18-19 | Both supported |
| Vitest 4.x | Vite 6.x | Auto-detected |
| better-sqlite3 12.x | Node 22+ | Prebuilt binaries available |

## Stack Variants

**Minimal MVP (recommended start):**
- Next.js + shadcn/ui + Zustand
- Hono + Socket.io
- better-sqlite3 + Drizzle
- Direct GSD lib imports
- No BullMQ, no Redis

**Full Production:**
- Add BullMQ + Redis for job queue
- Add PostgreSQL via Drizzle migration
- Add auth layer (NextAuth or Clerk)
- Add monitoring (Sentry)

## Sources

- [Next.js 15 Release](https://nextjs.org/blog/next-15) - HIGH confidence
- [React 19 Blog](https://react.dev/blog/2024/12/05/react-19) - HIGH confidence
- [shadcn/ui Changelog](https://ui.shadcn.com/docs/changelog) - HIGH confidence
- [Tailwind CSS v4](https://tailwindcss.com/blog/tailwindcss-v4) - HIGH confidence
- [Socket.io npm](https://www.npmjs.com/package/socket.io) - HIGH confidence (v4.8.3, not v5)
- [@anthropic-ai/sdk npm](https://www.npmjs.com/package/@anthropic-ai/sdk) - HIGH confidence
- [Vercel AI SDK 6](https://vercel.com/blog/ai-sdk-6) - HIGH confidence
- [@xyflow/react npm](https://www.npmjs.com/package/@xyflow/react) - HIGH confidence
- [Zustand npm](https://www.npmjs.com/package/zustand) - HIGH confidence
- [BullMQ npm](https://www.npmjs.com/package/bullmq) - HIGH confidence
- [better-sqlite3 npm](https://www.npmjs.com/package/better-sqlite3) - HIGH confidence
- [Hono vs Fastify vs Express](https://betterstack.com/community/guides/scaling-nodejs/fastify-vs-express-vs-hono/) - MEDIUM confidence
- [pnpm npm](https://www.npmjs.com/package/pnpm) - HIGH confidence
- [Turborepo npm](https://www.npmjs.com/package/turbo) - HIGH confidence
- [Vitest npm](https://www.npmjs.com/package/vitest) - HIGH confidence
- [Playwright npm](https://www.npmjs.com/package/@playwright/test) - HIGH confidence
- [Zod npm](https://www.npmjs.com/package/zod) - HIGH confidence

---
*Stack research for: GSD Web Dashboard*
*Researched: 2026-03-10*
