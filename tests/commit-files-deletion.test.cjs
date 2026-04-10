/**
 * Regression test for #2014: gsd-tools commit --files silently deletes
 * planning files when a filename passed via --files does not exist on disk.
 *
 * Prior to this fix, when --files STATE.md was passed and STATE.md did not
 * exist on disk, the code called `git rm --cached --ignore-unmatch STATE.md`
 * which staged and committed a deletion. The caller passed explicit --files
 * expecting only those specific files to be staged -- missing files should
 * be skipped, not deleted.
 */

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const { createTempGitProject, cleanup, runGsdTools } = require('./helpers.cjs');

describe('commit --files: missing files must not stage deletions (#2014)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempGitProject();
    // Commit STATE.md so it exists in git history
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), '# State\n\nInitial state.\n');
    execSync('git add .planning/STATE.md', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git commit -m "add STATE.md"', { cwd: tmpDir, stdio: 'pipe' });
    // Delete STATE.md from disk -- now missing but tracked in git
    fs.unlinkSync(path.join(tmpDir, '.planning', 'STATE.md'));
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('passing --files for a missing tracked file does not commit a deletion', () => {
    // STATE.md is tracked in git but deleted from disk.
    // commit --files .planning/STATE.md should skip it (no deletion committed).
    runGsdTools(
      ['commit', 'test commit', '--files', '.planning/STATE.md'],
      tmpDir
    );

    // Check git log: the new commit (HEAD) must NOT have deleted STATE.md.
    // git diff HEAD~1 HEAD --name-status shows what changed between commits.
    let diffOutput = '';
    try {
      diffOutput = execSync('git diff HEAD~1 HEAD --name-status', { cwd: tmpDir, encoding: 'utf-8' });
    } catch (e) {
      // If nothing to commit, there is no HEAD~1 -- that's also acceptable
      return;
    }
    assert.ok(
      !diffOutput.includes('D\t.planning/STATE.md'),
      'commit --files must not commit a deletion of a missing file, diff was:\n' + diffOutput
    );
  });

  test('passing --files for a file that exists stages and commits it normally', () => {
    // Create ROADMAP.md -- this file exists, should be staged normally
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), '# Roadmap\n\nPhase 01.\n');

    const result = runGsdTools(
      ['commit', 'add roadmap', '--files', '.planning/ROADMAP.md'],
      tmpDir
    );

    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.committed, true, 'should have committed when file exists');

    // Verify ROADMAP.md was added in the commit
    const diffOutput = execSync('git diff HEAD~1 HEAD --name-status', { cwd: tmpDir, encoding: 'utf-8' });
    assert.ok(
      diffOutput.includes('A\t.planning/ROADMAP.md'),
      'ROADMAP.md should appear as added in the commit'
    );
  });

  test('--files with mix of existing and missing files only stages the existing ones', () => {
    // ROADMAP.md exists on disk, STATE.md does not
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), '# Roadmap\n');

    runGsdTools(
      ['commit', 'partial files', '--files', '.planning/ROADMAP.md', '.planning/STATE.md'],
      tmpDir
    );

    // The commit must not include a deletion of STATE.md
    let diffOutput = '';
    try {
      diffOutput = execSync('git diff HEAD~1 HEAD --name-status', { cwd: tmpDir, encoding: 'utf-8' });
    } catch (e) {
      return; // nothing committed is fine
    }
    assert.ok(
      !diffOutput.includes('D\t.planning/STATE.md'),
      'missing file in --files list must not be committed as a deletion'
    );
  });
});
