'use strict';
process.env.GSD_TEST_MODE = '1';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { renderChangelog } = require(path.join(__dirname, '..', 'scripts', 'changeset', 'render.cjs'));

describe('changeset render: pure renderer (#2975)', () => {
  test('returns a structured Changelog object with a single Fixed bullet for one fragment', () => {
    const fragments = [{ type: 'Fixed', pr: 2975, body: 'fix the thing.' }];
    const result = renderChangelog({
      fragments,
      version: '1.42.0',
      date: '2026-05-01',
      priorChangelog: null,
    });

    assert.deepEqual(result.releaseHeader, { version: '1.42.0', date: '2026-05-01' });
    assert.equal(result.sections.length, 1);
    assert.deepEqual(result.sections[0], {
      type: 'Fixed',
      bullets: [{ pr: 2975, body: 'fix the thing.' }],
    });
  });

  test('groups multiple fragments by type with deterministic section order (Keep a Changelog convention)', () => {
    const fragments = [
      { type: 'Fixed', pr: 1, body: 'fix A' },
      { type: 'Added', pr: 2, body: 'add B' },
      { type: 'Fixed', pr: 3, body: 'fix C' },
      { type: 'Changed', pr: 4, body: 'change D' },
    ];
    const result = renderChangelog({ fragments, version: '1.0.0', date: '2026-01-01' });

    assert.deepEqual(
      result.sections.map((s) => s.type),
      ['Added', 'Changed', 'Fixed'],
    );
    const fixed = result.sections.find((s) => s.type === 'Fixed');
    assert.deepEqual(
      fixed.bullets.map((b) => b.pr),
      [1, 3],
      'bullets within a section preserve fragment order',
    );
  });
});
