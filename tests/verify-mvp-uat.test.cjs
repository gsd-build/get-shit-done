/**
 * verify-work workflow — MVP mode UAT contract test
 * Verifies the workflow markdown documents MVP_MODE resolution,
 * conditional reference injection, user-flow-first UAT ordering,
 * and the deferred-technical-checks clause.
 *
 * Retrofitted from SOURCE-GREP (assert.match on raw content) to workflow.parse IR
 * per #2826 test-rigor audit. Counter-tests added for Contract 6.
 *
 * Original assertions (5 SOURCE-GREP):
 *   1. /MVP_MODE/ + /phase\.mvp-mode|phase mvp-mode/i
 *   2. /verify-mvp-mode\.md/
 *   3. /user[\s-]?flow[^\n]{0,80}(first|before|precede)/i
 *   4. /technical[\s-]?checks[^\n]{0,80}(after|defer|second)/i
 *   5. /mode[^\n]*null|absent|not.*mvp|standard\s*UAT/i   ← vacuous regex
 *      (parsed as: (mode[^\n]*null)|(absent)|(not.*mvp)|(standard\s*UAT);
 *       bare |absent| branch matched the word "absent" anywhere in the file)
 */
const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const WORKFLOW = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'verify-work.md');
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

/**
 * Write a minimal markdown to a temp file for counter-tests.
 */
function writeSyntheticWorkflow(content) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-wfparse-mvpuat-'));
  const filePath = path.join(dir, 'synthetic.md');
  fs.writeFileSync(filePath, content, 'utf-8');
  return { filePath, dir };
}

// Parse once at module scope — shared across all positive sub-tests.
let ir;

describe('verify-work — MVP mode UAT framing', () => {
  before(() => {
    ir = parseWorkflow(WORKFLOW, [
      'MVP_MODE',
      'phase.mvp-mode',
      'verify-mvp-mode.md',
      'user-flow',
      'User-flow steps run first',
      'Technical checks are deferred',
      'technical checks',
      'defer',
      'MVP_MODE=false',
      'standard UAT generation path',
      'mode is null',
    ]);
  });

  test('Step 1 resolves MVP_MODE from phase mode field', () => {
    // Original: assert.match(content, /MVP_MODE/)
    // IR: terms — MVP_MODE must appear at least once
    const mvpModeTerm = ir.terms.find(t => t.term === 'MVP_MODE');
    assert.ok(
      mvpModeTerm && mvpModeTerm.count > 0,
      'workflow must declare MVP_MODE (terms.MVP_MODE.count > 0)'
    );

    // Original: assert.match(content, /phase\.mvp-mode|phase mvp-mode/i)
    // IR: sdk_calls — phase.mvp-mode verb must be invoked
    const mvpModeCall = ir.sdk_calls.find(c => c.verb === 'phase.mvp-mode');
    assert.ok(
      mvpModeCall,
      'must resolve MVP mode via the centralized phase.mvp-mode SDK verb (sdk_calls.verb === "phase.mvp-mode")'
    );
  });

  test('workflow references verify-mvp-mode.md', () => {
    // Original: assert.match(content, /verify-mvp-mode\.md/)
    // IR: references — verify-mvp-mode.md must appear as a reference path
    const mvpRef = ir.references.find(r => r.path.includes('verify-mvp-mode.md'));
    assert.ok(
      mvpRef,
      'references must include verify-mvp-mode.md (references[].path contains "verify-mvp-mode.md")'
    );
  });

  test('UAT generation under MVP mode runs user-flow steps first', () => {
    // Original: assert.match(content, /user[\s-]?flow[^\n]{0,80}(first|before|precede)/i)
    // IR: terms — the explicit ordering phrase "User-flow steps run first" must appear
    // This is the verbatim text from the workflow (line 152) — more precise than a loose regex.
    const userFlowFirstTerm = ir.terms.find(t => t.term === 'User-flow steps run first');
    assert.ok(
      userFlowFirstTerm && userFlowFirstTerm.count > 0,
      'must specify user-flow-first ordering (term: "User-flow steps run first")'
    );

    // Ordering check: "User-flow steps run first" line must precede "Technical checks are deferred" line.
    const techDeferredTerm = ir.terms.find(t => t.term === 'Technical checks are deferred');
    assert.ok(
      techDeferredTerm && techDeferredTerm.count > 0,
      'must have "Technical checks are deferred" phrase for ordering comparison'
    );
    assert.ok(
      userFlowFirstTerm.first_line < techDeferredTerm.first_line,
      `user-flow ordering phrase (line ${userFlowFirstTerm.first_line}) must precede ` +
      `technical-checks deferral phrase (line ${techDeferredTerm.first_line})`
    );
  });

  test('technical checks deferred under MVP mode', () => {
    // Original: assert.match(content, /technical[\s-]?checks[^\n]{0,80}(after|defer|second)/i)
    // IR: terms — "Technical checks are deferred" must appear (explicit phrase, not loose regex)
    const techDeferredTerm = ir.terms.find(t => t.term === 'Technical checks are deferred');
    assert.ok(
      techDeferredTerm && techDeferredTerm.count > 0,
      'must defer technical checks under MVP mode (term: "Technical checks are deferred")'
    );

    // Corroborate: generic "defer" term also present
    const deferTerm = ir.terms.find(t => t.term === 'defer');
    assert.ok(
      deferTerm && deferTerm.count > 0,
      'must use "defer" language for technical checks (terms.defer.count > 0)'
    );
  });

  test('mode null falls back to standard UAT generation', () => {
    // Original (vacuous regex, broken by precedence):
    //   assert.match(content, /mode[^\n]*null|absent|not.*mvp|standard\s*UAT/i)
    //
    // The regex parses as four alternatives:
    //   (mode[^\n]*null) | (absent) | (not.*mvp) | (standard\s*UAT)
    // The bare |absent| branch matches the word "absent" ANYWHERE in the file,
    // making this assertion trivially pass for any workflow that contains "absent".
    //
    // Replacement: assert on the SPECIFIC fallback marker phrase at line 156:
    //   "When `MVP_MODE=false` (mode is null, absent, or the phase has no `**Mode:**`
    //    line in ROADMAP.md), fall back to the standard UAT generation path"
    //
    // Use two independent term checks — both must be present at the SAME line.

    const mvpModeFalseTerm = ir.terms.find(t => t.term === 'MVP_MODE=false');
    assert.ok(
      mvpModeFalseTerm && mvpModeFalseTerm.count > 0,
      'must name the MVP_MODE=false condition explicitly (term: "MVP_MODE=false")'
    );

    const standardUATPathTerm = ir.terms.find(t => t.term === 'standard UAT generation path');
    assert.ok(
      standardUATPathTerm && standardUATPathTerm.count > 0,
      'must name the standard UAT generation path fallback explicitly (term: "standard UAT generation path")'
    );

    // Both must appear on the same line — confirming they are part of the same fallback clause,
    // not two unrelated mentions.
    assert.strictEqual(
      mvpModeFalseTerm.first_line,
      standardUATPathTerm.first_line,
      `MVP_MODE=false (line ${mvpModeFalseTerm.first_line}) and "standard UAT generation path" ` +
      `(line ${standardUATPathTerm.first_line}) must be on the same line — confirming single fallback clause`
    );

    // Also confirm "mode is null" is named (explicit null-mode documentation)
    const modeNullTerm = ir.terms.find(t => t.term === 'mode is null');
    assert.ok(
      modeNullTerm && modeNullTerm.count > 0,
      'must explicitly document mode is null as the trigger condition (term: "mode is null")'
    );
  });

  // ── Counter-tests (Contract 6 — negative-space coverage) ─────────────────

  test('COUNTER: synthetic workflow with reversed ordering correctly fails the ordering check', () => {
    // Build a workflow where technical-checks phrase comes BEFORE user-flow phrase.
    // The ordering assertion must correctly detect the reversal.
    const { filePath, dir } = writeSyntheticWorkflow(
      '## setup\n\n' +
      'Technical checks are deferred after this step.\n\n' +
      '## run\n\n' +
      'User-flow steps run first.\n'
    );
    try {
      const synIr = parseWorkflow(filePath, [
        'User-flow steps run first',
        'Technical checks are deferred',
      ]);

      const userFlowFirstTerm = synIr.terms.find(t => t.term === 'User-flow steps run first');
      const techDeferredTerm = synIr.terms.find(t => t.term === 'Technical checks are deferred');

      // Both terms are present in this synthetic workflow.
      assert.ok(userFlowFirstTerm && userFlowFirstTerm.count > 0, 'synthetic: user-flow-first term found');
      assert.ok(techDeferredTerm && techDeferredTerm.count > 0, 'synthetic: technical-deferred term found');

      // But the ordering is REVERSED — technical-checks comes first.
      // Prove the ordering check correctly catches the reversal:
      assert.ok(
        techDeferredTerm.first_line < userFlowFirstTerm.first_line,
        `COUNTER: reversed synthetic correctly shows technical-checks (line ${techDeferredTerm.first_line}) ` +
        `precedes user-flow (line ${userFlowFirstTerm.first_line}) — ordering assertion would FAIL on this file`
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
    }
  });

  test('COUNTER: synthetic workflow without fallback marker has no MVP_MODE=false term', () => {
    // A workflow that never documents the standard-UAT fallback path should fail the fallback assertion.
    const { filePath, dir } = writeSyntheticWorkflow(
      '## UAT Generation\n\n' +
      'When MVP mode is active, generate user-flow steps.\n' +
      'No fallback path documented here.\n'
    );
    try {
      const synIr = parseWorkflow(filePath, [
        'MVP_MODE=false',
        'standard UAT generation path',
        'mode is null',
      ]);

      const mvpModeFalseTerm = synIr.terms.find(t => t.term === 'MVP_MODE=false');
      assert.strictEqual(
        mvpModeFalseTerm.count,
        0,
        'COUNTER: synthetic workflow without fallback must NOT have MVP_MODE=false term'
      );

      const standardUATPathTerm = synIr.terms.find(t => t.term === 'standard UAT generation path');
      assert.strictEqual(
        standardUATPathTerm.count,
        0,
        'COUNTER: synthetic workflow without fallback must NOT have "standard UAT generation path" term'
      );

      // This proves: the fallback assertion would FAIL on this synthetic file,
      // because neither explicit marker is present.
    } finally {
      fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
    }
  });

  test('COUNTER: synthetic workflow without phase.mvp-mode SDK call has no sdk_calls entry for it', () => {
    // A workflow that uses MVP_MODE in prose but never calls the phase.mvp-mode SDK verb
    // should fail the SDK-call assertion.
    const { filePath, dir } = writeSyntheticWorkflow(
      '## Initialize\n\n' +
      '```bash\n' +
      'MVP_MODE=false\n' +
      '```\n\n' +
      'When MVP_MODE=true, run user flow. Otherwise run standard UAT generation path.\n'
    );
    try {
      const synIr = parseWorkflow(filePath, ['MVP_MODE', 'phase.mvp-mode']);

      // MVP_MODE term is present (set in bash block and in prose)
      const mvpModeTerm = synIr.terms.find(t => t.term === 'MVP_MODE');
      assert.ok(
        mvpModeTerm && mvpModeTerm.count > 0,
        'COUNTER: synthetic has MVP_MODE term (the term check alone is insufficient)'
      );

      // But no phase.mvp-mode SDK call — the centralized verb is absent.
      const mvpModeCall = synIr.sdk_calls.find(c => c.verb === 'phase.mvp-mode');
      assert.ok(
        !mvpModeCall,
        'COUNTER: synthetic workflow without phase.mvp-mode SDK call must NOT have it in sdk_calls'
      );

      // This proves: the sdk_calls assertion would FAIL on this synthetic file.
    } finally {
      fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
    }
  });
});
