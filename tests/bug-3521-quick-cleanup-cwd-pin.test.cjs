// allow-test-rule: source-text-is-the-product
// quick.md is the shipped orchestration contract for /gsd-quick; this
// regression test locks the CWD-safety guard that prevents orchestrator-leaked
// CWD from targeting the wrong worktree/branch in the post-merge cleanup loop.

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const QUICK_MD = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'quick.md');

function readQuickMd() {
  return fs.readFileSync(QUICK_MD, 'utf8');
}

// Locate the shell-fallback cleanup loop in quick.md.
// The loop is the `while IFS= read -r WT; do … done < "$WT_PATHS_FILE"` block
// inside the `else` branch of the gsd-sdk availability check.
function extractCleanupLoop(content) {
  const loopStart = content.indexOf('while IFS= read -r WT; do');
  assert.ok(loopStart !== -1, 'quick.md must contain the cleanup while-loop');
  const loopEnd = content.indexOf('done < "$WT_PATHS_FILE"', loopStart);
  assert.ok(loopEnd !== -1, 'quick.md cleanup while-loop must end with done < "$WT_PATHS_FILE"');
  return content.slice(loopStart, loopEnd + 'done < "$WT_PATHS_FILE"'.length);
}

describe('bug #3521 — quick.md post-merge cleanup CWD safety', () => {

  test('quick.md is readable', () => {
    const content = readQuickMd();
    assert.ok(content.length > 0, 'quick.md must not be empty');
  });

  test('cleanup loop resolves PROJECT_ROOT via git -C before any bare git command (#3521)', () => {
    const content = readQuickMd();
    const loop = extractCleanupLoop(content);

    // The fix must recover the project root from the worktree path using git -C.
    // Acceptable forms:
    //   git -C "$WT" rev-parse --git-common-dir
    //   git -C "$WT" rev-parse --show-toplevel
    const hasRootResolution =
      /git -C "\$WT" rev-parse --git-common-dir/.test(loop) ||
      /git -C "\$WT" rev-parse --show-toplevel/.test(loop);

    assert.ok(
      hasRootResolution,
      [
        'quick.md cleanup loop must resolve PROJECT_ROOT via',
        '`git -C "$WT" rev-parse --git-common-dir` (or --show-toplevel)',
        'before any bare git command (#3521)',
      ].join(' ')
    );
  });

  test('cleanup loop pins CWD to PROJECT_ROOT before bare git commands (#3521)', () => {
    const content = readQuickMd();
    const loop = extractCleanupLoop(content);

    // The fix must cd to the resolved root at the top of the iteration body.
    const hasCdPin =
      /cd "\$PROJECT_ROOT"/.test(loop) ||
      /cd "\${PROJECT_ROOT}"/.test(loop);

    assert.ok(
      hasCdPin,
      [
        'quick.md cleanup loop must pin CWD to PROJECT_ROOT with',
        '`cd "$PROJECT_ROOT"` at the top of each iteration (#3521)',
      ].join(' ')
    );
  });

  test('cleanup loop skips and continues when PROJECT_ROOT cannot be resolved (#3521)', () => {
    const content = readQuickMd();
    const loop = extractCleanupLoop(content);

    // The fix must guard against a resolution failure and emit a clear skip message.
    const hasSkipGuard =
      /if.*PROJECT_ROOT.*then[\s\S]*?continue/.test(loop) ||
      /\|\|.*\{[\s\S]*?continue[\s\S]*?\}/.test(loop) ||
      /PROJECT_ROOT.*2>\/dev\/null.*\n.*if.*-z.*PROJECT_ROOT/.test(loop) ||
      // Broader: must have both a log/echo and a continue inside the loop
      (loop.includes('continue') && /skip|cannot|SKIP|WARN|unresolvable|unresolveable|could not|failed/i.test(loop));

    assert.ok(
      hasSkipGuard,
      [
        'quick.md cleanup loop must log a skip message and `continue`',
        'when PROJECT_ROOT cannot be resolved from the worktree (#3521)',
      ].join(' ')
    );
  });

  test('PROJECT_ROOT resolution appears before the first bare git command in the loop body (#3521)', () => {
    const content = readQuickMd();
    const loop = extractCleanupLoop(content);

    const rootResolutionIdx = loop.indexOf('git -C "$WT" rev-parse');
    // The first bare git command that would be affected by CWD drift is
    // the pre-merge deletion diff or the merge itself.
    const firstBareGitIdx = loop.indexOf('git diff');
    const firstMergeIdx = loop.indexOf('git merge');
    const firstBareIdx = Math.min(
      firstBareGitIdx !== -1 ? firstBareGitIdx : Infinity,
      firstMergeIdx !== -1 ? firstMergeIdx : Infinity,
    );

    assert.ok(
      rootResolutionIdx !== -1,
      'quick.md cleanup loop must contain git -C "$WT" rev-parse for root resolution (#3521)'
    );

    assert.ok(
      firstBareIdx !== Infinity,
      'quick.md cleanup loop must contain bare git diff or git merge commands'
    );

    // The `git -C "$WT" rev-parse --abbrev-ref HEAD` that reads WT_BRANCH is
    // already using -C so it is safe; the root resolution must appear before
    // the first root-relative bare command (git diff / git merge).
    assert.ok(
      rootResolutionIdx < firstBareGitIdx || rootResolutionIdx < firstMergeIdx,
      [
        'PROJECT_ROOT resolution (git -C "$WT" rev-parse) must appear before the first',
        'bare `git diff` or `git merge` in the cleanup loop body (#3521)',
      ].join(' ')
    );
  });

  test('existing pre-merge deletion guard (#1756) is still present after the CWD pin (#3521)', () => {
    const content = readQuickMd();
    const loop = extractCleanupLoop(content);

    // The guard checks for file deletions before merging.
    assert.ok(
      loop.includes('--diff-filter=D'),
      'quick.md cleanup loop must retain the pre-merge deletion guard (--diff-filter=D) from #1756 after the CWD pin is added (#3521)'
    );

    // And it must appear before git merge.
    const deletionCheckIdx = loop.indexOf('--diff-filter=D');
    const mergeIdx = loop.indexOf('git merge');
    assert.ok(
      deletionCheckIdx < mergeIdx,
      '--diff-filter=D deletion guard must appear before git merge in the cleanup loop (#3521/#1756)'
    );
  });

  test('STATE.md and ROADMAP.md backup/restore is still present after the CWD pin (#3521)', () => {
    const content = readQuickMd();
    const loop = extractCleanupLoop(content);

    assert.ok(
      loop.includes('STATE_BACKUP'),
      'quick.md cleanup loop must retain STATE.md backup variable (STATE_BACKUP) after the CWD pin (#3521)'
    );
    assert.ok(
      loop.includes('ROADMAP_BACKUP'),
      'quick.md cleanup loop must retain ROADMAP.md backup variable (ROADMAP_BACKUP) after the CWD pin (#3521)'
    );

    // Backup must precede the merge.
    const backupIdx = loop.indexOf('STATE_BACKUP');
    const mergeIdx = loop.indexOf('git merge');
    assert.ok(
      backupIdx < mergeIdx,
      'STATE.md/ROADMAP.md backup must happen before git merge in the cleanup loop (#3521)'
    );
  });

  test('cd to PROJECT_ROOT appears before STATE.md backup (which uses relative paths) (#3521)', () => {
    const content = readQuickMd();
    const loop = extractCleanupLoop(content);

    // The backup uses a relative path `.planning/STATE.md` so the cd pin must
    // happen before the backup assignment.
    const cdIdx =
      loop.indexOf('cd "$PROJECT_ROOT"') !== -1
        ? loop.indexOf('cd "$PROJECT_ROOT"')
        : loop.indexOf('cd "${PROJECT_ROOT}"');
    const backupIdx = loop.indexOf('STATE_BACKUP=$(mktemp)');

    if (cdIdx === -1) {
      // If cd form is not used, skip this ordering check (alternate fix form).
      return;
    }

    assert.ok(
      cdIdx < backupIdx,
      '`cd "$PROJECT_ROOT"` must appear before `STATE_BACKUP=$(mktemp)` so relative-path backup/restore works correctly (#3521)'
    );
  });

});
