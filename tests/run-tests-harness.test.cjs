// allow-test-rule: run-tests.cjs is a CLI test harness whose only IR is its
// stable stderr line `run-tests: suite="X" files=N: name1 name2 ...` plus its
// exit code. No typed IR is exposable from a shell script; the printed line
// IS the contract this test pins. See docs/TESTING-SUITES.md and issue #3597.
//
// Tests for scripts/run-tests.cjs --suite filtering (issue #3597).
//
// Drives the harness through its subprocess seam — the same seam CI uses —
// rather than importing internals. Each test seeds a temporary directory
// with mock `.test.cjs` files (each one a trivial node:test no-op) and
// runs the harness against it via GSD_TEST_DIR.

'use strict';

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const { createTempDir, cleanup } = require('./helpers.cjs');

const HARNESS = path.join(__dirname, '..', 'scripts', 'run-tests.cjs');

// Minimal valid node:test file. Each fixture file passes when executed.
const PASS_BODY = `'use strict';
const { test } = require('node:test');
test('noop', () => {});
`;

function seed(dir, names) {
  for (const name of names) {
    fs.writeFileSync(path.join(dir, name), PASS_BODY, 'utf8');
  }
}

function runHarness(testDir, args = [], extraEnv = {}) {
  // Clear node:test parent-context env so the harness's child `node --test`
  // doesn't refuse to run with "recursive run() skipping running files".
  const env = { ...process.env, GSD_TEST_DIR: testDir, ...extraEnv };
  delete env.NODE_TEST_CONTEXT;
  return spawnSync(process.execPath, [HARNESS, ...args], {
    cwd: path.join(__dirname, '..'),
    env,
    encoding: 'utf8',
  });
}

describe('run-tests.cjs harness (issue #3597)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempDir('gsd-3597-harness-');
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  describe('argument parsing', () => {
    test('unknown suite name exits non-zero with valid-suites hint', () => {
      seed(tmpDir, ['a.test.cjs']);
      const r = runHarness(tmpDir, ['--suite', 'bogus']);
      assert.notStrictEqual(r.status, 0);
      assert.match(r.stderr, /unknown suite/i);
      assert.match(r.stderr, /unit/);
      assert.match(r.stderr, /security/);
    });

    test('missing --suite value exits non-zero', () => {
      seed(tmpDir, ['a.test.cjs']);
      const r = runHarness(tmpDir, ['--suite']);
      assert.notStrictEqual(r.status, 0);
      assert.match(r.stderr, /requires a value/i);
    });

    test('duplicate --suite flag is rejected', () => {
      seed(tmpDir, ['a.test.cjs']);
      const r = runHarness(tmpDir, ['--suite', 'unit', '--suite', 'security']);
      assert.notStrictEqual(r.status, 0);
      assert.match(r.stderr, /duplicate/i);
    });

    test('unknown positional argument is rejected', () => {
      seed(tmpDir, ['a.test.cjs']);
      const r = runHarness(tmpDir, ['unit']);
      assert.notStrictEqual(r.status, 0);
      assert.match(r.stderr, /unknown argument/i);
    });

    test('--suite=value syntax is accepted', () => {
      seed(tmpDir, ['a.test.cjs', 'b.security.test.cjs']);
      const r = runHarness(tmpDir, ['--suite=security']);
      assert.strictEqual(r.status, 0, `stderr: ${r.stderr}\nstdout: ${r.stdout}`);
    });
  });

  describe('suite filtering', () => {
    test('no flag runs ALL test files (backcompat)', () => {
      seed(tmpDir, [
        'a.test.cjs',
        'b.security.test.cjs',
        'c.integration.test.cjs',
      ]);
      const r = runHarness(tmpDir);
      assert.strictEqual(r.status, 0);
      // node:test TAP output mentions each file path.
      assert.ok(r.stderr.includes('a.test.cjs'), 'expected a.test.cjs in output');
      assert.ok(
        r.stderr.includes('b.security.test.cjs'),
        'expected b.security.test.cjs in output',
      );
      assert.ok(
        r.stderr.includes('c.integration.test.cjs'),
        'expected c.integration.test.cjs in output',
      );
    });

    test('--suite all is equivalent to no flag', () => {
      seed(tmpDir, ['a.test.cjs', 'b.security.test.cjs']);
      const r = runHarness(tmpDir, ['--suite', 'all']);
      assert.strictEqual(r.status, 0);
      assert.ok(r.stderr.includes('a.test.cjs'));
      assert.ok(r.stderr.includes('b.security.test.cjs'));
    });

    test('--suite unit excludes marked suites', () => {
      seed(tmpDir, [
        'a.test.cjs',
        'b.security.test.cjs',
        'c.integration.test.cjs',
        'd.install.test.cjs',
        'e.slow.test.cjs',
      ]);
      const r = runHarness(tmpDir, ['--suite', 'unit']);
      assert.strictEqual(r.status, 0, `stderr: ${r.stderr}`);
      assert.ok(r.stderr.includes('a.test.cjs'));
      assert.ok(!r.stderr.includes('b.security.test.cjs'));
      assert.ok(!r.stderr.includes('c.integration.test.cjs'));
      assert.ok(!r.stderr.includes('d.install.test.cjs'));
      assert.ok(!r.stderr.includes('e.slow.test.cjs'));
    });

    test('--suite security selects only *.security.test.cjs', () => {
      seed(tmpDir, [
        'a.test.cjs',
        'b.security.test.cjs',
        'c.integration.test.cjs',
      ]);
      const r = runHarness(tmpDir, ['--suite', 'security']);
      assert.strictEqual(r.status, 0);
      assert.ok(r.stderr.includes('b.security.test.cjs'));
      assert.ok(!r.stderr.includes('a.test.cjs'));
      assert.ok(!r.stderr.includes('c.integration.test.cjs'));
    });

    test('--suite integration selects only *.integration.test.cjs', () => {
      seed(tmpDir, ['a.test.cjs', 'b.integration.test.cjs']);
      const r = runHarness(tmpDir, ['--suite', 'integration']);
      assert.strictEqual(r.status, 0);
      assert.ok(r.stderr.includes('b.integration.test.cjs'));
      assert.ok(!r.stderr.includes('a.test.cjs'));
    });

    test('--suite install selects only *.install.test.cjs', () => {
      seed(tmpDir, ['a.test.cjs', 'b.install.test.cjs']);
      const r = runHarness(tmpDir, ['--suite', 'install']);
      assert.strictEqual(r.status, 0);
      assert.ok(r.stderr.includes('b.install.test.cjs'));
    });

    test('--suite slow selects only *.slow.test.cjs', () => {
      seed(tmpDir, ['a.test.cjs', 'b.slow.test.cjs']);
      const r = runHarness(tmpDir, ['--suite', 'slow']);
      assert.strictEqual(r.status, 0);
      assert.ok(r.stderr.includes('b.slow.test.cjs'));
    });
  });

  describe('empty-suite behavior', () => {
    test('--suite security with zero matching files exits 0 with a notice', () => {
      seed(tmpDir, ['a.test.cjs']);
      const r = runHarness(tmpDir, ['--suite', 'security']);
      assert.strictEqual(r.status, 0);
      assert.match(r.stderr, /no tests in suite/i);
    });

    test('completely empty test dir still exits non-zero (preserves prior behavior)', () => {
      const r = runHarness(tmpDir);
      assert.notStrictEqual(r.status, 0);
      assert.match(r.stderr, /no test files/i);
    });
  });

  describe('failure propagation', () => {
    test('non-zero from node:test propagates through harness', () => {
      const FAIL = `'use strict';
const { test } = require('node:test');
test('boom', () => { throw new Error('intentional'); });
`;
      fs.writeFileSync(path.join(tmpDir, 'a.test.cjs'), FAIL, 'utf8');
      const r = runHarness(tmpDir);
      assert.notStrictEqual(
        r.status,
        0,
        `expected non-zero exit; got status=${r.status} signal=${r.signal}\nSTDOUT:\n${r.stdout}\nSTDERR:\n${r.stderr}`,
      );
    });
  });

  describe('Windows argv-overflow chunking (issue #3597)', () => {
    // Windows CreateProcess caps lpCommandLine at 32,767 chars. With ~550
    // tests the unchunked spawn fails instantly on Windows with no test
    // output. Linux/macOS allow ~2 MB so the same path works there. The
    // harness chunks selected files so each spawn stays under the ceiling,
    // and chunking is observable via the `run-tests: chunk N/M …` stderr
    // line. Long filenames force chunking even with a modest file count so
    // the test stays fast on every platform.
    test('chunks when total argv would exceed configured ceiling', () => {
      // Use a deliberately low MAX_CMDLINE_CHARS so the test is independent
      // of tmp-path length (varies by OS). With a 2000-char ceiling and 30
      // tests at ≥100 char paths, chunking must engage and at least one
      // `chunk N/M …` marker must appear in stderr.
      const longPrefix = 'a-deliberately-long-test-filename-to-force-chunking-behavior-cross-platform-';
      const names = Array.from({ length: 30 }, (_, i) => `${longPrefix}${String(i).padStart(4, '0')}.test.cjs`);
      seed(tmpDir, names);
      const r = runHarness(tmpDir, [], { RUN_TESTS_MAX_CMDLINE_CHARS: '2000' });
      assert.strictEqual(
        r.status,
        0,
        `expected zero exit; got status=${r.status} signal=${r.signal}\nSTDERR (tail):\n${r.stderr.split('\n').slice(-20).join('\n')}`,
      );
      assert.match(
        r.stderr,
        /run-tests: chunk \d+\/\d+ — \d+ files/,
        `expected chunking marker in stderr; STDERR (tail):\n${r.stderr.split('\n').slice(-20).join('\n')}`,
      );
    });
  });
});
