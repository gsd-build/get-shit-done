/**
 * progress workflow — MVP mode display contract test
 *
 * Retrofitted from HIDDEN-GREP (parseProgressContract) to workflow.parse IR
 * per #2826 test-rigor audit. Counter-tests added for Contract 6.
 */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const WORKFLOW = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'progress.md');
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
  'phase.mvp-mode',
  'PLAN.md',
  'user-flow',
  'user-visible',
  'standard',
]);

describe('progress — MVP mode display', () => {
  test('workflow declares MVP_MODE assignment resolved via phase.mvp-mode SDK call', () => {
    // hasMvpModeVariable → bash_assignments must contain MVP_MODE
    const mvpAssign = ir.bash_assignments.find(a => a.var === 'MVP_MODE');
    assert.ok(mvpAssign, 'workflow must declare MVP_MODE bash assignment');

    // usesPhaseMvpVerb → sdk_calls must contain phase.mvp-mode
    const mvpSdkCall = ir.sdk_calls.find(c => c.verb === 'phase.mvp-mode');
    assert.ok(mvpSdkCall, 'workflow must call gsd-sdk query phase.mvp-mode (centralized resolver)');

    // The assignment and the SDK call must be on the same line (the assignment wraps the call)
    assert.strictEqual(
      mvpAssign.line,
      mvpSdkCall.line,
      `MVP_MODE assignment (line ${mvpAssign.line}) must be on same line as phase.mvp-mode call (line ${mvpSdkCall.line})`
    );
  });

  test('MVP display sources user-flow status using user-flow / user-visible framing', () => {
    // usesUserFlowLanguage → terms user-flow and user-visible present
    const userFlowTerm = ir.terms.find(t => t.term === 'user-flow');
    assert.ok(userFlowTerm && userFlowTerm.count > 0, 'workflow must use user-flow framing');

    const userVisibleTerm = ir.terms.find(t => t.term === 'user-visible');
    assert.ok(userVisibleTerm && userVisibleTerm.count > 0, 'workflow must reference user-visible capabilities');

    // sourcesPlanTasks → terms PLAN.md present (the display is sourced from PLAN.md task names)
    const planMdTerm = ir.terms.find(t => t.term === 'PLAN.md');
    assert.ok(planMdTerm && planMdTerm.count > 0, 'workflow must reference PLAN.md as source of user-flow task names');
  });

  test('MVP_MODE term appears multiple times (declared, checked, and documented)', () => {
    const mvpModeTerm = ir.terms.find(t => t.term === 'MVP_MODE');
    assert.ok(mvpModeTerm && mvpModeTerm.count >= 2, `MVP_MODE must appear at least twice (found ${mvpModeTerm ? mvpModeTerm.count : 0})`);
  });

  test('falls back to standard display path when MVP_MODE is false', () => {
    // hasStandardFallback → terms 'standard' present (covers "standard display path" / "standard task progress total")
    const standardTerm = ir.terms.find(t => t.term === 'standard');
    assert.ok(standardTerm && standardTerm.count > 0, 'workflow must describe standard display fallback path');
  });

  // ── Counter-tests (Contract 6 — negative-space coverage) ──────────────────

  test('COUNTER: synthetic non-MVP workflow has no MVP_MODE assignment or phase.mvp-mode call', () => {
    const { filePath, dir } = writeSyntheticWorkflow(
      '## Step 1 — Display Progress\n\nShow a standard progress bar for all phases.\n'
    );
    try {
      const synIr = parseWorkflow(filePath, ['MVP_MODE', 'phase.mvp-mode', 'user-flow', 'user-visible']);

      const mvpAssign = synIr.bash_assignments.find(a => a.var === 'MVP_MODE');
      assert.ok(!mvpAssign, 'synthetic non-MVP workflow must NOT have MVP_MODE assignment');

      const mvpSdkCall = synIr.sdk_calls.find(c => c.verb === 'phase.mvp-mode');
      assert.ok(!mvpSdkCall, 'synthetic non-MVP workflow must NOT call phase.mvp-mode');

      const userFlowTerm = synIr.terms.find(t => t.term === 'user-flow');
      assert.strictEqual(userFlowTerm.count, 0, 'synthetic non-MVP workflow must not use user-flow framing');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
    }
  });

  test('COUNTER: add-backlog workflow (unrelated) has no MVP_MODE or phase.mvp-mode', () => {
    const addBacklog = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'add-backlog.md');
    const siblingIr = parseWorkflow(addBacklog, ['MVP_MODE', 'phase.mvp-mode', 'user-flow', 'user-visible']);

    const mvpModeTerm = siblingIr.terms.find(t => t.term === 'MVP_MODE');
    assert.strictEqual(mvpModeTerm.count, 0, 'add-backlog must not mention MVP_MODE');

    const phaseMvpTerm = siblingIr.terms.find(t => t.term === 'phase.mvp-mode');
    assert.strictEqual(phaseMvpTerm.count, 0, 'add-backlog must not reference phase.mvp-mode');

    const mvpAssign = siblingIr.bash_assignments.find(a => a.var === 'MVP_MODE');
    assert.ok(!mvpAssign, 'add-backlog must not have MVP_MODE bash assignment');
  });

  test('COUNTER: synthetic workflow with MVP_MODE text but no SDK call fails phase.mvp-mode assertion', () => {
    // This proves the test correctly distinguishes text mentions from actual SDK call usage
    const { filePath, dir } = writeSyntheticWorkflow(
      '## Step 1 — Display\n\nWhen MVP_MODE is set, show extra info.\n'
    );
    try {
      const synIr = parseWorkflow(filePath, ['MVP_MODE', 'phase.mvp-mode']);

      // MVP_MODE is mentioned as text
      const mvpModeTerm = synIr.terms.find(t => t.term === 'MVP_MODE');
      assert.ok(mvpModeTerm && mvpModeTerm.count > 0, 'MVP_MODE text mention is detected');

      // But no SDK call exists — the critical structural assertion must fail
      const mvpSdkCall = synIr.sdk_calls.find(c => c.verb === 'phase.mvp-mode');
      assert.ok(!mvpSdkCall, 'synthetic workflow without SDK call must not have phase.mvp-mode sdk_call');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
    }
  });
});
