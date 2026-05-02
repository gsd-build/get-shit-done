'use strict';

// allow-test-rule: source-text-is-the-product
// Reads .md/.json/.yml product files whose deployed text IS what the
// runtime loads — testing text content tests the deployed contract.

/**
 * Regression — issue #2770
 *
 * `roadmap.annotate-dependencies` crashes with
 * `TypeError: t.trim is not a function` when must_haves.truths contains a
 * non-string scalar (e.g., a YAML int like `- 3` interpreted by an upstream
 * parser as a number, or a kv-shaped item whose value is numeric).
 *
 * The original guard `if (typeof t !== 'string') continue` skipped silently —
 * which avoids the crash but **drops the constraint from cross-cutting
 * analysis**. The required behaviour is to **coerce, not skip**: a numeric
 * scalar `3` must be surfaced as the string "3", and a kv-shaped truth like
 * `{ title: "X", count: 3 }` must contribute its title to the analysis.
 *
 * The two literal cases called out in the issue title (bare-int `depends_on`
 * values) are also exercised here as regression guards on the frontmatter
 * parser to prove the dependency is preserved as a string and never dropped.
 */

const { test, describe, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');
const { extractFrontmatter } = require('../get-shit-done/bin/lib/frontmatter.cjs');

function makePlanProject(files = {}) {
  const dir = createTempProject();
  fs.writeFileSync(path.join(dir, '.planning', 'ROADMAP.md'), '');
  fs.mkdirSync(path.join(dir, '.planning', 'phases', '01-foundation'), { recursive: true });
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, 'utf-8');
  }
  return dir;
}

const ROADMAP = [
  '# Roadmap',
  '',
  '### Phase 1: Foundation',
  '**Goal:** Set up project',
  '**Plans:** 2 plans',
  '',
  'Plans:',
  '- [ ] 01-01-PLAN.md — Set up DB',
  '- [ ] 01-02-PLAN.md — Build API',
  '',
].join('\n');

// PLAN where must_haves.truths includes a bare numeric scalar AND a kv-shaped
// item whose value is numeric — both must be surfaced as cross-cutting
// constraints when shared across plans, not silently dropped.
const PLAN_NUMERIC_TRUTH = (wave, sharedTitle) => [
  '---',
  'phase: "1"',
  `plan: "01-0${wave}"`,
  'type: standard',
  `wave: ${wave}`,
  'depends_on: []',
  'files_modified: []',
  'autonomous: true',
  'must_haves:',
  '  truths:',
  `    - title: ${sharedTitle}`,
  '      count: 3',
  '    - 42',
  '  artifacts: []',
  '  key_links: []',
  '---',
  '',
  `<objective>Plan ${wave}</objective>`,
  '',
].join('\n');

describe('bug #2770 — non-string truths must be coerced, not dropped', () => {
  let tmpDir;
  afterEach(() => cleanup(tmpDir));

  test('numeric scalar truth shared across 2+ plans is surfaced as cross-cutting constraint', () => {
    // Both plans share the numeric truth `42`. Pre-fix: silently dropped by
    // `typeof t !== 'string' continue`, so cross_cutting_constraints == 0.
    // Post-fix: coerced to "42" and surfaced as a constraint.
    const PLAN_BARE_INT_TRUTH = (wave) => [
      '---',
      'phase: "1"',
      `plan: "01-0${wave}"`,
      'type: standard',
      `wave: ${wave}`,
      'depends_on: []',
      'files_modified: []',
      'autonomous: true',
      'must_haves:',
      '  truths:',
      '    - 42',
      '  artifacts: []',
      '  key_links: []',
      '---',
      '',
      `<objective>Plan ${wave}</objective>`,
      '',
    ].join('\n');
    tmpDir = makePlanProject({
      '.planning/ROADMAP.md': ROADMAP,
      '.planning/phases/01-foundation/01-01-PLAN.md': PLAN_BARE_INT_TRUTH(1),
      '.planning/phases/01-foundation/01-02-PLAN.md': PLAN_BARE_INT_TRUTH(2),
    });

    const result = runGsdTools('roadmap annotate-dependencies 1', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const out = JSON.parse(result.output);
    assert.strictEqual(
      out.cross_cutting_constraints,
      1,
      'numeric truth shared across plans must be surfaced (coerced), not dropped'
    );

    const roadmap = fs.readFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), 'utf-8');
    assert.ok(roadmap.includes('Cross-cutting constraints:'),
      'cross-cutting subsection present');
    assert.ok(/-\s*42\b/.test(roadmap),
      'numeric truth "42" surfaced as a string in the roadmap');
  });

  test('kv-shaped truth with numeric value uses title and contributes to cross-cutting analysis', () => {
    // Both plans share `{ title: 'shared-rule', count: 3 }`. Pre-fix:
    // typeof === 'object' so silently skipped → constraint dropped.
    // Post-fix: title extracted, surfaced in cross-cutting subsection.
    tmpDir = makePlanProject({
      '.planning/ROADMAP.md': ROADMAP,
      '.planning/phases/01-foundation/01-01-PLAN.md': PLAN_NUMERIC_TRUTH(1, 'shared-rule'),
      '.planning/phases/01-foundation/01-02-PLAN.md': PLAN_NUMERIC_TRUTH(2, 'shared-rule'),
    });

    const result = runGsdTools('roadmap annotate-dependencies 1', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const out = JSON.parse(result.output);
    // Both plans share two truths: the kv-shaped { title: 'shared-rule', ... }
    // and the bare numeric 42. Pre-fix neither would survive the typeof guard;
    // post-fix both are coerced and surfaced.
    assert.strictEqual(
      out.cross_cutting_constraints,
      2,
      'kv-shaped truth and numeric truth both surface, not dropped'
    );

    const roadmap = fs.readFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), 'utf-8');
    assert.ok(roadmap.includes('shared-rule'),
      'title from kv-shaped truth surfaced in cross-cutting list');
    assert.ok(/-\s*42\b/.test(roadmap),
      'numeric truth surfaced as a string');
  });
});

describe('bug #2770 — bare-int depends_on values parse as preserved strings', () => {
  test('scalar bare-int depends_on parses as string "3" (not dropped, not numeric)', () => {
    // Per issue title: a YAML scalar `depends_on: 3` must be preserved as the
    // string "3". The frontmatter parser already returns strings here; this
    // test pins the behaviour so a future "convert YAML scalars to numbers"
    // optimization cannot silently regress dependency tracking.
    const fm = extractFrontmatter([
      '---',
      'phase: "1"',
      'plan: "01"',
      'depends_on: 3',
      '---',
      'body',
      '',
    ].join('\n'));
    assert.strictEqual(typeof fm.depends_on, 'string',
      'scalar depends_on must remain a string after parse');
    assert.strictEqual(fm.depends_on, '3',
      'bare int 3 must be preserved as the string "3"');
  });

  test('inline-array bare-int depends_on parses to ["3","4"] (preserved as strings)', () => {
    const fm = extractFrontmatter([
      '---',
      'phase: "1"',
      'plan: "01"',
      'depends_on: [3, 4]',
      '---',
      'body',
      '',
    ].join('\n'));
    assert.ok(Array.isArray(fm.depends_on),
      'inline array depends_on must be an array');
    assert.deepStrictEqual(fm.depends_on, ['3', '4'],
      'bare ints in inline array must be preserved as strings — never dropped');
    // Critical: assert *length* matches input. A naive `if (typeof !== string) continue`
    // would silently drop entries; we must coerce, not skip.
    assert.strictEqual(fm.depends_on.length, 2,
      'no dependency may be silently dropped during coercion');
  });
});
