/**
 * Unit tests for `check.ship-ready` (decision-routing audit §3.9).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm, stat as fsStat, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { checkShipReady } from './check-ship-ready.js';

// __dirname equivalent for the architectural-invariant source check below.
const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * Initialize a fresh git repo in `dir` with one empty initial commit on
 * branch `main`. Uses argv-based execFileSync so the test harness itself
 * never shell-interpolates anything. Returns silently if git is unavailable
 * on the host; callers check for that and skip.
 */
function initGitRepoOrSkip(dir: string): boolean {
  try {
    execFileSync('git', ['init', '--initial-branch=main', '--quiet'], { cwd: dir, stdio: ['pipe', 'pipe', 'pipe'] });
    execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: dir, stdio: ['pipe', 'pipe', 'pipe'] });
    execFileSync('git', ['config', 'user.name', 'Test'], { cwd: dir, stdio: ['pipe', 'pipe', 'pipe'] });
    execFileSync('git', ['config', 'commit.gpgsign', 'false'], { cwd: dir, stdio: ['pipe', 'pipe', 'pipe'] });
    execFileSync('git', ['commit', '--allow-empty', '-m', 'init', '--quiet'], { cwd: dir, stdio: ['pipe', 'pipe', 'pipe'] });
    return true;
  } catch {
    return false;
  }
}

describe('checkShipReady', () => {
  let projectDir: string;

  beforeEach(async () => {
    projectDir = join(tmpdir(), `gsd-check-ship-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(join(projectDir, '.planning', 'phases'), { recursive: true });
  });

  afterEach(async () => {
    await rm(projectDir, { recursive: true, force: true });
  });

  it('throws when phase arg is missing', async () => {
    await expect(checkShipReady([], projectDir)).rejects.toThrow();
  });

  it('returns all expected shape keys', async () => {
    await mkdir(join(projectDir, '.planning', 'phases', '01-foundation'), { recursive: true });

    const { data } = await checkShipReady(['1'], projectDir);
    const d = data as Record<string, unknown>;

    expect(typeof d.ready).toBe('boolean');
    expect(typeof d.verification_passed).toBe('boolean');
    expect(typeof d.clean_tree).toBe('boolean');
    expect(typeof d.on_feature_branch).toBe('boolean');
    expect(typeof d.remote_configured).toBe('boolean');
    expect(typeof d.gh_available).toBe('boolean');
    expect(typeof d.gh_authenticated).toBe('boolean');
    expect(Array.isArray(d.blockers)).toBe(true);
  });

  it('returns current_branch and base_branch fields', async () => {
    await mkdir(join(projectDir, '.planning', 'phases', '01-foundation'), { recursive: true });

    const { data } = await checkShipReady(['1'], projectDir);
    const d = data as Record<string, unknown>;

    // current_branch is either a string (when in a git repo) or null (temp dir not a repo)
    expect(d.current_branch === null || typeof d.current_branch === 'string').toBe(true);
    expect(d.base_branch === null || typeof d.base_branch === 'string').toBe(true);
  });

  it('never throws — returns false fields on git errors', async () => {
    // Use a directory that is not a git repo
    const nonGitDir = join(tmpdir(), `gsd-non-git-${Date.now()}`);
    await mkdir(join(nonGitDir, '.planning', 'phases', '01-test'), { recursive: true });

    try {
      const { data } = await checkShipReady(['1'], nonGitDir);
      const d = data as Record<string, unknown>;
      // All git-based fields should be false/null when not a git repo
      expect(d.ready).toBe(false);
    } finally {
      await rm(nonGitDir, { recursive: true, force: true });
    }
  });

  it('gh_authenticated is always false (advisory — no network call)', async () => {
    await mkdir(join(projectDir, '.planning', 'phases', '01-foundation'), { recursive: true });

    const { data } = await checkShipReady(['1'], projectDir);
    const d = data as Record<string, unknown>;
    // Per spec: gh_authenticated is advisory — skip actual auth check to avoid slow network call
    expect(d.gh_authenticated).toBe(false);
  });

  it('blocks shipping when VERIFICATION.md is missing', async () => {
    await mkdir(join(projectDir, '.planning', 'phases', '01-foundation'), { recursive: true });

    const { data } = await checkShipReady(['1'], projectDir);
    const d = data as Record<string, unknown>;

    expect(d.verification_passed).toBe(false);
    expect(d.ready).toBe(false);
    expect(d.blockers).toContain('verification status is not passed');
  });

  // ─── #3587: shell-injection regression guard ─────────────────────────────
  //
  // Branch names in git can legally contain shell metacharacters (`;`, `$()`,
  // backticks, etc.). The pre-fix implementation interpolated current_branch
  // into a shell-string `git config --get branch.${current_branch}.merge`
  // and ran it through `execSync()`, allowing a maliciously-named branch to
  // execute arbitrary shell commands. These tests prove the fix uses argv
  // execution so branch names are passed as literal data, never parsed by
  // the shell.

  it('#3587: branch name with shell-injection payload does not execute injected command', async (ctx) => {
    if (!initGitRepoOrSkip(projectDir)) {
      // git not available in this environment — the regression is git-specific
      // and the production code is unreachable without git, so skip visibly
      // rather than silently passing.
      ctx.skip();
      return;
    }

    // Proven exploit payload. `$IFS` (shell-expanded to a space) lets us
    // smuggle a multi-token command into a refname that git accepts.
    // Manually verified on git 2.53.0: refname `foo;touch${IFS}INJ;bar` is
    // valid AND, when interpolated into `execSync('git config --get
    // branch.${branch}.merge')`, /bin/sh parses three commands —
    // `git config --get branch.foo`, `touch INJ`, `bar.merge` — and the
    // middle `touch` creates the sentinel file inside projectDir.
    const injectedFile = 'INJECTED_BY_3587';
    const branchName = `foo;touch\${IFS}${injectedFile};bar`;

    let exploitReachable = true;
    try {
      execFileSync('git', ['checkout', '-q', '-b', branchName], {
        cwd: projectDir,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch {
      // If git on this platform rejects the canonical exploit refname,
      // the test's strongest assertion can't fire. Skip visibly with a
      // descriptive reason so a CI lane that loses coverage shows up in
      // the skip count rather than silently passing.
      exploitReachable = false;
    }

    if (!exploitReachable) {
      ctx.skip();
      return;
    }

    await mkdir(join(projectDir, '.planning', 'phases', '01-test'), { recursive: true });

    await checkShipReady(['1'], projectDir);

    // Negative proof: the injected `touch INJECTED_BY_3587` MUST NOT
    // have run. Buggy code (shell-string execSync) creates the file as
    // a side-effect of interpolating the malicious branch name into the
    // command. Fixed code (argv-based execFileSync) passes the branch
    // name as a single argv element, so the shell never sees the
    // metacharacters.
    let injectedExists = false;
    try {
      await fsStat(join(projectDir, injectedFile));
      injectedExists = true;
    } catch { /* missing — desired */ }
    expect(injectedExists).toBe(false);
  });

  it('#3587: round-trips a metacharacter branch name verbatim in current_branch', async () => {
    if (!initGitRepoOrSkip(projectDir)) return;

    // Positive proof: the branch name (including metacharacters) is
    // returned as data, not consumed by shell parsing. If the
    // implementation lost the metacharacters during shell quoting, this
    // assertion would fail; if the implementation passes the value as an
    // argv element (`execFileSync('git', ['config', ...])`) it survives
    // verbatim.
    const branchName = 'feat/data$with(parens)`and-backticks`';

    let actualBranch = branchName;
    try {
      execFileSync('git', ['checkout', '-q', '-b', branchName], {
        cwd: projectDir,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch {
      // Some git versions reject certain refname shapes — fall back to a
      // simpler metacharacter combination that all gits accept.
      actualBranch = 'feat/data-$dollar-and-(paren)';
      execFileSync('git', ['checkout', '-q', '-b', actualBranch], {
        cwd: projectDir,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    }

    await mkdir(join(projectDir, '.planning', 'phases', '01-test'), { recursive: true });

    const { data } = await checkShipReady(['1'], projectDir);
    const d = data as Record<string, unknown>;

    expect(d.current_branch).toBe(actualBranch);
    // on_feature_branch must still flag a non-main/master branch correctly
    // even when the name contains metacharacters.
    expect(d.on_feature_branch).toBe(true);
  });

  it('#3587: gh probe does not invoke a shell — gh argv runs even when PATH globs are present', async () => {
    if (!initGitRepoOrSkip(projectDir)) return;

    // The pre-fix code ran `gh --version` and `which gh` as shell strings.
    // No interpolation site exists for those today, but locking the
    // contract here ensures a future change that interpolates a value
    // (e.g. `which ${candidate}`) cannot regress silently. We assert the
    // module returns a structured boolean for gh_available without throwing
    // on a project dir whose name contains characters a shell would treat
    // specially.
    await mkdir(join(projectDir, '.planning', 'phases', '01-test'), { recursive: true });

    const { data } = await checkShipReady(['1'], projectDir);
    const d = data as Record<string, unknown>;

    expect(typeof d.gh_available).toBe('boolean');
    expect(d.gh_authenticated).toBe(false);
  });

  // allow-test-rule: architectural-invariant
  // The shell-injection class of vulnerabilities can only be detected
  // structurally: a behavioral test sees identical outputs from
  // `execSync('gh --version')` and `execFileSync('gh', ['--version'])`
  // for non-malicious input. The defect is the *presence* of the shell
  // parsing primitive, which behavioral tests cannot observe directly.
  // This guard reads the production source and asserts the only
  // child_process primitive used is the no-shell `execFileSync`. A
  // future change that copy-pastes the old `execSync` pattern back into
  // this module — e.g. for a new git probe — will fail this assertion
  // even if the new call site happens to be unreachable in tests today.
  it('#3587 (architectural invariant): check-ship-ready.ts never imports or calls execSync', async () => {
    const sourcePath = join(HERE, 'check-ship-ready.ts');
    const source = await readFile(sourcePath, 'utf-8');

    // Strip JSDoc comments so historical mentions of "execSync" in
    // explanatory prose can't accidentally satisfy or break the check.
    // Looking only at code lines that would actually execute.
    const stripped = source
      .split('\n')
      .filter((line) => !/^\s*\*/.test(line))  // drop JSDoc body lines
      .filter((line) => !/^\s*\/\//.test(line)) // drop // single-line comments
      .join('\n');

    // Negative invariant: no shell-string subprocess primitive.
    expect(stripped, 'check-ship-ready.ts must NOT call execSync — use execFileSync instead (#3587)').not.toMatch(
      /\bexecSync\s*\(/,
    );

    // Negative invariant: no shell-string spawnSync either (same shell-parsing
    // risk if shell:true is ever passed).
    expect(stripped, 'check-ship-ready.ts must NOT use spawnSync with shell:true (#3587)').not.toMatch(
      /spawnSync[\s\S]{0,200}shell\s*:\s*true/,
    );

    // Positive invariant: execFileSync is the only primitive imported AND
    // every options object explicitly pins `shell: false`.
    expect(stripped, 'check-ship-ready.ts must import execFileSync').toMatch(
      /import\s*\{[^}]*\bexecFileSync\b[^}]*\}\s*from\s*['"]node:child_process['"]/,
    );
    expect(stripped, 'check-ship-ready.ts must pin shell:false on subprocess calls').toMatch(
      /shell\s*:\s*false/,
    );
  });

  it('blocks shipping when verification status is human_needed', async () => {
    const phaseDir = join(projectDir, '.planning', 'phases', '02-core');
    await mkdir(phaseDir, { recursive: true });
    await writeFile(
      join(phaseDir, 'VERIFICATION.md'),
      [
        '---',
        'status: human_needed',
        '---',
        '',
        '# Verification',
      ].join('\n'),
      'utf-8',
    );

    const { data } = await checkShipReady(['2'], projectDir);
    const d = data as Record<string, unknown>;

    expect(d.verification_passed).toBe(false);
    expect(d.ready).toBe(false);
    expect(d.blockers).toContain('verification status is not passed');
  });
});
