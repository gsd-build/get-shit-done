'use client';

import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { useTokenStream } from '@/hooks/useTokenStream';
import { useDiscussSession } from '@/hooks/useDiscussSession';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { useContextSync } from '@/hooks/useContextSync';
import {
  useDiscussStore,
  selectMessages,
  selectIsStreaming,
  selectCurrentStreamingContent,
  selectTopicIndex,
  selectHasHydrated,
  type Message,
} from '@/stores/discussStore';
import { useContextStore, selectLastUpdated as selectContextLastUpdated } from '@/stores/contextStore';
import { ChatInterface, ConflictDialog, DiscussLayout, SavedIndicator, DEFAULT_TOPICS } from '@/components/features/discuss';

const API_BASE =
  process.env['NEXT_PUBLIC_API_URL'] || 'http://localhost:4000';
const SOCKET_URL =
  process.env['NEXT_PUBLIC_SOCKET_URL'] || 'http://localhost:4000';

/**
 * Discuss phase page for conversational context gathering.
 *
 * Integrates chat UI with Socket.IO streaming and agent orchestration.
 */
export default function DiscussPage() {
  const params = useParams();
  const projectId = params['id'] as string;

  // Socket connection
  const { socket, isConnected } = useSocket(SOCKET_URL);

  // Store state with selectors
  const messages = useDiscussStore(selectMessages);
  const isStreaming = useDiscussStore(selectIsStreaming);
  const currentStreamingContent = useDiscussStore(selectCurrentStreamingContent);
  const topicIndex = useDiscussStore(selectTopicIndex);
  const hasHydrated = useDiscussStore(selectHasHydrated);

  // Context store for tracking unsaved changes
  const contextLastUpdated = useContextStore(selectContextLastUpdated);

  // Store actions
  const addMessage = useDiscussStore((s) => s.addMessage);
  const setStreaming = useDiscussStore((s) => s.setStreaming);
  const setAgentId = useDiscussStore((s) => s.setAgentId);
  const updateStreamingContent = useDiscussStore((s) => s.updateStreamingContent);
  const selectQuestionOption = useDiscussStore((s) => s.selectQuestionOption);
  const setTopicIndex = useDiscussStore((s) => s.setTopicIndex);
  const reset = useDiscussStore((s) => s.reset);

  // Session management with reconnection handling
  const { isReconnecting } = useDiscussSession({
    phaseId: projectId,
    socket,
    onReconnected: () => {
      // Connection restored - streaming will resume via agent:subscribe
    },
  });

  // Current agent ID for streaming
  const [currentAgentId, setCurrentAgentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Context sync for inline editing and conflict detection
  const {
    pendingConflict,
    onEditStart,
    onEditComplete,
    onConflictResolve,
  } = useContextSync(socket, currentAgentId);

  // Track saved state for indicator
  const [showSaved, setShowSaved] = useState(false);
  const lastSaveTimeRef = useRef<number>(0);

  // Track message count for detecting changes
  const prevMessageCountRef = useRef<number>(messages.length);

  // Show saved indicator when state persists
  useEffect(() => {
    // Skip on initial mount
    if (prevMessageCountRef.current === 0 && messages.length === 0) return;

    // Check if messages changed (added)
    if (messages.length > prevMessageCountRef.current) {
      const now = Date.now();
      // Debounce: only show if 500ms since last save
      if (now - lastSaveTimeRef.current > 500) {
        setShowSaved(true);
        lastSaveTimeRef.current = now;
        // Reset showSaved after SavedIndicator auto-hides
        setTimeout(() => setShowSaved(false), 2500);
      }
    }
    prevMessageCountRef.current = messages.length;
  }, [messages.length]);

  // Show saved indicator when context updates
  useEffect(() => {
    if (!contextLastUpdated) return;

    const now = Date.now();
    // Debounce: only show if 500ms since last save
    if (now - lastSaveTimeRef.current > 500) {
      setShowSaved(true);
      lastSaveTimeRef.current = now;
      setTimeout(() => setShowSaved(false), 2500);
    }
  }, [contextLastUpdated]);

  // Compute unsaved changes for beforeunload warning
  const hasUnsavedChanges = useMemo(() => {
    // Consider unsaved if streaming is in progress
    if (isStreaming) return true;
    // Consider unsaved if there are messages and we're in an active session
    return messages.length > 0 && currentAgentId !== null;
  }, [isStreaming, messages.length, currentAgentId]);

  // Warn before leaving with unsaved changes
  useUnsavedChanges(hasUnsavedChanges);

  // Token streaming with typewriter effect
  const { displayedText, clear: clearStream } = useTokenStream({
    socket,
    agentId: currentAgentId,
    onStart: () => {
      setStreaming(true);
      updateStreamingContent('');
    },
    onEnd: (content) => {
      // Add completed message to store
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content,
        timestamp: new Date().toISOString(),
      };
      addMessage(assistantMessage);
      setStreaming(false);
      setCurrentAgentId(null);
      updateStreamingContent('');
    },
  });

  // Sync displayed text to store for ChatInterface
  useEffect(() => {
    updateStreamingContent(displayedText);
  }, [displayedText, updateStreamingContent]);

  // Reset store on unmount
  useEffect(() => {
    return () => {
      reset();
    };
  }, [reset]);

  // Send message handler
  const handleSendMessage = useCallback(
    async (content: string) => {
      setError(null);

      // Add user message
      const userMessage: Message = {
        id: `user-${Date.now()}`,
        role: 'user',
        content,
        timestamp: new Date().toISOString(),
      };
      addMessage(userMessage);

      // Clear any previous streaming state
      clearStream();
      setStreaming(true);

      try {
        // Call agent API to start discuss-phase agent
        const response = await fetch(`${API_BASE}/api/agents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId,
            agentType: 'discuss-phase',
            prompt: content,
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to start agent: ${response.status}`);
        }

        const data = await response.json();
        const agentId = data.data?.agentId;

        if (!agentId) {
          throw new Error('No agent ID in response');
        }

        // Store agent ID and start subscription
        setAgentId(agentId);
        setCurrentAgentId(agentId);
      } catch (err) {
        setStreaming(false);
        setError(
          err instanceof Error ? err.message : 'Failed to generate. Retry?'
        );

        // Add error message to chat
        const errorMessage: Message = {
          id: `error-${Date.now()}`,
          role: 'system',
          content: `Error: ${err instanceof Error ? err.message : 'Failed to generate response.'}`,
          timestamp: new Date().toISOString(),
        };
        addMessage(errorMessage);
      }
    },
    [projectId, addMessage, clearStream, setStreaming, setAgentId]
  );

  // Question option selection handler
  const handleSelectOption = useCallback(
    async (messageId: string, optionId: string) => {
      // Update local state
      selectQuestionOption(messageId, optionId);

      // Find the message and selected option
      const message = messages.find((m) => m.id === messageId);
      if (!message?.questionCard) return;

      const option = message.questionCard.options.find((o) => o.id === optionId);
      if (!option) return;

      // Create system message for context
      const systemMessage: Message = {
        id: `system-${Date.now()}`,
        role: 'system',
        content: `[User selected: ${option.label}]`,
        timestamp: new Date().toISOString(),
      };
      addMessage(systemMessage);

      // Continue conversation with selection as follow-up
      await handleSendMessage(`I selected: ${option.label}`);
    },
    [messages, selectQuestionOption, addMessage, handleSendMessage]
  );

  // Topic click handler
  const handleTopicClick = useCallback(
    (index: number) => {
      setTopicIndex(index);
      // Actual navigation behavior will be implemented in Plan 03
    },
    [setTopicIndex]
  );

  // Don't render until hydrated to avoid hydration mismatch
  if (!hasHydrated) {
    return (
      <main className="h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading session...</div>
      </main>
    );
  }

  return (
    <main className="h-screen flex flex-col">
      {/* Header with saved indicator */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <h1 className="text-sm font-medium">Discuss Phase</h1>
        <SavedIndicator show={showSaved} />
      </div>

      {/* Inline error banner */}
      {error && (
        <div className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-4 py-2 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-red-500 hover:text-red-700 dark:hover:text-red-200"
          >
            Dismiss
          </button>
        </div>
      )}

      <DiscussLayout
        onEditStart={onEditStart}
        onEditComplete={onEditComplete}
      >
        <ChatInterface
          messages={messages}
          isConnected={isConnected && !isReconnecting}
          isStreaming={isStreaming}
          streamingText={currentStreamingContent}
          topicIndex={topicIndex}
          topics={DEFAULT_TOPICS}
          phaseNumber="16"
          phaseName="Discuss Phase UI"
          onSendMessage={handleSendMessage}
          onSelectOption={handleSelectOption}
          onTopicClick={handleTopicClick}
        />
      </DiscussLayout>

      {/* Conflict resolution dialog */}
      <ConflictDialog
        isOpen={pendingConflict !== null}
        onClose={() => onConflictResolve('user')}
        userVersion={pendingConflict?.userVersion ?? ''}
        claudeVersion={pendingConflict?.claudeVersion ?? ''}
        onResolve={onConflictResolve}
      />
    </main>
  );
}
