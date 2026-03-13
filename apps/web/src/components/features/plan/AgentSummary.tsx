/**
 * AgentSummary component - expandable summary section for completed agents.
 * Renders summary text with whitespace preserved.
 */

import clsx from 'clsx';

export interface AgentSummaryProps {
  summary: string;
  className?: string;
}

export function AgentSummary({ summary, className }: AgentSummaryProps) {
  return (
    <div
      className={clsx(
        'border-t mt-3 pt-3 text-sm text-muted-foreground',
        className
      )}
    >
      <pre className="whitespace-pre-wrap font-sans">
        {summary}
      </pre>
    </div>
  );
}
