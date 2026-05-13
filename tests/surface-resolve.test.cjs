'use strict';
/**
 * Tests for resolveSurface — profile + cluster + explicit combinations.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { readSurface, writeSurface, resolveSurface } = require('../get-shit-done/bin/lib/surface.cjs');
const { resolveProfile, loadSkillsManifest, writeActiveProfile } = require('../get-shit-done/bin/lib/install-profiles.cjs');
const { CLUSTERS } = require('../get-shit-done/bin/lib/clusters.cjs');

const REAL_COMMANDS_DIR = path.join(__dirname, '..', 'commands', 'gsd');

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-surface-resolve-'));
}

function realManifest() {
  return loadSkillsManifest(REAL_COMMANDS_DIR);
}

describe('resolveSurface', () => {
  test('no surface state + core base profile → identical to resolveProfile core', () => {
    const dir = tmpDir();
    try {
      writeActiveProfile(dir, 'core');
      const manifest = realManifest();
      const surfaceResolved = resolveSurface(dir, manifest, CLUSTERS);
      const profileResolved = resolveProfile({ modes: ['core'], manifest });

      // Both should have same skill sets
      assert.ok(surfaceResolved.skills instanceof Set);
      assert.ok(profileResolved.skills instanceof Set);
      assert.deepStrictEqual(
        [...surfaceResolved.skills].sort(),
        [...profileResolved.skills].sort(),
        'surface with no state should equal profile resolution'
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('standard base + disabledClusters:["utility"] removes utility skills', () => {
    const dir = tmpDir();
    try {
      writeActiveProfile(dir, 'standard');
      writeSurface(dir, {
        baseProfile: 'standard',
        disabledClusters: ['utility'],
        explicitAdds: [],
        explicitRemoves: [],
      });
      const manifest = realManifest();
      const resolved = resolveSurface(dir, manifest, CLUSTERS);

      assert.ok(resolved.skills instanceof Set);
      // Utility cluster members should not be in the result
      for (const stem of CLUSTERS.utility) {
        // Only check stems that were actually in the standard profile
        const standardResolved = resolveProfile({ modes: ['standard'], manifest });
        if (standardResolved.skills.has(stem)) {
          assert.ok(
            !resolved.skills.has(stem),
            `"${stem}" should be removed by disabling utility cluster`
          );
        }
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('explicitAdds:["sketch"] adds sketch to a core install', () => {
    const dir = tmpDir();
    try {
      writeActiveProfile(dir, 'core');
      writeSurface(dir, {
        baseProfile: 'core',
        disabledClusters: [],
        explicitAdds: ['sketch'],
        explicitRemoves: [],
      });
      const manifest = realManifest();
      const resolved = resolveSurface(dir, manifest, CLUSTERS);

      assert.ok(resolved.skills instanceof Set);
      assert.ok(resolved.skills.has('sketch'), 'sketch must be in resolved skills');

      // Transitive requires of sketch should also be present
      const sketchRequires = manifest.get('sketch') || [];
      for (const dep of sketchRequires) {
        assert.ok(resolved.skills.has(dep), `transitive dep "${dep}" of sketch must be present`);
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('explicitRemoves removes individual skill stems', () => {
    const dir = tmpDir();
    try {
      writeSurface(dir, {
        baseProfile: 'standard',
        disabledClusters: [],
        explicitAdds: [],
        explicitRemoves: ['progress'],
      });
      writeActiveProfile(dir, 'standard');
      const manifest = realManifest();
      const resolved = resolveSurface(dir, manifest, CLUSTERS);

      // standard includes 'progress', so removing it should take it out
      assert.ok(!resolved.skills.has('progress'), '"progress" must be removed by explicitRemoves');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('result is a Set<string> with name property', () => {
    const dir = tmpDir();
    try {
      writeActiveProfile(dir, 'core');
      const manifest = realManifest();
      const resolved = resolveSurface(dir, manifest, CLUSTERS);

      assert.ok(resolved.skills instanceof Set);
      assert.ok(typeof resolved.name === 'string');
      assert.ok(resolved.agents instanceof Set);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('surface with baseProfile overrides .gsd-profile marker', () => {
    const dir = tmpDir();
    try {
      writeActiveProfile(dir, 'core');
      writeSurface(dir, {
        baseProfile: 'standard',
        disabledClusters: [],
        explicitAdds: [],
        explicitRemoves: [],
      });
      const manifest = realManifest();
      const resolved = resolveSurface(dir, manifest, CLUSTERS);
      const standardResolved = resolveProfile({ modes: ['standard'], manifest });

      // Should use standard profile from surface state, not core from marker
      assert.deepStrictEqual(
        [...resolved.skills].sort(),
        [...standardResolved.skills].sort(),
        'surface baseProfile takes precedence over marker'
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('disabled cluster + explicitAdds can re-add specific skills from disabled cluster', () => {
    const dir = tmpDir();
    try {
      writeSurface(dir, {
        baseProfile: 'standard',
        disabledClusters: ['workspace_state'],
        explicitAdds: ['capture'],
        explicitRemoves: [],
      });
      writeActiveProfile(dir, 'standard');
      const manifest = realManifest();
      const resolved = resolveSurface(dir, manifest, CLUSTERS);

      // workspace_state is disabled, but capture is explicitly re-added
      assert.ok(resolved.skills.has('capture'), '"capture" must be present via explicitAdds');
      // Other workspace_state members that were in standard should be gone
      const standardResolved = resolveProfile({ modes: ['standard'], manifest });
      for (const stem of CLUSTERS.workspace_state) {
        if (stem === 'capture') continue;
        if (standardResolved.skills.has(stem)) {
          assert.ok(
            !resolved.skills.has(stem),
            `"${stem}" should be removed (workspace_state disabled, not explicitly re-added)`
          );
        }
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
