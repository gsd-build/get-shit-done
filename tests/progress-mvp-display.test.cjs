/**
 * progress workflow — MVP mode display contract test
 */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WORKFLOW = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'progress.md');

describe('progress — MVP mode display', () => {
  const content = fs.readFileSync(WORKFLOW, 'utf-8');

  test('workflow declares MVP_MODE branch', () => {
    assert.match(content, /MVP_MODE/, 'must declare MVP_MODE');
    assert.match(
      content,
      /phase\.mvp-mode|phase mvp-mode/i,
      'must resolve MVP mode via the centralized phase.mvp-mode verb (no inline roadmap+config bash)'
    );
  });

  test('MVP display sources user-flow status from PLAN.md task names', () => {
    assert.match(
      content,
      /PLAN\.md[^\n]*task|task[^\n]*PLAN\.md/i,
      'must source user-flow status from PLAN.md tasks'
    );
    assert.match(
      content,
      /user[\s-]?flow|user-visible/i,
      'must use user-flow framing'
    );
  });

  test('falls back to standard display when mode null', () => {
    assert.match(
      content,
      /mode[^\n]*null|absent|not.*mvp|standard\s*display/i,
      'must specify fallback when mode is not mvp'
    );
  });
});
