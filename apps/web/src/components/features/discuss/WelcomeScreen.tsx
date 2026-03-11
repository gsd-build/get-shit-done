'use client';

import { memo } from 'react';
import { MessageSquare } from 'lucide-react';

interface WelcomeScreenProps {
  /** Phase number for context */
  phaseNumber?: string;
  /** Phase name for context */
  phaseName?: string;
}

/**
 * Welcome screen displayed when no messages exist.
 *
 * Shows brief intro text explaining discuss phase purpose,
 * phase context, and "Start discussing" prompt.
 */
export const WelcomeScreen = memo(function WelcomeScreen({
  phaseNumber,
  phaseName,
}: WelcomeScreenProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
        <MessageSquare className="w-8 h-8 text-primary" />
      </div>

      <h2 className="text-2xl font-semibold text-foreground mb-3">
        Discuss Phase Context
      </h2>

      {(phaseNumber || phaseName) && (
        <div className="text-sm text-muted-foreground mb-4">
          {phaseNumber && <span>Phase {phaseNumber}</span>}
          {phaseNumber && phaseName && <span> - </span>}
          {phaseName && <span>{phaseName}</span>}
        </div>
      )}

      <p className="text-muted-foreground max-w-md mb-6">
        Chat with Claude to gather implementation context for this phase.
        Discuss UI decisions, technical specifics, and capture any deferred ideas.
        Your conversation will help shape the CONTEXT.md document.
      </p>

      <div className="flex items-center gap-2 text-primary">
        <span className="text-sm font-medium">Start typing below to begin</span>
        <span className="animate-pulse">|</span>
      </div>
    </div>
  );
});
