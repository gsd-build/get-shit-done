'use strict';

/**
 * Tests for canonical artifact registry and gsd-health W019 lint (#2448).
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const { isCanonicalPlanningFile, CANONICAL_EXACT } = require('../get-shit-done/bin/lib/artifacts.cjs');
const { cmdValidateHealth } = require('../get-shit-done/bin/lib/verify.cjs');

function makeTempProject(files = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-2448-'));
  fs.mkdirSync(path.join(dir, '.planning', 'phases'), { recursive: true });
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, 'utf-8');
  }
  return dir;
}

const BASE_FILES = {
  '.planning/PROJECT.md': '# P\n\n## What This Is\n\nX\n\n## Core Value\n\nY\n\n## Requirements\n\nZ\n',
  '.planning/ROADMAP.md': '# Roadmap\n',
  '.planning/STATE.md': '# State\n',
  '.planning/config.json': '{}',
};

describe('artifacts.cjs — isCanonicalPlanningFile', () => {
  test('returns true for all exact canonical names', () => {
    for (const name of CANONICAL_EXACT) {
      assert.ok(isCanonicalPlanningFile(name), `Expected ${name} to be canonical`);
    }
  });

  test('returns true for version-stamped milestone audit file', () => {
    assert.ok(isCanonicalPlanningFile('v1.0-MILESTONE-AUDIT.md'));
    assert.ok(isCanonicalPlanningFile('v2.3.1-MILESTONE-AUDIT.md'));
  });

  test('returns false for clearly non-canonical names', () => {
    assert.strictEqual(isCanonicalPlanningFile('MY-NOTES.md'), false);
    assert.strictEqual(isCanonicalPlanningFile('scratch.md'), false);
    assert.strictEqual(isCanonicalPlanningFile('random-output.md'), false);
  });

  test('returns false for phase-level artifacts at the root (they belong in phases/)', () => {
    assert.strictEqual(isCanonicalPlanningFile('01-CONTEXT.md'), false);
    assert.strictEqual(isCanonicalPlanningFile('01-01-PLAN.md'), false);
  });
});

describe('gsd-health W019 — unrecognized .planning/ root files', () => {
  test('W019 fires for a non-canonical .md file at .planning/ root', () => {
    const dir = makeTempProject({
      ...BASE_FILES,
      '.planning/MY-NOTES.md': '# notes\n',
    });

    const result = cmdValidateHealth(dir, { repair: false }, false);

    const w019 = result.warnings.find(w => w.code === 'W019');
    assert.ok(w019, 'W019 should be emitted for unrecognized file');
    assert.ok(w019.message.includes('MY-NOTES.md'), 'warning should name the file');
    assert.strictEqual(w019.repairable, false, 'W019 is not auto-repairable');
  });

  test('no W019 for canonical files', () => {
    const dir = makeTempProject({ ...BASE_FILES });

    const result = cmdValidateHealth(dir, { repair: false }, false);

    const w019 = result.warnings.find(w => w.code === 'W019');
    assert.strictEqual(w019, undefined, 'no W019 for canonical files');
  });

  test('no W019 for phase subdirectory files (only root is checked)', () => {
    const dir = makeTempProject({
      ...BASE_FILES,
      '.planning/phases/01-foundation/01-01-PLAN.md': '---\nphase: "1"\n---\n',
    });

    const result = cmdValidateHealth(dir, { repair: false }, false);

    const w019 = result.warnings.find(w => w.code === 'W019');
    assert.strictEqual(w019, undefined, 'phase subdir files not flagged by W019');
  });

  test('no W019 for version-stamped files like vX.Y-MILESTONE-AUDIT.md', () => {
    const dir = makeTempProject({
      ...BASE_FILES,
      '.planning/v1.0-MILESTONE-AUDIT.md': '# Audit\n',
    });

    const result = cmdValidateHealth(dir, { repair: false }, false);

    const w019 = result.warnings.find(w => w.code === 'W019');
    assert.strictEqual(w019, undefined, 'version-stamped audit file is canonical');
  });

  test('multiple unrecognized files produce multiple W019 warnings', () => {
    const dir = makeTempProject({
      ...BASE_FILES,
      '.planning/scratch.md': '# scratch\n',
      '.planning/temp-notes.md': '# temp\n',
    });

    const result = cmdValidateHealth(dir, { repair: false }, false);

    const w019s = result.warnings.filter(w => w.code === 'W019');
    assert.strictEqual(w019s.length, 2, 'one W019 per unrecognized file');
  });

  test('templates/README.md exists and documents W019', () => {
    const readme = fs.readFileSync(
      path.join(__dirname, '../get-shit-done/templates/README.md'), 'utf-8'
    );
    assert.ok(readme.includes('W019'), 'README.md documents W019');
    assert.ok(readme.includes('artifacts.cjs'), 'README.md references artifacts.cjs for adding new artifacts');
    assert.ok(readme.includes('PROJECT.md'), 'README.md lists PROJECT.md as canonical');
  });
});
