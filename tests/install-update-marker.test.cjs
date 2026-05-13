'use strict';
/**
 * Tests for marker-driven profile re-application on `gsd update` (Deviation 2).
 *
 * Verifies:
 *   1. resolveEffectiveProfile returns the marker's profile when no explicit flag given.
 *   2. Explicit --profile flag overrides the marker.
 *   3. Multi-runtime marker disagreement resolves to the most-restrictive profile.
 *   4. Missing marker falls back to 'full'.
 *   5. stageSkillsForProfile is called with the resolved profile (not 'full') on updates.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  resolveEffectiveProfile,
  mostRestrictiveProfile,
  writeActiveProfile,
  readActiveProfile,
  resolveProfile,
  loadSkillsManifest,
  stageSkillsForProfile,
  cleanupStagedSkills,
} = require('../get-shit-done/bin/lib/install-profiles.cjs');

const REAL_COMMANDS_DIR = path.join(__dirname, '..', 'commands', 'gsd');

describe('resolveEffectiveProfile', () => {
  test('no explicit flag and no marker → returns "full"', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-reu-'));
    try {
      const result = resolveEffectiveProfile({ requestedProfileName: null, targetDir: dir });
      assert.strictEqual(result, 'full');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('no explicit flag but marker exists → returns marker profile', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-reu-'));
    try {
      writeActiveProfile(dir, 'standard');
      const result = resolveEffectiveProfile({ requestedProfileName: null, targetDir: dir });
      assert.strictEqual(result, 'standard');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('no explicit flag but core marker exists → returns "core"', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-reu-'));
    try {
      writeActiveProfile(dir, 'core');
      const result = resolveEffectiveProfile({ requestedProfileName: null, targetDir: dir });
      assert.strictEqual(result, 'core');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('explicit --profile=full overrides a non-full marker', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-reu-'));
    try {
      writeActiveProfile(dir, 'core');
      const result = resolveEffectiveProfile({ requestedProfileName: 'full', targetDir: dir });
      assert.strictEqual(result, 'full');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('explicit --profile=standard overrides a core marker', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-reu-'));
    try {
      writeActiveProfile(dir, 'core');
      const result = resolveEffectiveProfile({ requestedProfileName: 'standard', targetDir: dir });
      assert.strictEqual(result, 'standard');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('full marker falls back to "full" (not recorded as a restriction)', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-reu-'));
    try {
      writeActiveProfile(dir, 'full');
      const result = resolveEffectiveProfile({ requestedProfileName: null, targetDir: dir });
      assert.strictEqual(result, 'full');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('mostRestrictiveProfile', () => {
  test('returns "core" over "standard" (core is smaller)', () => {
    const result = mostRestrictiveProfile(['standard', 'core']);
    assert.strictEqual(result, 'core');
  });

  test('returns "core" over "full"', () => {
    const result = mostRestrictiveProfile(['full', 'core']);
    assert.strictEqual(result, 'core');
  });

  test('returns "standard" over "full"', () => {
    const result = mostRestrictiveProfile(['full', 'standard']);
    assert.strictEqual(result, 'standard');
  });

  test('single profile returns that profile', () => {
    assert.strictEqual(mostRestrictiveProfile(['standard']), 'standard');
    assert.strictEqual(mostRestrictiveProfile(['full']), 'full');
    assert.strictEqual(mostRestrictiveProfile(['core']), 'core');
  });

  test('empty array returns "full" (no restriction)', () => {
    assert.strictEqual(mostRestrictiveProfile([]), 'full');
  });

  test('all same profile returns that profile', () => {
    assert.strictEqual(mostRestrictiveProfile(['standard', 'standard', 'standard']), 'standard');
  });
});

describe('marker-driven profile resolution end-to-end', () => {
  test('fresh install with --profile=standard writes marker, re-read resolves standard', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-e2e-'));
    try {
      // Simulate: fresh install with --profile=standard
      writeActiveProfile(dir, 'standard');
      // Simulate: re-run without flags (e.g. `gsd update`)
      const effective = resolveEffectiveProfile({ requestedProfileName: null, targetDir: dir });
      assert.strictEqual(effective, 'standard');
      // Verify the staged output contains only standard's skills
      const manifest = loadSkillsManifest(REAL_COMMANDS_DIR);
      const resolved = resolveProfile({ modes: [effective], manifest });
      assert.ok(resolved.skills instanceof Set, 'skills should be a Set for standard');
      assert.ok(resolved.skills.has('plan-phase'), 'standard should include plan-phase');
      // plan-phase should be staged
      let staged;
      try {
        staged = stageSkillsForProfile(REAL_COMMANDS_DIR, resolved);
        assert.notStrictEqual(staged, REAL_COMMANDS_DIR, 'should be a staged dir, not srcDir');
        const stagedFiles = fs.readdirSync(staged).map(f => f.slice(0, -3)); // strip .md
        assert.ok(stagedFiles.includes('plan-phase'), 'plan-phase.md should be staged');
        // full-only skills must NOT be staged
        const allFiles = fs.readdirSync(REAL_COMMANDS_DIR).map(f => f.slice(0, -3));
        const notInStandard = allFiles.filter(s => !resolved.skills.has(s));
        for (const stem of notInStandard) {
          assert.ok(!stagedFiles.includes(stem),
            `${stem} should not be staged in standard profile`);
        }
      } finally {
        if (staged) cleanupStagedSkills();
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('marker disagreement across runtimes → mostRestrictiveProfile picks smaller set', () => {
    const dirA = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-rtA-'));
    const dirB = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-rtB-'));
    try {
      writeActiveProfile(dirA, 'standard');
      writeActiveProfile(dirB, 'core');
      const profileA = readActiveProfile(dirA) || 'full';
      const profileB = readActiveProfile(dirB) || 'full';
      const resolved = mostRestrictiveProfile([profileA, profileB]);
      assert.strictEqual(resolved, 'core',
        'core is smaller than standard — most-restrictive wins');
    } finally {
      fs.rmSync(dirA, { recursive: true, force: true });
      fs.rmSync(dirB, { recursive: true, force: true });
    }
  });

  test('explicit --profile=full overrides restrictive marker (no narrowing)', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-override-'));
    try {
      writeActiveProfile(dir, 'core');
      const effective = resolveEffectiveProfile({ requestedProfileName: 'full', targetDir: dir });
      assert.strictEqual(effective, 'full');
      const manifest = loadSkillsManifest(REAL_COMMANDS_DIR);
      const resolved = resolveProfile({ modes: [effective], manifest });
      assert.strictEqual(resolved.skills, '*', 'full profile should be sentinel');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
