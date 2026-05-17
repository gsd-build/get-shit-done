/**
 * Regression tests for #3509 — CLI breaks when repo path contains spaces
 *
 * Root cause: test code embedded space-containing paths into runGsdTools()
 * string args; the helper's whitespace tokenizer truncated paths at the first
 * space.  All calls that carry dynamic paths must use the array form of
 * runGsdTools() so execFileSync receives the full path as a single argv slot.
 *
 * These tests create a tmpdir whose prefix intentionally contains a space so
 * they remain red on a broken codebase regardless of the host machine's
 * tmpdir location.
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { runGsdTools } = require('./helpers.cjs');

// Create a tmpdir whose name always contains a space — this is the invariant
// that was violated on /Volumes/Mini Me/... machines.
function createSpacedTmpDir(prefix = 'path with spaces-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

// ─── dispatcher --cwd= with space in path ────────────────────────────────────

describe('bug-3509: --cwd= survives spaces in path', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createSpacedTmpDir();
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      '# Project State\n\n## Current Position\n\nPhase: 1 of 1 (Test)\n'
    );
  });

  afterEach(() => cleanup(tmpDir));

  test('--cwd= array form passes full path with spaces to dispatcher', () => {
    // Array form: path is a single argv slot, never split on whitespace
    const result = runGsdTools(['--cwd=' + tmpDir, 'state', 'load'], process.cwd());
    assert.ok(result.success, `--cwd= with spaced path should succeed, got: ${result.error}`);
  });
});

// ─── frontmatter-cli file path with spaces ───────────────────────────────────

describe('bug-3509: frontmatter get/set/merge/validate survive spaces in file path', () => {
  let tmpDir;
  let tmpFile;

  beforeEach(() => {
    tmpDir = createSpacedTmpDir();
    tmpFile = path.join(tmpDir, 'test.md');
    fs.writeFileSync(tmpFile, '---\nphase: 01\nplan: 01\ntype: execute\n---\nbody');
  });

  afterEach(() => cleanup(tmpDir));

  test('frontmatter get returns parsed fields when file path contains spaces', () => {
    const result = runGsdTools(['frontmatter', 'get', tmpFile]);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.phase, '01', 'phase field should be "01"');
  });

  test('frontmatter set works when file path contains spaces', () => {
    const setResult = runGsdTools(['frontmatter', 'set', tmpFile, '--field', 'phase', '--value', '02']);
    assert.ok(setResult.success, `set failed: ${setResult.error}`);
    // Verify behaviorally — round-trip via frontmatter get rather than reading the file
    // and grepping (which trips lint-no-source-grep even on tmp files).
    const getResult = runGsdTools(['frontmatter', 'get', tmpFile]);
    assert.ok(getResult.success, `get failed: ${getResult.error}`);
    const parsed = JSON.parse(getResult.output);
    assert.strictEqual(parsed.phase, '02', 'field should be updated to "02"');
  });

  test('frontmatter validate works when file path contains spaces', () => {
    // Plan frontmatter schema — file path contains a space; must reach validation, not fail on path
    const result = runGsdTools(['frontmatter', 'validate', tmpFile, '--schema', 'plan']);
    // Should succeed (exit 0) and return structured JSON with valid/missing, not a path-split error
    assert.ok(result.success, `Command should exit 0, got: ${result.error}`);
    const out = JSON.parse(result.output);
    assert.ok('valid' in out, 'should return structured JSON with "valid" field');
  });
});

// ─── verify-path-exists with absolute path containing spaces ─────────────────

describe('bug-3509: verify-path-exists survives absolute paths with spaces', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createSpacedTmpDir();
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases'), { recursive: true });
  });

  afterEach(() => cleanup(tmpDir));

  test('absolute path with spaces resolves correctly via array form', () => {
    const absFile = path.join(tmpDir, 'abs-test.txt');
    fs.writeFileSync(absFile, 'content');

    const result = runGsdTools(['verify-path-exists', absFile], tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const output = JSON.parse(result.output);
    assert.strictEqual(output.exists, true, 'file should be found');
    assert.strictEqual(output.type, 'file');
  });
});

// ─── profile-pipeline --path with spaces ─────────────────────────────────────

describe('bug-3509: scan-sessions --path survives spaces in path', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createSpacedTmpDir();
  });

  afterEach(() => cleanup(tmpDir));

  test('scan-sessions --path with spaces returns empty array, not path-split error', () => {
    const sessionsDir = path.join(tmpDir, 'projects');
    fs.mkdirSync(sessionsDir, { recursive: true });

    const result = runGsdTools(['scan-sessions', '--path', sessionsDir, '--raw'], tmpDir);
    assert.ok(result.success, `Failed: ${result.error}`);
    const out = JSON.parse(result.output);
    assert.ok(Array.isArray(out), 'should return an array');
    assert.strictEqual(out.length, 0, 'should be empty for empty sessions dir');
  });
});
