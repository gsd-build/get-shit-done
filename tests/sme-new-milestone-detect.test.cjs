/**
 * Structural validation tests for SME new-milestone process detection.
 *
 * Tests verify static structure of new-milestone.md and new-milestone/sme-step.md
 * -- not runtime behavior. All tests read files from the repo root using absolute paths.
 *
 * Requirements covered:
 *   DETECT-01 -- new-milestone scans for processes the milestone touches
 *   DETECT-02 -- check for existing SMEs in .planning/smes/
 *   DETECT-03 -- existing SMEs surfaced for user confirmation
 *   DETECT-04 -- missing SMEs offered per-process creation
 *   DETECT-05 -- selected SMEs queued in STATE.md under milestone.active_smes
 */
'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const NEW_MILESTONE = path.join(ROOT, 'get-shit-done', 'workflows', 'new-milestone.md');
const SME_STEP = path.join(ROOT, 'get-shit-done', 'workflows', 'new-milestone', 'sme-step.md');

describe('DETECT-01: new-milestone scans for processes milestone touches', () => {
  test('new-milestone.md references sme-step.md (lazy-load dispatch)', () => {
    const content = fs.readFileSync(NEW_MILESTONE, 'utf-8');
    assert.ok(content.includes('new-milestone/sme-step.md') || content.includes('new-milestone\\sme-step.md'),
      'new-milestone.md must dispatch to new-milestone/sme-step.md for SME detection');
  });
  test('sme-step.md calls sme.detect-processes', () => {
    const content = fs.readFileSync(SME_STEP, 'utf-8');
    assert.ok(content.includes('sme.detect-processes'),
      'sme-step.md must call sme.detect-processes to identify milestone-relevant processes');
  });
  test('sme-step.md checks use_sme_agents config flag', () => {
    const content = fs.readFileSync(SME_STEP, 'utf-8');
    assert.ok(content.includes('use_sme_agents'),
      'sme-step.md must check use_sme_agents config flag before running');
  });
});

describe('DETECT-02: check for existing SMEs in .planning/smes/', () => {
  test('sme-step.md calls sme.list to check for existing SME documents', () => {
    const content = fs.readFileSync(SME_STEP, 'utf-8');
    assert.ok(content.includes('sme.list'),
      'sme-step.md must call sme.list to check which SMEs already exist');
  });
});

describe('DETECT-03: existing SMEs surfaced for user confirmation', () => {
  test('sme-step.md asks user to confirm which SMEs to activate', () => {
    const content = fs.readFileSync(SME_STEP, 'utf-8');
    assert.ok(content.includes('AskUserQuestion') || content.includes('multiSelect'),
      'sme-step.md must present AskUserQuestion for existing SME confirmation');
  });
});

describe('DETECT-04: missing SMEs offered per-process creation', () => {
  test('sme-step.md references gsd-sme-creator for missing processes', () => {
    const content = fs.readFileSync(SME_STEP, 'utf-8');
    assert.ok(content.includes('gsd-sme-creator'),
      'sme-step.md must offer to spawn gsd-sme-creator for processes without SMEs');
  });
});

describe('DETECT-05: selected SMEs queued in STATE.md under milestone.active_smes', () => {
  test('sme-step.md uses frontmatter.merge to write active_smes (NOT state.update/state.patch)', () => {
    const content = fs.readFileSync(SME_STEP, 'utf-8');
    assert.ok(content.includes('frontmatter.merge'),
      'sme-step.md must use frontmatter.merge to write milestone.active_smes to STATE.md');
    assert.ok(!content.includes('state.update') && !content.includes('state.patch'),
      'sme-step.md must NOT use state.update or state.patch (they erase custom frontmatter fields)');
  });
  test('sme-step.md writes active_smes key to STATE.md', () => {
    const content = fs.readFileSync(SME_STEP, 'utf-8');
    assert.ok(content.includes('active_smes'),
      'sme-step.md must reference active_smes in the write step');
  });
  test('sme-step.md targets .planning/STATE.md', () => {
    const content = fs.readFileSync(SME_STEP, 'utf-8');
    assert.ok(content.includes('STATE.md'),
      'sme-step.md must reference STATE.md as the write target');
  });
});

describe('Ordering constraint: SME step after state.milestone-switch', () => {
  test('SME step reference appears AFTER state.milestone-switch in new-milestone.md file position', () => {
    const content = fs.readFileSync(NEW_MILESTONE, 'utf-8');
    const switchIdx = content.indexOf('state.milestone-switch');
    const smeStepIdx = content.indexOf('new-milestone/sme-step.md');
    assert.ok(switchIdx > -1, 'new-milestone.md must contain "state.milestone-switch"');
    assert.ok(smeStepIdx > -1, 'new-milestone.md must contain "new-milestone/sme-step.md"');
    assert.ok(switchIdx < smeStepIdx,
      'SME step reference must appear AFTER state.milestone-switch in new-milestone.md (ordering constraint)');
  });
});
