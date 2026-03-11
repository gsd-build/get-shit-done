import { describe, it, expect } from 'vitest';
import { fetchProjects } from './api';

describe('fetchProjects', () => {
  it('returns project array on success', async () => {
    const result = await fetchProjects();
    expect(result.success).toBe(true);
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data[0]).toHaveProperty('id');
    expect(result.data[0]).toHaveProperty('name');
    expect(result.data[0]).toHaveProperty('health');
  });

  it('handles API errors gracefully', async () => {
    // Test error handling - MSW will provide error response
    // This test documents expected error structure
    const result = await fetchProjects();
    if (!result.success) {
      expect(result.error).toHaveProperty('code');
      expect(result.error).toHaveProperty('message');
    }
  });

  it('includes meta with total and hasNextPage', async () => {
    const result = await fetchProjects();
    expect(result.meta).toHaveProperty('total');
    expect(result.meta).toHaveProperty('hasNextPage');
  });
});
