/**
 * Regression test for issue #2554: decimal phase dirs (00.1, 72.1) excluded
 * from state disk-scan progress counts.
 *
 * Root cause: `/^0+/` in getMilestonePhaseFilter() stripped the leading zero
 * from "0.1" → ".1", mismatching directory extraction that produces "0.1".
 * Fix: `/^0+(?=\d)/` — only strip zeros followed by another digit.
 */

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

describe('decimal phase dirs in state progress (#2554)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  /**
   * Helper: write a ROADMAP.md with the given phase headers inside a milestone.
   */
  function writeRoadmap(phases) {
    const lines = ['# Roadmap', '', '## v1.0', ''];
    for (const p of phases) {
      lines.push(`### Phase ${p.num}: ${p.name}`);
      lines.push(`**Goal:** ${p.name}`);
      lines.push('');
    }
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      lines.join('\n')
    );
  }

  /**
   * Helper: write a minimal STATE.md so `state json` has something to parse.
   */
  function writeState(currentPhase) {
    const content = [
      '# Project State',
      '',
      `**Current Phase:** ${currentPhase}`,
      '**Status:** Executing',
      '**Progress:** 0%',
      '',
    ].join('\n');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), content);
  }

  /**
   * Helper: create a phase directory with a PLAN.md and optionally a SUMMARY.md.
   */
  function createPhaseDir(dirName, { complete = false } = {}) {
    const dir = path.join(tmpDir, '.planning', 'phases', dirName);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'a-PLAN.md'), '# Plan\n');
    if (complete) {
      fs.writeFileSync(path.join(dir, 'a-SUMMARY.md'), '# Summary\n');
    }
  }

  test('phase 0.1 dir is counted in progress (zero-before-decimal)', () => {
    writeRoadmap([
      { num: '1', name: 'Setup' },
      { num: '0.1', name: 'Pre-setup patch' },
    ]);
    writeState('0.1');
    createPhaseDir('01-setup');
    createPhaseDir('00.1-pre-setup-patch', { complete: true });

    const result = runGsdTools('state json', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    const p = output.progress;
    assert.ok(p, 'progress object should exist');
    assert.ok(p.total_phases >= 2, `total_phases should be >= 2, got ${p.total_phases}`);
    assert.ok(p.completed_phases >= 1, `completed_phases should be >= 1, got ${p.completed_phases}`);
  });

  test('phase 00.1 directory matches ROADMAP "Phase 0.1:"', () => {
    writeRoadmap([
      { num: '0.1', name: 'Hotfix' },
    ]);
    writeState('0.1');
    createPhaseDir('00.1-hotfix');

    const result = runGsdTools('state json', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    const p = output.progress;
    assert.ok(p, 'progress object should exist');
    assert.ok(p.total_phases >= 1, `total_phases should be >= 1, got ${p.total_phases}`);
    assert.ok(p.total_plans >= 1, `total_plans should be >= 1, got ${p.total_plans}`);
  });

  test('phase 72.1 dir is counted (non-zero decimal)', () => {
    writeRoadmap([
      { num: '72', name: 'Feature' },
      { num: '72.1', name: 'Inserted fix' },
    ]);
    writeState('72.1');
    createPhaseDir('72-feature');
    createPhaseDir('72.1-inserted-fix', { complete: true });

    const result = runGsdTools('state json', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    const p = output.progress;
    assert.ok(p, 'progress object should exist');
    assert.ok(p.total_phases >= 2, `total_phases should be >= 2, got ${p.total_phases}`);
    assert.ok(p.completed_phases >= 1, `completed_phases should be >= 1, got ${p.completed_phases}`);
  });

  test('phase 0 (pure zero) still normalizes correctly', () => {
    writeRoadmap([
      { num: '0', name: 'Bootstrap' },
      { num: '1', name: 'Setup' },
    ]);
    writeState('0');
    createPhaseDir('00-bootstrap', { complete: true });
    createPhaseDir('01-setup');

    const result = runGsdTools('state json', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    const p = output.progress;
    assert.ok(p, 'progress object should exist');
    assert.ok(p.total_phases >= 2, `total_phases should be >= 2, got ${p.total_phases}`);
    assert.ok(p.completed_phases >= 1, `completed_phases should be >= 1, got ${p.completed_phases}`);
  });

  test('multiple decimal phases under same parent are all counted', () => {
    writeRoadmap([
      { num: '0.1', name: 'First' },
      { num: '0.2', name: 'Second' },
      { num: '0.3', name: 'Third' },
    ]);
    writeState('0.3');
    createPhaseDir('00.1-first', { complete: true });
    createPhaseDir('00.2-second', { complete: true });
    createPhaseDir('00.3-third');

    const result = runGsdTools('state json', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    const p = output.progress;
    assert.ok(p, 'progress object should exist');
    assert.ok(p.total_phases >= 3, `total_phases should be >= 3, got ${p.total_phases}`);
    assert.strictEqual(p.completed_phases, 2, 'exactly 2 phases should be complete');
    assert.ok(p.total_plans >= 3, `total_plans should be >= 3, got ${p.total_plans}`);
  });
});
