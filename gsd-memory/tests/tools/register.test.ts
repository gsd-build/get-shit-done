import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { register, status, unregister } from '../../src/tools/register.js';
import * as registryModule from '../../src/registry.js';
import { qmd } from '../../src/qmd.js';
import { getMockPlanningPath, getFixturePath } from '../setup.js';
import { join, dirname } from 'path';

describe('register tool', () => {
  const fixturesDir = dirname(getFixturePath('sample-project.md'));
  const mockProjectDir = join(fixturesDir, 'mock-project'); // Has .planning subdirectory

  beforeEach(() => {
    // Mock QMD as unavailable for consistent tests
    vi.spyOn(qmd, 'isAvailable').mockResolvedValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('registers project in registry', async () => {
    const mockRegister = vi.spyOn(registryModule, 'registerProject').mockReturnValue({
      name: 'test-project',
      path: mockProjectDir,
      registeredAt: new Date().toISOString()
    });

    const result = await register({
      path: mockProjectDir,
      name: 'test-project'
    });

    expect(result.success).toBe(true);
    expect(result.project?.name).toBe('test-project');
    expect(mockRegister).toHaveBeenCalled();
  });

  it('fails for non-existent path', async () => {
    const result = await register({
      path: '/nonexistent/path',
      name: 'test-project'
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('does not exist');
  });

  it('fails for path without .planning directory', async () => {
    // Use fixtures directory which has no .planning at root level
    const result = await register({
      path: fixturesDir,
      name: 'test-project'
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('.planning');
  });

  it('creates QMD collection if QMD available', async () => {
    vi.spyOn(qmd, 'isAvailable').mockResolvedValue(true);
    const mockCreateCollection = vi.spyOn(qmd, 'createCollection').mockResolvedValue({
      success: true
    });

    vi.spyOn(registryModule, 'registerProject').mockReturnValue({
      name: 'test-project',
      path: mockProjectDir,
      qmdCollection: 'gsd-test-project',
      registeredAt: new Date().toISOString()
    });

    const result = await register({
      path: mockProjectDir,
      name: 'test-project'
    });

    expect(result.success).toBe(true);
    expect(mockCreateCollection).toHaveBeenCalled();
  });
});

describe('status tool', () => {
  beforeEach(() => {
    vi.spyOn(qmd, 'isAvailable').mockResolvedValue(false);
    vi.spyOn(registryModule, 'getAllProjects').mockReturnValue([
      {
        name: 'project-1',
        path: '/path/to/project1',
        registeredAt: '2025-01-15T00:00:00Z'
      }
    ]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns QMD availability and project list', async () => {
    const result = await status();

    expect(result).toHaveProperty('qmdAvailable');
    expect(result).toHaveProperty('projects');
    expect(Array.isArray(result.projects)).toBe(true);
  });

  it('includes project details', async () => {
    const result = await status();

    expect(result.projects.length).toBe(1);
    expect(result.projects[0].name).toBe('project-1');
    expect(result.projects[0].path).toBe('/path/to/project1');
  });
});

describe('unregister tool', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('removes project from registry', async () => {
    vi.spyOn(registryModule, 'getProject').mockReturnValue({
      name: 'test-project',
      path: '/path/to/project',
      registeredAt: '2025-01-15T00:00:00Z'
    });
    const mockUnregister = vi.spyOn(registryModule, 'unregisterProject').mockReturnValue(true);

    const result = await unregister('test-project');

    expect(result.success).toBe(true);
    expect(mockUnregister).toHaveBeenCalledWith('test-project');
  });

  it('returns error for non-existent project', async () => {
    vi.spyOn(registryModule, 'getProject').mockReturnValue(undefined);

    const result = await unregister('non-existent');

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });
});
