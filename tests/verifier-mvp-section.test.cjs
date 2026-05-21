/**
 * gsd-verifier agent — MVP Mode Verification section contract
 * Verifies the agent definition contains a section instructing the verifier
 * to emphasize user-visible outcomes under MVP mode.
 *
 * Retrofitted from HIDDEN-GREP (parseVerifierContract helper) to workflow.parse IR
 * per #2826 test-rigor audit. Counter-tests added for Contract 6.
 */
const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const AGENT = path.join(__dirname, '..', 'agents', 'gsd-verifier.md');
const REF = path.join(__dirname, '..', 'get-shit-done', 'references', 'verify-mvp-mode.md');
const GSD_SDK = path.join(__dirname, '..', 'bin', 'gsd-sdk.js');

/**
 * Call `gsd-sdk query workflow.parse <filePath> [--terms=...]` and return the
 * parsed JSON data object.
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
 */
function writeSyntheticAgent(content) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-agentparse-'));
  const filePath = path.join(dir, 'synthetic.md');
  fs.writeFileSync(filePath, content, 'utf-8');
  return { filePath, dir };
}

// Parse once at module scope — shared across all sub-tests.
let ir;

describe('gsd-verifier — MVP Mode Verification section', () => {
  before(() => {
    ir = parseAgentFile(AGENT, [
      'MVP Mode Verification',
      'verify-mvp-mode.md',
      'goal-backward',
    ]);
  });

  test('agent defines an MVP Mode Verification section', () => {
    // Original: contract.hasMvpVerificationSection (line.includes('mvp mode verification'))

    // IR field: sections — must contain "MVP Mode Verification" heading
    const mvpSection = ir.sections.find(s => /MVP\s*Mode\s*Verification/i.test(s.heading));
    assert.ok(mvpSection, 'sections must include an MVP Mode Verification heading');

    // IR field: terms — "MVP Mode Verification" term must appear in the document body
    const mvpTerm = ir.terms.find(t => t.term === 'MVP Mode Verification');
    assert.ok(mvpTerm && mvpTerm.count > 0, 'agent must mention "MVP Mode Verification" (term count > 0)');
  });

  test('agent references verify-mvp-mode.md', () => {
    // Original: contract.hasVerifyMvpReference (line.includes('verify-mvp-mode.md'))

    // IR field: references — verify-mvp-mode.md must appear as a reference path
    const mvpRef = ir.references.find(r => r.path.includes('verify-mvp-mode.md'));
    assert.ok(mvpRef, 'references must include verify-mvp-mode.md');

    // IR field: terms — "verify-mvp-mode.md" term must also appear
    const mvpRefTerm = ir.terms.find(t => t.term === 'verify-mvp-mode.md');
    assert.ok(mvpRefTerm && mvpRefTerm.count > 0, 'agent must mention verify-mvp-mode.md in text (term count > 0)');
  });

  test('agent preserves goal-backward terminology', () => {
    // Original: contract.hasGoalBackwardTerminology (line.includes('goal-backward'))

    // IR field: terms — "goal-backward" must appear
    const goalBackwardTerm = ir.terms.find(t => t.term === 'goal-backward');
    assert.ok(goalBackwardTerm && goalBackwardTerm.count > 0, 'agent must preserve goal-backward terminology (term count > 0)');
  });

  test('referenced file exists on disk', () => {
    // Kept as filesystem assertion — workflow.parse IR does not cover on-disk existence.
    assert.ok(fs.existsSync(REF), `${REF} must exist`);
  });

  // ── Counter-tests (Contract 6 — negative-space coverage) ─────────────────

  test('COUNTER: synthetic agent without MVP section has no MVP Mode Verification heading or term', () => {
    const { filePath, dir } = writeSyntheticAgent(
      '## Verification Process\n\nCheck that the phase goal is achieved. Standard verification only.\n'
    );
    try {
      const synIr = parseAgentFile(filePath, ['MVP Mode Verification', 'verify-mvp-mode.md', 'goal-backward']);

      const mvpSection = synIr.sections.find(s => /MVP\s*Mode\s*Verification/i.test(s.heading));
      assert.ok(!mvpSection, 'synthetic non-MVP agent must NOT have an MVP Mode Verification section');

      const mvpTerm = synIr.terms.find(t => t.term === 'MVP Mode Verification');
      assert.strictEqual(mvpTerm.count, 0, 'synthetic agent must not mention MVP Mode Verification');

      const mvpRef = synIr.references.find(r => r.path.includes('verify-mvp-mode.md'));
      assert.ok(!mvpRef, 'synthetic agent must not reference verify-mvp-mode.md');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
    }
  });

  test('COUNTER: synthetic agent without goal-backward methodology has no goal-backward term', () => {
    const { filePath, dir } = writeSyntheticAgent(
      '## Verification\n\nCheck each task was completed. Review the SUMMARY.md file.\n'
    );
    try {
      const synIr = parseAgentFile(filePath, ['goal-backward', 'MVP Mode Verification']);

      const goalBackwardTerm = synIr.terms.find(t => t.term === 'goal-backward');
      assert.strictEqual(goalBackwardTerm.count, 0, 'synthetic agent must not mention goal-backward');

      const mvpTerm = synIr.terms.find(t => t.term === 'MVP Mode Verification');
      assert.strictEqual(mvpTerm.count, 0, 'synthetic agent must not mention MVP Mode Verification');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
    }
  });
});
