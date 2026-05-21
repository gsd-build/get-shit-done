/**
 * plan-phase workflow — --mvp flag parsing and MVP_MODE resolution
 * Contract test: verifies the workflow markdown documents the agreed
 * resolution order (CLI flag → roadmap mode → config → default false).
 *
 * Retrofitted from HIDDEN-GREP (parseWorkflowContract) to workflow.parse IR
 * per #2826 test-rigor audit. Counter-tests added for Contract 6.
 */
const { test, describe, before, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

const WORKFLOW = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'plan-phase.md');
const GSD_SDK = path.join(__dirname, '..', 'bin', 'gsd-sdk.js');

/**
 * Call `gsd-sdk query workflow.parse <filePath> [--terms=...]` and return the
 * parsed JSON data object. Uses execFileSync to bypass shell quoting issues.
 */
function parseWorkflow(filePath, terms) {
  const args = ['workflow.parse', filePath];
  if (terms && terms.length > 0) {
    args.push(`--terms=${terms.join(',')}`);
  }
  const out = execFileSync(process.execPath, [GSD_SDK, 'query', ...args, '--json'], {
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  return JSON.parse(out);
}

/**
 * Write a minimal workflow markdown to a temp file and return its path.
 * Used for counter-tests to demonstrate ABSENCE of structure in a
 * workflow that does not implement the MVP pattern.
 */
function writeSyntheticWorkflow(content) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-wfparse-'));
  const filePath = path.join(dir, 'synthetic.md');
  fs.writeFileSync(filePath, content, 'utf-8');
  return { filePath, dir };
}

describe('plan-phase workflow — --mvp flag', () => {
  let ir;

  // Parse once; all sub-tests share the result.
  before(() => {
    ir = parseWorkflow(WORKFLOW, [
      '--mvp',
      'MVP_MODE',
      'workflow.mvp_mode',
      'phase.mvp-mode',
      'SKELETON.md',
      'Walking Skeleton',
    ]);
  });

  test('argument list documents --mvp flag', () => {
    // IR field: terms — '--mvp' must appear in the workflow source.
    const mvpTerm = ir.terms.find(t => t.term === '--mvp');
    assert.ok(mvpTerm, 'terms entry for --mvp not found');
    assert.ok(mvpTerm.count > 0, 'workflow must mention --mvp flag');

    // Also verify via bash_assignments: MVP_FLAG_ARG is the parsed variable.
    const mvpFlagArg = ir.bash_assignments.find(a => a.var === 'MVP_FLAG_ARG');
    assert.ok(mvpFlagArg, 'workflow must declare MVP_FLAG_ARG bash assignment');
  });

  test('workflow defines MVP_MODE resolution block', () => {
    // hasMvpModeVariable → bash_assignments must contain MVP_MODE
    const mvpModeAssign = ir.bash_assignments.find(a => a.var === 'MVP_MODE');
    assert.ok(mvpModeAssign, 'workflow must declare MVP_MODE bash assignment');

    // hasWorkflowConfigRead → sdk_calls must include config-get workflow.mvp_mode
    // OR bash_assignments for MVP_MODE_CFG which reads workflow.mvp_mode
    const configTerm = ir.terms.find(t => t.term === 'workflow.mvp_mode');
    assert.ok(configTerm && configTerm.count > 0, 'workflow must read workflow.mvp_mode config key');

    // hasRoadmapModeRead → sdk_calls must include phase.mvp-mode (which reads phase.mvp-mode from roadmap)
    const roadmapTerm = ir.terms.find(t => t.term === 'phase.mvp-mode');
    assert.ok(roadmapTerm && roadmapTerm.count > 0, 'workflow must consult phase mode from roadmap via phase.mvp-mode');
  });

  test('Walking Skeleton gate references SKELETON.md', () => {
    // hasSkeletonReference → terms 'SKELETON.md' present
    const skelTerm = ir.terms.find(t => t.term === 'SKELETON.md');
    assert.ok(skelTerm && skelTerm.count > 0, 'workflow must mention SKELETON.md');

    // hasWalkingSkeletonLabel → terms 'Walking Skeleton' present
    const wsTerm = ir.terms.find(t => t.term === 'Walking Skeleton');
    assert.ok(wsTerm && wsTerm.count > 0, 'workflow must label the gate as Walking Skeleton');
  });

  test('planner spawn passes MVP_MODE to gsd-planner', () => {
    // plannerUsesMvpMode → bash_assignments for AGENT_SKILLS_PLANNER references gsd-planner
    // AND bash_assignments for MVP_MODE exists (so MVP_MODE is wired into the planner subagent env)
    const plannerSkillAssign = ir.bash_assignments.find(
      a => a.var === 'AGENT_SKILLS_PLANNER' && a.value_excerpt.includes('gsd-planner')
    );
    assert.ok(plannerSkillAssign, 'workflow must assign AGENT_SKILLS_PLANNER from gsd-planner');

    const mvpModeAssign = ir.bash_assignments.find(a => a.var === 'MVP_MODE');
    assert.ok(mvpModeAssign, 'workflow must wire MVP_MODE for use by planner subagent');
  });

  // ── Counter-tests (Contract 6 — negative-space coverage) ─────────────────

  test('COUNTER: synthetic workflow without --mvp has no MVP_FLAG_ARG assignment', () => {
    const { filePath, dir } = writeSyntheticWorkflow(
      '## 1. Initialize\n\nThis workflow does not implement MVP mode.\n'
    );
    try {
      const synIr = parseWorkflow(filePath, ['--mvp', 'MVP_MODE', 'workflow.mvp_mode']);
      const mvpFlagArg = synIr.bash_assignments.find(a => a.var === 'MVP_FLAG_ARG');
      assert.ok(!mvpFlagArg, 'synthetic non-MVP workflow must NOT have MVP_FLAG_ARG assignment');

      const mvpMode = synIr.bash_assignments.find(a => a.var === 'MVP_MODE');
      assert.ok(!mvpMode, 'synthetic non-MVP workflow must NOT have MVP_MODE assignment');

      const mvpTerm = synIr.terms.find(t => t.term === '--mvp');
      assert.strictEqual(mvpTerm.count, 0, 'synthetic non-MVP workflow must not mention --mvp');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
    }
  });

  test('COUNTER: synthetic workflow without Walking Skeleton has no SKELETON.md reference', () => {
    const { filePath, dir } = writeSyntheticWorkflow(
      '## 1. Initialize\n\nStandard workflow. No skeleton gate here.\n'
    );
    try {
      const synIr = parseWorkflow(filePath, ['SKELETON.md', 'Walking Skeleton']);
      const skelTerm = synIr.terms.find(t => t.term === 'SKELETON.md');
      assert.strictEqual(skelTerm.count, 0, 'synthetic workflow must not mention SKELETON.md');
      const wsTerm = synIr.terms.find(t => t.term === 'Walking Skeleton');
      assert.strictEqual(wsTerm.count, 0, 'synthetic workflow must not mention Walking Skeleton');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
    }
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
    assert.ok(result.success, `expected gsd-tools to succeed: ${result.error || result.stderr}`);
    assert.notStrictEqual(result.output.trim(), 'true');
  });
});
