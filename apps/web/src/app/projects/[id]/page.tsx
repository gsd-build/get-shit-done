'use client';

import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params['id'] as string;

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </button>

        <h1 className="text-3xl font-bold text-foreground mb-4">Project Detail</h1>
        <p className="text-muted-foreground mb-8">Project ID: {projectId}</p>

        <div className="bg-card border border-border rounded-lg p-8 text-center">
          <p className="text-muted-foreground">
            Project detail view will be implemented in Phase 16 (Discuss UI) and Phase 17 (Execute UI).
          </p>
        </div>
      </div>
    </main>
  );
}
