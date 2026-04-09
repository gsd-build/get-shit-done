/**
 * commit_docs bypass guard tests (#1783)
 *
 * When users set commit_docs: false during /gsd-new-project, .planning/
 * files should never be staged or committed. The gsd-tools.cjs commit
 * wrapper already checks this flag, but three locations in execute-phase.md
 * and quick.md used raw `git add .planning/` commands that bypassed it.
 *
 * These tests verify that every `git add .planning/` invocation (explicit
 * or via file_list) is preceded by a commit_docs config check.
 */

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const EXECUTE_PHASE_PATH = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'execute-phase.md');
const QUICK_PATH = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'quick.md');

describe('commit_docs bypass guard (#1783)', () => {

  test('execute-phase.md: every git add .planning/ has a commit_docs guard', () => {
    const content = fs.readFileSync(EXECUTE_PHASE_PATH, 'utf-8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      if (/git add\b.*\.planning\//.test(lines[i])) {
        // Search backwards from this line for a config-get commit_docs check
        const windowStart = Math.max(0, i - 10);
        const window = lines.slice(windowStart, i).join('\n');
        assert.ok(
          window.includes('config-get commit_docs'),
          `git add .planning/ at line ${i + 1} in execute-phase.md must be guarded by a commit_docs config check`
        );
      }
    }
  });

  test('quick.md: every git add .planning/ has a commit_docs guard', () => {
    const content = fs.readFileSync(QUICK_PATH, 'utf-8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      if (/git add\b.*\.planning\//.test(lines[i])) {
        const windowStart = Math.max(0, i - 10);
        const window = lines.slice(windowStart, i).join('\n');
        assert.ok(
          window.includes('config-get commit_docs'),
          `git add .planning/ at line ${i + 1} in quick.md must be guarded by a commit_docs config check`
        );
      }
    }
  });

  test('quick.md: git add ${file_list} has a commit_docs guard for .planning/ filtering', () => {
    const content = fs.readFileSync(QUICK_PATH, 'utf-8');
    const lines = content.split('\n');

    // Find the line(s) that do `git add ${file_list}` — this variable
    // includes .planning/STATE.md so it needs a commit_docs guard too
    for (let i = 0; i < lines.length; i++) {
      if (/git add\s+\$\{?file_list/.test(lines[i])) {
        const windowStart = Math.max(0, i - 10);
        const window = lines.slice(windowStart, i + 1).join('\n');
        assert.ok(
          window.includes('config-get commit_docs'),
          `git add \${file_list} at line ${i + 1} in quick.md must be guarded by a commit_docs check ` +
          `because file_list includes .planning/ files`
        );
      }
    }
  });

  test('no raw git add .planning/ without commit_docs guard in any workflow', () => {
    const workflows = [
      { name: 'execute-phase.md', path: EXECUTE_PHASE_PATH },
      { name: 'quick.md', path: QUICK_PATH },
    ];

    for (const wf of workflows) {
      const content = fs.readFileSync(wf.path, 'utf-8');

      // Find all occurrences of git add that reference .planning/
      const regex = /git add\b[^\n]*\.planning\//g;
      let match;
      while ((match = regex.exec(content)) !== null) {
        // Get the 500-char window before this match
        const before = content.slice(Math.max(0, match.index - 500), match.index);
        assert.ok(
          before.includes('config-get commit_docs'),
          `${wf.name}: found unguarded git add .planning/ near offset ${match.index}. ` +
          `All raw git add .planning/ commands must check commit_docs config first.`
        );
      }
    }
  });
});
