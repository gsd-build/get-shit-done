'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSources, useDeleteSource } from '@/hooks/use-sources';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';

export function SourceList() {
  const { data: sources, isLoading, error } = useSources();
  const deleteSource = useDeleteSource();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) {
      return;
    }

    setDeletingId(id);
    try {
      await deleteSource.mutateAsync(id);
    } catch (err) {
      console.error('Failed to delete source:', err);
      alert('Failed to delete source. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-muted-foreground">Loading sources...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-destructive">Error loading sources: {error.message}</p>
      </div>
    );
  }

  if (!sources || sources.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-muted-foreground mb-4">No data sources connected yet.</p>
        <Link href="/sources/new">
          <Button>Add Your First Source</Button>
        </Link>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getSourceTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      iceberg: 'Apache Iceberg',
      redshift: 'Amazon Redshift',
      athena: 'Amazon Athena',
    };
    return labels[type] || type;
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Created</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sources.map((source) => (
          <TableRow key={source.id} className="cursor-pointer">
            <TableCell>
              <Link
                href={`/sources/${source.id}`}
                className="font-medium hover:underline"
              >
                {source.name}
              </Link>
            </TableCell>
            <TableCell>
              <span className="inline-flex items-center rounded-md bg-secondary px-2 py-1 text-xs font-medium">
                {getSourceTypeLabel(source.source_type)}
              </span>
            </TableCell>
            <TableCell className="text-muted-foreground">
              {formatDate(source.created_at)}
            </TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-2">
                <Link href={`/sources/${source.id}`}>
                  <Button variant="outline" size="sm">
                    View
                  </Button>
                </Link>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDelete(source.id, source.name)}
                  disabled={deletingId === source.id}
                >
                  {deletingId === source.id ? 'Deleting...' : 'Delete'}
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
