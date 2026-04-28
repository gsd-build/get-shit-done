/**
 * Regression test for bug #2791 (Issue 2 — query registry not workstream-aware)
 *
 * When GSD_WORKSTREAM is set in the environment, `gsd-sdk query` commands must
 * route .planning/ reads to `.planning/workstreams/<name>/` — matching the
 * behaviour of `gsd-tools.cjs` which reads the same env var via planningDir().
 *
 * Before the fix: the SDK CLI only respected `--ws <name>` flag; GSD_WORKSTREAM
 * was ignored, so `gsd-sdk query roadmap.analyze` always read the root
 * `.planning/ROADMAP.md` even when a workstream was active.
 *
 * After the fix: the SDK CLI falls back to GSD_WORKSTREAM when --ws is absent.
 *
 * This test also verifies:
 * - The `gsd-tools` bin alias maps to the same SDK shim as `gsd-sdk` (#2791 Issue 1)
 */

'use strict';

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const childProc = require('node:child_process');
const { cleanup } = require('./helpers.cjs');
const os = require('node:os');

const REPO_ROOT = path.join(__dirname, '..');
const SDK_CLI = path.join(REPO_ROOT, 'sdk', 'dist', 'cli.js');
const PKG_JSON = path.join(REPO_ROOT, 'package.json');

function runSdkQuery(args, projectDir, extraEnv = {}) {
  let stdout = '';
  let exitCode = 0;
  try {
    stdout = childProc.execFileSync(
      process.execPath,
      [SDK_CLI, 'query', ...args, '--project-dir', projectDir],
      {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, GSD_SESSION_KEY: '', ...extraEnv },
      }
    );
  } catch (err) {
    exitCode = err.status ?? 1;
    stdout = (err.stdout?.toString() ?? '') + (err.stderr?.toString() ?? '');
  }
  let json = null;
  try { json = JSON.parse(stdout.trim()); } catch { /* ok */ }
  return { exitCode, stdout, json };
}

describe('bug-2791: GSD_WORKSTREAM env var respected by gsd-sdk query', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-test-2791-'));
    // Create root .planning/ with a minimal config
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.planning', 'config.json'), JSON.stringify({ mode: 'balanced' }));
    // Create workstream .planning/workstreams/my-ws/ with its own ROADMAP
    const wsDir = path.join(tmpDir, '.planning', 'workstreams', 'my-ws');
    fs.mkdirSync(path.join(wsDir, 'phases'), { recursive: true });
    fs.writeFileSync(
      path.join(wsDir, 'config.json'),
      JSON.stringify({ mode: 'balanced' })
    );
    fs.writeFileSync(
      path.join(wsDir, 'STATE.md'),
      '---\nmilestone: v1.0\n---\n\n# GSD State\n\n**Current Phase:** 1\n'
    );
    fs.writeFileSync(
      path.join(wsDir, 'ROADMAP.md'),
      [
        '## Roadmap v1.0: Workstream Work',
        '',
        '### Phase 1: Workstream Phase',
        '**Goal:** Test workstream routing',
        '- [ ] Task A',
      ].join('\n')
    );
    // Also create a root ROADMAP that is intentionally empty of phases
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      '## Roadmap v1.0: Root\n\n(no phases in root)\n'
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      '---\nmilestone: v1.0\n---\n\n# GSD State\n'
    );
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('without GSD_WORKSTREAM: roadmap.analyze reads root .planning/ROADMAP.md', () => {
    const result = runSdkQuery(['roadmap.analyze'], tmpDir);
    assert.strictEqual(result.exitCode, 0, `expected exit 0: ${result.stdout}`);
    assert.ok(result.json !== null, 'expected JSON output');
    // Root ROADMAP has no phases
    assert.strictEqual(
      result.json.phase_count,
      0,
      `expected 0 phases from root ROADMAP, got ${result.json.phase_count}`
    );
  });

  test('with GSD_WORKSTREAM set: roadmap.analyze reads workstream ROADMAP.md', () => {
    const result = runSdkQuery(['roadmap.analyze'], tmpDir, { GSD_WORKSTREAM: 'my-ws' });
    assert.strictEqual(result.exitCode, 0, `expected exit 0: ${result.stdout}`);
    assert.ok(result.json !== null, 'expected JSON output');
    // Workstream ROADMAP has 1 phase
    assert.strictEqual(
      result.json.phase_count,
      1,
      `expected 1 phase from workstream ROADMAP, got ${result.json.phase_count}`
    );
  });

  test('--ws flag takes precedence over GSD_WORKSTREAM env var', () => {
    // Set GSD_WORKSTREAM to a non-existent workstream; --ws should override it.
    // This verifies flag-wins-over-env precedence, not just that --ws works.
    const result = runSdkQuery(['roadmap.analyze', '--ws', 'my-ws'], tmpDir, {
      GSD_WORKSTREAM: 'nonexistent-ws',
    });
    assert.strictEqual(result.exitCode, 0, `expected exit 0: ${result.stdout}`);
    assert.ok(result.json !== null, 'expected JSON output');
    // --ws my-ws should route to the workstream ROADMAP which has 1 phase,
    // proving the flag overrides the env var (nonexistent-ws has no phases).
    assert.strictEqual(
      result.json.phase_count,
      1,
      `expected 1 phase via --ws flag (overriding GSD_WORKSTREAM), got ${result.json.phase_count}`
    );
  });

  test('invalid GSD_WORKSTREAM value is silently ignored and falls back to root', () => {
    const result = runSdkQuery(['roadmap.analyze'], tmpDir, { GSD_WORKSTREAM: '../evil' });
    // Should not crash; invalid name is silently ignored and falls back to root ROADMAP.
    assert.strictEqual(result.exitCode, 0, `expected exit 0 (invalid GSD_WORKSTREAM ignored): ${result.stdout}`);
    assert.ok(result.json !== null, 'expected JSON output after invalid GSD_WORKSTREAM fallback');
    // Root ROADMAP has no phases — confirming root fallback, not an error path.
    assert.strictEqual(
      result.json.phase_count,
      0,
      `expected 0 phases from root ROADMAP fallback (invalid GSD_WORKSTREAM), got ${result.json.phase_count}`
    );
  });
});

describe('bug-2791: package.json declares gsd-tools bin alias (#2791 Issue 1)', () => {
  test('package.json bin has gsd-tools entry', () => {
    const pkg = JSON.parse(fs.readFileSync(PKG_JSON, 'utf-8'));
    assert.ok(
      Object.prototype.hasOwnProperty.call(pkg.bin ?? {}, 'gsd-tools'),
      'package.json bin must include "gsd-tools" to provide collision-free alternative to gsd-sdk'
    );
  });

  test('gsd-tools bin entry points to same file as gsd-sdk', () => {
    const pkg = JSON.parse(fs.readFileSync(PKG_JSON, 'utf-8'));
    assert.strictEqual(
      pkg.bin['gsd-tools'],
      pkg.bin['gsd-sdk'],
      'gsd-tools and gsd-sdk must point to the same bin shim'
    );
  });
});
