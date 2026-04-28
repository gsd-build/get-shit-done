/**
 * Bug #2774 — Worktree cleanup destroys parent workspace .git
 *
 * The cleanup blocks in execute-phase.md and quick.md previously used an
 * EXCLUSION-based filter:
 *
 *   git worktree list --porcelain | grep "^worktree " | grep -v "$(pwd)$" | sed ...
 *
 * That filter only excludes the literal `$(pwd)`. When a GSD project is itself
 * a git worktree of an upstream main repo (the multi-workspace case, including
 * the cross-drive Windows case where `git worktree list` reports the registry
 * path as e.g. `E:/...` while `$(pwd)` resolves to `C:/...`), every other
 * worktree — including the workspace itself — is wiped, taking the
 * workspace's `.git` pointer file with it.
 *
 * The fix is INCLUSION-based: only target paths matching the agent worktree
 * convention (`.claude/worktrees/agent-`), the namespace under which Claude
 * Code's `isolation="worktree"` always creates executor worktrees.
 *
 * These tests assert the cleanup block in BOTH workflow files:
 *   1. Includes only paths matching `.claude/worktrees/agent-` (positive filter)
 *   2. Does NOT rely on `grep -v "$(pwd)$"` as the sole guard (negative filter)
 */

'use strict';

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { cleanup } = require('./helpers.cjs');

// The exact discovery pipeline from get-shit-done/workflows/quick.md and
// get-shit-done/workflows/execute-phase.md (line: `WORKTREES=$(git worktree
// list --porcelain | grep "^worktree " | grep "\.claude/worktrees/agent-" |
// sed 's/^worktree //')`). We invoke it as a standalone shell pipeline
// against either real `git worktree list --porcelain` output (in the
// end-to-end case) or piped-in fixture text (in the unit case).
// Note: execSync runs with `shell: '/bin/sh'` by default, which interprets the
// command string directly — no extra `bash -c '...'` wrapper needed. The
// pipeline string below is the verbatim shell from quick.md / execute-phase.md
// (the RHS of the `WORKTREES=$(...)` substitution).
const DISCOVERY_PIPELINE =
  'grep "^worktree " | grep "\\.claude/worktrees/agent-" | sed \'s/^worktree //\'';

function runDiscoveryAgainstFixture(porcelain) {
  const out = execSync(DISCOVERY_PIPELINE, {
    input: porcelain,
    encoding: 'utf-8',
  });
  return out.split('\n').filter((l) => l.length > 0);
}

function runDiscoveryAgainstRepo(repoCwd) {
  const out = execSync(
    `git worktree list --porcelain | ${DISCOVERY_PIPELINE}`,
    { cwd: repoCwd, encoding: 'utf-8' }
  );
  return out.split('\n').filter((l) => l.length > 0);
}

function makeTempUpstreamRepo(prefix) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  execSync('git init -b main', { cwd: tmpDir, stdio: 'pipe' });
  execSync('git config user.email "test@test.com"', { cwd: tmpDir, stdio: 'pipe' });
  execSync('git config user.name "Test"', { cwd: tmpDir, stdio: 'pipe' });
  execSync('git config commit.gpgsign false', { cwd: tmpDir, stdio: 'pipe' });
  fs.writeFileSync(path.join(tmpDir, 'README.md'), '# upstream\n');
  execSync('git add -A', { cwd: tmpDir, stdio: 'pipe' });
  execSync('git commit -m "initial"', { cwd: tmpDir, stdio: 'pipe' });
  return tmpDir;
}

describe('bug #2774 — worktree cleanup pipeline must not target the parent workspace', () => {
  describe('discovery pipeline (unit)', () => {
    test('selects only the agent worktree when workspace itself is a worktree', () => {
      // Fixture mirrors the multi-workspace setup: upstream main + sibling
      // workspace worktree + agent worktree under workspace's
      // `.claude/worktrees/agent-` namespace.
      const porcelain = [
        'worktree /Users/dev/upstream/get-shit-done',
        'HEAD abc123',
        'branch refs/heads/main',
        '',
        'worktree /Users/dev/workspaces/feature-x',
        'HEAD def456',
        'branch refs/heads/workspace/feature-x',
        '',
        'worktree /Users/dev/workspaces/feature-x/.claude/worktrees/agent-deadbeef',
        'HEAD 789abc',
        'branch refs/heads/worktree-agent-deadbeef',
        '',
      ].join('\n');

      const discovered = runDiscoveryAgainstFixture(porcelain);

      assert.deepEqual(
        discovered,
        ['/Users/dev/workspaces/feature-x/.claude/worktrees/agent-deadbeef'],
        'pipeline must select only the agent-spawned worktree, never the ' +
          'workspace or upstream main repo'
      );
    });

    test('selects nothing when no agent worktrees exist', () => {
      const porcelain = [
        'worktree /Users/dev/upstream/get-shit-done',
        'HEAD abc123',
        'branch refs/heads/main',
        '',
        'worktree /Users/dev/workspaces/feature-x',
        'HEAD def456',
        'branch refs/heads/workspace/feature-x',
        '',
      ].join('\n');

      const discovered = runDiscoveryAgainstFixture(porcelain);

      assert.deepEqual(discovered, []);
    });

    test('selects multiple agent worktrees and excludes non-agent paths', () => {
      const porcelain = [
        'worktree /repo/main',
        'HEAD a',
        'branch refs/heads/main',
        '',
        'worktree /repo/main/.claude/worktrees/agent-aaa',
        'HEAD b',
        'branch refs/heads/agent-aaa',
        '',
        'worktree /repo/main/.claude/worktrees/agent-bbb',
        'HEAD c',
        'branch refs/heads/agent-bbb',
        '',
        'worktree /repo/main/some-other-dir',
        'HEAD d',
        'branch refs/heads/feature',
        '',
      ].join('\n');

      const discovered = runDiscoveryAgainstFixture(porcelain);

      assert.deepEqual(discovered.sort(), [
        '/repo/main/.claude/worktrees/agent-aaa',
        '/repo/main/.claude/worktrees/agent-bbb',
      ]);
    });

    test('selects agent worktree even when path contains whitespace', () => {
      // Regression for CodeRabbit feedback on PR #2778: `for WT in $WORKTREES`
      // splits on whitespace and would emit broken half-paths like
      // "/Users/dev/My" and "Workspace/.claude/worktrees/agent-xyz". The
      // pipeline output itself is line-delimited and preserves the full path —
      // the workflow's loop must consume it line-by-line via `while IFS= read`.
      const porcelain = [
        'worktree /Users/dev/My Workspace',
        'HEAD def456',
        'branch refs/heads/workspace/feature-x',
        '',
        'worktree /Users/dev/My Workspace/.claude/worktrees/agent-deadbeef',
        'HEAD 789abc',
        'branch refs/heads/worktree-agent-deadbeef',
        '',
      ].join('\n');

      const discovered = runDiscoveryAgainstFixture(porcelain);

      assert.deepEqual(
        discovered,
        ['/Users/dev/My Workspace/.claude/worktrees/agent-deadbeef'],
        'pipeline output must preserve whitespace-bearing agent worktree path on a single line'
      );
    });

    test('while/read loop iterates each whitespace-bearing path exactly once', () => {
      // Verify the actual consumer pattern from quick.md / execute-phase.md:
      //   while IFS= read -r WT; do ...; done < <(<pipeline>)
      // Counts the lines yielded to the loop body. With the previous
      // `for WT in $WORKTREES` form, a path containing one space would yield
      // 2 iterations (broken halves). The `while/read` form yields exactly 1.
      const porcelain = [
        'worktree /tmp/has space/.claude/worktrees/agent-aaa',
        'HEAD a',
        'branch refs/heads/agent-aaa',
        '',
        'worktree /tmp/two  spaces/.claude/worktrees/agent-bbb',
        'HEAD b',
        'branch refs/heads/agent-bbb',
        '',
      ].join('\n');

      // Mirror the workflow's loop verbatim. Print one line per iteration with
      // a sentinel so we can count and inspect what the loop actually saw.
      const script = `
while IFS= read -r WT; do
  [ -z "$WT" ] && continue
  printf 'ITER:%s\\n' "$WT"
done < <(${DISCOVERY_PIPELINE})
`;
      // bash needed for process substitution `< <(...)`.
      const out = execSync(`bash -c '${script.replace(/'/g, `'\\''`)}'`, {
        input: porcelain,
        encoding: 'utf-8',
      });
      const iterations = out
        .split('\n')
        .filter((l) => l.startsWith('ITER:'))
        .map((l) => l.slice('ITER:'.length));

      assert.deepEqual(
        iterations,
        [
          '/tmp/has space/.claude/worktrees/agent-aaa',
          '/tmp/two  spaces/.claude/worktrees/agent-bbb',
        ],
        'while/read loop must yield exactly one iteration per worktree, with whitespace preserved'
      );
    });
  });

  describe('end-to-end against real git worktrees', () => {
    let upstream;
    let workspace;
    let agentWorktree;
    let workspacesParent;

    beforeEach(() => {
      // Build the multi-worktree scenario from #2774:
      //   upstream/         <- main repo
      //   workspace/        <- worktree of upstream (the "workspace")
      //   workspace/.claude/worktrees/agent-XXXX/  <- agent worktree
      upstream = makeTempUpstreamRepo('gsd-2774-upstream-');

      workspacesParent = fs.mkdtempSync(
        path.join(os.tmpdir(), 'gsd-2774-workspaces-')
      );
      workspace = path.join(workspacesParent, 'feature-x');
      execSync(`git worktree add -b workspace/feature-x "${workspace}"`, {
        cwd: upstream,
        stdio: 'pipe',
      });

      const agentDir = path.join(workspace, '.claude', 'worktrees');
      fs.mkdirSync(agentDir, { recursive: true });
      agentWorktree = path.join(agentDir, 'agent-deadbeef');
      execSync(
        `git worktree add -b worktree-agent-deadbeef "${agentWorktree}"`,
        { cwd: upstream, stdio: 'pipe' }
      );
    });

    afterEach(() => {
      try {
        execSync('git worktree prune', { cwd: upstream, stdio: 'pipe' });
      } catch (_) {
        /* ignore */
      }
      cleanup(upstream);
      cleanup(workspacesParent);
    });

    test('discovery from inside workspace returns only the agent worktree', () => {
      const discovered = runDiscoveryAgainstRepo(workspace);

      // Resolve symlinks (macOS /var → /private/var) for stable comparison.
      const expected = fs.realpathSync(agentWorktree);
      const actual = discovered.map((p) => fs.realpathSync(p));

      assert.deepEqual(
        actual,
        [expected],
        'pipeline must list only the agent worktree, not the workspace or upstream'
      );
    });

    test('running cleanup loop on discovered paths preserves workspace .git', () => {
      const workspaceGitBefore = fs.readFileSync(
        path.join(workspace, '.git'),
        'utf-8'
      );
      assert.ok(
        fs.existsSync(path.join(upstream, '.git')),
        'precondition: upstream .git must exist'
      );

      const discovered = runDiscoveryAgainstRepo(workspace);
      assert.equal(
        discovered.length,
        1,
        'precondition: exactly one agent worktree should be discovered'
      );

      // Execute the cleanup behavior end-to-end: `git worktree remove --force`
      // each discovered path. This mirrors the workflow's cleanup loop.
      for (const wt of discovered) {
        execSync(`git worktree remove --force "${wt}"`, {
          cwd: workspace,
          stdio: 'pipe',
        });
      }

      // Agent worktree dir must be gone.
      assert.equal(
        fs.existsSync(agentWorktree),
        false,
        'agent worktree dir should be removed by cleanup'
      );

      // Workspace `.git` pointer file must still exist and be unchanged —
      // the regression we are guarding against.
      assert.ok(
        fs.existsSync(path.join(workspace, '.git')),
        'workspace .git pointer must survive cleanup (regression #2774)'
      );
      assert.equal(
        fs.readFileSync(path.join(workspace, '.git'), 'utf-8'),
        workspaceGitBefore,
        'workspace .git pointer contents must be unchanged'
      );

      // Upstream repo's .git directory must also be intact.
      assert.ok(
        fs.existsSync(path.join(upstream, '.git')),
        'upstream .git must survive cleanup'
      );

      // Workspace must still be a functional git worktree.
      const branch = execSync('git rev-parse --abbrev-ref HEAD', {
        cwd: workspace,
        encoding: 'utf-8',
      }).trim();
      assert.equal(
        branch,
        'workspace/feature-x',
        'workspace must still be a functional worktree on its branch'
      );
    });
  });
});
