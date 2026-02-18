/**
 * Telegram MCP Adapter — thin stdio transport that proxies tool calls to the daemon.
 *
 * This is what Claude Code launches via the MCP stdio protocol. It is intentionally
 * minimal: all business logic lives in the daemon process.
 *
 * Lifecycle:
 *   1. Load dotenv config
 *   2. Compute project-scoped socket path
 *   3. Ensure daemon is running (launch if not)
 *   4. Connect to daemon via IPC
 *   5. Register this session with the daemon
 *   6. Set up MCP server with StdioServerTransport
 *   7. Register all 6 MCP tools (proxied via IPC)
 *   8. On shutdown: unregister session, disconnect IPC, exit
 */
import 'dotenv/config';
