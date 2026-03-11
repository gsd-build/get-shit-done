'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/** Question card option */
export interface QuestionOption {
  id: string;
  label: string;
}

/** Question card data embedded in messages */
export interface QuestionCardData {
  options: QuestionOption[];
  multiSelect: boolean;
  selected: string[];
}

/** Message role types */
export type MessageRole = 'user' | 'assistant' | 'system';

/** Chat message structure */
export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: string;
  questionCard?: QuestionCardData;
}

/** Discuss store state (persisted fields) */
interface DiscussPersistedState {
  phaseId: string | null;
  messages: Message[];
  agentId: string | null;
  topicIndex: number;
}

/** Discuss store state (transient fields - not persisted) */
interface DiscussTransientState {
  isStreaming: boolean;
  currentStreamingContent: string;
  hasHydrated: boolean;
}

/** Full Discuss store state */
interface DiscussState extends DiscussPersistedState, DiscussTransientState {}

/** Discuss store actions */
interface DiscussActions {
  setPhaseId: (phaseId: string) => void;
  addMessage: (message: Message) => void;
  updateStreamingContent: (content: string) => void;
  setStreaming: (isStreaming: boolean) => void;
  setAgentId: (agentId: string | null) => void;
  selectQuestionOption: (messageId: string, optionId: string) => void;
  setTopicIndex: (index: number) => void;
  setHasHydrated: (hasHydrated: boolean) => void;
  reset: () => void;
}

type DiscussStore = DiscussState & DiscussActions;

const initialState: DiscussState = {
  phaseId: null,
  messages: [],
  isStreaming: false,
  currentStreamingContent: '',
  agentId: null,
  topicIndex: 0,
  hasHydrated: false,
};

export const useDiscussStore = create<DiscussStore>()(
  persist(
    (set) => ({
      ...initialState,

  setPhaseId: (phaseId) => set({ phaseId }),

  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message],
    })),

  updateStreamingContent: (currentStreamingContent) =>
    set({ currentStreamingContent }),

  setStreaming: (isStreaming) =>
    set({
      isStreaming,
      currentStreamingContent: isStreaming ? '' : '',
    }),

  setAgentId: (agentId) => set({ agentId }),

  selectQuestionOption: (messageId, optionId) =>
    set((state) => ({
      messages: state.messages.map((msg) => {
        if (msg.id !== messageId || !msg.questionCard) return msg;

        const { questionCard } = msg;
        let newSelected: string[];

        if (questionCard.multiSelect) {
          // Toggle selection for multi-select
          newSelected = questionCard.selected.includes(optionId)
            ? questionCard.selected.filter((id) => id !== optionId)
            : [...questionCard.selected, optionId];
        } else {
          // Replace selection for single-select
          newSelected = [optionId];
        }

        return {
          ...msg,
          questionCard: {
            ...questionCard,
            selected: newSelected,
          },
        };
      }),
    })),

  setTopicIndex: (topicIndex) => set({ topicIndex }),

  setHasHydrated: (hasHydrated) => set({ hasHydrated }),

  reset: () => set(initialState),
    }),
    {
      name: 'gsd-discuss-session',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state): DiscussPersistedState => ({
        phaseId: state.phaseId,
        messages: state.messages,
        agentId: state.agentId,
        topicIndex: state.topicIndex,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);

// Selectors for optimized re-renders
export const selectMessages = (state: DiscussStore) => state.messages;
export const selectIsStreaming = (state: DiscussStore) => state.isStreaming;
export const selectCurrentStreamingContent = (state: DiscussStore) =>
  state.currentStreamingContent;
export const selectAgentId = (state: DiscussStore) => state.agentId;
export const selectTopicIndex = (state: DiscussStore) => state.topicIndex;
export const selectPhaseId = (state: DiscussStore) => state.phaseId;
export const selectHasHydrated = (state: DiscussStore) => state.hasHydrated;
