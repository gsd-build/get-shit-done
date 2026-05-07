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

// ─── pathspec scope regression (#3061) ────────────────────────────────────
//
// The handler must commit only the paths it staged itself, even when the
// caller's git index already had unrelated entries staged before the call.
// Before the fix, `git commit` ran without a pathspec and swept those
// pre-staged entries into the commit alongside the requested files.

describe('commit pathspec scope (#3061)', () => {
  // Each test needs an existing HEAD so we can pre-stage a deletion against it.
  beforeEach(async () => {
    await writeFile(join(tmpDir, 'README.md'), 'init\n');
    execSync('git add README.md', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git commit -m "init"', { cwd: tmpDir, stdio: 'pipe' });
    await writeFile(
      join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ commit_docs: true }),
    );
  });

  it('--files commits only the named paths when an unrelated change is pre-staged', async () => {
    const { commit } = await import('./commit.js');
    await writeFile(join(tmpDir, '.planning', 'STATE.md'), '# State\n');

    // Operator scenario from the issue: a `git rm` is already in the index
    // before the workflow's commit step runs.
    execSync('git rm README.md', { cwd: tmpDir, stdio: 'pipe' });

    const result = await commit(['docs: state only', '--files', '.planning/STATE.md'], tmpDir);
    expect((result.data as { committed: boolean }).committed).toBe(true);

    const committed = execSync('git show --name-only --format= HEAD', { cwd: tmpDir, encoding: 'utf-8' })
      .trim()
      .split('\n');
    expect(committed).toContain('.planning/STATE.md');
    expect(committed).not.toContain('README.md');

    // The pre-staged deletion must remain staged-but-uncommitted.
    const status = execSync('git status --porcelain', { cwd: tmpDir, encoding: 'utf-8' });
    expect(status).toMatch(/^D {2}README\.md/m);
  });

  it('.planning/ fallback commits only planning paths when an unrelated change is pre-staged', async () => {
    const { commit } = await import('./commit.js');
    await writeFile(join(tmpDir, '.planning', 'STATE.md'), '# State\n');

    execSync('git rm README.md', { cwd: tmpDir, stdio: 'pipe' });

    const result = await commit(['docs: planning'], tmpDir);
    expect((result.data as { committed: boolean }).committed).toBe(true);

    const committed = execSync('git show --name-only --format= HEAD', { cwd: tmpDir, encoding: 'utf-8' })
      .trim()
      .split('\n');
    expect(committed).not.toContain('README.md');
    expect(committed.some(f => f.startsWith('.planning/'))).toBe(true);

    const status = execSync('git status --porcelain', { cwd: tmpDir, encoding: 'utf-8' });
    expect(status).toMatch(/^D {2}README\.md/m);
  });

  it('--amend with --files keeps the amend within the named pathspec', async () => {
    const { commit } = await import('./commit.js');

    // Land an initial planning commit to amend, and assert the setup landed.
    // If it silently failed the amend would target the wrong HEAD and the
    // assertions below would still pass for the wrong reason.
    await writeFile(join(tmpDir, '.planning', 'STATE.md'), '# State v1\n');
    const setup = await commit(['docs: initial state', '--files', '.planning/STATE.md'], tmpDir);
    expect((setup.data as { committed: boolean }).committed).toBe(true);

    // Modify STATE.md, then pre-stage an unrelated change before amending.
    await writeFile(join(tmpDir, '.planning', 'STATE.md'), '# State v2\n');
    execSync('git rm README.md', { cwd: tmpDir, stdio: 'pipe' });

    const result = await commit(['docs: amended', '--amend', '--files', '.planning/STATE.md'], tmpDir);
    expect((result.data as { committed: boolean }).committed).toBe(true);

    const committed = execSync('git show --name-only --format= HEAD', { cwd: tmpDir, encoding: 'utf-8' })
      .trim()
      .split('\n');
    expect(committed).toContain('.planning/STATE.md');
    expect(committed).not.toContain('README.md');

    const status = execSync('git status --porcelain', { cwd: tmpDir, encoding: 'utf-8' });
    expect(status).toMatch(/^D {2}README\.md/m);
  });
});

// ─── input validation and option-injection safety (#3061 follow-ups) ──────
//
// Two guards that travel with the pathspec rewrite:
//   1. --files with no usable paths fails fast instead of falling back to
//      .planning/, which would silently swap the caller's intended scope.
//   2. Every git add invocation uses the `--` separator so a path that
//      starts with `-` is treated as a pathspec rather than an option.

describe('commit input validation and option safety (#3061)', () => {
  beforeEach(async () => {
    await writeFile(join(tmpDir, 'README.md'), 'init\n');
    execSync('git add README.md', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git commit -m "init"', { cwd: tmpDir, stdio: 'pipe' });
    await writeFile(
      join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ commit_docs: true }),
    );
  });

  it('--files with no usable paths is rejected instead of silently using .planning/', async () => {
    const { commit } = await import('./commit.js');
    // Drop a planning change that the .planning/ fallback would otherwise pick up.
    await writeFile(join(tmpDir, '.planning', 'STATE.md'), '# State\n');

    const result = await commit(['msg', '--files', '--no-verify'], tmpDir);
    expect((result.data as { committed: boolean }).committed).toBe(false);
    expect((result.data as { reason: string }).reason).toContain('--files requires at least one path');

    // The handler must not have staged anything: if it had silently fallen
    // back to .planning/, STATE.md would now show up in the staged list.
    const stagedAfter = execSync('git diff --cached --name-only', { cwd: tmpDir, encoding: 'utf-8' }).trim();
    expect(stagedAfter).toBe('');
  });

  it('stages a file whose name starts with "-" instead of misparsing it as a git option', async () => {
    const { commit } = await import('./commit.js');
    // A filename like `-A.md` is the canonical option-injection trap:
    // without the `--` separator, `git add -A.md` would be parsed as a flag.
    const dashName = '-A.md';
    await writeFile(join(tmpDir, dashName), 'dash content\n');

    const result = await commit(['feat: add dash file', '--files', dashName], tmpDir);
    expect((result.data as { committed: boolean }).committed).toBe(true);

    const committed = execSync('git show --name-only --format= HEAD', { cwd: tmpDir, encoding: 'utf-8' })
      .trim()
      .split('\n');
    expect(committed).toContain(dashName);
  });
});
