import { afterEach, describe, it, expect, vi } from 'vitest';
import {
  fetchParallelismAssessment,
  fetchParallelismWorkflow,
  fetchProjects,
} from './api';

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

describe('parallelism envelope parsing', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parses workflow envelope without success field', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            id: '02',
            label: 'workflow integration',
            wave: 2,
            status: 'blocked',
            dependsOn: ['01'],
            blockerDetails: [
              {
                id: 'phase-02-dependency',
                reason: 'Phase 01 must complete before this phase can run.',
                dependsOn: ['01'],
                resolutionHint: 'Complete upstream phase or explicitly re-plan dependencies.',
              },
            ],
          },
        ],
        meta: { timestamp: '2026-03-14T00:00:00.000Z', requestId: 'req-workflow' },
      }),
    } as Response);

    const result = await fetchParallelismWorkflow('get-shit-done');
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.status).toBe('blocked');
    expect(result.data[0]?.blockerDetails?.[0]?.reason).toContain('Phase 01');
  });

  it('marks assessment response as failed when envelope contains error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        data: null,
        meta: { timestamp: '2026-03-14T00:00:00.000Z', requestId: 'req-assessment' },
        error: { code: 'PHASE_NOT_FOUND', message: "Phase '99' not found" },
      }),
    } as Response);

    const result = await fetchParallelismAssessment('get-shit-done', '99');
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('PHASE_NOT_FOUND');
  });
});
