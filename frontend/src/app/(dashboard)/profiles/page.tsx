'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useProfiles } from '@/hooks/use-profiles';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useState } from 'react';

type StatusFilter = 'all' | 'pending' | 'running' | 'completed' | 'failed';

function ProfilesPageContent() {
  const searchParams = useSearchParams();
  const datasetId = searchParams.get('dataset') || undefined;
  const { data: profiles, isLoading, error } = useProfiles(datasetId);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const filteredProfiles =
    statusFilter === 'all'
      ? profiles
      : profiles?.filter((p) => p.status === statusFilter);

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      running: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
    };

    return (
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-800'}`}
      >
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading profiles...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-destructive">Error loading profiles: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Profile Runs</h2>
          <p className="text-muted-foreground">
            {datasetId
              ? 'Viewing profiles for selected dataset'
              : 'Recent data profiling results across all datasets'}
          </p>
        </div>
        {datasetId && (
          <Link href="/profiles">
            <Button variant="outline">View All Profiles</Button>
          </Link>
        )}
      </div>

      {/* Status filter */}
      <div className="flex flex-wrap gap-2">
        {(['all', 'completed', 'running', 'pending', 'failed'] as StatusFilter[]).map(
          (status) => (
            <Button
              key={status}
              variant={statusFilter === status ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter(status)}
            >
              {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
            </Button>
          )
        )}
      </div>

      {!filteredProfiles || filteredProfiles.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">
              {statusFilter === 'all'
                ? 'No profile runs yet. Run a profile from a data source to get started.'
                : `No ${statusFilter} profiles found.`}
            </p>
            <Link href="/sources">
              <Button variant="outline">Go to Sources</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Dataset</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Started</TableHead>
              <TableHead>Completed</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProfiles.map((profile) => (
              <TableRow key={profile.id}>
                <TableCell className="font-medium">
                  {profile.datasets
                    ? `${profile.datasets.database_name}.${profile.datasets.table_name}`
                    : '-'}
                </TableCell>
                <TableCell>{getStatusBadge(profile.status)}</TableCell>
                <TableCell className="text-muted-foreground">
                  {profile.started_at ? formatDate(profile.started_at) : '-'}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {profile.completed_at ? formatDate(profile.completed_at) : '-'}
                </TableCell>
                <TableCell className="text-right">
                  <Link href={`/profiles/${profile.id}`}>
                    <Button variant="outline" size="sm">
                      View Details
                    </Button>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

export default function ProfilesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Loading profiles...</p>
        </div>
      }
    >
      <ProfilesPageContent />
    </Suspense>
  );
}
