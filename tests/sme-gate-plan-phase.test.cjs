/**
 * Structural validation tests for Phase 6 SME Audit Gate in plan-phase workflow.
 *
 * Tests verify static structure of plan-phase.md and commands/gsd/plan-phase.md —
 * not runtime behavior. All tests read files from the repo root using absolute paths.
 *
 * Requirements covered:
 *   GATE-01 — Step 12.6 SME audit gate exists after plan-bounce (12.5), before requirements coverage (13)
 *   GATE-02 — Gate calls sme.detect-processes
 *   GATE-03 — Gate spawns gsd-sme-auditor and fetches sme.context-block per process
 *   GATE-04 — Soft mode: warning + proceed path exists
 *   GATE-05 — Strict mode: halt + AskUserQuestion path exists
 *   GATE-06 — --acknowledge-sme-risk flag in argument-hint + step 2 + ACKNOWLEDGE_SME_RISK variable
 *   GATE-07 — No SME found -> warn + /gsd-create-sme -> never block
 *   GATE-08 — SME context blocks injected before PLAN.md path in auditor prompt
 *   CONFIG-04 — No SME documents -> warning + /gsd-create-sme -> never block
 */
'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PLAN_PHASE = path.join(ROOT, 'get-shit-done', 'workflows', 'plan-phase.md');
const PLAN_PHASE_CMD = path.join(ROOT, 'commands', 'gsd', 'plan-phase.md');
const GATES_REF = path.join(ROOT, 'get-shit-done', 'references', 'gates.md');

describe('GATE-01: SME Audit Gate step exists and is positioned correctly', () => {
  test('plan-phase.md contains an SME Audit Gate heading', () => {
    const content = fs.readFileSync(PLAN_PHASE, 'utf-8');
    assert.ok(
      content.includes('SME Audit Gate'),
      'plan-phase.md must contain an "SME Audit Gate" heading'
    );
  });

  test('SME Audit Gate appears AFTER Plan Bounce (step 12.5) in file position', () => {
    const content = fs.readFileSync(PLAN_PHASE, 'utf-8');
    const bounceIdx = content.indexOf('Plan Bounce');
    const smeGateIdx = content.indexOf('SME Audit Gate');
    assert.ok(bounceIdx > -1, 'plan-phase.md must contain "Plan Bounce" step');
    assert.ok(smeGateIdx > -1, 'plan-phase.md must contain "SME Audit Gate" step');
    assert.ok(
      bounceIdx < smeGateIdx,
      'SME Audit Gate must appear AFTER Plan Bounce in plan-phase.md'
    );
  });

  test('SME Audit Gate appears BEFORE Requirements Coverage Gate (step 13) in file position', () => {
    const content = fs.readFileSync(PLAN_PHASE, 'utf-8');
    const smeGateIdx = content.indexOf('SME Audit Gate');
    const reqCoverageIdx = content.indexOf('Requirements Coverage Gate');
    assert.ok(smeGateIdx > -1, 'plan-phase.md must contain "SME Audit Gate" step');
    assert.ok(reqCoverageIdx > -1, 'plan-phase.md must contain "Requirements Coverage Gate" step');
    assert.ok(
      smeGateIdx < reqCoverageIdx,
      'SME Audit Gate must appear BEFORE Requirements Coverage Gate in plan-phase.md'
    );
  });
});

describe('GATE-02: process detection via sme.detect-processes', () => {
  test('plan-phase.md contains the string "sme.detect-processes"', () => {
    const content = fs.readFileSync(PLAN_PHASE, 'utf-8');
    assert.ok(
      content.includes('sme.detect-processes'),
      'plan-phase.md must call sme.detect-processes in the SME Audit Gate step'
    );
  });
});

describe('GATE-03: auditor spawn and context block fetch', () => {
  test('plan-phase.md contains "gsd-sme-auditor" (auditor spawn reference)', () => {
    const content = fs.readFileSync(PLAN_PHASE, 'utf-8');
    assert.ok(
      content.includes('gsd-sme-auditor'),
      'plan-phase.md must reference gsd-sme-auditor in the SME Audit Gate step'
    );
  });

  test('plan-phase.md contains "sme.context-block" (context block fetch per process)', () => {
    const content = fs.readFileSync(PLAN_PHASE, 'utf-8');
    assert.ok(
      content.includes('sme.context-block'),
      'plan-phase.md must call sme.context-block in the SME Audit Gate step'
    );
  });
});

describe('GATE-04: soft mode warning + proceed path', () => {
  test('SME gate section contains "soft" and "proceed" (soft mode path)', () => {
    const content = fs.readFileSync(PLAN_PHASE, 'utf-8');
    const smeStart = content.indexOf('SME Audit Gate');
    const step13Start = content.indexOf('## 13');
    assert.ok(smeStart > -1, 'plan-phase.md must contain "SME Audit Gate"');
    assert.ok(step13Start > smeStart, '"## 13" must appear after "SME Audit Gate"');
    const gateSection = content.substring(smeStart, step13Start);
    assert.ok(
      gateSection.includes('soft'),
      'SME gate section must mention "soft" mode'
    );
    assert.ok(
      gateSection.includes('proceed'),
      'SME gate section must mention "proceed" for soft mode path'
    );
  });
});

describe('GATE-05: strict mode halt + AskUserQuestion', () => {
  test('SME gate section contains "strict" and "AskUserQuestion" (strict mode halt path)', () => {
    const content = fs.readFileSync(PLAN_PHASE, 'utf-8');
    const smeStart = content.indexOf('SME Audit Gate');
    const step13Start = content.indexOf('## 13');
    assert.ok(smeStart > -1, 'plan-phase.md must contain "SME Audit Gate"');
    const gateSection = content.substring(smeStart, step13Start);
    assert.ok(
      gateSection.includes('strict'),
      'SME gate section must mention "strict" mode'
    );
    assert.ok(
      gateSection.includes('AskUserQuestion'),
      'SME gate section must include AskUserQuestion for strict mode halt'
    );
  });
});

describe('GATE-06: --acknowledge-sme-risk flag', () => {
  test('commands/gsd/plan-phase.md argument-hint contains "--acknowledge-sme-risk"', () => {
    const content = fs.readFileSync(PLAN_PHASE_CMD, 'utf-8');
    assert.ok(
      content.includes('--acknowledge-sme-risk'),
      'commands/gsd/plan-phase.md argument-hint must include --acknowledge-sme-risk'
    );
  });

  test('plan-phase.md contains "--acknowledge-sme-risk" (parsed in step 2)', () => {
    const content = fs.readFileSync(PLAN_PHASE, 'utf-8');
    assert.ok(
      content.includes('--acknowledge-sme-risk'),
      'plan-phase.md must parse --acknowledge-sme-risk flag in step 2'
    );
  });

  test('plan-phase.md contains "ACKNOWLEDGE_SME_RISK" (variable set from flag)', () => {
    const content = fs.readFileSync(PLAN_PHASE, 'utf-8');
    assert.ok(
      content.includes('ACKNOWLEDGE_SME_RISK'),
      'plan-phase.md must set ACKNOWLEDGE_SME_RISK variable when --acknowledge-sme-risk is present'
    );
  });
});

describe('GATE-07: no SME found warning with /gsd-create-sme instruction', () => {
  test('SME gate section contains "/gsd-create-sme" instruction when no SME found', () => {
    const content = fs.readFileSync(PLAN_PHASE, 'utf-8');
    const smeStart = content.indexOf('SME Audit Gate');
    const step13Start = content.indexOf('## 13');
    assert.ok(smeStart > -1, 'plan-phase.md must contain "SME Audit Gate"');
    const gateSection = content.substring(smeStart, step13Start);
    assert.ok(
      gateSection.includes('/gsd-create-sme'),
      'SME gate section must include /gsd-create-sme instruction when no SME is found'
    );
  });
});

describe('GATE-08: SME context blocks injected before PLAN.md path in auditor prompt', () => {
  test('SME_CONTEXT_BLOCKS appears before "PLAN.md path:" in plan-phase.md', () => {
    const content = fs.readFileSync(PLAN_PHASE, 'utf-8');
    const smeCtxIdx = content.indexOf('SME_CONTEXT_BLOCKS');
    const planPathIdx = content.indexOf('PLAN.md path:');
    assert.ok(smeCtxIdx > -1, 'plan-phase.md must reference SME_CONTEXT_BLOCKS in the auditor prompt');
    assert.ok(planPathIdx > -1, 'plan-phase.md must include "PLAN.md path:" in the auditor prompt');
    assert.ok(
      smeCtxIdx < planPathIdx,
      'SME_CONTEXT_BLOCKS must appear before "PLAN.md path:" to prevent context window saturation (GATE-08)'
    );
  });
});

describe('CONFIG-04: no SME documents warning', () => {
  test('SME gate section contains "sme.list" (check for existing documents)', () => {
    const content = fs.readFileSync(PLAN_PHASE, 'utf-8');
    const smeStart = content.indexOf('SME Audit Gate');
    const step13Start = content.indexOf('## 13');
    assert.ok(smeStart > -1, 'plan-phase.md must contain "SME Audit Gate"');
    const gateSection = content.substring(smeStart, step13Start);
    assert.ok(
      gateSection.includes('sme.list'),
      'SME gate section must call sme.list to check if any SME documents exist (CONFIG-04)'
    );
  });

  test('plan-phase.md contains "no SME documents" warning text', () => {
    const content = fs.readFileSync(PLAN_PHASE, 'utf-8');
    assert.ok(
      content.toLowerCase().includes('no sme documents'),
      'plan-phase.md must include warning text about no SME documents existing yet (CONFIG-04)'
    );
  });
});

describe('Gates.md: Gate Matrix row for SME audit gate', () => {
  test('gates.md Gate Matrix contains a row with "SME" and "plan-phase"', () => {
    const content = fs.readFileSync(GATES_REF, 'utf-8');
    const matrixStart = content.indexOf('## Gate Matrix');
    assert.ok(matrixStart > -1, 'gates.md must contain a "## Gate Matrix" section');
    const matrixSection = content.substring(matrixStart);
    assert.ok(
      matrixSection.includes('SME') && matrixSection.includes('plan-phase'),
      'gates.md Gate Matrix must contain a row with "SME" and "plan-phase"'
    );
  });
});
