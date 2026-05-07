/**
 * mvp-phase workflow — contract test
 * Verifies the workflow markdown contains the four agreed gates:
 *  1. Phase existence + status guard (refuse in_progress/completed)
 *  2. User-story prompt (three AskUserQuestion calls, As a / I want to / So that)
 *  3. SPIDR splitting check
 *  4. ROADMAP write (Mode + Goal)
 *  5. Delegation to plan-phase
 */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WORKFLOW = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'mvp-phase.md');

function parseMvpPhaseContract(content) {
  const lines = content.split(/\r?\n/);
  const lowerLines = lines.map(line => line.toLowerCase());
  const askCount = lowerLines.filter(line => line.includes('askuserquestion') || line.includes('vscode_askquestions')).length;
  const spidrStepIndex = lowerLines.findIndex(line => line.includes('## 4. spidr splitting check'));
  const planPhaseStepIndex = lowerLines.findIndex(line => line.includes('## 7. delegate to /gsd plan-phase'));

  return {
    hasStatusGuard: lowerLines.some(line => line.includes('in_progress') || line.includes('completed')),
    hasForceOverride: lowerLines.some(line => line.includes('--force') || line.includes('status guard')),
    hasAsA: lowerLines.some(line => line.includes('as a')),
    hasIWantTo: lowerLines.some(line => line.includes('i want to')),
    hasSoThat: lowerLines.some(line => line.includes('so that')),
    askCount,
    hasSpidrReference: lowerLines.some(line => line.includes('spidr-splitting.md')),
    hasModeLine: lowerLines.some(line => line.includes('**mode:** mvp')),
    hasGoalLine: lowerLines.some(line => line.includes('**goal:**')),
    hasRoadmapReference: lowerLines.some(line => line.includes('roadmap.md')),
    spidrStepIndex,
    planPhaseStepIndex,
    hasUserStoryTemplateRef: lowerLines.some(line => line.includes('user-story-template.md')),
  };
}

describe('mvp-phase workflow', () => {
  const contract = parseMvpPhaseContract(fs.readFileSync(WORKFLOW, 'utf-8'));

  test('declares phase status guard (refuse in_progress/completed unless --force)', () => {
    assert.ok(contract.hasStatusGuard, 'workflow must reference status guard');
    assert.ok(contract.hasForceOverride, 'workflow must mention force override or status guard');
  });

  test('runs three structured user-story prompts', () => {
    assert.ok(contract.hasAsA);
    assert.ok(contract.hasIWantTo);
    assert.ok(contract.hasSoThat);
    assert.ok(contract.askCount >= 3, `workflow must invoke AskUserQuestion at least 3 times for the story prompts (got ${contract.askCount})`);
  });

  test('runs SPIDR splitting check after user story', () => {
    assert.ok(contract.spidrStepIndex >= 0, 'workflow must define an SPIDR step');
    assert.ok(contract.hasSpidrReference, 'workflow must reference the SPIDR rules file');
  });

  test('writes Mode: mvp + Goal: line to ROADMAP.md', () => {
    assert.ok(contract.hasModeLine, 'workflow must specify the **Mode:** mvp line');
    assert.ok(contract.hasRoadmapReference, 'workflow must reference ROADMAP.md');
    assert.ok(contract.hasGoalLine, 'workflow must update the **Goal:** line');
  });

  test('delegates to /gsd plan-phase after ROADMAP write', () => {
    assert.ok(contract.planPhaseStepIndex >= 0, 'plan-phase delegation step must be present');
    assert.ok(contract.spidrStepIndex >= 0, 'SPIDR check step must be present');
    assert.ok(contract.planPhaseStepIndex > contract.spidrStepIndex, 'plan-phase delegation must come AFTER SPIDR check');
  });

  test('references user-story-template.md', () => {
    assert.ok(contract.hasUserStoryTemplateRef);
  });
});
