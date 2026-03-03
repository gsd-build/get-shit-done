---
name: gsd:from-jira
description: Import Jira tickets as GSD phases with auto-generated context
argument-hint: "<PROJ-123|epic-key> [more-keys...] [--jql '<query>']"
allowed-tools:
  - Read
  - Write
  - Bash
  - Task
  - Glob
  - Grep
  - AskUserQuestion
  - mcp__mcp_atlassian__jira_get_issue
  - mcp__mcp_atlassian__jira_search
---
<objective>
Import one or more Jira tickets into the current GSD project as new phases.

**Requires:** Existing `.planning/` directory (run `/gsd:new-project` first).
**Requires:** `mcp-atlassian` MCP server configured with Jira access.

**Modes:**
- **Single ticket** (PROJ-123) — one new phase with CONTEXT.md from acceptance criteria
- **Multiple tickets** (PROJ-123 PROJ-456) — multiple phases, each with auto-generated context
- **Epic** — fetches child issues, each child becomes a phase
- **JQL query** (`--jql 'sprint = "Sprint 5"'`) — query results become phases

**Read-only:** Does not write back to Jira.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/from-jira.md
@~/.claude/get-shit-done/references/ui-brand.md
</execution_context>

<context>
$ARGUMENTS

Accepts: Jira ticket keys (PROJ-123), epic keys, or `--jql '<JQL query>'`.
Multiple keys separated by spaces.
</context>

<process>
Execute the from-jira workflow from @~/.claude/get-shit-done/workflows/from-jira.md end-to-end.
Preserve all workflow gates (validation, MCP check, user confirmation, commits, routing).
</process>
