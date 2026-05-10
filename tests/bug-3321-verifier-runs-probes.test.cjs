'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..');
const VERIFIER_AGENT = path.join(REPO_ROOT, 'agents', 'gsd-verifier.md');

describe('bug #3321: gsd-verifier runs probes instead of trusting SUMMARY claims', () => {
  test('verifier prompt requires direct probe discovery and execution', () => {
    const content = fs.readFileSync(VERIFIER_AGENT, 'utf8');

    assert.match(content, /scripts\/\*\/tests\/probe-\*\.sh/, 'must discover conventional probe scripts');
    assert.match(content, /bash "\$probe"/, 'must run each discovered probe in the verifier process');
    assert.match(content, /MISSING_PROBE/, 'must distinguish documented but missing probes');
    assert.match(content, /SUMMARY\.md[^.\n]*not evidence/i, 'must reject SUMMARY-reported probe passes as evidence');
    assert.match(content, /Probe Execution/, 'must report probe execution results in VERIFICATION.md');
  });
});
