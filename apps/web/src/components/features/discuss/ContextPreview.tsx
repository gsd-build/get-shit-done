/**
 * ContextPreview - Live preview panel for CONTEXT.md with collapsible sections
 */

'use client';

import { useState, useMemo, useCallback } from 'react';
import { Check, FileText } from 'lucide-react';
import clsx from 'clsx';
import { Collapsible, CollapsibleContent } from '@/components/ui/Collapsible';
import { SectionHeader } from './SectionHeader';
import { DecisionItem } from './DecisionItem';
import {
  useContextStore,
  selectContextState,
  selectLastUpdated,
  selectEditingDecisionId,
} from '@/stores/contextStore';
import type { Decision } from '@/lib/contextParser';

interface ExpandedSections {
  decisions: boolean;
  specifics: boolean;
  deferred: boolean;
}

interface ContextPreviewProps {
  /** Called when user starts editing a decision */
  onEditStart?: (decisionId: string) => void;
  /** Called when user completes an edit */
  onEditComplete?: (decisionId: string, newValue: string, oldValue: string) => void;
}

export function ContextPreview({ onEditStart, onEditComplete }: ContextPreviewProps) {
  const contextState = useContextStore(selectContextState);
  const lastUpdated = useContextStore(selectLastUpdated);
  const editingDecisionId = useContextStore(selectEditingDecisionId);
  const toggleLock = useContextStore(state => state.toggleLock);
  const bulkLock = useContextStore(state => state.bulkLock);

  const [expanded, setExpanded] = useState<ExpandedSections>({
    decisions: true,
    specifics: true,
    deferred: false,
  });

  // Track "Saved" indicator visibility
  const [showSaved, setShowSaved] = useState(false);

  // Show "Saved" briefly when lastUpdated changes
  useMemo(() => {
    if (lastUpdated) {
      setShowSaved(true);
      const timer = setTimeout(() => setShowSaved(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [lastUpdated]);

  const toggleSection = useCallback((section: keyof ExpandedSections) => {
    setExpanded(prev => ({ ...prev, [section]: !prev[section] }));
  }, []);

  const handleToggleLock = useCallback((id: string) => {
    toggleLock(id);
  }, [toggleLock]);

  const handleBulkLock = useCallback(
    (section: 'decisions' | 'specifics' | 'deferred', locked: boolean) => {
      bulkLock(section, locked);
    },
    [bulkLock]
  );

  // Check if section has any locked items
  const hasLockedItems = useCallback((decisions: Decision[]) => {
    return decisions.some(d => d.locked);
  }, []);

  // Render empty state
  if (!contextState) {
    return (
      <div className="h-full flex flex-col">
        <Header showSaved={false} />
        <div className="flex-1 overflow-y-auto p-4">
          <EmptyState />
        </div>
      </div>
    );
  }

  const { decisions, specifics, deferred, domain } = contextState;

  return (
    <div className="h-full flex flex-col bg-card">
      <Header showSaved={showSaved} />

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Domain section */}
        <div className="text-sm text-muted-foreground border-b border-border pb-4 mb-4">
          <h3 className="font-medium text-foreground mb-2">Phase Boundary</h3>
          <p className="whitespace-pre-wrap">{domain || 'No domain defined yet.'}</p>
        </div>

        {/* Decisions section */}
        <Collapsible open={expanded.decisions}>
          <SectionHeader
            title="Implementation Decisions"
            section="decisions"
            count={decisions.length}
            expanded={expanded.decisions}
            hasLockedItems={hasLockedItems(decisions)}
            onToggle={() => toggleSection('decisions')}
            onBulkLock={handleBulkLock}
          />
          <CollapsibleContent className="mt-2 space-y-1">
            {decisions.length === 0 ? (
              <p className="text-sm text-muted-foreground italic px-3 py-2">
                No decisions captured yet.
              </p>
            ) : (
              decisions.map(decision => (
                <DecisionItem
                  key={decision.id}
                  decision={decision}
                  onToggleLock={handleToggleLock}
                  isEditing={editingDecisionId === decision.id}
                  onEditStart={onEditStart}
                  onEditComplete={onEditComplete}
                />
              ))
            )}
          </CollapsibleContent>
        </Collapsible>

        {/* Specifics section */}
        <Collapsible open={expanded.specifics}>
          <SectionHeader
            title="Specific Ideas"
            section="specifics"
            count={specifics.length}
            expanded={expanded.specifics}
            hasLockedItems={hasLockedItems(specifics)}
            onToggle={() => toggleSection('specifics')}
            onBulkLock={handleBulkLock}
          />
          <CollapsibleContent className="mt-2 space-y-1">
            {specifics.length === 0 ? (
              <p className="text-sm text-muted-foreground italic px-3 py-2">
                No specific ideas captured yet.
              </p>
            ) : (
              specifics.map(decision => (
                <DecisionItem
                  key={decision.id}
                  decision={decision}
                  onToggleLock={handleToggleLock}
                  isEditing={editingDecisionId === decision.id}
                  onEditStart={onEditStart}
                  onEditComplete={onEditComplete}
                />
              ))
            )}
          </CollapsibleContent>
        </Collapsible>

        {/* Deferred section */}
        <Collapsible open={expanded.deferred}>
          <SectionHeader
            title="Deferred Ideas"
            section="deferred"
            count={deferred.length}
            expanded={expanded.deferred}
            hasLockedItems={hasLockedItems(deferred)}
            onToggle={() => toggleSection('deferred')}
            onBulkLock={handleBulkLock}
          />
          <CollapsibleContent className="mt-2 space-y-1">
            {deferred.length === 0 ? (
              <p className="text-sm text-muted-foreground italic px-3 py-2">
                No deferred ideas captured yet.
              </p>
            ) : (
              deferred.map(decision => (
                <DecisionItem
                  key={decision.id}
                  decision={decision}
                  onToggleLock={handleToggleLock}
                  isEditing={editingDecisionId === decision.id}
                  onEditStart={onEditStart}
                  onEditComplete={onEditComplete}
                />
              ))
            )}
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}

interface HeaderProps {
  showSaved: boolean;
}

function Header({ showSaved }: HeaderProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-border">
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-medium text-sm">CONTEXT.md Preview</h2>
      </div>
      <div
        className={clsx(
          'flex items-center gap-1.5 text-xs transition-opacity duration-300',
          showSaved ? 'opacity-100 text-healthy' : 'opacity-0'
        )}
      >
        <Check className="h-3 w-3" />
        <span>Saved</span>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="space-y-4">
      {/* Skeleton header */}
      <div className="border-b border-border pb-4">
        <div className="h-4 w-32 bg-muted rounded animate-pulse mb-2" />
        <div className="h-3 w-full bg-muted rounded animate-pulse mb-1" />
        <div className="h-3 w-3/4 bg-muted rounded animate-pulse" />
      </div>

      {/* Skeleton sections */}
      {['Implementation Decisions', 'Specific Ideas', 'Deferred Ideas'].map(title => (
        <div key={title} className="space-y-2">
          <div className="flex items-center gap-2 py-2 px-3 bg-muted/30 rounded-md">
            <div className="h-4 w-4 bg-muted rounded animate-pulse" />
            <div className="h-4 w-40 bg-muted rounded animate-pulse" />
          </div>
          <div className="px-3 py-2 text-sm text-muted-foreground italic">
            [Decisions will appear here as the conversation progresses...]
          </div>
        </div>
      ))}
    </div>
  );
}
