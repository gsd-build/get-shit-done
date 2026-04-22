/**
 * Unit tests for git commit and check-commit query handlers.
 *
 * Tests: execGit, sanitizeCommitMessage, commit, checkCommit.
 * Uses real git repos in temp directories.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';

// ─── Test setup ─────────────────────────────────────────────────────────────

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'gsd-commit-'));
  // Initialize a git repo
  execSync('git init', { cwd: tmpDir, stdio: 'pipe' });
  execSync('git config user.email "test@test.com"', { cwd: tmpDir, stdio: 'pipe' });
  execSync('git config user.name "Test User"', { cwd: tmpDir, stdio: 'pipe' });
  // Create .planning directory
  await mkdir(join(tmpDir, '.planning'), { recursive: true });
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

// ─── execGit ───────────────────────────────────────────────────────────────

describe('execGit', () => {
  it('returns exitCode 0 for successful command', async () => {
    const { execGit } = await import('./commit.js');
    const result = execGit(tmpDir, ['status']);
    expect(result.exitCode).toBe(0);
  });

  it('returns non-zero exitCode for failed command', async () => {
    const { execGit } = await import('./commit.js');
    const result = execGit(tmpDir, ['log', '--oneline']);
    // git log fails in empty repo with no commits
    expect(result.exitCode).not.toBe(0);
  });

  it('captures stdout from git command', async () => {
    const { execGit } = await import('./commit.js');
    const result = execGit(tmpDir, ['rev-parse', '--git-dir']);
    expect(result.stdout).toBe('.git');
  });
});

// ─── sanitizeCommitMessage ─────────────────────────────────────────────────

describe('sanitizeCommitMessage', () => {
  it('strips null bytes and zero-width characters', async () => {
    const { sanitizeCommitMessage } = await import('./commit.js');
    const result = sanitizeCommitMessage('hello\u0000\u200Bworld');
    expect(result).toBe('helloworld');
  });

  it('neutralizes injection markers', async () => {
    const { sanitizeCommitMessage } = await import('./commit.js');
    const result = sanitizeCommitMessage('fix: update <system> prompt [SYSTEM] test');
    expect(result).not.toContain('<system>');
    expect(result).not.toContain('[SYSTEM]');
  });

  it('preserves normal commit messages', async () => {
    const { sanitizeCommitMessage } = await import('./commit.js');
    const result = sanitizeCommitMessage('feat(auth): add login endpoint');
    expect(result).toBe('feat(auth): add login endpoint');
  });

  it('returns input unchanged for non-string', async () => {
    const { sanitizeCommitMessage } = await import('./commit.js');
    expect(sanitizeCommitMessage('')).toBe('');
  });
});

// ─── commit ────────────────────────────────────────────────────────────────

describe('commit', () => {
  it('returns committed:false when commit_docs is false and no --force', async () => {
    const { commit } = await import('./commit.js');
    await writeFile(
      join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ commit_docs: false }),
    );
    const result = await commit(['test commit message'], tmpDir);
    expect((result.data as { committed: boolean }).committed).toBe(false);
    expect((result.data as { reason: string }).reason).toContain('commit_docs');
  });

  it('creates commit with --force even when commit_docs is false', async () => {
    const { commit } = await import('./commit.js');
    await writeFile(
      join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ commit_docs: false }),
    );
    await writeFile(join(tmpDir, '.planning', 'STATE.md'), '# State\n');
    const result = await commit(['test commit', '--force'], tmpDir);
    expect((result.data as { committed: boolean }).committed).toBe(true);
    expect((result.data as { hash: string }).hash).toBeTruthy();
  });

  it('stages files and creates commit with correct message', async () => {
    const { commit } = await import('./commit.js');
    await writeFile(
      join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ commit_docs: true }),
    );
    await writeFile(join(tmpDir, '.planning', 'STATE.md'), '# State\n');
    const result = await commit(['docs: update state'], tmpDir);
    expect((result.data as { committed: boolean }).committed).toBe(true);
    expect((result.data as { hash: string }).hash).toBeTruthy();

    // Verify commit message in git log
    const log = execSync('git log -1 --format=%s', { cwd: tmpDir, encoding: 'utf-8' }).trim();
    expect(log).toBe('docs: update state');
  });

  it('returns nothing staged when no files match', async () => {
    const { commit } = await import('./commit.js');
    await writeFile(
      join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ commit_docs: true }),
    );
    // Stage config.json first then commit it so .planning/ has no unstaged changes
    execSync('git add .planning/config.json', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git commit -m "init"', { cwd: tmpDir, stdio: 'pipe' });
    // Now commit with specific nonexistent file (--files separates message from paths, matching CJS argv)
    const result = await commit(['test msg', '--files', 'nonexistent-file.txt'], tmpDir);
    expect((result.data as { committed: boolean }).committed).toBe(false);
    expect((result.data as { reason: string }).reason).toContain('nonexistent-file.txt');
  });

  it('commits specific files when provided', async () => {
    const { commit } = await import('./commit.js');
    await writeFile(
      join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ commit_docs: true }),
    );
    await writeFile(join(tmpDir, '.planning', 'STATE.md'), '# State\n');
    await writeFile(join(tmpDir, '.planning', 'ROADMAP.md'), '# Roadmap\n');
    const result = await commit(['docs: state only', '--files', '.planning/STATE.md'], tmpDir);
    expect((result.data as { committed: boolean }).committed).toBe(true);

    // Verify only STATE.md was committed
    const files = execSync('git show --name-only --format=', { cwd: tmpDir, encoding: 'utf-8' }).trim();
    expect(files).toContain('STATE.md');
    expect(files).not.toContain('ROADMAP.md');
  });
});

// ─── checkCommit ───────────────────────────────────────────────────────────

describe('checkCommit', () => {
  it('returns can_commit:true when commit_docs is enabled', async () => {
    const { checkCommit } = await import('./commit.js');
    await writeFile(
      join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ commit_docs: true }),
    );
    const result = await checkCommit([], tmpDir);
    expect((result.data as { can_commit: boolean }).can_commit).toBe(true);
  });

  it('returns can_commit:true when commit_docs is not set', async () => {
    const { checkCommit } = await import('./commit.js');
    await writeFile(
      join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({}),
    );
    const result = await checkCommit([], tmpDir);
    expect((result.data as { can_commit: boolean }).can_commit).toBe(true);
  });

  it('returns can_commit:false when commit_docs is false and planning files staged', async () => {
    const { checkCommit } = await import('./commit.js');
    await writeFile(
      join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ commit_docs: false }),
    );
    await writeFile(join(tmpDir, '.planning', 'STATE.md'), '# State\n');
    execSync('git add .planning/STATE.md', { cwd: tmpDir, stdio: 'pipe' });
    const result = await checkCommit([], tmpDir);
    expect((result.data as { can_commit: boolean }).can_commit).toBe(false);
  });

  it('returns can_commit:true when commit_docs is false but no planning files staged', async () => {
    const { checkCommit } = await import('./commit.js');
    await writeFile(
      join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ commit_docs: false }),
    );
    const result = await checkCommit([], tmpDir);
    expect((result.data as { can_commit: boolean }).can_commit).toBe(true);
  });
});
