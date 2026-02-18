/**
 * Telegram MCP Daemon entry point.
 *
 * The daemon is the central coordination hub. It:
 *   1. Starts an IPC server on a project-scoped Unix socket
 *   2. Accepts connections from MCP adapter instances (one per Claude Code terminal)
 *   3. Maintains an in-memory registry of active sessions via SessionService
 *   4. Manages the full question lifecycle via QuestionService
 *   5. Routes IPC method calls to the appropriate service handlers
 *
 * Lifecycle:
 *   - Started by the adapter (Plan 05) with child_process.spawn + detached + unref()
 *   - Can also be started directly: node dist/daemon/index.js
 *   - Handles SIGINT / SIGTERM for graceful shutdown
 */
export {};
