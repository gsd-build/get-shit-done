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

async function main() {
  const server = createServer();

  // Tools and resources will be registered in plan 12-02 and 12-03

  await connectTransport(server);

  // Log to stderr (stdout is for JSON-RPC)
  console.error('[gsd-mcp] Server started');
}

main().catch((err) => {
  console.error('[gsd-mcp] Fatal error:', err.message);
  process.exit(1);
});
