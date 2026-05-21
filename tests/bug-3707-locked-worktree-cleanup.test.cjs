// allow-test-rule: source-text-is-the-product
// Real-filesystem tests for the two failure modes pinned in #3707:
//   1. executeWorktreeWaveCleanupPlan must unlock-then-retry when a worktree is locked.
//   2. reapOrphanWorktrees must reap dead-pid+merged entries and skip live / unmerged / fresh-mtime entries.
//   3. quick.md and execute-phase.md must wire gsd-sdk query worktree.reap-orphans at startup.

'use strict';

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync, spawnSync } = require('node:child_process');

const {
  executeWorktreeWaveCleanupPlan,
  planWorktreeWaveCleanup,
  reapOrphanWorktrees,
} = require('../get-shit-done/bin/lib/worktree-safety.cjs');

// ─── PID helpers ──────────────────────────────────────────────────────────────

/**
 * Return a PID that is guaranteed to be dead.
 * Spawns a short-lived child, captures its PID, waits for it to exit, then
 * returns that PID.  This is cross-platform and not subject to pid_max races
 * (unlike a hardcoded high number such as 999999).
 */
function deadPid() {
  // Use the shortest possible no-op: `node -e ""` on all platforms.
  const nodeExe = process.execPath;
  const result = spawnSync(nodeExe, ['-e', ''], { stdio: 'ignore' });
  if (result.pid == null || result.status === null) {
    // Fallback: use a PID above the system max — 2^31-1 always exceeds any
    // real OS limit (Linux max: 4194304, macOS max: 99998, Windows: variable).
    return 2147483647;
  }
  return result.pid;
}

// ─── Git repo helpers ─────────────────────────────────────────────────────────

function canonicalPath(p) {
  try { return fs.realpathSync.native(path.resolve(p)); } catch { return path.resolve(p); }
}

/**
 * Return a canonical (long-form) path for os.tmpdir().
 * On Windows CI, os.tmpdir() often contains 8.3 short-name components
 * (e.g. RUNNER~1 instead of runneradmin).  When 8.3 names are disabled
 * (common in modern CI environments), those short paths are not resolvable
 * and fs.realpathSync.native fails with ENOENT.  Pre-resolving the base
 * ensures every path created under it uses the same long-form representation
 * that git stores when given absolute paths.
 */
function resolvedTmpDir() {
  try { return fs.realpathSync.native(os.tmpdir()); } catch { return os.tmpdir(); }
}

function git(args, cwd) {
  return execFileSync('git', args, { cwd, stdio: 'pipe', encoding: 'utf8' });
}

function initRepo(dir) {
  fs.mkdirSync(dir, { recursive: true });
  git(['init'], dir);
  git(['config', 'user.email', 'test@test.com'], dir);
  git(['config', 'user.name', 'Test'], dir);
  git(['config', 'commit.gpgsign', 'false'], dir);
  fs.writeFileSync(path.join(dir, 'README.md'), '# Test\n');
  git(['add', '-A'], dir);
  git(['commit', '-m', 'initial commit'], dir);
  try { git(['branch', '-m', 'master', 'main'], dir); } catch { /* already main */ }
}

function addWorktree(repoDir, wtDir, branchName) {
  git(['worktree', 'add', wtDir, '-b', branchName], repoDir);
}

function commitInWorktree(wtDir, filename) {
  const fname = filename || 'work.txt';
  fs.writeFileSync(path.join(wtDir, fname), 'content\n');
  git(['add', '-A'], wtDir);
  git(['commit', '-m', `work in ${path.basename(wtDir)}`], wtDir);
}

function mergeIntoMain(repoDir, branchName) {
  git(['merge', branchName, '--no-ff', '-m', `merge ${branchName}`], repoDir);
}

function worktreeMeta(repoDir, wtDir) {
  // Return the .git/worktrees/<name>/ directory for a given linked worktree
  const worktrees = git(['worktree', 'list', '--porcelain'], repoDir);
  const canonical = canonicalPath(wtDir);
  // Normalize CRLF → LF before splitting (git on Windows may emit CRLF).
  const normalized = worktrees.replace(/\r\n/g, '\n');
  const blocks = normalized.split('\n\n').filter(Boolean);
  for (const block of blocks) {
    const lines = block.split('\n');
    const wtLine = lines.find((l) => l.startsWith('worktree '));
    if (!wtLine) continue;
    const wtPath = wtLine.slice('worktree '.length).trim();
    if (canonicalPath(wtPath) !== canonical) continue;
    const gitCommonDir = git(['rev-parse', '--git-common-dir'], repoDir).trim();
    const worktreesDir = path.join(path.resolve(repoDir, gitCommonDir), 'worktrees');
    if (!fs.existsSync(worktreesDir)) continue;
    for (const entry of fs.readdirSync(worktreesDir)) {
      const gitdirFile = path.join(worktreesDir, entry, 'gitdir');
      if (!fs.existsSync(gitdirFile)) continue;
      const gitdirContent = fs.readFileSync(gitdirFile, 'utf8').trim();
      const resolvedWtRoot = path.resolve(worktreesDir, entry, gitdirContent).replace(/[/\\]\.git$/, '');
      if (canonicalPath(resolvedWtRoot) === canonical) {
        return path.join(worktreesDir, entry);
      }
    }
  }
  throw new Error(`Cannot find .git/worktrees/<name> for worktree at ${wtDir}`);
}

function listedWorktreePaths(repoDir) {
  const out = git(['worktree', 'list', '--porcelain'], repoDir);
  return new Set(
    out.split('\n').filter((l) => l.startsWith('worktree ')).map((l) => canonicalPath(l.slice('worktree '.length).trim()))
  );
}

// ─── Suite 1: executeWorktreeWaveCleanupPlan — unlock-and-retry ───────────────

describe('bug-3707: executeWorktreeWaveCleanupPlan unlocks and retries on locked worktree', () => {
  let tmpBase;

  beforeEach(() => {
    tmpBase = fs.mkdtempSync(path.join(resolvedTmpDir(), 'gsd-3707-cleanup-'));
  });

  afterEach(() => {
    fs.rmSync(tmpBase, { recursive: true, force: true });
  });

  test('removes a locked worktree after unlock-retry (real-fs)', () => {
    const repoDir = path.join(tmpBase, 'repo');
    const wtDir = path.join(tmpBase, 'wt-locked');
    const branchName = 'worktree-agent-test1';

    initRepo(repoDir);
    addWorktree(repoDir, wtDir, branchName);
    commitInWorktree(wtDir);
    mergeIntoMain(repoDir, branchName);

    // Simulate Claude Code's lock: write a .git/worktrees/<name>/locked file
    const metaDir = worktreeMeta(repoDir, wtDir);
    const lockedFile = path.join(metaDir, 'locked');
    fs.writeFileSync(lockedFile, 'Locked by claude-code agent-test1');

    assert.ok(fs.existsSync(lockedFile), 'lock file should exist before test');

    const baseCommit = git(['merge-base', 'HEAD', branchName], repoDir).trim();

    const plan = {
      ok: true,
      repoRoot: repoDir,
      action: 'cleanup_wave',
      discovery: 'manifest',
      entries: [{
        agent_id: 'test1',
        worktree_path: wtDir,
        branch: branchName,
        expected_base: baseCommit,
      }],
    };

    const result = executeWorktreeWaveCleanupPlan(plan);

    assert.equal(result.ok, true, `cleanup should succeed, got: ${JSON.stringify(result)}`);
    assert.equal(result.entries[0].status, 'merged_removed');
    assert.ok(!fs.existsSync(wtDir), 'worktree directory should be gone after cleanup');
    assert.ok(!listedWorktreePaths(repoDir).has(canonicalPath(wtDir)), 'git worktree list should not include removed worktree');
  });

  test('cleanup succeeds without a lock file present (no regression)', () => {
    const repoDir = path.join(tmpBase, 'repo2');
    const wtDir = path.join(tmpBase, 'wt-unlocked');
    const branchName = 'worktree-agent-test2';

    initRepo(repoDir);
    addWorktree(repoDir, wtDir, branchName);
    commitInWorktree(wtDir, 'unlocked.txt');
    mergeIntoMain(repoDir, branchName);

    const baseCommit = git(['merge-base', 'HEAD', branchName], repoDir).trim();

    const plan = {
      ok: true,
      repoRoot: repoDir,
      action: 'cleanup_wave',
      discovery: 'manifest',
      entries: [{
        agent_id: 'test2',
        worktree_path: wtDir,
        branch: branchName,
        expected_base: baseCommit,
      }],
    };

    const result = executeWorktreeWaveCleanupPlan(plan);

    assert.equal(result.ok, true, `unlocked cleanup should succeed: ${JSON.stringify(result)}`);
    assert.equal(result.entries[0].status, 'merged_removed');
    assert.ok(!fs.existsSync(wtDir), 'worktree directory should be gone');
  });
});

// ─── Suite 2: reapOrphanWorktrees ─────────────────────────────────────────────

describe('bug-3707: reapOrphanWorktrees', () => {
  let tmpBase;

  beforeEach(() => {
    tmpBase = fs.mkdtempSync(path.join(resolvedTmpDir(), 'gsd-3707-reap-'));
  });

  afterEach(() => {
    fs.rmSync(tmpBase, { recursive: true, force: true });
  });

  // ── Dead PID + merged branch → reap ────────────────────────────────────────
  test('reaps a worktree whose pid is dead and branch is merged into main', () => {
    const repoDir = path.join(tmpBase, 'repo');
    const wtDir = path.join(tmpBase, 'wt-dead-merged');
    const branchName = 'worktree-agent-dead-merged';

    initRepo(repoDir);
    addWorktree(repoDir, wtDir, branchName);
    commitInWorktree(wtDir);
    mergeIntoMain(repoDir, branchName);

    // Write a lock file with a definitely-dead PID.  Use the deadPid() helper
    // which spawns and reaps a real child process — avoids pid_max flakiness
    // on Linux systems where 999999 could be a live PID.
    const metaDir = worktreeMeta(repoDir, wtDir);
    const lockedFile = path.join(metaDir, 'locked');
    fs.writeFileSync(lockedFile, String(deadPid()));

    // Back-date mtime so the stale-lock guard passes (> 5 minutes old)
    const staleTime = new Date(Date.now() - 10 * 60 * 1000);
    fs.utimesSync(lockedFile, staleTime, staleTime);

    // Pre-compute canonical path BEFORE reaping — the directory will be gone
    // afterward, so fs.realpathSync.native will fail and canonicalPath falls
    // back to path.resolve (non-symlink-resolved).  On macOS CI, git internally
    // resolves /var/folders → /private/var/folders when writing the gitdir file,
    // so r.path uses the real path while wtDir uses the symlink form.  Computing
    // canonical before removal ensures we compare the resolved forms.
    const wtDirCanonical = canonicalPath(wtDir);

    const result = reapOrphanWorktrees(repoDir);

    assert.ok(Array.isArray(result), 'reapOrphanWorktrees should return an array');
    const reaped = result.find((r) => canonicalPath(r.path) === wtDirCanonical);
    assert.ok(reaped, `worktree ${wtDir} should appear in reaped list`);
    assert.equal(reaped.status, 'reaped');
    assert.ok(!fs.existsSync(wtDir), 'worktree directory should be removed');
    assert.ok(!listedWorktreePaths(repoDir).has(wtDirCanonical), 'git worktree list should not show reaped worktree');
  });

  // ── Live PID → skip ────────────────────────────────────────────────────────
  test('skips a worktree whose pid is alive', () => {
    const repoDir = path.join(tmpBase, 'repo2');
    const wtDir = path.join(tmpBase, 'wt-live-pid');
    const branchName = 'worktree-agent-live-pid';

    initRepo(repoDir);
    addWorktree(repoDir, wtDir, branchName);
    commitInWorktree(wtDir);
    mergeIntoMain(repoDir, branchName);

    // Write current process PID as the lock owner
    const metaDir = worktreeMeta(repoDir, wtDir);
    const lockedFile = path.join(metaDir, 'locked');
    fs.writeFileSync(lockedFile, String(process.pid));
    const staleTime = new Date(Date.now() - 10 * 60 * 1000);
    fs.utimesSync(lockedFile, staleTime, staleTime);

    const result = reapOrphanWorktrees(repoDir);

    const skipped = result.find((r) => canonicalPath(r.path) === canonicalPath(wtDir));
    if (skipped) {
      assert.notEqual(skipped.status, 'reaped', 'live-pid worktree must not be reaped');
    }
    assert.ok(fs.existsSync(wtDir), 'worktree directory must still exist for live-pid worktree');
  });

  // ── Dead PID + unmerged branch → skip (data loss guard) ────────────────────
  test('skips a worktree whose branch has unmerged commits even with dead pid', () => {
    const repoDir = path.join(tmpBase, 'repo3');
    const wtDir = path.join(tmpBase, 'wt-unmerged');
    const branchName = 'worktree-agent-unmerged';

    initRepo(repoDir);
    addWorktree(repoDir, wtDir, branchName);
    commitInWorktree(wtDir, 'unmerged.txt');
    // NOTE: intentionally NOT merging the branch into main

    const metaDir = worktreeMeta(repoDir, wtDir);
    const lockedFile = path.join(metaDir, 'locked');
    fs.writeFileSync(lockedFile, String(deadPid()));
    const staleTime = new Date(Date.now() - 10 * 60 * 1000);
    fs.utimesSync(lockedFile, staleTime, staleTime);

    const result = reapOrphanWorktrees(repoDir);

    const entry = result.find((r) => canonicalPath(r.path) === canonicalPath(wtDir));
    if (entry) {
      assert.notEqual(entry.status, 'reaped', 'unmerged worktree must not be reaped (data loss guard)');
    }
    assert.ok(fs.existsSync(wtDir), 'unmerged worktree directory must still exist');
  });

  // ── Dead PID + merged + fresh mtime → skip (race guard) ───────────────────
  test('skips a locked worktree with fresh mtime even when pid is dead and branch is merged', () => {
    const repoDir = path.join(tmpBase, 'repo4');
    const wtDir = path.join(tmpBase, 'wt-fresh-lock');
    const branchName = 'worktree-agent-fresh-lock';

    initRepo(repoDir);
    addWorktree(repoDir, wtDir, branchName);
    commitInWorktree(wtDir, 'fresh.txt');
    mergeIntoMain(repoDir, branchName);

    const metaDir = worktreeMeta(repoDir, wtDir);
    const lockedFile = path.join(metaDir, 'locked');
    fs.writeFileSync(lockedFile, String(deadPid()));
    // Fresh mtime: within the race-guard window (< 5 minutes old); no utimes needed

    const result = reapOrphanWorktrees(repoDir);

    const entry = result.find((r) => canonicalPath(r.path) === canonicalPath(wtDir));
    if (entry) {
      assert.notEqual(entry.status, 'reaped', 'fresh-mtime worktree must not be reaped (race guard)');
    }
    assert.ok(fs.existsSync(wtDir), 'fresh-lock worktree directory must still exist');
  });

  // ── Double invocation → idempotent ─────────────────────────────────────────
  test('is idempotent: second invocation is a no-op', () => {
    const repoDir = path.join(tmpBase, 'repo5');
    const wtDir = path.join(tmpBase, 'wt-idempotent');
    const branchName = 'worktree-agent-idempotent';

    initRepo(repoDir);
    addWorktree(repoDir, wtDir, branchName);
    commitInWorktree(wtDir, 'idempotent.txt');
    mergeIntoMain(repoDir, branchName);

    const metaDir = worktreeMeta(repoDir, wtDir);
    const lockedFile = path.join(metaDir, 'locked');
    fs.writeFileSync(lockedFile, String(deadPid()));
    const staleTime = new Date(Date.now() - 10 * 60 * 1000);
    fs.utimesSync(lockedFile, staleTime, staleTime);

    const result1 = reapOrphanWorktrees(repoDir);
    const reaped1 = result1.filter((r) => r.status === 'reaped');
    assert.equal(reaped1.length, 1, 'first invocation should reap exactly one entry');

    // Second invocation: nothing left to reap
    const result2 = reapOrphanWorktrees(repoDir);
    const reaped2 = result2.filter((r) => r.status === 'reaped');
    assert.equal(reaped2.length, 0, 'second invocation should reap nothing (idempotent)');
  });
});

// ─── Suite 3: Structural — startup sweep wiring ───────────────────────────────

describe('bug-3707: startup orphan sweep is wired into workflow entry points', () => {
  const QUICK_PATH = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'quick.md');
  const EXECUTE_PHASE_PATH = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'execute-phase.md');

  test('quick.md calls worktree.reap-orphans at startup when USE_WORKTREES is not false', () => {
    const content = fs.readFileSync(QUICK_PATH, 'utf8');
    assert.ok(
      content.includes('worktree.reap-orphans'),
      'quick.md must call gsd-sdk query worktree.reap-orphans at startup'
    );
    // Must be guarded by USE_WORKTREES check
    assert.ok(
      /USE_WORKTREES.*!=.*false[\s\S]{0,200}worktree\.reap-orphans/m.test(content) ||
      /worktree\.reap-orphans[\s\S]{0,200}USE_WORKTREES.*!=.*false/m.test(content),
      'quick.md startup sweep must be guarded by USE_WORKTREES != false'
    );
  });

  test('execute-phase.md calls worktree.reap-orphans at startup when USE_WORKTREES is not false', () => {
    const content = fs.readFileSync(EXECUTE_PHASE_PATH, 'utf8');
    assert.ok(
      content.includes('worktree.reap-orphans'),
      'execute-phase.md must call gsd-sdk query worktree.reap-orphans at startup'
    );
    assert.ok(
      /USE_WORKTREES.*!=.*false[\s\S]{0,200}worktree\.reap-orphans/m.test(content) ||
      /worktree\.reap-orphans[\s\S]{0,200}USE_WORKTREES.*!=.*false/m.test(content),
      'execute-phase.md startup sweep must be guarded by USE_WORKTREES != false'
    );
  });

  test('worktree-safety module exports reapOrphanWorktrees', () => {
    const mod = require('../get-shit-done/bin/lib/worktree-safety.cjs');
    assert.strictEqual(typeof mod.reapOrphanWorktrees, 'function');
  });

  test('worktree-safety module exports cmdWorktreeReapOrphans', () => {
    const mod = require('../get-shit-done/bin/lib/worktree-safety.cjs');
    assert.strictEqual(typeof mod.cmdWorktreeReapOrphans, 'function');
  });
});

// ─── Suite 4: Adversarial gap tests ──────────────────────────────────────────

describe('bug-3707: reapOrphanWorktrees — adversarial edge cases', () => {
  let tmpBase;

  beforeEach(() => {
    tmpBase = fs.mkdtempSync(path.join(resolvedTmpDir(), 'gsd-3707-adv-'));
  });

  afterEach(() => {
    fs.rmSync(tmpBase, { recursive: true, force: true });
  });

  // ── Gap 1: Non-numeric lock content (real Claude Code format) → ALIVE (fail-closed) ──
  test('does NOT reap a worktree whose lock contains non-numeric Claude Code content', () => {
    // Claude Code writes "Locked by claude-code agent-<id>" as the lock content.
    // This is non-numeric and MUST be treated as ALIVE (fail-closed) — we cannot
    // confirm the owner is dead, so reaping would risk data loss.
    const repoDir = path.join(tmpBase, 'repo');
    const wtDir = path.join(tmpBase, 'wt-claude-lock');
    const branchName = 'worktree-agent-claude-lock';

    initRepo(repoDir);
    addWorktree(repoDir, wtDir, branchName);
    commitInWorktree(wtDir, 'claude-work.txt');
    mergeIntoMain(repoDir, branchName);

    const metaDir = worktreeMeta(repoDir, wtDir);
    const lockedFile = path.join(metaDir, 'locked');
    // Write the real Claude Code lock format (non-numeric)
    fs.writeFileSync(lockedFile, 'Locked by claude-code agent-a1b2c3d4e5f6');

    // Back-date mtime so the stale-lock guard passes
    const staleTime = new Date(Date.now() - 10 * 60 * 1000);
    fs.utimesSync(lockedFile, staleTime, staleTime);

    const result = reapOrphanWorktrees(repoDir);

    const entry = result.find((r) => canonicalPath(r.path) === canonicalPath(wtDir));
    if (entry) {
      assert.notEqual(
        entry.status,
        'reaped',
        'non-numeric Claude Code lock must NOT be reaped (fail-closed: owner unknown)'
      );
      assert.equal(entry.status, 'skipped', 'non-numeric lock entry should have status=skipped');
      assert.equal(entry.reason, 'lock_owner_unknown', 'reason must be lock_owner_unknown');
    }
    assert.ok(fs.existsSync(wtDir), 'worktree with Claude Code lock must NOT be removed');
  });

  // ── Gap 2: EPERM in defaultIsPidAlive → ALIVE (fail-closed) ─────────────────
  test('treats EPERM from isPidAlive as ALIVE (fail-closed)', () => {
    // On Windows, signalling cross-user processes throws EPERM, not ESRCH.
    // The reaper must treat EPERM as ALIVE to avoid false reaping.
    const repoDir = path.join(tmpBase, 'repo2');
    const wtDir = path.join(tmpBase, 'wt-eperm');
    const branchName = 'worktree-agent-eperm';

    initRepo(repoDir);
    addWorktree(repoDir, wtDir, branchName);
    commitInWorktree(wtDir, 'eperm-work.txt');
    mergeIntoMain(repoDir, branchName);

    const metaDir = worktreeMeta(repoDir, wtDir);
    const lockedFile = path.join(metaDir, 'locked');
    fs.writeFileSync(lockedFile, String(deadPid()));
    const staleTime = new Date(Date.now() - 10 * 60 * 1000);
    fs.utimesSync(lockedFile, staleTime, staleTime);

    // Inject an isPidAlive that always throws EPERM — simulates Windows cross-user scenario
    const epermIsPidAlive = (_pid) => {
      const err = new Error('EPERM: operation not permitted');
      err.code = 'EPERM';
      throw err;
    };

    const result = reapOrphanWorktrees(repoDir, { isPidAlive: epermIsPidAlive });

    const entry = result.find((r) => canonicalPath(r.path) === canonicalPath(wtDir));
    if (entry) {
      assert.notEqual(entry.status, 'reaped', 'EPERM from isPidAlive must be treated as ALIVE — must not reap');
    }
    assert.ok(fs.existsSync(wtDir), 'worktree must still exist when isPidAlive throws EPERM');
  });

  // ── Gap 3: Non-main/master default branch via init.defaultBranch ─────────────
  test('uses init.defaultBranch config when default branch is not main or master', () => {
    // Repos configured with init.defaultBranch=trunk (or dev, etc.) were
    // previously unreachable by the main/master fallback, causing the reaper
    // to bail out and silently skip all orphan detection.
    const repoDir = path.join(tmpBase, 'repo3');
    const wtDir = path.join(tmpBase, 'wt-trunk-default');
    const branchName = 'worktree-agent-trunk-merged';

    // Create a repo whose default branch is 'trunk'
    fs.mkdirSync(repoDir, { recursive: true });
    git(['init'], repoDir);
    git(['config', 'user.email', 'test@test.com'], repoDir);
    git(['config', 'user.name', 'Test'], repoDir);
    git(['config', 'commit.gpgsign', 'false'], repoDir);
    // Set init.defaultBranch to 'trunk' so the reaper discovers it
    git(['config', 'init.defaultBranch', 'trunk'], repoDir);
    fs.writeFileSync(path.join(repoDir, 'README.md'), '# Trunk Test\n');
    git(['add', '-A'], repoDir);
    git(['commit', '-m', 'initial commit'], repoDir);
    // Rename to trunk (may fail if already trunk)
    try { git(['branch', '-m', 'master', 'trunk'], repoDir); } catch { /* already trunk or main */ }
    try { git(['branch', '-m', 'main', 'trunk'], repoDir); } catch { /* already trunk */ }

    addWorktree(repoDir, wtDir, branchName);
    commitInWorktree(wtDir, 'trunk-work.txt');
    // Merge branch into trunk
    git(['merge', branchName, '--no-ff', '-m', 'merge into trunk'], repoDir);

    const metaDir = worktreeMeta(repoDir, wtDir);
    const lockedFile = path.join(metaDir, 'locked');
    fs.writeFileSync(lockedFile, String(deadPid()));
    const staleTime = new Date(Date.now() - 10 * 60 * 1000);
    fs.utimesSync(lockedFile, staleTime, staleTime);

    // Pre-compute canonical before reaping (symlink resolution may fail post-removal)
    const wtDirCanonical = canonicalPath(wtDir);

    const result = reapOrphanWorktrees(repoDir);

    // The reaper must either reap the worktree (using trunk as the default branch)
    // OR skip it for a safe reason — it must NOT return an empty result (which
    // would mean it bailed out entirely, silently skipping orphan detection).
    assert.ok(Array.isArray(result), 'reapOrphanWorktrees must return an array');
    assert.ok(result.length > 0, 'reaper must not bail out entirely for trunk-default repos — must inspect the worktree');
    const entry = result.find((r) => canonicalPath(r.path) === wtDirCanonical);
    assert.ok(entry, 'worktree must appear in results (reaped or skipped with reason)');
    // The branch IS merged into trunk, and the PID is dead, so it should be reaped.
    assert.equal(entry.status, 'reaped', 'worktree with dead pid merged into trunk must be reaped');
  });
});
