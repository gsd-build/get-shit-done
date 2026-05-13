'use strict';

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createTempProject, cleanup, runGsdTools } = require('./helpers.cjs');

function seedState(tmpDir, planLine = '1 of 2') {
  const state = `# Project State

**Status:** executing
**Current Phase:** 1

## Current Position
Phase: 1 of 1
Plan: ${planLine}
Status: Ready
Last activity: 2026-01-01
Budget: $2,500 max test

## Session Continuity
Last session: 2026-01-01
`;
  fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), state, 'utf8');
}

function readBudgetLine(tmpDir) {
  const content = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf8');
  const budgetLines = content.split('\n').filter((line) => line.startsWith('Budget:'));
  return { content, budgetLines };
}

describe('bug #3454: state mutation must preserve literal $N amounts', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject('bug-3454-');
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('state advance-plan keeps Current Position dollar amount literal', () => {
    seedState(tmpDir, '1 of 20');
    const result = runGsdTools(['state', 'advance-plan'], tmpDir);
    assert.equal(result.success, true, `state advance-plan failed: ${result.error || result.output}`);

    const { budgetLines } = readBudgetLine(tmpDir);
    assert.equal(budgetLines.length, 1, `expected one Budget line, got ${budgetLines.length}`);
    assert.equal(budgetLines[0], 'Budget: $2,500 max test');
  });

  test('state begin-phase keeps Current Position dollar amount literal', () => {
    seedState(tmpDir);
    const result = runGsdTools(['state', 'begin-phase', '--phase', '1', '--name', 'setup', '--plans', '2'], tmpDir);
    assert.equal(result.success, true, `state begin-phase failed: ${result.error || result.output}`);

    const { budgetLines } = readBudgetLine(tmpDir);
    assert.equal(budgetLines.length, 1, `expected one Budget line, got ${budgetLines.length}`);
    assert.equal(budgetLines[0], 'Budget: $2,500 max test');
  });

  test('state complete-phase keeps Current Position dollar amount literal', () => {
    seedState(tmpDir);
    const result = runGsdTools(['state', 'complete-phase', '--phase', '1'], tmpDir);
    assert.equal(result.success, true, `state complete-phase failed: ${result.error || result.output}`);

    const { budgetLines } = readBudgetLine(tmpDir);
    assert.equal(budgetLines.length, 1, `expected one Budget line, got ${budgetLines.length}`);
    assert.equal(budgetLines[0], 'Budget: $2,500 max test');
  });

  test('repeated state advance-plan stays size-bounded with dollar amounts', () => {
    seedState(tmpDir, '1 of 20');
    const statePath = path.join(tmpDir, '.planning', 'STATE.md');
    let stabilizedSize = null;
    for (let i = 0; i < 8; i += 1) {
      const result = runGsdTools(['state', 'advance-plan'], tmpDir);
      assert.equal(result.success, true, `iteration ${i + 1} failed: ${result.error || result.output}`);
      if (i === 0) stabilizedSize = fs.statSync(statePath).size;
    }

    const endSize = fs.statSync(statePath).size;
    const growth = endSize / stabilizedSize;
    assert.ok(growth <= 1.5, `expected <=1.5x growth after first write, got ${growth.toFixed(2)}x (${stabilizedSize} -> ${endSize})`);
  });
});
