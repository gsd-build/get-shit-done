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

describe('mvp-phase workflow', () => {
  const content = fs.readFileSync(WORKFLOW, 'utf-8');

  test('declares phase status guard (refuse in_progress/completed unless --force)', () => {
    assert.match(content, /in_progress|completed/i, 'workflow must reference status guard');
    assert.match(content, /--force|status\s*guard/i, 'workflow must mention force override or status guard');
  });

  test('runs three structured user-story prompts', () => {
    assert.match(content, /As a/i);
    assert.match(content, /I want to/i);
    assert.match(content, /[Ss]o that/);
    // The three prompts should each use AskUserQuestion (or vscode_askquestions for Copilot)
    const askCount = (content.match(/AskUserQuestion|vscode_askquestions/g) || []).length;
    assert.ok(askCount >= 3, `workflow must invoke AskUserQuestion at least 3 times for the story prompts (got ${askCount})`);
  });

  test('runs SPIDR splitting check after user story', () => {
    assert.match(content, /SPIDR|spidr-splitting/i);
    assert.match(content, /spidr-splitting\.md/, 'workflow must reference the SPIDR rules file');
  });

  test('writes Mode: mvp + Goal: line to ROADMAP.md', () => {
    assert.match(content, /\*\*Mode:\*\*\s*mvp/i, 'workflow must specify the **Mode:** mvp line');
    assert.match(content, /ROADMAP\.md/);
    assert.match(content, /\*\*Goal:\*\*/, 'workflow must update the **Goal:** line');
  });

  test('delegates to /gsd plan-phase after ROADMAP write', () => {
    assert.match(content, /plan-phase/);
    // Order: SPIDR ... then plan-phase
    const spidrIdx = content.search(/SPIDR|spidr-splitting/i);
    const planPhaseIdx = content.search(/\/gsd[\s-]?plan-phase|plan-phase\s+(?:command|workflow|delegation)/i);
    assert.ok(spidrIdx > 0 && planPhaseIdx > 0, 'both SPIDR and plan-phase delegation must be present');
    assert.ok(planPhaseIdx > spidrIdx, 'plan-phase delegation must come AFTER SPIDR check');
  });

  test('references user-story-template.md', () => {
    assert.match(content, /user-story-template\.md/);
  });
});
