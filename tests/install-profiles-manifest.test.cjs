'use strict';
/**
 * Tests for loadSkillsManifest — parses requires: frontmatter from commands/gsd/*.md
 * and returns a Map<stem, string[]>.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  loadSkillsManifest,
} = require('../get-shit-done/bin/lib/install-profiles.cjs');

function createFixtureDir() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-manifest-fixture-'));
  return tmp;
}

function writeSkill(dir, stem, frontmatter) {
  const content = `---\n${frontmatter}\n---\n\n# body\n`;
  fs.writeFileSync(path.join(dir, `${stem}.md`), content);
}

describe('loadSkillsManifest', () => {
  test('returns a Map', () => {
    const dir = createFixtureDir();
    try {
      const m = loadSkillsManifest(dir);
      assert.ok(m instanceof Map, 'should return a Map');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('skill with no requires: frontmatter maps to empty array', () => {
    const dir = createFixtureDir();
    try {
      writeSkill(dir, 'help', 'name: gsd:help\ndescription: Help text');
      const m = loadSkillsManifest(dir);
      assert.ok(m.has('help'), 'help should be in manifest');
      assert.deepStrictEqual(m.get('help'), []);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('skill with requires: single value maps to array of one', () => {
    const dir = createFixtureDir();
    try {
      writeSkill(dir, 'add-tests', 'name: gsd:add-tests\ndescription: Add tests\nrequires: [phase]');
      const m = loadSkillsManifest(dir);
      assert.ok(m.has('add-tests'));
      assert.deepStrictEqual(m.get('add-tests'), ['phase']);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('skill with requires: multiple values maps to full array', () => {
    const dir = createFixtureDir();
    try {
      writeSkill(dir, 'plan-phase', 'name: gsd:plan-phase\ndescription: Plan\nrequires: [discuss-phase, phase, review, update]');
      const m = loadSkillsManifest(dir);
      assert.deepStrictEqual(m.get('plan-phase'), ['discuss-phase', 'phase', 'review', 'update']);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('ignores non-.md files in the dir', () => {
    const dir = createFixtureDir();
    try {
      writeSkill(dir, 'help', 'name: gsd:help\ndescription: Help');
      fs.writeFileSync(path.join(dir, 'README.txt'), 'not a skill');
      fs.writeFileSync(path.join(dir, 'notes.json'), '{}');
      const m = loadSkillsManifest(dir);
      assert.ok(m.has('help'));
      assert.ok(!m.has('README'));
      assert.ok(!m.has('notes'));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('empty dir returns empty Map', () => {
    const dir = createFixtureDir();
    try {
      const m = loadSkillsManifest(dir);
      assert.strictEqual(m.size, 0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('skill with requires: empty array maps to empty array', () => {
    const dir = createFixtureDir();
    try {
      writeSkill(dir, 'explore', 'name: gsd:explore\ndescription: Explore\nrequires: []');
      const m = loadSkillsManifest(dir);
      assert.deepStrictEqual(m.get('explore'), []);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('loads real commands/gsd/ directory without throwing', () => {
    const realDir = path.join(__dirname, '..', 'commands', 'gsd');
    const m = loadSkillsManifest(realDir);
    assert.ok(m.size >= 60, `expected >=60 skills, got ${m.size}`);
    // discuss-phase requires [config, phase]
    const depsDP = m.get('discuss-phase');
    assert.ok(Array.isArray(depsDP), 'discuss-phase should be in manifest');
    assert.ok(depsDP.includes('phase'), 'discuss-phase should require phase');
    assert.ok(depsDP.includes('config'), 'discuss-phase should require config');
    // help has no requires
    assert.deepStrictEqual(m.get('help'), []);
  });
});
