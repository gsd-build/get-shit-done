// allow-test-rule: source-text-is-the-product
// The workflow .md IS the product: its text is loaded and interpreted at
// runtime by the agent host. Structural assertions (step existence, flag
// references in the initialize step) verify the deployed dispatch contract.
// Pure-function assertions on parseCodeReviewFlags / resolveCodeReviewWorkflow
// are IR-level (not raw-text-match) per CONTRIBUTING.md L554.

/**
 * Regression tests for #3727 — /gsd-code-review N --fix silently no-ops.
 *
 * Root cause: code-review.md `initialize` step parses only --depth and
 * --files flags. --fix, --all, and --auto are never parsed, so no dispatch
 * to code-review-fix.md ever occurs.
 *
 * Fix: add parseCodeReviewFlags() to code-review-flags.cjs (typed IR), wire
 * it into the workflow initialize step, and add a dispatch_fix step that
 * delegates to code-review-fix.md when flags.fix is true.
 */

'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const FLAGS_LIB = path.join(ROOT, 'get-shit-done', 'bin', 'lib', 'code-review-flags.cjs');
const WORKFLOW_PATH = path.join(ROOT, 'get-shit-done', 'workflows', 'code-review.md');

// ---------------------------------------------------------------------------
// Stage 2 seam: typed IR from parseCodeReviewFlags and resolveCodeReviewWorkflow
// These functions are the production code under test — not text-matching on
// the .md source.
// ---------------------------------------------------------------------------

const { parseCodeReviewFlags, resolveCodeReviewWorkflow } = require(FLAGS_LIB);

describe('#3727 — parseCodeReviewFlags: typed IR for code-review argv', () => {
  test('code-review workflow parses --fix flag and dispatches gsd-code-fixer', () => {
    // This is the invariant being violated: --fix must be captured into the IR
    // and must route to the fixer workflow, not be silently dropped.
    const flags = parseCodeReviewFlags(['2', '--fix']);
    assert.strictEqual(flags.fix, true,
      '--fix must set flags.fix = true');
    const workflow = resolveCodeReviewWorkflow(flags);
    assert.strictEqual(workflow, 'code-review-fix.md',
      '--fix must dispatch to code-review-fix.md, not code-review.md');
  });

  test('--fix absent: dispatch stays on code-review.md (review-only)', () => {
    // Counter-test (Stage 5 contract 6): omitting --fix must NOT dispatch fixer.
    const flags = parseCodeReviewFlags(['2']);
    assert.strictEqual(flags.fix, false,
      'Without --fix, flags.fix must be false');
    const workflow = resolveCodeReviewWorkflow(flags);
    assert.strictEqual(workflow, 'code-review.md',
      'Without --fix, dispatch must stay on code-review.md');
  });

  test('--all implies --fix', () => {
    const flags = parseCodeReviewFlags(['3', '--all']);
    assert.strictEqual(flags.fix, true,
      '--all must imply flags.fix = true');
    assert.strictEqual(flags.all, true,
      '--all must set flags.all = true');
    const workflow = resolveCodeReviewWorkflow(flags);
    assert.strictEqual(workflow, 'code-review-fix.md',
      '--all must dispatch to code-review-fix.md');
  });

  test('--auto implies --fix', () => {
    const flags = parseCodeReviewFlags(['3', '--auto']);
    assert.strictEqual(flags.fix, true,
      '--auto must imply flags.fix = true');
    assert.strictEqual(flags.auto, true,
      '--auto must set flags.auto = true');
    const workflow = resolveCodeReviewWorkflow(flags);
    assert.strictEqual(workflow, 'code-review-fix.md',
      '--auto must dispatch to code-review-fix.md');
  });

  test('--fix --all --auto all set simultaneously', () => {
    const flags = parseCodeReviewFlags(['1', '--fix', '--all', '--auto']);
    assert.strictEqual(flags.fix, true);
    assert.strictEqual(flags.all, true);
    assert.strictEqual(flags.auto, true);
    assert.strictEqual(resolveCodeReviewWorkflow(flags), 'code-review-fix.md');
  });

  test('--depth flag is still parsed alongside --fix (no regression)', () => {
    const flags = parseCodeReviewFlags(['2', '--depth=deep', '--fix']);
    assert.strictEqual(flags.fix, true);
    assert.strictEqual(flags.depth, 'deep');
    assert.strictEqual(resolveCodeReviewWorkflow(flags), 'code-review-fix.md');
  });

  test('--files flag is still parsed alongside --fix (no regression)', () => {
    const flags = parseCodeReviewFlags(['2', '--files=src/foo.ts,src/bar.ts', '--fix']);
    assert.strictEqual(flags.fix, true);
    assert.strictEqual(flags.files, 'src/foo.ts,src/bar.ts');
  });

  test('empty argv returns all-false IR', () => {
    const flags = parseCodeReviewFlags([]);
    assert.strictEqual(flags.fix, false);
    assert.strictEqual(flags.all, false);
    assert.strictEqual(flags.auto, false);
    assert.strictEqual(flags.depth, '');
    assert.strictEqual(flags.files, '');
  });
});

// ---------------------------------------------------------------------------
// Docs-parity: the workflow .md must contain the dispatch_fix step and
// reference code-review-flags.cjs in the initialize step.
// These are structural invariants on the deployed product text.
// Source-text-is-the-product exemption applies (see file header).
// ---------------------------------------------------------------------------

describe('#3727 — code-review.md structural dispatch contract', () => {
  const src = fs.readFileSync(WORKFLOW_PATH, 'utf8');

  test('initialize step references code-review-flags.cjs for flag parsing', () => {
    const initStart = src.indexOf('<step name="initialize">');
    const initEnd = src.indexOf('</step>', initStart);
    assert.ok(initStart !== -1, 'workflow must have an initialize step');
    const initSection = src.slice(initStart, initEnd);
    assert.ok(
      initSection.includes('code-review-flags.cjs'),
      'initialize step must reference code-review-flags.cjs to parse --fix/--all/--auto flags'
    );
  });

  test('workflow has a <step name="dispatch_fix"> step', () => {
    assert.ok(
      src.includes('<step name="dispatch_fix">'),
      'code-review.md must have a dispatch_fix step (missing = --fix is silently no-op)'
    );
  });

  test('dispatch_fix step delegates to code-review-fix.md when fix flag is true', () => {
    const stepStart = src.indexOf('<step name="dispatch_fix">');
    const stepEnd = src.indexOf('</step>', stepStart);
    assert.ok(stepStart !== -1, 'dispatch_fix step must exist');
    const stepSection = src.slice(stepStart, stepEnd);
    assert.ok(
      stepSection.includes('code-review-fix.md'),
      'dispatch_fix step must reference code-review-fix.md workflow'
    );
  });

  test('dispatch_fix step references gsd-code-fixer agent (via code-review-fix.md chain)', () => {
    // The dispatch step must show that fixing will occur, either directly or
    // by loading code-review-fix.md (which in turn spawns gsd-code-fixer).
    const stepStart = src.indexOf('<step name="dispatch_fix">');
    const stepEnd = src.indexOf('</step>', stepStart);
    const stepSection = src.slice(stepStart, stepEnd);
    assert.ok(
      stepSection.includes('gsd-code-fixer') || stepSection.includes('code-review-fix.md'),
      'dispatch_fix step must reference gsd-code-fixer agent or code-review-fix.md workflow'
    );
  });
});
