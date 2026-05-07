/**
 * verify-work workflow — MVP mode UAT contract test
 * Verifies the workflow markdown documents MVP_MODE resolution,
 * conditional reference injection, user-flow-first UAT ordering,
 * and the deferred-technical-checks clause.
 */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WORKFLOW = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'verify-work.md');

describe('verify-work — MVP mode UAT framing', () => {
  const content = fs.readFileSync(WORKFLOW, 'utf-8');

  test('Step 1 resolves MVP_MODE from phase mode field', () => {
    assert.match(content, /MVP_MODE/, 'workflow must declare MVP_MODE');
    assert.match(
      content,
      /phase\.mvp-mode|phase mvp-mode/i,
      'must resolve MVP mode via the centralized phase.mvp-mode verb (no inline roadmap+config bash)'
    );
  });

  test('workflow references verify-mvp-mode.md', () => {
    assert.match(content, /verify-mvp-mode\.md/, 'must reference the UAT framing file');
  });

  test('UAT generation under MVP mode runs user-flow steps first', () => {
    assert.match(
      content,
      /user[\s-]?flow[^\n]{0,80}(first|before|precede)/i,
      'must specify user-flow-first ordering'
    );
  });

  test('technical checks deferred under MVP mode', () => {
    assert.match(
      content,
      /technical[\s-]?checks[^\n]{0,80}(after|defer|second)/i,
      'must defer technical checks under MVP mode'
    );
  });

  test('mode null falls back to standard UAT generation', () => {
    assert.match(
      content,
      /mode[^\n]*null|absent|not.*mvp|standard\s*UAT/i,
      'must specify fallback when mode is not mvp'
    );
  });
});
