/**
 * Structural validation tests for SME discuss-phase integration.
 *
 * Tests verify static structure of discuss-phase.md, sme-step.md, and
 * templates/context.md — not runtime behavior. All tests read files from
 * the repo root using absolute paths.
 *
 * Requirements covered:
 *   DISCUSS-01 — discuss-phase checks for active_smes in STATE.md before planning
 *   DISCUSS-02 — auditor generates probing questions from SME context (probing mode, not plan-audit)
 *   DISCUSS-03 — sme_context block appended to CONTEXT.md
 */
'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DISCUSS_PHASE = path.join(ROOT, 'get-shit-done', 'workflows', 'discuss-phase.md');
const SME_STEP = path.join(ROOT, 'get-shit-done', 'workflows', 'discuss-phase', 'sme-step.md');
const CONTEXT_TPL = path.join(ROOT, 'get-shit-done', 'workflows', 'discuss-phase', 'templates', 'context.md');

describe('DISCUSS-01: discuss-phase checks for active_smes in STATE.md', () => {
  test('sme-step.md exists at get-shit-done/workflows/discuss-phase/sme-step.md', () => {
    assert.ok(
      fs.existsSync(SME_STEP),
      'sme-step.md must exist at get-shit-done/workflows/discuss-phase/sme-step.md'
    );
  });

  test('sme-step.md uses frontmatter.get to read STATE.md (reads active_smes from frontmatter)', () => {
    const content = fs.readFileSync(SME_STEP, 'utf-8');
    assert.ok(
      content.includes('frontmatter.get') && content.includes('STATE.md'),
      'sme-step.md must contain both "frontmatter.get" and "STATE.md" to read active_smes from STATE.md frontmatter'
    );
  });

  test('sme-step.md checks use_sme_agents config flag', () => {
    const content = fs.readFileSync(SME_STEP, 'utf-8');
    assert.ok(
      content.includes('use_sme_agents'),
      'sme-step.md must check use_sme_agents config flag before running'
    );
  });

  test('discuss-phase.md references sme-step.md (lazy-load dispatch)', () => {
    const content = fs.readFileSync(DISCUSS_PHASE, 'utf-8');
    assert.ok(
      content.includes('sme-step.md'),
      'discuss-phase.md must contain a reference to "sme-step.md" for lazy-load dispatch'
    );
  });

  test('SME step reference appears AFTER cross_reference_todos in discuss-phase.md file position', () => {
    const content = fs.readFileSync(DISCUSS_PHASE, 'utf-8');
    const crossRefIdx = content.indexOf('cross_reference_todos');
    const smeStepIdx = content.indexOf('sme-step.md');
    assert.ok(
      crossRefIdx > -1,
      'discuss-phase.md must contain "cross_reference_todos"'
    );
    assert.ok(
      smeStepIdx > -1,
      'discuss-phase.md must contain "sme-step.md"'
    );
    assert.ok(
      crossRefIdx < smeStepIdx,
      'sme-step.md reference must appear AFTER cross_reference_todos in discuss-phase.md (correct step ordering)'
    );
  });
});

describe('DISCUSS-02: auditor generates probing questions from SME context', () => {
  test('sme-step.md calls sme.context-block per active SME', () => {
    const content = fs.readFileSync(SME_STEP, 'utf-8');
    assert.ok(
      content.includes('sme.context-block'),
      'sme-step.md must call sme.context-block to fetch SME context per active SME process'
    );
  });

  test('sme-step.md spawns gsd-sme-auditor', () => {
    const content = fs.readFileSync(SME_STEP, 'utf-8');
    assert.ok(
      content.includes('gsd-sme-auditor'),
      'sme-step.md must reference gsd-sme-auditor to spawn the auditor for probing questions'
    );
  });

  test('sme-step.md does NOT contain SME_APPROVED (probing mode only, not plan-audit mode)', () => {
    const content = fs.readFileSync(SME_STEP, 'utf-8');
    assert.ok(
      !content.includes('SME_APPROVED'),
      'sme-step.md must NOT contain "SME_APPROVED" — this is probing mode, not plan-audit mode'
    );
  });

  test('sme-step.md does NOT contain SME_CONCERNS (probing mode only, not plan-audit mode)', () => {
    const content = fs.readFileSync(SME_STEP, 'utf-8');
    assert.ok(
      !content.includes('SME_CONCERNS'),
      'sme-step.md must NOT contain "SME_CONCERNS" — this is probing mode, not plan-audit mode'
    );
  });
});

describe('DISCUSS-03: sme_context block appended to CONTEXT.md', () => {
  test('context.md template includes sme_context section', () => {
    const content = fs.readFileSync(CONTEXT_TPL, 'utf-8');
    assert.ok(
      content.includes('sme_context'),
      'context.md template must contain "sme_context" (conditional section for SME probing questions)'
    );
  });

  test('context.md conditional sections documentation lists sme_context bullet', () => {
    const content = fs.readFileSync(CONTEXT_TPL, 'utf-8');
    const condSectStart = content.indexOf('## Conditional sections');
    const templateBodyStart = content.indexOf('## Template body');
    assert.ok(
      condSectStart > -1,
      'context.md must contain a "## Conditional sections" section'
    );
    assert.ok(
      templateBodyStart > condSectStart,
      '"## Template body" must appear after "## Conditional sections"'
    );
    const condSection = content.substring(condSectStart, templateBodyStart);
    assert.ok(
      condSection.includes('sme_context'),
      '"## Conditional sections" documentation must include a "sme_context" bullet'
    );
  });

  test('sme-step.md references sme_risk_areas or sme_context output variable', () => {
    const content = fs.readFileSync(SME_STEP, 'utf-8');
    assert.ok(
      content.includes('sme_risk_areas') || content.includes('sme_context'),
      'sme-step.md must reference "sme_risk_areas" or "sme_context" as the output variable fed to write_context'
    );
  });
});
