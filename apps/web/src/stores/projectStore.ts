import { create } from 'zustand';
import type { Project } from '@/types';

interface ProjectStore {
  projects: Project[];
  isLoading: boolean;
  error: string | null;
  setProjects: (projects: Project[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState = {
  projects: [] as Project[],
  isLoading: false,
  error: null as string | null,
};

export const useProjectStore = create<ProjectStore>((set) => ({
  ...initialState,
  setProjects: (projects) => set({ projects }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  reset: () => set(initialState),
}));

// Selectors for optimized re-renders
export const selectProjects = (state: ProjectStore) => state.projects;
export const selectIsLoading = (state: ProjectStore) => state.isLoading;
export const selectError = (state: ProjectStore) => state.error;
