'use strict';

// Tests for graphify.cjs — auto-update describe block.
// Split from the consolidated 2336-LOC file. Refs #3761.
//
// Regression for #3347: opt-in auto-update of the knowledge graph after
// main HEAD advances. Two sub-concerns: config-key surface (config.test)
// and hook behavior (hook.test). Both merged here.

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('node:os');
const { execFileSync, spawnSync } = require('child_process');
const { createTempProject, cleanup, runGsdTools } = require('./helpers.cjs');

const {
  graphifyStatus,
} = require('../get-shit-done/bin/lib/graphify.cjs');

const {
  VALID_CONFIG_KEYS,
  isValidConfigKey,
} = require('../get-shit-done/bin/lib/config-schema.cjs');

const {
  CONFIG_DEFAULTS: CANONICAL_CONFIG_DEFAULTS,
} = require('../get-shit-done/bin/lib/configuration.generated.cjs');

const {
  makeStatusProject,
} = require('./helpers/graphify.cjs');

// ─── auto-update describe ─────────────────────────────────────────────────────

describe('auto-update', () => {
  describe('config-key surface', () => {
    // Regression for #3347

    test('VALID_CONFIG_KEYS contains graphify.auto_update', () => {
      assert.ok(
        VALID_CONFIG_KEYS.has('graphify.auto_update'),
        'graphify.auto_update must be in VALID_CONFIG_KEYS so config-set accepts it',
      );
    });

    test('isValidConfigKey accepts graphify.auto_update', () => {
      assert.ok(
        isValidConfigKey('graphify.auto_update'),
        'isValidConfigKey must return true for graphify.auto_update',
      );
    });

    test('isValidConfigKey still accepts the pre-existing graphify.enabled key', () => {
      assert.ok(
        isValidConfigKey('graphify.enabled'),
        'regression guard: graphify.enabled must remain a valid key',
      );
    });

    test('CANONICAL_CONFIG_DEFAULTS.graphify.auto_update is false', () => {
      assert.ok(
        CANONICAL_CONFIG_DEFAULTS.graphify !== undefined,
        'CANONICAL_CONFIG_DEFAULTS must expose a graphify section',
      );
      assert.strictEqual(
        CANONICAL_CONFIG_DEFAULTS.graphify.auto_update,
        false,
        'graphify.auto_update default must be false (opt-in per issue #3347 AC)',
      );
    });

    test('config-set graphify.auto_update true succeeds', (t) => {
      const tmpDir = createTempProject();
      t.after(() => cleanup(tmpDir));

      const result = runGsdTools(
        ['config-set', 'graphify.auto_update', 'true'],
        tmpDir,
      );
      assert.ok(
        result.success,
        [
          'config-set graphify.auto_update true should succeed,',
          'got:',
          'stdout: ' + result.output,
          'stderr: ' + result.error,
        ].join('\n'),
      );
    });

    test('config-set graphify.auto_update true writes to config.json', (t) => {
      const tmpDir = createTempProject();
      t.after(() => cleanup(tmpDir));

      runGsdTools(['config-set', 'graphify.auto_update', 'true'], tmpDir);

      const configPath = path.join(tmpDir, '.planning', 'config.json');
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      assert.strictEqual(
        config.graphify?.auto_update,
        true,
        'config.json must have graphify.auto_update: true after config-set',
      );
    });

    test('config-set graphify.auto_update false persists too', (t) => {
      const tmpDir = createTempProject();
      t.after(() => cleanup(tmpDir));

      runGsdTools(['config-set', 'graphify.auto_update', 'true'], tmpDir);
      runGsdTools(['config-set', 'graphify.auto_update', 'false'], tmpDir);

      const configPath = path.join(tmpDir, '.planning', 'config.json');
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      assert.strictEqual(
        config.graphify?.auto_update,
        false,
        'config-set must round-trip true → false',
      );
    });

    test('graphifyStatus folds auto-update status=failed into stale=true', (t) => {
      const tmpDir = makeStatusProject({
        ts: '2026-05-15T12:00:00Z',
        status: 'failed',
        exit_code: 1,
        duration_ms: 1234,
        head_at_build: 'abcdef0',
        graphify_version: null,
      });
      t.after(() => fs.rmSync(tmpDir, { recursive: true, force: true }));
      const s = graphifyStatus(tmpDir);
      assert.strictEqual(s.stale, true, 'auto-build failure must set stale=true');
      assert.ok(s.last_build_auto_update, 'last_build_auto_update must be exposed');
      assert.strictEqual(s.last_build_auto_update.status, 'failed');
      assert.strictEqual(s.last_build_auto_update.exit_code, 1);
    });

    test('graphifyStatus folds auto-update status=running into stale=true', (t) => {
      const tmpDir = makeStatusProject({
        ts: '2026-05-15T12:00:00Z',
        status: 'running',
        exit_code: null,
        duration_ms: null,
        head_at_build: 'abcdef0',
        graphify_version: null,
      });
      t.after(() => fs.rmSync(tmpDir, { recursive: true, force: true }));
      const s = graphifyStatus(tmpDir);
      assert.strictEqual(s.stale, true, 'auto-build in-flight must set stale=true');
      assert.strictEqual(s.last_build_auto_update.status, 'running');
    });

    test('graphifyStatus leaves stale alone when auto-update status=ok and graph is fresh', (t) => {
      const tmpDir = makeStatusProject({
        ts: '2026-05-15T12:00:00Z',
        status: 'ok',
        exit_code: 0,
        duration_ms: 1234,
        head_at_build: 'abcdef0',
        graphify_version: null,
      });
      t.after(() => fs.rmSync(tmpDir, { recursive: true, force: true }));
      const s = graphifyStatus(tmpDir);
      assert.strictEqual(s.stale, false, 'fresh graph + ok auto-build => not stale');
      assert.strictEqual(s.last_build_auto_update.status, 'ok');
    });

    test('graphifyStatus exposes last_build_auto_update: null when status file absent', (t) => {
      const tmpDir = makeStatusProject(null);
      t.after(() => fs.rmSync(tmpDir, { recursive: true, force: true }));
      const s = graphifyStatus(tmpDir);
      assert.strictEqual(s.last_build_auto_update, null);
      assert.strictEqual(s.stale, false, 'no status file => stale follows mtime only');
    });

    test('config-set graphify.auto_update does not perturb sibling graphify.enabled', (t) => {
      const tmpDir = createTempProject();
      t.after(() => cleanup(tmpDir));

      runGsdTools(['config-set', 'graphify.enabled', 'true'], tmpDir);
      runGsdTools(['config-set', 'graphify.auto_update', 'true'], tmpDir);

      const configPath = path.join(tmpDir, '.planning', 'config.json');
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      assert.strictEqual(
        config.graphify?.enabled,
        true,
        'graphify.enabled must be preserved when setting graphify.auto_update',
      );
      assert.strictEqual(
        config.graphify?.auto_update,
        true,
        'graphify.auto_update must coexist with graphify.enabled',
      );
    });
  });

  // ─── hook tests ─────────────────────────────────────────────────────────────

  const isWindows = process.platform === 'win32';
  const HOOK = path.join(__dirname, '..', 'hooks', 'gsd-graphify-update.sh');

  function createTempGitRepo(opts = {}) {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-3347-'));
    spawnSync('git', ['init', '-b', opts.defaultBranch || 'main'], {
      cwd: tmpDir,
      stdio: 'ignore',
    });
    execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: tmpDir });
    execFileSync('git', ['config', 'user.name', 'Test'], { cwd: tmpDir });
    fs.writeFileSync(path.join(tmpDir, 'README.md'), '# test\n');
    execFileSync('git', ['add', 'README.md'], { cwd: tmpDir });
    execFileSync('git', ['commit', '-m', 'init'], { cwd: tmpDir, stdio: 'ignore' });

    fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });
    if (opts.config !== undefined) {
      fs.writeFileSync(
        path.join(tmpDir, '.planning', 'config.json'),
        JSON.stringify(opts.config, null, 2),
      );
    }
    return tmpDir;
  }

  function makeMockGraphifyBin(tmpDir, { exitCode = 0, sleepMs = 0 } = {}) {
    const binDir = path.join(tmpDir, '.mock-bin');
    fs.mkdirSync(binDir, { recursive: true });
    const script = path.join(binDir, 'graphify');
    const body = [
      '#!/usr/bin/env bash',
      'set -u',
      sleepMs ? `sleep ${(sleepMs / 1000).toFixed(3)}` : '',
      'mkdir -p graphify-out',
      'echo \'{"nodes":[],"edges":[]}\' > graphify-out/graph.json',
      'echo "mock report" > graphify-out/GRAPH_REPORT.md',
      'echo "<html></html>" > graphify-out/graph.html',
      `exit ${exitCode}`,
    ]
      .filter(Boolean)
      .join('\n');
    fs.writeFileSync(script, body + '\n', { mode: 0o755 });
    return binDir;
  }

  function runHook(tmpDir, toolPayload, { env = {}, pathPrepend = '' } = {}) {
    const PATH = pathPrepend
      ? `${pathPrepend}${path.delimiter}${process.env.PATH || ''}`
      : process.env.PATH || '';
    return spawnSync('bash', [HOOK], {
      cwd: tmpDir,
      input: JSON.stringify(toolPayload),
      env: {
        ...process.env,
        PATH,
        CI: '',
        ...env,
      },
      encoding: 'utf8',
      timeout: 30000,
    });
  }

  // Shared 4-byte buffer used for Atomics.wait-based sleeps throughout the
  // hook-test helpers.  Atomics.wait(sai, 0, 0, ms) yields the event loop for
  // exactly `ms` milliseconds without spawning an external process.
  const _sleepSab = new SharedArrayBuffer(4);
  const _sleepSai = new Int32Array(_sleepSab);
  function atomicSleep(ms) {
    Atomics.wait(_sleepSai, 0, 0, ms);
  }

  function cleanupHookRepo(tmpDir) {
    // The hook detaches a graphify-rebuild subprocess that may still be writing
    // into tmpDir when the test body returns. Wait for the rebuild PID to exit
    // (lock file disappears on subprocess EXIT trap), then retry rmSync to
    // absorb any remaining transient ENOTEMPTY race.
    //
    // Uses Atomics.wait instead of execFileSync('sleep', ...) so we yield the
    // CPU without spawning an external process per iteration.  Budget: 4 s —
    // the mock graphify binary completes in well under 1 s; if we hit the
    // ceiling something else is broken.
    const lockPath = path.join(tmpDir, '.planning/graphs/.rebuild.lock');
    const lockDeadline = Date.now() + 4000;
    while (Date.now() < lockDeadline) {
      if (!fs.existsSync(lockPath)) break;
      try {
        const pid = parseInt(fs.readFileSync(lockPath, 'utf8'), 10);
        if (!Number.isFinite(pid) || pid <= 0) break;
        execFileSync('kill', ['-0', String(pid)], { stdio: 'ignore' });
      } catch {
        break; // PID dead → safe to clean up
      }
      atomicSleep(50); // yield 50 ms, then re-check (replaces execFileSync('sleep'))
    }
    fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 8, retryDelay: 100 });
  }

  describe('hook — bail paths (no side effects)',
    { skip: isWindows ? 'POSIX-only: harness spawns bash + kill -0 + sleep; the hook itself is a bash script under test' : false },
    () => {
    test('non-Bash tool call exits 0 with no status file', (t) => {
      const tmpDir = createTempGitRepo({
        config: { graphify: { enabled: true, auto_update: true } },
      });
      t.after(() => cleanupHookRepo(tmpDir));
      const r = runHook(tmpDir, { tool_name: 'Edit', tool_input: { file_path: 'x' } });
      assert.strictEqual(r.status, 0, 'hook must exit 0 on non-Bash tool');
      assert.ok(
        !fs.existsSync(path.join(tmpDir, '.planning/graphs/.last-build-status.json')),
        'no status file should be created when bailing',
      );
    });

    test('Bash but non-HEAD-advancing command exits 0 with no status file', (t) => {
      const tmpDir = createTempGitRepo({
        config: { graphify: { enabled: true, auto_update: true } },
      });
      t.after(() => cleanupHookRepo(tmpDir));
      const r = runHook(tmpDir, { tool_name: 'Bash', tool_input: { command: 'ls -la' } });
      assert.strictEqual(r.status, 0);
      assert.ok(!fs.existsSync(path.join(tmpDir, '.planning/graphs/.last-build-status.json')));
    });

    test('git commit but graphify.enabled=false → no dispatch', (t) => {
      const tmpDir = createTempGitRepo({
        config: { graphify: { enabled: false, auto_update: true } },
      });
      t.after(() => cleanupHookRepo(tmpDir));
      const r = runHook(tmpDir, { tool_name: 'Bash', tool_input: { command: 'git commit -m x' } });
      assert.strictEqual(r.status, 0);
      assert.ok(!fs.existsSync(path.join(tmpDir, '.planning/graphs/.last-build-status.json')));
    });

    test('git commit but graphify.auto_update=false → no dispatch (opt-in)', (t) => {
      const tmpDir = createTempGitRepo({
        config: { graphify: { enabled: true, auto_update: false } },
      });
      t.after(() => cleanupHookRepo(tmpDir));
      const r = runHook(tmpDir, { tool_name: 'Bash', tool_input: { command: 'git commit -m x' } });
      assert.strictEqual(r.status, 0);
      assert.ok(
        !fs.existsSync(path.join(tmpDir, '.planning/graphs/.last-build-status.json')),
        'opt-in default-off: auto_update=false must suppress dispatch',
      );
    });

    test('CI=true → no dispatch even with both gates true', (t) => {
      const tmpDir = createTempGitRepo({
        config: { graphify: { enabled: true, auto_update: true } },
      });
      t.after(() => cleanupHookRepo(tmpDir));
      const mockBin = makeMockGraphifyBin(tmpDir);
      const r = runHook(
        tmpDir,
        { tool_name: 'Bash', tool_input: { command: 'git commit -m x' } },
        { env: { CI: 'true' }, pathPrepend: mockBin },
      );
      assert.strictEqual(r.status, 0);
      assert.ok(!fs.existsSync(path.join(tmpDir, '.planning/graphs/.last-build-status.json')));
    });

    test('on non-default branch → no dispatch', (t) => {
      const tmpDir = createTempGitRepo({
        config: { graphify: { enabled: true, auto_update: true } },
      });
      t.after(() => cleanupHookRepo(tmpDir));
      execFileSync('git', ['checkout', '-b', 'worktree-agent-abc'], {
        cwd: tmpDir,
        stdio: 'ignore',
      });
      const mockBin = makeMockGraphifyBin(tmpDir);
      const r = runHook(
        tmpDir,
        { tool_name: 'Bash', tool_input: { command: 'git commit -m x' } },
        { pathPrepend: mockBin },
      );
      assert.strictEqual(r.status, 0);
      assert.ok(
        !fs.existsSync(path.join(tmpDir, '.planning/graphs/.last-build-status.json')),
        'branch check must filter worktree-agent-* (non-default-branch) commits',
      );
    });

    test('graphify binary not on PATH → silent exit 0', (t) => {
      const tmpDir = createTempGitRepo({
        config: { graphify: { enabled: true, auto_update: true } },
      });
      t.after(() => cleanupHookRepo(tmpDir));
      // Note: do NOT prepend mock bin; rely on real PATH not having graphify
      const r = runHook(
        tmpDir,
        { tool_name: 'Bash', tool_input: { command: 'git commit -m x' } },
        { env: { PATH: '/usr/bin:/bin' } },
      );
      assert.strictEqual(r.status, 0, 'must not break commits when graphify missing');
    });
  });

  describe('hook — dispatch path (all gates pass)',
    { skip: isWindows ? 'POSIX-only: harness spawns bash + kill -0 + sleep; the hook itself is a bash script under test' : false },
    () => {
    test('writes status file with status=running synchronously before returning', (t) => {
      const tmpDir = createTempGitRepo({
        config: { graphify: { enabled: true, auto_update: true } },
      });
      t.after(() => cleanupHookRepo(tmpDir));
      // Sleep 2s in mock so we can observe the running state before completion
      const mockBin = makeMockGraphifyBin(tmpDir, { sleepMs: 2000 });

      const r = runHook(
        tmpDir,
        { tool_name: 'Bash', tool_input: { command: 'git commit -m x' } },
        { pathPrepend: mockBin },
      );
      assert.strictEqual(r.status, 0, 'hook must return 0');

      const statusPath = path.join(tmpDir, '.planning/graphs/.last-build-status.json');
      assert.ok(fs.existsSync(statusPath), 'status file must be written synchronously');
      const status = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
      assert.strictEqual(status.status, 'running', 'initial status must be "running"');
      assert.ok(/^[0-9a-f]{7,40}$/.test(status.head_at_build), 'head_at_build must be a commit sha');
    });

    test('completes to status=ok after detached graphify run succeeds', (t) => {
      const tmpDir = createTempGitRepo({
        config: { graphify: { enabled: true, auto_update: true } },
      });
      t.after(() => cleanupHookRepo(tmpDir));
      const mockBin = makeMockGraphifyBin(tmpDir, { exitCode: 0, sleepMs: 200 });

      runHook(
        tmpDir,
        { tool_name: 'Bash', tool_input: { command: 'git commit -m x' } },
        { pathPrepend: mockBin },
      );

      // Wait for the detached rebuild process to write the final status file.
      // The detached process exits after writing; we poll until the status
      // transitions from "running" to a terminal value.
      //
      // Behavior-anchored wait (fix for #3803): the poll budget is derived from
      // the mock's known sleepMs (200 ms) rather than a wall-clock constant.
      // waitBudget = sleepMs + 2000 ms: the 2 s buffer covers two bash process
      // startups (the hook script + the detached rebuild subprocess) plus
      // filesystem write latency.  Mac bash startup: ~100-300 ms; Docker adds
      // more.  2 s keeps the test honest under load without guessing an absolute
      // wall-clock ceiling.  See PR #3793 for the reference fix pattern.
      const statusPath = path.join(tmpDir, '.planning/graphs/.last-build-status.json');
      const _sleepMs_ok = 200; // mirrors makeMockGraphifyBin sleepMs above
      const _waitBudget_ok = _sleepMs_ok + 2000; // 2 s: two bash spawn overheads
      const _maxIter_ok = Math.ceil(_waitBudget_ok / 100); // 100 ms poll step
      let status;
      for (let i = 0; i < _maxIter_ok; i++) {
        if (fs.existsSync(statusPath)) {
          try {
            status = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
            if (status.status === 'ok') break;
          } catch {
            // Detached writer can briefly expose a partial JSON write.
          }
        }
        atomicSleep(100); // yield 100 ms, then re-check
      }
      assert.ok(status, 'status file must exist after dispatch');
      assert.strictEqual(status.status, 'ok', 'mock graphify exit=0 → status ok');
      assert.strictEqual(status.exit_code, 0);
      assert.ok(typeof status.duration_ms === 'number' && status.duration_ms >= 0);
    });

    test('completes to status=failed when graphify exits non-zero', (t) => {
      const tmpDir = createTempGitRepo({
        config: { graphify: { enabled: true, auto_update: true } },
      });
      t.after(() => cleanupHookRepo(tmpDir));
      const mockBin = makeMockGraphifyBin(tmpDir, { exitCode: 1, sleepMs: 100 });

      runHook(
        tmpDir,
        { tool_name: 'Bash', tool_input: { command: 'git commit -m x' } },
        { pathPrepend: mockBin },
      );

      // Wait for the detached rebuild process to write the final status file.
      //
      // Behavior-anchored wait (fix for #3803): same pattern as the status=ok
      // variant above.  Budget derived from mock sleepMs (100 ms) + 2 s overhead
      // buffer (two bash spawns: hook script + detached rebuild subprocess).
      // The 2 s absorbs startup latency without anchoring to an absolute
      // wall-clock ceiling.
      const statusPath = path.join(tmpDir, '.planning/graphs/.last-build-status.json');
      const _sleepMs_fail = 100; // mirrors makeMockGraphifyBin sleepMs above
      const _waitBudget_fail = _sleepMs_fail + 2000; // 2 s: two bash spawn overheads
      const _maxIter_fail = Math.ceil(_waitBudget_fail / 100); // 100 ms poll step
      let status;
      for (let i = 0; i < _maxIter_fail; i++) {
        if (fs.existsSync(statusPath)) {
          try {
            status = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
            if (status.status === 'failed') break;
          } catch {
            // Detached writer can briefly expose a partial JSON write.
          }
        }
        atomicSleep(100); // yield 100 ms, then re-check
      }
      assert.ok(status, 'status file must exist after dispatch');
      assert.strictEqual(status.status, 'failed', 'mock graphify exit=1 → status failed');
      assert.strictEqual(status.exit_code, 1);
    });

    test('lock file with a live PID prevents concurrent dispatch', (t) => {
      const tmpDir = createTempGitRepo({
        config: { graphify: { enabled: true, auto_update: true } },
      });
      t.after(() => cleanupHookRepo(tmpDir));
      fs.mkdirSync(path.join(tmpDir, '.planning/graphs'), { recursive: true });
      // Seed a live-PID lock pointing at our own process — kill -0 will succeed
      fs.writeFileSync(path.join(tmpDir, '.planning/graphs/.rebuild.lock'), String(process.pid));

      const mockBin = makeMockGraphifyBin(tmpDir);
      const r = runHook(
        tmpDir,
        { tool_name: 'Bash', tool_input: { command: 'git commit -m x' } },
        { pathPrepend: mockBin },
      );
      assert.strictEqual(r.status, 0);
      // Status file should NOT be written because a rebuild is in flight
      assert.ok(
        !fs.existsSync(path.join(tmpDir, '.planning/graphs/.last-build-status.json')),
        'live PID lock must suppress dispatch',
      );
    });

    test('stale lock file (dead PID) is treated as absent', (t) => {
      const tmpDir = createTempGitRepo({
        config: { graphify: { enabled: true, auto_update: true } },
      });
      t.after(() => cleanupHookRepo(tmpDir));
      fs.mkdirSync(path.join(tmpDir, '.planning/graphs'), { recursive: true });
      // PID 1 is init; kill -0 1 succeeds for root but fails for non-root.
      // Use a very large PID number unlikely to exist (max pid = 4194304 on linux).
      fs.writeFileSync(path.join(tmpDir, '.planning/graphs/.rebuild.lock'), '4194303');

      const mockBin = makeMockGraphifyBin(tmpDir, { sleepMs: 500 });
      const r = runHook(
        tmpDir,
        { tool_name: 'Bash', tool_input: { command: 'git commit -m x' } },
        { pathPrepend: mockBin },
      );
      assert.strictEqual(r.status, 0);
      const statusPath = path.join(tmpDir, '.planning/graphs/.last-build-status.json');
      assert.ok(fs.existsSync(statusPath), 'stale lock must not block dispatch');
    });

    test('respects git.base_branch config override (default branch != main)', (t) => {
      const tmpDir = createTempGitRepo({
        defaultBranch: 'trunk',
        config: {
          graphify: { enabled: true, auto_update: true },
          git: { base_branch: 'trunk' },
        },
      });
      t.after(() => cleanupHookRepo(tmpDir));
      const mockBin = makeMockGraphifyBin(tmpDir, { sleepMs: 100 });
      const r = runHook(
        tmpDir,
        { tool_name: 'Bash', tool_input: { command: 'git commit -m x' } },
        { pathPrepend: mockBin },
      );
      assert.strictEqual(r.status, 0);
      assert.ok(
        fs.existsSync(path.join(tmpDir, '.planning/graphs/.last-build-status.json')),
        'hook must honor git.base_branch when default branch is not main',
      );
    });
  });

  describe('hook — HEAD-advancing command matchers',
    { skip: isWindows ? 'POSIX-only: harness spawns bash to invoke the .sh hook under test' : false },
    () => {
    for (const cmd of [
      'git commit -m fix',
      'git merge feature',
      'git pull --ff-only',
      'git rebase --continue',
      'git cherry-pick abc123',
      // #3653 — `gsd-sdk query commit` invokes git via spawnSync('git', [...]),
      // so the substring "git commit" never appears in tool_input.command.
      // The hook must match the user-facing SDK invocation directly.
      'gsd-sdk query commit "docs: probe" --files .planning/STATE.md',
      'npx gsd-sdk query commit "docs: probe" --files .planning/STATE.md',
    ]) {
      test(`dispatches on: ${cmd}`, (t) => {
        const tmpDir = createTempGitRepo({
          config: { graphify: { enabled: true, auto_update: true } },
        });
        t.after(() => cleanupHookRepo(tmpDir));
        const mockBin = makeMockGraphifyBin(tmpDir, { sleepMs: 100 });
        runHook(
          tmpDir,
          { tool_name: 'Bash', tool_input: { command: cmd } },
          { pathPrepend: mockBin },
        );
        assert.ok(
          fs.existsSync(path.join(tmpDir, '.planning/graphs/.last-build-status.json')),
          `must dispatch for HEAD-advancing op: ${cmd}`,
        );
      });
    }

    test('does NOT dispatch on SDK commit-to-subrepo prefix collision', (t) => {
      const tmpDir = createTempGitRepo({
        config: { graphify: { enabled: true, auto_update: true } },
      });
      t.after(() => cleanupHookRepo(tmpDir));
      const mockBin = makeMockGraphifyBin(tmpDir, { sleepMs: 100 });
      const r = runHook(
        tmpDir,
        {
          tool_name: 'Bash',
          tool_input: {
            command: 'gsd-sdk query commit-to-subrepo "msg" --files packages/foo',
          },
        },
        { pathPrepend: mockBin },
      );
      assert.strictEqual(r.status, 0);
      assert.ok(
        !fs.existsSync(path.join(tmpDir, '.planning/graphs/.last-build-status.json')),
        'must NOT dispatch for commit-to-subrepo, which does not advance the outer repo HEAD',
      );
    });

    // #3653 — only the SDK `commit` verb invokes git internally. Other
    // `gsd-sdk query` verbs (phase.complete, roadmap.update-plan-progress,
    // state.begin-phase) mutate .md files but do NOT advance HEAD; matching
    // them would cause a spurious rebuild per state mutation.
    for (const cmd of [
      'gsd-sdk query phase.complete 109',
      'gsd-sdk query roadmap.update-plan-progress 109 W001',
      'gsd-sdk query state.begin-phase 110',
    ]) {
      test(`does NOT dispatch on non-HEAD-advancing SDK verb: ${cmd}`, (t) => {
        const tmpDir = createTempGitRepo({
          config: { graphify: { enabled: true, auto_update: true } },
        });
        t.after(() => cleanupHookRepo(tmpDir));
        const r = runHook(tmpDir, { tool_name: 'Bash', tool_input: { command: cmd } });
        assert.strictEqual(r.status, 0);
        assert.ok(
          !fs.existsSync(path.join(tmpDir, '.planning/graphs/.last-build-status.json')),
          `must NOT dispatch for non-HEAD-advancing SDK verb: ${cmd}`,
        );
      });
    }
  });
});
