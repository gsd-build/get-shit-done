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
