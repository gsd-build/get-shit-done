/**
 * stats workflow — MVP mode summary contract test
 */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WORKFLOW = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'stats.md');

describe('stats — MVP mode summary', () => {
  const content = fs.readFileSync(WORKFLOW, 'utf-8');

  test('workflow includes MVP phase count summary', () => {
    assert.match(content, /MVP/, 'must mention MVP in summary');
    assert.match(content, /mode/i, 'must reference mode field');
  });

  test('uses roadmap.analyze to count MVP phases', () => {
    assert.match(
      content,
      /roadmap[^\n]*analyze|analyze[^\n]*mode/i,
      'must consult roadmap.analyze (which surfaces mode per phase from Phase 1)'
    );
  });
});
