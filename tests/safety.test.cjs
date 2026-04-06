/**
 * Tests for safety.cjs — agent guardrails for autonomous improvement sessions
 */
'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { createTempGitProject, createTempDir, cleanup } = require('./helpers.cjs');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const {
  getProtectedFiles, isFileProtected, isSafeImprovement,
  createCircuitBreaker, scopeCheck, validateMergeReadiness,
  SAFE_TYPES, UNSAFE_TYPES, MAX_FILES_PER_IMPROVEMENT,
} = require('../get-shit-done/bin/lib/safety.cjs');

// --- getProtectedFiles -------------------------------------------------------

describe('getProtectedFiles', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = createTempGitProject('gsd-safety-protect-'); });
  afterEach(() => cleanup(tmpDir));

  it('returns empty when no uncommitted changes', () => {
    const files = getProtectedFiles(tmpDir);
    assert.deepEqual(files, []);
  });

  it('returns unstaged modified files', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'PROJECT.md'), '# Changed\n');
    const files = getProtectedFiles(tmpDir);
    assert.ok(files.includes('.planning/PROJECT.md'));
  });

  it('returns staged files', () => {
    const newFile = path.join(tmpDir, 'staged.js');
    fs.writeFileSync(newFile, 'const x = 1;\n');
    spawnSync('git', ['add', 'staged.js'], { cwd: tmpDir, stdio: 'pipe' });
    const files = getProtectedFiles(tmpDir);
    assert.ok(files.includes('staged.js'));
  });

  it('returns empty for null cwd', () => {
    assert.deepEqual(getProtectedFiles(null), []);
  });
});

// --- isFileProtected ---------------------------------------------------------

describe('isFileProtected', () => {
  it('matches exact path', () => {
    assert.ok(isFileProtected('src/app.js', ['src/app.js']));
  });

  it('matches file inside protected directory', () => {
    assert.ok(isFileProtected('src/auth/login.js', ['src/auth']));
  });

  it('matches protected directory inside file path', () => {
    assert.ok(isFileProtected('src/auth', ['src/auth/login.js']));
  });

  it('does not match unrelated paths', () => {
    assert.ok(!isFileProtected('src/other.js', ['src/app.js']));
  });

  it('normalizes backslashes', () => {
    assert.ok(isFileProtected('src\\app.js', ['src/app.js']));
  });

  it('returns false for empty inputs', () => {
    assert.ok(!isFileProtected(null, ['src/app.js']));
    assert.ok(!isFileProtected('src/app.js', null));
    assert.ok(!isFileProtected('src/app.js', []));
  });
});

// --- isSafeImprovement -------------------------------------------------------

describe('isSafeImprovement', () => {
  it('classifies safe types', () => {
    for (const type of SAFE_TYPES) {
      const result = isSafeImprovement({ type });
      assert.ok(result.safe, `${type} should be safe`);
    }
  });

  it('classifies unsafe types', () => {
    for (const type of UNSAFE_TYPES) {
      const result = isSafeImprovement({ type });
      assert.ok(!result.safe, `${type} should be unsafe`);
    }
  });

  it('defaults unknown types to unsafe', () => {
    const result = isSafeImprovement({ type: 'unknown-thing' });
    assert.ok(!result.safe);
    assert.ok(result.reason.includes('Unknown'));
  });

  it('rejects missing type', () => {
    assert.ok(!isSafeImprovement({}).safe);
    assert.ok(!isSafeImprovement(null).safe);
  });
});

// --- createCircuitBreaker ----------------------------------------------------

describe('createCircuitBreaker', () => {
  it('is not tripped initially', () => {
    const cb = createCircuitBreaker(3);
    assert.ok(!cb.isTripped());
  });

  it('trips after consecutive failures', () => {
    const cb = createCircuitBreaker(3);
    cb.recordFailure();
    cb.recordFailure();
    assert.ok(!cb.isTripped());
    cb.recordFailure();
    assert.ok(cb.isTripped());
  });

  it('resets consecutive count on success', () => {
    const cb = createCircuitBreaker(3);
    cb.recordFailure();
    cb.recordFailure();
    cb.recordSuccess();
    assert.ok(!cb.isTripped());
    assert.equal(cb.getState().consecutiveFailures, 0);
  });

  it('tracks total failures through resets', () => {
    const cb = createCircuitBreaker(3);
    cb.recordFailure();
    cb.recordSuccess();
    cb.recordFailure();
    assert.equal(cb.getState().totalFailures, 2);
    assert.equal(cb.getState().totalSuccesses, 1);
  });

  it('reset clears all counters', () => {
    const cb = createCircuitBreaker(3);
    cb.recordFailure();
    cb.recordSuccess();
    cb.reset();
    const state = cb.getState();
    assert.equal(state.consecutiveFailures, 0);
    assert.equal(state.totalFailures, 0);
    assert.equal(state.totalSuccesses, 0);
  });

  it('defaults to max 3 if not specified', () => {
    const cb = createCircuitBreaker();
    cb.recordFailure();
    cb.recordFailure();
    assert.ok(!cb.isTripped());
    cb.recordFailure();
    assert.ok(cb.isTripped());
  });
});

// --- scopeCheck --------------------------------------------------------------

describe('scopeCheck', () => {
  it('accepts empty plan', () => {
    assert.ok(scopeCheck('').valid);
    assert.ok(scopeCheck(null).valid);
  });

  it('accepts plan within file limit', () => {
    const plan = 'Create: src/a.js\nModify: src/b.js';
    const result = scopeCheck(plan);
    assert.ok(result.valid);
    assert.equal(result.fileCount, 2);
  });

  it('rejects plan exceeding file limit', () => {
    const files = Array.from({ length: 6 }, (_, i) => `Create: src/${i}.js`).join('\n');
    const result = scopeCheck(files);
    assert.ok(!result.valid);
    assert.ok(result.reason.includes('files'));
  });

  it('rejects banned keywords', () => {
    assert.ok(!scopeCheck('This is a breaking change to the API').valid);
    assert.ok(!scopeCheck('Add new package for logging').valid);
    assert.ok(!scopeCheck('This adds a dependency on lodash').valid);
    assert.ok(!scopeCheck('This is an api change').valid);
  });

  it('deduplicates files', () => {
    const plan = 'Create: src/a.js\nModify: src/a.js\nEdit: src/b.js';
    const result = scopeCheck(plan);
    assert.ok(result.valid);
    assert.equal(result.fileCount, 2);
  });
});

// --- validateMergeReadiness --------------------------------------------------

describe('validateMergeReadiness', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = createTempDir('gsd-safety-merge-'); });
  afterEach(() => cleanup(tmpDir));

  it('rejects null worktree path', () => {
    const r = validateMergeReadiness(tmpDir, null, ['echo', 'ok']);
    assert.equal(r.ready, false);
    assert.ok(r.reason.includes('No worktree'));
  });

  it('rejects nonexistent worktree', () => {
    const r = validateMergeReadiness(tmpDir, '/nonexistent/path', ['echo', 'ok']);
    assert.equal(r.ready, false);
    assert.ok(r.reason.includes('does not exist'));
  });

  it('rejects non-array testArgs', () => {
    const r = validateMergeReadiness(tmpDir, tmpDir, 'echo ok');
    assert.equal(r.ready, false);
    assert.ok(r.reason.includes('array'));
  });

  it('rejects empty testArgs array', () => {
    const r = validateMergeReadiness(tmpDir, tmpDir, []);
    assert.equal(r.ready, false);
  });

  it('reports ready when tests pass', () => {
    const r = validateMergeReadiness(tmpDir, tmpDir, ['node', '-e', 'process.exit(0)']);
    assert.equal(r.ready, true);
    assert.ok(r.reason.includes('passed'));
  });

  it('reports not ready when tests fail', () => {
    const r = validateMergeReadiness(tmpDir, tmpDir, ['node', '-e', 'process.exit(1)']);
    assert.equal(r.ready, false);
    assert.ok(r.reason.includes('Tests failed'));
  });

  it('captures test output', () => {
    const r = validateMergeReadiness(tmpDir, tmpDir, ['node', '-e', 'console.log("hello"); process.exit(0)']);
    assert.ok(r.testOutput.includes('hello'));
  });
});
