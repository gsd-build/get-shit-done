/**
 * Structural regression guard for atomic write usage (#1972).
 *
 * Ensures that milestone.cjs, phase.cjs, and frontmatter.cjs do NOT
 * contain bare fs.writeFileSync calls targeting .planning/ files. All
 * such writes must go through atomicWriteFileSync to prevent partial
 * writes from corrupting planning artifacts on crash.
 *
 * Allowed exceptions:
 *   - Writes to .gitkeep (empty files, no corruption risk)
 *   - Writes to archive directories (new files, not read-modify-write)
 *
 * This test is structural — it reads the source files and parses for
 * bare writeFileSync patterns. It complements functional tests in
 * atomic-write.test.cjs which verify the helper itself.
 */

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const libDir = path.resolve(__dirname, '..', 'get-shit-done', 'bin', 'lib');

/**
 * Find all fs.writeFileSync(...) call sites in a file.
 * Returns array of { line: number, text: string }.
 */
function findBareWrites(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const hits = [];
  for (let i = 0; i < lines.length; i++) {
    if (/\bfs\.writeFileSync\s*\(/.test(lines[i])) {
      hits.push({ line: i + 1, text: lines[i].trim() });
    }
  }
  return hits;
}

/**
 * Classify a bare write as allowed (archive, .gitkeep) or disallowed.
 */
function isAllowedException(lineText) {
  // .gitkeep writes (empty file, no corruption risk)
  if (/\.gitkeep/.test(lineText)) return true;
  // Archive directory writes (new files, not read-modify-write)
  if (/archiveDir/.test(lineText)) return true;
  return false;
}

describe('atomic write coverage (#1972)', () => {
  const targetFiles = ['milestone.cjs', 'phase.cjs', 'frontmatter.cjs'];

  for (const file of targetFiles) {
    test(`${file}: all fs.writeFileSync calls target allowed exceptions`, () => {
      const filePath = path.join(libDir, file);
      assert.ok(fs.existsSync(filePath), `${file} must exist at ${filePath}`);

      const hits = findBareWrites(filePath);
      const violations = hits.filter(h => !isAllowedException(h.text));

      if (violations.length > 0) {
        const report = violations.map(v => `  line ${v.line}: ${v.text}`).join('\n');
        assert.fail(
          `${file} contains ${violations.length} bare fs.writeFileSync call(s) targeting planning files.\n` +
          `These should use atomicWriteFileSync instead:\n${report}`
        );
      }
    });

    test(`${file}: imports atomicWriteFileSync from core.cjs`, () => {
      const filePath = path.join(libDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      assert.match(
        content,
        /atomicWriteFileSync.*require\(['"]\.\/core\.cjs['"]\)|atomicWriteFileSync[^)]*\}\s*=\s*require\(['"]\.\/core\.cjs['"]\)/s,
        `${file} must import atomicWriteFileSync from core.cjs`
      );
    });
  }

  test('all three files use atomicWriteFileSync at least once', () => {
    for (const file of targetFiles) {
      const content = fs.readFileSync(path.join(libDir, file), 'utf-8');
      assert.match(
        content,
        /atomicWriteFileSync\s*\(/,
        `${file} must contain at least one atomicWriteFileSync call`
      );
    }
  });
});
