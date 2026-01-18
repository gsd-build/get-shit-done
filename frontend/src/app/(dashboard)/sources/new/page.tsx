import { SourceForm } from '@/components/features/sources/source-form';

export default function NewSourcePage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Add Data Source</h2>
        <p className="text-muted-foreground">
          Connect a new data source for profiling and analysis
        </p>
      </div>

      <SourceForm />
    </div>
  );
}
