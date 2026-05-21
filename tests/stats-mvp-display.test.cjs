/**
 * stats workflow — MVP mode summary contract test
 *
 * Retrofitted from worst-quality SOURCE-GREP (assert.match /mode/i) to
 * workflow.parse IR per #2826 test-rigor audit. Counter-tests added for Contract 6.
 */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const WORKFLOW = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'stats.md');
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
  'roadmap.analyze',
  'MVP_COUNT',
  'TOTAL_COUNT',
  'mode',
  'mvp',
]);

describe('stats — MVP mode summary', () => {
  test('workflow calls roadmap.analyze to surface per-phase mode field', () => {
    // The original assert.match(content, /roadmap[^\n]*analyze|analyze[^\n]*mode/i)
    // is tightened to a structural sdk_calls assertion.
    const analyzeCall = ir.sdk_calls.find(c => c.verb === 'roadmap.analyze`' || c.verb === 'roadmap.analyze)');
    assert.ok(
      analyzeCall,
      `workflow must call gsd-sdk query roadmap.analyze (found sdk_calls: ${ir.sdk_calls.map(c => c.verb).join(', ')})`
    );
  });

  test('workflow assigns MVP_COUNT from roadmap.analyze result', () => {
    // bash_assignments must declare MVP_COUNT
    const mvpCountAssign = ir.bash_assignments.find(a => a.var === 'MVP_COUNT');
    assert.ok(mvpCountAssign, 'workflow must declare MVP_COUNT bash assignment');

    // and TOTAL_COUNT for the summary line
    const totalCountAssign = ir.bash_assignments.find(a => a.var === 'TOTAL_COUNT');
    assert.ok(totalCountAssign, 'workflow must declare TOTAL_COUNT bash assignment');
  });

  test('MVP_COUNT assignment appears after ANALYZE assignment (execution order)', () => {
    const analyzeAssign = ir.bash_assignments.find(a => a.var === 'ANALYZE');
    const mvpCountAssign = ir.bash_assignments.find(a => a.var === 'MVP_COUNT');

    assert.ok(analyzeAssign, 'workflow must declare ANALYZE bash assignment');
    assert.ok(mvpCountAssign, 'workflow must declare MVP_COUNT bash assignment');
    assert.ok(
      mvpCountAssign.line > analyzeAssign.line,
      `MVP_COUNT (line ${mvpCountAssign ? mvpCountAssign.line : 'N/A'}) must be assigned after ANALYZE (line ${analyzeAssign ? analyzeAssign.line : 'N/A'})`
    );
  });

  test('workflow terms include roadmap.analyze and mode', () => {
    // Replaces the loose assert.match(content, /mode/i) with a term count assertion
    // that proves 'mode' appears in a meaningful context, not accidentally.
    const modeTerm = ir.terms.find(t => t.term === 'mode');
    assert.ok(modeTerm && modeTerm.count >= 2,
      `'mode' must appear at least twice (found ${modeTerm ? modeTerm.count : 0}) — it describes both the phase mode field and mode-based counting`
    );

    const analyzeTerm = ir.terms.find(t => t.term === 'roadmap.analyze');
    assert.ok(analyzeTerm && analyzeTerm.count > 0, 'workflow must reference roadmap.analyze');
  });

  // ── Counter-tests (Contract 6 — negative-space coverage) ──────────────────

  test('COUNTER: synthetic workflow with no roadmap.analyze has no ANALYZE/MVP_COUNT assignments', () => {
    const { filePath, dir } = writeSyntheticWorkflow(
      '## Stats\n\nShow a summary of all phases. Count total phases only.\n\n```bash\nTOTAL=$(echo "5")\n```\n'
    );
    try {
      const synIr = parseWorkflow(filePath, ['roadmap.analyze', 'MVP_COUNT']);

      const analyzeCall = synIr.sdk_calls.find(c => c.verb.includes('roadmap.analyze'));
      assert.ok(!analyzeCall, 'synthetic workflow must not call roadmap.analyze');

      const mvpCountAssign = synIr.bash_assignments.find(a => a.var === 'MVP_COUNT');
      assert.ok(!mvpCountAssign, 'synthetic workflow must not have MVP_COUNT assignment');

      const analyzeTerm = synIr.terms.find(t => t.term === 'roadmap.analyze');
      assert.strictEqual(analyzeTerm.count, 0, 'synthetic workflow must not reference roadmap.analyze');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
    }
  });

  test('COUNTER: add-backlog workflow (unrelated) has no roadmap.analyze SDK call or MVP_COUNT', () => {
    const addBacklog = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'add-backlog.md');
    const siblingIr = parseWorkflow(addBacklog, ['roadmap.analyze', 'MVP_COUNT']);

    const analyzeCall = siblingIr.sdk_calls.find(c => c.verb.includes('roadmap.analyze'));
    assert.ok(!analyzeCall, 'add-backlog must not call roadmap.analyze');

    const mvpCountAssign = siblingIr.bash_assignments.find(a => a.var === 'MVP_COUNT');
    assert.ok(!mvpCountAssign, 'add-backlog must not have MVP_COUNT assignment');

    const analyzeTerm = siblingIr.terms.find(t => t.term === 'roadmap.analyze');
    assert.strictEqual(analyzeTerm.count, 0, 'add-backlog must not reference roadmap.analyze');
  });

  test('COUNTER: synthetic workflow with "mode" text but no roadmap.analyze fails structural assertions', () => {
    // Proves that the old /mode/i test was too loose — a naive mention of "mode" should not pass
    const { filePath, dir } = writeSyntheticWorkflow(
      '## Step 1 — Stats\n\nThis workflow does not count anything by mode.\nDisplay format mode can be changed via flags.\n'
    );
    try {
      const synIr = parseWorkflow(filePath, ['roadmap.analyze', 'MVP_COUNT', 'mode']);

      // "mode" appears in the text — the old regex would have passed
      const modeTerm = synIr.terms.find(t => t.term === 'mode');
      assert.ok(modeTerm && modeTerm.count > 0, '"mode" text is detectable (as it should be)');

      // But the structural assertions correctly reject it
      const analyzeCall = synIr.sdk_calls.find(c => c.verb.includes('roadmap.analyze'));
      assert.ok(!analyzeCall, 'synthetic workflow must not call roadmap.analyze');

      const mvpCountAssign = synIr.bash_assignments.find(a => a.var === 'MVP_COUNT');
      assert.ok(!mvpCountAssign, 'synthetic workflow must not have MVP_COUNT assignment');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
    }
  });
});
