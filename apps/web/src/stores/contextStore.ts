/**
 * Context Store - Zustand store for parsed CONTEXT.md state
 */

import { create } from 'zustand';
import {
  parseContextMd,
  markNewDecisions,
  type ContextMdState,
  type Decision,
} from '@/lib/contextParser';

interface ContextStoreState {
  /** Current phase ID */
  phaseId: string | null;

  /** Parsed CONTEXT.md state */
  contextState: ContextMdState | null;

  /** Previous state for diff comparison */
  previousState: ContextMdState | null;

  /** Last update timestamp */
  lastUpdated: number | null;

  /** Set context from raw markdown */
  setContext: (phaseId: string, markdown: string) => void;

  /** Toggle lock status of a single decision */
  toggleLock: (decisionId: string) => void;

  /** Bulk lock/unlock all decisions in a section */
  bulkLock: (section: 'decisions' | 'specifics' | 'deferred', locked: boolean) => void;

  /** Update a decision's content */
  updateDecision: (id: string, content: string) => void;

  /** Get decisions marked as new (for highlighting) */
  getChangedDecisions: () => Decision[];

  /** Clear isNew flags after animation completes */
  clearNewFlags: () => void;

  /** Reset the store */
  reset: () => void;
}

/**
 * Update decisions in a list by mapping function
 */
function mapDecisions(
  decisions: Decision[],
  predicate: (d: Decision) => boolean,
  update: (d: Decision) => Decision
): Decision[] {
  return decisions.map(d => (predicate(d) ? update(d) : d));
}

export const useContextStore = create<ContextStoreState>((set, get) => ({
  phaseId: null,
  contextState: null,
  previousState: null,
  lastUpdated: null,

  setContext: (phaseId: string, markdown: string) => {
    const { contextState: previous } = get();
    const newState = parseContextMd(markdown);
    const markedState = markNewDecisions(newState, previous);

    set({
      phaseId,
      contextState: markedState,
      previousState: previous,
      lastUpdated: Date.now(),
    });
  },

  toggleLock: (decisionId: string) => {
    const { contextState } = get();
    if (!contextState) return;

    const toggle = (d: Decision): Decision => ({ ...d, locked: !d.locked });
    const matchId = (d: Decision) => d.id === decisionId;

    set({
      contextState: {
        ...contextState,
        decisions: mapDecisions(contextState.decisions, matchId, toggle),
        specifics: mapDecisions(contextState.specifics, matchId, toggle),
        deferred: mapDecisions(contextState.deferred, matchId, toggle),
      },
      lastUpdated: Date.now(),
    });
  },

  bulkLock: (section: 'decisions' | 'specifics' | 'deferred', locked: boolean) => {
    const { contextState } = get();
    if (!contextState) return;

    const setLocked = (d: Decision): Decision => ({ ...d, locked });
    const always = () => true;

    const updates: Partial<ContextMdState> = {};
    if (section === 'decisions') {
      updates.decisions = mapDecisions(contextState.decisions, always, setLocked);
    } else if (section === 'specifics') {
      updates.specifics = mapDecisions(contextState.specifics, always, setLocked);
    } else if (section === 'deferred') {
      updates.deferred = mapDecisions(contextState.deferred, always, setLocked);
    }

    set({
      contextState: { ...contextState, ...updates },
      lastUpdated: Date.now(),
    });
  },

  updateDecision: (id: string, content: string) => {
    const { contextState } = get();
    if (!contextState) return;

    const updateContent = (d: Decision): Decision => ({ ...d, content });
    const matchId = (d: Decision) => d.id === id;

    set({
      contextState: {
        ...contextState,
        decisions: mapDecisions(contextState.decisions, matchId, updateContent),
        specifics: mapDecisions(contextState.specifics, matchId, updateContent),
        deferred: mapDecisions(contextState.deferred, matchId, updateContent),
      },
      lastUpdated: Date.now(),
    });
  },

  getChangedDecisions: () => {
    const { contextState } = get();
    if (!contextState) return [];

    return [
      ...contextState.decisions.filter(d => d.isNew),
      ...contextState.specifics.filter(d => d.isNew),
      ...contextState.deferred.filter(d => d.isNew),
    ];
  },

  clearNewFlags: () => {
    const { contextState } = get();
    if (!contextState) return;

    const clearNew = (d: Decision): Decision => ({ ...d, isNew: false });
    const always = () => true;

    set({
      contextState: {
        ...contextState,
        decisions: mapDecisions(contextState.decisions, always, clearNew),
        specifics: mapDecisions(contextState.specifics, always, clearNew),
        deferred: mapDecisions(contextState.deferred, always, clearNew),
      },
    });
  },

  reset: () => {
    set({
      phaseId: null,
      contextState: null,
      previousState: null,
      lastUpdated: null,
    });
  },
}));

// Selectors for optimized re-renders
export const selectContextState = (state: ContextStoreState) => state.contextState;
export const selectPhaseId = (state: ContextStoreState) => state.phaseId;
export const selectLastUpdated = (state: ContextStoreState) => state.lastUpdated;
export const selectDecisions = (state: ContextStoreState) => state.contextState?.decisions ?? [];
export const selectSpecifics = (state: ContextStoreState) => state.contextState?.specifics ?? [];
export const selectDeferred = (state: ContextStoreState) => state.contextState?.deferred ?? [];
