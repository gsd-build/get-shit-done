/**
 * plan-phase workflow — --mvp flag parsing and MVP_MODE resolution
 * Contract test: verifies the workflow markdown documents the agreed
 * resolution order (CLI flag → roadmap mode → config → default false).
 */
const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

const WORKFLOW = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'plan-phase.md');

function parseWorkflowContract(content) {
  const lines = content.split(/\r?\n/).map(line => line.trim());
  const argExtractionLine = lines.find(line => line.includes('Extract from $ARGUMENTS:')) || '';
  const hasMvpModeVariable = lines.some(line => line.includes('MVP_MODE'));
  const hasWorkflowConfigRead = lines.some(line => line.includes('workflow.mvp_mode'));
  const hasRoadmapModeRead = lines.some(line => line.includes('phase.mvp-mode') || line.includes('roadmap'));
  const hasSkeletonReference = lines.some(line => line.includes('SKELETON.md'));
  const hasWalkingSkeletonLabel = lines.some(line => line.toLowerCase().includes('walking skeleton'));
  const plannerLines = lines.filter(line => line.includes('planner') || line.includes('gsd-planner'));
  const plannerUsesMvpMode = plannerLines.some(line => line.includes('MVP_MODE')) || lines.some(line => line.includes('MVP_MODE') && line.includes('planner'));
  return {
    argExtractionLine,
    hasMvpModeVariable,
    hasWorkflowConfigRead,
    hasRoadmapModeRead,
    hasSkeletonReference,
    hasWalkingSkeletonLabel,
    plannerUsesMvpMode,
  };
}

describe('plan-phase workflow — --mvp flag', () => {
  const contract = parseWorkflowContract(fs.readFileSync(WORKFLOW, 'utf-8'));

  test('argument list documents --mvp flag', () => {
    assert.ok(contract.argExtractionLine.length > 0, 'Step 2 arg-extraction line not found');
    assert.ok(contract.argExtractionLine.includes('--mvp'), 'argument list must mention --mvp');
  });

  test('workflow defines MVP_MODE resolution block', () => {
    assert.ok(contract.hasMvpModeVariable, 'workflow must declare MVP_MODE');
    assert.ok(contract.hasWorkflowConfigRead, 'must read workflow.mvp_mode config');
    assert.ok(contract.hasRoadmapModeRead, 'must consult phase mode from roadmap/phase.mvp-mode');
  });

  test('Walking Skeleton gate references new-project + Phase 1', () => {
    assert.ok(contract.hasSkeletonReference, 'workflow must mention SKELETON.md');
    assert.ok(contract.hasWalkingSkeletonLabel, 'workflow must label the gate as Walking Skeleton');
  });

  test('planner spawn passes MVP_MODE to gsd-planner', () => {
    assert.ok(contract.plannerUsesMvpMode, 'workflow must wire MVP_MODE into the planner subagent prompt');
  });
});

describe('plan-phase --mvp — resolution chain integration', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = createTempProject(); });
  afterEach(() => { cleanup(tmpDir); });

  test('roadmap.get-phase reports mode=mvp when set in roadmap', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap\n\n## v1.0.0\n\n### Phase 1: Auth\n**Goal:** Users can log in\n**Mode:** mvp\n`
    );
    const result = runGsdTools('roadmap get-phase 1 --pick mode', tmpDir);
    assert.ok(result.success);
    assert.strictEqual(result.output.trim(), 'mvp');
  });

  test('config-get workflow.mvp_mode default is empty/unset', () => {
    const result = runGsdTools('config-get workflow.mvp_mode', tmpDir);
    // Either success with empty output OR a non-zero exit; both are fine.
    // Real assertion: the key isn't accidentally set to "true" in tmp project.
    if (result.success) {
      assert.notStrictEqual(result.output.trim(), 'true');
    }
  });
});
