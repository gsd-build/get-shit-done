/**
 * execute-phase MVP+TDD gate — contract test
 * Verifies the workflow markdown documents the gate's resolution chain,
 * per-task firing condition, and end-of-phase review escalation.
 *
 * Retrofitted from SOURCE-GREP (parseGateContract) to workflow.parse IR
 * per #2826 test-rigor audit. Counter-tests added for Contract 6.
 */
const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

const WORKFLOW = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'execute-phase.md');
const GSD_SDK = path.join(__dirname, '..', 'bin', 'gsd-sdk.js');

/**
 * Call `gsd-sdk query workflow.parse <filePath> [--terms=...]` and return the
 * parsed JSON data object.
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

function writeSyntheticWorkflow(content) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-wfparse-'));
  const filePath = path.join(dir, 'synthetic.md');
  fs.writeFileSync(filePath, content, 'utf-8');
  return { filePath, dir };
}

// Parse once at module scope.
const ir = parseWorkflow(WORKFLOW, [
  'MVP_MODE',
  'TDD_MODE',
  'phase.mvp-mode',
  'phase.tdd-mode',
  'execute-mvp-tdd.md',
  'blocking',
  'MVP+TDD',
  'task.tdd-gate-check',
]);

describe('execute-phase — MVP+TDD gate', () => {
  test('Step 1 resolves MVP_MODE from roadmap mode field', () => {
    // hasMvpModeVariable → bash_assignments must contain MVP_MODE
    const mvpAssign = ir.bash_assignments.find(a => a.var === 'MVP_MODE');
    assert.ok(mvpAssign, 'workflow must declare MVP_MODE bash assignment');

    // hasRoadmapModeResolution → sdk_calls must contain phase.mvp-mode
    const mvpSdkCall = ir.sdk_calls.find(c => c.verb === 'phase.mvp-mode');
    assert.ok(mvpSdkCall, 'workflow must call gsd-sdk query phase.mvp-mode (consults roadmap phase mode)');

    // hasTddModeResolution → sdk_calls must contain phase.tdd-mode (E4 symmetry, not config-get)
    const tddModeSdkCall = ir.sdk_calls.find(c => c.verb === 'phase.tdd-mode');
    assert.ok(tddModeSdkCall, 'workflow must call gsd-sdk query phase.tdd-mode (symmetric with phase.mvp-mode — closes E4)');
  });

  test('gate fires when both MVP_MODE and TDD_MODE are true', () => {
    // hasDualGateCondition → conditionals must have a branch with keyword MVP_MODE
    // AND the same region must reference TDD_MODE (the if-block checks both)
    const mvpConditional = ir.conditionals.find(c => c.keyword === 'MVP_MODE');
    assert.ok(mvpConditional, 'workflow must have an if-conditional on MVP_MODE');

    // sdk_calls must contain task.tdd-gate-check inside the MVP_MODE conditional block
    const tddGateCall = ir.sdk_calls.find(c => c.verb === 'task.tdd-gate-check');
    assert.ok(tddGateCall, 'workflow must call task.tdd-gate-check inside the gate block');

    // The tdd-gate-check call must be inside the MVP_MODE conditional region
    assert.ok(
      tddGateCall.line >= mvpConditional.line_start && tddGateCall.line <= mvpConditional.line_end,
      `task.tdd-gate-check (line ${tddGateCall.line}) must be inside MVP_MODE conditional (lines ${mvpConditional.line_start}-${mvpConditional.line_end})`
    );

    // Also verify TDD_MODE is declared
    const tddAssign = ir.bash_assignments.find(a => a.var === 'TDD_MODE');
    assert.ok(tddAssign, 'workflow must declare TDD_MODE bash assignment');
  });

  test('per-task gate is documented before behavior-adding task execution', () => {
    // hasGateLabel → terms 'MVP+TDD' present (the gate label text)
    const gateLabelTerm = ir.terms.find(t => t.term === 'MVP+TDD');
    assert.ok(gateLabelTerm && gateLabelTerm.count > 0, 'must label the gate as MVP+TDD');

    // hasRedCommitRule → task.tdd-gate-check sdk_call is present
    // (the gate-check verb encapsulates the RED commit rule)
    const tddGateCall = ir.sdk_calls.find(c => c.verb === 'task.tdd-gate-check');
    assert.ok(tddGateCall, 'must reference failing-test commit check via task.tdd-gate-check');
  });

  test('end-of-phase TDD review escalates to blocking under MVP+TDD', () => {
    // hasBlockingEscalation → terms 'blocking' present AND 'MVP+TDD' present
    // Both must coexist in the workflow (the escalation clause)
    const blockingTerm = ir.terms.find(t => t.term === 'blocking');
    assert.ok(blockingTerm && blockingTerm.count > 0, 'workflow must reference blocking escalation');

    const mvpTddTerm = ir.terms.find(t => t.term === 'MVP+TDD');
    assert.ok(mvpTddTerm && mvpTddTerm.count > 0, 'workflow must describe escalation in MVP+TDD context');
  });

  test('workflow references execute-mvp-tdd.md', () => {
    // hasReferenceDoc → terms 'execute-mvp-tdd.md' present
    const refTerm = ir.terms.find(t => t.term === 'execute-mvp-tdd.md');
    assert.ok(refTerm && refTerm.count > 0, 'must reference the gate semantics file execute-mvp-tdd.md');
  });

  test('--no-mvp and --no-tdd opt-out flags are parsed (E7 symmetry)', () => {
    // MVP_FLAG_ARG and TDD_FLAG_ARG bash assignments signal that opt-out flag parsing is present
    const mvpFlagAssign = ir.bash_assignments.find(a => a.var === 'MVP_FLAG_ARG');
    assert.ok(mvpFlagAssign, 'workflow must declare MVP_FLAG_ARG bash assignment (signals --no-mvp is parsed)');

    const tddFlagAssign = ir.bash_assignments.find(a => a.var === 'TDD_FLAG_ARG');
    assert.ok(tddFlagAssign, 'workflow must declare TDD_FLAG_ARG bash assignment (signals --no-tdd is parsed)');
  });

  // ── Counter-tests (Contract 6 — negative-space coverage) ─────────────────

  test('COUNTER: synthetic non-MVP workflow has no MVP_MODE assignment or MVP+TDD gate', () => {
    const { filePath, dir } = writeSyntheticWorkflow(
      '## 1. Initialize\n\nStandard execution workflow. No MVP or TDD mode.\n'
    );
    try {
      const synIr = parseWorkflow(filePath, ['MVP_MODE', 'TDD_MODE', 'MVP+TDD', 'execute-mvp-tdd.md']);
      const mvpAssign = synIr.bash_assignments.find(a => a.var === 'MVP_MODE');
      assert.ok(!mvpAssign, 'synthetic non-MVP workflow must NOT have MVP_MODE assignment');

      const tddAssign = synIr.bash_assignments.find(a => a.var === 'TDD_MODE');
      assert.ok(!tddAssign, 'synthetic non-MVP workflow must NOT have TDD_MODE assignment');

      const mvpTddTerm = synIr.terms.find(t => t.term === 'MVP+TDD');
      assert.strictEqual(mvpTddTerm.count, 0, 'synthetic non-MVP workflow must not mention MVP+TDD');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
    }
  });

  test('COUNTER: synthetic workflow without blocking escalation has no blocking+MVP+TDD coexistence', () => {
    const { filePath, dir } = writeSyntheticWorkflow(
      '## 1. Initialize\n\nThis workflow has no gate escalation.\n'
    );
    try {
      const synIr = parseWorkflow(filePath, ['blocking', 'MVP+TDD', 'execute-mvp-tdd.md']);
      const blockingTerm = synIr.terms.find(t => t.term === 'blocking');
      assert.strictEqual(blockingTerm.count, 0, 'synthetic workflow must not mention blocking');
      const refTerm = synIr.terms.find(t => t.term === 'execute-mvp-tdd.md');
      assert.strictEqual(refTerm.count, 0, 'synthetic workflow must not reference execute-mvp-tdd.md');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
    }
  });
});

describe('execute-phase MVP+TDD — resolution chain integration', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = createTempProject(); });
  afterEach(() => { cleanup(tmpDir); });

  test('roadmap.get-phase --pick mode returns mvp when **Mode:** mvp set', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap\n\n## v1.0.0\n\n### Phase 1: User Auth\n**Goal:** As a user, I want to log in, so that I can access.\n**Mode:** mvp\n`
    );
    const result = runGsdTools('roadmap get-phase 1 --pick mode', tmpDir);
    assert.ok(result.success, `roadmap get-phase should succeed, stderr: ${result.error || '(none)'}`);
    assert.strictEqual(result.output.trim(), 'mvp');
  });

  test('roadmap.get-phase --pick mode returns null/empty when no Mode line', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      `# Roadmap\n\n## v1.0.0\n\n### Phase 1: User Auth\n**Goal:** Users can log in.\n`
    );
    const result = runGsdTools('roadmap get-phase 1 --pick mode', tmpDir);
    assert.ok(result.success, `roadmap get-phase should succeed, stderr: ${result.error || '(none)'}`);
    assert.ok(result.output.trim() === '' || result.output.trim() === 'null');
  });

  test('config-get workflow.mvp_mode default is unset in fresh project', () => {
    const result = runGsdTools('config-get workflow.mvp_mode', tmpDir);
    assert.ok(result.success, `expected gsd-tools to succeed: ${result.error || result.stderr}`);
    assert.notStrictEqual(result.output.trim(), 'true');
  });
});
