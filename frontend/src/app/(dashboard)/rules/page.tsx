'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RuleList } from '@/components/features/rules/rule-list';
import { useRules, usePendingRules } from '@/hooks/use-rules';
import { cn } from '@/lib/utils';

function RulesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') || 'all';

  const [activeTab, setActiveTab] = useState<'all' | 'pending'>(
    initialTab === 'pending' ? 'pending' : 'all'
  );
  const [showCreateMenu, setShowCreateMenu] = useState(false);

  const { data: allRules } = useRules();
  const { data: pendingData } = usePendingRules();

  // Calculate stats
  const totalRules = allRules?.length || 0;
  const activeRules = allRules?.filter((r) => r.status === 'active').length || 0;
  const pendingCount = pendingData?.count || 0;
  const criticalRules = allRules?.filter((r) => r.severity === 'critical').length || 0;

  const handleCreateOption = (mode: 'ai' | 'template' | 'manual') => {
    setShowCreateMenu(false);
    router.push(`/rules/new?mode=${mode}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Quality Rules</h1>
          <p className="text-muted-foreground">
            Manage data quality rules and approval workflows
          </p>
        </div>
        <div className="relative">
          <Button onClick={() => setShowCreateMenu(!showCreateMenu)}>
            Create Rule
            <svg
              className={cn('ml-2 h-4 w-4 transition-transform', showCreateMenu && 'rotate-180')}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </Button>
          {showCreateMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowCreateMenu(false)}
              />
              <div className="absolute right-0 z-20 mt-2 w-48 rounded-md border bg-background shadow-lg">
                <div className="py-1">
                  <button
                    className="flex w-full items-center px-4 py-2 text-sm hover:bg-muted"
                    onClick={() => handleCreateOption('ai')}
                  >
                    <span className="mr-2 text-purple-600">AI</span>
                    AI Generator
                  </button>
                  <button
                    className="flex w-full items-center px-4 py-2 text-sm hover:bg-muted"
                    onClick={() => handleCreateOption('template')}
                  >
                    <span className="mr-2 text-blue-600">T</span>
                    From Template
                  </button>
                  <button
                    className="flex w-full items-center px-4 py-2 text-sm hover:bg-muted"
                    onClick={() => handleCreateOption('manual')}
                  >
                    <span className="mr-2 text-gray-600">M</span>
                    Manual
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Rules
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalRules}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Rules
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{activeRules}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending Approval
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-yellow-600">{pendingCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Critical Rules
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">{criticalRules}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <nav className="-mb-px flex space-x-8">
          <button
            className={cn(
              'border-b-2 px-1 pb-4 text-sm font-medium',
              activeTab === 'all'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:border-gray-300 hover:text-foreground'
            )}
            onClick={() => setActiveTab('all')}
          >
            All Rules
          </button>
          <button
            className={cn(
              'flex items-center border-b-2 px-1 pb-4 text-sm font-medium',
              activeTab === 'pending'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:border-gray-300 hover:text-foreground'
            )}
            onClick={() => setActiveTab('pending')}
          >
            Pending Approval
            {pendingCount > 0 && (
              <span className="ml-2 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
                {pendingCount}
              </span>
            )}
          </button>
        </nav>
      </div>

      {/* Content */}
      {activeTab === 'all' ? (
        <RuleList showFilters />
      ) : (
        <RuleList showFilters={false} initialFilters={{ status: 'pending' }} />
      )}
    </div>
  );
}

export default function RulesPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-8">Loading...</div>}>
      <RulesPageContent />
    </Suspense>
  );
}
