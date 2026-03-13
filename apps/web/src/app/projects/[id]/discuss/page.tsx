'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Send } from 'lucide-react';
import { EVENTS } from '@gsd/events';
import { useSocket } from '@/hooks/useSocket';
import { API_PROXY_BASE, resolveSocketBase } from '@/lib/endpoints';

interface DiscussMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

const STORAGE_PREFIX = 'gsd-discuss';

export default function DiscussPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params['id'] as string;
  const socketUrl = useMemo(() => resolveSocketBase(), []);
  const storageKey = `${STORAGE_PREFIX}:${projectId}`;

  const { socket, isConnected } = useSocket(socketUrl);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DiscussMessage[]>([]);
  const [contextPreview, setContextPreview] = useState('');
  const [prompt, setPrompt] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as {
        messages?: DiscussMessage[];
        contextPreview?: string;
      };
      setMessages(parsed.messages ?? []);
      setContextPreview(parsed.contextPreview ?? '');
    } catch {
      // Ignore invalid persisted state
    }
  }, [storageKey]);

  useEffect(() => {
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        messages,
        contextPreview,
      })
    );
  }, [messages, contextPreview, storageKey]);

  useEffect(() => {
    if (!socket || !agentId) return;

    socket.emit('agent:subscribe', agentId);

    const handleToken = (event: { agentId: string; token: string }) => {
      if (event.agentId !== agentId) return;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (!last || last.role !== 'assistant') {
          return [...prev, { id: `assistant-${Date.now()}`, role: 'assistant', text: event.token }];
        }
        return [
          ...prev.slice(0, -1),
          { ...last, text: `${last.text}${event.token}` },
        ];
      });
    };

    const handleAgentEnd = (event: { agentId: string }) => {
      if (event.agentId !== agentId) return;
      setIsStreaming(false);
      setAgentId(null);
      socket.emit('agent:unsubscribe', agentId);
    };

    const handleContextUpdate = (event: { agentId?: string; markdown?: string }) => {
      if (event.agentId && event.agentId !== agentId) return;
      setContextPreview(event.markdown ?? '');
    };

    socket.on(EVENTS.AGENT_TOKEN, handleToken);
    socket.on(EVENTS.AGENT_END, handleAgentEnd);
    (socket as unknown as { on: (event: string, cb: (payload: unknown) => void) => void }).on(
      'context:update',
      handleContextUpdate as (payload: unknown) => void
    );

    return () => {
      socket.off(EVENTS.AGENT_TOKEN, handleToken);
      socket.off(EVENTS.AGENT_END, handleAgentEnd);
      socket.emit('agent:unsubscribe', agentId);
      (
        socket as unknown as { off: (event: string, cb: (payload: unknown) => void) => void }
      ).off('context:update', handleContextUpdate as (payload: unknown) => void);
    };
  }, [socket, agentId]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isStreaming) return;

    const nextPrompt = prompt.trim();
    setPrompt('');
    setError(null);
    setIsStreaming(true);
    setMessages((prev) => [...prev, { id: `user-${Date.now()}`, role: 'user', text: nextPrompt }]);

    try {
      const response = await fetch(`${API_PROXY_BASE}/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentType: 'discuss-phase',
          projectId,
          prompt: nextPrompt,
        }),
      });

      const json = await response.json();
      if (!response.ok || !json?.data?.agentId) {
        throw new Error(json?.error?.message || 'Failed to start discuss session');
      }

      setAgentId(json.data.agentId as string);
    } catch (err) {
      setIsStreaming(false);
      setError((err as Error).message);
    }
  };

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
        <button
          type="button"
          onClick={() => router.push(`/projects/${projectId}`)}
          className="inline-flex items-center gap-2 min-h-11 px-3 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Project
        </button>

        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">Discuss</h1>
          <span className="text-xs px-2 py-1 rounded-full border border-border text-muted-foreground">
            {isStreaming ? 'Streaming' : isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>

        {error && (
          <div className="rounded-md border border-red-300 bg-red-50 text-red-700 px-3 py-2 text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <section className="border border-border rounded-lg bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border font-medium">Conversation</div>
            <div className="h-[420px] overflow-y-auto p-4 space-y-3">
              {messages.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Ask a question to begin gathering context for this phase.
                </p>
              )}
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`rounded-md px-3 py-2 text-sm whitespace-pre-wrap ${
                    message.role === 'user'
                      ? 'bg-primary/10 border border-primary/20'
                      : 'bg-muted border border-border'
                  }`}
                >
                  <p className="text-xs uppercase tracking-wide mb-1 text-muted-foreground">
                    {message.role}
                  </p>
                  {message.text}
                </div>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="border-t border-border p-3 flex items-center gap-2">
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ask about goals, constraints, users, or decisions..."
                className="flex-1 min-h-11 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                disabled={isStreaming}
              />
              <button
                type="submit"
                disabled={isStreaming || !prompt.trim()}
                className="inline-flex items-center justify-center min-h-11 min-w-11 px-3 rounded-md bg-primary text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </section>

          <section className="border border-border rounded-lg bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border font-medium">CONTEXT.md Preview</div>
            <pre className="h-[474px] overflow-y-auto p-4 text-xs leading-5 whitespace-pre-wrap">
              {contextPreview || 'Context preview will appear after agent responses.'}
            </pre>
          </section>
        </div>
      </div>
    </main>
  );
}
