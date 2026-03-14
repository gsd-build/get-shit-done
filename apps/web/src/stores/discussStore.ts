import { create } from 'zustand';

export interface DecisionOption {
  id: string;
  label: string;
  recommended?: boolean;
}

export interface DiscussDecision {
  id: string;
  question: string;
  options: DecisionOption[];
  selectedOptionId?: string;
}

export interface DiscussAuditEvent {
  id: string;
  type: 'summary' | 'decision';
  message: string;
  timestamp: string;
  decisionId?: string;
  optionId?: string;
}

interface DiscussStore {
  decisions: DiscussDecision[];
  auditEvents: DiscussAuditEvent[];
  setDecisions: (decisions: DiscussDecision[]) => void;
  applyDecision: (decisionId: string, optionId: string) => void;
  acceptAllDefaults: () => void;
  clear: () => void;
}

function makeAuditId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getRecommendedOption(decision: DiscussDecision): DecisionOption | undefined {
  return decision.options.find((option) => option.recommended) ?? decision.options[0];
}

export const useDiscussStore = create<DiscussStore>((set) => ({
  decisions: [],
  auditEvents: [],

  setDecisions: (nextDecisions) =>
    set((state) => {
      if (nextDecisions.length === 0) {
        return state;
      }

      const selectionByQuestion = new Map(
        state.decisions.map((decision) => [decision.question, decision.selectedOptionId])
      );

      const merged = nextDecisions.map((decision) => {
        const selectedOptionId = selectionByQuestion.get(decision.question);
        return selectedOptionId
          ? { ...decision, selectedOptionId }
          : decision;
      });

      return { decisions: merged };
    }),

  applyDecision: (decisionId, optionId) =>
    set((state) => {
      const target = state.decisions.find((decision) => decision.id === decisionId);
      const option = target?.options.find((candidate) => candidate.id === optionId);
      if (!target || !option) {
        return state;
      }

      return {
        decisions: state.decisions.map((decision) =>
          decision.id === decisionId ? { ...decision, selectedOptionId: optionId } : decision
        ),
        auditEvents: [
          ...state.auditEvents,
          {
            id: makeAuditId('decision'),
            type: 'decision',
            message: `Applied \"${option.label}\" for: ${target.question}`,
            timestamp: new Date().toISOString(),
            decisionId,
            optionId,
          },
        ],
      };
    }),

  acceptAllDefaults: () =>
    set((state) => {
      const unresolved = state.decisions.filter((decision) => !decision.selectedOptionId);
      if (unresolved.length === 0) {
        return state;
      }

      const decisionEvents: DiscussAuditEvent[] = [];
      const defaultsByDecision = new Map<string, string>();

      for (const decision of unresolved) {
        const recommended = getRecommendedOption(decision);
        if (!recommended) continue;

        defaultsByDecision.set(decision.id, recommended.id);
        decisionEvents.push({
          id: makeAuditId('decision'),
          type: 'decision',
          message: `Applied default \"${recommended.label}\" for: ${decision.question}`,
          timestamp: new Date().toISOString(),
          decisionId: decision.id,
          optionId: recommended.id,
        });
      }

      if (defaultsByDecision.size === 0) {
        return state;
      }

      const summaryEvent: DiscussAuditEvent = {
        id: makeAuditId('summary'),
        type: 'summary',
        message: `Accepted all defaults for ${defaultsByDecision.size} decision${defaultsByDecision.size === 1 ? '' : 's'}.`,
        timestamp: new Date().toISOString(),
      };

      return {
        decisions: state.decisions.map((decision) => {
          const defaultOptionId = defaultsByDecision.get(decision.id);
          return defaultOptionId
            ? { ...decision, selectedOptionId: defaultOptionId }
            : decision;
        }),
        auditEvents: [...state.auditEvents, summaryEvent, ...decisionEvents],
      };
    }),

  clear: () => set({ decisions: [], auditEvents: [] }),
}));

export const selectDecisions = (state: DiscussStore) => state.decisions;
export const selectAuditEvents = (state: DiscussStore) => state.auditEvents;
export const selectUnresolvedDecisions = (state: DiscussStore) =>
  state.decisions.filter((decision) => !decision.selectedOptionId);
