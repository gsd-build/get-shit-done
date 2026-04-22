/**
 * Integration tests for auto-prune on phase completion (#2087).
 *
 * When config `workflow.auto_prune_state` is true, `phase complete`
 * should automatically prune STATE.md as part of the phase transition.
 */

'use strict';

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

function writeConfig(tmpDir, config) {
  fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), JSON.stringify(config, null, 2));
}

function writeStateMd(tmpDir, content) {
  fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), content);
}

function readStateMd(tmpDir) {
  return fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
}

function writeRoadmap(tmpDir, content) {
  fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), content);
}

function setupPhase(tmpDir, phaseNum, planCount) {
  const phasesDir = path.join(tmpDir, '.planning', 'phases');
  const phaseDir = path.join(phasesDir, `${String(phaseNum).padStart(2, '0')}-test-phase`);
  fs.mkdirSync(phaseDir, { recursive: true });

  for (let i = 1; i <= planCount; i++) {
    const planId = `${String(phaseNum).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    fs.writeFileSync(path.join(phaseDir, `${planId}-PLAN.md`), `# Plan ${planId}\n`);
    fs.writeFileSync(path.join(phaseDir, `${planId}-SUMMARY.md`), `# Summary ${planId}\n`);
  }
}

describe('phase complete auto-prune (#2087)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('prunes STATE.md automatically when auto_prune_state is true', () => {
    writeConfig(tmpDir, {
      workflow: { auto_prune_state: true },
    });

    writeStateMd(tmpDir, [
      '# Session State',
      '',
      '**Current Phase:** 6',
      '**Status:** Executing',
      '',
      '## Decisions',
      '',
      '- [Phase 1]: Old decision from phase 1',
      '- [Phase 2]: Old decision from phase 2',
      '- [Phase 5]: Recent decision',
      '- [Phase 6]: Current decision',
      '',
    ].join('\n'));

    writeRoadmap(tmpDir, [
      '# Roadmap',
      '',
      '## Phase 6: Test Phase',
      '',
      '**Plans:** 0/2',
      '',
    ].join('\n'));

    setupPhase(tmpDir, 6, 2);

    const result = runGsdTools('phase complete 6', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const newState = readStateMd(tmpDir);
    // With keep-recent=3 (default), cutoff = 6-3 = 3
    // Phase 1 and 2 decisions should be pruned
    assert.doesNotMatch(newState, /\[Phase 1\]: Old decision/);
    assert.doesNotMatch(newState, /\[Phase 2\]: Old decision/);
    // Phase 5 and 6 should remain
    assert.match(newState, /\[Phase 5\]: Recent decision/);
    assert.match(newState, /\[Phase 6\]: Current decision/);
  });

  test('does NOT prune when auto_prune_state is false (default)', () => {
    writeConfig(tmpDir, {
      workflow: { auto_prune_state: false },
    });

    writeStateMd(tmpDir, [
      '# Session State',
      '',
      '**Current Phase:** 6',
      '**Status:** Executing',
      '',
      '## Decisions',
      '',
      '- [Phase 1]: Old decision from phase 1',
      '- [Phase 5]: Recent decision',
      '- [Phase 6]: Current decision',
      '',
    ].join('\n'));

    writeRoadmap(tmpDir, [
      '# Roadmap',
      '',
      '## Phase 6: Test Phase',
      '',
      '**Plans:** 0/2',
      '',
    ].join('\n'));

    setupPhase(tmpDir, 6, 2);

    const result = runGsdTools('phase complete 6', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const newState = readStateMd(tmpDir);
    // Phase 1 decision should still be present (no pruning)
    assert.match(newState, /\[Phase 1\]: Old decision/);
  });

  test('does NOT prune when auto_prune_state is absent from config', () => {
    writeConfig(tmpDir, {
      workflow: {},
    });

    writeStateMd(tmpDir, [
      '# Session State',
      '',
      '**Current Phase:** 6',
      '**Status:** Executing',
      '',
      '## Decisions',
      '',
      '- [Phase 1]: Old decision from phase 1',
      '- [Phase 6]: Current decision',
      '',
    ].join('\n'));

    writeRoadmap(tmpDir, [
      '# Roadmap',
      '',
      '## Phase 6: Test Phase',
      '',
      '**Plans:** 0/2',
      '',
    ].join('\n'));

    setupPhase(tmpDir, 6, 2);

    const result = runGsdTools('phase complete 6', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const newState = readStateMd(tmpDir);
    // Should not prune — absent means disabled (default: false)
    assert.match(newState, /\[Phase 1\]: Old decision/);
  });
});
