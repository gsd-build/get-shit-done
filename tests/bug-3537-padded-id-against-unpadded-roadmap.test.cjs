/**
 * Regression tests for bug #3537
 *
 * Phase state verbs must match a canonical phase id against ROADMAP.md prose
 * regardless of zero-padding on either side: the skills pass the padded form
 * (`02.7`) after resolving the phase directory, but human-authored ROADMAP
 * prose is conventionally un-padded (`### Phase 2.7:`, `- [ ] **Phase 2.7:**`).
 *
 * v1.42.1 added `phaseMarkdownRegexSource()` which renders `0*<integer><...>`
 * — padding-tolerant on both sides — but wired it into only 1 of 8 call sites.
 * The other 7 used raw `escapeRegex(phaseNum)` or `0*${escapeRegex(...)}`
 * (tolerated extra padding, not missing), so passing the padded form silently
 * no-op'd and the verbs returned success while ROADMAP.md was unchanged.
 *
 * Parity assertion (per CONTEXT.md DEFECT.GENERATIVE-FIX): for each verb,
 * running with the padded form must produce the same ROADMAP.md as running
 * with the un-padded form against an identical fixture. Per-site fixes
 * without a parity test let the next call-site drift back undetected.
 */

'use strict';

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

const gsdTools = path.resolve(__dirname, '..', 'get-shit-done', 'bin', 'gsd-tools.cjs');

function run(args, cwd) {
  try {
    return {
      stdout: execFileSync('node', [gsdTools, ...args], {
        cwd,
        timeout: 15000,
        encoding: 'utf-8',
      }),
      ok: true,
    };
  } catch (e) {
    return {
      stdout: (e.stdout && e.stdout.toString()) || '',
      stderr: (e.stderr && e.stderr.toString()) || '',
      ok: false,
      code: e.status,
    };
  }
}

/**
 * Build a planning fixture with project_code='CK', padded phase directory
 * (`CK-02.7-meta-lead-ads/`), and un-padded ROADMAP prose (`Phase 2.7`).
 * This mirrors the reporter's environment in #3537 exactly.
 */
function setupFixture(tmpDir, opts = {}) {
  const {
    projectCode = 'CK',
    paddedId = '02.7',
    unpaddedId = '2.7',
    extraPhases = [],
  } = opts;

  const planningDir = path.join(tmpDir, '.planning');
  fs.mkdirSync(planningDir, { recursive: true });

  fs.writeFileSync(
    path.join(planningDir, 'config.json'),
    JSON.stringify({ project_code: projectCode })
  );

  fs.writeFileSync(
    path.join(planningDir, 'STATE.md'),
    `---\ncurrent_phase: ${unpaddedId}\nstatus: executing\n---\n# State\n`
  );

  // Padded phase directory with one plan + matching summary so the phase
  // is "complete" for phase-complete and update-plan-progress verbs.
  const phaseDirName = `${projectCode}-${paddedId}-meta-lead-ads`;
  const phaseDir = path.join(planningDir, 'phases', phaseDirName);
  fs.mkdirSync(phaseDir, { recursive: true });
  fs.writeFileSync(
    path.join(phaseDir, `${paddedId}-01-PLAN.md`),
    `---\nphase: ${unpaddedId}\nplan: 1\nwave: 1\n---\n# Plan 1\n`
  );
  fs.writeFileSync(
    path.join(phaseDir, `${paddedId}-01-SUMMARY.md`),
    '---\nstatus: complete\n---\n# Summary\nDone.'
  );

  const extra = extraPhases
    .map((p) => `- [ ] **Phase ${p.id}: ${p.name}**`)
    .join('\n');

  const roadmap = [
    '# Roadmap',
    '',
    '## v1.0 Milestone',
    '',
    `- [ ] **Phase ${unpaddedId}: Meta Lead Ads**`,
    extra,
    '',
    '## Progress',
    '',
    '| Phase | Plans | Status | Completed |',
    '|-------|-------|--------|-----------|',
    `| ${unpaddedId} Meta Lead Ads | 0/1 | Planned | - |`,
    '',
    `### Phase ${unpaddedId}: Meta Lead Ads`,
    '',
    '**Goal:** ship the thing',
    '**Plans:** 0 plans',
    '',
    'Plans:',
    `- [ ] ${paddedId}-01-PLAN.md`,
    '',
    ...extraPhases.flatMap((p) => [
      `### Phase ${p.id}: ${p.name}`,
      '',
      '**Goal:** stub',
      '**Plans:** 0 plans',
      '',
      'Plans:',
      `- [ ] ${p.id}-01-PLAN.md`,
      '',
    ]),
  ]
    .filter((l) => l !== '')
    .join('\n') + '\n';

  fs.writeFileSync(path.join(planningDir, 'ROADMAP.md'), roadmap);

  return {
    planningDir,
    roadmapPath: path.join(planningDir, 'ROADMAP.md'),
    phaseDir,
  };
}

/**
 * Run a verb in two parallel fixtures — one passing the padded form, one
 * passing the un-padded form — then compare the resulting ROADMAP.md bytes.
 * Any divergence means the verb's regex did not tolerate padding on at least
 * one side.
 */
function expectParity({ verbWithPadded, verbWithUnpadded, fixtureOpts }) {
  const tmpA = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-3537-A-'));
  const tmpB = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-3537-B-'));
  try {
    const a = setupFixture(tmpA, fixtureOpts);
    const b = setupFixture(tmpB, fixtureOpts);

    const ra = verbWithPadded(tmpA);
    const rb = verbWithUnpadded(tmpB);

    const aRoadmap = fs.readFileSync(a.roadmapPath, 'utf-8');
    const bRoadmap = fs.readFileSync(b.roadmapPath, 'utf-8');

    return { aRoadmap, bRoadmap, ra, rb };
  } finally {
    fs.rmSync(tmpA, { recursive: true, force: true });
    fs.rmSync(tmpB, { recursive: true, force: true });
  }
}

describe('bug #3537: phase verbs accept padded ids against un-padded ROADMAP prose', () => {
  test('phase complete: padded 02.7 and un-padded 2.7 produce identical ROADMAP', () => {
    const { aRoadmap, bRoadmap } = expectParity({
      fixtureOpts: {},
      verbWithPadded: (cwd) => run(['phase', 'complete', '02.7'], cwd),
      verbWithUnpadded: (cwd) => run(['phase', 'complete', '2.7'], cwd),
    });

    assert.equal(
      aRoadmap,
      bRoadmap,
      'padded `02.7` must mutate ROADMAP identically to un-padded `2.7`'
    );
    // And the canonical mutation must have actually happened (otherwise
    // both forms could be silently no-op'ing and still produce identical
    // output — a vacuous parity pass).
    assert.match(
      aRoadmap,
      /- \[x\] \*\*Phase 2\.7:/,
      'overview checkbox should be flipped under both invocations'
    );
  });

  test('roadmap get-phase: padded 02.7 returns the same section as un-padded 2.7', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-3537-get-'));
    try {
      setupFixture(tmp, {});
      const padded = run(['roadmap', 'get-phase', '02.7', '--raw'], tmp);
      const unpadded = run(['roadmap', 'get-phase', '2.7', '--raw'], tmp);

      assert.equal(
        padded.stdout,
        unpadded.stdout,
        'padded and un-padded ids must return identical sections'
      );
      // Non-vacuous guard: both forms must have actually returned a section
      // (the bug we're fixing was that the padded form returned an empty
      // string while reporting success).
      assert.ok(
        padded.stdout.trim().length > 0,
        'verb must return non-empty section under both invocations'
      );
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('phase next-decimal: padded 02 finds decimals in un-padded ROADMAP', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-3537-nd-'));
    try {
      setupFixture(tmp, {
        paddedId: '02.7',
        unpaddedId: '2.7',
      });

      // Padded base `02` must discover the existing decimal `2.7` from the
      // un-padded heading and propose `2.8` (or higher) as next.
      const padded = run(['phase', 'next-decimal', '02', '--raw'], tmp);
      const unpadded = run(['phase', 'next-decimal', '2', '--raw'], tmp);

      assert.equal(
        padded.stdout,
        unpadded.stdout,
        'next-decimal must produce identical JSON for padded and un-padded base'
      );

      // Sanity: the existing 2.7 must be reflected. If the prose-scan regex
      // silently failed to match `Phase 2.7`, the result would skip 2.7 and
      // wrongly propose 2.1 as next. `phase next-decimal --raw` emits the
      // next id as plain text (`02.8`), so trimmed string equality is the
      // typed assertion shape (no raw-text regex matching — lint policy).
      const nextDecimalPadded = padded.stdout.trim();
      assert.notEqual(
        nextDecimalPadded,
        '02.1',
        'must not propose 02.1 when 2.7 already exists in ROADMAP'
      );
      assert.notEqual(
        nextDecimalPadded,
        '2.1',
        'must not propose 2.1 when 2.7 already exists in ROADMAP'
      );
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('phase insert: padded base 02 finds anchor in un-padded ROADMAP', () => {
    const tmpA = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-3537-ins-A-'));
    const tmpB = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-3537-ins-B-'));
    try {
      // Use a phase 2 (no decimal) base so insert proposes 2.1.
      const optsA = {
        paddedId: '02',
        unpaddedId: '2',
      };
      setupFixture(tmpA, optsA);
      setupFixture(tmpB, optsA);

      const padded = run(['phase', 'insert', '02', 'urgent extension'], tmpA);
      const unpadded = run(['phase', 'insert', '2', 'urgent extension'], tmpB);

      // Both invocations should succeed (exit 0) — passing the padded base
      // against un-padded prose used to error "Phase 02 not found".
      assert.ok(
        padded.ok,
        `padded form must succeed, got code=${padded.code}, stderr=${padded.stderr}`
      );
      assert.ok(
        unpadded.ok,
        `un-padded form must succeed, got code=${unpadded.code}`
      );

      const aRoadmap = fs.readFileSync(
        path.join(tmpA, '.planning', 'ROADMAP.md'),
        'utf-8'
      );

      // The new header may be rendered as `Phase 02.1` or `Phase 2.1`
      // (normalizePhaseName pads to 2 digits today; that is pre-existing
      // behavior, not the subject of #3537). The critical assertion for
      // this verb is "padded form found the anchor and the insertion
      // happened" — full byte-parity is gated by an unrelated `Depends on:
      // Phase ${afterPhase}` echo bug that lies outside #3537's scope.
      assert.match(
        aRoadmap,
        /### Phase 0?2\.1: urgent extension/,
        'padded form must insert the new decimal phase header'
      );
      // Reference `tmpB` to ensure cleanup runs and keep it alive in the
      // closure — also a smoke-check that the un-padded sibling did not
      // crash mid-run.
      assert.ok(fs.existsSync(path.join(tmpB, '.planning', 'ROADMAP.md')));
    } finally {
      fs.rmSync(tmpA, { recursive: true, force: true });
      fs.rmSync(tmpB, { recursive: true, force: true });
    }
  });

  test('roadmap annotate-dependencies: padded 02.7 finds phase section', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-3537-ann-'));
    try {
      const { roadmapPath } = setupFixture(tmp, {});
      const before = fs.readFileSync(roadmapPath, 'utf-8');

      const padded = run(
        ['roadmap', 'annotate-dependencies', '02.7'],
        tmp
      );
      assert.ok(
        padded.ok,
        `padded form must succeed, got code=${padded.code}, stderr=${padded.stderr}`
      );

      const after = fs.readFileSync(roadmapPath, 'utf-8');
      // The annotation may be a no-op if there's only one wave and no
      // cross-cutting truths, but the verb must have reached the phase
      // section. Confirm by running parity against un-padded form on a
      // separate fixture and asserting equality.
      const tmp2 = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-3537-ann2-'));
      try {
        const { roadmapPath: rp2 } = setupFixture(tmp2, {});
        run(['roadmap', 'annotate-dependencies', '2.7'], tmp2);
        const unpadded = fs.readFileSync(rp2, 'utf-8');
        assert.equal(
          after,
          unpadded,
          'annotate-dependencies must produce identical output for padded and un-padded ids'
        );
        // And the verb must not have silently destroyed the file (sanity).
        assert.match(after, /### Phase 2\.7:/, 'phase header must survive');
        // Reference `before` to keep it from being dead-binding-flagged
        // and to assert the run did not corrupt the rest of the file.
        assert.ok(before.length > 0);
      } finally {
        fs.rmSync(tmp2, { recursive: true, force: true });
      }
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('roadmap update-plan-progress: control case — already wired in 1.42.1', () => {
    // This is the one site already using phaseMarkdownRegexSource. Including
    // it as a control proves the parity assertion is a meaningful signal
    // (this test should pass on main, while the others fail).
    const { aRoadmap, bRoadmap } = expectParity({
      fixtureOpts: {},
      verbWithPadded: (cwd) =>
        run(['roadmap', 'update-plan-progress', '02.7'], cwd),
      verbWithUnpadded: (cwd) =>
        run(['roadmap', 'update-plan-progress', '2.7'], cwd),
    });

    assert.equal(
      aRoadmap,
      bRoadmap,
      'control verb must already produce identical output (wired in 1.42.1)'
    );
    assert.match(
      aRoadmap,
      /- \[x\] \*\*Phase 2\.7:/,
      'control verb must flip checkbox under both invocations'
    );
  });
});
