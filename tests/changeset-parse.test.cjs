'use strict';
process.env.GSD_TEST_MODE = '1';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { parseFragment, extractDocsExempt, FRAGMENT_ERROR, DOCS_EXEMPT_RE } = require(path.join(__dirname, '..', 'scripts', 'changeset', 'parse.cjs'));

describe('changeset parse: fragment file → typed record (#2975)', () => {
  test('returns { ok: true, fragment } for a well-formed fragment', () => {
    const src = '---\ntype: Fixed\npr: 2975\n---\nfix the thing.\n';
    const result = parseFragment(src);
    assert.equal(result.ok, true);
    assert.deepEqual(result.fragment, {
      type: 'Fixed',
      pr: 2975,
      body: 'fix the thing.',
      docsExempt: null,
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

describe('changeset parse: docs-exempt extraction (#3213)', () => {
  test('extractDocsExempt returns { docsExempt: null, body } when no marker present', () => {
    const out = extractDocsExempt('plain body text');
    assert.deepEqual(out, { docsExempt: null, body: 'plain body text' });
  });

  test('extractDocsExempt captures the reason and strips the marker from body', () => {
    const out = extractDocsExempt('feature note.\n\n<!-- docs-exempt: internal-only -->');
    assert.equal(out.docsExempt, 'internal-only');
    assert.doesNotMatch(out.body, /docs-exempt/);
    assert.match(out.body, /feature note\./);
  });

  test('extractDocsExempt REJECTS bare marker without colon — reason is required (CodeRabbit finding)', () => {
    // A bare `<!-- docs-exempt -->` provides no audit trail; intentionally
    // not extracted so the lint requires either docs/ updates or a marker
    // with a real reason.
    const out = extractDocsExempt('body\n<!-- docs-exempt -->');
    assert.equal(out.docsExempt, null);
    assert.match(out.body, /docs-exempt/);  // unchanged — bare marker stays in body
  });

  test('extractDocsExempt REJECTS marker with empty reason (<!-- docs-exempt: -->)', () => {
    const out = extractDocsExempt('body\n<!-- docs-exempt: -->');
    assert.equal(out.docsExempt, null);
  });

  test('extractDocsExempt REJECTS marker with whitespace-only reason', () => {
    const out = extractDocsExempt('body\n<!-- docs-exempt:    -->');
    assert.equal(out.docsExempt, null);
  });

  test('extractDocsExempt is case-insensitive on the marker token', () => {
    const out = extractDocsExempt('body\n<!-- DOCS-EXEMPT: shouty reason -->');
    assert.equal(out.docsExempt, 'shouty reason');
  });

  test('parseFragment surfaces docsExempt on the fragment record', () => {
    const src = '---\ntype: Added\npr: 3213\n---\nbootstrap.\n\n<!-- docs-exempt: bootstrap -->\n';
    const r = parseFragment(src);
    assert.equal(r.ok, true);
    assert.equal(r.fragment.docsExempt, 'bootstrap');
    // Marker must not appear in the rendered body. CHANGELOG and GitHub
    // release-notes serializers append `(#NNNN)` to the body's last line;
    // a trailing comment line would attach the suffix to the wrong content.
    assert.doesNotMatch(r.fragment.body, /docs-exempt/);
    assert.match(r.fragment.body, /bootstrap\./);
  });

  test('parseFragment fails EMPTY_BODY when the body is only a docs-exempt marker', () => {
    const src = '---\ntype: Added\npr: 1\n---\n<!-- docs-exempt: nothing else -->\n';
    const r = parseFragment(src);
    assert.equal(r.ok, false);
    assert.equal(r.reason, FRAGMENT_ERROR.EMPTY_BODY);
  });

  test('DOCS_EXEMPT_RE is exposed and matches the documented shape (colon + non-empty reason required)', () => {
    assert.ok(DOCS_EXEMPT_RE instanceof RegExp);
    assert.match('<!-- docs-exempt: x -->', DOCS_EXEMPT_RE);
    assert.match('<!-- docs-exempt: bootstrap reason with spaces -->', DOCS_EXEMPT_RE);
    assert.doesNotMatch('docs-exempt: not in a comment', DOCS_EXEMPT_RE);
    assert.doesNotMatch('<!-- docs-exempt -->', DOCS_EXEMPT_RE);       // no colon
    assert.doesNotMatch('<!-- docs-exempt: -->', DOCS_EXEMPT_RE);      // empty reason
    assert.doesNotMatch('<!-- docs-exempt:   -->', DOCS_EXEMPT_RE);    // whitespace-only reason
  });

  test('inline mention inside backticks does NOT count as a marker (false-positive guard)', () => {
    // Fragment body documents the marker syntax inline as part of release notes.
    // Without the line-anchor, the regex would mis-identify this as an actual
    // exemption and strip release-note content.
    const src =
      '---\ntype: Added\npr: 3213\n---\n' +
      'New escape hatch: `<!-- docs-exempt: <reason> -->` on its own line at the end of a fragment body exempts that fragment from docs lint.\n';
    const r = parseFragment(src);
    assert.equal(r.ok, true);
    assert.equal(r.fragment.docsExempt, null);
    // The literal syntax example must remain in the rendered body — it is
    // legitimate release-note content explaining the new feature.
    assert.match(r.fragment.body, /docs-exempt/);
  });

  test('CRLF-authored fragments: marker is stripped cleanly without residual \\r (Codex finding)', () => {
    // Codex's exact repro from the second review pass:
    //   Feature.\r\n\r\n<!-- docs-exempt: x -->\r\n
    // Before the fix this parsed to body `Feature.\r\n\r\n\r`, which made
    // serializeChangelog emit `- Feature.\r\n\r\n\r (#1)` — the PR suffix
    // landed on a blank line instead of attached to the visible bullet.
    const src = '---\r\ntype: Added\r\npr: 1\r\n---\r\nFeature.\r\n\r\n<!-- docs-exempt: x -->\r\n';
    const r = parseFragment(src);
    assert.equal(r.ok, true);
    assert.equal(r.fragment.docsExempt, 'x');
    assert.doesNotMatch(r.fragment.body, /[\r]/);  // no residual CR characters
    assert.doesNotMatch(r.fragment.body, /docs-exempt/);
    // End-to-end: round-trip through serialize → parse to assert on the
    // structured changelog IR, not rendered text (CONTRIBUTING.md:
    // "Prohibited: Raw Text Matching on Test Outputs"). The buggy pre-fix
    // body shape (`Feature.\r\n\r\n\r`) breaks `parseChangelog`'s bullet
    // regex — it returns an empty `bullets: []` — so this round-trip is
    // a stronger regression check than a substring match.
    const { serializeChangelog, parseChangelog } = require(path.join(__dirname, '..', 'scripts', 'changeset', 'serialize.cjs'));
    const out = serializeChangelog({
      releaseHeader: { version: '1.0.0', date: '2026-01-01' },
      sections: [{ type: 'Added', bullets: [{ pr: r.fragment.pr, body: r.fragment.body }] }],
      priorChangelog: null,
    });
    const parsed = parseChangelog(out);
    assert.equal(parsed.releases.length, 1);
    assert.deepEqual(parsed.releases[0].sections, [
      { type: 'Added', bullets: [{ body: 'Feature.', pr: 1 }] },
    ]);
  });

  test('CRLF-authored fragment without marker: no stripping needed, body unchanged in semantics', () => {
    const src = '---\r\ntype: Fixed\r\npr: 5\r\n---\r\nbug fix.\r\n';
    const r = parseFragment(src);
    assert.equal(r.ok, true);
    assert.equal(r.fragment.docsExempt, null);
    assert.match(r.fragment.body, /bug fix\./);
  });

  test('marker on its own line trailing a fragment body still wins (real-marker positive case)', () => {
    const src =
      '---\ntype: Added\npr: 3213\n---\n' +
      'New escape hatch: `<!-- docs-exempt: <reason> -->` documents the syntax.\n' +
      '\n' +
      '<!-- docs-exempt: bootstrap of the lint itself -->\n';
    const r = parseFragment(src);
    assert.equal(r.ok, true);
    assert.equal(r.fragment.docsExempt, 'bootstrap of the lint itself');
    // The trailing real-marker line is stripped — the "bootstrap" reason
    // should not appear anywhere in the rendered body.
    assert.doesNotMatch(r.fragment.body, /bootstrap of the lint itself/);
    // … but the inline syntax example is preserved.
    assert.match(r.fragment.body, /docs-exempt: <reason>/);
  });
});
