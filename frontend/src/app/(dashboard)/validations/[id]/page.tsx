'use client';

import { use } from 'react';
import Link from 'next/link';
import { useValidation, useValidationPolling } from '@/hooks/use-validations';
import { Button } from '@/components/ui/button';
import { ValidationResults } from '@/components/features/validations/validation-results';

interface ValidationDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function ValidationDetailPage({ params }: ValidationDetailPageProps) {
  const { id } = use(params);

  // Use polling hook which automatically polls when status is pending/running
  const { data, isLoading, error } = useValidationPolling(id, true);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading validation details...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-destructive mb-4">
          {error ? `Error: ${error.message}` : 'Validation not found'}
        </p>
        <Link href="/validations">
          <Button variant="outline">Back to Validations</Button>
        </Link>
      </div>
    );
  }

  // Dataset info
  const datasetLabel = data.datasets
    ? `${data.datasets.database_name}.${data.datasets.table_name}`
    : data.dataset_id.slice(0, 8);

  // Show loading state for running validations
  if (data.status === 'pending' || data.status === 'running') {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Link href="/validations" className="hover:underline">
                Validations
              </Link>
              <span>/</span>
              <span>Run #{id.slice(0, 8)}</span>
            </div>
            <h2 className="text-3xl font-bold tracking-tight">Validation Details</h2>
            <p className="text-muted-foreground">
              Validating {datasetLabel}
            </p>
          </div>
          <Link href="/validations">
            <Button variant="outline">Back to Validations</Button>
          </Link>
        </div>

        {/* Loading indicator */}
        <div className="flex flex-col items-center justify-center py-16">
          <div className="animate-pulse flex flex-col items-center">
            <div className="w-16 h-16 rounded-full border-4 border-primary border-t-transparent animate-spin mb-6" />
            <p className="text-xl font-medium">
              {data.status === 'pending' ? 'Waiting to start...' : 'Validation in progress...'}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              This page will automatically update when complete.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show error state for failed validations
  if (data.status === 'failed') {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Link href="/validations" className="hover:underline">
                Validations
              </Link>
              <span>/</span>
              <span>Run #{id.slice(0, 8)}</span>
            </div>
            <h2 className="text-3xl font-bold tracking-tight">Validation Details</h2>
            <p className="text-muted-foreground">{datasetLabel}</p>
          </div>
          <Link href="/validations">
            <Button variant="outline">Back to Validations</Button>
          </Link>
        </div>

        {/* Failed state */}
        <div className="flex flex-col items-center justify-center py-16 bg-red-50 rounded-lg border border-red-200">
          <p className="text-xl font-medium text-red-800 mb-2">Validation Failed</p>
          <p className="text-sm text-red-600">
            The validation run encountered an error and could not complete.
          </p>
        </div>
      </div>
    );
  }

  // Show completed results
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Link href="/validations" className="hover:underline">
              Validations
            </Link>
            <span>/</span>
            <span>Run #{id.slice(0, 8)}</span>
          </div>
          <h2 className="text-3xl font-bold tracking-tight">Validation Details</h2>
          <p className="text-muted-foreground">{datasetLabel}</p>
        </div>
        <Link href="/validations">
          <Button variant="outline">Back to Validations</Button>
        </Link>
      </div>

      {/* Results */}
      <ValidationResults validation={data} />
    </div>
  );
}
