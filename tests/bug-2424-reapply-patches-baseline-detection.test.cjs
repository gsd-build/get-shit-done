/**
 * Bug #2424: reapply-patches pristine-baseline detection uses first-add commit
 *
 * The three-way merge baseline detection previously used `git log --diff-filter=A`
 * which returns the commit that FIRST added the file. On repos that have been
 * through multiple GSD update cycles, this returns a stale, many-versions-old
 * baseline — not the version immediately prior to the current update.
 *
 * Fix: Option A must prefer `pristine_hashes` from backup-meta.json to locate
 * the correct baseline commit by SHA-256 matching, with a fallback to the
 * first-add heuristic only when no pristine hash is recorded.
 */

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const REAPPLY_MD = path.join(__dirname, '..', 'commands', 'gsd', 'reapply-patches.md');

describe('reapply-patches pristine baseline detection (#2424)', () => {
  let content;

  test('reapply-patches.md exists', () => {
    assert.ok(fs.existsSync(REAPPLY_MD), 'commands/gsd/reapply-patches.md must exist');
    content = fs.readFileSync(REAPPLY_MD, 'utf-8');
  });

  test('Option A references pristine_hashes from backup-meta.json', () => {
    const optionAStart = content.indexOf('### Option A');
    const optionBStart = content.indexOf('### Option B');
    assert.ok(optionAStart !== -1, 'Option A section must exist');
    assert.ok(optionBStart !== -1, 'Option B section must exist');
    const optionABlock = content.slice(optionAStart, optionBStart);
    assert.ok(
      optionABlock.includes('pristine_hashes'),
      'Option A must use pristine_hashes from backup-meta.json as the primary baseline source'
    );
    assert.ok(
      optionABlock.includes('backup-meta.json'),
      'Option A must explicitly read backup-meta.json for the pristine hash'
    );
  });

  test('Option A iterates commit history to find hash-matching commit', () => {
    const optionAStart = content.indexOf('### Option A');
    const optionBStart = content.indexOf('### Option B');
    const optionABlock = content.slice(optionAStart, optionBStart);
    // Must walk commits and compare hashes — not just take the first-add commit
    assert.ok(
      optionABlock.includes('sha256') || optionABlock.includes('SHA-256') || optionABlock.includes('sha256sum'),
      'Option A must compare SHA-256 hashes to identify the correct baseline commit'
    );
    assert.ok(
      optionABlock.includes('git log') && optionABlock.includes('format="%H"'),
      'Option A must iterate git log commits to find the hash-matching baseline'
    );
  });

  test('Option A has a fallback to first-add heuristic when no pristine hash is available', () => {
    const optionAStart = content.indexOf('### Option A');
    const optionBStart = content.indexOf('### Option B');
    const optionABlock = content.slice(optionAStart, optionBStart);
    assert.ok(
      optionABlock.includes('diff-filter=A') || optionABlock.includes('Fallback') || optionABlock.includes('fallback'),
      'Option A must include a fallback for repos without pristine_hashes (older installer)'
    );
  });

  test('Option A explains why first-add commit is wrong for multi-cycle repos', () => {
    const optionAStart = content.indexOf('### Option A');
    const optionBStart = content.indexOf('### Option B');
    const optionABlock = content.slice(optionAStart, optionBStart);
    assert.ok(
      optionABlock.includes('first add') || optionABlock.includes('first added') ||
      optionABlock.includes('multiple') || optionABlock.includes('update cycles'),
      'Option A must document why the first-add heuristic fails for multi-cycle repos'
    );
  });
});
