'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Project detail page - redirects to discuss workflow.
 *
 * In the GSD workflow, clicking a project takes you to the discuss phase
 * where you gather context through conversation with Claude.
 */
export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params['id'] as string;

  useEffect(() => {
    // Redirect to discuss page - the primary workflow entry point
    router.replace(`/projects/${projectId}/discuss`);
  }, [projectId, router]);

  // Show loading state during redirect
  return (
    <main className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
        <p className="text-muted-foreground">Loading project...</p>
      </div>
    </main>
  );
}
