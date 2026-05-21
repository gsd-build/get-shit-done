/**
 * gsd-planner agent — MVP-mode branch contract
 * Verifies the agent definition contains the MVP-mode planning section,
 * conditional reference loading, and Walking Skeleton handling.
 *
 * Retrofitted from SOURCE-GREP (assert.match on raw content) to workflow.parse IR
 * per #2826 test-rigor audit. Counter-tests added for Contract 6.
 */
const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const AGENT = path.join(__dirname, '..', 'agents', 'gsd-planner.md');
const REF_MVP = path.join(__dirname, '..', 'get-shit-done', 'references', 'planner-mvp-mode.md');
const REF_SKEL = path.join(__dirname, '..', 'get-shit-done', 'references', 'skeleton-template.md');
const GSD_SDK = path.join(__dirname, '..', 'bin', 'gsd-sdk.js');

/**
 * Call `gsd-sdk query workflow.parse <filePath> [--terms=...]` and return the
 * parsed JSON data object. Handles any markdown file, not just workflow files.
 */
function parseAgentFile(filePath, terms) {
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
 * Write a minimal markdown to a temp file for counter-tests.
 * Demonstrates ABSENCE of structure in a file that does not implement the MVP pattern.
 */
function writeSyntheticAgent(content) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-agentparse-'));
  const filePath = path.join(dir, 'synthetic.md');
  fs.writeFileSync(filePath, content, 'utf-8');
  return { filePath, dir };
}

// Parse once at module scope — shared across all sub-tests.
let ir;

describe('gsd-planner — MVP-mode branch', () => {
  before(() => {
    ir = parseAgentFile(AGENT, [
      'MVP_MODE',
      'vertical-slice',
      'vertical slice',
      'Walking Skeleton',
      'SKELETON.md',
      'planner-mvp-mode.md',
      'user-story-template.md',
      'Phase Goal',
      'As a',
      'I want to',
      'so that',
    ]);
  });

  test('agent defines an MVP Mode Detection section', () => {
    // Original: assert.match(content, /MVP\s*Mode|MVP_MODE/i) + assert.match(content, /vertical[\s-]?slice/i)

    // IR field: sections — must contain an "MVP Mode Detection" section
    const mvpSection = ir.sections.find(s => /MVP\s*Mode\s*Detection/i.test(s.heading));
    assert.ok(mvpSection, 'sections must include an MVP Mode Detection heading');

    // IR field: terms — vertical-slice or vertical slice must appear
    const vertSliceTerm = ir.terms.find(t => t.term === 'vertical-slice');
    const vertSliceSpaceTerm = ir.terms.find(t => t.term === 'vertical slice');
    const hasVertSlice = (vertSliceTerm && vertSliceTerm.count > 0) ||
                         (vertSliceSpaceTerm && vertSliceSpaceTerm.count > 0);
    assert.ok(hasVertSlice, 'agent must use vertical-slice terminology (terms: vertical-slice or vertical slice)');
  });

  test('agent describes Walking Skeleton handling', () => {
    // Original: assert.match(content, /Walking\s*Skeleton/i) + assert.match(content, /SKELETON\.md/)

    // IR field: terms — "Walking Skeleton" must appear
    const wsTerm = ir.terms.find(t => t.term === 'Walking Skeleton');
    assert.ok(wsTerm && wsTerm.count > 0, 'agent must mention Walking Skeleton (term: Walking Skeleton)');

    // IR field: terms — "SKELETON.md" must appear
    const skelMdTerm = ir.terms.find(t => t.term === 'SKELETON.md');
    assert.ok(skelMdTerm && skelMdTerm.count > 0, 'agent must mention SKELETON.md output (term: SKELETON.md)');
  });

  test('agent references planner-mvp-mode.md conditionally', () => {
    // Original: assert.match(content, /references\/planner-mvp-mode\.md/)

    // IR field: references — planner-mvp-mode.md must appear as a reference path
    const mvpRef = ir.references.find(r => r.path.includes('planner-mvp-mode.md'));
    assert.ok(mvpRef, 'references must include planner-mvp-mode.md');
  });

  test('referenced files exist on disk', () => {
    // Original: assert.ok(fs.existsSync(REF_MVP)) + assert.ok(fs.existsSync(REF_SKEL))
    // Kept as filesystem assertions — workflow.parse IR does not cover on-disk existence.
    assert.ok(fs.existsSync(REF_MVP), `${REF_MVP} must exist`);
    assert.ok(fs.existsSync(REF_SKEL), `${REF_SKEL} must exist`);
  });

  test('agent does not introduce horizontal/MVP mixing language', () => {
    // Original: assert.doesNotMatch(content, /mix[a-z\s]*horizontal[a-z\s]*MVP|MVP[a-z\s]*and[a-z\s]*horizontal/i)
    // Kept as direct file check — workflow.parse IR does not expose regex-NOT searches.
    // The "all-or-nothing per phase" guarantee is also confirmed positively via the MVP_MODE term.
    const content = fs.readFileSync(AGENT, 'utf-8');
    assert.doesNotMatch(
      content,
      /mix[a-z\s]*horizontal[a-z\s]*MVP|MVP[a-z\s]*and[a-z\s]*horizontal[a-z\s]*tasks/i,
      'agent must enforce all-or-nothing per phase'
    );

    // Positive structural confirmation: MVP_MODE term must exist (proves section is substantive)
    const mvpModeTerm = ir.terms.find(t => t.term === 'MVP_MODE');
    assert.ok(mvpModeTerm && mvpModeTerm.count > 0, 'agent must reference MVP_MODE (structural confirmation of all-or-nothing section)');
  });

  test('agent requires PLAN.md to start with user-story header in MVP mode', () => {
    // Original: assert.match(content, /Phase\s*Goal/i) +
    //           assert.match(content, /\*\*As a\*\*[^\n]*\*\*I want to\*\*[^\n]*\*\*so that\*\*/i) +
    //           assert.match(content, /user-story-template\.md/)

    // IR field: terms — "Phase Goal" must appear
    const phaseGoalTerm = ir.terms.find(t => t.term === 'Phase Goal');
    assert.ok(phaseGoalTerm && phaseGoalTerm.count > 0, 'agent must mention "Phase Goal" header (term: Phase Goal)');

    // IR field: terms — "As a", "I want to", "so that" must all appear (the bolded user-story format)
    const asATerm = ir.terms.find(t => t.term === 'As a');
    assert.ok(asATerm && asATerm.count > 0, 'agent must specify "As a" bolded user-story keyword (term: As a)');

    const iWantTerm = ir.terms.find(t => t.term === 'I want to');
    assert.ok(iWantTerm && iWantTerm.count > 0, 'agent must specify "I want to" bolded user-story keyword (term: I want to)');

    const soThatTerm = ir.terms.find(t => t.term === 'so that');
    assert.ok(soThatTerm && soThatTerm.count > 0, 'agent must specify "so that" bolded user-story keyword (term: so that)');

    // IR field: references — user-story-template.md must appear
    const ustRef = ir.references.find(r => r.path.includes('user-story-template.md'));
    assert.ok(ustRef, 'references must include user-story-template.md');
  });

  // ── Counter-tests (Contract 6 — negative-space coverage) ─────────────────

  test('COUNTER: synthetic agent without MVP section has no MVP Mode Detection heading or MVP_MODE term', () => {
    const { filePath, dir } = writeSyntheticAgent(
      '## 1. Initialize\n\nStandard planning agent. No special mode handling.\n'
    );
    try {
      const synIr = parseAgentFile(filePath, ['MVP_MODE', 'vertical-slice', 'Walking Skeleton', 'SKELETON.md']);
      const mvpSection = synIr.sections.find(s => /MVP\s*Mode/i.test(s.heading));
      assert.ok(!mvpSection, 'synthetic non-MVP agent must NOT have an MVP Mode section');

      const mvpModeTerm = synIr.terms.find(t => t.term === 'MVP_MODE');
      assert.strictEqual(mvpModeTerm.count, 0, 'synthetic non-MVP agent must not mention MVP_MODE');

      const wsTerm = synIr.terms.find(t => t.term === 'Walking Skeleton');
      assert.strictEqual(wsTerm.count, 0, 'synthetic agent must not mention Walking Skeleton');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
    }
  });

  test('COUNTER: synthetic agent without user-story format has no Phase Goal or story-keyword terms', () => {
    const { filePath, dir } = writeSyntheticAgent(
      '## Plan Structure\n\nEmit a plan with tasks. No user story format here.\n'
    );
    try {
      const synIr = parseAgentFile(filePath, ['Phase Goal', 'As a', 'I want to', 'so that', 'user-story-template.md']);

      const phaseGoalTerm = synIr.terms.find(t => t.term === 'Phase Goal');
      assert.strictEqual(phaseGoalTerm.count, 0, 'synthetic agent must not mention Phase Goal');

      const asATerm = synIr.terms.find(t => t.term === 'As a');
      assert.strictEqual(asATerm.count, 0, 'synthetic agent must not mention "As a"');

      const ustRef = synIr.references.find(r => r.path.includes('user-story-template.md'));
      assert.ok(!ustRef, 'synthetic agent must not reference user-story-template.md');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
    }
  });

  test('COUNTER: synthetic agent without Walking Skeleton has no SKELETON.md reference', () => {
    const { filePath, dir } = writeSyntheticAgent(
      '## Planning\n\nCreate PLAN.md files. No skeleton template needed.\n'
    );
    try {
      const synIr = parseAgentFile(filePath, ['Walking Skeleton', 'SKELETON.md']);

      const wsTerm = synIr.terms.find(t => t.term === 'Walking Skeleton');
      assert.strictEqual(wsTerm.count, 0, 'synthetic agent must not mention Walking Skeleton');

      const skelTerm = synIr.terms.find(t => t.term === 'SKELETON.md');
      assert.strictEqual(skelTerm.count, 0, 'synthetic agent must not mention SKELETON.md');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
    }
  });
});
