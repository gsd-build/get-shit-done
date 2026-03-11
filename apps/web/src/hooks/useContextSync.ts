/**
 * useContextSync - Bidirectional sync between edits and conversation
 *
 * Tracks editing state, detects conflicts when Claude updates while user is
 * editing, and creates system messages for edit operations.
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import { type TypedSocket, EVENTS, type ContextUpdateEvent } from '@gsd/events';
import { useContextStore } from '@/stores/contextStore';
import { useDiscussStore, type Message } from '@/stores/discussStore';
import type { ConflictChoice } from '@/components/features/discuss/ConflictDialog';

/** Data structure for a pending conflict */
export interface ConflictData {
  decisionId: string;
  userVersion: string;
  claudeVersion: string;
}

/** Return type for useContextSync hook */
export interface UseContextSyncResult {
  /** Whether any decision is currently being edited */
  isEditing: boolean;
  /** ID of the decision currently being edited, or null */
  editingDecisionId: string | null;
  /** Pending conflict data if a conflict exists, or null */
  pendingConflict: ConflictData | null;
  /** Call when user starts editing a decision */
  onEditStart: (decisionId: string) => void;
  /** Call when user completes an edit (blur/enter) */
  onEditComplete: (id: string, newValue: string, oldValue: string) => void;
  /** Call when user resolves a conflict */
  onConflictResolve: (choice: ConflictChoice) => void;
}

/**
 * Truncate text for display in system messages
 */
function truncate(text: string, maxLength: number = 50): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Generate a unique message ID
 */
function generateMessageId(): string {
  return `system-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function useContextSync(
  socket: TypedSocket | null,
  agentId: string | null
): UseContextSyncResult {
  const [editingDecisionId, setEditingDecisionId] = useState<string | null>(null);
  const [pendingConflict, setPendingConflict] = useState<ConflictData | null>(null);

  // Store actions
  const updateDecision = useContextStore((state) => state.updateDecision);
  const markEditing = useContextStore((state) => state.markEditing);
  const contextState = useContextStore((state) => state.contextState);
  const addMessage = useDiscussStore((state) => state.addMessage);

  // Track whether we're editing
  const isEditing = editingDecisionId !== null;

  /**
   * Find a decision by ID across all sections
   */
  const findDecision = useCallback(
    (id: string) => {
      if (!contextState) return null;
      return (
        contextState.decisions.find((d) => d.id === id) ||
        contextState.specifics.find((d) => d.id === id) ||
        contextState.deferred.find((d) => d.id === id) ||
        null
      );
    },
    [contextState]
  );

  /**
   * Called when user starts editing a decision
   */
  const onEditStart = useCallback(
    (decisionId: string) => {
      setEditingDecisionId(decisionId);
      markEditing?.(decisionId);
    },
    [markEditing]
  );

  /**
   * Called when user completes an edit (blur or Enter key)
   */
  const onEditComplete = useCallback(
    (id: string, newValue: string, oldValue: string) => {
      // Update the context store with the new value
      updateDecision(id, newValue);

      // Create system message for the edit
      const systemMessage: Message = {
        id: generateMessageId(),
        role: 'system',
        content: `[User edited: Changed "${truncate(oldValue)}" to "${truncate(newValue)}"]`,
        timestamp: new Date().toISOString(),
      };
      addMessage(systemMessage);

      // Clear editing state
      setEditingDecisionId(null);
      markEditing?.(null);
    },
    [updateDecision, addMessage, markEditing]
  );

  /**
   * Called when user resolves a conflict
   */
  const onConflictResolve = useCallback(
    (choice: ConflictChoice) => {
      if (!pendingConflict) return;

      const { decisionId, userVersion, claudeVersion } = pendingConflict;

      if (choice === 'user') {
        // Keep user's version (already in store)
        const systemMessage: Message = {
          id: generateMessageId(),
          role: 'system',
          content: `[Conflict resolved: User chose to keep their edit]`,
          timestamp: new Date().toISOString(),
        };
        addMessage(systemMessage);
      } else {
        // Accept Claude's version
        updateDecision(decisionId, claudeVersion);
        const systemMessage: Message = {
          id: generateMessageId(),
          role: 'system',
          content: `[Conflict resolved: User accepted Claude's update]`,
          timestamp: new Date().toISOString(),
        };
        addMessage(systemMessage);
      }

      // Clear conflict state
      setPendingConflict(null);
    },
    [pendingConflict, updateDecision, addMessage]
  );

  /**
   * Listen for context updates from server while editing
   */
  useEffect(() => {
    if (!socket || !agentId) return;

    const handleContextUpdate = (data: ContextUpdateEvent) => {
      // If we're editing and this update affects our edited decision
      if (editingDecisionId && data.decisionId === editingDecisionId) {
        const currentDecision = findDecision(editingDecisionId);
        const currentContent = currentDecision?.content || '';

        // Only show conflict if content differs
        if (data.content && data.content !== currentContent) {
          setPendingConflict({
            decisionId: editingDecisionId,
            userVersion: currentContent,
            claudeVersion: data.content,
          });
        }
      }
      // If different decision or not editing, update would be applied normally
      // (handled by setContext in parent component)
    };

    socket.on(EVENTS.CONTEXT_UPDATE, handleContextUpdate);

    return () => {
      socket.off(EVENTS.CONTEXT_UPDATE, handleContextUpdate);
    };
  }, [socket, agentId, editingDecisionId, findDecision]);

  /**
   * Test hook: Listen for custom events to inject context updates
   * Only active in development/test environments
   */
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;

    const handleTestContextUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<{ decisionId: string; content: string }>;
      const { decisionId, content } = customEvent.detail;

      // If we're editing and this affects our edited decision, show conflict
      if (editingDecisionId) {
        const currentDecision = findDecision(editingDecisionId);
        const currentContent = currentDecision?.content || '';

        // Trigger conflict if editing any decision (for testing)
        if (content && content !== currentContent) {
          setPendingConflict({
            decisionId: editingDecisionId,
            userVersion: currentContent,
            claudeVersion: content,
          });
        }
      }
    };

    window.addEventListener('test:context-update', handleTestContextUpdate);

    return () => {
      window.removeEventListener('test:context-update', handleTestContextUpdate);
    };
  }, [editingDecisionId, findDecision]);

  return {
    isEditing,
    editingDecisionId,
    pendingConflict,
    onEditStart,
    onEditComplete,
    onConflictResolve,
  };
}
