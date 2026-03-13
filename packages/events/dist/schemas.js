/**
 * @gsd/events - Zod runtime validation schemas
 *
 * These schemas validate event payloads at runtime, ensuring type safety
 * even when receiving data from external sources (WebSocket, HTTP).
 */
import { z } from 'zod';
/**
 * Token event schema - validates streaming token data
 */
export const TokenEventSchema = z.object({
    agentId: z.string().min(1),
    token: z.string(),
    sequence: z.number().int().nonnegative(),
});
/**
 * Agent start event schema
 */
export const AgentStartEventSchema = z.object({
    agentId: z.string().min(1),
    planId: z.string().min(1),
    taskName: z.string().min(1),
});
/**
 * Agent end event schema
 */
export const AgentEndEventSchema = z.object({
    agentId: z.string().min(1),
    status: z.enum(['success', 'error', 'checkpoint']),
    summary: z.string().optional(),
});
/**
 * Agent error event schema
 */
export const AgentErrorEventSchema = z.object({
    agentId: z.string().min(1),
    code: z.string().min(1),
    message: z.string().min(1),
    recovery: z.string().optional(),
    stack: z.string().optional(),
});
/**
 * Checkpoint option schema
 */
export const CheckpointOptionSchema = z.object({
    id: z.string().min(1),
    label: z.string().min(1),
});
/**
 * Checkpoint request event schema
 */
export const CheckpointRequestEventSchema = z.object({
    checkpointId: z.string().uuid(),
    type: z.enum(['human-verify', 'decision', 'human-action']),
    prompt: z.string().min(1),
    options: z.array(CheckpointOptionSchema).optional(),
    timeoutMs: z.number().int().positive().optional(),
});
/**
 * Checkpoint response event schema
 */
export const CheckpointResponseEventSchema = z.object({
    checkpointId: z.string().uuid(),
    response: z.string().min(1),
});
/**
 * Health metrics event schema - server-side metrics
 */
export const HealthMetricsEventSchema = z.object({
    connectedClients: z.number().int().nonnegative(),
    roomCounts: z.record(z.string(), z.number().int().nonnegative()),
    uptime: z.number().nonnegative(),
    memoryUsage: z.number().nonnegative(),
});
/**
 * Connection health event schema - client-side latency
 */
export const ConnectionHealthEventSchema = z.object({
    timestamp: z.string().datetime(),
    latencyMs: z.number().nonnegative(),
});
/**
 * Tool start event schema
 */
export const ToolStartEventSchema = z.object({
    agentId: z.string().min(1),
    toolId: z.string().min(1),
    toolName: z.string().min(1),
    input: z.unknown(),
    sequence: z.number().int().nonnegative(),
});
/**
 * Tool end event schema
 */
export const ToolEndEventSchema = z.object({
    agentId: z.string().min(1),
    toolId: z.string().min(1),
    success: z.boolean(),
    output: z.string(),
    duration: z.number().nonnegative(),
    sequence: z.number().int().nonnegative(),
});
/**
 * Agent phase event schema
 */
export const AgentPhaseEventSchema = z.object({
    agentId: z.string().min(1),
    phase: z.enum(['streaming', 'tool_executing', 'awaiting_checkpoint']),
    sequence: z.number().int().nonnegative(),
});
/**
 * Validate and parse an event payload, returning a typed result
 *
 * @example
 * const result = validateEvent(TokenEventSchema, data);
 * if (result.success) {
 *   console.log(result.data.token);
 * } else {
 *   console.error(result.error);
 * }
 */
export function validateEvent(schema, data) {
    return schema.safeParse(data);
}
//# sourceMappingURL=schemas.js.map