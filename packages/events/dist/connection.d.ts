/**
 * Client connection utilities for Socket.IO with requestAnimationFrame token buffering
 */
import { Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from './types.js';
export type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
export interface SocketClientConfig {
    url: string;
    projectId?: string;
    autoConnect?: boolean;
}
export declare function createSocketClient(config: SocketClientConfig): TypedSocket;
export type RenderTelemetry = (frameTime: number, tokenCount: number) => void;
export interface TokenBufferState {
    readonly tokens: string[];
    subscribe: (agentId: string) => void;
    unsubscribe: (agentId: string) => void;
    clear: () => void;
}
export declare function createTokenBuffer(socket: TypedSocket, onUpdate: (tokens: string[]) => void, onTelemetry?: RenderTelemetry, maxBufferSize?: number): TokenBufferState;
export declare function useTokenBuffer(socket: TypedSocket, onUpdate: (tokens: string[]) => void, onTelemetry?: RenderTelemetry): TokenBufferState;
//# sourceMappingURL=connection.d.ts.map