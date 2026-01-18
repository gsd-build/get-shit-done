'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { RuleGenerator } from '@/components/features/rules/rule-generator';
import { TemplatePicker } from '@/components/features/rules/template-picker';
import { RuleForm } from '@/components/features/rules/rule-form';
import { cn } from '@/lib/utils';

type Mode = 'ai' | 'template' | 'manual';

function NewRulePageContent() {
  const searchParams = useSearchParams();
  const initialMode = (searchParams.get('mode') as Mode) || 'ai';

  const [mode, setMode] = useState<Mode>(initialMode);

  const modeLabels: Record<Mode, { label: string; description: string }> = {
    ai: {
      label: 'AI Generator',
      description: 'Describe your rule in plain English',
    },
    template: {
      label: 'From Template',
      description: 'Choose from industry-standard templates',
    },
    manual: {
      label: 'Manual',
      description: 'Write DQDL expression directly',
    },
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center space-x-2 text-sm text-muted-foreground">
        <Link href="/rules" className="hover:text-foreground">
          Rules
        </Link>
        <span>/</span>
        <span className="text-foreground">Create New Rule</span>
      </nav>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Create New Rule</h1>
        <p className="text-muted-foreground">
          Choose how you want to create your data quality rule
        </p>
      </div>

      {/* Mode Selector */}
      <div className="flex gap-2">
        {(['ai', 'template', 'manual'] as Mode[]).map((m) => (
          <Button
            key={m}
            variant={mode === m ? 'default' : 'outline'}
            onClick={() => setMode(m)}
            className={cn(
              'flex-1',
              mode === m && m === 'ai' && 'bg-purple-600 hover:bg-purple-700'
            )}
          >
            <div className="text-left">
              <div className="font-medium">{modeLabels[m].label}</div>
              <div className="text-xs opacity-80">{modeLabels[m].description}</div>
            </div>
          </Button>
        ))}
      </div>

      {/* Back Button */}
      <div>
        <Link href="/rules">
          <Button variant="ghost" size="sm">
            <svg
              className="mr-2 h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            Back to Rules
          </Button>
        </Link>
      </div>

      {/* Content based on mode */}
      {mode === 'ai' && <RuleGenerator />}
      {mode === 'template' && <TemplatePicker />}
      {mode === 'manual' && <RuleForm />}
    </div>
  );
}

export default function NewRulePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-8">Loading...</div>}>
      <NewRulePageContent />
    </Suspense>
  );
}
