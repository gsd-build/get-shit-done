---
phase: 12-mcp-server-api
plan: 02
subsystem: mcp-tools
tags: [mcp, tools, core-tier, extended-tier, envelope-pattern]
requires: [12-01]
provides:
  - Core MCP tools exposing GSD read/inspection operations
  - Extended MCP tools exposing long-running/mutating operations
  - MCP tool integration in server entrypoint
affects: [12-03]

tech-stack:
  added: []
  patterns:
    - "Tiered tool registration (core + extended)"
    - "Command-wrapper error translation via envelopes"
    - "Project existence preflight checks"

key-files:
  created:
    - get-shit-done/bin/lib/mcp/tools.cjs
  modified:
    - get-shit-done/bin/gsd-mcp-server.cjs
    - .planning/ROADMAP.md
    - .planning/STATE.md

decisions:
  - "Keep MCP parameter shapes aligned with CLI arguments"
  - "Wrap all tool responses in consistent envelope format"
  - "Return explicit long-running guidance for plan/execute operations"

requirements-completed: [MCP-01, MCP-02, MCP-05]

duration: 6min
completed: 2026-03-10
---

# Phase 12 Plan 02: MCP Tool Registration Summary

**Implemented core and extended MCP tool registrations and wired them into the MCP server entrypoint.**

## Accomplishments

1. Created `tools.cjs` with core tool registration:
- `progress`
- `health`
- `state_get`
- `phase_info`
- `roadmap_get`

2. Added extended tool registration:
- `plan_phase`
- `execute_phase`
- `state_update`
- `phase_complete`

3. Added shared helper behavior:
- project preflight (`ensureProject`)
- next-action suggestions (`suggestNextActions`)
- consistent MCP text payload shaping (`formatResponse`)

4. Integrated tool registration in `gsd-mcp-server.cjs` so server starts with tool catalog loaded.

## Task Commits

1. `c6d9d62` - feat(12-02): create MCP tools module with core tier
2. `5cdf33e` - feat(12-02): integrate tools into MCP server entry point

## Verification

- Tool module exports expected registrars/constants
- Server startup includes both core and extended registrations
- Errors from wrapped commands return structured envelopes

## Next Phase Readiness

Plan 12-03 can add resource providers and installer auto-registration on top of the tool-enabled server.

## Self-Check: PASSED

All planned artifacts for 12-02 are present and reflected in commit history.
