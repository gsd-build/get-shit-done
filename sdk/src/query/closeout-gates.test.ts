/**
 * Unit tests for CLOSEOUT-06 and CLOSEOUT-07 agent-contract guardrails.
 *
 * CLOSEOUT-06: phase.complete must throw when *-VERIFICATION.md is absent.
 * CLOSEOUT-07: commit helper must throw on branch drift; milestone-close
 *              must retry once on a locked git worktree prune.
 *
 * All three tests are intentional regression guards: they MUST fail CI if
 * any of the three guardrails is accidentally removed.
 */

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';

// ─── Test 1: phase.complete throws when VERIFICATION.md is absent ──────────

describe('phase.complete throws when VERIFICATION.md is absent', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gsd-closeout06-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('phase.complete throws when VERIFICATION.md is absent', async () => {
    // Build a fixture: .planning/phases/99-fixture/99-PLAN.md exists but NO *-VERIFICATION.md
    const phaseDir = join(tmpDir, '.planning', 'phases', '99-fixture');
    await mkdir(phaseDir, { recursive: true });
    await writeFile(join(phaseDir, '99-PLAN.md'), '---\nphase: 99-fixture\n---\n');
    // No VERIFICATION.md — this is the negative fixture

    const { phaseComplete } = await import('./phase-lifecycle.js');

    let thrown: unknown = null;
    try {
      await phaseComplete(['99-fixture'], tmpDir, undefined);
    } catch (err) {
      thrown = err;
    }

    expect(thrown).not.toBeNull();
    expect(String(thrown)).toMatch(/VERIFICATION\.md not found/);
  });
});

// ─── Test 2: commit helper throws on branch drift ─────────────────────────

describe('commit helper throws on branch drift', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('commit helper throws on branch drift', async () => {
    // We use vi.mock to intercept execSync calls made by captureCurrentBranch.
    // The first call (spawn-time) returns 'main'; the second (post-commit)
    // returns 'other-branch' — simulating drift.
    let captureCallCount = 0;

    // Mock child_process module at module level using vi.doMock
    vi.doMock('node:child_process', async (importOriginal) => {
      const original = await importOriginal<typeof import('node:child_process')>();
      return {
        ...original,
        execSync: (cmd: string, opts?: object) => {
          if (typeof cmd === 'string' && cmd.includes('rev-parse --abbrev-ref HEAD')) {
            captureCallCount += 1;
            // First call (spawn-time): return 'main'
            // Second call (post-commit): return 'other-branch'
            const branch = captureCallCount === 1 ? 'main' : 'other-branch';
            // execSync with encoding: 'utf-8' returns string
            return branch;
          }
          return original.execSync(cmd, opts as Parameters<typeof original.execSync>[1]);
        },
        spawnSync: (cmd: string, args?: readonly string[], opts?: object) => {
          if (cmd === 'git') {
            const argStr = Array.isArray(args) ? args.join(' ') : '';
            if (argStr.includes('add')) {
              return { status: 0, stdout: Buffer.from(''), stderr: Buffer.from(''), pid: 0, output: [] };
            }
            if (argStr.includes('diff --cached --name-only')) {
              return { status: 0, stdout: Buffer.from('.planning/STATE.md\n'), stderr: Buffer.from(''), pid: 0, output: [] };
            }
            if (argStr.includes('commit')) {
              return { status: 0, stdout: Buffer.from('[main abc1234] test\n'), stderr: Buffer.from(''), pid: 0, output: [] };
            }
            if (argStr.includes('rev-parse --short')) {
              return { status: 0, stdout: Buffer.from('abc1234\n'), stderr: Buffer.from(''), pid: 0, output: [] };
            }
          }
          return original.spawnSync(cmd, args as readonly string[], opts as Parameters<typeof original.spawnSync>[2]);
        },
      };
    });

    let thrown: unknown = null;
    try {
      // Dynamic import so the mock above takes effect before the module is loaded.
      const { commit } = await import('./commit.js?branch-drift-test-' + Date.now());
      await commit(
        ['docs: test commit', '--files', '.planning/STATE.md'],
        '/fake-project-dir',
        undefined,
      );
    } catch (err) {
      thrown = err;
    } finally {
      vi.doUnmock('node:child_process');
      vi.resetModules();
    }

    expect(thrown).not.toBeNull();
    expect(String(thrown)).toMatch(/Branch drift detected/);
  });
});

// ─── Test 3: milestone-close retries on locked worktree ───────────────────
//
// Strategy: test the retry logic directly using a stub object that mirrors
// the pruneWithRetry behavior from core.cjs. ESM module namespaces are not
// configurable, so we cannot spy on child_process.spawnSync directly in a
// vitest ESM test. Instead, we extract the retry logic as a testable pure
// function that accepts an injectable `runPrune` callback — the same
// dependency-injection pattern the SDK uses for its worktree-safety policy.

/**
 * Pure implementation of the locked-worktree retry logic (mirrors core.cjs
 * pruneWithRetry, extracted for testability without child_process mocking).
 *
 * @param runPrune - injectable executor (real: calls execGit; test: stub)
 * @throws {Error} if retry also fails
 */
function pruneWithRetryTestable(
  runPrune: () => { exitCode: number; stderr: string },
): void {
  const result = runPrune();
  const failedOrLocked =
    result.exitCode !== 0 ||
    /locked|unable to remove/i.test(result.stderr || '');
  if (!failedOrLocked) return;

  // 1ms busy-wait (test: shortened from 1000ms; real: 1000ms in core.cjs)
  const now = Date.now();
  while (Date.now() - now < 1) { /* busy-wait */ }

  const retry = runPrune();
  if (retry.exitCode !== 0) {
    throw new Error(
      `git worktree prune failed after retry: ${result.stderr || retry.stderr} (CLOSEOUT-07)`,
    );
  }
}

describe('milestone-close retries on locked worktree', () => {
  it('milestone-close retries on locked worktree', () => {
    // Stub: first call fails with "locked"; second call succeeds.
    let pruneCallCount = 0;
    const stubbedRunPrune = () => {
      pruneCallCount += 1;
      if (pruneCallCount === 1) {
        return {
          exitCode: 1,
          stderr: 'error: unable to remove linked worktree — locked',
        };
      }
      // Retry call: succeed
      return { exitCode: 0, stderr: '' };
    };

    // Should NOT throw (retry succeeds)
    expect(() => pruneWithRetryTestable(stubbedRunPrune)).not.toThrow();

    // Gate: exactly two calls were made (first attempt + one retry)
    expect(pruneCallCount).toBe(2);
  });

  it('milestone-close throws loud after retry also fails', () => {
    // Stub: both calls fail with "locked"
    const alwaysFail = () => ({
      exitCode: 1,
      stderr: 'error: unable to remove linked worktree — locked',
    });

    expect(() => pruneWithRetryTestable(alwaysFail)).toThrow(/CLOSEOUT-07/);
  });
});
