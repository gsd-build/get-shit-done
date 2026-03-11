/**
 * Client connection utilities for Socket.IO with requestAnimationFrame token buffering
 */

import { io, Socket } from 'socket.io-client';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  TokenEvent,
} from './types.js';

export type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export interface SocketClientConfig {
  url: string;
  projectId?: string;
  autoConnect?: boolean;
}

export function createSocketClient(config: SocketClientConfig): TypedSocket {
  const { url, projectId, autoConnect = true } = config;

  const options: Parameters<typeof io>[1] = {
    autoConnect,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  };

  if (projectId) {
    options.query = { projectId };
  }

  const socket: TypedSocket = io(url, options);
  return socket;
}

export type RenderTelemetry = (frameTime: number, tokenCount: number) => void;

export interface TokenBufferState {
  readonly tokens: string[];
  subscribe: (agentId: string) => void;
  unsubscribe: (agentId: string) => void;
  clear: () => void;
}

export function createTokenBuffer(
  socket: TypedSocket,
  onUpdate: (tokens: string[]) => void,
  onTelemetry?: RenderTelemetry,
  maxBufferSize = 1000
): TokenBufferState {
  let buffer: string[] = [];
  let tokens: string[] = [];
  let frameId: number | null = null;
  let currentAgentId: string | null = null;

  function flush(): void {
    if (buffer.length > 0) {
      const frameStart = performance.now();
      const batchSize = buffer.length;

      tokens = [...tokens, ...buffer];
      buffer = [];
      onUpdate(tokens);

      if (onTelemetry) {
        requestAnimationFrame(() => {
          const frameTime = performance.now() - frameStart;
          onTelemetry(frameTime, batchSize);
        });
      }
    }

    if (currentAgentId !== null) {
      frameId = requestAnimationFrame(flush);
    }
  }

  function handleToken(event: TokenEvent): void {
    if (event.agentId !== currentAgentId) return;

    if (buffer.length >= maxBufferSize) {
      buffer.shift();
    }
    buffer.push(event.token);
  }

  function subscribe(agentId: string): void {
    if (currentAgentId !== null) {
      unsubscribe(currentAgentId);
    }

    currentAgentId = agentId;
    socket.emit('agent:subscribe', agentId);
    socket.on('agent:token', handleToken);
    frameId = requestAnimationFrame(flush);
  }

  function unsubscribe(agentId: string): void {
    if (currentAgentId !== agentId) return;

    socket.off('agent:token', handleToken);
    socket.emit('agent:unsubscribe', agentId);

    if (frameId !== null) {
      cancelAnimationFrame(frameId);
      frameId = null;
    }
    currentAgentId = null;
  }

  function clear(): void {
    buffer = [];
    tokens = [];
    onUpdate(tokens);
  }

  return {
    get tokens() { return tokens; },
    subscribe,
    unsubscribe,
    clear,
  };
}

export function useTokenBuffer(
  socket: TypedSocket,
  onUpdate: (tokens: string[]) => void,
  onTelemetry?: RenderTelemetry
): TokenBufferState {
  return createTokenBuffer(socket, onUpdate, onTelemetry);
}
