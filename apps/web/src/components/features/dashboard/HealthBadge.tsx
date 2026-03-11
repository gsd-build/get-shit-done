'use client';

import * as Popover from '@radix-ui/react-popover';
import { Badge } from '@/components/ui/Badge';
import type { HealthStatus } from '@/types';

interface HealthBadgeProps {
  status: HealthStatus;
  issues: string[];
}

const statusLabels: Record<HealthStatus, string> = {
  healthy: 'Healthy',
  degraded: 'Degraded',
  error: 'Error',
};

const statusVariants: Record<HealthStatus, 'success' | 'warning' | 'error'> = {
  healthy: 'success',
  degraded: 'warning',
  error: 'error',
};

export function HealthBadge({ status, issues }: HealthBadgeProps) {
  const hasIssues = issues.length > 0;

  const badge = (
    <Badge variant={statusVariants[status]}>
      {statusLabels[status]}
    </Badge>
  );

  if (!hasIssues) {
    return badge;
  }

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button type="button" className="cursor-pointer">
          {badge}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="z-50 w-64 rounded-md bg-card p-3 shadow-lg border border-border"
          sideOffset={5}
        >
          <h4 className="font-medium text-sm mb-2">Issues</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            {issues.map((issue, i) => (
              <li key={i}>{issue}</li>
            ))}
          </ul>
          <Popover.Arrow className="fill-card" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
