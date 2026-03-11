/**
 * @gsd/events - Shared event types and Zod schemas for Socket.IO communication
 *
 * This package provides:
 * - TypeScript interfaces for Socket.IO typed events
 * - Zod schemas for runtime validation
 * - Event name constants with prefix:action pattern
 *
 * @example
 * // Server usage
 * import { EVENTS, ServerToClientEvents, ClientToServerEvents } from '@gsd/events';
 * const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer);
 *
 * // Client usage
 * import { EVENTS, TokenEventSchema } from '@gsd/events';
 * socket.on(EVENTS.AGENT_TOKEN, (data) => {
 *   const result = TokenEventSchema.safeParse(data);
 *   if (result.success) {
 *     console.log(result.data.token);
 *   }
 * });
 */

// Export all types
export {
  EVENTS,
  type EventName,
  type TokenEvent,
  type AgentStartEvent,
  type AgentEndEvent,
  type AgentErrorEvent,
  type CheckpointRequestEvent,
  type CheckpointOption,
  type CheckpointResponseEvent,
  type ConnectionHealthEvent,
  type ServerToClientEvents,
  type ClientToServerEvents,
  type InterServerEvents,
  type SocketData,
} from './types.js';

// Export all schemas
export {
  TokenEventSchema,
  type TokenEventInput,
  AgentStartEventSchema,
  type AgentStartEventInput,
  AgentEndEventSchema,
  type AgentEndEventInput,
  AgentErrorEventSchema,
  type AgentErrorEventInput,
  CheckpointOptionSchema,
  CheckpointRequestEventSchema,
  type CheckpointRequestEventInput,
  CheckpointResponseEventSchema,
  type CheckpointResponseEventInput,
  ConnectionHealthEventSchema,
  type ConnectionHealthEventInput,
  validateEvent,
} from './schemas.js';
