/**
 * Bug #3589 (security): SDK `planningPaths(projectDir, workstream)` and
 * `relPlanningPath(workstream)` accepted unvalidated explicit workstream
 * names from direct SDK callers. Path-traversal segments (`..`, `/`, `\\`)
 * would flow through `posix.join('.planning', 'workstreams', name)` and
 * route planning operations outside the intended `.planning/workstreams/<name>`
 * subtree.
 *
 * Env-sourced workstreams are pre-validated inside `planningPaths` and fall
 * back to root .planning/ silently (#2791 contract). Explicit SDK arguments
 * had no such gate.
 *
 * Fix: validate inside `relPlanningPath` so every caller — direct SDK use,
 * `planningPaths`, `ContextEngine` — is protected at the same seam.
 * Explicit invalid names throw; env-sourced ones still silently fall back
 * because `planningPaths` filters them to `null` before calling
 * `relPlanningPath`.
 */

import { describe, it, expect } from 'vitest';
import { relPlanningPath } from './workstream-utils.js';
import { planningPaths } from './query/helpers.js';

// Empty string is treated as "no workstream provided" (returns `.planning`)
// for back-compat with pre-fix behaviour; only non-empty invalid names throw.
const TRAVERSAL_CASES = [
  '../../../outside',
  '../escape',
  '..',
  'foo/bar',
  'foo\\bar',
  'foo bar',
  '.hidden',
  '/abs',
  '-leading-hyphen',
];

describe('bug #3589: relPlanningPath rejects path-traversal and invalid workstream names', () => {
  it('returns .planning when workstream is omitted (unchanged)', () => {
    expect(relPlanningPath()).toBe('.planning');
    expect(relPlanningPath(undefined)).toBe('.planning');
    expect(relPlanningPath('')).toBe('.planning');
  });

  it('returns .planning/workstreams/<name> for valid workstream names (unchanged)', () => {
    expect(relPlanningPath('frontend')).toBe('.planning/workstreams/frontend');
    expect(relPlanningPath('api_v2')).toBe('.planning/workstreams/api_v2');
    expect(relPlanningPath('alpha.beta-1')).toBe('.planning/workstreams/alpha.beta-1');
  });

  for (const bad of TRAVERSAL_CASES) {
    it(`throws for invalid workstream name ${JSON.stringify(bad)}`, () => {
      expect(() => relPlanningPath(bad)).toThrow(/workstream/i);
    });
  }

  it('throws BEFORE constructing the path (no partial side effect)', () => {
    let resultPath: string | null = null;
    try {
      resultPath = relPlanningPath('../../../outside');
    } catch {
      /* expected */
    }
    expect(resultPath).toBeNull();
  });
});

describe('bug #3589: planningPaths rejects explicit invalid workstream names', () => {
  it('throws for explicit ../../../outside (was silently constructing a traversal path)', () => {
    expect(() => planningPaths('/tmp/projectDir', '../../../outside')).toThrow(/workstream/i);
  });

  it('throws for explicit slash-bearing names', () => {
    expect(() => planningPaths('/tmp/projectDir', 'foo/bar')).toThrow(/workstream/i);
  });

  it('accepts valid explicit names and constructs the expected planning subtree', () => {
    const paths = planningPaths('/tmp/projectDir', 'frontend');
    expect(paths.planning.endsWith('.planning/workstreams/frontend')).toBe(true);
    expect(paths.state.endsWith('.planning/workstreams/frontend/STATE.md')).toBe(true);
    expect(paths.roadmap.endsWith('.planning/workstreams/frontend/ROADMAP.md')).toBe(true);
  });

  it('still returns root .planning when workstream is omitted', () => {
    const paths = planningPaths('/tmp/projectDir');
    expect(paths.planning.endsWith('.planning')).toBe(true);
    expect(paths.planning).not.toContain('workstreams');
  });
});
