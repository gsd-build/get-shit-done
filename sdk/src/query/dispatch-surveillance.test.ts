/**
 * Vitest unit tests for `dispatch.commit-since` (issue #3212, Stage C).
 *
 * Each test arranges a tmp git project with controlled commit timestamps
 * and asserts the surveillance probe correctly detects "did anything land
 * since T?" The handler is a best-effort read-only probe — its contract
 * with callers is: never throw on git failures, always return the result
 * shape, treat "no git" the same as "no commits."
 */

import { describe, expect, test, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { dispatchCommitSince, type DispatchCommitSinceResult } from './dispatch-surveillance.js';

interface GitFixture { dir: string }

function mkGitRepo(): GitFixture {
  const dir = mkdtempSync(join(tmpdir(), 'gsd-surv-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  execFileSync('git', ['config', 'user.email', 'test@test.com'], { cwd: dir });
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: dir });
  execFileSync('git', ['config', 'commit.gpgsign', 'false'], { cwd: dir });
  return { dir };
}

function commit(dir: string, subject: string, timestampUnix?: number): void {
  const env: Record<string, string> = { ...process.env } as Record<string, string>;
  if (timestampUnix !== undefined) {
    const iso = new Date(timestampUnix * 1000).toISOString();
    env.GIT_AUTHOR_DATE = iso;
    env.GIT_COMMITTER_DATE = iso;
  }
  execFileSync('git', ['commit', '--allow-empty', '-m', subject], { cwd: dir, env });
}

function nowUnix(): number {
  return Math.floor(Date.now() / 1000);
}

describe('dispatchCommitSince — argv validation', () => {
  test('throws when --since is missing', async () => {
    await expect(dispatchCommitSince([], '/tmp')).rejects.toThrow(/--since/);
  });

  test('throws when --since has no value', async () => {
    await expect(dispatchCommitSince(['--since'], '/tmp')).rejects.toThrow();
  });

  test('throws when --since is not numeric', async () => {
    await expect(dispatchCommitSince(['--since', 'yesterday'], '/tmp')).rejects.toThrow(/non-negative/);
  });

  test('throws when --since is negative', async () => {
    await expect(dispatchCommitSince(['--since', '-1'], '/tmp')).rejects.toThrow();
  });

  test('throws when --plan has no value', async () => {
    await expect(dispatchCommitSince(['--since', '0', '--plan'], '/tmp')).rejects.toThrow(/--plan/);
  });
});

describe('dispatchCommitSince — best-effort failure handling', () => {
  test('returns count=0 in non-git directory (no throw)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'gsd-surv-nogit-'));
    try {
      const out = await dispatchCommitSince(['--since', '0'], dir);
      const data = out.data as DispatchCommitSinceResult;
      expect(data.count).toBe(0);
      expect(data.latest_hash).toBeNull();
      expect(data.latest_timestamp_unix).toBeNull();
      expect(data.since_unix).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('echoes since_unix and plan_filter regardless of git state', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'gsd-surv-nogit-'));
    try {
      const out = await dispatchCommitSince(['--since', '1234567890', '--plan', '4-03'], dir);
      const data = out.data as DispatchCommitSinceResult;
      expect(data.since_unix).toBe(1234567890);
      expect(data.plan_filter).toBe('4-03');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('dispatchCommitSince — git probe correctness', () => {
  let fix: GitFixture;
  beforeEach(() => { fix = mkGitRepo(); });
  afterEach(() => { rmSync(fix.dir, { recursive: true, force: true }); });

  test('counts only commits after --since', async () => {
    // Three commits at known timestamps, all in the past.
    commit(fix.dir, 'old commit', 1_700_000_000);
    commit(fix.dir, 'middle commit', 1_700_500_000);
    commit(fix.dir, 'recent commit', 1_701_000_000);

    // since=1_700_400_000 should exclude the first, include the latter two
    const out = await dispatchCommitSince(['--since', '1700400000'], fix.dir);
    const data = out.data as DispatchCommitSinceResult;
    expect(data.count).toBe(2);
    expect(data.latest_subject).toBe('recent commit');
    expect(data.latest_timestamp_unix).toBe(1_701_000_000);
  });

  test('count=0 when nothing newer than since', async () => {
    commit(fix.dir, 'old commit', 1_700_000_000);
    const future = nowUnix() + 86_400;  // 1 day in the future
    const out = await dispatchCommitSince(['--since', String(future)], fix.dir);
    const data = out.data as DispatchCommitSinceResult;
    expect(data.count).toBe(0);
    expect(data.latest_hash).toBeNull();
  });

  test('--plan filter narrows count to subject-matching commits', async () => {
    commit(fix.dir, 'feat(4-03): A', 1_700_000_000);
    commit(fix.dir, 'feat(4-04): unrelated', 1_700_500_000);
    commit(fix.dir, 'feat(4-03): B', 1_701_000_000);

    const out = await dispatchCommitSince(['--since', '0', '--plan', '4-03'], fix.dir);
    const data = out.data as DispatchCommitSinceResult;
    expect(data.count).toBe(2);
    expect(data.plan_filter).toBe('4-03');
  });

  test('latest_hash is a non-empty short hash when any commit matches', async () => {
    commit(fix.dir, 'a commit', 1_700_000_000);
    const out = await dispatchCommitSince(['--since', '0'], fix.dir);
    const data = out.data as DispatchCommitSinceResult;
    expect(data.latest_hash).toBeTruthy();
    expect(typeof data.latest_hash).toBe('string');
    expect((data.latest_hash as string).length).toBeGreaterThan(0);
  });
});

describe('dispatchCommitSince — read-only contract', () => {
  let fix: GitFixture;
  beforeEach(() => { fix = mkGitRepo(); });
  afterEach(() => { rmSync(fix.dir, { recursive: true, force: true }); });

  test('does not create any files', async () => {
    commit(fix.dir, 'one', 1_700_000_000);
    const fs = await import('node:fs');
    const before = fs.readdirSync(fix.dir).sort().join(',');
    await dispatchCommitSince(['--since', '0'], fix.dir);
    const after = fs.readdirSync(fix.dir).sort().join(',');
    expect(after).toBe(before);
  });

  test('does not advance HEAD', async () => {
    commit(fix.dir, 'one', 1_700_000_000);
    const before = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: fix.dir, encoding: 'utf8' }).trim();
    await dispatchCommitSince(['--since', '0'], fix.dir);
    const after = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: fix.dir, encoding: 'utf8' }).trim();
    expect(after).toBe(before);
  });
});
