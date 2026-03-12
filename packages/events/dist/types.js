/**
 * @gsd/events - Shared event types for Socket.IO communication
 *
 * Event naming follows prefix:action pattern per CONTEXT.md:
 * - agent:* - Agent lifecycle events
 * - checkpoint:* - Checkpoint interaction events
 * - connection:* - Health/connection events
 */
// Prefixed event names per CONTEXT.md
export const EVENTS = {
    AGENT_TOKEN: 'agent:token',
    AGENT_START: 'agent:start',
    AGENT_END: 'agent:end',
    AGENT_ERROR: 'agent:error',
    AGENT_PHASE: 'agent:phase',
    TOOL_START: 'agent:tool_start',
    TOOL_END: 'agent:tool_end',
    CHECKPOINT_REQUEST: 'checkpoint:request',
    CHECKPOINT_RESPONSE: 'checkpoint:response',
    CONNECTION_HEALTH: 'connection:health',
};
//# sourceMappingURL=types.js.map