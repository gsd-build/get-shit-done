'use strict';

/**
 * CJS parity test — Workstream Inventory Builder generator.
 *
 * For every fixture, asserts that the compiled SDK ESM module and the
 * generated CJS artifact produce byte-identical output.
 */

const { describe, test, before } = require('node:test');
const assert = require('node:assert/strict');

// ─── Shared fixtures ──────────────────────────────────────────────────────────

function minimalInputs(overrides = {}) {
  return {
    name: 'my-ws',
    projectDir: '/project',
    workstreamDir: '/project/.planning/workstreams/my-ws',
    phaseDirNames: [],
    activeWorkstreamName: null,
    phaseFilesCounts: [],
    roadmapPhaseCount: 0,
    stateProjection: { status: 'unknown', current_phase: null, last_activity: null },
    filesExist: { roadmap: false, state: false, requirements: false },
    ...overrides,
  };
}

const FIXTURES = [
  {
    label: 'empty inventory: no phase dirs, no STATE.md',
    inputs: minimalInputs(),
  },
  {
    label: 'one phase in_progress (partial plan completion)',
    inputs: minimalInputs({
      phaseDirNames: ['01-alpha'],
      phaseFilesCounts: [{ directory: '01-alpha', planCount: 3, summaryCount: 1 }],
      roadmapPhaseCount: 1,
      stateProjection: { status: 'executing', current_phase: '01-alpha', last_activity: '2026-05-01' },
      filesExist: { roadmap: true, state: true, requirements: false },
    }),
  },
  {
    label: 'one phase complete (summary_count >= plan_count)',
    inputs: minimalInputs({
      phaseDirNames: ['01-alpha'],
      phaseFilesCounts: [{ directory: '01-alpha', planCount: 2, summaryCount: 2 }],
      roadmapPhaseCount: 1,
      stateProjection: { status: 'milestone complete', current_phase: null, last_activity: '2026-04-01' },
      filesExist: { roadmap: true, state: true, requirements: true },
    }),
  },
  {
    label: 'one phase pending (plan_count is 0)',
    inputs: minimalInputs({
      phaseDirNames: ['01-alpha'],
      phaseFilesCounts: [{ directory: '01-alpha', planCount: 0, summaryCount: 0 }],
      roadmapPhaseCount: 1,
      stateProjection: { status: 'planning', current_phase: null, last_activity: null },
    }),
  },
  {
    label: 'multiple phases with mixed statuses',
    inputs: minimalInputs({
      phaseDirNames: ['01-alpha', '02-beta', '03-gamma'],
      phaseFilesCounts: [
        { directory: '01-alpha', planCount: 2, summaryCount: 2 },
        { directory: '02-beta', planCount: 3, summaryCount: 1 },
        { directory: '03-gamma', planCount: 0, summaryCount: 0 },
      ],
      roadmapPhaseCount: 3,
      stateProjection: { status: 'executing', current_phase: '02-beta', last_activity: '2026-05-10' },
      filesExist: { roadmap: true, state: true, requirements: false },
    }),
  },
  {
    label: 'progress_percent clamps to 100 when completedPhases > roadmapPhaseCount',
    inputs: minimalInputs({
      phaseDirNames: ['01-alpha', '02-beta', '03-gamma'],
      phaseFilesCounts: [
        { directory: '01-alpha', planCount: 1, summaryCount: 1 },
        { directory: '02-beta', planCount: 1, summaryCount: 1 },
        { directory: '03-gamma', planCount: 1, summaryCount: 1 },
      ],
      roadmapPhaseCount: 1,
      stateProjection: { status: 'milestone complete', current_phase: null, last_activity: null },
      filesExist: { roadmap: true, state: true, requirements: false },
    }),
  },
  {
    label: 'active workstream marker: active: true when activeWorkstreamName === name',
    inputs: minimalInputs({
      name: 'my-ws',
      activeWorkstreamName: 'my-ws',
    }),
  },
  {
    label: 'active: false when activeWorkstreamName is a different workstream',
    inputs: minimalInputs({
      name: 'my-ws',
      activeWorkstreamName: 'other-ws',
    }),
  },
];

const IS_COMPLETED_FIXTURES = [
  { status: 'milestone complete', expected: true },
  { status: 'Milestone Complete', expected: true },
  { status: 'archived', expected: true },
  { status: 'Archived', expected: true },
  { status: 'executing', expected: false },
  { status: 'planning', expected: false },
  { status: 'unknown', expected: false },
  { status: '', expected: false },
];

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('workstream-inventory-builder generator parity (ESM dist vs generated CJS)', () => {
  let sdkBuild, cjsModule;

  before(async () => {
    // Dynamic import of the ESM SDK dist (use pathToFileURL since we're in CJS context)
    const path = require('path');
    const { pathToFileURL } = require('url');
    const distPath = path.resolve(__dirname, '..', 'sdk', 'dist', 'workstream-inventory', 'builder.js');
    sdkBuild = await import(pathToFileURL(distPath).href);
    // CJS require of the generated artifact
    cjsModule = require('../get-shit-done/bin/lib/workstream-inventory-builder.generated.cjs');
  });

  describe('buildWorkstreamInventory', () => {
    for (const fixture of FIXTURES) {
      test(fixture.label, () => {
        const sdkResult = sdkBuild.buildWorkstreamInventory(fixture.inputs);
        const cjsResult = cjsModule.buildWorkstreamInventory(fixture.inputs);
        assert.deepStrictEqual(
          cjsResult,
          sdkResult,
          `Parity failure for fixture "${fixture.label}"`,
        );
      });
    }
  });

  describe('isCompletedInventory', () => {
    for (const { status, expected } of IS_COMPLETED_FIXTURES) {
      test(`isCompletedInventory("${status}") === ${expected}`, () => {
        const sdkResult = sdkBuild.isCompletedInventory(status);
        const cjsResult = cjsModule.isCompletedInventory(status);
        assert.strictEqual(sdkResult, expected, `SDK result mismatch for "${status}"`);
        assert.strictEqual(cjsResult, expected, `CJS result mismatch for "${status}"`);
        assert.strictEqual(sdkResult, cjsResult, `Parity failure for "${status}"`);
      });
    }
  });
});
