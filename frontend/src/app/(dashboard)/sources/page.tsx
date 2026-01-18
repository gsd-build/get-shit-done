import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { SourceList } from '@/components/features/sources/source-list';

export default function SourcesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Data Sources</h2>
          <p className="text-muted-foreground">
            Manage your connected data sources for profiling
          </p>
        </div>
        <Link href="/sources/new">
          <Button>Add Source</Button>
        </Link>
      </div>

      <SourceList />
    </div>
  );
}
