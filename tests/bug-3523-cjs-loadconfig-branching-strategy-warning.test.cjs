'use strict';

// allow-test-rule: validates runtime CLI stdout/stderr warning behavior, not source grep

/**
 * Regression tests for #3523 — CJS loadConfig must not emit a false
 * "unknown config key(s)" warning for `branching_strategy` when that key
 * is written at the top level of .planning/config.json.
 *
 * Root cause: KNOWN_TOP_LEVEL in core.cjs was built from VALID_CONFIG_KEYS
 * via k.split('.')[0], which turns 'git.branching_strategy' → 'git', not
 * 'branching_strategy'. So a config with the legacy top-level shape tripped
 * the unknown-key warning even though core.cjs:485 actively reads the value.
 *
 * Fix (option 3 — self-healing): mirror the multiRepo → planning.sub_repos
 * precedent: graft branching_strategy into fileData.git.branching_strategy
 * and delete the top-level key, then persist. The KNOWN_TOP_LEVEL list also
 * gains 'branching_strategy' as a deprecated-still-accepted key so the warning
 * never fires even on the first read before the write-back occurs.
 *
 * Double-emission is also reduced: the warning site is guarded by a
 * module-level Set so repeated loadConfig calls during one CLI invocation
 * don't echo the same line twice.
 *
 * CJS↔SDK contract: the SDK mergeDefaults() already handles the legacy
 * top-level key (PR #3116). This file adds a fixture-level parity check
 * that proves both paths produce the same branching_strategy value.
 *
 * Test strategy: we use `resolve-model` as the minimal CJS entry point that
 * calls loadConfig internally, then assert on stderr emptiness (typed-IR
 * "no warning" pattern from #2687).
 */

const { describe, test, afterEach, before } = require('node:test');
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

/**
 * Run gsd-tools and return { stdout, stderr, status }.
 * Always captures stderr even when exit code is 0.
 */
function runWithStderr(args, cwd, env = {}) {
  const result = spawnSync(process.execPath, [TOOLS_PATH, ...args], {
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

// ─── Test 1: no warning for legacy top-level branching_strategy ──────────────

describe('bug-3523 — no warning for legacy top-level branching_strategy', () => {
  let tmpDir;

  afterEach(() => {
    if (tmpDir) cleanup(tmpDir);
    tmpDir = null;
  });

  test('loadConfig emits no stderr when config.json has top-level branching_strategy', () => {
    tmpDir = createTempProject('gsd-3523-warn-');
    const configPath = path.join(tmpDir, '.planning', 'config.json');
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        branching_strategy: 'phase',
        git: { base_branch: 'main' },
      }, null, 2),
      'utf-8'
    );

    // resolve-model calls loadConfig internally, triggering KNOWN_TOP_LEVEL check.
    const result = runWithStderr(['resolve-model', 'planner'], tmpDir);

    assert.equal(
      result.stderr.trim(),
      '',
      `loadConfig must not warn about top-level branching_strategy (#3523) — got: ${result.stderr}`
    );
  });

  test('branching_strategy value is still surfaced after loadConfig on legacy shape', () => {
    tmpDir = createTempProject('gsd-3523-value-');
    const configPath = path.join(tmpDir, '.planning', 'config.json');
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        branching_strategy: 'milestone',
        git: { base_branch: 'main' },
      }, null, 2),
      'utf-8'
    );

    // Trigger loadConfig (which runs the migration and writes git.branching_strategy
    // back to disk), then read it with config-get to verify the value is preserved.
    const triggerResult = runWithStderr(['resolve-model', 'planner'], tmpDir);
    assert.equal(
      triggerResult.stderr.trim(),
      '',
      `No warning should fire on legacy shape (#3523) — got: ${triggerResult.stderr}`
    );

    // After migration write-back, config-get should find git.branching_strategy.
    const result = runWithStderr(['config-get', 'git.branching_strategy'], tmpDir);

    assert.equal(
      result.status,
      0,
      `config-get command must succeed — exit status ${result.status}, stderr: ${result.stderr}`
    );
    assert.equal(
      result.stderr.trim(),
      '',
      `No error should fire when reading migrated branching_strategy (#3523) — got: ${result.stderr}`
    );
    assert.ok(
      result.stdout.includes('milestone'),
      `Expected git.branching_strategy to be 'milestone' but got: ${result.stdout}`
    );
  });
});

// ─── Test 2: no duplicated warning (double-emission) ─────────────────────────

describe('bug-3523 — double-emission reduced to single-emission', () => {
  let tmpDir;

  afterEach(() => {
    if (tmpDir) cleanup(tmpDir);
    tmpDir = null;
  });

  test('unknown-key warning appears at most once per process invocation', () => {
    // Use a key that IS genuinely unknown (not branching_strategy, which is now
    // fixed) to verify the deduplication guard works for other keys too.
    // We verify that the count of warning lines for a single unknown key is
    // exactly once — not zero and not two — even if loadConfig is invoked twice internally.
    tmpDir = createTempProject('gsd-3523-dedup-');
    const configPath = path.join(tmpDir, '.planning', 'config.json');
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        // intentionally_unknown_key_for_dedup_test: a key that can never be valid
        __gsd3523_dedup_sentinel__: true,
      }, null, 2),
      'utf-8'
    );

    const result = runWithStderr(['resolve-model', 'planner'], tmpDir);

    // Count how many times the sentinel key appears in warnings
    const warningLines = result.stderr
      .split('\n')
      .filter(l => l.includes('__gsd3523_dedup_sentinel__'));

    assert.equal(
      warningLines.length,
      1,
      `Unknown-key warning must appear exactly once per process invocation — ` +
      `appeared ${warningLines.length} times. stderr:\n${result.stderr}`
    );
  });
});

// ─── Test 3: on-disk migration (option 3 write-back) ─────────────────────────

describe('bug-3523 — option 3 on-disk migration of branching_strategy', () => {
  let tmpDir;

  afterEach(() => {
    if (tmpDir) cleanup(tmpDir);
    tmpDir = null;
  });

  test('after loadConfig, on-disk config.json has branching_strategy under git.*', () => {
    tmpDir = createTempProject('gsd-3523-writeback-');
    const configPath = path.join(tmpDir, '.planning', 'config.json');
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        branching_strategy: 'phase',
        git: { base_branch: 'main' },
      }, null, 2),
      'utf-8'
    );

    // Trigger loadConfig by running a command.
    runWithStderr(['resolve-model', 'planner'], tmpDir);

    // On-disk file should now have git.branching_strategy and no top-level branching_strategy.
    const onDisk = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    assert.equal(
      onDisk.git?.branching_strategy,
      'phase',
      'Expected on-disk config.json to have git.branching_strategy = "phase" after migration'
    );
    assert.equal(
      onDisk.branching_strategy,
      undefined,
      'Expected on-disk config.json to have no top-level branching_strategy after migration'
    );
  });

  test('migration does not clobber existing git.branching_strategy', () => {
    // If git.branching_strategy is already set, the top-level value should
    // not overwrite it (nested wins, matching SDK mergeDefaults precedence).
    tmpDir = createTempProject('gsd-3523-no-clobber-');
    const configPath = path.join(tmpDir, '.planning', 'config.json');
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        branching_strategy: 'phase',       // legacy top-level
        git: {
          base_branch: 'main',
          branching_strategy: 'milestone', // canonical nested — must win
        },
      }, null, 2),
      'utf-8'
    );

    // Trigger loadConfig.
    runWithStderr(['resolve-model', 'planner'], tmpDir);

    const onDisk = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    assert.equal(
      onDisk.git?.branching_strategy,
      'milestone',
      'canonical git.branching_strategy must not be overwritten by legacy top-level key'
    );
    // top-level key should be removed since it was redundant
    assert.equal(
      onDisk.branching_strategy,
      undefined,
      'top-level branching_strategy should be removed even when git.branching_strategy already set'
    );
  });

  test('workstream load also self-heals legacy root branching_strategy', () => {
    tmpDir = createTempProject('gsd-3523-workstream-root-');
    const rootConfigPath = path.join(tmpDir, '.planning', 'config.json');
    const workstreamDir = path.join(tmpDir, '.planning', 'workstreams', 'alpha');
    fs.mkdirSync(workstreamDir, { recursive: true });
    fs.writeFileSync(
      rootConfigPath,
      JSON.stringify({
        branching_strategy: 'phase',
        git: { base_branch: 'main' },
      }, null, 2),
      'utf-8'
    );
    fs.writeFileSync(
      path.join(workstreamDir, 'config.json'),
      JSON.stringify({ workflow: { tdd: true } }, null, 2),
      'utf-8'
    );

    const triggerResult = runWithStderr(['resolve-model', 'planner'], tmpDir, {
      GSD_WORKSTREAM: 'alpha',
    });

    assert.equal(
      triggerResult.status,
      0,
      `workstream load command must succeed — exit status ${triggerResult.status}, stderr: ${triggerResult.stderr}`
    );
    assert.equal(
      triggerResult.stderr.trim(),
      '',
      `No warning should fire while migrating root config for a workstream — got: ${triggerResult.stderr}`
    );

    const onDisk = JSON.parse(fs.readFileSync(rootConfigPath, 'utf-8'));
    assert.equal(
      onDisk.git?.branching_strategy,
      'phase',
      'Expected root config.json to persist git.branching_strategy after workstream load'
    );
    assert.equal(
      onDisk.branching_strategy,
      undefined,
      'Expected root config.json to remove top-level branching_strategy after workstream load'
    );

    const rootResult = runWithStderr(['config-get', 'git.branching_strategy'], tmpDir);
    assert.equal(
      rootResult.status,
      0,
      `root config-get command must succeed after workstream migration — exit status ${rootResult.status}, stderr: ${rootResult.stderr}`
    );
    assert.ok(
      rootResult.stdout.includes('phase'),
      `Expected migrated root git.branching_strategy to be 'phase' but got: ${rootResult.stdout}`
    );
  });
});

// ─── Test 4: CJS↔SDK contract parity ────────────────────────────────────────

describe('bug-3523 — CJS↔SDK contract: both agree on legacy branching_strategy fixture', () => {
  /**
   * This is a light-touch contract test: we invoke the CJS path via CLI and
   * compare the branching_strategy value it returns against what the SDK's
   * mergeDefaults would compute for the same fixture.
   *
   * We can't import SDK TypeScript here, so we assert on the CJS output and
   * use a snapshot of expected SDK behavior derived from the mergeDefaults
   * source (sdk/src/config.ts:192-218):
   *   mergeDefaults({ branching_strategy: 'phase', git: { base_branch: 'main' } })
   *   → git.branching_strategy = 'phase'
   */
  let tmpDir;

  afterEach(() => {
    if (tmpDir) cleanup(tmpDir);
    tmpDir = null;
  });

  test('CJS loadConfig surfaces branching_strategy matching SDK mergeDefaults behavior', () => {
    tmpDir = createTempProject('gsd-3523-parity-');
    const configPath = path.join(tmpDir, '.planning', 'config.json');
    // The fixture that the SDK's mergeDefaults handles correctly (PR #3116).
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        branching_strategy: 'phase',
        git: { base_branch: 'main' },
      }, null, 2),
      'utf-8'
    );

    // SDK mergeDefaults produces: git.branching_strategy = 'phase'
    // CJS loadConfig must produce the same. Trigger loadConfig first (migration
    // writes git.branching_strategy to disk), then verify with config-get.
    const triggerResult = runWithStderr(['resolve-model', 'planner'], tmpDir);
    assert.equal(
      triggerResult.stderr.trim(),
      '',
      `No warning must fire on a standard legacy fixture — got: ${triggerResult.stderr}`
    );

    // After the migration write-back, config-get must find git.branching_strategy = 'phase',
    // matching what the SDK's mergeDefaults would compute.
    const result = runWithStderr(['config-get', 'git.branching_strategy'], tmpDir);

    assert.equal(
      result.status,
      0,
      `config-get command must succeed — exit status ${result.status}, stderr: ${result.stderr}`
    );
    assert.equal(
      result.stderr.trim(),
      '',
      `No error when reading post-migration git.branching_strategy — got: ${result.stderr}`
    );
    assert.ok(
      result.stdout.includes('phase'),
      `CJS must agree with SDK: git.branching_strategy = 'phase' for legacy fixture. ` +
      `Got: ${result.stdout}`
    );
  });
});
