/**
 * Session state module for MCP tools
 * Provides shared access to current session ID set by the server entry point
 */

let currentSessionId: string | null = null;

/**
 * Set the current session ID
 * Called by the MCP server entry point after creating a session
 */
export function setCurrentSessionId(id: string): void {
  currentSessionId = id;
}

/**
 * Get the current session ID
 * @throws Error if session ID is not set (server not initialized)
 */
export function getCurrentSessionId(): string {
  if (!currentSessionId) {
    throw new Error('Session not initialized - server startup incomplete');
  }
  return currentSessionId;
}
