/**
 * Structural validation tests for SME post-execution refresh and staleness pre-flight check.
 *
 * Tests verify static structure of execute-phase.md and plan-phase.md --
 * not runtime behavior. All tests read files from the repo root using absolute paths.
 *
 * Requirements covered:
 *   REFRESH-01 -- After successful phase execution, affected SME documents are refreshed
 *                 via gsd-sme-creator in UPDATE MODE (process detection step)
 *   REFRESH-02 -- gsd-sme-creator is spawned in refresh mode (UPDATE MODE prompt)
 *   REFRESH-03 -- Updated SME documents are committed as the final step before offer_next
 *   REFRESH-04 -- When planning a phase, the SME audit gate warns if matched SMEs have
 *                 a last_analyzed_commit behind current HEAD (staleness pre-flight check)
 */
'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const EXECUTE_PHASE = path.join(ROOT, 'get-shit-done', 'workflows', 'execute-phase.md');
const PLAN_PHASE = path.join(ROOT, 'get-shit-done', 'workflows', 'plan-phase.md');

describe('REFRESH-01: post-execution SME process detection', () => {
  test('execute-phase.md contains sme_refresh step', () => {
    const content = fs.readFileSync(EXECUTE_PHASE, 'utf-8');
    assert.ok(content.includes('sme_refresh'),
      'execute-phase.md must contain an sme_refresh step');
  });

  test('sme_refresh step calls sme.detect-processes', () => {
    const content = fs.readFileSync(EXECUTE_PHASE, 'utf-8');
    assert.ok(content.includes('sme.detect-processes'),
      'sme_refresh step must call sme.detect-processes to find affected processes');
  });

  test('sme_refresh step checks use_sme_agents config flag', () => {
    const content = fs.readFileSync(EXECUTE_PHASE, 'utf-8');
    // Check within sme_refresh section only (from first occurrence of sme_refresh to end)
    const smeRefreshIdx = content.indexOf('sme_refresh');
    assert.ok(smeRefreshIdx > -1, 'execute-phase.md must contain sme_refresh');
    const refreshSection = content.substring(smeRefreshIdx);
    assert.ok(refreshSection.includes('use_sme_agents'),
      'sme_refresh step must check use_sme_agents config flag before running');
  });

  test('sme_refresh step positioned AFTER update_project_md', () => {
    const content = fs.readFileSync(EXECUTE_PHASE, 'utf-8');
    const updateProjIdx = content.indexOf('update_project_md');
    const smeRefreshIdx = content.indexOf('sme_refresh');
    assert.ok(updateProjIdx > -1, 'execute-phase.md must contain update_project_md');
    assert.ok(smeRefreshIdx > -1, 'execute-phase.md must contain sme_refresh');
    assert.ok(updateProjIdx < smeRefreshIdx,
      'sme_refresh step must appear AFTER update_project_md in execute-phase.md');
  });

  test('sme_refresh step positioned BEFORE offer_next', () => {
    const content = fs.readFileSync(EXECUTE_PHASE, 'utf-8');
    // Use quoted step name attributes to avoid false matches on prose mentions
    const smeRefreshIdx = content.indexOf('"sme_refresh"');
    const offerNextIdx = content.indexOf('"offer_next"');
    assert.ok(smeRefreshIdx > -1, 'execute-phase.md must contain step name="sme_refresh"');
    assert.ok(offerNextIdx > -1, 'execute-phase.md must contain step name="offer_next"');
    assert.ok(smeRefreshIdx < offerNextIdx,
      'sme_refresh step must appear BEFORE offer_next in execute-phase.md');
  });
});

describe('REFRESH-02: gsd-sme-creator spawned in refresh mode', () => {
  test('sme_refresh step references gsd-sme-creator', () => {
    const content = fs.readFileSync(EXECUTE_PHASE, 'utf-8');
    assert.ok(content.includes('gsd-sme-creator'),
      'sme_refresh step must spawn gsd-sme-creator for affected processes');
  });

  test('sme_refresh step uses UPDATE MODE', () => {
    const content = fs.readFileSync(EXECUTE_PHASE, 'utf-8');
    assert.ok(content.includes('UPDATE MODE'),
      'sme_refresh step must pass UPDATE MODE in the creator prompt');
  });
});

describe('REFRESH-03: updated SME documents committed', () => {
  test('sme_refresh step commits files from .planning/smes/', () => {
    const content = fs.readFileSync(EXECUTE_PHASE, 'utf-8');
    const refreshStart = content.indexOf('sme_refresh');
    const offerNextStart = content.indexOf('offer_next');
    assert.ok(refreshStart > -1, 'execute-phase.md must contain sme_refresh section');
    const refreshSection = content.substring(refreshStart, offerNextStart > refreshStart ? offerNextStart : undefined);
    assert.ok(refreshSection.includes('.planning/smes') || refreshSection.includes('planning/smes'),
      'sme_refresh step must commit files from .planning/smes/');
  });
});

describe('REFRESH-04: staleness pre-flight check in plan-phase gate', () => {
  test('plan-phase.md step 12.6 checks last_analyzed_commit against HEAD', () => {
    const content = fs.readFileSync(PLAN_PHASE, 'utf-8');
    assert.ok(content.includes('last_analyzed_commit'),
      'plan-phase.md step 12.6 must check last_analyzed_commit for staleness');
  });

  test('plan-phase.md step 12.6 compares against current HEAD', () => {
    const content = fs.readFileSync(PLAN_PHASE, 'utf-8');
    assert.ok(content.includes('rev-parse HEAD') || content.includes('CURRENT_HEAD'),
      'plan-phase.md step 12.6 must compare last_analyzed_commit to current HEAD');
  });

  test('staleness check is warning only (not a blocker)', () => {
    const content = fs.readFileSync(PLAN_PHASE, 'utf-8');
    const smeGateIdx = content.indexOf('SME Audit Gate');
    const step13Idx = content.indexOf('## 13');
    assert.ok(smeGateIdx > -1, 'plan-phase.md must contain "SME Audit Gate" section');
    assert.ok(step13Idx > smeGateIdx, '"## 13" must appear after "SME Audit Gate"');
    const gateSection = content.substring(smeGateIdx, step13Idx);
    assert.ok(
      gateSection.includes('stale') || gateSection.includes('Stale'),
      'plan-phase.md SME Audit Gate section must mention stale SME documents (staleness check is advisory only)'
    );
  });
});
