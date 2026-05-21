/**
 * graphify — MVP visual differentiation contract test
 * Per PRD Q5: distinct node color + 'MVP' label suffix.
 *
 * Retrofitted from HIDDEN-GREP (parseVizContract) to workflow.parse IR
 * per #2826 test-rigor audit. Counter-tests added for Contract 6.
 */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const CMD = path.join(__dirname, '..', 'commands', 'gsd', 'graphify.md');
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
const ir = parseWorkflow(CMD, [
  'MVP',
  'color',
  'fill',
  'label',
  'suffix',
  'phase node',
]);

describe('graphify — MVP visualization', () => {
  test('command documents distinct color for MVP-mode phases', () => {
    // mentionsMvp → terms['MVP'].count > 0
    const mvpTerm = ir.terms.find(t => t.term === 'MVP');
    assert.ok(mvpTerm && mvpTerm.count > 0, 'must mention MVP (terms.MVP count > 0)');

    // colorRuleLine → terms['color'] or terms['fill'] present
    const colorTerm = ir.terms.find(t => t.term === 'color');
    const fillTerm = ir.terms.find(t => t.term === 'fill');
    assert.ok(
      (colorTerm && colorTerm.count > 0) || (fillTerm && fillTerm.count > 0),
      'must reference a color or fill rule for MVP nodes'
    );
  });

  test('command documents MVP label suffix on node text', () => {
    // labelRuleLine → terms['label'] or terms['suffix'] present
    const labelTerm = ir.terms.find(t => t.term === 'label');
    const suffixTerm = ir.terms.find(t => t.term === 'suffix');
    assert.ok(
      (labelTerm && labelTerm.count > 0) || (suffixTerm && suffixTerm.count > 0),
      'must add an MVP label or suffix to node text'
    );
  });

  test('command has a dedicated MVP-mode node rendering section', () => {
    // sections contain an MVP-mode rendering section
    const mvpSection = ir.sections.find(s =>
      s.heading.toLowerCase().includes('mvp') &&
      (s.heading.toLowerCase().includes('node') || s.heading.toLowerCase().includes('render'))
    );
    assert.ok(mvpSection, 'must have an MVP-mode node rendering section heading');
  });

  test('terms color and fill co-occur in MVP-mode node section', () => {
    // Both terms must be present — a node spec needs both color/fill + label/suffix
    const colorTerm = ir.terms.find(t => t.term === 'color');
    const fillTerm = ir.terms.find(t => t.term === 'fill');
    const labelTerm = ir.terms.find(t => t.term === 'label');
    const phaseNodeTerm = ir.terms.find(t => t.term === 'phase node');

    assert.ok(colorTerm && colorTerm.count > 0, 'must reference color');
    assert.ok(fillTerm && fillTerm.count > 0, 'must reference fill');
    assert.ok(labelTerm && labelTerm.count > 0, 'must reference label');
    assert.ok(phaseNodeTerm && phaseNodeTerm.count > 0, 'must reference phase node');
  });

  // ── Counter-tests (Contract 6 — negative-space coverage) ──────────────────

  test('COUNTER: synthetic non-MVP workflow has zero color/fill/label MVP terms', () => {
    const { filePath, dir } = writeSyntheticWorkflow(
      '## Step 1 — Build Graph\n\nRender all phases as nodes. No special visual treatment.\n'
    );
    try {
      const synIr = parseWorkflow(filePath, ['MVP', 'color', 'fill', 'label', 'suffix', 'phase node']);
      const mvpTerm = synIr.terms.find(t => t.term === 'MVP');
      assert.strictEqual(mvpTerm.count, 0, 'synthetic non-MVP workflow must not mention MVP');

      const colorTerm = synIr.terms.find(t => t.term === 'color');
      assert.strictEqual(colorTerm.count, 0, 'synthetic non-MVP workflow must not reference color');

      const fillTerm = synIr.terms.find(t => t.term === 'fill');
      assert.strictEqual(fillTerm.count, 0, 'synthetic non-MVP workflow must not reference fill');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
    }
  });

  test('COUNTER: synthetic no-label workflow has zero label/suffix occurrences', () => {
    const { filePath, dir } = writeSyntheticWorkflow(
      '## Step 1 — Draw Nodes\n\nEach node displays the phase number and title only.\n'
    );
    try {
      const synIr = parseWorkflow(filePath, ['label', 'suffix']);
      const labelTerm = synIr.terms.find(t => t.term === 'label');
      assert.strictEqual(labelTerm.count, 0, 'synthetic workflow must not reference label');

      const suffixTerm = synIr.terms.find(t => t.term === 'suffix');
      assert.strictEqual(suffixTerm.count, 0, 'synthetic workflow must not reference suffix');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
    }
  });

  test('COUNTER: add-backlog workflow (unrelated) has no MVP visual terms', () => {
    const addBacklog = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'add-backlog.md');
    const siblingIr = parseWorkflow(addBacklog, ['MVP', 'color', 'fill', 'label', 'suffix', 'phase node']);

    const mvpTerm = siblingIr.terms.find(t => t.term === 'MVP');
    assert.strictEqual(mvpTerm.count, 0, 'add-backlog must not mention MVP visual terms');

    const colorTerm = siblingIr.terms.find(t => t.term === 'color');
    assert.strictEqual(colorTerm.count, 0, 'add-backlog must not reference color');

    const fillTerm = siblingIr.terms.find(t => t.term === 'fill');
    assert.strictEqual(fillTerm.count, 0, 'add-backlog must not reference fill');
  });
});
