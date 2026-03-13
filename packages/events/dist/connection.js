/**
 * Client connection utilities for Socket.IO with requestAnimationFrame token buffering
 */
import { io } from 'socket.io-client';
export function createSocketClient(config) {
    const { url, projectId, autoConnect = true } = config;
    const options = {
        autoConnect,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
    };
    if (projectId) {
        options.query = { projectId };
    }
    const socket = io(url, options);
    return socket;
}
export function createTokenBuffer(socket, onUpdate, onTelemetry, maxBufferSize = 1000) {
    let buffer = [];
    let tokens = [];
    let frameId = null;
    let currentAgentId = null;
    function flush() {
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
    function handleToken(event) {
        if (event.agentId !== currentAgentId)
            return;
        if (buffer.length >= maxBufferSize) {
            buffer.shift();
        }
        buffer.push(event.token);
    }
    function subscribe(agentId) {
        if (currentAgentId !== null) {
            unsubscribe(currentAgentId);
        }
        currentAgentId = agentId;
        socket.emit('agent:subscribe', agentId);
        socket.on('agent:token', handleToken);
        frameId = requestAnimationFrame(flush);
    }
    function unsubscribe(agentId) {
        if (currentAgentId !== agentId)
            return;
        socket.off('agent:token', handleToken);
        socket.emit('agent:unsubscribe', agentId);
        if (frameId !== null) {
            cancelAnimationFrame(frameId);
            frameId = null;
        }
        currentAgentId = null;
    }
    function clear() {
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
export function useTokenBuffer(socket, onUpdate, onTelemetry) {
    return createTokenBuffer(socket, onUpdate, onTelemetry);
}
//# sourceMappingURL=connection.js.map