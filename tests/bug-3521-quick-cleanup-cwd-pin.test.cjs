// allow-test-rule: source-text-is-the-product
// quick.md is the shipped orchestration contract for /gsd-quick; this
// regression test previously locked the CWD-safety guard in the manual shell
// cleanup loop. After #3797, quick.md delegates cleanup entirely to the SDK's
// worktree.cleanup-wave command, which encapsulates CWD-pinning, STATE.md/
// ROADMAP.md backup/restore, and deletion guards internally.
//
// This test file now verifies the delegation contract: quick.md calls
// worktree.cleanup-wave with || exit 1 (fail-closed), which enforces the
// safety semantics that were previously implemented inline in the shell loop.

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const QUICK_MD = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'quick.md');

function readQuickMd() {
  return fs.readFileSync(QUICK_MD, 'utf8');
}

describe('bug #3521 — quick.md post-merge cleanup CWD safety (via SDK delegation, #3797)', () => {

  test('quick.md is readable', () => {
    const content = readQuickMd();
    assert.ok(content.length > 0, 'quick.md must not be empty');
  });

  test('quick.md cleanup delegates CWD-safe worktree cleanup to SDK (worktree.cleanup-wave)', () => {
    const content = readQuickMd();
    // After #3797: quick.md delegates to $GSD_SDK query worktree.cleanup-wave
    // which handles CWD pinning, STATE.md backup, deletion guards, and branch
    // cleanup internally. The manual shell loop has been removed.
    assert.ok(
      content.includes('worktree.cleanup-wave'),
      'quick.md must delegate cleanup to $GSD_SDK query worktree.cleanup-wave (#3797)',
    );
  });

  test('quick.md cleanup-wave call uses || exit 1 to enforce fail-closed safety (#3521 contract)', () => {
    const content = readQuickMd();
    // The || exit 1 enforces fail-closed: SDK safety refusals (e.g. branch
    // drift detection from #3174) surface immediately rather than being swallowed.
    // This is the equivalent of the pre-#3797 `gsd-sdk query ... || exit 1` in the
    // `if command -v gsd-sdk` branch.
    assert.match(
      content,
      /\$GSD_SDK query worktree\.cleanup-wave.*\|\| exit 1/,
      'quick.md cleanup-wave must use || exit 1 — fail-closed for safety refusals (#3521/#3797)',
    );
  });

  test('quick.md manifest guard still blocks broad cleanup when manifest is missing (#3384)', () => {
    const content = readQuickMd();
    // The manifest guard must still be present before the cleanup-wave call
    // to prevent broad worktree cleanup when the manifest file is absent.
    assert.ok(
      content.includes('QUICK_WORKTREE_MANIFEST') || content.includes('WAVE_WORKTREE_MANIFEST'),
      'quick.md must still guard cleanup behind QUICK_WORKTREE_MANIFEST (#3384)',
    );
    assert.ok(
      content.includes('refusing broad worktree cleanup') || content.includes('missing QUICK_WORKTREE_MANIFEST'),
      'quick.md must emit a blocked message when the manifest is missing (#3384)',
    );
  });

});
