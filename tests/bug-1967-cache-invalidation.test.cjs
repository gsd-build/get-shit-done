/**
 * Regression tests for #1967 cache invalidation.
 *
 * The disk scan cache in buildStateFrontmatter must be invalidated on
 * writeStateMd to prevent stale reads if multiple state-mutating
 * operations occur within the same Node process. This matters for:
 *   - SDK callers that require() gsd-tools.cjs as a module
 *   - Future dispatcher extensions that handle compound operations
 *   - Tests that import state.cjs directly
 */

'use strict';

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const state = require('../get-shit-done/bin/lib/state.cjs');

describe('buildStateFrontmatter cache invalidation (#1967)', () => {
  let tmpDir;
  let planningDir;
  let phasesDir;
  let statePath;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-1967-cache-'));
    planningDir = path.join(tmpDir, '.planning');
    phasesDir = path.join(planningDir, 'phases');
    fs.mkdirSync(phasesDir, { recursive: true });

    // Create a minimal config and STATE.md
    fs.writeFileSync(
      path.join(planningDir, 'config.json'),
      JSON.stringify({ project_code: 'TEST' })
    );

    statePath = path.join(planningDir, 'STATE.md');
    fs.writeFileSync(statePath, [
      '# State',
      '',
      '**Current Phase:** 1',
      '**Status:** executing',
      '**Total Phases:** 2',
      '',
    ].join('\n'));

    // Start with one phase directory containing one PLAN
    const phase1 = path.join(phasesDir, '01-foo');
    fs.mkdirSync(phase1);
    fs.writeFileSync(path.join(phase1, '01-1-PLAN.md'), '---\nphase: 1\nplan: 1\n---\n# Plan\n');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('writeStateMd invalidates cache so subsequent reads see new disk state', () => {
    // First write — populates cache via buildStateFrontmatter
    const content1 = fs.readFileSync(statePath, 'utf-8');
    state.writeStateMd(statePath, content1, tmpDir);

    // Create a NEW phase directory AFTER the first write
    // Without cache invalidation, the second write would still see only 1 phase
    const phase2 = path.join(phasesDir, '02-bar');
    fs.mkdirSync(phase2);
    fs.writeFileSync(path.join(phase2, '02-1-PLAN.md'), '---\nphase: 2\nplan: 1\n---\n# Plan\n');
    fs.writeFileSync(path.join(phase2, '02-1-SUMMARY.md'), '---\nstatus: complete\n---\n# Summary\n');

    // Second write in the SAME process — must see the new phase
    const content2 = fs.readFileSync(statePath, 'utf-8');
    state.writeStateMd(statePath, content2, tmpDir);

    // Read back and parse frontmatter to verify it reflects 2 phases, not 1
    const result = fs.readFileSync(statePath, 'utf-8');
    const fmMatch = result.match(/^---\n([\s\S]*?)\n---/);
    assert.ok(fmMatch, 'STATE.md should have frontmatter after writeStateMd');

    const fm = fmMatch[1];
    // Should show 2 total phases (the new disk state), not 1 (stale cache)
    const totalPhasesMatch = fm.match(/total_phases:\s*(\d+)/);
    assert.ok(totalPhasesMatch, 'frontmatter should contain total_phases');
    assert.strictEqual(
      parseInt(totalPhasesMatch[1], 10),
      2,
      'total_phases should reflect new disk state (2), not stale cache (1)'
    );

    // Should show 1 completed phase (phase 2 has SUMMARY)
    const completedMatch = fm.match(/completed_phases:\s*(\d+)/);
    assert.ok(completedMatch, 'frontmatter should contain completed_phases');
    assert.strictEqual(
      parseInt(completedMatch[1], 10),
      1,
      'completed_phases should reflect new disk state (1 complete), not stale cache (0)'
    );
  });
});
