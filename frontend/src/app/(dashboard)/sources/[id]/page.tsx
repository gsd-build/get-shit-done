'use client';

import { use } from 'react';
import Link from 'next/link';
import { useSource } from '@/hooks/use-sources';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface SourceDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function SourceDetailPage({ params }: SourceDetailPageProps) {
  const { id } = use(params);
  const { data, isLoading, error } = useSource(id);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading source details...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-destructive mb-4">
          {error ? `Error: ${error.message}` : 'Source not found'}
        </p>
        <Link href="/sources">
          <Button variant="outline">Back to Sources</Button>
        </Link>
      </div>
    );
  }

  const { source, datasets } = data;

  const getSourceTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      iceberg: 'Apache Iceberg',
      redshift: 'Amazon Redshift',
      athena: 'Amazon Athena',
    };
    return labels[type] || type;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const config = source.connection_config as Record<string, string>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{source.name}</h2>
          <p className="text-muted-foreground">
            {getSourceTypeLabel(source.source_type)} data source
          </p>
        </div>
        <Link href="/sources">
          <Button variant="outline">Back to Sources</Button>
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Connection Details</CardTitle>
            <CardDescription>
              Configuration for this data source connection
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Type</dt>
                <dd className="text-sm">{getSourceTypeLabel(source.source_type)}</dd>
              </div>
              {config.region && (
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Region</dt>
                  <dd className="text-sm">{config.region}</dd>
                </div>
              )}
              {config.catalog_name && (
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">
                    Catalog Name
                  </dt>
                  <dd className="text-sm">{config.catalog_name}</dd>
                </div>
              )}
              {config.workgroup && (
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">
                    Workgroup
                  </dt>
                  <dd className="text-sm">{config.workgroup}</dd>
                </div>
              )}
              {config.output_location && (
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">
                    Output Location
                  </dt>
                  <dd className="text-sm font-mono text-xs break-all">
                    {config.output_location}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-sm font-medium text-muted-foreground">
                  Created
                </dt>
                <dd className="text-sm">{formatDate(source.created_at)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Datasets</CardTitle>
            <CardDescription>
              Tables registered from this data source
            </CardDescription>
          </CardHeader>
          <CardContent>
            {datasets.length === 0 ? (
              <p className="text-sm text-muted-foreground">No datasets registered yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Database</TableHead>
                    <TableHead>Table</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {datasets.map((dataset) => (
                    <TableRow key={dataset.id}>
                      <TableCell className="font-medium">
                        {dataset.database_name}
                      </TableCell>
                      <TableCell>{dataset.table_name}</TableCell>
                      <TableCell className="text-right">
                        <Link href={`/profiles?dataset=${dataset.id}`}>
                          <Button variant="outline" size="sm">
                            View Profiles
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
