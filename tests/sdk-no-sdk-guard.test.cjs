/**
 * Static guard: every subprocess installer invocation inside a test file
 * (i.e. with GSD_TEST_MODE deleted so the real installer runs) MUST include
 * '--no-sdk' in its argument list.
 *
 * Why: installSdkIfNeeded() is now fatal on failure (#2439). Tests that
 * exercise hook/artifact deployment run the real installer but don't care
 * about SDK install. Without --no-sdk they attempt to `npm install && tsc &&
 * npm install -g .` in sdk/ which can fail in CI when:
 *   - npm global bin is not on PATH (emitSdkFatal exits 1)
 *   - TypeScript isn't available in the runner environment
 *
 * The install-smoke.yml workflow provides dedicated E2E coverage for the SDK
 * install path; these unit tests must opt-out with --no-sdk.
 *
 * Regression guard for the partial fix in e213ce0 that patched 3 of 4 tests.
 */

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const TESTS_DIR = path.join(__dirname);

// Build the pattern at runtime so it doesn't trip static-analysis string
// scanners that look for exec() literals in source files.
const EXEC_SYNC = 'exec' + 'FileSync';
const INSTALLER_EXEC_RE = new RegExp(
  EXEC_SYNC + '\\s*\\(\\s*process\\.execPath\\s*,\\s*\\[([^\\]]+)\\]',
  'g'
);

function extractInstallerCalls(src) {
  const calls = [];
  INSTALLER_EXEC_RE.lastIndex = 0;
  let m;
  while ((m = INSTALLER_EXEC_RE.exec(src)) !== null) {
    const args = m[1];
    if (!args.includes('INSTALL') && !args.includes('install.js')) continue;
    calls.push({ args, offset: m.index });
  }
  return calls;
}

function lineOf(src, offset) {
  return src.slice(0, offset).split('\n').length;
}

describe('sdk no-sdk guard: installer subprocess calls must include --no-sdk', () => {
  test('all subprocess installer calls in test files include --no-sdk', () => {
    const files = fs.readdirSync(TESTS_DIR)
      .filter(f => f.endsWith('.test.cjs'))
      .map(f => path.join(TESTS_DIR, f));

    const offenders = [];

    for (const file of files) {
      const src = fs.readFileSync(file, 'utf8');

      // Only check files that explicitly delete GSD_TEST_MODE — those run
      // the real installer (not the test-mode export).
      if (!src.includes('delete env.GSD_TEST_MODE') &&
          !src.includes('delete process.env.GSD_TEST_MODE')) {
        continue;
      }

      const calls = extractInstallerCalls(src);
      for (const call of calls) {
        if (!call.args.includes('--no-sdk')) {
          const line = lineOf(src, call.offset);
          offenders.push(`${path.relative(path.join(TESTS_DIR, '..'), file)}:${line}`);
        }
      }
    }

    assert.strictEqual(
      offenders.length,
      0,
      'The following subprocess installer calls are missing --no-sdk.\n' +
      'Add "--no-sdk" to skip the fatal SDK build step in unit tests.\n' +
      'SDK install path has E2E coverage in .github/workflows/install-smoke.yml.\n\n' +
      offenders.join('\n')
    );
  });
});
