/**
 * new-project workflow — MVP mode prompt contract test
 * Verifies the workflow markdown documents the Vertical MVP / Horizontal Layers
 * prompt and the ROADMAP.md template branch under MVP mode.
 *
 * Retrofitted from HIDDEN-GREP (parseNewProjectContract) to workflow.parse IR
 * per #2826 test-rigor audit. Counter-tests added for Contract 6.
 */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const WORKFLOW = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'new-project.md');
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

// Parse once at module scope — same as original pattern.
const ir = parseWorkflow(WORKFLOW, [
  'Vertical MVP',
  'Horizontal Layers',
  '**Mode:** mvp',
  'PROJECT_MODE=standard',
  'PROJECT_MODE=mvp',
]);

describe('new-project — MVP mode prompt', () => {
  test('workflow includes Vertical MVP option in mode prompt', () => {
    // hasVerticalMvpOption → terms 'Vertical MVP' is present
    const vMvpTerm = ir.terms.find(t => t.term === 'Vertical MVP');
    assert.ok(vMvpTerm && vMvpTerm.count > 0, 'must mention Vertical MVP option');
  });

  test('workflow includes Horizontal Layers option in mode prompt', () => {
    // hasHorizontalLayersOption → terms 'Horizontal Layers' is present
    const hLayersTerm = ir.terms.find(t => t.term === 'Horizontal Layers');
    assert.ok(hLayersTerm && hLayersTerm.count > 0, 'must mention Horizontal Layers option');
  });

  test('ROADMAP template emits **Mode:** mvp under Vertical MVP path', () => {
    // hasModeMvpTemplateLine → terms '**Mode:** mvp' is present
    const modeTerm = ir.terms.find(t => t.term === '**Mode:** mvp');
    assert.ok(modeTerm && modeTerm.count > 0, 'must emit **Mode:** mvp on initial roadmap phases under Vertical MVP');
  });

  test('workflow falls back to standard template when Horizontal Layers picked', () => {
    // hasHorizontalStandardFallback → terms 'PROJECT_MODE=standard' is present
    // (documents that picking Horizontal Layers sets PROJECT_MODE=standard, i.e. no **Mode:** lines)
    const stdTerm = ir.terms.find(t => t.term === 'PROJECT_MODE=standard');
    assert.ok(stdTerm && stdTerm.count > 0, 'must specify fallback to standard template (PROJECT_MODE=standard) for Horizontal Layers');
  });

  // ── Counter-tests (Contract 6 — negative-space coverage) ─────────────────

  test('COUNTER: synthetic workflow without MVP prompt has no Vertical MVP or Horizontal Layers terms', () => {
    const { filePath, dir } = writeSyntheticWorkflow(
      '## 1. Initialize\n\nThis workflow does not offer a mode prompt.\n'
    );
    try {
      const synIr = parseWorkflow(filePath, ['Vertical MVP', 'Horizontal Layers', '**Mode:** mvp']);
      const vMvpTerm = synIr.terms.find(t => t.term === 'Vertical MVP');
      assert.strictEqual(vMvpTerm.count, 0, 'synthetic workflow must not mention Vertical MVP');
      const hLayersTerm = synIr.terms.find(t => t.term === 'Horizontal Layers');
      assert.strictEqual(hLayersTerm.count, 0, 'synthetic workflow must not mention Horizontal Layers');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
    }
  });

  test('COUNTER: synthetic workflow without Mode: mvp branch has no **Mode:** mvp term', () => {
    const { filePath, dir } = writeSyntheticWorkflow(
      '## 1. Initialize\n\nThis workflow creates no ROADMAP Mode lines.\n'
    );
    try {
      const synIr = parseWorkflow(filePath, ['**Mode:** mvp', 'PROJECT_MODE=standard']);
      const modeTerm = synIr.terms.find(t => t.term === '**Mode:** mvp');
      assert.strictEqual(modeTerm.count, 0, 'synthetic workflow must not contain **Mode:** mvp');
      const stdTerm = synIr.terms.find(t => t.term === 'PROJECT_MODE=standard');
      assert.strictEqual(stdTerm.count, 0, 'synthetic workflow must not contain PROJECT_MODE=standard');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
    }
  });
});
