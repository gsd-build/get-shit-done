import { describe, it, expect } from 'vitest';
import { extractProject, type ProjectData } from '../../src/extractors/project.js';
import { readFixture } from '../setup.js';

describe('project extractor', () => {
  it('extracts project name from title', () => {
    const project = readFixture('sample-project.md');
    const result = extractProject(project);

    expect(result.name).toBe('TaskFlow');
  });

  it('extracts what this is description', () => {
    const project = readFixture('sample-project.md');
    const result = extractProject(project);

    expect(result.description).toContain('task management');
    expect(result.description).toContain('terminal');
  });

  it('extracts core value', () => {
    const project = readFixture('sample-project.md');
    const result = extractProject(project);

    expect(result.coreValue).toContain('Fast task capture');
  });

  it('extracts validated requirements', () => {
    const project = readFixture('sample-project.md');
    const result = extractProject(project);

    expect(result.requirements.validated.length).toBeGreaterThan(0);
    expect(result.requirements.validated[0]).toContain('CLI task creation');
  });

  it('extracts active requirements', () => {
    const project = readFixture('sample-project.md');
    const result = extractProject(project);

    expect(result.requirements.active.length).toBeGreaterThan(0);
    expect(result.requirements.active).toContainEqual(
      expect.stringContaining('dashboard')
    );
  });

  it('extracts out of scope items', () => {
    const project = readFixture('sample-project.md');
    const result = extractProject(project);

    expect(result.requirements.outOfScope.length).toBeGreaterThan(0);
    expect(result.requirements.outOfScope[0]).toHaveProperty('item');
    expect(result.requirements.outOfScope[0]).toHaveProperty('reason');
  });

  it('extracts constraints', () => {
    const project = readFixture('sample-project.md');
    const result = extractProject(project);

    expect(result.constraints.length).toBeGreaterThan(0);
    expect(result.constraints[0]).toHaveProperty('type');
    expect(result.constraints[0]).toHaveProperty('value');
  });

  it('extracts key decisions table', () => {
    const project = readFixture('sample-project.md');
    const result = extractProject(project);

    expect(result.decisions.length).toBeGreaterThan(0);
    expect(result.decisions[0]).toHaveProperty('decision');
    expect(result.decisions[0]).toHaveProperty('rationale');
    expect(result.decisions[0]).toHaveProperty('outcome');
  });

  it('extracts context section', () => {
    const project = readFixture('sample-project.md');
    const result = extractProject(project);

    expect(result.context).toBeDefined();
    expect(result.context).toContain('developers');
  });

  it('handles project without optional sections', () => {
    const minimalProject = `# MinimalProject

## What This Is

A minimal test project.

## Core Value

Test core value.

## Requirements

### Active

- [ ] One feature
`;

    const result = extractProject(minimalProject);

    expect(result.name).toBe('MinimalProject');
    expect(result.description).toContain('minimal');
    expect(result.coreValue).toContain('Test core value');
    expect(result.requirements.active).toHaveLength(1);
    expect(result.requirements.validated).toEqual([]);
    expect(result.decisions).toEqual([]);
  });
});
