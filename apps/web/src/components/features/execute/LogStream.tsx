'use client';

import { useRef, useEffect, useState, useCallback } from 'react';

interface Props {
  logs: string;
  isStreaming: boolean;
}

export function LogStream({ logs, isStreaming }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const lastScrollTopRef = useRef(0);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    // User scrolled up - pause auto-scroll
    if (el.scrollTop < lastScrollTopRef.current) {
      setAutoScroll(false);
    }

    // User scrolled to bottom - resume auto-scroll
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 10;
    if (atBottom) {
      setAutoScroll(true);
    }

    lastScrollTopRef.current = el.scrollTop;
  }, []);

  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  return (
    <div className="relative h-full">
      <div
        ref={containerRef}
        data-testid="log-container"
        onScroll={handleScroll}
        className="h-full overflow-auto bg-zinc-900 text-zinc-100 p-4"
      >
        <pre
          role="log"
          className="whitespace-pre-wrap font-mono text-sm"
        >
          {logs}
        </pre>
      </div>
      {!autoScroll && isStreaming && (
        <button
          onClick={() => setAutoScroll(true)}
          className="absolute bottom-4 right-4 px-3 py-1 bg-primary text-primary-foreground text-sm rounded-full shadow-lg"
        >
          Resume auto-scroll
        </button>
      )}
    </div>
  );
}
