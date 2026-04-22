'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// Replicates the inline node -e parser from get-shit-done/workflows/code-review.md
// step compute_file_scope, Tier 2 (lines ~172-181).
//
// Bug #2134: the section-reset regex uses \s+ (requires leading whitespace), so
// top-level YAML keys at column 0 (e.g. `decisions:`) never reset inSection.
// Items from subsequent top-level lists are therefore mis-classified as
// key_files.modified entries.

/**
 * Extracts files from SUMMARY.md YAML frontmatter using the CURRENT (buggy) logic
 * copied verbatim from code-review.md.
 */
function parseFilesWithBuggyLogic(frontmatterYaml) {
  const files = [];
  let inSection = null;
  for (const line of frontmatterYaml.split('\n')) {
    if (/^\s+created:/.test(line)) { inSection = 'created'; continue; }
    if (/^\s+modified:/.test(line)) { inSection = 'modified'; continue; }
    // BUG: \s+ requires leading whitespace — top-level keys like `decisions:` don't match
    if (/^\s+\w+:/.test(line) && !/^\s+-/.test(line)) { inSection = null; continue; }
    if (inSection && /^\s+-\s+(.+)/.test(line)) {
      files.push(line.match(/^\s+-\s+(.+)/)[1].trim());
    }
  }
  return files;
}

/**
 * Extracts files using the FIXED logic (\s* instead of \s+).
 */
function parseFilesWithFixedLogic(frontmatterYaml) {
  const files = [];
  let inSection = null;
  for (const line of frontmatterYaml.split('\n')) {
    if (/^\s+created:/.test(line)) { inSection = 'created'; continue; }
    if (/^\s+modified:/.test(line)) { inSection = 'modified'; continue; }
    // FIX: \s* allows zero leading whitespace — handles top-level YAML keys
    if (/^\s*\w+:/.test(line) && !/^\s*-/.test(line)) { inSection = null; continue; }
    if (inSection && /^\s+-\s+(.+)/.test(line)) {
      files.push(line.match(/^\s+-\s+(.+)/)[1].trim());
    }
  }
  return files;
}

// SUMMARY.md YAML frontmatter that mirrors a realistic post-execution artifact.
// key_files.modified has ONE real file; decisions has TWO entries that must NOT
// appear in the extracted file list.
const FRONTMATTER = [
  'type: summary',
  'phase: "02"',
  'key_files:',
  '  modified:',
  '    - src/real-file.js',
  '  created:',
  '    - src/new-file.js',
  'decisions:',
  '  - Used async/await over callbacks',
  '  - Kept error handling inline',
  'metrics:',
  '  lines_changed: 42',
  'tags:',
  '  - refactor',
  '  - async',
].join('\n');

describe('code-review SUMMARY.md YAML parser', () => {
  it('RED: buggy parser mis-classifies decisions entries as files (demonstrates the bug)', () => {
    const files = parseFilesWithBuggyLogic(FRONTMATTER);

    // With the bug, `decisions:` at column 0 never resets inSection, so the
    // two decision strings are incorrectly captured as modified files.
    // This assertion documents the broken behavior we are fixing.
    const hasDecisionContamination = files.some(
      (f) => f === 'Used async/await over callbacks' || f === 'Kept error handling inline'
    );
    assert.ok(
      hasDecisionContamination,
      'Expected buggy parser to include decision entries in file list, but it did not — ' +
        'the bug may already be fixed or the test replication is wrong. Got: ' +
        JSON.stringify(files)
    );
  });

  it('GREEN: fixed parser returns only the actual file paths', () => {
    const files = parseFilesWithFixedLogic(FRONTMATTER);

    assert.deepStrictEqual(
      files.sort(),
      ['src/new-file.js', 'src/real-file.js'],
      'Fixed parser should return only the two real file paths, not decision strings'
    );
  });

  it('fixed parser: modified-only frontmatter with top-level sibling keys', () => {
    const yaml = [
      'key_files:',
      '  modified:',
      '    - src/a.ts',
      '    - src/b.ts',
      'decisions:',
      '  - Some decision',
      'metrics:',
      '  count: 2',
    ].join('\n');

    const files = parseFilesWithFixedLogic(yaml);
    assert.deepStrictEqual(files.sort(), ['src/a.ts', 'src/b.ts']);
  });

  it('fixed parser: created-only frontmatter with top-level sibling keys', () => {
    const yaml = [
      'key_files:',
      '  created:',
      '    - src/brand-new.ts',
      'tags:',
      '  - feature',
    ].join('\n');

    const files = parseFilesWithFixedLogic(yaml);
    assert.deepStrictEqual(files, ['src/brand-new.ts']);
  });

  it('fixed parser: no key_files section returns empty array', () => {
    const yaml = [
      'type: summary',
      'decisions:',
      '  - A decision',
    ].join('\n');

    const files = parseFilesWithFixedLogic(yaml);
    assert.deepStrictEqual(files, []);
  });
});
