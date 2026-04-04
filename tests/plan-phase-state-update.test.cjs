/**
 * plan-phase STATE.md update tests (#1626)
 *
 * Verifies that plan-phase.md updates STATE.md after planning completes,
 * so downstream workflows (and users) can see the phase is ready to execute.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const WORKFLOW_PATH = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'plan-phase.md');

describe('plan-phase STATE.md update (#1626)', () => {
  let content;

  test('plan-phase.md exists', () => {
    assert.ok(fs.existsSync(WORKFLOW_PATH), 'get-shit-done/workflows/plan-phase.md should exist');
    content = fs.readFileSync(WORKFLOW_PATH, 'utf-8');
  });

  test('plan-phase contains a state update call', () => {
    content = content || fs.readFileSync(WORKFLOW_PATH, 'utf-8');
    assert.ok(
      content.includes('state update') || content.includes('state patch'),
      'plan-phase.md should call gsd-tools state update or state patch'
    );
  });

  test('state update sets status to planned / ready to execute', () => {
    content = content || fs.readFileSync(WORKFLOW_PATH, 'utf-8');
    assert.ok(
      content.includes('planned') && content.includes('ready to execute'),
      'status message should include "planned" and "ready to execute"'
    );
  });

  test('state update happens in step 14 (Present Final Status)', () => {
    content = content || fs.readFileSync(WORKFLOW_PATH, 'utf-8');
    // Find the positions of step 14 header, the state update, and step 15 header
    const step14Pos = content.indexOf('## 14. Present Final Status');
    const step15Pos = content.indexOf('## 15. Auto-Advance Check');
    const stateUpdatePos = content.indexOf('state update', step14Pos);

    assert.ok(step14Pos !== -1, 'step 14 header should exist');
    assert.ok(step15Pos !== -1, 'step 15 header should exist');
    assert.ok(stateUpdatePos !== -1, 'state update call should exist after step 14');
    assert.ok(
      stateUpdatePos > step14Pos && stateUpdatePos < step15Pos,
      'state update should appear between step 14 and step 15 (before auto-advance check)'
    );
  });

  test('state update includes Last Activity field', () => {
    content = content || fs.readFileSync(WORKFLOW_PATH, 'utf-8');
    assert.ok(
      content.includes('state update "Last Activity"'),
      'plan-phase should update the Last Activity field in STATE.md'
    );
  });

  test('state update commits the change', () => {
    content = content || fs.readFileSync(WORKFLOW_PATH, 'utf-8');
    // The commit should reference STATE.md
    const step14Pos = content.indexOf('## 14. Present Final Status');
    const step15Pos = content.indexOf('## 15. Auto-Advance Check');
    const section14 = content.slice(step14Pos, step15Pos);

    assert.ok(
      section14.includes('commit') && section14.includes('STATE.md'),
      'step 14 should commit the STATE.md update'
    );
  });
});
