'use strict';
process.env.GSD_TEST_MODE = '1';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { serializeChangelog, parseChangelog } = require(path.join(__dirname, '..', 'scripts', 'changeset', 'serialize.cjs'));

// Round-trip property: serialize(IR) → parse(text) → IR equals original.
// Tests assert on the parsed IR shape, not the serialized text contents.

describe('changeset serialize: IR → markdown round-trip (#2975)', () => {
  test('a single-section IR round-trips through serialize → parse', () => {
    const ir = {
      releaseHeader: { version: '1.0.0', date: '2026-01-01' },
      sections: [
        { type: 'Fixed', bullets: [{ pr: 1, body: 'fix something.' }] },
      ],
      priorChangelog: null,
    };
    const text = serializeChangelog(ir);
    const back = parseChangelog(text);

    assert.equal(back.releases[0].version, '1.0.0');
    assert.equal(back.releases[0].date, '2026-01-01');
    assert.equal(back.releases[0].sections.length, 1);
    assert.equal(back.releases[0].sections[0].type, 'Fixed');
    assert.equal(back.releases[0].sections[0].bullets.length, 1);
    assert.equal(back.releases[0].sections[0].bullets[0].pr, 1);
  });
});

describe('changeset serialize: multi-line bullet parsing (#3496)', () => {
  // Regression: parseChangelog silently dropped bullets whose text wrapped
  // across multiple indented continuation lines. The PR number (#NNNN) appears
  // on the final continuation line, not the opening `-` line, so the
  // single-line bullet regex never matched. Every such bullet returned 0
  // entries for its section even though the markdown was well-formed.
  test('parses a multi-line bullet whose (# pr) trailer is on a continuation line', () => {
    const text = [
      '## [1.41.0] - 2026-05-07',
      '',
      '### Feature',
      '',
      '- **Short title** — first line of a long description',
      '  that wraps onto a second line and terminates with. (#2792)',
      '- Single-line bullet with pr. (#2800)',
    ].join('\n');
    const result = parseChangelog(text);
    assert.equal(result.releases.length, 1);
    const section = result.releases[0].sections[0];
    assert.equal(section.type, 'Feature');
    assert.equal(section.bullets.length, 2, 'both bullets (multi-line and single-line) must be captured');
    assert.equal(section.bullets[0].pr, 2792, 'multi-line bullet pr');
    assert.equal(section.bullets[1].pr, 2800, 'single-line bullet pr');
  });

  test('parses a bullet with (# pr) on the opening line even when followed by multi-line bullets', () => {
    const text = [
      '## [1.42.1] - 2026-05-15',
      '',
      '### Fixed',
      '',
      '- Simple fix. (#3261)',
      '- **Complex fix** — first line of',
      '  a multi-line description. (#3287)',
    ].join('\n');
    const result = parseChangelog(text);
    const section = result.releases[0].sections[0];
    assert.equal(section.bullets.length, 2);
    assert.equal(section.bullets[0].pr, 3261);
    assert.equal(section.bullets[1].pr, 3287);
  });

  test('a multi-line bullet with linked release header is parsed correctly', () => {
    const text = [
      '## [1.42.1](https://github.com/gsd-build/get-shit-done/compare/v1.41.0...v1.42.1) - 2026-05-15',
      '',
      '### Fixed',
      '',
      '- **Multi-line with linked header** — description spans',
      '  multiple lines and version header has an inline URL. (#3287)',
    ].join('\n');
    const result = parseChangelog(text);
    assert.equal(result.releases[0].version, '1.42.1');
    assert.equal(result.releases[0].sections[0].bullets.length, 1);
    assert.equal(result.releases[0].sections[0].bullets[0].pr, 3287);
  });

  test('preserves bullets without (# pr) trailer as { body, pr: null } instead of dropping them', () => {
    // Regression guard for Codex finding: bullets that lack a trailing
    // (# NNNN) were silently discarded.  They must be stored with pr: null
    // so callers (e.g. cmdExtract) can render them without silent loss.
    const text = [
      '## [1.43.0] - 2026-05-20',
      '',
      '### Fixed',
      '',
      '- Fix with a PR reference. (#4000)',
      '- Documented fix without a PR reference.',
      '- **Multi-line fix without trailer** — first line of description',
      '  that continues on a second line but has no (# NNN) at the end.',
    ].join('\n');
    const result = parseChangelog(text);
    const section = result.releases[0].sections[0];
    assert.equal(section.bullets.length, 3, 'all three bullets must be captured');
    assert.equal(section.bullets[0].pr, 4000, 'PR bullet preserved');
    assert.equal(section.bullets[1].pr, null, 'no-PR bullet has pr: null');
    assert.ok(section.bullets[1].body.includes('Documented fix'), 'no-PR bullet body preserved');
    assert.equal(section.bullets[2].pr, null, 'multi-line no-PR bullet has pr: null');
    assert.ok(section.bullets[2].body.includes('Multi-line fix without trailer'), 'multi-line no-PR body preserved');
  });
});

describe('changeset serialize: multi-section + prior content (#2975)', () => {
  const { serializeChangelog, parseChangelog } = require(require('node:path').join(__dirname, '..', 'scripts', 'changeset', 'serialize.cjs'));

  test('round-trips an IR with three section types and multiple bullets per section', () => {
    const ir = {
      releaseHeader: { version: '1.42.0', date: '2026-05-01' },
      sections: [
        { type: 'Added', bullets: [{ pr: 1, body: 'add A' }, { pr: 2, body: 'add B' }] },
        { type: 'Changed', bullets: [{ pr: 3, body: 'change C' }] },
        { type: 'Fixed', bullets: [{ pr: 4, body: 'fix D' }, { pr: 5, body: 'fix E' }] },
      ],
      priorChangelog: null,
    };
    const back = parseChangelog(serializeChangelog(ir));
    assert.equal(back.releases.length, 1);
    assert.deepEqual(
      back.releases[0].sections.map((s) => ({ type: s.type, prs: s.bullets.map((b) => b.pr) })),
      [
        { type: 'Added', prs: [1, 2] },
        { type: 'Changed', prs: [3] },
        { type: 'Fixed', prs: [4, 5] },
      ],
    );
  });

  test('prior CHANGELOG content survives serialize → parse as a separate release block', () => {
    const priorText = '## [0.9.0] - 2025-12-01\n\n### Fixed\n\n- old fix (#100)\n';
    const ir = {
      releaseHeader: { version: '1.0.0', date: '2026-01-01' },
      sections: [{ type: 'Added', bullets: [{ pr: 200, body: 'new feature' }] }],
      priorChangelog: priorText,
    };
    const back = parseChangelog(serializeChangelog(ir));
    assert.equal(back.releases.length, 2);
    assert.equal(back.releases[0].version, '1.0.0');
    assert.equal(back.releases[1].version, '0.9.0');
    assert.equal(back.releases[1].sections[0].bullets[0].pr, 100);
  });
});
