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
 *
 * #2790: reapply-patches.md (which contained the inline Option A / Option B workflow)
 * was consolidated into update.md as the --reapply flag. The behavioral contract
 * (pristine_hashes preference, fallback to first-add) is maintained in the
 * update.md workflow's --reapply path. These tests now verify the consolidation.
 */

// allow-test-rule: source-text-is-the-product
// get-shit-done/workflows/update.md is the installed runtime workflow —
// its text IS the deployed behavioral contract.

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

// #2790: reapply-patches.md (command with inline workflow) was deleted.
// The --reapply functionality is now in update.md.
const UPDATE_MD = path.join(__dirname, '..', 'commands', 'gsd', 'update.md');

/**
 * Parse a field from YAML frontmatter between --- markers.
 * Returns null if the frontmatter or field is absent.
 */
function parseFrontmatterField(content, field) {
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fmMatch) return null;
  const fm = fmMatch[1];
  const quoted = fm.match(new RegExp(`^${field}:\\s+"((?:[^"\\\\]|\\\\.)*)"\\s*$`, 'm'));
  if (quoted) return quoted[1];
  const plain = fm.match(new RegExp(`^${field}:\\s+(.+)$`, 'm'));
  if (plain) return plain[1].trim();
  return null;
}

describe('reapply-patches pristine baseline detection (#2424)', () => {
  test('reapply-patches.md command is deleted (absorbed into update.md --reapply, #2790)', () => {
    const oldPath = path.join(__dirname, '..', 'commands', 'gsd', 'reapply-patches.md');
    assert.ok(!fs.existsSync(oldPath), 'reapply-patches.md should be absent (absorbed into update.md --reapply)');
  });

  test('update.md argument-hint declares --reapply as consolidated entry point', () => {
    const content = fs.readFileSync(UPDATE_MD, 'utf-8');
    const argHint = parseFrontmatterField(content, 'argument-hint');
    assert.ok(
      argHint && argHint.includes('--reapply'),
      `update.md argument-hint must declare --reapply flag; got: ${argHint || '(none)'}`
    );
  });

  test('update.md workflow references backup-meta.json for pristine-hash baseline', () => {
    // #2790: The behavioral contract (pristine_hashes from backup-meta.json as primary
    // baseline source) is implemented in the update.md workflow (get-shit-done/workflows/update.md),
    // not the command file. The command delegates via --reapply flag.
    // Verify the underlying workflow has this content.
    const workflowPath = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'update.md');
    const workflowContent = fs.readFileSync(workflowPath, 'utf-8');
    assert.ok(
      workflowContent.includes('backup-meta.json'),
      'get-shit-done/workflows/update.md must reference backup-meta.json (pristine_hashes baseline source)'
    );
  });

  test('update.md exists as consolidated entry point', () => {
    assert.ok(fs.existsSync(UPDATE_MD), 'update.md must exist as consolidated entry point');
  });

  test('update.md argument-hint declares full consolidated flag surface (--sync | --reapply)', () => {
    // Validates that both flags absorbed from the deleted micro-skills are declared
    // in the command contract, not just --reapply alone.
    const content = fs.readFileSync(UPDATE_MD, 'utf-8');
    const argHint = parseFrontmatterField(content, 'argument-hint');
    assert.ok(
      argHint && argHint.includes('--sync') && argHint.includes('--reapply'),
      `update.md argument-hint must declare both --sync and --reapply; got: ${argHint || '(none)'}`
    );
  });
});
