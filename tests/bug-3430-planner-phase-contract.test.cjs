// allow-test-rule: source-text-is-the-product
// Planner markdown is the deployed planning contract; these checks lock the
// exact canonical forms that downstream phase-plan-index accepts.

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const PLANNER_PATH = path.join(__dirname, '..', 'agents', 'gsd-planner.md');

function readPlanner() {
  return fs.readFileSync(PLANNER_PATH, 'utf8');
}

test('#3430: planner SUMMARY instruction uses canonical padded phase/plan form', () => {
  const content = readPlanner();
  assert.match(
    content,
    /Create `\.planning\/phases\/XX-name\/\{padded_phase\}-\{plan\}-SUMMARY\.md` when done/,
    'planner must instruct executors to write SUMMARY files in canonical padded-phase form'
  );
  assert.doesNotMatch(
    content,
    /After completion, create `\.planning\/phases\/XX-name\/\{phase\}-\{plan\}-SUMMARY\.md`/,
    'planner must not instruct the broken {phase}-{plan}-SUMMARY.md form'
  );
});

test('#3430: planner depends_on docs show canonical in-phase plan ids', () => {
  const content = readPlanner();
  assert.match(
    content,
    /depends_on:[^\n]*Use `01-01`\/`01-01-auth-hardening`/,
    'planner must document canonical depends_on examples that phase-plan-index resolves'
  );
  assert.doesNotMatch(
    content,
    /depends_on:[^\n]*01-trust\/01/,
    'planner must not document phase-slug/plan-number depends_on examples as canonical'
  );
});
