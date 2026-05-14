'use strict';
process.env.GSD_TEST_MODE = '1';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const cp = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const SCRIPT = path.join(ROOT, 'bin', 'extract-changelog.cjs');

function run(args, stdin = '') {
  const result = cp.spawnSync('node', [SCRIPT, ...args], {
    input: stdin,
    timeout: 5000,
    encoding: 'utf8',
  });
  return {
    exitCode: result.status,
    stdout: (result.stdout || '').trim(),
    stderr: (result.stderr || '').trim(),
  };
}

const SAMPLE_CHANGELOG = `# Changelog

## [1.41.0] - 2026-01-10

### Added
- Feature A
- Feature B

### Fixed
- Bug fix X

## [1.39.1] - 2025-12-20

### Fixed
- Bug fix Y

## [1.38.5] - 2025-12-15

### Added
- Feature C

## [1.38.4] - 2025-12-10

### Fixed
- Bug fix Z

## [1.38.2] - 2025-12-01

### Added
- Feature D

## [1.37.1] - 2025-11-20

### Fixed
- Bug fix W
`;

describe('extract-changelog.cjs', () => {
  test('extracts all versions in range (from exclusive, to inclusive)', () => {
    const r = run(['--from', '1.37.1', '--to', '1.41.0'], SAMPLE_CHANGELOG);
    assert.equal(r.exitCode, 0);
    assert.ok(r.stdout.includes('[1.41.0]'), 'includes 1.41.0');
    assert.ok(r.stdout.includes('[1.39.1]'), 'includes 1.39.1');
    assert.ok(r.stdout.includes('[1.38.5]'), 'includes 1.38.5');
    assert.ok(r.stdout.includes('[1.38.4]'), 'includes 1.38.4');
    assert.ok(r.stdout.includes('[1.38.2]'), 'includes 1.38.2');
    assert.ok(!r.stdout.includes('[1.37.1]'), 'excludes fromVersion');
  });

  test('single version range returns just that version', () => {
    const r = run(['--from', '1.39.1', '--to', '1.41.0'], SAMPLE_CHANGELOG);
    assert.equal(r.exitCode, 0);
    assert.ok(r.stdout.includes('[1.41.0]'));
    assert.ok(!r.stdout.includes('[1.39.1]'));
    assert.ok(!r.stdout.includes('[1.38.5]'));
  });

  test('exit 2 when no versions match the range', () => {
    const r = run(['--from', '2.0.0', '--to', '3.0.0'], SAMPLE_CHANGELOG);
    assert.equal(r.exitCode, 2);
  });

  test('--json returns structured output', () => {
    const r = run(['--from', '1.37.1', '--to', '1.41.0', '--json'], SAMPLE_CHANGELOG);
    assert.equal(r.exitCode, 0);
    const parsed = JSON.parse(r.stdout);
    assert.equal(parsed.ok, true);
    assert.equal(parsed.from, '1.37.1');
    assert.equal(parsed.to, '1.41.0');
    assert.equal(parsed.count, 5);
    assert.deepEqual(parsed.versions, ['1.41.0', '1.39.1', '1.38.5', '1.38.4', '1.38.2']);
  });

  test('--json returns ok:false when no match', () => {
    const r = run(['--from', '2.0.0', '--to', '3.0.0', '--json'], SAMPLE_CHANGELOG);
    assert.equal(r.exitCode, 2);
    const parsed = JSON.parse(r.stdout);
    assert.equal(parsed.ok, false);
    assert.equal(parsed.count, 0);
  });

  test('exit 1 when --from or --to missing', () => {
    const r1 = run(['--to', '1.41.0'], SAMPLE_CHANGELOG);
    assert.equal(r1.exitCode, 1);

    const r2 = run(['--from', '1.37.1'], SAMPLE_CHANGELOG);
    assert.equal(r2.exitCode, 1);
  });

  test('equal from and to returns nothing (from is exclusive)', () => {
    const r = run(['--from', '1.41.0', '--to', '1.41.0'], SAMPLE_CHANGELOG);
    assert.equal(r.exitCode, 2);
  });

  test('strips leading v from version arguments', () => {
    const r = run(['--from', 'v1.37.1', '--to', 'v1.39.1'], SAMPLE_CHANGELOG);
    assert.equal(r.exitCode, 0);
    assert.ok(r.stdout.includes('[1.38.2]'));
    assert.ok(r.stdout.includes('[1.38.4]'));
    assert.ok(r.stdout.includes('[1.38.5]'));
  });

  test('--help prints usage and exits 0', () => {
    const r = run(['--help']);
    assert.equal(r.exitCode, 0);
    assert.ok(r.stdout.includes('Usage:'));
  });
});
