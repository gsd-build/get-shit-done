/**
 * Worktree merge orchestrator file protection tests
 *
 * Guards against bug #1756: when a worktree branch outlives a milestone
 * transition, git merge silently overwrites STATE.md and ROADMAP.md with
 * stale content and resurrects archived phase directories.
 *
 * Fix: The worktree merge step must backup and restore orchestrator-owned
 * files (STATE.md, ROADMAP.md) and detect/remove files that main deleted
 * but the worktree branch re-adds.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const EXECUTE_PHASE_PATH = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'execute-phase.md');
const QUICK_PATH = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'quick.md');

describe('worktree merge: orchestrator file protection (#1756)', () => {
  test('execute-phase.md backs up STATE.md before worktree merge', () => {
    const content = fs.readFileSync(EXECUTE_PHASE_PATH, 'utf-8');
    // The workflow must snapshot STATE.md from main before merging
    // to prevent stale worktree content from overwriting it
    const mergeIdx = content.indexOf('git merge');
    assert.ok(mergeIdx > -1, 'workflow should contain git merge');

    // Look for STATE.md backup/snapshot before the merge command
    const hasStateBackup = (
      content.includes('STATE.md') &&
      (content.includes('git show HEAD:.planning/STATE.md') ||
       content.includes('state-backup') ||
       content.includes('STATE_BACKUP'))
    );
    assert.ok(hasStateBackup,
      'execute-phase must backup STATE.md before worktree merge to prevent stale overwrite');
  });

  test('execute-phase.md backs up ROADMAP.md before worktree merge', () => {
    const content = fs.readFileSync(EXECUTE_PHASE_PATH, 'utf-8');

    const hasRoadmapBackup = (
      content.includes('ROADMAP.md') &&
      (content.includes('git show HEAD:.planning/ROADMAP.md') ||
       content.includes('roadmap-backup') ||
       content.includes('ROADMAP_BACKUP'))
    );
    assert.ok(hasRoadmapBackup,
      'execute-phase must backup ROADMAP.md before worktree merge to prevent stale overwrite');
  });

  test('execute-phase.md restores orchestrator files after worktree merge', () => {
    const content = fs.readFileSync(EXECUTE_PHASE_PATH, 'utf-8');

    // After merge, orchestrator files must be restored from backup
    const mergeIdx = content.indexOf('git merge');
    const restoreSection = content.slice(mergeIdx);

    const hasRestore = (
      restoreSection.includes('cp ') ||
      restoreSection.includes('git checkout HEAD') ||
      restoreSection.includes('restore') ||
      restoreSection.includes('BACKUP')
    );
    assert.ok(hasRestore,
      'execute-phase must restore orchestrator files after merge (main always wins)');
  });

  test('execute-phase.md detects files deleted on main but re-added by worktree', () => {
    const content = fs.readFileSync(EXECUTE_PHASE_PATH, 'utf-8');

    // The merge step should detect and remove resurrected files
    // (e.g., archived phase directories that main deleted)
    const hasResurrectionDetection = (
      content.includes('git diff') && content.includes('--diff-filter') ||
      content.includes('resurrect') ||
      content.includes('re-added') ||
      content.includes('deleted on main') ||
      content.includes('DELETED_FILES') ||
      content.includes('PRE_MERGE_FILES')
    );
    assert.ok(hasResurrectionDetection,
      'execute-phase must detect and remove files that main deleted but worktree re-added');
  });

  test('quick.md has the same orchestrator file protection', () => {
    const content = fs.readFileSync(QUICK_PATH, 'utf-8');

    const hasProtection = (
      (content.includes('git show HEAD:.planning/STATE.md') ||
       content.includes('state-backup') ||
       content.includes('STATE_BACKUP')) &&
      (content.includes('git show HEAD:.planning/ROADMAP.md') ||
       content.includes('roadmap-backup') ||
       content.includes('ROADMAP_BACKUP'))
    );
    assert.ok(hasProtection,
      'quick.md must also protect orchestrator files during worktree merge');
  });
});
