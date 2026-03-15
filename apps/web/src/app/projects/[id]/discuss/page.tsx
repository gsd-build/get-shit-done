'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Send } from 'lucide-react';
import { EVENTS } from '@gsd/events';
import { useSocket } from '@/hooks/useSocket';
import { API_PROXY_BASE, resolveSocketBase } from '@/lib/endpoints';
import { WorkflowHeader } from '@/components/features/projects/WorkflowHeader';
import { NewPlanModal } from '@/components/features/projects/NewPlanModal';
import { DecisionOptionsPanel } from '@/components/features/discuss/DecisionOptionsPanel';
import {
  OrchestrationControlBar,
  RunStatusStrip,
} from '@/components/features/orchestration';
import {
  useOrchestrationStore,
  selectSelectedOrchestrationRun,
} from '@/stores/orchestrationStore';
import {
  useDiscussStore,
  selectDecisions,
  selectAuditEvents,
  type DiscussDecision,
} from '@/stores/discussStore';

interface DiscussMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

const STORAGE_PREFIX = 'gsd-discuss';

function buildDefaultDecisionOptions(question: string) {
  return [
    {
      id: `${question}-recommended`,
      label: 'Use suggested default',
      recommended: true,
    },
    {
      id: `${question}-alternative`,
      label: 'Choose alternative approach',
    },
    {
      id: `${question}-defer`,
      label: 'Defer this decision',
    },
  ];
}

function parseDecisionQuestions(text: string): DiscussDecision[] {
  const questionLines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^\d+\.\s+/.test(line))
    .map((line) => line.replace(/^\d+\.\s+/, '').trim())
    .filter(Boolean);

  return questionLines.map((question, index) => ({
    id: `decision-${index + 1}-${question.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`,
    question,
    options: buildDefaultDecisionOptions(question),
  }));
}

export default function DiscussPage() {
  const params = useParams();
  const projectId = params['id'] as string;
  const socketUrl = useMemo(() => resolveSocketBase(), []);
  const storageKey = `${STORAGE_PREFIX}:${projectId}`;

  const { socket, isConnected } = useSocket(socketUrl);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DiscussMessage[]>([]);
  const [contextPreview, setContextPreview] = useState('');
  const [hasHydratedStorage, setHasHydratedStorage] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNewPlan, setShowNewPlan] = useState(false);
  const decisions = useDiscussStore(selectDecisions);
  const unresolvedDecisions = useMemo(
    () => decisions.filter((decision) => !decision.selectedOptionId),
    [decisions]
  );
  const auditEvents = useDiscussStore(selectAuditEvents);
  const setDecisions = useDiscussStore((state) => state.setDecisions);
  const applyDecision = useDiscussStore((state) => state.applyDecision);
  const acceptAllDefaults = useDiscussStore((state) => state.acceptAllDefaults);
  const clearDiscussState = useDiscussStore((state) => state.clear);
  const setRuns = useOrchestrationStore((state) => state.setRuns);
  const setSelectedRun = useOrchestrationStore((state) => state.setSelectedRun);
  const selectedRun = useOrchestrationStore(selectSelectedOrchestrationRun);

  useEffect(() => {
    const runId = `${projectId}:discuss`;
    setRuns([
      {
        id: runId,
        phaseId: 'discuss',
        name: 'Discuss Context Session',
        status: isStreaming ? 'active' : 'paused',
        updatedAt: new Date().toISOString(),
        isEditingLocked: isStreaming,
      },
    ]);
    setSelectedRun(runId);
  }, [projectId, isStreaming, setRuns, setSelectedRun]);

  useEffect(() => {
    clearDiscussState();
    const raw = localStorage.getItem(storageKey);
    if (raw) {
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
    }
    setHasHydratedStorage(true);
  }, [storageKey, clearDiscussState]);

  useEffect(() => {
    if (!hasHydratedStorage) return;
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        messages,
        contextPreview,
      })
    );
  }, [messages, contextPreview, storageKey, hasHydratedStorage]);

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

  const sendPrompt = async (nextPrompt: string) => {
    if (!nextPrompt.trim() || isStreaming) return;
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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isStreaming) return;

    const nextPrompt = prompt.trim();
    setPrompt('');
    await sendPrompt(nextPrompt);
  };

  const handleChooseOption = async (decisionId: string, optionId: string) => {
    const decision = decisions.find((item) => item.id === decisionId);
    const option = decision?.options.find((item) => item.id === optionId);
    if (!decision || !option) return;

    applyDecision(decisionId, optionId);
    await sendPrompt(
      `Decision selected:\n- Question: ${decision.question}\n- Option: ${option.label}\nPlease continue with the next unresolved decision.`
    );
  };

  const handleAcceptAllDefaults = async () => {
    if (unresolvedDecisions.length === 0) return;
    const summaryLines = unresolvedDecisions.map((decision) => {
      const recommended = decision.options.find((option) => option.recommended) ?? decision.options[0];
      return `- ${decision.question}: ${recommended?.label ?? 'Use suggested default'}`;
    });

    acceptAllDefaults();
    await sendPrompt(
      `Accept all defaults for unresolved decisions:\n${summaryLines.join('\n')}\nProceed to finalize discuss outcomes.`
    );
  };

  useEffect(() => {
    if (isStreaming) return;
    const latestAssistant = [...messages].reverse().find((message) => message.role === 'assistant');
    if (!latestAssistant) return;

    const parsedDecisions = parseDecisionQuestions(latestAssistant.text);
    if (parsedDecisions.length > 0) {
      setDecisions(parsedDecisions);
    }
  }, [messages, isStreaming, setDecisions]);

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
        <WorkflowHeader
          projectId={projectId}
          title="Discuss"
          subtitle={isConnected ? 'Connected' : 'Disconnected'}
          onNewPlan={() => setShowNewPlan(true)}
        />

        <OrchestrationControlBar projectId={projectId} phaseId="discuss" />
        <RunStatusStrip run={selectedRun} />

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

          <div className="space-y-4">
            <section className="border border-border rounded-lg bg-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border font-medium">CONTEXT.md Preview</div>
              <pre className="h-[300px] overflow-y-auto p-4 text-xs leading-5 whitespace-pre-wrap">
                {contextPreview || 'Context preview will appear after agent responses.'}
              </pre>
            </section>

            <DecisionOptionsPanel
              decisions={decisions}
              disabled={isStreaming}
              onChooseOption={handleChooseOption}
              onAcceptAllDefaults={handleAcceptAllDefaults}
            />

            <section className="border border-border rounded-lg bg-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border font-medium">Decision Audit</div>
              <div className="p-4 space-y-2 max-h-[180px] overflow-y-auto">
                {auditEvents.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No decision audit entries yet.</p>
                ) : (
                  auditEvents.map((event) => (
                    <div key={event.id} className="text-xs text-foreground">
                      <span className="font-medium uppercase mr-1">{event.type}</span>
                      <span>{event.message}</span>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </div>

        <NewPlanModal
          projectId={projectId}
          open={showNewPlan}
          onOpenChange={setShowNewPlan}
        />
      </div>
    </main>
  );
}
