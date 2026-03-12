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
export declare const TokenEventSchema: z.ZodObject<{
    agentId: z.ZodString;
    token: z.ZodString;
    sequence: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    agentId: string;
    token: string;
    sequence: number;
}, {
    agentId: string;
    token: string;
    sequence: number;
}>;
export type TokenEventInput = z.input<typeof TokenEventSchema>;
/**
 * Agent start event schema
 */
export declare const AgentStartEventSchema: z.ZodObject<{
    agentId: z.ZodString;
    planId: z.ZodString;
    taskName: z.ZodString;
}, "strip", z.ZodTypeAny, {
    agentId: string;
    planId: string;
    taskName: string;
}, {
    agentId: string;
    planId: string;
    taskName: string;
}>;
export type AgentStartEventInput = z.input<typeof AgentStartEventSchema>;
/**
 * Agent end event schema
 */
export declare const AgentEndEventSchema: z.ZodObject<{
    agentId: z.ZodString;
    status: z.ZodEnum<["success", "error", "checkpoint"]>;
    summary: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    agentId: string;
    status: "success" | "error" | "checkpoint";
    summary?: string | undefined;
}, {
    agentId: string;
    status: "success" | "error" | "checkpoint";
    summary?: string | undefined;
}>;
export type AgentEndEventInput = z.input<typeof AgentEndEventSchema>;
/**
 * Agent error event schema
 */
export declare const AgentErrorEventSchema: z.ZodObject<{
    agentId: z.ZodString;
    code: z.ZodString;
    message: z.ZodString;
    recovery: z.ZodOptional<z.ZodString>;
    stack: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    agentId: string;
    code: string;
    message: string;
    recovery?: string | undefined;
    stack?: string | undefined;
}, {
    agentId: string;
    code: string;
    message: string;
    recovery?: string | undefined;
    stack?: string | undefined;
}>;
export type AgentErrorEventInput = z.input<typeof AgentErrorEventSchema>;
/**
 * Checkpoint option schema
 */
export declare const CheckpointOptionSchema: z.ZodObject<{
    id: z.ZodString;
    label: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    label: string;
}, {
    id: string;
    label: string;
}>;
/**
 * Checkpoint request event schema
 */
export declare const CheckpointRequestEventSchema: z.ZodObject<{
    checkpointId: z.ZodString;
    type: z.ZodEnum<["human-verify", "decision", "human-action"]>;
    prompt: z.ZodString;
    options: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        label: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        label: string;
    }, {
        id: string;
        label: string;
    }>, "many">>;
    timeoutMs: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    type: "human-verify" | "decision" | "human-action";
    checkpointId: string;
    prompt: string;
    options?: {
        id: string;
        label: string;
    }[] | undefined;
    timeoutMs?: number | undefined;
}, {
    type: "human-verify" | "decision" | "human-action";
    checkpointId: string;
    prompt: string;
    options?: {
        id: string;
        label: string;
    }[] | undefined;
    timeoutMs?: number | undefined;
}>;
export type CheckpointRequestEventInput = z.input<typeof CheckpointRequestEventSchema>;
/**
 * Checkpoint response event schema
 */
export declare const CheckpointResponseEventSchema: z.ZodObject<{
    checkpointId: z.ZodString;
    response: z.ZodString;
}, "strip", z.ZodTypeAny, {
    checkpointId: string;
    response: string;
}, {
    checkpointId: string;
    response: string;
}>;
export type CheckpointResponseEventInput = z.input<typeof CheckpointResponseEventSchema>;
/**
 * Health metrics event schema - server-side metrics
 */
export declare const HealthMetricsEventSchema: z.ZodObject<{
    connectedClients: z.ZodNumber;
    roomCounts: z.ZodRecord<z.ZodString, z.ZodNumber>;
    uptime: z.ZodNumber;
    memoryUsage: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    connectedClients: number;
    roomCounts: Record<string, number>;
    uptime: number;
    memoryUsage: number;
}, {
    connectedClients: number;
    roomCounts: Record<string, number>;
    uptime: number;
    memoryUsage: number;
}>;
export type HealthMetricsEventInput = z.input<typeof HealthMetricsEventSchema>;
/**
 * Connection health event schema - client-side latency
 */
export declare const ConnectionHealthEventSchema: z.ZodObject<{
    timestamp: z.ZodString;
    latencyMs: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    timestamp: string;
    latencyMs: number;
}, {
    timestamp: string;
    latencyMs: number;
}>;
export type ConnectionHealthEventInput = z.input<typeof ConnectionHealthEventSchema>;
/**
 * Tool start event schema
 */
export declare const ToolStartEventSchema: z.ZodObject<{
    agentId: z.ZodString;
    toolId: z.ZodString;
    toolName: z.ZodString;
    input: z.ZodUnknown;
    sequence: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    agentId: string;
    sequence: number;
    toolId: string;
    toolName: string;
    input?: unknown;
}, {
    agentId: string;
    sequence: number;
    toolId: string;
    toolName: string;
    input?: unknown;
}>;
export type ToolStartEventInput = z.input<typeof ToolStartEventSchema>;
/**
 * Tool end event schema
 */
export declare const ToolEndEventSchema: z.ZodObject<{
    agentId: z.ZodString;
    toolId: z.ZodString;
    success: z.ZodBoolean;
    output: z.ZodString;
    duration: z.ZodNumber;
    sequence: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    success: boolean;
    agentId: string;
    sequence: number;
    toolId: string;
    output: string;
    duration: number;
}, {
    success: boolean;
    agentId: string;
    sequence: number;
    toolId: string;
    output: string;
    duration: number;
}>;
export type ToolEndEventInput = z.input<typeof ToolEndEventSchema>;
/**
 * Agent phase event schema
 */
export declare const AgentPhaseEventSchema: z.ZodObject<{
    agentId: z.ZodString;
    phase: z.ZodEnum<["streaming", "tool_executing", "awaiting_checkpoint"]>;
    sequence: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    agentId: string;
    sequence: number;
    phase: "streaming" | "tool_executing" | "awaiting_checkpoint";
}, {
    agentId: string;
    sequence: number;
    phase: "streaming" | "tool_executing" | "awaiting_checkpoint";
}>;
export type AgentPhaseEventInput = z.input<typeof AgentPhaseEventSchema>;
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
export declare function validateEvent<T extends z.ZodTypeAny>(schema: T, data: unknown): z.SafeParseReturnType<z.input<T>, z.output<T>>;
//# sourceMappingURL=schemas.d.ts.map