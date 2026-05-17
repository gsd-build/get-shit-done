'use strict';

/**
 * Regression tests for #3347 — hooks/gsd-graphify-update.sh behavior.
 *
 * The hook is a PostToolUse handler that fires after every Bash tool call.
 * It is a no-op except when ALL of these are true:
 *   - Tool name is Bash
 *   - tool_input.command matches a HEAD-advancing git operation
 *   - Current branch == default branch (main/master/trunk; configurable)
 *   - .planning/config.json has graphify.enabled === true
 *   - .planning/config.json has graphify.auto_update === true
 *   - $CI environment variable is unset / empty
 *   - graphify binary is on PATH
 *   - No live rebuild already in progress (PID lock check)
 *
 * When all gates pass, the hook:
 *   1. Writes .planning/graphs/.last-build-status.json with status="running"
 *      and the current HEAD sha (sync, before detach).
 *   2. Detaches a background `graphify update .` invocation that copies
 *      outputs into .planning/graphs/ and updates the status file to
 *      status="ok" or status="failed" on completion.
 *   3. Returns exit 0 in <100ms regardless.
 *
 * On a hook return path failure (bail), no status file is written and no
 * lock is acquired — the commit completes with no side effect.
 */

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const os = require('node:os');

const ROOT = path.join(__dirname, '..');
const HOOK = path.join(ROOT, 'hooks', 'gsd-graphify-update.sh');

const isWindows = process.platform === 'win32';

function createTempGitRepo(opts = {}) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-3347-'));
  cp.execFileSync('git', ['init', '-b', opts.defaultBranch || 'main'], {
    cwd: tmpDir,
    stdio: 'ignore',
  });
  cp.execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: tmpDir });
  cp.execFileSync('git', ['config', 'user.name', 'Test'], { cwd: tmpDir });
  fs.writeFileSync(path.join(tmpDir, 'README.md'), '# test\n');
  cp.execFileSync('git', ['add', 'README.md'], { cwd: tmpDir });
  cp.execFileSync('git', ['commit', '-m', 'init'], { cwd: tmpDir, stdio: 'ignore' });

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
  // Mock: sleep optionally to allow lock observation, then write
  // graphify-out/graph.json and exit with the requested code.
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
  return cp.spawnSync('bash', [HOOK], {
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

function cleanup(tmpDir) {
  // The hook detaches a graphify-rebuild subprocess that may still be writing
  // into tmpDir when the test body returns. Wait briefly for its lock file to
  // disappear (rebuild process exit trap removes it), then retry rmSync to
  // absorb any remaining transient ENOTEMPTY race.
  const lockPath = path.join(tmpDir, '.planning/graphs/.rebuild.lock');
  const lockDeadline = Date.now() + 4000;
  while (Date.now() < lockDeadline) {
    if (!fs.existsSync(lockPath)) break;
    try {
      const pid = parseInt(fs.readFileSync(lockPath, 'utf8'), 10);
      if (!Number.isFinite(pid) || pid <= 0) break;
      cp.execFileSync('kill', ['-0', String(pid)], { stdio: 'ignore' });
    } catch {
      break; // PID dead → safe to clean up
    }
    cp.execFileSync('sleep', ['0.05']);
  }
  fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 8, retryDelay: 100 });
}

describe('#3347 hook — bail paths (no side effects)',
  { skip: isWindows ? 'POSIX-only: harness spawns bash + kill -0 + sleep; the hook itself is a bash script under test' : false },
  () => {
  test('non-Bash tool call exits 0 with no status file', (t) => {
    const tmpDir = createTempGitRepo({
      config: { graphify: { enabled: true, auto_update: true } },
    });
    t.after(() => cleanup(tmpDir));
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
    t.after(() => cleanup(tmpDir));
    const r = runHook(tmpDir, { tool_name: 'Bash', tool_input: { command: 'ls -la' } });
    assert.strictEqual(r.status, 0);
    assert.ok(!fs.existsSync(path.join(tmpDir, '.planning/graphs/.last-build-status.json')));
  });

  test('git commit but graphify.enabled=false → no dispatch', (t) => {
    const tmpDir = createTempGitRepo({
      config: { graphify: { enabled: false, auto_update: true } },
    });
    t.after(() => cleanup(tmpDir));
    const r = runHook(tmpDir, { tool_name: 'Bash', tool_input: { command: 'git commit -m x' } });
    assert.strictEqual(r.status, 0);
    assert.ok(!fs.existsSync(path.join(tmpDir, '.planning/graphs/.last-build-status.json')));
  });

  test('git commit but graphify.auto_update=false → no dispatch (opt-in)', (t) => {
    const tmpDir = createTempGitRepo({
      config: { graphify: { enabled: true, auto_update: false } },
    });
    t.after(() => cleanup(tmpDir));
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
    t.after(() => cleanup(tmpDir));
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
    t.after(() => cleanup(tmpDir));
    cp.execFileSync('git', ['checkout', '-b', 'worktree-agent-abc'], {
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
    t.after(() => cleanup(tmpDir));
    // Note: do NOT prepend mock bin; rely on real PATH not having graphify
    const r = runHook(
      tmpDir,
      { tool_name: 'Bash', tool_input: { command: 'git commit -m x' } },
      { env: { PATH: '/usr/bin:/bin' } },
    );
    assert.strictEqual(r.status, 0, 'must not break commits when graphify missing');
  });
});

describe('#3347 hook — dispatch path (all gates pass)',
  { skip: isWindows ? 'POSIX-only: harness spawns bash + kill -0 + sleep; the hook itself is a bash script under test' : false },
  () => {
  test('writes status file with status=running synchronously before returning', (t) => {
    const tmpDir = createTempGitRepo({
      config: { graphify: { enabled: true, auto_update: true } },
    });
    t.after(() => cleanup(tmpDir));
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
    t.after(() => cleanup(tmpDir));
    const mockBin = makeMockGraphifyBin(tmpDir, { exitCode: 0, sleepMs: 200 });

    runHook(
      tmpDir,
      { tool_name: 'Bash', tool_input: { command: 'git commit -m x' } },
      { pathPrepend: mockBin },
    );

    // Wait up to 5s for the detached process to finish updating the status
    const statusPath = path.join(tmpDir, '.planning/graphs/.last-build-status.json');
    const deadline = Date.now() + 15000;
    let status;
    while (Date.now() < deadline) {
      if (fs.existsSync(statusPath)) {
        try {
          status = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
          if (status.status === 'ok') break;
        } catch {
          // Detached writer can briefly expose a partial JSON write.
        }
      }
      cp.execFileSync('sleep', ['0.1']);
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
    t.after(() => cleanup(tmpDir));
    const mockBin = makeMockGraphifyBin(tmpDir, { exitCode: 1, sleepMs: 100 });

    runHook(
      tmpDir,
      { tool_name: 'Bash', tool_input: { command: 'git commit -m x' } },
      { pathPrepend: mockBin },
    );

    const statusPath = path.join(tmpDir, '.planning/graphs/.last-build-status.json');
    const deadline = Date.now() + 15000;
    let status;
    while (Date.now() < deadline) {
      if (fs.existsSync(statusPath)) {
        try {
          status = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
          if (status.status === 'failed') break;
        } catch {
          // Detached writer can briefly expose a partial JSON write.
        }
      }
      cp.execFileSync('sleep', ['0.1']);
    }
    assert.ok(status, 'status file must exist after dispatch');
    assert.strictEqual(status.status, 'failed', 'mock graphify exit=1 → status failed');
    assert.strictEqual(status.exit_code, 1);
  });

  test('lock file with a live PID prevents concurrent dispatch', (t) => {
    const tmpDir = createTempGitRepo({
      config: { graphify: { enabled: true, auto_update: true } },
    });
    t.after(() => cleanup(tmpDir));
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
    t.after(() => cleanup(tmpDir));
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
    t.after(() => cleanup(tmpDir));
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

describe('#3347 hook — HEAD-advancing command matchers',
  { skip: isWindows ? 'POSIX-only: harness spawns bash to invoke the .sh hook under test' : false },
  () => {
  for (const cmd of [
    'git commit -m fix',
    'git merge feature',
    'git pull --ff-only',
    'git rebase --continue',
    'git cherry-pick abc123',
  ]) {
    test(`dispatches on: ${cmd}`, (t) => {
      const tmpDir = createTempGitRepo({
        config: { graphify: { enabled: true, auto_update: true } },
      });
      t.after(() => cleanup(tmpDir));
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
});
