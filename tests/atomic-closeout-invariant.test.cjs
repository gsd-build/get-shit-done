// allow-test-rule: docs-presence-check
//
// Tests that the atomic close-out invariant is documented and that the
// gsd-executor agent prompt carries the producer-side callout pointing to
// the canonical doc. Closes #3212 (documentation gate — Stage A).
//
// These are structural file-presence + section-header checks. They do NOT
// assert the prose content of the doc (which is allowed to evolve), only
// that the contract surface exists and is wired between executor agent and
// the canonical doc.

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');
const DOC_PATH = path.join(REPO_ROOT, 'docs', 'ATOMIC-CLOSEOUT-INVARIANT.md');
const EXECUTOR_PATH = path.join(REPO_ROOT, 'agents', 'gsd-executor.md');

describe('atomic close-out invariant doc (#3212)', () => {
  test('docs/ATOMIC-CLOSEOUT-INVARIANT.md exists', () => {
    assert.ok(
      fs.existsSync(DOC_PATH),
      'docs/ATOMIC-CLOSEOUT-INVARIANT.md must exist as the canonical home for the invariant'
    );
  });

  test('doc declares the four artifacts that must land together', () => {
    const content = fs.readFileSync(DOC_PATH, 'utf8');
    // Section heading present
    assert.match(content, /##\s+The four artifacts/i,
      'doc must have a "The four artifacts" section');
    // All four artifact names present (structural anchors, not prose)
    for (const anchor of ['Per-task production commits', 'SUMMARY.md', 'STATE.md', 'ROADMAP.md']) {
      assert.ok(content.includes(anchor),
        `doc must mention artifact: ${anchor}`);
    }
  });

  test('doc enumerates drift states A-D', () => {
    const content = fs.readFileSync(DOC_PATH, 'utf8');
    for (const drift of ['Drift A', 'Drift B', 'Drift C', 'Drift D']) {
      assert.ok(content.includes(drift),
        `doc must enumerate ${drift} for the consistency-check handler to reference`);
    }
  });

  test('doc references the plan.consistency-check handler by exact name', () => {
    // The handler name is the API contract — Stage B will register it under
    // this exact dispatch string.
    const content = fs.readFileSync(DOC_PATH, 'utf8');
    assert.ok(
      content.includes('plan.consistency-check'),
      'doc must reference plan.consistency-check (the SDK handler name) so the contract and code share a stable label'
    );
  });
});

describe('gsd-executor agent carries the invariant callout (#3212)', () => {
  test('agents/gsd-executor.md contains <atomic_closeout_invariant> block', () => {
    const content = fs.readFileSync(EXECUTOR_PATH, 'utf8');
    assert.ok(
      content.includes('<atomic_closeout_invariant>'),
      'executor agent prompt must declare <atomic_closeout_invariant> so producer-side ordering cannot drift silently'
    );
    assert.ok(
      content.includes('</atomic_closeout_invariant>'),
      '<atomic_closeout_invariant> block must be closed'
    );
  });

  test('callout points to canonical doc path', () => {
    const content = fs.readFileSync(EXECUTOR_PATH, 'utf8');
    assert.ok(
      content.includes('docs/ATOMIC-CLOSEOUT-INVARIANT.md'),
      'callout must point to the canonical doc so a reader has one place to find the full contract'
    );
  });

  test('callout sits between </execution_flow> and <deviation_rules>', () => {
    const content = fs.readFileSync(EXECUTOR_PATH, 'utf8');
    const closeFlow = content.indexOf('</execution_flow>');
    const callout = content.indexOf('<atomic_closeout_invariant>');
    const deviation = content.indexOf('<deviation_rules>');
    assert.ok(closeFlow !== -1, 'sanity: </execution_flow> exists');
    assert.ok(callout !== -1, 'sanity: callout exists');
    assert.ok(deviation !== -1, 'sanity: <deviation_rules> exists');
    assert.ok(
      closeFlow < callout && callout < deviation,
      'callout must sit between </execution_flow> and <deviation_rules> so executor reads it before deviation rules are applied'
    );
  });

  test('callout enumerates the five-step sequence', () => {
    const content = fs.readFileSync(EXECUTOR_PATH, 'utf8');
    // The five sequence anchors — these are the section names inside the
    // executor prompt the callout binds to.
    for (const anchor of ['<execute_tasks>', '<self_check>', '<summary_creation>', '<state_updates>', '<final_commit>']) {
      assert.ok(
        content.includes(anchor),
        `callout must reference sequence anchor ${anchor} (it ties the invariant to the prose steps)`
      );
    }
  });
});
