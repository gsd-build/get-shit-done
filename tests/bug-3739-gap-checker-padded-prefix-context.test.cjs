/**
 * Bug #3739: gap-analysis silently skips CONTEXT.md decisions when the file
 * uses the padded-prefix convention (e.g. 01-CONTEXT.md, 02.1-CONTEXT.md).
 *
 * Verifies:
 *   1. Padded-prefix CONTEXT.md (NN-CONTEXT.md) decisions ARE included in the
 *      gap report — was silently skipped before the fix.
 *   2. Decisions from padded-prefix CONTEXT.md ARE checked for coverage.
 *   3. Bare CONTEXT.md still works — no regression on the existing path.
 *   4. A padded-prefix decision that is NOT covered in the plan is surfaced
 *      as "Not covered" (not silently dropped from the report).
 *   5. planning-workspace.cjs findContextMdIn() helper returns the right
 *      filename for both bare and padded forms (unit test for the extractor).
 */

'use strict';

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

const REPO_ROOT = path.join(__dirname, '..');

describe('bug #3739 — gap-analysis padded-prefix CONTEXT.md', () => {
  let tmpDir;
  let phaseDir;

  function writeRequirements(ids) {
    const lines = ids.map((id, i) => `- [ ] **${id}** Requirement ${i + 1}`);
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'REQUIREMENTS.md'),
      `# Requirements\n\n${lines.join('\n')}\n`
    );
  }

  function writeContextAs(filename, decisions) {
    const dLines = decisions.map(d => `- **${d.id}:** ${d.text}`).join('\n');
    fs.writeFileSync(
      path.join(phaseDir, filename),
      `# Phase Context\n\n<decisions>\n## Implementation Decisions\n\n${dLines}\n</decisions>\n`
    );
  }

  function writePlan(name, body) {
    fs.writeFileSync(path.join(phaseDir, `${name}-PLAN.md`), body);
  }

  function ensureConfig() {
    const r = runGsdTools('config-ensure-section', tmpDir);
    assert.ok(r.success, `config-ensure-section failed: ${r.error}`);
  }

  beforeEach(() => {
    tmpDir = createTempProject();
    phaseDir = path.join(tmpDir, '.planning', 'phases', '01-test');
    fs.mkdirSync(phaseDir, { recursive: true });
    ensureConfig();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  // ── Test 1: padded-prefix decisions appear in the gap report ─────────────

  test('decisions from padded-prefix CONTEXT.md (01-CONTEXT.md) appear in gap report', () => {
    writeContextAs('01-CONTEXT.md', [
      { id: 'D-01', text: 'Use library X' },
      { id: 'D-02', text: 'Fail loud on unknown input' },
    ]);
    writePlan('01', '# Plan\n\nImplements D-01 and D-02.\n');

    const r = runGsdTools(['gap-analysis', '--phase-dir', phaseDir], tmpDir);
    assert.ok(r.success, `gap-analysis failed: ${r.error}`);
    const out = JSON.parse(r.output);

    const d01 = out.rows.find(x => x.item === 'D-01');
    const d02 = out.rows.find(x => x.item === 'D-02');

    assert.ok(d01, 'D-01 row must appear in gap report when CONTEXT.md uses padded-prefix 01-CONTEXT.md');
    assert.ok(d02, 'D-02 row must appear in gap report when CONTEXT.md uses padded-prefix 01-CONTEXT.md');
    assert.strictEqual(d01.source, 'CONTEXT.md', 'source label must be CONTEXT.md');
    assert.strictEqual(d01.status, 'Covered', 'D-01 is mentioned in plan — must be Covered');
    assert.strictEqual(d02.status, 'Covered', 'D-02 is mentioned in plan — must be Covered');
  });

  // ── Test 2: uncovered padded-prefix decision surfaces as Not covered ──────

  test('uncovered decision from padded-prefix CONTEXT.md surfaces as Not covered', () => {
    writeContextAs('01-CONTEXT.md', [
      { id: 'D-01', text: 'Use library X' },
    ]);
    writePlan('01', '# Plan\n\nUnrelated work, no mention of any D-NN.\n');

    const r = runGsdTools(['gap-analysis', '--phase-dir', phaseDir], tmpDir);
    assert.ok(r.success, `gap-analysis failed: ${r.error}`);
    const out = JSON.parse(r.output);

    const d01 = out.rows.find(x => x.item === 'D-01');
    assert.ok(d01, 'D-01 row must appear even when not covered');
    assert.strictEqual(d01.status, 'Not covered',
      'D-01 must be Not covered (not silently absent) when plan omits it');
  });

  // ── Test 3 (counter-test): bare CONTEXT.md still works — no regression ───

  test('bare CONTEXT.md still works (regression guard)', () => {
    writeContextAs('CONTEXT.md', [
      { id: 'D-05', text: 'Bare form decision' },
    ]);
    writePlan('01', '# Plan\n\nImplements D-05.\n');

    const r = runGsdTools(['gap-analysis', '--phase-dir', phaseDir], tmpDir);
    assert.ok(r.success, `gap-analysis failed: ${r.error}`);
    const out = JSON.parse(r.output);

    const d05 = out.rows.find(x => x.item === 'D-05');
    assert.ok(d05, 'D-05 must appear when CONTEXT.md uses bare filename');
    assert.strictEqual(d05.status, 'Covered', 'D-05 must be Covered');
  });

  // ── Test 4: deeper padded prefix (02.1-CONTEXT.md) ───────────────────────

  test('multi-segment padded prefix (02.1-CONTEXT.md) decisions appear in gap report', () => {
    writeContextAs('02.1-CONTEXT.md', [
      { id: 'D-03', text: 'Use postgres' },
    ]);
    writePlan('01', '# Plan\n\nImplements D-03.\n');

    const r = runGsdTools(['gap-analysis', '--phase-dir', phaseDir], tmpDir);
    assert.ok(r.success, `gap-analysis failed: ${r.error}`);
    const out = JSON.parse(r.output);

    const d03 = out.rows.find(x => x.item === 'D-03');
    assert.ok(d03, 'D-03 must appear from 02.1-CONTEXT.md');
    assert.strictEqual(d03.status, 'Covered');
  });

  // ── Test 5: findContextMdIn helper unit test ─────────────────────────────

  test('findContextMdIn helper returns padded filename when present', () => {
    const { findContextMdIn } = require('../get-shit-done/bin/lib/planning-workspace.cjs');
    // Write 01-CONTEXT.md into the phase dir (already created in beforeEach)
    fs.writeFileSync(path.join(phaseDir, '01-CONTEXT.md'), '# context\n');

    const found = findContextMdIn(phaseDir);
    assert.strictEqual(found, '01-CONTEXT.md',
      'findContextMdIn must return the padded-prefix filename');
  });

  test('findContextMdIn helper returns bare filename when only bare form exists', () => {
    const { findContextMdIn } = require('../get-shit-done/bin/lib/planning-workspace.cjs');
    fs.writeFileSync(path.join(phaseDir, 'CONTEXT.md'), '# context\n');

    const found = findContextMdIn(phaseDir);
    assert.strictEqual(found, 'CONTEXT.md',
      'findContextMdIn must return CONTEXT.md for bare form');
  });

  test('findContextMdIn helper returns null when no CONTEXT.md exists', () => {
    const { findContextMdIn } = require('../get-shit-done/bin/lib/planning-workspace.cjs');
    // phaseDir exists but is empty (no CONTEXT.md)
    const found = findContextMdIn(phaseDir);
    assert.strictEqual(found, null,
      'findContextMdIn must return null when no CONTEXT.md exists');
  });

  // ── Test 5b: findContextMdIn accepts pre-read files array (avoids double readdirSync) ──

  test('findContextMdIn accepts an already-read files array (avoids double readdirSync)', () => {
    const { findContextMdIn } = require('../get-shit-done/bin/lib/planning-workspace.cjs');
    // Passing an array directly should behave identically to passing a directory path.
    assert.strictEqual(findContextMdIn(['CONTEXT.md', 'other.md']), 'CONTEXT.md',
      'bare form found in array');
    assert.strictEqual(findContextMdIn(['01-CONTEXT.md', 'other.md']), '01-CONTEXT.md',
      'padded form found in array');
    assert.strictEqual(findContextMdIn(['unrelated.md']), null,
      'returns null when no CONTEXT.md in array');
    // Bare wins over padded when both are present
    assert.strictEqual(findContextMdIn(['01-CONTEXT.md', 'CONTEXT.md']), 'CONTEXT.md',
      'bare form preferred over padded form when both in array');
  });

  // ── Test 6: dual-file precedence — bare CONTEXT.md wins over padded form ──

  test('findContextMdIn prefers bare CONTEXT.md over padded form (helper level)', () => {
    const { findContextMdIn } = require('../get-shit-done/bin/lib/planning-workspace.cjs');
    // Write BOTH forms into the phase directory
    fs.writeFileSync(path.join(phaseDir, 'CONTEXT.md'), '# bare context\n');
    fs.writeFileSync(path.join(phaseDir, '01-CONTEXT.md'), '# padded context\n');

    const found = findContextMdIn(phaseDir);
    assert.strictEqual(found, 'CONTEXT.md',
      'findContextMdIn must return bare CONTEXT.md when both forms exist — matches pre-refactor gap-checker behavior');
  });

  test('gap-analysis uses bare CONTEXT.md decisions when both forms exist (integration level)', () => {
    // Bare form has D-BARE; padded form has D-PADDED.
    // If the integration path resolves bare correctly, only D-BARE appears in the report.
    const bareContent =
      '# Phase Context\n\n<decisions>\n## Implementation Decisions\n\n- **D-BARE:** From bare form\n</decisions>\n';
    const paddedContent =
      '# Phase Context\n\n<decisions>\n## Implementation Decisions\n\n- **D-PADDED:** From padded form\n</decisions>\n';
    fs.writeFileSync(path.join(phaseDir, 'CONTEXT.md'), bareContent);
    fs.writeFileSync(path.join(phaseDir, '01-CONTEXT.md'), paddedContent);

    writePlan('01', '# Plan\n\nImplements D-BARE.\n');

    const r = runGsdTools(['gap-analysis', '--phase-dir', phaseDir], tmpDir);
    assert.ok(r.success, `gap-analysis failed: ${r.error}`);
    const out = JSON.parse(r.output);

    const dBare = out.rows.find(x => x.item === 'D-BARE');
    const dPadded = out.rows.find(x => x.item === 'D-PADDED');

    assert.ok(dBare, 'D-BARE (from bare CONTEXT.md) must appear in gap report');
    assert.ok(!dPadded, 'D-PADDED (from 01-CONTEXT.md) must NOT appear — bare form takes precedence');
    assert.strictEqual(dBare.status, 'Covered', 'D-BARE must be Covered');
  });
});
