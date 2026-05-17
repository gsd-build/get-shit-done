'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const LINT_SCRIPT = path.join(ROOT, 'scripts', 'lint-pr-check-project-dir.cjs');

const {
  checkFiles,
  defaultFiles,
  findForbiddenCwd,
  formatFindings,
} = require(LINT_SCRIPT);

function createFixtureDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-pr-check-lint-'));
}

function runLint(args = []) {
  return spawnSync(process.execPath, [LINT_SCRIPT, ...args], { encoding: 'utf8' });
}

describe('lint-pr-check-project-dir', () => {
  test('flags cwd parameters and shorthand properties', () => {
    const findings = findForbiddenCwd(
      [
        'function runCheck(args, cwd) {',
        '  return spawnSync(process.execPath, args, { cwd });',
        '}',
      ].join('\n'),
      'fixture.cjs',
    );

    assert.deepEqual(
      findings.map((finding) => [finding.line, finding.column]),
      [
        [1, 25],
        [2, 46],
      ],
    );
  });

  test('flags cwd option keys even when the value is projectDir', () => {
    const findings = findForbiddenCwd(
      [
        'function runCheck(args, projectDir) {',
        '  return spawnSync(process.execPath, args, { cwd: projectDir });',
        '}',
      ].join('\n'),
      'fixture.cjs',
    );

    assert.deepEqual(findings, [
      {
        file: 'fixture.cjs',
        line: 2,
        column: 46,
        source: 'return spawnSync(process.execPath, args, { cwd: projectDir });',
      },
    ]);
  });

  test('allows projectDir project-root naming without cwd references', () => {
    const findings = findForbiddenCwd(
      [
        'function checkProject(args, projectDir) {',
        '  return runProjectCheck(args, projectDir);',
        '}',
      ].join('\n'),
      'fixture.cjs',
    );

    assert.deepEqual(findings, []);
  });

  test('formats diagnostics with file, line, and source', () => {
    const output = formatFindings([
      {
        file: 'scripts/example.cjs',
        line: 12,
        column: 7,
        source: 'const cwd = projectDir;',
      },
    ]);

    assert.match(output, /ERROR lint-pr-check-project-dir: 1 forbidden cwd reference/);
    assert.match(output, /scripts\/example\.cjs:12:7/);
    assert.match(output, /const cwd = projectDir;/);
    assert.match(output, /projectDir/);
  });

  test('checks the real PR-check files without violations', () => {
    const files = defaultFiles(ROOT);
    assert.ok(files.length > 0, 'expected default PR-check files');
    assert.deepEqual(checkFiles(files, { rootDir: ROOT }), []);
  });

  test('CLI exits non-zero when a passed file contains cwd', () => {
    const dir = createFixtureDir();
    try {
      const file = path.join(dir, 'bad-check.cjs');
      fs.writeFileSync(file, 'const cwd = process.env.PROJECT_DIR;\n');

      const result = runLint([file]);

      assert.notStrictEqual(result.status, 0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
    }
  });

  test('script parses without syntax errors', () => {
    const result = spawnSync(process.execPath, ['--check', LINT_SCRIPT], { encoding: 'utf8' });
    assert.strictEqual(result.status, 0, result.stderr);
  });
});
