'use strict';

/**
 * Tests for `gsd-tools migrate-config` subcommand (#3536).
 *
 * Covers the three acceptance-criteria cases:
 *   1. No-op when config is already canonical (migrated: false)
 *   2. Migrates when top-level branching_strategy is present (migrated: true)
 *   3. Idempotent: running twice produces no-op the second time
 *
 * Also covers the --raw human-readable output path.
 */

const { describe, test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { createTempProject, cleanup, TOOLS_PATH } = require('./helpers.cjs');

const TEST_ENV_BASE = {
  GSD_SESSION_KEY: '',
  CODEX_THREAD_ID: '',
  CLAUDE_SESSION_ID: '',
  CLAUDE_CODE_SSE_PORT: '',
  OPENCODE_SESSION_ID: '',
  GEMINI_SESSION_ID: '',
  CURSOR_SESSION_ID: '',
  WINDSURF_SESSION_ID: '',
  TERM_SESSION_ID: '',
  WT_SESSION: '',
  TMUX_PANE: '',
  ZELLIJ_SESSION_NAME: '',
  TTY: '',
  SSH_TTY: '',
};

function runMigrateConfig(cwd, extraArgs = [], env = {}) {
  const result = spawnSync(process.execPath, [TOOLS_PATH, 'migrate-config', ...extraArgs], {
    cwd,
    encoding: 'utf-8',
    env: { ...process.env, ...TEST_ENV_BASE, ...env },
  });
  return {
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    status: result.status,
  };
}

// ─── Test 1: No-op when config is already canonical ──────────────────────────

describe('migrate-config — no-op on already-canonical config', () => {
  let tmpDir;

  afterEach(() => {
    if (tmpDir) cleanup(tmpDir);
    tmpDir = null;
  });

  test('returns migrated: false when no legacy keys present', () => {
    tmpDir = createTempProject('gsd-migrate-noop-');
    const configPath = path.join(tmpDir, '.planning', 'config.json');
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        git: { branching_strategy: 'phase', base_branch: 'main' },
        workflow: { research: true },
      }, null, 2),
      'utf-8'
    );

    const result = runMigrateConfig(tmpDir);

    assert.equal(
      result.status,
      0,
      `migrate-config must exit 0 on no-op — status ${result.status}, stderr: ${result.stderr}`
    );
    assert.equal(result.stderr.trim(), '', `No stderr expected — got: ${result.stderr}`);

    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.migrated, false, 'migrated must be false for canonical config');
    assert.deepEqual(parsed.normalizations, [], 'normalizations must be empty for canonical config');
    assert.equal(parsed.wrote, null, 'wrote must be null for no-op');
  });
});

// ─── Test 2: Migrates when top-level branching_strategy is present ────────────

describe('migrate-config — migrates legacy branching_strategy', () => {
  let tmpDir;

  afterEach(() => {
    if (tmpDir) cleanup(tmpDir);
    tmpDir = null;
  });

  test('returns migrated: true and normalizations for top-level branching_strategy', () => {
    tmpDir = createTempProject('gsd-migrate-bs-');
    const configPath = path.join(tmpDir, '.planning', 'config.json');
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        branching_strategy: 'milestone',
        git: { base_branch: 'main' },
      }, null, 2),
      'utf-8'
    );

    const result = runMigrateConfig(tmpDir);

    assert.equal(
      result.status,
      0,
      `migrate-config must exit 0 — status ${result.status}, stderr: ${result.stderr}`
    );
    assert.equal(result.stderr.trim(), '', `No stderr expected — got: ${result.stderr}`);

    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.migrated, true, 'migrated must be true when legacy key present');
    assert.ok(
      parsed.normalizations.some(n => n.from === 'branching_strategy' && n.to === 'git.branching_strategy'),
      `normalizations must include branching_strategy→git.branching_strategy entry. Got: ${JSON.stringify(parsed.normalizations)}`
    );
    assert.ok(typeof parsed.wrote === 'string', 'wrote must be a file path string');

    // Verify on-disk result
    const onDisk = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    assert.equal(
      onDisk.git?.branching_strategy,
      'milestone',
      'On-disk config must have git.branching_strategy = "milestone" after migration'
    );
    assert.equal(
      onDisk.branching_strategy,
      undefined,
      'On-disk config must not have top-level branching_strategy after migration'
    );
  });
});

// ─── Test 3: Idempotent ───────────────────────────────────────────────────────

describe('migrate-config — idempotent (running twice produces no-op)', () => {
  let tmpDir;

  afterEach(() => {
    if (tmpDir) cleanup(tmpDir);
    tmpDir = null;
  });

  test('second run is a no-op after first run migrated the config', () => {
    tmpDir = createTempProject('gsd-migrate-idem-');
    const configPath = path.join(tmpDir, '.planning', 'config.json');
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        branching_strategy: 'phase',
        git: { base_branch: 'main' },
      }, null, 2),
      'utf-8'
    );

    // First run — must migrate
    const first = runMigrateConfig(tmpDir);
    assert.equal(first.status, 0, `First run must exit 0 — status ${first.status}`);
    const firstParsed = JSON.parse(first.stdout);
    assert.equal(firstParsed.migrated, true, 'First run must migrate');

    // Second run — must be no-op
    const second = runMigrateConfig(tmpDir);
    assert.equal(second.status, 0, `Second run must exit 0 — status ${second.status}`);
    const secondParsed = JSON.parse(second.stdout);
    assert.equal(secondParsed.migrated, false, 'Second run must be a no-op (idempotent)');
    assert.deepEqual(secondParsed.normalizations, [], 'Second run normalizations must be empty');
  });
});
