'use client';

import { useRouter } from 'next/navigation';
import { useProjects } from '@/hooks/useProjects';
import { SearchBar, FilterBar, ProjectGrid } from '@/components/features/dashboard';

export default function DashboardPage() {
  const router = useRouter();
  const { projects, isLoading, error, refetch } = useProjects();

  const handleNavigate = (projectId: string) => {
    router.push(`/projects/${projectId}`);
  };

  const handleActivityClick = (activityId: string) => {
    // TODO: Navigate to execution detail when implemented in Phase 17
    console.log('Activity clicked:', activityId);
  };

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">GSD Dashboard</h1>
          <p className="text-muted-foreground">Manage your projects</p>
        </header>

        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1">
            <SearchBar />
          </div>
          <FilterBar />
        </div>

        {error && (
          <div className="bg-error/10 border border-error text-error px-4 py-3 rounded-lg mb-6">
            <p>Error: {error}</p>
            <button
              type="button"
              onClick={() => refetch()}
              className="text-sm underline mt-1"
            >
              Retry
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading projects...</p>
          </div>
        ) : (
          <ProjectGrid
            projects={projects}
            onNavigate={handleNavigate}
            onActivityClick={handleActivityClick}
          />
        )}
      </div>
    </main>
  );
}
