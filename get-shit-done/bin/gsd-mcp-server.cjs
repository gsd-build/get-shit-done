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
const { registerResources } = require('./lib/mcp/resources.cjs');

async function main() {
  const server = createServer();

  // Register core tier tools (always available)
  registerCoreTools(server);

  // Register extended tier tools
  // Per CONTEXT.md: Same trust model as CLI (no auth)
  registerExtendedTools(server);

  // Register resource providers
  // Per CONTEXT.md: Four resources with fixed URIs
  registerResources(server);

  await connectTransport(server);

  // Log to stderr (stdout is JSON-RPC)
  console.error('[gsd-mcp] Server started');
  console.error('[gsd-mcp] Tools:', CORE_TOOLS.length + EXTENDED_TOOLS.length);
  console.error('[gsd-mcp] Resources: 4 (state, roadmap, phase/current, health)');
}

main().catch((err) => {
  console.error('[gsd-mcp] Fatal error:', err.message);
  process.exit(1);
});
