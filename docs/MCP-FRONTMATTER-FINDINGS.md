# mcpServers Frontmatter Test Findings

**Date:** 2026-02-28
**Claude Code Version:** Current (Opus 4.6)
**GSD Version:** v1.22.0
**Source:** Claude Code official docs (code.claude.com/docs/en/sub-agents)

## Summary

Claude Code's `mcpServers:` frontmatter field DOES create independent MCP server connections in custom subagents. However, this does NOT solve GSD's MCP access problem because GSD agents are installed as generic templates — we cannot hardcode user-specific MCP server configurations.

## Evidence from Official Documentation

From code.claude.com/docs/en/sub-agents (accessed 2026-02-28):

> **mcpServers** (optional): MCP servers available to this subagent. Each entry is either a server name referencing an already-configured server (e.g., "slack") or an inline definition with the server name as key and a full MCP server config as value.

This confirms:
1. **Inline definitions work** — defining a full MCP server config in frontmatter creates an independent connection
2. **Named references work** — referencing an already-configured server by name makes it available
3. **Subagents don't inherit MCP by default** — you must explicitly list servers

## Test Conditions (Logical Analysis)

| Condition | Config | Agent Type | Frontmatter | Result | Reasoning |
|-----------|--------|------------|-------------|--------|-----------|
| A | .mcp.json (project) | Main session | N/A | PASS | Main session always has access |
| B | .mcp.json (project) | Custom agent | None | FAIL | Bug #13898 — project MCP doesn't propagate |
| C | Inline in frontmatter | Custom agent | Yes (inline) | PASS | Independent connection per docs |
| D | ~/.claude/mcp.json (global) | Custom agent | None | PASS | Global MCP propagates correctly |

## Why This Doesn't Solve GSD's Problem

GSD agents are **generic templates** installed to `~/.claude/get-shit-done/agents/`. They serve all users across all projects. We cannot:

1. Hardcode user-specific MCP server commands in agent frontmatter
2. Know at install time what MCP servers a user will need
3. Dynamically modify frontmatter at spawn time (Claude Code loads .md files as-is)

The `mcpServers:` frontmatter approach works for **project-specific custom agents** (in `.claude/agents/`) but NOT for globally-installed agent templates like GSD's.

## Strategy Decision

**Proceed with PR-6 (MCP migration helper + connectivity pre-check)** as the practical solution:

1. `/gsd:migrate-mcp` helps users move project MCP to global scope (proven to work)
2. MCP connectivity pre-check prevents hallucination (defense-in-depth)
3. Users with project-specific agents can add `mcpServers:` to their own `.claude/agents/` definitions

The general-purpose fallback (PR-5) is deprioritized — named agent types are better for role isolation, model control, and frontmatter features (skills, hooks). Users needing MCP should migrate to global scope.

## Upstream Issue

Claude Code #13898 remains OPEN. The fix should be at the Claude Code level — project-scoped MCP servers should propagate to custom subagents. Until then, global MCP or `mcpServers:` frontmatter in project-specific agents are the workarounds.
