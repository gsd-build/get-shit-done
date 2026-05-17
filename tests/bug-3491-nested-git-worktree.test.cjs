// allow-test-rule: source-text-is-the-product
// Bug #3491 — new-project workflow creates nested .git in subdirectory when
// parent already has git repo.
//
// The workflow's `has_git` boolean was derived from `pathExists(cwd, '.git')`
// — a shallow check that only sees a `.git` entry directly in the current
// directory. Subdirectories of an existing git worktree therefore reported
// `has_git: false`, causing the workflow's `git init` step to create a nested
// `.git` inside the outer repo's worktree. Subsequent gsd-sdk commits then
// targeted the nested repo instead of the outer one, silently dropping all
// planning artefacts from the outer repo's history.
//
// This test asserts the corrected semantics, mirroring `git rev-parse
// --is-inside-work-tree`:
//
//   - `has_git: true` is reported whenever the cwd is inside a git worktree,
//     even when no `.git` entry is in cwd itself.
//   - The init payload surfaces `git_worktree_root` and `in_nested_subdir` so
//     the workflow can warn the user and skip `git init`.
//   - The workflow markdown's `git init` step is gated on
//     `in_nested_subdir: false`, never unconditional under `has_git: false`.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execSync } = require('node:child_process');

const { runGsdTools, cleanup } = require('./helpers.cjs');

const WORKFLOW_PATH = path.join(
  __dirname,
  '..',
  'get-shit-done',
  'workflows',
  'new-project.md',
);

// ─── Helper: create outer git repo with a nested workstream subdir ─────────

// On Windows the runtime emits forward slashes (git's convention) while
// path.join produces backslashes — normalize both sides via the shared
// toPosixPath helper before any equality comparison.
const { toPosixPath: normalizePath } = require('./helpers.cjs');

function createOuterRepoWithSubdir(prefix = 'bug-3491-') {
  const outer = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  // macOS /tmp -> /private/tmp; on Windows the runner's %TEMP% is the 8.3
  // short-name (RUNNER~1) and the runtime resolves to the long form.
  // realpathSync.native handles both; then normalize separators for compare.
  const outerReal = fs.realpathSync.native(outer);
  execSync('git init', { cwd: outerReal, stdio: 'pipe' });
  execSync('git config user.email "test@test.com"', { cwd: outerReal, stdio: 'pipe' });
  execSync('git config user.name "Test"', { cwd: outerReal, stdio: 'pipe' });
  execSync('git config commit.gpgsign false', { cwd: outerReal, stdio: 'pipe' });
  fs.writeFileSync(path.join(outerReal, 'README.md'), '# outer\n');
  execSync('git add -A', { cwd: outerReal, stdio: 'pipe' });
  execSync('git commit -m "initial"', { cwd: outerReal, stdio: 'pipe' });

  const subdir = path.join(outerReal, 'workstreams', 'my-project');
  fs.mkdirSync(subdir, { recursive: true });
  return { outer: outerReal, subdir };
}

// ─── Behavioural tests against the live `init new-project` handler ─────────

test('bug-3491: init new-project reports has_git: true inside parent git worktree', () => {
  const { outer, subdir } = createOuterRepoWithSubdir();
  try {
    const result = runGsdTools('init new-project', subdir);
    assert.ok(result.success, `init new-project failed: ${result.error}`);

    const payload = JSON.parse(result.output);

    // Core fix: shallow `.git in cwd` check was wrong — we are inside the
    // outer worktree, so the workflow MUST see has_git: true.
    assert.strictEqual(
      payload.has_git,
      true,
      'expected has_git=true when cwd is inside an existing git worktree (parent .git)',
    );

    // The workflow needs the worktree root and a nesting flag to decide
    // whether to skip `git init` and emit a friendly warning.
    assert.strictEqual(
      normalizePath(payload.git_worktree_root),
      normalizePath(outer),
      `expected git_worktree_root to be the outer repo (${outer}), got: ${payload.git_worktree_root}`,
    );
    assert.strictEqual(
      payload.in_nested_subdir,
      true,
      'expected in_nested_subdir=true when cwd is a subdirectory of the worktree root',
    );
  } finally {
    cleanup(outer);
  }
});

test('bug-3491: init new-project reports has_git: true at worktree root with in_nested_subdir: false', () => {
  const { outer } = createOuterRepoWithSubdir();
  try {
    const result = runGsdTools('init new-project', outer);
    assert.ok(result.success, `init new-project failed: ${result.error}`);

    const payload = JSON.parse(result.output);
    assert.strictEqual(payload.has_git, true, 'has_git must be true at the worktree root');
    assert.strictEqual(normalizePath(payload.git_worktree_root), normalizePath(outer));
    assert.strictEqual(
      payload.in_nested_subdir,
      false,
      'at the worktree root, in_nested_subdir must be false',
    );
  } finally {
    cleanup(outer);
  }
});

test('bug-3491: init new-project reports has_git: false outside any git worktree', () => {
  const tmp = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'bug-3491-bare-')));
  try {
    const result = runGsdTools('init new-project', tmp);
    assert.ok(result.success, `init new-project failed: ${result.error}`);
    const payload = JSON.parse(result.output);
    assert.strictEqual(payload.has_git, false);
    assert.strictEqual(payload.in_nested_subdir, false);
    assert.strictEqual(payload.git_worktree_root, null);
  } finally {
    cleanup(tmp);
  }
});

test('bug-3491: init ingest-docs mirrors the same has_git semantics', () => {
  // ingest-docs.md has the same shallow check and the same nested-init risk.
  const { outer, subdir } = createOuterRepoWithSubdir('bug-3491-ingest-');
  try {
    const result = runGsdTools('init ingest-docs', subdir);
    assert.ok(result.success, `init ingest-docs failed: ${result.error}`);
    const payload = JSON.parse(result.output);
    assert.strictEqual(
      payload.has_git,
      true,
      'init ingest-docs must also detect parent worktree (#3491 related path)',
    );
    assert.strictEqual(normalizePath(payload.git_worktree_root), normalizePath(outer));
    assert.strictEqual(payload.in_nested_subdir, true);
  } finally {
    cleanup(outer);
  }
});

// ─── Workflow-text test: the deployed `new-project.md` must gate `git init` ─

test('bug-3491: new-project.md gates `git init` on in_nested_subdir, not just has_git', () => {
  const content = fs.readFileSync(WORKFLOW_PATH, 'utf-8');

  // The pre-fix workflow had the literal sequence:
  //
  //   **If `has_git` is false:** Initialize git:
  //   ```bash
  //   git init
  //   ```
  //
  // …which fires for any subdirectory of an existing repo. The fix must
  // either gate the init on `in_nested_subdir`/worktree-root semantics or
  // drop the unconditional `git init` block entirely.
  const unconditionalInitPattern =
    /\*\*If `has_git` is false:\*\* Initialize git:\s*\n+```bash\s*\ngit init\s*\n```/;
  assert.ok(
    !unconditionalInitPattern.test(content),
    'new-project.md must not run `git init` unconditionally on has_git=false (#3491). ' +
      'Gate it on `in_nested_subdir === false` so the workflow refuses to create ' +
      'a nested .git inside an existing worktree.',
  );

  // The fixed workflow MUST mention the new field so reviewers can see the
  // gating exists. (Workflow markdown IS the deployed product — testing it
  // as text is the only end-to-end signal we have.)
  assert.ok(
    /in_nested_subdir/.test(content),
    'new-project.md must reference `in_nested_subdir` after the #3491 fix',
  );
});
