---
name: gsd:plan-sprint
description: AI-assisted sprint planning — suggest composition or validate existing sprint
argument-hint: "--project PROJ [--sprint 'Sprint Name'] [--validate] [--capacity N]"
allowed-tools:
  - Read
  - Bash
  - AskUserQuestion
  - mcp__mcp_atlassian__jira_get_issue
  - mcp__mcp_atlassian__jira_search
  - mcp__mcp_atlassian__jira_search_fields
  - mcp__mcp_atlassian__jira_get_agile_boards
  - mcp__mcp_atlassian__jira_get_sprints_from_board
  - mcp__mcp_atlassian__jira_get_sprint_issues
  - mcp__mcp_atlassian__jira_update_sprint
  - mcp__mcp_atlassian__jira_update_issue
  - mcp__mcp_atlassian__jira_transition_issue
  - mcp__mcp_atlassian__jira_add_comment
---
<objective>
AI-assisted sprint planning for Jira projects.

**Standalone:** Does NOT require a GSD project (`.planning/` directory).
**Requires:** `mcp-atlassian` MCP server configured with Jira access.

**Modes:**
- **Suggest** (default) — Analyze backlog, propose sprint composition based on priority/dependencies/capacity
- **Validate** (`--validate`) — Check an existing sprint for issues (dependency conflicts, missing estimates, scope vs capacity)

**Management-facing:** Designed for PMs/POs to compose and validate sprints. Developers pull sprint tickets via `/gsd:from-jira`.

**Writes to Jira:** Can update sprint goals, move tickets between sprints, update priorities (all with user confirmation).
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/plan-sprint.md
@~/.claude/get-shit-done/references/ui-brand.md
</execution_context>

<context>
$ARGUMENTS

Accepts:
- `--project PROJ` — required, Jira project key
- `--sprint "Sprint Name"` — target a specific sprint (default: next future sprint)
- `--validate` — validate existing sprint instead of suggesting new composition
- `--capacity N` — team capacity in story points for scope validation
</context>

<process>
Execute the plan-sprint workflow from @~/.claude/get-shit-done/workflows/plan-sprint.md end-to-end.
Preserve all workflow gates (MCP check, user confirmation before writes, iteration loops).
</process>
