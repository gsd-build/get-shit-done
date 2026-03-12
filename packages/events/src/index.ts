/**
 * @gsd/events - Shared event types and Zod schemas for Socket.IO communication
 */

// Export all types
export {
  EVENTS,
  type EventName,
  type TokenEvent,
  type AgentStartEvent,
  type AgentEndEvent,
  type AgentErrorEvent,
  type ToolStartEvent,
  type ToolEndEvent,
  type AgentPhaseEvent,
  type CheckpointRequestEvent,
  type CheckpointOption,
  type CheckpointResponseEvent,
  type HealthMetricsEvent,
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
  HealthMetricsEventSchema,
  type HealthMetricsEventInput,
  ConnectionHealthEventSchema,
  type ConnectionHealthEventInput,
  validateEvent,
} from './schemas.js';

// Export connection utilities
export {
  createSocketClient,
  createTokenBuffer,
  useTokenBuffer,
  type TypedSocket,
  type SocketClientConfig,
  type RenderTelemetry,
  type TokenBufferState,
} from './connection.js';
