#!/usr/bin/env node

/**
 * GSD MCP Server Entry Point
 *
 * Runs the GSD MCP server with stdio transport for integration with
 * Claude Code and other MCP-compatible tools.
 *
 * IMPORTANT: Never log to stdout - it carries JSON-RPC messages.
 * All logs go to stderr via console.error().
 */

'use strict';

const { createServer, connectTransport } = require('./lib/mcp/server.cjs');
const { registerCoreTools, registerExtendedTools, CORE_TOOLS, EXTENDED_TOOLS } = require('./lib/mcp/tools.cjs');

async function main() {
  const server = createServer();

  // Register core tier (always available)
  registerCoreTools(server);

  // Register extended tier
  // Per CONTEXT.md: "extended tier via capability negotiation"
  // For MVP, always register extended tools (same trust model as CLI)
  registerExtendedTools(server);

  // Resources will be registered in plan 12-03

  await connectTransport(server);

  // Log to stderr (stdout is for JSON-RPC)
  const toolCount = CORE_TOOLS.length + EXTENDED_TOOLS.length;
  console.error(`[gsd-mcp] Server started with ${toolCount} tools`);
}

main().catch((err) => {
  console.error('[gsd-mcp] Fatal error:', err.message);
  process.exit(1);
});
