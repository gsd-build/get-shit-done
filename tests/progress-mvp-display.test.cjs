/**
 * progress workflow — MVP mode display contract test
 */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WORKFLOW = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'progress.md');

function parseProgressContract(content) {
  const lines = content.split(/\r?\n/);
  const lowerLines = lines.map(line => line.toLowerCase());
  return {
    hasMvpModeVariable: lowerLines.some(line => line.includes('mvp_mode')),
    usesPhaseMvpVerb: lowerLines.some(line => line.includes('phase.mvp-mode')),
    sourcesPlanTasks: lowerLines.some(line => line.includes('plan.md') && line.includes('task')),
    usesUserFlowLanguage: lowerLines.some(line => line.includes('user-flow') || line.includes('user-visible')),
    hasStandardFallback: lowerLines.some(line =>
      (line.includes('mode') && (line.includes('null') || line.includes('absent') || line.includes('not mvp'))) ||
      (line.includes('standard') && line.includes('display'))
    ),
  };
}

describe('progress — MVP mode display', () => {
  const contract = parseProgressContract(fs.readFileSync(WORKFLOW, 'utf-8'));

  test('workflow declares MVP_MODE branch', () => {
    assert.ok(contract.hasMvpModeVariable, 'must declare MVP_MODE');
    assert.ok(contract.usesPhaseMvpVerb, 'must resolve MVP mode via the centralized phase.mvp-mode verb');
  });

  test('MVP display sources user-flow status from PLAN.md task names', () => {
    assert.ok(contract.sourcesPlanTasks, 'must source user-flow status from PLAN.md tasks');
    assert.ok(contract.usesUserFlowLanguage, 'must use user-flow framing');
  });

  test('falls back to standard display when mode null', () => {
    assert.ok(contract.hasStandardFallback, 'must specify fallback when mode is not mvp');
  });
});
