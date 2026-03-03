---
name: gsd:define-requirements
description: Define or enrich Jira tickets with structured requirements using AI
argument-hint: "[PROJ-123 --enrich] [--project PROJ] [--epic EPIC-KEY]"
allowed-tools:
  - Read
  - Bash
  - AskUserQuestion
  - mcp__mcp_atlassian__jira_get_issue
  - mcp__mcp_atlassian__jira_search
  - mcp__mcp_atlassian__jira_search_fields
  - mcp__mcp_atlassian__jira_create_issue
  - mcp__mcp_atlassian__jira_update_issue
  - mcp__mcp_atlassian__jira_batch_create_issues
  - mcp__mcp_atlassian__jira_add_comment
  - mcp__mcp_atlassian__jira_link_to_epic
  - mcp__mcp_atlassian__jira_create_issue_link
---
<objective>
Define new Jira tickets or enrich existing ones with well-structured requirements.

**Standalone:** Does NOT require a GSD project (`.planning/` directory).
**Requires:** `mcp-atlassian` MCP server configured with Jira write access.

**Modes:**
- **Create** (default) — Describe a feature conversationally, AI drafts structured Jira ticket(s) with acceptance criteria, subtasks, and metadata
- **Enrich** (`PROJ-123 --enrich`) — Analyze an existing ticket, identify gaps, and improve it in place

**Management-facing:** Designed for PMs/POs. Creates tickets that developers pull via `/gsd:from-jira`.

**Writes to Jira:** Creates/updates issues, adds comments, links to epics.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/define-requirements.md
@~/.claude/get-shit-done/references/ui-brand.md
</execution_context>

<context>
$ARGUMENTS

Accepts:
- No args — interactive create mode (will ask for project key)
- `--project PROJ` — create mode targeting specific project
- `--epic EPIC-KEY` — create and link to an epic
- `PROJ-123 --enrich` — enrich an existing ticket
- `PROJ-123 PROJ-456 --enrich` — enrich multiple tickets
</context>

<process>
Execute the define-requirements workflow from @~/.claude/get-shit-done/workflows/define-requirements.md end-to-end.
Preserve all workflow gates (MCP check, user confirmation before writes, iteration loops).
</process>
