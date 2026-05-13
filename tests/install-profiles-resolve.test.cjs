'use strict';
/**
 * Tests for resolveProfile — computes transitive closure over the requires: graph.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const {
  PROFILES,
  resolveProfile,
  loadSkillsManifest,
} = require('../get-shit-done/bin/lib/install-profiles.cjs');

const REAL_COMMANDS_DIR = path.join(__dirname, '..', 'commands', 'gsd');

describe('PROFILES map', () => {
  test('PROFILES is frozen', () => {
    assert.ok(Object.isFrozen(PROFILES));
  });

  test('PROFILES has core, standard, full keys', () => {
    assert.ok('core' in PROFILES, 'PROFILES.core missing');
    assert.ok('standard' in PROFILES, 'PROFILES.standard missing');
    assert.ok('full' in PROFILES, 'PROFILES.full missing');
  });

  test('PROFILES.core contains the 6 main-loop skills', () => {
    const core = PROFILES.core;
    assert.ok(Array.isArray(core), 'core should be an array');
    const sorted = [...core].sort();
    assert.deepStrictEqual(sorted, [
      'discuss-phase',
      'execute-phase',
      'help',
      'new-project',
      'plan-phase',
      'update',
    ]);
  });

  test('PROFILES.full is the sentinel "*"', () => {
    assert.strictEqual(PROFILES.full, '*');
  });

  test('PROFILES.standard contains at least the core skills', () => {
    const core = new Set(PROFILES.core);
    const standard = PROFILES.standard;
    assert.ok(Array.isArray(standard), 'standard should be an array');
    for (const s of core) {
      assert.ok(standard.includes(s), `standard should include core skill: ${s}`);
    }
  });

  test('PROFILES.standard has at least 10 skills', () => {
    assert.ok(PROFILES.standard.length >= 10, `standard should have >=10 skills, got ${PROFILES.standard.length}`);
  });
});

describe('resolveProfile', () => {
  test('defaults to full when called with no args', () => {
    const manifest = loadSkillsManifest(REAL_COMMANDS_DIR);
    const result = resolveProfile({ manifest });
    assert.strictEqual(result.name, 'full');
    assert.strictEqual(result.skills, '*');
  });

  test('resolves core profile — returns 6+ skills (closure adds phase)', () => {
    const manifest = loadSkillsManifest(REAL_COMMANDS_DIR);
    const result = resolveProfile({ modes: ['core'], manifest });
    assert.strictEqual(result.name, 'core');
    assert.ok(result.skills instanceof Set, 'skills should be a Set');
    // core has 6 base; closure adds phase (referenced by discuss/plan/execute/new-project)
    // and config (referenced by discuss-phase, new-project), and more
    assert.ok(result.skills.size >= 6, `core closure should have >=6 skills, got ${result.skills.size}`);
    // All 6 base skills must be present
    for (const s of PROFILES.core) {
      assert.ok(result.skills.has(s), `core closure should include ${s}`);
    }
    // phase must be included via closure (discuss-phase, plan-phase, etc. require it)
    assert.ok(result.skills.has('phase'), 'core closure must include phase (required by discuss/plan/execute-phase)');
  });

  test('resolves standard profile — returns superset of core', () => {
    const manifest = loadSkillsManifest(REAL_COMMANDS_DIR);
    const coreResult = resolveProfile({ modes: ['core'], manifest });
    const stdResult = resolveProfile({ modes: ['standard'], manifest });
    assert.strictEqual(stdResult.name, 'standard');
    assert.ok(stdResult.skills instanceof Set);
    assert.ok(stdResult.skills.size >= coreResult.skills.size, 'standard should have >= skills than core');
    // All core closure skills must be in standard
    for (const s of coreResult.skills) {
      assert.ok(stdResult.skills.has(s), `standard must include core skill: ${s}`);
    }
  });

  test('resolves full profile — returns sentinel', () => {
    const manifest = loadSkillsManifest(REAL_COMMANDS_DIR);
    const result = resolveProfile({ modes: ['full'], manifest });
    assert.strictEqual(result.name, 'full');
    assert.strictEqual(result.skills, '*');
  });

  test('composable profiles — core,standard union is same as standard', () => {
    const manifest = loadSkillsManifest(REAL_COMMANDS_DIR);
    const stdResult = resolveProfile({ modes: ['standard'], manifest });
    const composed = resolveProfile({ modes: ['core', 'standard'], manifest });
    // name should reflect composed
    assert.ok(composed.name.includes('core') && composed.name.includes('standard'),
      `composed name should include both, got: ${composed.name}`);
    // skills union should equal standard (since core ⊂ standard)
    for (const s of stdResult.skills) {
      assert.ok(composed.skills.has(s), `composed should include standard skill: ${s}`);
    }
  });

  test('transitive closure: skill that requires phase pulls in phase', () => {
    // Build a minimal manifest: only discuss-phase requiring phase
    const manifest = new Map([
      ['discuss-phase', ['phase']],
      ['phase', []],
      ['help', []],
    ]);
    // Profile with only discuss-phase in base
    const miniProfiles = { core: ['discuss-phase', 'help'], full: '*', standard: ['discuss-phase', 'help'] };
    const result = resolveProfile({ modes: ['core'], manifest, _profilesOverride: miniProfiles });
    assert.ok(result.skills.has('phase'), 'phase should be pulled in via closure from discuss-phase');
    assert.ok(result.skills.has('discuss-phase'));
    assert.ok(result.skills.has('help'));
  });

  test('deep transitive closure works (A→B→C pulls in C)', () => {
    const manifest = new Map([
      ['a', ['b']],
      ['b', ['c']],
      ['c', []],
    ]);
    const miniProfiles = { core: ['a'], full: '*', standard: ['a'] };
    const result = resolveProfile({ modes: ['core'], manifest, _profilesOverride: miniProfiles });
    assert.ok(result.skills.has('a'));
    assert.ok(result.skills.has('b'));
    assert.ok(result.skills.has('c'));
  });

  test('resolveProfile result has agents Set', () => {
    const manifest = loadSkillsManifest(REAL_COMMANDS_DIR);
    const result = resolveProfile({ modes: ['core'], manifest });
    assert.ok(result.agents instanceof Set, 'result should have agents Set');
  });
});
