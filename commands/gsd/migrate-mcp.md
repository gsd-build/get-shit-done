---
name: gsd:migrate-mcp
description: Migrate project MCP servers to global scope for subagent access
allowed-tools:
  - Read
  - Write
  - AskUserQuestion
---

<objective>
Help users migrate project-scoped MCP servers (`.mcp.json`) to global scope (`~/.claude/mcp.json`) so that GSD subagents can access them.

**Why this is needed:** Claude Code bug #13898 prevents custom subagents from accessing project-scoped MCP servers. Global MCP servers work correctly in all agent types. This command provides the migration path.
</objective>

<process>

## Step 1: Read Project MCP Configuration

Use the **Read tool** to read `.mcp.json` in the project root.

**If `.mcp.json` does not exist or is empty:**
Report to the user:

> No `.mcp.json` found in the current project root.
>
> This command migrates project-scoped MCP servers to global scope so GSD subagents can use them. If your MCP servers are already configured globally (`~/.claude/mcp.json`), no migration is needed.
>
> **To check your global MCP config**, read `~/.claude/mcp.json`.

**Stop here** — nothing to migrate.

**If `.mcp.json` exists and has content:** continue to Step 2.

## Step 2: Parse and Display Server List

Parse the JSON from `.mcp.json`. Extract the `mcpServers` object (the top-level key containing server definitions).

Display to the user:

> **Project MCP Servers Found:**
>
> | Server Name | Command | Status |
> |------------|---------|--------|
> | {name} | {command} {args[0]...} | Project-scoped |
>
> These servers are currently only available in your main Claude Code session. GSD subagents (executor, planner, verifier, etc.) **cannot access them** due to Claude Code bug [#13898](https://github.com/anthropics/claude-code/issues/13898).
>
> **Migrating to global scope** (`~/.claude/mcp.json`) makes them available everywhere, including in subagents.

## Step 3: Read Global MCP Configuration

Use the **Read tool** to read `~/.claude/mcp.json`.

Parse existing global servers (if any). Identify:
- **New servers:** In project config but NOT in global config (will be added)
- **Conflicting servers:** Same name exists in both configs (needs merge decision)
- **Already global:** Same name AND same config in both (skip — already migrated)

Display the merge plan:

> **Migration Plan:**
>
> | Server | Action | Notes |
> |--------|--------|-------|
> | {name} | ADD | Not in global config |
> | {name} | SKIP | Already in global config (identical) |
> | {name} | CONFLICT | Exists in global with different config |
>
> **Trade-off:** Global servers are available in ALL projects, not just this one. If a server is project-specific (e.g., a local dev database), consider whether global scope is appropriate.

**If there are CONFLICT servers:** Ask the user for each one whether to:
1. **Overwrite** the global config with the project version
2. **Keep** the existing global config
3. **Skip** this server

## Step 4: Perform Migration

**ALWAYS use the Write tool** to write `~/.claude/mcp.json` — never use heredoc or `cat <<EOF`.

1. **Back up** the existing global config: copy `~/.claude/mcp.json` to `~/.claude/mcp.json.pre-migrate` (skip if no existing file)
2. Start with the existing global config (or `{"mcpServers": {}}` if none exists)
3. Merge in the servers marked ADD
4. Apply user decisions for CONFLICT servers
5. Write the merged config to `~/.claude/mcp.json`
6. Preserve JSON formatting (2-space indent)

## Step 5: Verify and Report

Use the **Read tool** to read `~/.claude/mcp.json` and verify the merged content.

Display the final result:

> **Migration Complete**
>
> | Server | Status |
> |--------|--------|
> | {name} | Migrated to global scope |
> | {name} | Skipped (already global) |
> | {name} | Skipped (user chose to keep existing) |
>
> **Next steps:**
> 1. Restart Claude Code for the changes to take effect
> 2. GSD subagents will now have access to these MCP servers
> 3. You can keep `.mcp.json` in your project (it won't conflict)
>
> **Note:** If you later add new MCP servers to `.mcp.json`, run `/gsd:migrate-mcp` again to sync them to global scope.

</process>
