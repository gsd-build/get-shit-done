/**
 * Tests for the isNewer() semver comparison function used in gsd-check-update.js.
 *
 * WHY DUPLICATED: isNewer() lives inside a template literal string passed to
 * spawn(process.execPath, ['-e', `...`]) — it runs in a detached child process
 * that has no access to the parent module scope. This means it cannot be
 * require()'d or imported from a shared module. The function is intentionally
 * inlined in the spawn string so it works in the child process context.
 *
 * We mirror the implementation here so the logic is testable. If the hook's
 * implementation diverges from this copy, the fix is to update this mirror —
 * not to restructure the hook (which would require changing the spawn pattern
 * across the entire hook architecture).
 */
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');

// Mirror of isNewer() from hooks/gsd-check-update.js (inside spawn template)
function isNewer(a, b) {
  const pa = (a || '').split('.').map(s => Number(s.replace(/-.*/, '')) || 0);
  const pb = (b || '').split('.').map(s => Number(s.replace(/-.*/, '')) || 0);
  for (let i = 0; i < 3; i++) {
    if (pa[i] > pb[i]) return true;
    if (pa[i] < pb[i]) return false;
  }
  return false;
}

describe('isNewer (semver comparison)', () => {
  test('newer major version', () => {
    assert.strictEqual(isNewer('2.0.0', '1.0.0'), true);
  });

  test('newer minor version', () => {
    assert.strictEqual(isNewer('1.1.0', '1.0.0'), true);
  });

  test('newer patch version', () => {
    assert.strictEqual(isNewer('1.0.1', '1.0.0'), true);
  });

  test('equal versions', () => {
    assert.strictEqual(isNewer('1.0.0', '1.0.0'), false);
  });

  test('older version returns false', () => {
    assert.strictEqual(isNewer('1.0.0', '2.0.0'), false);
  });

  test('installed ahead of npm (git install scenario)', () => {
    assert.strictEqual(isNewer('1.30.0', '1.31.0'), false);
  });

  test('npm ahead of installed (real update available)', () => {
    assert.strictEqual(isNewer('1.31.0', '1.30.0'), true);
  });

  test('pre-release suffix stripped', () => {
    assert.strictEqual(isNewer('1.0.1-beta.1', '1.0.0'), true);
  });

  test('pre-release on both sides', () => {
    assert.strictEqual(isNewer('2.0.0-rc.1', '1.9.0-beta.2'), true);
  });

  test('null/undefined handled', () => {
    assert.strictEqual(isNewer(null, '1.0.0'), false);
    assert.strictEqual(isNewer('1.0.0', null), true);
    assert.strictEqual(isNewer(null, null), false);
  });

  test('empty string handled', () => {
    assert.strictEqual(isNewer('', '1.0.0'), false);
    assert.strictEqual(isNewer('1.0.0', ''), true);
  });

  test('two-segment version (missing patch)', () => {
    assert.strictEqual(isNewer('1.1', '1.0'), true);
    assert.strictEqual(isNewer('1.0', '1.1'), false);
  });
});
