// @ts-check
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { parseVerificationFile, writeVerificationFile, appendAttempt } = require('./verification');

// ---------------------------------------------------------------------------
// parseVerificationFile tests
// ---------------------------------------------------------------------------

describe('parseVerificationFile', () => {
  it('returns defaults for empty content', () => {
    const result = parseVerificationFile('');
    assert.equal(result.milestoneId, null);
    assert.equal(result.state, null);
    assert.equal(result.lastVerified, null);
    assert.equal(result.attempts, 0);
    assert.deepEqual(result.criteria, []);
    assert.deepEqual(result.history, []);
  });

  it('returns defaults for whitespace-only content', () => {
    const result = parseVerificationFile('   \n  \n  ');
    assert.equal(result.milestoneId, null);
    assert.deepEqual(result.criteria, []);
  });

  it('parses full content with all fields', () => {
    const content = `# Verification: M-01 -- User Auth

**Milestone:** M-01
**State:** KEPT
**Last Verified:** 2026-02-16T10:00:00Z
**Attempts:** 2

## Success Criteria

- [x] **SC-01:** User login works -- PASS
  Evidence: Login endpoint returns 200
- [ ] **SC-02:** Sessions persist -- FAIL
  Evidence: Session cookie not set

## Verification History

### Attempt 1

**Timestamp:** 2026-02-15T09:00:00Z
**Passed:** false
**Checks:** 2 total, 1 passed, 1 failed
**Remediation Triggered:** true
**Remediation Actions:** Fixed session cookie
**State Transition:** DONE -> BROKEN

### Attempt 2

**Timestamp:** 2026-02-16T10:00:00Z
**Passed:** true
**Checks:** 2 total, 2 passed, 0 failed
**Remediation Triggered:** false
**State Transition:** BROKEN -> KEPT
`;

    const result = parseVerificationFile(content);
    assert.equal(result.milestoneId, 'M-01');
    assert.equal(result.state, 'KEPT');
    assert.equal(result.lastVerified, '2026-02-16T10:00:00Z');
    assert.equal(result.attempts, 2);

    assert.equal(result.criteria.length, 2);
    assert.equal(result.criteria[0].id, 'SC-01');
    assert.equal(result.criteria[0].passed, true);
    assert.equal(result.criteria[0].description, 'User login works');
    assert.equal(result.criteria[0].result, 'PASS');
    assert.equal(result.criteria[0].evidence, 'Login endpoint returns 200');
    assert.equal(result.criteria[1].id, 'SC-02');
    assert.equal(result.criteria[1].passed, false);
    assert.equal(result.criteria[1].result, 'FAIL');

    assert.equal(result.history.length, 2);
    assert.equal(result.history[0].number, 1);
    assert.equal(result.history[0].timestamp, '2026-02-15T09:00:00Z');
    assert.equal(result.history[0].passed, false);
    assert.equal(result.history[0].remediationTriggered, true);
    assert.equal(result.history[0].remediationActions, 'Fixed session cookie');
    assert.equal(result.history[0].stateTransition, 'DONE -> BROKEN');

    assert.equal(result.history[1].number, 2);
    assert.equal(result.history[1].passed, true);
    assert.equal(result.history[1].stateTransition, 'BROKEN -> KEPT');
  });
});

// ---------------------------------------------------------------------------
// writeVerificationFile tests
// ---------------------------------------------------------------------------

describe('writeVerificationFile', () => {
  it('produces parseable output (round-trip)', () => {
    const criteria = [
      { id: 'SC-01', passed: true, description: 'API works', result: 'PASS', evidence: 'Returns 200' },
      { id: 'SC-02', passed: false, description: 'DB persists', result: 'FAIL', evidence: 'Row not found' },
    ];
    const history = [
      { number: 1, timestamp: '2026-02-16T10:00:00Z', passed: false, checks: '2 total, 1 passed, 1 failed', remediationTriggered: true, remediationActions: 'Fixed DB write', stateTransition: 'DONE -> BROKEN' },
    ];

    const content = writeVerificationFile('M-01', 'User Auth', 'BROKEN', criteria, history);
    const parsed = parseVerificationFile(content);

    assert.equal(parsed.milestoneId, 'M-01');
    assert.equal(parsed.state, 'BROKEN');
    assert.equal(parsed.attempts, 1);
    assert.equal(parsed.criteria.length, 2);
    assert.equal(parsed.criteria[0].id, 'SC-01');
    assert.equal(parsed.criteria[0].passed, true);
    assert.equal(parsed.criteria[0].evidence, 'Returns 200');
    assert.equal(parsed.criteria[1].id, 'SC-02');
    assert.equal(parsed.criteria[1].passed, false);
    assert.equal(parsed.history.length, 1);
    assert.equal(parsed.history[0].stateTransition, 'DONE -> BROKEN');
  });
});

// ---------------------------------------------------------------------------
// appendAttempt tests
// ---------------------------------------------------------------------------

describe('appendAttempt', () => {
  it('preserves existing history and adds new attempt', () => {
    const criteria = [
      { id: 'SC-01', passed: true, description: 'API works', result: 'PASS', evidence: 'Returns 200' },
    ];
    const history = [
      { number: 1, timestamp: '2026-02-15T09:00:00Z', passed: true, checks: '1 total, 1 passed, 0 failed', remediationTriggered: false, remediationActions: '', stateTransition: 'DONE -> KEPT' },
    ];

    const existing = writeVerificationFile('M-01', 'User Auth', 'KEPT', criteria, history);

    const newAttempt = {
      number: 2,
      timestamp: '2026-02-16T10:00:00Z',
      passed: true,
      checks: '1 total, 1 passed, 0 failed',
      remediationTriggered: false,
      remediationActions: '',
      stateTransition: 'KEPT -> KEPT',
    };

    const updated = appendAttempt(existing, 'M-01', 'User Auth', 'KEPT', criteria, newAttempt);
    const parsed = parseVerificationFile(updated);

    assert.equal(parsed.attempts, 2);
    assert.equal(parsed.history.length, 2);
    assert.equal(parsed.history[0].number, 1);
    assert.equal(parsed.history[0].timestamp, '2026-02-15T09:00:00Z');
    assert.equal(parsed.history[1].number, 2);
    assert.equal(parsed.history[1].timestamp, '2026-02-16T10:00:00Z');
  });
});
