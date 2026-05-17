// allow-test-rule: source-text-is-the-product
// Bug #3542 — Worktree stash storage is shared across agent worktrees;
// `git stash pop` from an executor agent contaminates its isolation.
//
// Git stores stashes at `refs/stash` (plus the stash reflog) inside the
// PARENT `.git/` directory. Every linked worktree shares that ref, so a
// `git stash push` in any worktree (or in the main checkout) is visible —
// and poppable — from every other worktree. From inside a worktree,
// `git stash list` shows the shared list with no indication that an entry
// originated elsewhere.
//
// Incident: an executor agent ran `git stash` (printed "No local changes
// to save" — nothing pushed), then `git stash pop`, which yanked a stash
// from a prior worktree-agent session. Result: 21 files in UU/UD state,
// 16 phantom untracked files, ~12 minutes of recovery work. This breaks
// the `isolation="worktree"` invariant documented in the executor agent.
//
// Two test cases:
//
//   A. The agent prompt content asserts the `git stash` family is
//      prohibited and documents an alternative. The prompt content IS
//      the runtime contract for the agent — source-text-is-the-product
//      (per CONTEXT.md `RULESET.TESTS.no-source-grep.exemption`).
//
//   B. A behavioural test that pins the git invariant the prohibition
//      defends against: a stash pushed in the main checkout is visible in
//      a linked worktree's `git stash list`, proving stash storage is
//      shared and cannot be relied on for worktree-scoped isolation.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execSync } = require('node:child_process');

const EXECUTOR_PATH = path.join(__dirname, '..', 'agents', 'gsd-executor.md');

// ─── Test A — prompt content asserts the prohibition ───────────────────────

test('bug-3542: gsd-executor.md prohibits `git stash` family inside worktrees', () => {
  const content = fs.readFileSync(EXECUTOR_PATH, 'utf-8');

  // The prohibition must call out `git stash` explicitly. Just listing
  // "stash" isn't enough — the existing post-wave-hook helper script
  // legitimately mentions stash, so we look for the specific forbidden
  // commands the agent must never run on its own.
  assert.match(
    content,
    /`git stash`/,
    'gsd-executor.md must explicitly forbid `git stash` (bare push) — see #3542',
  );
  assert.match(
    content,
    /`git stash pop`/,
    'gsd-executor.md must explicitly forbid `git stash pop` — the load-bearing footgun (#3542)',
  );
  assert.match(
    content,
    /`git stash apply`/,
    'gsd-executor.md must explicitly forbid `git stash apply` — same shared-stack hazard as pop (#3542)',
  );
  assert.match(
    content,
    /`git stash drop`/,
    'gsd-executor.md must explicitly forbid `git stash drop` — mutates the shared stack (#3542)',
  );

  // The prohibition must explain WHY (shared storage across worktrees) so
  // the agent understands the failure mode rather than treating it as an
  // arbitrary rule.
  assert.match(
    content,
    /shared|share[d]?\s+(across|between)/i,
    'gsd-executor.md must document that stash storage is shared across worktrees (#3542)',
  );

  // The prohibition must document at least one alternative the agent CAN
  // use to inspect or move work between refs without touching `refs/stash`.
  // The triage brief proposes commit-to-throwaway-branch OR read-only
  // `git show <ref>:<path>` / `git diff <ref> -- <path>`.
  const hasThrowawayBranch = /throwaway[- ]branch|temp(?:orary)?[- ]?branch|scratch[- ]branch/i.test(
    content,
  );
  const hasGitShow = /`git show /i.test(content);
  const hasGitDiffRef = /`git diff [^`]*\$?\{?ref\}?|`git diff [A-Z]+:/i.test(content);
  assert.ok(
    hasThrowawayBranch || hasGitShow || hasGitDiffRef,
    'gsd-executor.md must document an alternative to `git stash` ' +
      '(commit-to-throwaway-branch, or read-only `git show <ref>:<path>` / ' +
      '`git diff <ref> -- <path>`) so the agent has a sanctioned escape path (#3542)',
  );

  // The issue number must appear so future readers can trace the rule to
  // its incident.
  assert.match(
    content,
    /#3542/,
    'gsd-executor.md must reference issue #3542 next to the stash prohibition for traceability',
  );
});

// ─── Test B — behavioural pin of the git invariant ─────────────────────────

test('bug-3542: stash pushed in main checkout is visible inside a linked worktree', () => {
  const tmpRoot = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bug-3542-stash-')));
  const mainRepo = path.join(tmpRoot, 'main');
  const linkedWorktree = path.join(tmpRoot, 'wt');

  try {
    // Set up a normal repo with one commit.
    fs.mkdirSync(mainRepo);
    const gitOpts = { cwd: mainRepo, stdio: 'pipe' };
    execSync('git init -q', gitOpts);
    execSync('git config user.email "test@test.com"', gitOpts);
    execSync('git config user.name "Test"', gitOpts);
    execSync('git config commit.gpgsign false', gitOpts);
    fs.writeFileSync(path.join(mainRepo, 'a.txt'), 'initial\n');
    execSync('git add a.txt', gitOpts);
    execSync('git commit -q -m initial', gitOpts);

    // Create a linked worktree on a separate branch — this is what the
    // executor agent runs inside.
    execSync(`git worktree add -q "${linkedWorktree}" -b wt-branch`, gitOpts);

    // Push a stash from the MAIN checkout (simulating a prior session).
    fs.writeFileSync(path.join(mainRepo, 'a.txt'), 'wip in main\n');
    execSync('git stash push -q -u -m "from-main-checkout"', gitOpts);

    // Sanity check: the stash exists in the main checkout's view.
    const mainList = execSync('git stash list', { cwd: mainRepo }).toString();
    assert.match(
      mainList,
      /from-main-checkout/,
      'pre-condition: main checkout must see its own stash entry',
    );

    // The load-bearing assertion: the linked worktree sees the same
    // stash entry, even though it was pushed from a different working
    // tree. This is the invariant that makes `git stash pop` inside an
    // executor agent's worktree an isolation violation.
    const worktreeList = execSync('git stash list', {
      cwd: linkedWorktree,
    }).toString();
    assert.match(
      worktreeList,
      /from-main-checkout/,
      'bug #3542 invariant: stash entries pushed from any worktree (or the ' +
        'main checkout) are visible in every linked worktree, because ' +
        '`refs/stash` lives in the shared parent .git directory. If this ' +
        'assertion ever stops holding (e.g. git introduces per-worktree ' +
        'stash storage in a future release), the executor agent prohibition ' +
        'in agents/gsd-executor.md can be relaxed.',
    );

    // Stronger pin: a `git stash pop` inside the worktree must actually
    // pop the stash pushed from main — proving cross-worktree mutation,
    // not just visibility. We pop into a clean working tree on a
    // different branch, so any applied content is the contamination.
    execSync('git stash pop -q', { cwd: linkedWorktree, stdio: 'pipe' });
    // On Windows autocrlf=true, git rewrites stashed content with CRLF on
    // checkout. Strip \r before content compare — the test pins git's
    // shared-stash behavior, not line endings.
    const popped = fs.readFileSync(path.join(linkedWorktree, 'a.txt'), 'utf-8').replace(/\r\n/g, '\n');
    assert.strictEqual(
      popped,
      'wip in main\n',
      'bug #3542 invariant: `git stash pop` inside a linked worktree applies ' +
        'a stash pushed in the main checkout — proving the shared-stack ' +
        'contamination the executor prohibition exists to prevent.',
    );
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});
