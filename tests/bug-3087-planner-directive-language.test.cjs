'use strict';

// Regression guard for bug #3087.
//
// Between v1.38.3 and v1.38.4, agents/gsd-planner.md had 10 instances of
// CRITICAL/MANDATORY/ALWAYS/MUST directive emphasis systematically removed.
// The change was undocumented and conflicts with the stated intent of PR #2489
// (the sycophancy-hardening pass that shipped in the same release). This test
// enforces the restored directive language so the demotion cannot recur silently.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
let src;
try {
  src = fs.readFileSync(path.join(ROOT, 'agents', 'gsd-planner.md'), 'utf8');
} catch (err) {
  throw new Error(`agents/gsd-planner.md not found — was the file renamed? (${err.message})`);
}

const directives = [
  { desc: 'User Decision Fidelity heading is CRITICAL',         pattern: /## CRITICAL: User Decision Fidelity/ },
  { desc: 'Never Simplify heading is CRITICAL',                 pattern: /## CRITICAL: Never Simplify User Decisions/ },
  { desc: 'Multi-Source Audit heading is MANDATORY',            pattern: /## Multi-Source Coverage Audit \(MANDATORY in every plan set\)/ },
  { desc: 'Source audit uses "Audit ALL" imperative',           pattern: /Audit ALL four source types before finalizing/ },
  { desc: 'Discovery is MANDATORY',                             pattern: /Discovery is MANDATORY unless/ },
  { desc: 'Split signals use ALWAYS',                           pattern: /\*\*ALWAYS split if:\*\*/ },
  { desc: 'requirements field doc uses MUST',                   pattern: /\*\*MUST\*\* list requirement IDs from ROADMAP/ },
  { desc: 'Step 0 has CRITICAL requirement ID directive',       pattern: /\*\*CRITICAL:\*\* Every requirement ID MUST appear/ },
  { desc: 'Write tool directive uses ALWAYS',                   pattern: /\*\*ALWAYS use the Write tool to create files\*\*/ },
  { desc: 'File naming convention heading is CRITICAL',         pattern: /\*\*CRITICAL — File naming convention \(enforced\):\*\*/ },
];

for (const { desc, pattern } of directives) {
  test(`gsd-planner.md: ${desc}`, () => {
    assert.ok(
      pattern.test(src),
      `Directive enforcement missing from gsd-planner.md: "${desc}" — pattern ${pattern} not found. ` +
      `This language was demoted in v1.38.4 (PR #2489) without documentation, conflicting with ` +
      `the sycophancy-hardening intent of that release. See bug #3087.`,
    );
  });
}
