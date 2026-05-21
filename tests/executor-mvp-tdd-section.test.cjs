/**
 * gsd-executor agent — MVP+TDD gate section contract
 * Verifies the agent definition contains a section instructing the executor
 * to halt and report when the runtime gate trips.
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

const AGENT = path.join(__dirname, '..', 'agents', 'gsd-executor.md');
const REF = path.join(__dirname, '..', 'get-shit-done', 'references', 'execute-mvp-tdd.md');
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

describe('gsd-executor — MVP+TDD gate section', () => {
  before(() => {
    ir = parseAgentFile(AGENT, [
      'MVP+TDD',
      'execute-mvp-tdd.md',
      'halt',
      'report',
    ]);
  });

  test('agent defines an MVP+TDD Gate section', () => {
    // Original: assert.match(content, /MVP\+TDD\s*Gate|MVP[\s-]?TDD[\s-]?gate/i)

    // IR field: sections — must contain "MVP+TDD Gate" heading
    const mvpTddSection = ir.sections.find(s => /MVP\+TDD\s*Gate|MVP[\s-]?TDD[\s-]?gate/i.test(s.heading));
    assert.ok(mvpTddSection, 'sections must include an MVP+TDD Gate heading');

    // IR field: terms — "MVP+TDD" must appear in the document
    const mvpTddTerm = ir.terms.find(t => t.term === 'MVP+TDD');
    assert.ok(mvpTddTerm && mvpTddTerm.count > 0, 'agent must label the gate as MVP+TDD (term count > 0)');
  });

  test('agent instructs halt-and-report when gate trips', () => {
    // Original: assert.match(content, /halt|stop[^\n]*gate|gate[^\n]*halt/i) +
    //           assert.match(content, /report|surface|emit/i)

    // IR field: terms — "halt" must appear (halt-and-report protocol)
    const haltTerm = ir.terms.find(t => t.term === 'halt');
    assert.ok(haltTerm && haltTerm.count > 0, 'agent must instruct halt when gate trips (term: halt)');

    // IR field: terms — "report" must appear (the structured emit after halting)
    const reportTerm = ir.terms.find(t => t.term === 'report');
    assert.ok(reportTerm && reportTerm.count > 0, 'agent must instruct report after gate trips (term: report)');
  });

  test('agent references execute-mvp-tdd.md', () => {
    // Original: assert.match(content, /execute-mvp-tdd\.md/)

    // IR field: references — execute-mvp-tdd.md must appear as a reference path
    const mvpTddRef = ir.references.find(r => r.path.includes('execute-mvp-tdd.md'));
    assert.ok(mvpTddRef, 'references must include execute-mvp-tdd.md');

    // IR field: terms — "execute-mvp-tdd.md" must also appear as a term
    const refTerm = ir.terms.find(t => t.term === 'execute-mvp-tdd.md');
    assert.ok(refTerm && refTerm.count > 0, 'agent must mention execute-mvp-tdd.md in text (term count > 0)');
  });

  test('referenced file exists on disk', () => {
    // Kept as filesystem assertion — workflow.parse IR does not cover on-disk existence.
    assert.ok(fs.existsSync(REF), `${REF} must exist`);
  });

  // ── Counter-tests (Contract 6 — negative-space coverage) ─────────────────

  test('COUNTER: synthetic agent without MVP+TDD gate has no gate section or halt term', () => {
    const { filePath, dir } = writeSyntheticAgent(
      '## Execution Flow\n\nExecute each task and commit. Standard execution without any gates.\n'
    );
    try {
      const synIr = parseAgentFile(filePath, ['MVP+TDD', 'execute-mvp-tdd.md', 'halt', 'report']);

      const mvpTddSection = synIr.sections.find(s => /MVP\+TDD/i.test(s.heading));
      assert.ok(!mvpTddSection, 'synthetic non-MVP agent must NOT have an MVP+TDD Gate section');

      const mvpTddTerm = synIr.terms.find(t => t.term === 'MVP+TDD');
      assert.strictEqual(mvpTddTerm.count, 0, 'synthetic agent must not mention MVP+TDD');

      const haltTerm = synIr.terms.find(t => t.term === 'halt');
      assert.strictEqual(haltTerm.count, 0, 'synthetic agent must not mention halt');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
    }
  });

  test('COUNTER: synthetic agent without execute-mvp-tdd reference has no reference or report term', () => {
    const { filePath, dir } = writeSyntheticAgent(
      '## Commit Protocol\n\nAfter each task, commit the changes. No TDD gate in this workflow.\n'
    );
    try {
      const synIr = parseAgentFile(filePath, ['execute-mvp-tdd.md', 'halt', 'report']);

      const mvpTddRef = synIr.references.find(r => r.path.includes('execute-mvp-tdd.md'));
      assert.ok(!mvpTddRef, 'synthetic agent must not reference execute-mvp-tdd.md');

      const refTerm = synIr.terms.find(t => t.term === 'execute-mvp-tdd.md');
      assert.strictEqual(refTerm.count, 0, 'synthetic agent must not mention execute-mvp-tdd.md');

      const reportTerm = synIr.terms.find(t => t.term === 'report');
      assert.strictEqual(reportTerm.count, 0, 'synthetic agent must not mention report');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
    }
  });
});
