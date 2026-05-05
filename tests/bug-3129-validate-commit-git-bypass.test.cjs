'use strict';
// allow-test-rule: reads hook shell script to verify delegation pattern — structural contract test, not source-grep

// Regression tests for bug #3129.
//
// gsd-validate-commit.sh used `[[ "$CMD" =~ ^git[[:space:]]+commit ]]` to
// detect git commit invocations. This regex silently bypasses Conventional
// Commits enforcement for three real git commit forms:
//   1. git -C /some/path commit -m "..."   (working-directory prefix)
//   2. GIT_AUTHOR_NAME=x git commit "..."  (env-var prefix)
//   3. /usr/bin/git commit -m "..."        (full path)
//
// Fix: the hook delegates detection to hooks/lib/git-cmd.js isGitSubcommand(),
// a token-walk classifier that correctly handles all four forms. The module
// is the canonical single source of truth for all hooks that gate on git commits.

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const ROOT = path.join(__dirname, '..');
const { isGitSubcommand, tokenize } = require(path.join(ROOT, 'hooks', 'lib', 'git-cmd.js'));

// ── tokenize ─────────────────────────────────────────────────────────────────

describe('git-cmd.js tokenize', () => {
  test('splits bare command', () => {
    assert.deepEqual(tokenize('git commit -m "msg"'), ['git', 'commit', '-m', 'msg']);
  });
  test('handles single-quoted args', () => {
    assert.deepEqual(tokenize("git commit -m 'my message'"), ['git', 'commit', '-m', 'my message']);
  });
  test('handles env-prefix assignment', () => {
    assert.deepEqual(
      tokenize('GIT_AUTHOR_NAME=Alice git commit -m "fix"'),
      ['GIT_AUTHOR_NAME=Alice', 'git', 'commit', '-m', 'fix'],
    );
  });
  test('handles -C path', () => {
    assert.deepEqual(
      tokenize('git -C /some/path commit -m "x"'),
      ['git', '-C', '/some/path', 'commit', '-m', 'x'],
    );
  });
});

// ── isGitSubcommand: must-match cases ────────────────────────────────────────

describe('git-cmd.js isGitSubcommand: should match commit', () => {
  const cases = [
    ['bare form',                    'git commit -m "feat: add thing"'],
    ['single-quoted message',        "git commit -m 'fix: typo'"],
    ['with --no-verify',             'git commit --no-verify -m "wip"'],
    ['-C path form (bug #3129)',     'git -C /some/path commit -m "fix: x"'],
    ['env-prefix form (bug #3129)',  'GIT_AUTHOR_NAME=Alice git commit -m "fix"'],
    ['full-path form (bug #3129)',   '/usr/bin/git commit -m "feat: y"'],
    ['multiple env vars',            'GIT_AUTHOR_NAME=A GIT_AUTHOR_EMAIL=b@c git commit -m "x"'],
    ['--git-dir= flag',              'git --git-dir=.git commit -m "x"'],
    ['--git-dir two-token',          'git --git-dir .git commit -m "x"'],
    ['--no-pager before subcommand', 'git --no-pager commit -m "x"'],
    ['-C + full path',               '/usr/bin/git -C /proj commit -m "x"'],
    ['-p paginate flag',             'git -p commit -m "x"'],
  ];
  for (const [desc, cmd] of cases) {
    test(desc, () => {
      assert.ok(isGitSubcommand(cmd, 'commit'), `Expected match for: ${cmd}`);
    });
  }
});

// ── isGitSubcommand: must-not-match cases ────────────────────────────────────

describe('git-cmd.js isGitSubcommand: should NOT match commit', () => {
  const cases = [
    ['git push',              'git push origin main'],
    ['git status',            'git status'],
    ['git add',               'git add .'],
    ['git log',               'git log --oneline'],
    ['not git at all',        'npm install'],
    ['empty string',          ''],
    ['git checkout (not commit)', 'git checkout main'],
    ['git -C path push',      'git -C /path push'],
  ];
  for (const [desc, cmd] of cases) {
    test(desc, () => {
      assert.ok(!isGitSubcommand(cmd, 'commit'), `Expected NO match for: ${cmd}`);
    });
  }
});

// ── gsd-validate-commit.sh source check ──────────────────────────────────────

describe('gsd-validate-commit.sh delegates to git-cmd.js', () => {
  const hookSrc = fs.readFileSync(
    path.join(ROOT, 'hooks', 'gsd-validate-commit.sh'), 'utf8',
  );

  test('hook no longer uses the stale ^git\\s+commit bash regex', () => {
    assert.ok(
      !hookSrc.includes('^git[[:space:]]+commit'),
      'gsd-validate-commit.sh still uses the bypassed regex — fix not applied',
    );
  });

  test('hook delegates to git-cmd.js isGitSubcommand', () => {
    assert.ok(
      hookSrc.includes('git-cmd.js') && hookSrc.includes('isGitSubcommand'),
      'gsd-validate-commit.sh does not reference git-cmd.js or isGitSubcommand',
    );
  });

  test('hooks/lib/git-cmd.js exists at the expected install path', () => {
    assert.ok(
      fs.existsSync(path.join(ROOT, 'hooks', 'lib', 'git-cmd.js')),
      'hooks/lib/git-cmd.js does not exist — library file missing',
    );
  });
});
