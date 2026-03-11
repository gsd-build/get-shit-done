import { describe, it, expect, beforeEach } from 'vitest';
import { useProjectStore } from './projectStore';

describe('projectStore', () => {
  beforeEach(() => {
    useProjectStore.getState().reset();
  });

  it('starts with empty projects array', () => {
    const { projects } = useProjectStore.getState();
    expect(projects).toEqual([]);
  });

  it('starts with isLoading false', () => {
    const { isLoading } = useProjectStore.getState();
    expect(isLoading).toBe(false);
  });

  it('setProjects updates projects array', () => {
    const mockProject = {
      id: '1',
      name: 'Test',
      status: 'active' as const,
      health: { status: 'healthy' as const, issues: [] },
      progress: {
        percentage: 50,
        completedPhases: 1,
        totalPhases: 2,
        completedPlans: 3,
        totalPlans: 6,
      },
      currentPhase: 'Phase 1',
      path: '/test',
    };
    useProjectStore.getState().setProjects([mockProject]);
    const { projects } = useProjectStore.getState();
    expect(projects).toHaveLength(1);
    expect(projects[0]?.name).toBe('Test');
  });

  it('setLoading updates isLoading state', () => {
    useProjectStore.getState().setLoading(true);
    expect(useProjectStore.getState().isLoading).toBe(true);
  });

  it('setError updates error state', () => {
    useProjectStore.getState().setError('Failed to load');
    expect(useProjectStore.getState().error).toBe('Failed to load');
  });
});
