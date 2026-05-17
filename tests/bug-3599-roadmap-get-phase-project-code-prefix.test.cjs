/**
 * Bug #3599: roadmap.get-phase no longer matches custom phase IDs with
 * project-code prefixes like `PROJ-42`.
 *
 * `phaseMarkdownRegexSource(phaseNum)` in get-shit-done/bin/lib/core.cjs
 * (and its SDK twin in sdk/src/query/roadmap-update-plan-progress.ts) strips
 * the `PROJ-` prefix before building the padding-tolerant numeric regex.
 * Result: `roadmap get-phase PROJ-42` produces a regex of `0*42`, which
 * matches `### Phase 42:` instead of (or in addition to) the intended
 * `### Phase PROJ-42:`. The function's own docstring promises a fallback to
 * `escapeRegex(phaseNum)` for non-numeric custom IDs, but that branch is
 * unreachable for project-code-prefixed numeric IDs.
 *
 * Fix: the emitted regex must match BOTH the stripped numeric form (so
 * `CK-01-name` directory inputs still resolve to `Phase 1:` in prose, the
 * #3537 contract) AND the full prefixed form (so `PROJ-42` resolves to
 * `Phase PROJ-42:`).
 */

'use strict';

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

function writeRoadmap(tmpDir, body) {
  fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), body);
}

function writeState(tmpDir, version) {
  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'STATE.md'),
    `---\nmilestone: ${version}\n---\n`,
  );
}

describe('bug #3599: roadmap get-phase preserves project-code prefix in lookup', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject('bug-3599-');
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('finds ### Phase PROJ-42: when queried as PROJ-42', () => {
    writeState(tmpDir, 'v1.0.0');
    writeRoadmap(
      tmpDir,
      [
        '# Roadmap',
        '',
        '## Current Milestone: v1.0.0 - Test',
        '',
        '### Phase PROJ-42: Custom phase',
        '**Goal:** Verify project-code-prefixed lookup',
        '',
      ].join('\n'),
    );

    const result = runGsdTools('roadmap get-phase PROJ-42 --json', tmpDir);
    assert.ok(result.success, `command failed: ${result.error || result.output}`);

    const payload = JSON.parse(result.output);
    assert.strictEqual(payload.found, true, `expected found=true, got: ${result.output}`);
    assert.strictEqual(payload.phase_name, 'Custom phase');
    assert.strictEqual(payload.goal, 'Verify project-code-prefixed lookup');
  });

  test('does NOT cross-match: querying 42 must not match ### Phase PROJ-42:', () => {
    // Counter-test: if the regex erroneously matches both forms in both
    // directions, this catches it. `42` must only match `Phase 42:` — not
    // `Phase PROJ-42:` — otherwise integer phase lookups silently steal
    // matches from prefixed siblings.
    writeState(tmpDir, 'v1.0.0');
    writeRoadmap(
      tmpDir,
      [
        '# Roadmap',
        '',
        '## Current Milestone: v1.0.0 - Test',
        '',
        '### Phase PROJ-42: Should not be returned for `42`',
        '**Goal:** Counter-test',
        '',
      ].join('\n'),
    );

    const result = runGsdTools('roadmap get-phase 42 --json', tmpDir);
    assert.ok(result.success);
    const payload = JSON.parse(result.output);
    assert.strictEqual(
      payload.found,
      false,
      `bare numeric '42' must not match 'Phase PROJ-42:'; got ${result.output}`,
    );
  });

  test('preserves #3537 contract: CK-01 directory form resolves to Phase 1 prose', () => {
    // Existing contract: phase directory names like `CK-01-name` carry the
    // project_code prefix and a zero-padded number, but ROADMAP prose is
    // typically un-padded (`### Phase 1:`). The padding-tolerant lookup must
    // still bridge those two surfaces.
    writeState(tmpDir, 'v1.0.0');
    writeRoadmap(
      tmpDir,
      [
        '# Roadmap',
        '',
        '## Current Milestone: v1.0.0 - Test',
        '',
        '### Phase 1: Numeric prose',
        '**Goal:** #3537 contract — CK-01 dir → Phase 1 prose',
        '',
      ].join('\n'),
    );

    const result = runGsdTools('roadmap get-phase CK-01 --json', tmpDir);
    assert.ok(result.success);
    const payload = JSON.parse(result.output);
    assert.strictEqual(
      payload.found,
      true,
      `CK-01 must still resolve to 'Phase 1:' prose (#3537 contract); got ${result.output}`,
    );
    assert.strictEqual(payload.phase_name, 'Numeric prose');
  });

  test('finds the right phase when both prefixed and bare forms coexist', () => {
    // Disambiguation test: a roadmap that contains BOTH `### Phase 42:` and
    // `### Phase PROJ-42:` must resolve each query to its specific match.
    writeState(tmpDir, 'v1.0.0');
    writeRoadmap(
      tmpDir,
      [
        '# Roadmap',
        '',
        '## Current Milestone: v1.0.0 - Test',
        '',
        '### Phase 42: Bare numeric',
        '**Goal:** Bare',
        '',
        '### Phase PROJ-42: Prefixed',
        '**Goal:** Prefixed',
        '',
      ].join('\n'),
    );

    const r42 = runGsdTools('roadmap get-phase 42 --json', tmpDir);
    const rProj = runGsdTools('roadmap get-phase PROJ-42 --json', tmpDir);

    const p42 = JSON.parse(r42.output);
    const pProj = JSON.parse(rProj.output);

    assert.strictEqual(p42.found, true);
    assert.strictEqual(p42.phase_name, 'Bare numeric');
    assert.strictEqual(p42.goal, 'Bare');

    assert.strictEqual(pProj.found, true);
    assert.strictEqual(pProj.phase_name, 'Prefixed');
    assert.strictEqual(pProj.goal, 'Prefixed');
  });
});
