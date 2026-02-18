/**
 * Session state module for MCP tools
 * Provides shared access to current session ID set by the server entry point
 */
/**
 * Set the current session ID
 * Called by the MCP server entry point after creating a session
 */
export declare function setCurrentSessionId(id: string): void;
/**
 * Get the current session ID
 * @throws Error if session ID is not set (server not initialized)
 */
export declare function getCurrentSessionId(): string;
