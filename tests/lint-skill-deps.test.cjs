'use strict';
/**
 * Fixture-based tests for scripts/lint-skill-deps.cjs.
 *
 * Uses child_process.spawnSync to exercise the lint script as a black box,
 * passing fixture files via argv. This tests the actual exit codes and
 * error output the script produces.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const LINT_SCRIPT = path.join(__dirname, '..', 'scripts', 'lint-skill-deps.cjs');

function runLint(args = []) {
  return spawnSync(process.execPath, [LINT_SCRIPT, ...args], { encoding: 'utf8' });
}

function createFixtureDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-lint-deps-fixture-'));
}

function writeSkillFile(dir, stem, { description = 'Test skill', requires = null, body = '' }) {
  let fm = `name: gsd:${stem}\ndescription: ${description}`;
  if (requires !== null) {
    fm += `\nrequires: [${requires.join(', ')}]`;
  }
  const content = `---\n${fm}\n---\n\n${body}\n`;
  fs.writeFileSync(path.join(dir, `${stem}.md`), content);
}

describe('lint-skill-deps: frontmatter ↔ body consistency', () => {
  test('exits 0 when all skills have consistent requires: and references', () => {
    const dir = createFixtureDir();
    try {
      // phase.md has no references to other skills
      writeSkillFile(dir, 'phase', { description: 'Phase skill', body: 'Use this to manage phases.' });
      // discuss-phase requires phase and references it in body
      writeSkillFile(dir, 'discuss-phase', {
        description: 'Discuss skill',
        requires: ['phase'],
        body: 'Invoke with /gsd:phase to manage phases.',
      });
      const result = runLint(['--dir', dir]);
      assert.strictEqual(result.status, 0, `Expected exit 0, got ${result.status}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('exits non-zero when body references gsd:phase but requires: is absent', () => {
    const dir = createFixtureDir();
    try {
      writeSkillFile(dir, 'phase', { description: 'Phase skill', body: '' });
      writeSkillFile(dir, 'discuss-phase', {
        description: 'Discuss skill',
        // requires: absent — but body references /gsd:phase
        requires: null,
        body: 'Use /gsd:phase to manage phases.',
      });
      const result = runLint(['--dir', dir]);
      assert.notStrictEqual(result.status, 0, 'Should exit non-zero when requires: is missing but body has reference');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('exits non-zero when body references gsd-phase but requires: does not include it', () => {
    const dir = createFixtureDir();
    try {
      writeSkillFile(dir, 'phase', { description: 'Phase skill', body: '' });
      writeSkillFile(dir, 'discuss-phase', {
        description: 'Discuss skill',
        requires: ['config'],  // has requires but missing 'phase'
        body: 'Use /gsd:phase to manage phases.',
      });
      const result = runLint(['--dir', dir]);
      assert.notStrictEqual(result.status, 0, 'Should exit non-zero for undeclared reference');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('exits 0 when skill has no body references and no requires:', () => {
    const dir = createFixtureDir();
    try {
      writeSkillFile(dir, 'help', { description: 'Help skill', body: 'Shows help.' });
      const result = runLint(['--dir', dir]);
      assert.strictEqual(result.status, 0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('exits non-zero when body references unknown skill stem', () => {
    const dir = createFixtureDir();
    try {
      writeSkillFile(dir, 'discuss-phase', {
        description: 'Discuss',
        requires: ['phase'],
        body: 'Use /gsd:phase.',
      });
      // Unknown skill reference should fail even if declared in requires.
      const result = runLint(['--dir', dir]);
      assert.notStrictEqual(result.status, 0, 'Unknown skill references must fail lint');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('lint-skill-deps: profile closure satisfaction', () => {
  test('exits 0 when run against real commands/gsd (all profiles closed or full)', () => {
    // This is the most important integration test: running lint on the real
    // commands/gsd/ directory with the real PROFILES must pass.
    const result = runLint();
    assert.strictEqual(result.status, 0,
      `lint-skill-deps failed on real codebase:\nstdout: ${result.stdout}\nstderr: ${result.stderr}`);
  });
});

describe('lint-skill-deps: script basics', () => {
  test('script is executable (no syntax errors)', () => {
    const result = spawnSync(process.execPath, ['--check', LINT_SCRIPT], { encoding: 'utf8' });
    assert.strictEqual(result.status, 0, `Syntax error in lint script: ${result.stderr}`);
  });

  test('prints ok message on success', () => {
    const dir = createFixtureDir();
    try {
      writeSkillFile(dir, 'help', { description: 'Help skill', body: 'Shows help.' });
      const result = runLint(['--dir', dir]);
      assert.strictEqual(result.status, 0, `Expected exit 0, got ${result.status}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`);
      assert.strictEqual(result.stderr, '', `Expected empty stderr on success, got: ${result.stderr}`);
      assert.ok(result.stdout.length > 0, 'Expected non-empty stdout on success');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
