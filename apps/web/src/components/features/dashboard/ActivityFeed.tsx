'use client';

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ChevronDown, ChevronUp, Play, CheckCircle, FileText, MessageSquare } from 'lucide-react';

export interface Activity {
  id: string;
  description: string;
  agent: string;
  timestamp: string;
  type?: 'execute' | 'verify' | 'plan' | 'discuss';
}

interface ActivityFeedProps {
  activities: Activity[];
  compact?: boolean;
  onActivityClick?: (id: string) => void;
}

const iconMap = {
  execute: Play,
  verify: CheckCircle,
  plan: FileText,
  discuss: MessageSquare,
};

export function ActivityFeed({ activities, compact = false, onActivityClick }: ActivityFeedProps) {
  const [expanded, setExpanded] = useState(false);
  const displayCount = compact && !expanded ? 2 : 5;
  const visibleActivities = activities.slice(0, displayCount);
  const hasMore = compact && activities.length > 2 && !expanded;
  const canCollapse = compact && expanded && activities.length > 2;

  return (
    <div className="space-y-1">
      {visibleActivities.map((activity) => {
        const Icon = iconMap[activity.type || 'execute'] || Play;
        const relativeTime = formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true });

        return (
          <button
            key={activity.id}
            type="button"
            onClick={() => onActivityClick?.(activity.id)}
            className="w-full flex items-center gap-2 text-left text-sm text-muted-foreground hover:text-foreground transition-colors p-1 rounded hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <Icon className="w-3 h-3 flex-shrink-0" />
            <span className="truncate flex-1">{activity.description}</span>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {activity.agent} • {relativeTime}
            </span>
          </button>
        );
      })}
      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <ChevronDown className="w-3 h-3" />
          Show more ({activities.length - 2} more)
        </button>
      )}
      {canCollapse && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <ChevronUp className="w-3 h-3" />
          Show less
        </button>
      )}
    </div>
  );
}
