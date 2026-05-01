'use strict';
process.env.GSD_TEST_MODE = '1';

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const { generateFragmentName, scaffoldFragment, parseFragment } = (() => {
  const newCs = require(path.join(ROOT, 'scripts', 'changeset', 'new.cjs'));
  const parse = require(path.join(ROOT, 'scripts', 'changeset', 'parse.cjs'));
  return { ...newCs, parseFragment: parse.parseFragment };
})();

let tmp;
before(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-new-changeset-')); });
after(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

describe('changeset new: name generator + scaffold writer (#2975)', () => {
  test('generateFragmentName returns three lowercase words separated by hyphens', () => {
    const name = generateFragmentName();
    const parts = name.split('-');
    assert.equal(parts.length, 3);
    for (const p of parts) {
      assert.match(p, /^[a-z]+$/);
    }
  });

  test('scaffoldFragment writes a parseable fragment file with the supplied type and pr', () => {
    const file = scaffoldFragment({
      repo: tmp,
      type: 'Fixed',
      pr: 9999,
      body: 'this is a placeholder body that the contributor will replace.',
    });

    // Filesystem facts: file exists in .changeset/, is a regular file, is non-empty.
    const stat = fs.statSync(file);
    assert.ok(stat.isFile());
    assert.ok(stat.size > 0);
    assert.equal(path.dirname(file), path.join(tmp, '.changeset'));

    // Content fact: the file is a valid fragment per the parser. We do NOT
    // substring-match the file text; we round-trip it through parseFragment
    // and assert on the typed result.
    const src = fs.readFileSync(file, 'utf8');
    const parsed = parseFragment(src);
    assert.equal(parsed.ok, true);
    assert.deepEqual(parsed.fragment, {
      type: 'Fixed',
      pr: 9999,
      body: 'this is a placeholder body that the contributor will replace.',
    });
  });

  test('two consecutive scaffoldFragment calls in the same dir produce different filenames (no collisions in normal use)', () => {
    const a = scaffoldFragment({ repo: tmp, type: 'Added', pr: 1, body: 'aaa.' });
    const b = scaffoldFragment({ repo: tmp, type: 'Added', pr: 2, body: 'bbb.' });
    assert.notEqual(path.basename(a), path.basename(b));
  });

  test('rejects type values not on the Keep-a-Changelog allowlist (sanitization)', () => {
    // Includes the newline-injection case from the CR finding.
    for (const badType of ['Refactored', 'fixed', 'Fixed\ntype: Added', 'Fixed; rm -rf /', '']) {
      assert.throws(
        () => scaffoldFragment({ repo: tmp, type: badType, pr: 1, body: 'x.' }),
        /not one of \[Added, Changed, Deprecated, Removed, Fixed, Security\]/,
        `bad type ${JSON.stringify(badType)} should be rejected`,
      );
    }
  });

  test('parseArgs returns { ok: false, error } when --repo is missing its value', () => {
    const { parseArgs } = require(path.join(ROOT, 'scripts', 'changeset', 'new.cjs'));
    const r = parseArgs(['--type', 'Fixed', '--pr', '1', '--body', 'x.', '--repo']);
    assert.equal(r.ok, false);
    assert.equal(r.error, 'missing value for --repo');
  });

  test('parseArgs returns { ok: false, error } when a flag value is itself another flag', () => {
    const { parseArgs } = require(path.join(ROOT, 'scripts', 'changeset', 'new.cjs'));
    const r = parseArgs(['--type', 'Fixed', '--repo', '--pr', '1', '--body', 'x.']);
    assert.equal(r.ok, false);
    assert.equal(r.error, 'missing value for --repo');
  });

  test('parseArgs returns { ok: true, opts } on a well-formed argv', () => {
    const { parseArgs } = require(path.join(ROOT, 'scripts', 'changeset', 'new.cjs'));
    const r = parseArgs(['--type', 'Fixed', '--pr', '42', '--body', 'a body', '--repo', '/tmp/x']);
    assert.equal(r.ok, true);
    assert.deepEqual(r.opts, { type: 'Fixed', pr: 42, body: 'a body', repo: '/tmp/x' });
  });
});
