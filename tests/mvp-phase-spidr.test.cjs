/**
 * mvp-phase workflow — contract test
 * Verifies the workflow markdown contains the four agreed gates:
 *  1. Phase existence + status guard (refuse in_progress/completed)
 *  2. User-story prompt (three AskUserQuestion calls, As a / I want to / So that)
 *  3. SPIDR splitting check
 *  4. ROADMAP write (Mode + Goal)
 *  5. Delegation to plan-phase
 *
 * Retrofitted from HIDDEN-GREP (parseMvpPhaseContract) to workflow.parse IR
 * per #2826 test-rigor audit. Counter-tests added for Contract 6.
 */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const WORKFLOW = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'mvp-phase.md');
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
  'in_progress',
  'completed',
  '--force',
  'As a',
  'I want to',
  'so that',
  'spidr-splitting.md',
  '**Mode:** mvp',
  '**Goal:**',
  'ROADMAP.md',
  'user-story-template.md',
]);

describe('mvp-phase workflow', () => {
  test('declares phase status guard (refuse in_progress/completed unless --force)', () => {
    // hasStatusGuard → terms 'in_progress' and 'completed' are both present
    const inProgressTerm = ir.terms.find(t => t.term === 'in_progress');
    assert.ok(inProgressTerm && inProgressTerm.count > 0, 'workflow must reference in_progress status');

    const completedTerm = ir.terms.find(t => t.term === 'completed');
    assert.ok(completedTerm && completedTerm.count > 0, 'workflow must reference completed status');

    // hasForceOverride → terms '--force' is present
    const forceTerm = ir.terms.find(t => t.term === '--force');
    assert.ok(forceTerm && forceTerm.count > 0, 'workflow must mention --force override');
  });

  test('runs three structured user-story prompts', () => {
    // hasAsA, hasIWantTo, hasSoThat → terms present
    const asATerm = ir.terms.find(t => t.term === 'As a');
    assert.ok(asATerm && asATerm.count > 0, 'workflow must contain "As a" user-story fragment');

    const iWantTerm = ir.terms.find(t => t.term === 'I want to');
    assert.ok(iWantTerm && iWantTerm.count > 0, 'workflow must contain "I want to" user-story fragment');

    const soThatTerm = ir.terms.find(t => t.term === 'so that');
    assert.ok(soThatTerm && soThatTerm.count > 0, 'workflow must contain "so that" user-story fragment');

    // askCount >= 3 → ir.asks.length >= 3
    assert.ok(
      ir.asks.length >= 3,
      `workflow must invoke AskUserQuestion at least 3 times for story prompts (got ${ir.asks.length})`
    );
  });

  test('runs SPIDR splitting check after user story', () => {
    // spidrStepIndex >= 0 → a section with "spidr" in heading exists
    const spidrSection = ir.sections.find(s => s.heading.toLowerCase().includes('spidr'));
    assert.ok(spidrSection, 'workflow must define an SPIDR step section');

    // hasSpidrReference → terms 'spidr-splitting.md' present (which also covers reference file)
    const spidrRefTerm = ir.terms.find(t => t.term === 'spidr-splitting.md');
    assert.ok(spidrRefTerm && spidrRefTerm.count > 0, 'workflow must reference the SPIDR rules file (spidr-splitting.md)');
  });

  test('writes Mode: mvp + Goal: line to ROADMAP.md', () => {
    // hasModeLine → terms '**Mode:** mvp' present
    const modeTerm = ir.terms.find(t => t.term === '**Mode:** mvp');
    assert.ok(modeTerm && modeTerm.count > 0, 'workflow must specify the **Mode:** mvp line');

    // hasRoadmapReference → terms 'ROADMAP.md' present
    const roadmapTerm = ir.terms.find(t => t.term === 'ROADMAP.md');
    assert.ok(roadmapTerm && roadmapTerm.count > 0, 'workflow must reference ROADMAP.md');

    // hasGoalLine → terms '**Goal:**' present
    const goalTerm = ir.terms.find(t => t.term === '**Goal:**');
    assert.ok(goalTerm && goalTerm.count > 0, 'workflow must update the **Goal:** line');
  });

  test('delegates to /gsd plan-phase after SPIDR check', () => {
    // planPhaseStepIndex > spidrStepIndex → the plan-phase delegation section
    // appears after the SPIDR section in document order (position field).
    const spidrSection = ir.sections.find(s => s.heading.toLowerCase().includes('spidr'));
    assert.ok(spidrSection, 'SPIDR check step must be present');

    const planPhaseSection = ir.sections.find(s =>
      s.heading.toLowerCase().includes('delegate') ||
      s.heading.toLowerCase().includes('plan-phase')
    );
    assert.ok(planPhaseSection, 'plan-phase delegation step must be present');

    assert.ok(
      planPhaseSection.position > spidrSection.position,
      `plan-phase delegation (pos=${planPhaseSection.position}) must come AFTER SPIDR check (pos=${spidrSection.position})`
    );
  });

  test('references user-story-template.md', () => {
    // hasUserStoryTemplateRef → references array contains user-story-template.md
    const ref = ir.references.find(r => r.path.includes('user-story-template.md'));
    assert.ok(ref, 'workflow must reference user-story-template.md');
  });

  // ── Counter-tests (Contract 6 — negative-space coverage) ─────────────────

  test('COUNTER: synthetic workflow without status guard has no in_progress/completed terms', () => {
    const { filePath, dir } = writeSyntheticWorkflow(
      '## 1. Initialize\n\nThis workflow does not guard phase status.\n'
    );
    try {
      const synIr = parseWorkflow(filePath, ['in_progress', 'completed', '--force']);
      const ipTerm = synIr.terms.find(t => t.term === 'in_progress');
      assert.strictEqual(ipTerm.count, 0, 'synthetic workflow must not mention in_progress');
      const cTerm = synIr.terms.find(t => t.term === 'completed');
      assert.strictEqual(cTerm.count, 0, 'synthetic workflow must not mention completed');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
    }
  });

  test('COUNTER: synthetic workflow without SPIDR has no spidr-splitting.md reference and no SPIDR section', () => {
    const { filePath, dir } = writeSyntheticWorkflow(
      '## 1. Initialize\n\nNo splitting here.\n\n## 2. Done\n\nDelegates to plan-phase.\n'
    );
    try {
      const synIr = parseWorkflow(filePath, ['spidr-splitting.md']);
      const spidrRef = synIr.terms.find(t => t.term === 'spidr-splitting.md');
      assert.strictEqual(spidrRef.count, 0, 'synthetic workflow must not reference spidr-splitting.md');
      const spidrSection = synIr.sections.find(s => s.heading.toLowerCase().includes('spidr'));
      assert.ok(!spidrSection, 'synthetic workflow must not have an SPIDR section');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
    }
  });

  test('COUNTER: synthetic workflow without MVP mode has no **Mode:** mvp term', () => {
    const { filePath, dir } = writeSyntheticWorkflow(
      '## 1. Initialize\n\nThis workflow does not write Mode: mvp.\n'
    );
    try {
      const synIr = parseWorkflow(filePath, ['**Mode:** mvp']);
      const modeTerm = synIr.terms.find(t => t.term === '**Mode:** mvp');
      assert.strictEqual(modeTerm.count, 0, 'synthetic non-MVP workflow must not contain **Mode:** mvp');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
    }
  });
});
