// allow-test-rule: source-text-is-the-product
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');

function read(relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), 'utf8');
}

describe('bug #3384: adjacent worktree data-loss guards', () => {
  test('worktree cleanup CLI preserves caller cwd instead of resolving project root', () => {
    const source = read('get-shit-done/bin/gsd-tools.cjs');
    const skipSet = source.slice(
      source.indexOf('const SKIP_ROOT_RESOLUTION = new Set(['),
      source.indexOf('if (!SKIP_ROOT_RESOLUTION.has(command))'),
    );

    assert.match(skipSet, /'worktree'/);
  });

  test('diagnose-issues agents assert disposable worktree branch before reset --hard', () => {
    const source = read('get-shit-done/workflows/diagnose-issues.md');
    const branchCheck = source.indexOf('HEAD_REF=$(git symbolic-ref --quiet HEAD || echo');
    const namespaceCheck = source.indexOf('worktree-agent-* namespace');
    const reset = source.indexOf('git reset --hard {EXPECTED_BASE}');

    assert.ok(branchCheck > 0, 'diagnose prompt must assert HEAD before repair');
    assert.ok(namespaceCheck > branchCheck, 'diagnose prompt must require disposable worktree-agent branch');
    assert.ok(reset > namespaceCheck, 'reset --hard must come only after branch namespace check');
  });

  test('remove-workspace fails closed when git worktree remove fails', () => {
    const source = read('get-shit-done/workflows/remove-workspace.md');
    const init = source.indexOf('REMOVE_FAILED=false');
    const loop = source.indexOf('For each repo in the workspace');
    const remove = source.indexOf('git worktree remove "$WORKSPACE_PATH/$REPO_NAME"');

    assert.doesNotMatch(
      source,
      /git worktree remove "\$WORKSPACE_PATH\/\$REPO_NAME" 2>&1 \|\| true/,
      'worktree removal failures must not be swallowed',
    );
    assert.ok(init > 0 && init < loop, 'REMOVE_FAILED must initialize once before the per-repo loop');
    assert.ok(remove > loop, 'worktree removal should remain inside the per-repo loop');
    assert.match(source, /Refusing to delete "\$WORKSPACE_PATH"/);
  });

  test('validate health warns when worktree inventory cannot be listed', () => {
    const source = read('get-shit-done/bin/lib/verify.cjs');
    const failureBranch = source.indexOf("worktreeHealth.reason === 'git_list_failed'");
    const warning = source.indexOf("addIssue('warning', 'W020'", failureBranch);

    assert.ok(failureBranch > 0, 'verify health should branch on git_list_failed');
    assert.ok(warning > failureBranch, 'git_list_failed should emit W020 degraded-health warning');
  });
});
