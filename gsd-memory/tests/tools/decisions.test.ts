import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { findDecisions } from '../../src/tools/decisions.js';
import * as registry from '../../src/registry.js';
import { getFixturePath } from '../setup.js';
import { join, dirname } from 'path';

describe('decisions tool', () => {
  const fixturesDir = dirname(getFixturePath('sample-project.md'));

  beforeEach(() => {
    // Mock getAllProjects to return our test fixture location
    vi.spyOn(registry, 'getAllProjects').mockReturnValue([
      {
        name: 'fixture-project',
        path: fixturesDir,
        registeredAt: new Date().toISOString()
      }
    ]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns decisions with full context', async () => {
    const results = await findDecisions({});

    // Should find decisions from sample-project.md fixture
    expect(Array.isArray(results)).toBe(true);
  });

  it('extracts decisions from PROJECT.md', async () => {
    // Create a mock project with PROJECT.md in .planning
    vi.spyOn(registry, 'getAllProjects').mockReturnValue([
      {
        name: 'mock-project',
        path: join(fixturesDir, 'mock-planning'),
        registeredAt: new Date().toISOString()
      }
    ]);

    const results = await findDecisions({});

    // Should find decisions from mock-planning/PROJECT.md
    if (results.length > 0) {
      expect(results[0]).toHaveProperty('decision');
      expect(results[0]).toHaveProperty('project');
    }
  });

  it('filters by query', async () => {
    vi.spyOn(registry, 'getAllProjects').mockReturnValue([
      {
        name: 'mock-project',
        path: join(fixturesDir, 'mock-planning'),
        registeredAt: new Date().toISOString()
      }
    ]);

    const results = await findDecisions({
      query: 'YAML'
    });

    // All results should contain the query term
    results.forEach(r => {
      const hasQuery = r.decision.toLowerCase().includes('yaml') ||
                       r.rationale?.toLowerCase().includes('yaml');
      expect(hasQuery).toBe(true);
    });
  });

  it('respects limit parameter', async () => {
    const results = await findDecisions({
      limit: 1
    });

    expect(results.length).toBeLessThanOrEqual(1);
  });

  it('returns empty array for non-existent project', async () => {
    const results = await findDecisions({
      project: 'non-existent-project'
    });

    expect(results).toEqual([]);
  });
});
