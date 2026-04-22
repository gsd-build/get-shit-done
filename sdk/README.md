# @gsd-build/sdk

TypeScript SDK for **Get Shit Done**: deterministic query/mutation handlers, plan execution, and event-stream telemetry so agents focus on judgment, not shell plumbing.

## Install

```bash
npm install @gsd-build/sdk
```

## Quickstart — programmatic

```typescript
import { GSD, createRegistry } from '@gsd-build/sdk';

const gsd = new GSD({ projectDir: process.cwd(), sessionId: 'my-run' });
const tools = gsd.createTools();

const registry = createRegistry(gsd.eventStream, 'my-run');
const { data } = await registry.dispatch('state.json', [], process.cwd());
```

## Quickstart — CLI

From a project that depends on this package, **invoke the CLI with Node** (recommended in CI and local dev):

```bash
node ./node_modules/@gsd-build/sdk/dist/cli.js query state.json
node ./node_modules/@gsd-build/sdk/dist/cli.js query roadmap.analyze
```

If no native handler is registered for a command, the CLI can transparently shell out to `get-shit-done/bin/gsd-tools.cjs` (see stderr warning), unless `GSD_QUERY_FALLBACK=off`.

## What ships

| Area | Entry |
|------|--------|
| Query registry | `createRegistry()` in `src/query/index.ts` — same handlers as `gsd-sdk query` |
| Tools bridge | `GSDTools` — native dispatch with optional CJS subprocess fallback |
| Orchestrators | `PhaseRunner`, `InitRunner`, `GSD` |
| CLI | `gsd-sdk` — `query`, `run`, `init`, `auto` |

## Guides

- **Handler registry & contracts:** [`src/query/QUERY-HANDLERS.md`](src/query/QUERY-HANDLERS.md)
- **Repository docs** (when present): `docs/ARCHITECTURE.md`, `docs/CLI-TOOLS.md` at repo root

## Environment

| Variable | Purpose |
|----------|---------|
| `GSD_QUERY_FALLBACK` | `off` / `never` disables CLI fallback to `gsd-tools.cjs` for unknown commands |
| `GSD_AGENTS_DIR` | Override directory scanned for installed GSD agents (`~/.claude/agents` by default) |
