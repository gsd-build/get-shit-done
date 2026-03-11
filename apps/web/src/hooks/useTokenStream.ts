'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  createTokenBuffer,
  type TypedSocket,
  type AgentStartEvent,
  type AgentEndEvent,
} from '@gsd/events';

/** Typewriter character delay in ms (~30ms per CONTEXT.md) */
const TYPEWRITER_DELAY_MS = 30;

interface UseTokenStreamOptions {
  /** Socket instance from useSocket */
  socket: TypedSocket | null;
  /** Agent ID to subscribe to */
  agentId: string | null;
  /** Callback when streaming starts */
  onStart?: () => void;
  /** Callback when streaming ends */
  onEnd?: (content: string) => void;
}

interface UseTokenStreamResult {
  /** Currently displayed text with typewriter effect */
  displayedText: string;
  /** Whether actively streaming from agent */
  isStreaming: boolean;
  /** Clear displayed text and reset state */
  clear: () => void;
}

/**
 * React hook for token streaming with typewriter animation.
 *
 * Uses createTokenBuffer from @gsd/events for RAF-batched token receipt,
 * then implements character-by-character typewriter effect at ~30ms delay.
 *
 * @param options - Socket, agentId, and optional callbacks
 * @returns displayedText, isStreaming, and clear function
 */
export function useTokenStream({
  socket,
  agentId,
  onStart,
  onEnd,
}: UseTokenStreamOptions): UseTokenStreamResult {
  const [displayedText, setDisplayedText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);

  // Refs for animation state
  const tokenBufferRef = useRef<ReturnType<typeof createTokenBuffer> | null>(
    null
  );
  const charQueueRef = useRef<string[]>([]);
  const rafIdRef = useRef<number | null>(null);
  const lastCharTimeRef = useRef<number>(0);
  const fullTextRef = useRef<string>('');

  // Drain character queue with typewriter timing
  const drainCharQueue = useCallback(() => {
    const now = performance.now();
    const elapsed = now - lastCharTimeRef.current;

    if (elapsed >= TYPEWRITER_DELAY_MS && charQueueRef.current.length > 0) {
      // Take one character from queue
      const char = charQueueRef.current.shift();
      if (char !== undefined) {
        setDisplayedText((prev) => prev + char);
        lastCharTimeRef.current = now;
      }
    }

    // Continue if there are more characters
    if (charQueueRef.current.length > 0) {
      rafIdRef.current = requestAnimationFrame(drainCharQueue);
    } else {
      rafIdRef.current = null;
    }
  }, []);

  // Start draining if not already
  const startDraining = useCallback(() => {
    if (rafIdRef.current === null && charQueueRef.current.length > 0) {
      rafIdRef.current = requestAnimationFrame(drainCharQueue);
    }
  }, [drainCharQueue]);

  // Handle token buffer updates
  const handleTokens = useCallback(
    (tokens: string[]) => {
      // Compute new full text
      const newFullText = tokens.join('');
      const prevFullText = fullTextRef.current;

      // Find characters to add to queue
      if (newFullText.length > prevFullText.length) {
        const newChars = newFullText.slice(prevFullText.length);
        charQueueRef.current.push(...newChars.split(''));
        fullTextRef.current = newFullText;
        startDraining();
      }
    },
    [startDraining]
  );

  // Clear all state
  const clear = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    charQueueRef.current = [];
    fullTextRef.current = '';
    lastCharTimeRef.current = 0;
    setDisplayedText('');
    setIsStreaming(false);
    tokenBufferRef.current?.clear();
  }, []);

  // Subscribe/unsubscribe based on agentId
  useEffect(() => {
    if (!socket || !agentId) return;

    // Create token buffer
    tokenBufferRef.current = createTokenBuffer(socket, handleTokens);

    // Handle agent:start
    const handleStart = (event: AgentStartEvent) => {
      if (event.agentId !== agentId) return;
      clear();
      setIsStreaming(true);
      tokenBufferRef.current?.subscribe(agentId);
      onStart?.();
    };

    // Handle agent:end
    const handleEnd = (event: AgentEndEvent) => {
      if (event.agentId !== agentId) return;
      tokenBufferRef.current?.unsubscribe(agentId);
      setIsStreaming(false);

      // Immediately display remaining characters
      if (charQueueRef.current.length > 0) {
        const remaining = charQueueRef.current.join('');
        charQueueRef.current = [];
        setDisplayedText((prev) => prev + remaining);
      }

      onEnd?.(fullTextRef.current);
    };

    socket.on('agent:start', handleStart);
    socket.on('agent:end', handleEnd);

    // Subscribe immediately if agentId provided
    tokenBufferRef.current.subscribe(agentId);
    setIsStreaming(true);

    return () => {
      socket.off('agent:start', handleStart);
      socket.off('agent:end', handleEnd);
      tokenBufferRef.current?.unsubscribe(agentId);
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [socket, agentId, handleTokens, clear, onStart, onEnd]);

  return {
    displayedText,
    isStreaming,
    clear,
  };
}
