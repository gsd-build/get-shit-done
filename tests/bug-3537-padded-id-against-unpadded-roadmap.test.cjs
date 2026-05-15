/**
 * Regression tests for bug #3537
 *
 * Phase-state verbs silently no-op on projects whose ROADMAP.md prose uses
 * un-padded phase numbers (e.g. `### Phase 2.7:`) while callers pass the padded
 * form (`02.7`). GSD 1.42.1 added `phaseMarkdownRegexSource()` as the canonical
 * padding-tolerant helper but wired it into only 1 of 8 affected functions —
 * the other 7 still used raw `escapeRegex(phaseNum)` (or partial
 * `0*${escapeRegex(...)}` which tolerates extra padding but not missing) and
 * never matched.
 *
 * These parity tests, one per affected verb, assert that padded (`02.7`) and
 * un-padded (`2.7`) inputs produce identical results against ROADMAP fixtures
 * with un-padded prose. Pre-fix, padded calls return `found: false` /
 * "Phase ... not found" while un-padded succeed — the parity assertion fails.
 * Post-fix, both succeed identically.
 *
 * Per maintainer's brief (gsd-build/get-shit-done#3537), these are behavioral:
 * each test runs the CLI via `runGsdTools` and parses JSON output. For write
 * verbs that may emit success-shaped JSON even when the underlying mutation
 * was a no-op, the test additionally asserts byte-equality of the resulting
 * ROADMAP.md across two parallel fixtures — that's structural equality, not
 * substring grepping.
 */

'use strict';

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { runGsdTools, createTempGitProject, cleanup } = require('./helpers.cjs');

// ROADMAP fixture with UN-padded phase prose. Includes one integer-numbered
// parent (`Phase 2`) and one decimal child (`Phase 2.7`) so verbs that need a
// numbering anchor (`phase next-decimal`, `phase insert`) have one, and the
// bug surface (padded `02.7` caller vs un-padded `2.7` prose) is exercised.
function writeRoadmap(tmpDir) {
  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'ROADMAP.md'),
    [
      '# Roadmap v1.0',
      '',
      '## Phases',
      '',
      '- [ ] Phase 2: Parent phase',
      '- [ ] Phase 2.7: Sample padding-test phase',
      '',
      '### Phase 2: Parent phase',
      '**Goal:** Parent goal',
      '**Plans:** 0/0 plans complete',
      '',
      '### Phase 2.7: Sample padding-test phase',
      '**Goal:** Verify padding-tolerant phase-ID matching.',
      '**Depends on:** 2',
      '**Plans:** 1/2 plans complete',
      '',
      'Some description here.',
      '',
    ].join('\n')
  );
}

// Phase 2.7 directory + minimal plan/summary fixture for verbs that scan disk
// before mutating ROADMAP (`phase complete`, `phase next-decimal`).
function writePhaseDir(tmpDir) {
  const phaseDir = path.join(tmpDir, '.planning', 'phases', '02.7-sample-padding-test-phase');
  fs.mkdirSync(phaseDir, { recursive: true });
  fs.writeFileSync(path.join(phaseDir, '01-PLAN.md'), '# Plan 1\n');
  fs.writeFileSync(path.join(phaseDir, '01-SUMMARY.md'), '# Summary 1\n');
  fs.writeFileSync(path.join(phaseDir, '02-PLAN.md'), '# Plan 2\n');
}

describe('bug #3537 — phase-state verbs tolerate un-padded ROADMAP prose with padded callers', () => {

  test('phaseMarkdownRegexSource is exported from core.cjs (helper relocation)', () => {
    // The 1.42.1 helper lived in roadmap.cjs but is needed by
    // getRoadmapPhaseInternal in core.cjs. Promoting to core.cjs lets all
    // three lib files share one definition without a circular import.
    const core = require('../get-shit-done/bin/lib/core.cjs');
    assert.strictEqual(
      typeof core.phaseMarkdownRegexSource, 'function',
      'phaseMarkdownRegexSource must be exported from core.cjs (#3537)'
    );
  });

  describe('parity — read verbs (shared fixture, two calls)', () => {
    let tmpDir;
    beforeEach(() => { tmpDir = createTempGitProject('bug-3537-read-'); writeRoadmap(tmpDir); });
    afterEach(() => cleanup(tmpDir));

    test('roadmap get-phase: padded "02.7" returns same JSON as unpadded "2.7"', () => {
      const padded = runGsdTools('roadmap get-phase 02.7', tmpDir);
      const unpadded = runGsdTools('roadmap get-phase 2.7', tmpDir);

      assert.ok(padded.success && unpadded.success,
        `padded.error=${padded.error}; unpadded.error=${unpadded.error}`);
      // get-phase honestly echoes the caller's phase_number in the response.
      // The bug is about whether the verb RESOLVES the same phase under both
      // pad-states — strip the input-echo before comparing the resolved data.
      const paddedJson = JSON.parse(padded.output);
      const unpaddedJson = JSON.parse(unpadded.output);
      delete paddedJson.phase_number;
      delete unpaddedJson.phase_number;
      assert.deepStrictEqual(
        paddedJson, unpaddedJson,
        'padded and unpadded phase IDs must resolve to the same phase data'
      );
    });

    test('roadmap annotate-dependencies: padded "02.7" annotates ROADMAP identically to unpadded "2.7"', (t) => {
      // annotate-dependencies only reaches the line-515 phase-header regex
      // when there are real plans with `wave` + `must_haves.truths` frontmatter
      // — without them, it short-circuits at precondition checks and both
      // pad-states return the same no-op (false GREEN). The richer fixture
      // below (two plans across two waves) ensures the line-515 regex is
      // actually exercised: pre-fix the padded caller's regex misses the
      // un-padded prose → `updated: false`, while unpadded succeeds →
      // `updated: true, waves: 2`. Parity broken pre-fix, restored post-fix.
      const PLAN = (wave, truth) => [
        '---',
        'phase: "2.7"',
        `plan: "01-0${wave}"`,
        'type: standard',
        `wave: ${wave}`,
        'depends_on: []',
        'files_modified: []',
        'autonomous: true',
        'must_haves:',
        '  truths:',
        `    - ${truth}`,
        '  artifacts: []',
        '  key_links: []',
        '---',
        '',
        `<objective>Plan ${wave} objective</objective>`,
        '',
      ].join('\n');

      const setupAnnotateFixture = (prefix) => {
        const dir = createTempGitProject(prefix);
        fs.writeFileSync(
          path.join(dir, '.planning', 'ROADMAP.md'),
          [
            '# Roadmap v1.0',
            '',
            '## Phases',
            '',
            '- [ ] Phase 2.7: Sample padding-test phase',
            '',
            '### Phase 2.7: Sample padding-test phase',
            '**Goal:** Verify padding-tolerant phase-ID matching.',
            '**Plans:** 2 plans',
            '',
            'Plans:',
            '- [ ] 01-01-PLAN.md — DB setup',
            '- [ ] 01-02-PLAN.md — API',
            '',
          ].join('\n')
        );
        const phaseDir = path.join(dir, '.planning', 'phases', '02.7-sample-padding-test-phase');
        fs.mkdirSync(phaseDir, { recursive: true });
        fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), PLAN(1, 'DB schema is correct'));
        fs.writeFileSync(path.join(phaseDir, '01-02-PLAN.md'), PLAN(2, 'API returns 200'));
        return dir;
      };

      const a = setupAnnotateFixture('bug-3537-annot-padded-');
      const b = setupAnnotateFixture('bug-3537-annot-unpad-');
      t.after(() => { cleanup(a); cleanup(b); });

      const padded = runGsdTools('roadmap annotate-dependencies 02.7', a);
      const unpadded = runGsdTools('roadmap annotate-dependencies 2.7', b);

      assert.ok(padded.success && unpadded.success,
        `padded.error=${padded.error}; unpadded.error=${unpadded.error}`);

      const roadmapA = fs.readFileSync(path.join(a, '.planning', 'ROADMAP.md'), 'utf-8');
      const roadmapB = fs.readFileSync(path.join(b, '.planning', 'ROADMAP.md'), 'utf-8');
      assert.strictEqual(
        roadmapA, roadmapB,
        'post-annotate ROADMAPs must be identical regardless of caller padding'
      );
    });
  });

  test('roadmap analyze: detects [x] checkbox when prose is un-padded but checklist is padded', (t) => {
    // The bug at cmdRoadmapAnalyze:252 is a different surface from caller-
    // padding: the checkbox regex is built from prose-form phaseNum but must
    // match the checklist, which the project may have authored in padded form.
    // Pre-fix `escapeRegex("2.7")` → `Phase\s+2\.7[:\s]` does not match the
    // checklist line `- [x] Phase 02.7:`. Post-fix `phaseMarkdownRegexSource`
    // prepends `0*` and the same call now matches the padded checklist.
    const tmp = createTempGitProject('bug-3537-analyze-mismatch-');
    fs.writeFileSync(
      path.join(tmp, '.planning', 'ROADMAP.md'),
      [
        '# Roadmap v1.0',
        '',
        '## Phases',
        '',
        '- [x] Phase 02.7: Sample padding-test phase',  // PADDED + CHECKED
        '',
        '### Phase 2.7: Sample padding-test phase',     // UN-PADDED prose
        '**Goal:** Verify padding-tolerant checkbox detection.',
        '',
      ].join('\n')
    );
    t.after(() => cleanup(tmp));

    const result = runGsdTools('roadmap analyze', tmp);
    assert.ok(result.success, `analyze failed: ${result.error}`);
    const json = JSON.parse(result.output);
    const phase27 = json.phases.find(p => p.number === '2.7');
    assert.ok(phase27, 'phase 2.7 should appear in analyze output');
    assert.strictEqual(
      phase27.roadmap_complete, true,
      'analyze must detect padded checklist [x] for an un-padded prose phase header'
    );
  });

  describe('parity — write verbs (separate fixture per pad-state, post-state compared)', () => {

    test('roadmap update-plan-progress: padded "02.7" mutates ROADMAP identically to unpadded "2.7"', (t) => {
      const a = createTempGitProject('bug-3537-upp-padded-');
      const b = createTempGitProject('bug-3537-upp-unpad-');
      writeRoadmap(a); writeRoadmap(b);
      writePhaseDir(a); writePhaseDir(b);
      t.after(() => { cleanup(a); cleanup(b); });

      const padded = runGsdTools('roadmap update-plan-progress 02.7', a);
      const unpadded = runGsdTools('roadmap update-plan-progress 2.7', b);

      assert.ok(padded.success && unpadded.success,
        `padded.error=${padded.error}; unpadded.error=${unpadded.error}`);
      const roadmapA = fs.readFileSync(path.join(a, '.planning', 'ROADMAP.md'), 'utf-8');
      const roadmapB = fs.readFileSync(path.join(b, '.planning', 'ROADMAP.md'), 'utf-8');
      assert.strictEqual(roadmapA, roadmapB,
        'post-update ROADMAPs must be identical regardless of caller padding');
    });

    test('phase complete: padded "02.7" mutates ROADMAP identically to unpadded "2.7"', (t) => {
      const a = createTempGitProject('bug-3537-complete-padded-');
      const b = createTempGitProject('bug-3537-complete-unpad-');
      writeRoadmap(a); writeRoadmap(b);
      writePhaseDir(a); writePhaseDir(b);
      t.after(() => { cleanup(a); cleanup(b); });

      const padded = runGsdTools('phase complete 02.7', a);
      const unpadded = runGsdTools('phase complete 2.7', b);

      assert.ok(padded.success && unpadded.success,
        `padded.error=${padded.error}; unpadded.error=${unpadded.error}`);
      const roadmapA = fs.readFileSync(path.join(a, '.planning', 'ROADMAP.md'), 'utf-8');
      const roadmapB = fs.readFileSync(path.join(b, '.planning', 'ROADMAP.md'), 'utf-8');
      assert.strictEqual(roadmapA, roadmapB,
        'post-complete ROADMAPs must be identical regardless of caller padding');
    });

    test('phase next-decimal: padded "02" suggests the same next decimal as unpadded "2"', (t) => {
      const a = createTempGitProject('bug-3537-next-padded-');
      const b = createTempGitProject('bug-3537-next-unpad-');
      writeRoadmap(a); writeRoadmap(b);
      writePhaseDir(a); writePhaseDir(b);
      t.after(() => { cleanup(a); cleanup(b); });

      // next-decimal scans for `Phase 0*${base}\.\d` occurrences. With unpadded
      // prose `Phase 2.7` and padded caller `02`, pre-fix the literal `0*${escaped}`
      // is `0*0*2` (technically tolerant of padding!) — but Brandon's diff drops
      // the redundant literal `0*` since the helper already prepends it.
      const padded = runGsdTools('phase next-decimal 02', a);
      const unpadded = runGsdTools('phase next-decimal 2', b);

      assert.ok(padded.success && unpadded.success,
        `padded.error=${padded.error}; unpadded.error=${unpadded.error}`);
      assert.deepStrictEqual(
        JSON.parse(padded.output), JSON.parse(unpadded.output),
        'padded and unpadded base phase IDs must produce the same next-decimal suggestion'
      );
    });

    test('phase insert: padded "02" inserts under same parent as unpadded "2"', (t) => {
      // cmdPhaseInsert signature: `phase insert <after-phase> <description>`.
      // Pass argv as an array so the description ("Inserted phase") isn't
      // split on whitespace. Pre-fix the line-724 regex uses the literal
      // `0*${escapeRegex(normalizedBase)}` which already tolerates padding
      // for integer bases — this test passes both ways and serves as a
      // regression guard against the helper-relocation breaking the existing
      // behavior.
      const a = createTempGitProject('bug-3537-insert-padded-');
      const b = createTempGitProject('bug-3537-insert-unpad-');
      writeRoadmap(a); writeRoadmap(b);
      writePhaseDir(a); writePhaseDir(b);
      t.after(() => { cleanup(a); cleanup(b); });

      const padded = runGsdTools(['phase', 'insert', '02', 'Inserted phase'], a);
      const unpadded = runGsdTools(['phase', 'insert', '2', 'Inserted phase'], b);

      assert.ok(padded.success && unpadded.success,
        `padded.error=${padded.error}; unpadded.error=${unpadded.error}`);
      const phasesA = fs.readdirSync(path.join(a, '.planning', 'phases')).sort();
      const phasesB = fs.readdirSync(path.join(b, '.planning', 'phases')).sort();
      assert.deepStrictEqual(phasesA, phasesB,
        'phase insert must create the same phase directory regardless of caller padding');
    });
  });
});
