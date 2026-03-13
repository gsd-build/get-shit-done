/**
 * MCP Server Module
 *
 * Creates and configures the MCP server with stdio transport.
 * Tools and resources are registered by the caller after server creation.
 */

'use strict';

const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');

// Get version from package.json
const pkg = require('../../../../package.json');

/**
 * Create a new MCP server instance.
 * @returns {McpServer} The server instance (tools/resources registered by caller)
 */
function createServer() {
  const server = new McpServer({
    name: 'gsd-mcp-server',
    version: pkg.version,
  });

  return server;
}

/**
 * Connect the server to stdio transport.
 * @param {McpServer} server - The MCP server instance
 * @returns {Promise<StdioServerTransport>} The transport for cleanup
 */
async function connectTransport(server) {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  return transport;
}

module.exports = {
  createServer,
  connectTransport,
};
