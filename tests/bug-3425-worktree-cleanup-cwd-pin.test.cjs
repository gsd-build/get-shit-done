// allow-test-rule: source-text-is-the-product
// execute-phase.md is the shipped orchestration contract; this regression test
// locks the cleanup guards that prevent merge-loop CWD drift from targeting
// the wrong worktree/branch.

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const EXECUTE_PHASE_PATH = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'execute-phase.md');

function readWorkflow() {
  return fs.readFileSync(EXECUTE_PHASE_PATH, 'utf8');
}

test('#3425: helper cleanup path pins orchestrator CWD to primary worktree and checks EXPECTED_BRANCH', () => {
  const content = readWorkflow();

  assert.match(content, /PRIMARY_WT=\$\(git worktree list --porcelain \| awk '\/\^worktree \/\{print substr\(\$0,10\); exit\}'\)/);
  assert.match(content, /if \[ -z "\$PRIMARY_WT" \]; then\s+echo "FATAL: could not resolve primary worktree before cleanup" >&2\s+exit 1\s+fi/);
  assert.match(content, /cd "\$PRIMARY_WT" \|\| \{ echo "FATAL: cannot cd to primary worktree \$PRIMARY_WT" >&2; exit 1; \}/);
  assert.match(content, /ORCH_BRANCH=\$\(git rev-parse --abbrev-ref HEAD\)/);
  assert.match(content, /FATAL: orchestrator on '\$ORCH_BRANCH' but expected '\$EXPECTED_BRANCH' before worktree cleanup — refusing to merge \(#3174-class drift\)/);
  assert.match(content, /gsd-sdk query worktree\.cleanup-wave --manifest "\$WAVE_WORKTREE_MANIFEST" \|\| exit 1/);
});

test('#3425: cleanup-tail snippet carries the same primary-worktree pin before removal', () => {
  const content = readWorkflow();

  assert.match(content, /Cleanup-tail: pin orchestrator CWD to primary worktree before cleanup-tail \(#3174\)\./);
  assert.match(content, /FATAL: cannot cd to primary worktree \$PRIMARY_WT/);
  assert.match(content, /# Cleanup-tail: remove residual agent worktrees after a cross-wave-dependency deviation\./);
});
