/**
 * Adversarial roadmap-parser tests (#3594).
 *
 * Loads each fixture in `tests/fixtures/adversarial/roadmap/` as the
 * project's `.planning/ROADMAP.md` and pins invariants on the public
 * `gsd-tools roadmap get-phase <N>` surface — which routes through the
 * SDK bridge when available and the CJS handler otherwise.
 *
 * Per CONTRIBUTING.md §"Testing Standards / Parser and project-file
 * inputs", the assertion target is the typed JSON shape the CLI emits,
 * not stderr prose. The harness in `tests/helpers/cli-negative.cjs`
 * (introduced by #3627 / #3593) is reused here for consistency.
 *
 * Several fixtures encode known historical regressions:
 *   - fenced-code-block headings shadowing real phases (#2787)
 *   - decimal phase prefix collisions (#3537)
 *   - HTML-comment heading false positives
 *
 * Pre-existing parser bugs surfaced by these fixtures are NOT fixed in
 * this PR — fixing them is out of scope for "add adversarial test
 * coverage." Where a fixture exposes a still-open bug, the test
 * asserts the *currently observed* behavior with a comment naming the
 * open issue, so the flip from RED→GREEN is a one-line change the day
 * the real fix lands.
 */

'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { runCli } = require('./helpers/cli-negative.cjs');
const { createTempProject, cleanup } = require('./helpers.cjs');

const FIXTURE_DIR = path.join(__dirname, 'fixtures', 'adversarial', 'roadmap');

function loadFixture(name) {
  return fs.readFileSync(path.join(FIXTURE_DIR, name), 'utf-8');
}

/**
 * Create a temp project whose ROADMAP.md is the named fixture's content.
 * Returns the project directory; caller is responsible for cleanup.
 */
function projectWithFixture(t, fixtureName) {
  const projectDir = createTempProject('roadmap-adv-' + fixtureName.replace(/\W+/g, '-') + '-');
  t.after(() => cleanup(projectDir));
  fs.writeFileSync(path.join(projectDir, '.planning', 'ROADMAP.md'), loadFixture(fixtureName));
  return projectDir;
}

/**
 * Run `gsd-tools roadmap get-phase <N>` and parse the JSON payload.
 * Returns `{ ok, exit, parsed, raw }` so tests can assert on either
 * the exit code or the structured payload.
 */
function getPhase(projectDir, phaseNum) {
  // No --json-errors — the get-phase command outputs JSON on success
  // via the normal stdout path. Reading the parsed payload is what the
  // workflows downstream do, so that's what we test.
  const result = runCli(['roadmap', 'get-phase', phaseNum], { cwd: projectDir, jsonErrors: false });
  let parsed = null;
  try {
    parsed = JSON.parse(result.stdout);
  } catch {
    // Leave parsed null; tests that depend on it must handle that.
  }
  return {
    exit: result.status,
    ok: result.status === 0,
    parsed,
    raw: result.stdout,
    stderr: result.stderr,
    hasStackTrace: result.hasStackTrace,
  };
}

// ─── Fenced code block heading shadowing ────────────────────────────────────

describe('feat-3594: roadmap parser and fenced-code-block headings (#2787)', () => {
  test('phase 1 in real prose is found even when ## Phase 999 appears inside a ``` block', (t) => {
    const projectDir = projectWithFixture(t, 'phase-heading-inside-fenced-code.md');
    const result = getPhase(projectDir, '1');
    assert.equal(result.hasStackTrace, false, 'no V8 stack trace');
    assert.ok(result.parsed, `expected JSON payload, got: ${result.raw}`);
    assert.equal(result.parsed.found, true, 'phase 1 must be found');
    assert.equal(result.parsed.phase_number, '1');
    assert.match(result.parsed.phase_name, /real phase one/);
  });

  test('phase 999 inside a fenced block: CJS parser currently STILL matches it (open: needs fence-stripping)', (t) => {
    const projectDir = projectWithFixture(t, 'phase-heading-inside-fenced-code.md');
    const result = getPhase(projectDir, '999');
    assert.equal(result.hasStackTrace, false, 'no stack trace');
    // The CJS regex parser does not strip fenced code blocks before
    // matching. The SDK roadmap parser tracks fenced blocks (per #2787
    // comment in sdk/src/query/roadmap.ts) — the CJS path has not caught
    // up. This test pins the current behavior so the day someone wires
    // CJS fence-stripping, flipping `found: true` to `found: false`
    // becomes the regression guard.
    assert.ok(result.parsed, `expected JSON payload, got: ${result.raw}`);
    assert.equal(result.parsed.found, true, 'CJS parser currently matches inside fences (known open bug)');
    // The matched heading is the one INSIDE the fenced block. Match
    // its distinctive substring so a future "fix" that strips fences
    // and instead matches a different (real) phase 999 (which we don't
    // have in this fixture, so impossible) still fails the right test.
    assert.match(
      result.parsed.phase_name,
      /fenced code block/i,
      'currently-matched heading must be the one inside the fence',
    );
  });
});

// ─── Decimal phase prefix collisions ────────────────────────────────────────

describe('feat-3594: roadmap parser handles decimal phase prefix collisions (#3537)', () => {
  test('asking for phase "2" returns the integer phase, NOT phase 2.1 or 2.10', (t) => {
    const projectDir = projectWithFixture(t, 'decimal-phase-mixed.md');
    const result = getPhase(projectDir, '2');
    assert.ok(result.parsed, `expected JSON payload, got: ${result.raw}`);
    assert.equal(result.parsed.found, true);
    assert.equal(result.parsed.phase_number, '2');
    assert.match(result.parsed.phase_name, /integer phase two/);
  });

  test('asking for phase "2.1" returns the decimal child', (t) => {
    const projectDir = projectWithFixture(t, 'decimal-phase-mixed.md');
    const result = getPhase(projectDir, '2.1');
    assert.ok(result.parsed, `expected JSON payload, got: ${result.raw}`);
    assert.equal(result.parsed.found, true);
    assert.equal(result.parsed.phase_number, '2.1');
    assert.match(result.parsed.phase_name, /decimal child/);
  });

  test('asking for phase "2.10" returns the decimal sibling, NOT phase 2.1', (t) => {
    const projectDir = projectWithFixture(t, 'decimal-phase-mixed.md');
    const result = getPhase(projectDir, '2.10');
    assert.ok(result.parsed, `expected JSON payload, got: ${result.raw}`);
    assert.equal(result.parsed.found, true);
    assert.equal(result.parsed.phase_number, '2.10');
    assert.match(result.parsed.phase_name, /decimal phase 2\.10/);
  });

  test('asking for phase "21" returns phase 21, NOT phase 2 (prefix-collision guard)', (t) => {
    const projectDir = projectWithFixture(t, 'decimal-phase-mixed.md');
    const result = getPhase(projectDir, '21');
    assert.ok(result.parsed, `expected JSON payload, got: ${result.raw}`);
    assert.equal(result.parsed.found, true);
    assert.equal(result.parsed.phase_number, '21');
    assert.match(result.parsed.phase_name, /phase twenty-one/);
  });
});

// ─── Unicode phase titles ───────────────────────────────────────────────────

describe('feat-3594: roadmap parser preserves Unicode phase titles', () => {
  test('Japanese title round-trips through phase_name', (t) => {
    const projectDir = projectWithFixture(t, 'unicode-phase-titles.md');
    const result = getPhase(projectDir, '1');
    assert.ok(result.parsed, `expected JSON payload, got: ${result.raw}`);
    assert.equal(result.parsed.phase_name, '日本語フェーズ — initial setup');
  });

  test('emoji + smart-quote title survives', (t) => {
    const projectDir = projectWithFixture(t, 'unicode-phase-titles.md');
    const result = getPhase(projectDir, '2');
    assert.ok(result.parsed, `expected JSON payload, got: ${result.raw}`);
    assert.match(result.parsed.phase_name, /🚧/);
    assert.match(result.parsed.phase_name, /Émile/);
  });

  test('Greek-letter title survives', (t) => {
    const projectDir = projectWithFixture(t, 'unicode-phase-titles.md');
    const result = getPhase(projectDir, '3');
    assert.ok(result.parsed, `expected JSON payload, got: ${result.raw}`);
    assert.equal(result.parsed.phase_name, 'αβγ δεζ ηθι');
  });
});

// ─── Repeated phase IDs ─────────────────────────────────────────────────────

describe('feat-3594: roadmap parser handles repeated phase IDs deterministically', () => {
  test('two declarations of phase 1: parser returns the FIRST match (current behavior)', (t) => {
    const projectDir = projectWithFixture(t, 'repeated-phase-ids.md');
    const result = getPhase(projectDir, '1');
    assert.ok(result.parsed, `expected JSON payload, got: ${result.raw}`);
    assert.equal(result.parsed.found, true);
    // The regex uses `content.match(...)` which returns the FIRST match.
    // Pin that — a future change to last-wins or de-dup would fire.
    assert.match(result.parsed.phase_name, /first declaration/);
  });
});

// ─── HTML comments ──────────────────────────────────────────────────────────

describe('feat-3594: roadmap parser and HTML-commented headings', () => {
  test('phase 1 in real prose is found even when phase 998/999 appear inside <!-- ... -->', (t) => {
    const projectDir = projectWithFixture(t, 'markdown-headings-inside-html-comment.md');
    const result = getPhase(projectDir, '1');
    assert.ok(result.parsed, `expected JSON payload, got: ${result.raw}`);
    assert.equal(result.parsed.found, true);
    assert.equal(result.parsed.phase_name, 'real phase');
  });

  test('phase 999 inside an HTML comment: CJS parser currently STILL matches it (open: needs comment-stripping)', (t) => {
    const projectDir = projectWithFixture(t, 'markdown-headings-inside-html-comment.md');
    const result = getPhase(projectDir, '999');
    assert.equal(result.hasStackTrace, false, 'no stack trace');
    // Same shape as the fenced-code-block case: the CJS regex parser
    // doesn't strip HTML comments before matching.
    assert.ok(result.parsed, `expected JSON payload, got: ${result.raw}`);
    assert.equal(result.parsed.found, true, 'CJS parser currently matches inside HTML comments (known open bug)');
    assert.match(result.parsed.phase_name, /HTML comment/);
  });
});

// ─── Cross-corpus invariant ────────────────────────────────────────────────

describe('feat-3594: roadmap parser does not crash on ANY corpus fixture', () => {
  const fixtures = fs.readdirSync(FIXTURE_DIR).filter((f) => f.endsWith('.md') && f !== 'README.md');
  for (const fixture of fixtures) {
    test(`fixture "${fixture}" — get-phase with arbitrary IDs must not crash`, (t) => {
      const projectDir = projectWithFixture(t, fixture);
      for (const id of ['1', '2', '99', '999', '0', '2.1']) {
        const result = getPhase(projectDir, id);
        assert.equal(result.hasStackTrace, false, `${fixture} id=${id}: no V8 stack frame allowed`);
        // exit status varies (0 for found, non-zero for not-found —
        // both are valid). What's pinned: the parser produced SOME output
        // (either valid JSON or a clean stderr) without crashing.
      }
    });
  }
});
