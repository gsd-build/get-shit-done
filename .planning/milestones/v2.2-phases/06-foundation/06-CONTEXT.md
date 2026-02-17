# Phase 6: Foundation - Context

**Gathered:** 2026-02-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the foundational layer for external AI CLI (codex, gemini, opencode) invocation: reliable detection, normalized invocation via adapters, and graceful degradation when CLIs are unavailable or fail. Zero new npm dependencies — uses Node.js `child_process.execSync` only. Configuration and per-checkpoint assignment are separate phases (7, 8).

</domain>

<decisions>
## Implementation Decisions

### Kill Switch & Disable Mechanism
- Disable via `co_planners.enabled` in config.json + `GSD_CO_PLANNERS` env var override (env var takes precedence)
- Scope is global — one switch disables ALL external CLI invocation everywhere
- When disabled, workflow runs normally with silent skip — no messages about skipping co-planner steps

### Detection Strategy
- Detect CLIs using version flag (`cli --version`) — proves installed and callable in one command
- Report availability + version string per CLI (not path or capabilities)
- Output as human-readable table by default, with `--json` flag for structured machine output

### Invocation Contract
- CLI-specific adapters — each CLI gets its own adapter that translates a common internal call to native flags/args
- Code organized in separate `adapters/` directory — one file per CLI (codex.cjs, gemini.cjs, opencode.cjs)
- All adapters return common text schema: `{ text, cli, duration, exitCode }`

### Error Handling & Timeouts
- Global default timeout, configurable in config.json (single value for all CLIs)
- On failure (timeout, error, missing): log clear warning message, then continue workflow — never crash
- Adapters report distinct error types: NOT_FOUND, TIMEOUT, EXIT_ERROR, PERMISSION — enables meaningful user-facing messages

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-foundation*
*Context gathered: 2026-02-16*
