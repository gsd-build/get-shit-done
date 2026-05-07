/**
 * gsd-verifier agent — MVP Mode Verification section contract
 * Verifies the agent definition contains a section instructing the verifier
 * to emphasize user-visible outcomes under MVP mode.
 */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const AGENT = path.join(__dirname, '..', 'agents', 'gsd-verifier.md');
const REF = path.join(__dirname, '..', 'get-shit-done', 'references', 'verify-mvp-mode.md');

function parseVerifierContract(content) {
  const lines = content.split(/\r?\n/);
  const lowerLines = lines.map(line => line.toLowerCase());
  return {
    hasMvpVerificationSection: lowerLines.some(line => line.includes('mvp mode verification') || line.includes('mvp-mode verification')),
    hasVerifyMvpReference: lowerLines.some(line => line.includes('verify-mvp-mode.md')),
    hasGoalBackwardTerminology: lowerLines.some(line => line.includes('goal-backward')),
  };
}

describe('gsd-verifier — MVP Mode Verification section', () => {
  const contract = parseVerifierContract(fs.readFileSync(AGENT, 'utf-8'));

  test('agent defines an MVP Mode Verification section', () => {
    assert.ok(contract.hasMvpVerificationSection);
  });

  test('agent references verify-mvp-mode.md', () => {
    assert.ok(contract.hasVerifyMvpReference);
  });

  test('agent preserves goal-backward terminology', () => {
    assert.ok(contract.hasGoalBackwardTerminology);
  });

  test('referenced file exists on disk', () => {
    assert.ok(fs.existsSync(REF));
  });
});
