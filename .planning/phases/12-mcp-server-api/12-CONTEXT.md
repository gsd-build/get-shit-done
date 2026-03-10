# Phase 12: MCP Server API - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Expose GSD operations as an MCP server for programmatic access from AI agents and tools. Enables other Claude instances, automation scripts, and external tools to interact with GSD workflows without CLI.

</domain>

<decisions>
## Implementation Decisions

### Tool Selection
- Tiered access model: core tier always available, extended tier via capability negotiation
- Core tier = read-only operations: progress, health, state reads
- Extended tier = mutations: plan-phase, execute-phase, discuss-phase, settings
- Direct parameter mapping: MCP tool params mirror CLI flags exactly
- Rich descriptions in tool schema with detailed docs, parameter descriptions, and examples

### Response Format
- Envelope pattern for all responses: `{ success: bool, data: {...}, error?: {...} }`
- Actionable errors with recovery suggestions: `{ code: 'PHASE_NOT_FOUND', message: '...', recovery: 'Run /gsd:progress' }`
- Streaming updates for long-running operations (execute-phase, plan-phase)
- Blocking/synchronous for all other operations
- Always include `next_actions` array with suggested follow-up tools

### Integration Mode
- Stdio transport (standard MCP pattern) — run as subprocess, communicate via stdin/stdout
- Auto-register on GSD install — installer adds MCP config to ~/.claude/settings.json
- Inherit project context from Claude Code workspace (uses cwd automatically)
- No authentication required — same trust model as CLI

### Resource Providers
- Expose four resources: STATE.md, ROADMAP.md, current phase context, health status
- Parsed JSON format (not raw markdown) — structured data for easy consumption
- On-demand only (no push updates or subscriptions)
- Fixed URIs: `gsd://state`, `gsd://roadmap`, `gsd://phase/current`, `gsd://health`

### Claude's Discretion
- Exact streaming protocol implementation details
- Internal caching strategy for parsed resources
- Tool schema JSON structure beyond required fields

</decisions>

<specifics>
## Specific Ideas

- Progress reporting should mirror what gsd-tools --raw outputs for consistency
- Resource URIs should be simple and predictable — AI agents need stable addresses
- Error recovery suggestions should reference actual /gsd: commands

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 12-mcp-server-api*
*Context gathered: 2026-03-10*
