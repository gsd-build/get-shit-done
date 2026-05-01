'use strict';

// allow-test-rule: pending-migration-to-typed-ir [#2974]
// Tracked in #2974 for migration to typed-IR assertions per CONTRIBUTING.md
// "Prohibited: Raw Text Matching on Test Outputs". Per-file review may
// reclassify some entries as source-text-is-the-product during migration.

/**
 * Bugs #2549, #2550, #2552: discuss-phase context bloat and cache invalidation.
 *
 * #2549: load_prior_context must cap prior CONTEXT.md reads (was O(phases))
 * #2550: scout_codebase must select maps by phase type (was always all 7)
 * #2552: scout_codebase must not instruct split reads of the same file
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const DISCUSS_PHASE = path.join(
  __dirname, '..', 'get-shit-done', 'workflows', 'discuss-phase.md',
);
// After #2551 progressive-disclosure refactor, the scout_codebase phase-type
// table and split-reads warning live in references/scout-codebase.md.
const SCOUT_REF = path.join(
  __dirname, '..', 'get-shit-done', 'references', 'scout-codebase.md',
);

function readDiscussContext() {
  // Both files are required after #2551 — fail loudly if either is missing
  // rather than silently weakening the regression coverage.
  for (const p of [DISCUSS_PHASE, SCOUT_REF]) {
    assert.ok(fs.existsSync(p), `Required discuss-phase context source missing: ${p}`);
  }
  return [DISCUSS_PHASE, SCOUT_REF].map(p => fs.readFileSync(p, 'utf-8')).join('\n');
}

describe('discuss-phase context fixes (#2549, #2550, #2552)', () => {
  let src;
  test('discuss-phase.md source exists', () => {
    assert.ok(fs.existsSync(DISCUSS_PHASE), 'discuss-phase.md must exist');
    assert.ok(
      fs.existsSync(SCOUT_REF),
      'references/scout-codebase.md must exist after #2551 extraction',
    );
    src = readDiscussContext();
  });

  // ─── #2549: load_prior_context cap ──────────────────────────────────────
  test('#2549: load_prior_context must NOT instruct reading ALL prior CONTEXT.md files', () => {
    if (!src) src = readDiscussContext();
    assert.ok(
      !src.includes('For each CONTEXT.md where phase number < current phase'),
      'load_prior_context must not unboundedly read all prior CONTEXT.md files',
    );
  });

  test('#2549: load_prior_context must reference a bounded read (3 phases or DECISIONS-INDEX)', () => {
    // Read ONLY the parent file — `src.includes('3')` against the
    // concatenated source can be satisfied by unrelated occurrences of "3"
    // in scout-codebase.md (e.g., "3-5 most relevant files"), masking a
    // regression where the parent drops the bounded-read instruction.
    const parent = fs.readFileSync(DISCUSS_PHASE, 'utf-8');
    const hasBound = /\b(?:most recent|latest|last|up to)\s+3\b[\s\S]{0,160}\bprior CONTEXT\.md\b/i.test(parent);
    const hasIndex = parent.includes('DECISIONS-INDEX.md');
    assert.ok(
      hasBound || hasIndex,
      'load_prior_context must reference a bounded read (e.g., most recent 3 phases) or DECISIONS-INDEX.md',
    );
  });

  // ─── #2550: scout_codebase phase-type selection ──────────────────────────
  test('#2550: scout_codebase must not instruct reading all 7 codebase maps', () => {
    if (!src) src = readDiscussContext();
    assert.ok(
      !src.includes('Read the most relevant ones (CONVENTIONS.md, STRUCTURE.md, STACK.md based on phase type)'),
      'scout_codebase must not use the old vague "most relevant" instruction without a selection table',
    );
  });

  test('#2550: scout_codebase must include a phase-type-to-maps selection table', () => {
    if (!src) src = readDiscussContext();
    // The table maps phase types to specific map selections
    assert.ok(
      src.includes('Phase type') && src.includes('Read these maps'),
      'scout_codebase must include a phase-type to map-selection table',
    );
    // Key phase types must be covered
    assert.ok(src.includes('UI') || src.includes('frontend'), 'Table must cover UI/frontend phases');
    assert.ok(src.includes('Backend') || src.includes('API'), 'Table must cover backend phases');
    assert.ok(src.includes('Testing'), 'Table must cover testing phases');
    assert.ok(src.includes('Mixed'), 'Table must have a fallback for mixed/unclear phases');
  });

  // ─── #2552: no split reads ───────────────────────────────────────────────
  test('#2552: scout_codebase must explicitly prohibit split reads of the same file', () => {
    if (!src) src = readDiscussContext();
    const prohibitsSplit = src.includes('split reads') || src.includes('split read');
    assert.ok(
      prohibitsSplit,
      'scout_codebase must explicitly warn against split reads (same file, two offsets) that break prompt cache',
    );
  });
});
