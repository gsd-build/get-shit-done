'use client';

import { ArrowLeft, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface WorkflowHeaderProps {
  projectId: string;
  title: string;
  subtitle?: string;
  onNewPlan: () => void;
}

export function WorkflowHeader({
  projectId,
  title,
  subtitle,
  onNewPlan,
}: WorkflowHeaderProps) {
  const router = useRouter();

  return (
    <div className="flex items-center justify-between gap-4 mb-6">
      <div>
        <button
          type="button"
          onClick={() => router.push(`/projects/${projectId}`)}
          className="inline-flex items-center gap-2 min-h-11 px-3 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 mb-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Project
        </button>
        <h1 className="text-3xl font-bold text-foreground">{title}</h1>
        {subtitle && <p className="text-muted-foreground mt-1">{subtitle}</p>}
      </div>

      <button
        type="button"
        onClick={onNewPlan}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md transition-colors"
      >
        <Plus className="w-4 h-4" />
        New Plan
      </button>
    </div>
  );
}

