/**
 * Regression tests for regex global state bug in milestone.cjs
 *
 * The original code used test() + replace() with global-flag regexes.
 * test() advances lastIndex, so a subsequent replace() on the same
 * regex object starts from the wrong position and can miss the match.
 *
 * The fix uses replace() directly and compares before/after to detect
 * whether a substitution occurred, avoiding the lastIndex pitfall.
 */

'use strict';

const { describe, test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const MILESTONE_SRC = path.join(__dirname, '..', 'get-shit-done', 'bin', 'lib', 'milestone.cjs');

describe('milestone.cjs regex global state fix', () => {
  let src;

  before(() => {
    src = fs.readFileSync(MILESTONE_SRC, 'utf-8');
  });

  test('checkbox update uses replace() + compare, not test() + replace()', () => {
    // The old pattern: if (pattern.test(content)) { content = content.replace(pattern, ...); }
    // The new pattern: const after = content.replace(pattern, ...); if (after !== content) { ... }
    const funcBody = src.slice(
      src.indexOf('function cmdRequirementsMarkComplete'),
      src.indexOf('function cmdMilestoneComplete')
    );

    // Should NOT have test() followed by replace() on the same pattern for checkboxes
    assert.ok(
      !funcBody.includes('checkboxPattern.test(reqContent)'),
      'Should not call test() on checkboxPattern — use replace() + compare instead'
    );

    // Should have the replace-then-compare pattern
    assert.ok(
      funcBody.includes('afterCheckbox !== reqContent') ||
      funcBody.includes('afterCheckbox!==reqContent'),
      'Should compare before/after replace to detect checkbox changes'
    );
  });

  test('table update uses replace() + compare, not test() + replace()', () => {
    const funcBody = src.slice(
      src.indexOf('function cmdRequirementsMarkComplete'),
      src.indexOf('function cmdMilestoneComplete')
    );

    // Should NOT have test() followed by replace() on the same pattern for tables
    assert.ok(
      !funcBody.includes('tablePattern.test(reqContent)'),
      'Should not call test() on tablePattern — use replace() + compare instead'
    );

    // Should have the replace-then-compare pattern
    assert.ok(
      funcBody.includes('afterTable !== reqContent') ||
      funcBody.includes('afterTable!==reqContent'),
      'Should compare before/after replace to detect table changes'
    );
  });

  test('done-check regexes use non-global flag (only need existence check)', () => {
    const funcBody = src.slice(
      src.indexOf('function cmdRequirementsMarkComplete'),
      src.indexOf('function cmdMilestoneComplete')
    );

    // The doneCheckbox and doneTable patterns should use 'i' not 'gi'
    // since test() with 'g' flag has stateful lastIndex
    const doneCheckboxMatch = funcBody.match(/doneCheckbox\s*=\s*new RegExp\([^)]+,\s*'([^']+)'\)/);
    const doneTableMatch = funcBody.match(/doneTable\s*=\s*new RegExp\([^)]+,\s*'([^']+)'\)/);

    assert.ok(doneCheckboxMatch, 'doneCheckbox regex should exist');
    assert.ok(doneTableMatch, 'doneTable regex should exist');
    assert.ok(
      !doneCheckboxMatch[1].includes('g'),
      'doneCheckbox should not use global flag (only needs existence check via test())'
    );
    assert.ok(
      !doneTableMatch[1].includes('g'),
      'doneTable should not use global flag (only needs existence check via test())'
    );
  });

  test('no duplicate regex construction for the same pattern', () => {
    const funcBody = src.slice(
      src.indexOf('function cmdRequirementsMarkComplete'),
      src.indexOf('function cmdMilestoneComplete')
    );

    // The old code created the table pattern twice — once for test(), once for replace().
    // Count lines that construct a regex with 'tablePattern' or the Pending table pattern.
    const tableConstructions = funcBody.split('\n').filter(
      line => line.includes('tablePattern') && line.includes('new RegExp')
    );
    assert.ok(
      tableConstructions.length <= 1,
      `Table pattern regex should be constructed at most once, found ${tableConstructions.length}`
    );
  });
});
