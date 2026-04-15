/**
 * Regression test: command count in docs/ARCHITECTURE.md must match
 * the actual number of .md files in commands/gsd/.
 *
 * Counts are extracted from the doc programmatically — never hardcoded
 * in this test — so any future drift (adding a command without updating
 * the doc, or vice-versa) is caught immediately.
 *
 * Related: issue #2257
 */
'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const COMMANDS_DIR = path.join(ROOT, 'commands', 'gsd');
const ARCH_MD = path.join(ROOT, 'docs', 'ARCHITECTURE.md');

/**
 * Count .md files that actually live in commands/gsd/.
 * Does not recurse into subdirectories.
 */
function actualCommandCount() {
  return fs
    .readdirSync(COMMANDS_DIR)
    .filter((f) => f.endsWith('.md'))
    .length;
}

/**
 * Extract the integer from the "**Total commands:** N" prose line in
 * ARCHITECTURE.md.  Returns null if the pattern is not found.
 */
function docProseCount(content) {
  const m = content.match(/\*\*Total commands:\*\*\s+(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

/**
 * Extract the integer from the directory-tree comment line:
 *   ├── commands/gsd/*.md               # N slash commands
 * Returns null if the pattern is not found.
 */
function docTreeCount(content) {
  const m = content.match(/commands\/gsd\/\*\.md[^\n]*#\s*(\d+)\s+slash commands/);
  return m ? parseInt(m[1], 10) : null;
}

describe('ARCHITECTURE.md command count sync', () => {
  const archContent = fs.readFileSync(ARCH_MD, 'utf8');
  const actual = actualCommandCount();

  test('docs/ARCHITECTURE.md contains a "Total commands:" prose count', () => {
    const count = docProseCount(archContent);
    assert.notEqual(count, null, 'Expected "**Total commands:** N" line not found in ARCHITECTURE.md');
  });

  test('docs/ARCHITECTURE.md contains a directory-tree slash-command count', () => {
    const count = docTreeCount(archContent);
    assert.notEqual(count, null, 'Expected "# N slash commands" tree comment not found in ARCHITECTURE.md');
  });

  test('"Total commands:" prose count matches actual commands/gsd/ file count', () => {
    const prose = docProseCount(archContent);
    assert.equal(
      prose,
      actual,
      `ARCHITECTURE.md "Total commands:" says ${prose} but commands/gsd/ has ${actual} .md files — update the doc`,
    );
  });

  test('directory-tree slash-command count matches actual commands/gsd/ file count', () => {
    const tree = docTreeCount(archContent);
    assert.equal(
      tree,
      actual,
      `ARCHITECTURE.md directory tree says ${tree} slash commands but commands/gsd/ has ${actual} .md files — update the doc`,
    );
  });

  test('"Total commands:" prose count and directory-tree count agree with each other', () => {
    const prose = docProseCount(archContent);
    const tree = docTreeCount(archContent);
    assert.equal(
      prose,
      tree,
      `ARCHITECTURE.md has two mismatched counts: "Total commands: ${prose}" vs tree "# ${tree} slash commands"`,
    );
  });
});
