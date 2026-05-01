'use strict';
process.env.GSD_TEST_MODE = '1';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { parseFragment, FRAGMENT_ERROR } = require(path.join(__dirname, '..', 'scripts', 'changeset', 'parse.cjs'));

describe('changeset parse: fragment file → typed record (#2975)', () => {
  test('returns { ok: true, fragment } for a well-formed fragment', () => {
    const src = '---\ntype: Fixed\npr: 2975\n---\nfix the thing.\n';
    const result = parseFragment(src);
    assert.equal(result.ok, true);
    assert.deepEqual(result.fragment, {
      type: 'Fixed',
      pr: 2975,
      body: 'fix the thing.',
    });
  });

  test('preserves verbatim body content (e.g. code blocks) — does not trim significant whitespace', () => {
    const src = '---\ntype: Fixed\npr: 1\n---\n```js\nlet x = 1;\n```\n';
    const r = parseFragment(src);
    assert.equal(r.ok, true);
    assert.equal(r.fragment.body, '```js\nlet x = 1;\n```');
  });

  test('exposes a frozen FRAGMENT_ERROR enum with the documented codes', () => {
    assert.deepEqual(
      Object.keys(FRAGMENT_ERROR).sort(),
      ['EMPTY_BODY', 'INVALID_PR', 'INVALID_TYPE', 'MISSING_FRONTMATTER', 'MISSING_PR', 'MISSING_TYPE'],
    );
  });

  for (const [label, src, expectedReason] of [
    ['fails MISSING_FRONTMATTER when no frontmatter block present',
     'just a body, no frontmatter\n', 'MISSING_FRONTMATTER'],
    ['fails MISSING_TYPE when frontmatter omits type:',
     '---\npr: 2975\n---\nfix.\n', 'MISSING_TYPE'],
    ['fails INVALID_TYPE for a type not in the Keep-a-Changelog set',
     '---\ntype: Refactored\npr: 2975\n---\nfix.\n', 'INVALID_TYPE'],
    ['fails MISSING_PR when frontmatter omits pr:',
     '---\ntype: Fixed\n---\nfix.\n', 'MISSING_PR'],
    ['fails INVALID_PR when pr: is not a positive integer',
     '---\ntype: Fixed\npr: 0\n---\nfix.\n', 'INVALID_PR'],
    ['fails EMPTY_BODY when the body is whitespace-only',
     '---\ntype: Fixed\npr: 2975\n---\n   \n', 'EMPTY_BODY'],
  ]) {
    test(label, () => {
      const r = parseFragment(src);
      assert.equal(r.ok, false);
      assert.equal(r.reason, FRAGMENT_ERROR[expectedReason]);
    });
  }
});
