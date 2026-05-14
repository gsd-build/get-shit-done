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

function parseStateFile(tmpDir) {
  const content = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf8');
  const sections = {};
  const keyCountsBySection = {};
  let currentSection = '__root__';
  sections[currentSection] = {};
  keyCountsBySection[currentSection] = {};

  for (const rawLine of content.split(/\r?\n/u)) {
    const headingMatch = /^##\s+(.+)$/u.exec(rawLine);
    if (headingMatch) {
      currentSection = headingMatch[1].trim();
      sections[currentSection] = sections[currentSection] || {};
      keyCountsBySection[currentSection] = keyCountsBySection[currentSection] || {};
      continue;
    }

    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    const boldFieldMatch = /^\*\*([^*]+)\*\*:\s*(.*)$/u.exec(trimmed);
    if (boldFieldMatch) {
      const key = boldFieldMatch[1].trim();
      const value = boldFieldMatch[2].trim();
      sections[currentSection][key] = value;
      keyCountsBySection[currentSection][key] = (keyCountsBySection[currentSection][key] || 0) + 1;
      continue;
    }

    const colonIndex = trimmed.indexOf(':');
    if (colonIndex <= 0) continue;

    const key = trimmed.slice(0, colonIndex).trim();
    const value = trimmed.slice(colonIndex + 1).trim();
    sections[currentSection][key] = value;
    keyCountsBySection[currentSection][key] = (keyCountsBySection[currentSection][key] || 0) + 1;
  }

  return { content, sections, keyCountsBySection };
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

    const parsed = parseStateFile(tmpDir);
    const currentPosition = parsed.sections['Current Position'] || {};
    assert.equal(currentPosition.Budget, '$2,500 max test');
    assert.equal((parsed.keyCountsBySection['Current Position'] || {}).Budget, 1);
  });

  test('state begin-phase keeps Current Position dollar amount literal', () => {
    seedState(tmpDir);
    const result = runGsdTools(['state', 'begin-phase', '--phase', '1', '--name', 'setup', '--plans', '2'], tmpDir);
    assert.equal(result.success, true, `state begin-phase failed: ${result.error || result.output}`);

    const parsed = parseStateFile(tmpDir);
    const currentPosition = parsed.sections['Current Position'] || {};
    assert.equal(currentPosition.Budget, '$2,500 max test');
    assert.equal((parsed.keyCountsBySection['Current Position'] || {}).Budget, 1);
  });

  test('state complete-phase keeps Current Position dollar amount literal', () => {
    seedState(tmpDir);
    const result = runGsdTools(['state', 'complete-phase', '--phase', '1'], tmpDir);
    assert.equal(result.success, true, `state complete-phase failed: ${result.error || result.output}`);

    const parsed = parseStateFile(tmpDir);
    const currentPosition = parsed.sections['Current Position'] || {};
    assert.equal(currentPosition.Budget, '$2,500 max test');
    assert.equal((parsed.keyCountsBySection['Current Position'] || {}).Budget, 1);
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
