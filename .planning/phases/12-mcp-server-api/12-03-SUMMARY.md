---
phase: 12-mcp-server-api
plan: 03
subsystem: api
tags: [mcp, resources, stdio, auto-registration, claude-json]

# Dependency graph
requires: [12-01]
provides:
  - MCP resource providers with four stable URIs
  - Auto-registration of MCP server during GSD install
  - Complete MCP server with tools and resources
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: [resource-handler, console-capture, config-merge]

key-files:
  created:
    - get-shit-done/bin/lib/mcp/resources.cjs
  modified:
    - get-shit-done/bin/gsd-mcp-server.cjs
    - bin/install.js

key-decisions:
  - "Resources parse STATE.md and ROADMAP.md directly for reliability"
  - "Console.log capture pattern for functions using output() helper"
  - "MCP registration only for Claude Code global installs"
  - "Registration failure does not block GSD installation"

patterns-established:
  - "Resource handlers return { contents: [{ uri, mimeType, text }] }"
  - "Error handling with GsdError.toEnvelope() for resources"
  - "~/.claude.json mcpServers entry for MCP registration"

requirements-completed: [MCP-03, MCP-04]

# Metrics
duration: 4min 9s
completed: 2026-03-10
---

# Phase 12 Plan 03: MCP Resources and Auto-Registration Summary

**MCP resource providers exposing parsed GSD state via stable URIs, with automatic MCP server registration during installation**

## Performance

- **Duration:** 4 min 9 s
- **Started:** 2026-03-10T07:52:51Z
- **Completed:** 2026-03-10T07:57:00Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- Created resources.cjs with four resource handlers
- Integrated resources into gsd-mcp-server.cjs
- Added MCP auto-registration to installer
- Server now logs both tool count (9) and resource count (4)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create resources module** - `714a192` (feat)
2. **Task 2: Integrate resources into MCP server** - `291efb7` (feat)
3. **Task 3: Add MCP auto-registration to installer** - `44541b5` (feat)

## Files Created/Modified

- `get-shit-done/bin/lib/mcp/resources.cjs` - Four resource handlers with stable URIs
- `get-shit-done/bin/gsd-mcp-server.cjs` - Updated to register resources alongside tools
- `bin/install.js` - Added registerMcpServer() for Claude Code MCP registration

## Resource URIs

| URI | Description | Handler |
|-----|-------------|---------|
| gsd://state | Parsed STATE.md with progress, decisions, blockers | handleStateResource |
| gsd://roadmap | Parsed ROADMAP.md with phases and progress | handleRoadmapResource |
| gsd://phase/current | Current active phase context | handleCurrentPhaseResource |
| gsd://health | Worktree health and sync status | handleHealthResource |

## Decisions Made

- Resources parse markdown files directly rather than capturing console output for reliability
- MCP registration uses ~/.claude.json mcpServers section per Claude Code MCP docs
- Only Claude Code global installs get MCP registration (other runtimes don't support MCP)
- Registration errors are warnings, not fatal - installation continues

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - MCP server is automatically registered during GSD installation.

## Next Phase Readiness

- Phase 12 (MCP Server API) is now complete
- MCP server exposes 9 tools and 4 resources
- Server auto-registers in ~/.claude.json on install
- Ready for production use with Claude Code

## Self-Check: PASSED

- [x] resources.cjs created
- [x] Commit 714a192 exists (Task 1)
- [x] Commit 291efb7 exists (Task 2)
- [x] Commit 44541b5 exists (Task 3)

---
*Phase: 12-mcp-server-api*
*Completed: 2026-03-10*
