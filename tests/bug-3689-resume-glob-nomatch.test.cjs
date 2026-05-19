// allow-test-rule: source-text-is-the-product
// Workflow `.md` files are the runtime contract executed by Claude Code as
// embedded bash. Asserting on the staged text of resume-project.md and on the
// behavior of the embedded snippet under real shells is a behavioral test of
// the workflow itself, not source-grep theater.

/**
 * Regression for #3689 — /gsd-resume-work silently drops
 * `.planning/.continue-here*.md` checkpoints under zsh's default NOMATCH.
 *
 * Root cause: the `check_incomplete_work` step in
 * `get-shit-done/workflows/resume-project.md` used a chained `ls` with six
 * bare-glob arguments. Under zsh's default `NOMATCH` setopt the first
 * non-matching glob aborts the entire command during word-expansion — every
 * pattern after that point is never evaluated, including the one that holds
 * valid pause checkpoints (`.planning/.continue-here*.md`). `2>/dev/null ||
 * true` only suppresses ls's own stderr / exit code; it has no effect on the
 * shell's pre-exec abort.
 *
 * Fix: replace the chained `ls` with two `find` calls. `find` does not use
 * shell glob expansion, and `find <missing-dir> -maxdepth N -name PATTERN
 * -print 2>/dev/null` tolerates absent directories on both bash and zsh.
 *
 * This test covers:
 *   1. zsh under `-o nomatch`: checkpoint at `.planning/.continue-here-*.md`
 *      is listed even when `.planning/spikes`, `.planning/sketches`,
 *      `.planning/deliberations` are absent (the common new-project layout).
 *   2. bash default: same behavior.
 *   3. zsh `-o nomatch` with no `.continue-here` files anywhere: exits 0,
 *      no output, no error.
 *   4. Text invariant: resume-project.md no longer carries the brittle
 *      chained-ls pattern.
 */

'use strict';

const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { createTempDir, cleanup } = require('./helpers.cjs');

const REPO_ROOT = path.resolve(__dirname, '..');
const WORKFLOW_PATH = path.join(REPO_ROOT, 'get-shit-done', 'workflows', 'resume-project.md');

// The exact snippet the workflow now embeds. Keep in sync with
// resume-project.md `check_incomplete_work` step.
const FIND_SNIPPET = [
  "find .planning -maxdepth 3 -name '.continue-here*.md' -print 2>/dev/null || true",
  "find . -maxdepth 1 -name '.continue-here*.md' -print 2>/dev/null || true",
].join('\n');

function hasShell(name) {
  const result = spawnSync('which', [name], { encoding: 'utf8' });
  return result.status === 0 && result.stdout.trim().length > 0;
}

describe('bug #3689 — resume-project.md continue-here scan under zsh NOMATCH', () => {
  let tmpDir;

  before(() => {
    tmpDir = createTempDir('gsd-bug-3689-');
    // Reproduce the common new-project layout: a `.planning/` with a
    // suffixed continue-here file and *no* spike / sketch / deliberation
    // subdirectories.
    fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, '.planning', '.continue-here-AT-1234.md'),
      '---\ncontext: default\n---\nhandoff body\n',
      'utf8',
    );
  });

  after(() => {
    cleanup(tmpDir);
  });

  test('zsh -o nomatch lists the .planning/.continue-here-* checkpoint', { skip: !hasShell('zsh') }, () => {
    const result = spawnSync('zsh', ['-o', 'nomatch', '-c', FIND_SNIPPET], {
      cwd: tmpDir,
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, `zsh exited ${result.status}; stderr=${result.stderr}`);
    assert.match(
      result.stdout,
      /\.planning\/\.continue-here-AT-1234\.md/,
      `expected checkpoint in stdout, got: ${JSON.stringify(result.stdout)}`,
    );
  });

  test('bash default lists the .planning/.continue-here-* checkpoint', { skip: !hasShell('bash') }, () => {
    const result = spawnSync('bash', ['-c', FIND_SNIPPET], {
      cwd: tmpDir,
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, `bash exited ${result.status}; stderr=${result.stderr}`);
    assert.match(
      result.stdout,
      /\.planning\/\.continue-here-AT-1234\.md/,
      `expected checkpoint in stdout, got: ${JSON.stringify(result.stdout)}`,
    );
  });
});

describe('bug #3689 — empty workspace exits cleanly', () => {
  let tmpDir;

  before(() => {
    tmpDir = createTempDir('gsd-bug-3689-');
    // No .planning/ at all, no .continue-here files. Pure greenfield.
  });

  after(() => {
    cleanup(tmpDir);
  });

  test('zsh -o nomatch with no checkpoints exits 0, empty output', { skip: !hasShell('zsh') }, () => {
    const result = spawnSync('zsh', ['-o', 'nomatch', '-c', FIND_SNIPPET], {
      cwd: tmpDir,
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, `zsh exited ${result.status}; stderr=${result.stderr}`);
    assert.equal(result.stdout.trim(), '', `expected no stdout, got: ${JSON.stringify(result.stdout)}`);
  });
});

describe('bug #3689 — workflow text invariant', () => {
  test('resume-project.md no longer chains bare globs through ls', () => {
    const body = fs.readFileSync(WORKFLOW_PATH, 'utf8');
    assert.doesNotMatch(
      body,
      /ls\s+\.planning\/spikes\/\*\/\.continue-here/,
      'resume-project.md still contains the chained `ls .planning/spikes/*/.continue-here*.md` pattern that aborts under zsh NOMATCH; the find-based scan should replace it.',
    );
    assert.match(
      body,
      /find \.planning -maxdepth 3 -name '\.continue-here\*\.md'/,
      'resume-project.md must use the find-based scan introduced by the #3689 fix.',
    );
  });
});
