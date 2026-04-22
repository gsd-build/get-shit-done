/**
 * Unit tests for workspace-aware state resolution.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { resolveWorkspaceContext, workspacePlanningPaths } from './workspace.js';

// ─── resolveWorkspaceContext ───────────────────────────────────────────────

describe('resolveWorkspaceContext', () => {
  afterEach(() => {
    delete process.env['GSD_WORKSTREAM'];
    delete process.env['GSD_PROJECT'];
  });

  it('returns null values when env vars not set', () => {
    delete process.env['GSD_WORKSTREAM'];
    delete process.env['GSD_PROJECT'];
    const ctx = resolveWorkspaceContext();
    expect(ctx.workstream).toBeNull();
    expect(ctx.project).toBeNull();
  });

  it('reads GSD_WORKSTREAM from env', () => {
    process.env['GSD_WORKSTREAM'] = 'backend';
    const ctx = resolveWorkspaceContext();
    expect(ctx.workstream).toBe('backend');
  });

  it('reads GSD_PROJECT from env', () => {
    process.env['GSD_PROJECT'] = 'api-server';
    const ctx = resolveWorkspaceContext();
    expect(ctx.project).toBe('api-server');
  });

  it('reads both vars when both are set', () => {
    process.env['GSD_WORKSTREAM'] = 'ws1';
    process.env['GSD_PROJECT'] = 'proj1';
    const ctx = resolveWorkspaceContext();
    expect(ctx.workstream).toBe('ws1');
    expect(ctx.project).toBe('proj1');
  });
});

// ─── workspacePlanningPaths ────────────────────────────────────────────────

describe('workspacePlanningPaths', () => {
  const projectDir = '/my/project';

  it('returns default .planning/ when no context provided', () => {
    const paths = workspacePlanningPaths(projectDir);
    expect(paths.planning).toContain('.planning');
    expect(paths.planning).not.toContain('workstreams');
    expect(paths.planning).not.toContain('projects');
    expect(paths.state).toContain('STATE.md');
    expect(paths.phases).toContain('phases');
  });

  it('returns default .planning/ when context has no workspace or project', () => {
    const paths = workspacePlanningPaths(projectDir, { workstream: null, project: null });
    expect(paths.planning).not.toContain('workstreams');
    expect(paths.planning).not.toContain('projects');
  });

  it('scopes to .planning/workstreams/<ws> when workstream set', () => {
    const paths = workspacePlanningPaths(projectDir, { workstream: 'backend', project: null });
    expect(paths.planning).toContain('workstreams/backend');
    expect(paths.state).toContain('workstreams/backend/STATE.md');
    expect(paths.phases).toContain('workstreams/backend/phases');
  });

  it('scopes to .planning/projects/<project> when project set', () => {
    const paths = workspacePlanningPaths(projectDir, { workstream: null, project: 'api-server' });
    expect(paths.planning).toContain('projects/api-server');
    expect(paths.state).toContain('projects/api-server/STATE.md');
  });

  it('workstream takes precedence over project when both set', () => {
    const paths = workspacePlanningPaths(projectDir, { workstream: 'ws1', project: 'proj1' });
    expect(paths.planning).toContain('workstreams/ws1');
    expect(paths.planning).not.toContain('projects');
  });

  it('throws on empty workstream name', () => {
    expect(() => workspacePlanningPaths(projectDir, { workstream: '', project: null }))
      .toThrow('empty');
  });

  it('throws on workstream name containing forward slash', () => {
    expect(() => workspacePlanningPaths(projectDir, { workstream: 'ws/bad', project: null }))
      .toThrow('path separators');
  });

  it('throws on workstream name containing backslash', () => {
    expect(() => workspacePlanningPaths(projectDir, { workstream: 'ws\\bad', project: null }))
      .toThrow('path separators');
  });

  it('throws on workstream name containing ".."', () => {
    expect(() => workspacePlanningPaths(projectDir, { workstream: '../escape', project: null }))
      .toThrow('..');
  });

  it('throws on project name containing path separators', () => {
    expect(() => workspacePlanningPaths(projectDir, { workstream: null, project: '../../bad' }))
      .toThrow('path separators');
  });

  it('all path fields are defined', () => {
    const paths = workspacePlanningPaths(projectDir, { workstream: 'ws1', project: null });
    expect(paths.planning).toBeDefined();
    expect(paths.state).toBeDefined();
    expect(paths.roadmap).toBeDefined();
    expect(paths.project).toBeDefined();
    expect(paths.config).toBeDefined();
    expect(paths.phases).toBeDefined();
    expect(paths.requirements).toBeDefined();
  });
});
