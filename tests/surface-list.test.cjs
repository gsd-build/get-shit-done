'use strict';
/**
 * Tests for listSurface — enabled/disabled/tokenCost output.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { writeSurface, listSurface } = require('../get-shit-done/bin/lib/surface.cjs');
const { loadSkillsManifest, writeActiveProfile } = require('../get-shit-done/bin/lib/install-profiles.cjs');
const { CLUSTERS } = require('../get-shit-done/bin/lib/clusters.cjs');

const REAL_COMMANDS_DIR = path.join(__dirname, '..', 'commands', 'gsd');

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-surface-list-'));
}

function readFrontmatterDescription(markdown) {
  const lines = markdown.split('\n');
  if (lines[0].trim() !== '---') return '';

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '---') break;
    const sep = line.indexOf(':');
    if (sep === -1) continue;
    const key = line.slice(0, sep).trim();
    if (key !== 'description') continue;
    return line.slice(sep + 1).trim();
  }
  return '';
}

describe('listSurface', () => {
  test('returns { enabled, disabled, tokenCost } structure', () => {
    const dir = tmpDir();
    try {
      // Write source marker so listSurface can find descriptions
      fs.writeFileSync(path.join(dir, '.gsd-source'), REAL_COMMANDS_DIR, 'utf8');
      writeActiveProfile(dir, 'core');
      const manifest = loadSkillsManifest(REAL_COMMANDS_DIR);
      const result = listSurface(dir, manifest, CLUSTERS);

      assert.ok(Array.isArray(result.enabled), 'enabled must be array');
      assert.ok(Array.isArray(result.disabled), 'disabled must be array');
      assert.ok(typeof result.tokenCost === 'number', 'tokenCost must be number');
      assert.ok(result.tokenCost >= 0, 'tokenCost must be non-negative');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('core profile: enabled has fewer skills than full', () => {
    const dir = tmpDir();
    try {
      fs.writeFileSync(path.join(dir, '.gsd-source'), REAL_COMMANDS_DIR, 'utf8');
      writeActiveProfile(dir, 'core');
      const manifest = loadSkillsManifest(REAL_COMMANDS_DIR);
      const coreList = listSurface(dir, manifest, CLUSTERS);

      // Core should have fewer enabled skills than total
      const totalStems = [...manifest.keys()].filter(k => !k.startsWith('_calls_agents_')).length;
      assert.ok(
        coreList.enabled.length < totalStems,
        'core should enable fewer skills than total'
      );
      assert.ok(coreList.disabled.length > 0, 'core should have some disabled skills');
      assert.ok(coreList.enabled.length + coreList.disabled.length === totalStems,
        'enabled + disabled must equal total stems');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('disabling utility cluster reduces enabled count', () => {
    const dir = tmpDir();
    try {
      fs.writeFileSync(path.join(dir, '.gsd-source'), REAL_COMMANDS_DIR, 'utf8');
      writeActiveProfile(dir, 'standard');
      const manifest = loadSkillsManifest(REAL_COMMANDS_DIR);

      const beforeList = listSurface(dir, manifest, CLUSTERS);

      writeSurface(dir, {
        baseProfile: 'standard',
        disabledClusters: ['utility'],
        explicitAdds: [],
        explicitRemoves: [],
      });
      const afterList = listSurface(dir, manifest, CLUSTERS);

      assert.ok(afterList.enabled.length <= beforeList.enabled.length,
        'disabling utility cluster should not increase enabled count');
      assert.ok(afterList.tokenCost <= beforeList.tokenCost,
        'disabling a cluster should not increase token cost');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('tokenCost is sum of description char lengths ÷ 4 for enabled skills', () => {
    const dir = tmpDir();
    try {
      fs.writeFileSync(path.join(dir, '.gsd-source'), REAL_COMMANDS_DIR, 'utf8');
      writeActiveProfile(dir, 'core');
      const manifest = loadSkillsManifest(REAL_COMMANDS_DIR);
      const result = listSurface(dir, manifest, CLUSTERS);

      // Manually compute expected token cost for enabled skills
      let expected = 0;
      for (const stem of result.enabled) {
        const filePath = path.join(REAL_COMMANDS_DIR, `${stem}.md`);
        if (!fs.existsSync(filePath)) continue;
        const markdown = fs.readFileSync(filePath, 'utf8');
        const description = readFrontmatterDescription(markdown);
        if (description) expected += Math.ceil(description.length / 4);
      }

      assert.strictEqual(result.tokenCost, expected, 'tokenCost must equal sum of description lengths ÷ 4');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('enabled and disabled arrays are sorted', () => {
    const dir = tmpDir();
    try {
      fs.writeFileSync(path.join(dir, '.gsd-source'), REAL_COMMANDS_DIR, 'utf8');
      writeActiveProfile(dir, 'standard');
      const manifest = loadSkillsManifest(REAL_COMMANDS_DIR);
      const result = listSurface(dir, manifest, CLUSTERS);

      assert.deepStrictEqual(result.enabled, [...result.enabled].sort());
      assert.deepStrictEqual(result.disabled, [...result.disabled].sort());
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
