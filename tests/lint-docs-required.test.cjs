'use strict';
process.env.GSD_TEST_MODE = '1';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  evaluateLint,
  readFragmentsFromDisk,
  LINT_REASON,
  OPT_OUT_LABEL,
  TRIGGERING_TYPES,
  isFragmentPath,
  isDocsFile,
  isExemptFragment,
} = require(path.join(__dirname, '..', 'scripts', 'lint-docs-required.cjs'));

// evaluateLint is pure over the resolved inputs (changedFiles, fragments,
// labels, malformed). Tests assert on the structured verdict:
// { ok, reason: LINT_REASON.X, triggering: string[], malformed? }.

describe('docs-required lint: pure verdict (#3213)', () => {
  test('LINT_REASON enum exposes the documented codes', () => {
    assert.deepEqual(
      Object.keys(LINT_REASON).sort(),
      [
        'FAIL_DOCS_MISSING',
        'FAIL_MALFORMED_FRAGMENT',
        'OK_DOCS_UPDATED',
        'OK_FRAGMENTS_EXEMPT',
        'OK_NO_TRIGGERING_FRAGMENTS',
        'OK_OPT_OUT_LABEL',
      ].sort(),
    );
  });

  test('TRIGGERING_TYPES covers the four user-facing non-fix types', () => {
    assert.deepEqual(
      [...TRIGGERING_TYPES].sort(),
      ['Added', 'Changed', 'Deprecated', 'Removed'].sort(),
    );
  });

  test('OPT_OUT_LABEL is no-docs (matches CONTRIBUTING)', () => {
    assert.equal(OPT_OUT_LABEL, 'no-docs');
  });

  test('OK_NO_TRIGGERING_FRAGMENTS when no fragments touched at all', () => {
    const verdict = evaluateLint({
      changedFiles: ['bin/install.js'],
      fragments: [],
      labels: [],
    });
    assert.equal(verdict.ok, true);
    assert.equal(verdict.reason, LINT_REASON.OK_NO_TRIGGERING_FRAGMENTS);
    assert.deepEqual(verdict.triggering, []);
  });

  test('OK_NO_TRIGGERING_FRAGMENTS for Fixed-only fragments (bug-class)', () => {
    const verdict = evaluateLint({
      changedFiles: ['bin/install.js', '.changeset/silly-bears-dance.md'],
      fragments: [
        { path: '.changeset/silly-bears-dance.md', type: 'Fixed', body: 'fix typo', docsExempt: null },
      ],
      labels: [],
    });
    assert.deepEqual(verdict, {
      ok: true,
      reason: LINT_REASON.OK_NO_TRIGGERING_FRAGMENTS,
      triggering: [],
    });
  });

  test('OK_NO_TRIGGERING_FRAGMENTS for Security-only fragments', () => {
    const verdict = evaluateLint({
      changedFiles: [],
      fragments: [{ path: '.changeset/a.md', type: 'Security', body: 'cve', docsExempt: null }],
      labels: [],
    });
    assert.equal(verdict.ok, true);
    assert.equal(verdict.reason, LINT_REASON.OK_NO_TRIGGERING_FRAGMENTS);
  });

  test('OK_DOCS_UPDATED when Added fragment ships alongside a docs/ change', () => {
    const verdict = evaluateLint({
      changedFiles: ['.changeset/a.md', 'docs/COMMANDS.md'],
      fragments: [{ path: '.changeset/a.md', type: 'Added', body: 'new cmd', docsExempt: null }],
      labels: [],
    });
    assert.equal(verdict.ok, true);
    assert.equal(verdict.reason, LINT_REASON.OK_DOCS_UPDATED);
    assert.deepEqual(verdict.triggering, ['.changeset/a.md']);
  });

  test('OK_DOCS_UPDATED for nested docs/ paths (docs/adr/, docs/agents/)', () => {
    const verdict = evaluateLint({
      changedFiles: ['.changeset/a.md', 'docs/adr/0099-new.md'],
      fragments: [{ path: '.changeset/a.md', type: 'Changed', body: '...', docsExempt: null }],
      labels: [],
    });
    assert.equal(verdict.reason, LINT_REASON.OK_DOCS_UPDATED);
  });

  for (const type of ['Added', 'Changed', 'Deprecated', 'Removed']) {
    test(`FAIL_DOCS_MISSING when ${type} fragment has no docs/ change and no escape hatch`, () => {
      const verdict = evaluateLint({
        changedFiles: ['.changeset/a.md', 'bin/install.js'],
        fragments: [{ path: '.changeset/a.md', type, body: '...', docsExempt: null }],
        labels: [],
      });
      assert.equal(verdict.ok, false);
      assert.equal(verdict.reason, LINT_REASON.FAIL_DOCS_MISSING);
      assert.deepEqual(verdict.triggering, ['.changeset/a.md']);
    });
  }

  test('OK_OPT_OUT_LABEL when no-docs label present overrides triggering fragments', () => {
    const verdict = evaluateLint({
      changedFiles: ['.changeset/a.md', 'bin/install.js'],
      fragments: [{ path: '.changeset/a.md', type: 'Added', body: '...', docsExempt: null }],
      labels: ['no-docs'],
    });
    assert.equal(verdict.ok, true);
    assert.equal(verdict.reason, LINT_REASON.OK_OPT_OUT_LABEL);
  });

  test('per-fragment docsExempt reason exempts that fragment', () => {
    const verdict = evaluateLint({
      changedFiles: ['.changeset/a.md', 'bin/install.js'],
      fragments: [
        { path: '.changeset/a.md', type: 'Added', body: 'foo', docsExempt: 'internal-only' },
      ],
      labels: [],
    });
    assert.equal(verdict.ok, true);
    assert.equal(verdict.reason, LINT_REASON.OK_FRAGMENTS_EXEMPT);
    assert.deepEqual(verdict.triggering, ['.changeset/a.md']);
  });

  test('docsExempt empty string does NOT exempt — defense-in-depth (CodeRabbit finding)', () => {
    // parse.cjs no longer produces empty-string docsExempt (the marker regex
    // requires a non-empty reason). evaluateLint defends against any caller
    // that constructs a fragment with `docsExempt: ''` directly — empty or
    // whitespace-only reasons are not a valid audit trail.
    const verdict = evaluateLint({
      changedFiles: ['.changeset/a.md', 'bin/install.js'],
      fragments: [
        { path: '.changeset/a.md', type: 'Added', body: 'foo', docsExempt: '' },
      ],
      labels: [],
    });
    assert.equal(verdict.ok, false);
    assert.equal(verdict.reason, LINT_REASON.FAIL_DOCS_MISSING);
  });

  test('docsExempt whitespace-only does NOT exempt — defense-in-depth', () => {
    const verdict = evaluateLint({
      changedFiles: ['.changeset/a.md', 'bin/install.js'],
      fragments: [
        { path: '.changeset/a.md', type: 'Added', body: 'foo', docsExempt: '   \t' },
      ],
      labels: [],
    });
    assert.equal(verdict.reason, LINT_REASON.FAIL_DOCS_MISSING);
  });

  test('partial exemption fails — one un-marked triggering fragment is enough to require docs', () => {
    const verdict = evaluateLint({
      changedFiles: ['.changeset/a.md', '.changeset/b.md', 'bin/install.js'],
      fragments: [
        { path: '.changeset/a.md', type: 'Added', body: 'foo', docsExempt: 'x' },
        { path: '.changeset/b.md', type: 'Changed', body: 'no marker here', docsExempt: null },
      ],
      labels: [],
    });
    assert.equal(verdict.ok, false);
    assert.equal(verdict.reason, LINT_REASON.FAIL_DOCS_MISSING);
    assert.deepEqual(verdict.triggering.sort(), ['.changeset/a.md', '.changeset/b.md']);
  });

  test('mixed Fixed + Added with no docs still fails — Added triggers', () => {
    const verdict = evaluateLint({
      changedFiles: ['.changeset/a.md', '.changeset/b.md'],
      fragments: [
        { path: '.changeset/a.md', type: 'Fixed', body: '...', docsExempt: null },
        { path: '.changeset/b.md', type: 'Added', body: '...', docsExempt: null },
      ],
      labels: [],
    });
    assert.equal(verdict.ok, false);
    assert.equal(verdict.reason, LINT_REASON.FAIL_DOCS_MISSING);
    assert.deepEqual(verdict.triggering, ['.changeset/b.md']);
  });
});

describe('docs-required lint: malformed fragments fail closed (#3213, Codex finding)', () => {
  test('FAIL_MALFORMED_FRAGMENT when a touched fragment failed to parse', () => {
    const verdict = evaluateLint({
      changedFiles: ['.changeset/bad.md'],
      fragments: [],
      labels: [],
      malformed: [{ path: '.changeset/bad.md', reason: 'missing_frontmatter' }],
    });
    assert.equal(verdict.ok, false);
    assert.equal(verdict.reason, LINT_REASON.FAIL_MALFORMED_FRAGMENT);
    assert.deepEqual(verdict.malformed, [{ path: '.changeset/bad.md', reason: 'missing_frontmatter' }]);
  });

  test('FAIL_MALFORMED_FRAGMENT outranks OK_DOCS_UPDATED — malformed must be fixed first', () => {
    const verdict = evaluateLint({
      changedFiles: ['.changeset/bad.md', '.changeset/ok.md', 'docs/USER-GUIDE.md'],
      fragments: [{ path: '.changeset/ok.md', type: 'Added', body: 'fine', docsExempt: null }],
      labels: ['no-docs'],
      malformed: [{ path: '.changeset/bad.md', reason: 'invalid_type', detail: 'Bogus' }],
    });
    assert.equal(verdict.ok, false);
    assert.equal(verdict.reason, LINT_REASON.FAIL_MALFORMED_FRAGMENT);
  });

  test('no-docs label cannot bypass FAIL_MALFORMED_FRAGMENT', () => {
    const verdict = evaluateLint({
      changedFiles: ['.changeset/bad.md'],
      fragments: [],
      labels: ['no-docs'],
      malformed: [{ path: '.changeset/bad.md', reason: 'missing_pr' }],
    });
    assert.equal(verdict.reason, LINT_REASON.FAIL_MALFORMED_FRAGMENT);
  });

  test('malformed defaults to [] when omitted — back-compat with simple test inputs', () => {
    const verdict = evaluateLint({
      changedFiles: [],
      fragments: [],
      labels: [],
    });
    assert.equal(verdict.ok, true);
    assert.equal(verdict.reason, LINT_REASON.OK_NO_TRIGGERING_FRAGMENTS);
  });
});

describe('docs-required lint: helpers', () => {
  test('isFragmentPath accepts .changeset/<slug>.md, rejects README', () => {
    assert.equal(isFragmentPath('.changeset/foo.md'), true);
    assert.equal(isFragmentPath('.changeset/silly-bears-dance.md'), true);
    assert.equal(isFragmentPath('.changeset/README.md'), false);
    assert.equal(isFragmentPath('.changeset/nested/foo.md'), false);
    assert.equal(isFragmentPath('docs/COMMANDS.md'), false);
    assert.equal(isFragmentPath('bin/install.js'), false);
  });

  test('isDocsFile matches docs/ prefix only', () => {
    assert.equal(isDocsFile('docs/COMMANDS.md'), true);
    assert.equal(isDocsFile('docs/adr/0001-foo.md'), true);
    assert.equal(isDocsFile('docs/agents/triage-labels.md'), true);
    assert.equal(isDocsFile('docs'), false); // exact 'docs' without slash is not a file under docs/
    assert.equal(isDocsFile('CONTRIBUTING.md'), false);
    assert.equal(isDocsFile('README.md'), false);
  });

  test('isExemptFragment checks docsExempt is a non-empty string, not body content', () => {
    assert.equal(isExemptFragment({ docsExempt: 'reason' }), true);
    assert.equal(isExemptFragment({ docsExempt: 'a' }), true);
    // Empty/whitespace-only reason → no audit trail → not exempt.
    assert.equal(isExemptFragment({ docsExempt: '' }), false);
    assert.equal(isExemptFragment({ docsExempt: '   \t' }), false);
    assert.equal(isExemptFragment({ docsExempt: null }), false);
    assert.equal(isExemptFragment({ docsExempt: undefined }), false);
    assert.equal(isExemptFragment({}), false);
    // Body content is irrelevant — parse.cjs extracts the marker into docsExempt.
    assert.equal(
      isExemptFragment({ body: '<!-- docs-exempt: x -->', docsExempt: null }),
      false,
    );
  });
});

describe('docs-required lint: readFragmentsFromDisk', () => {
  function withTempRepo(fn) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-docs-lint-'));
    try {
      fs.mkdirSync(path.join(tmp, '.changeset'), { recursive: true });
      fn(tmp);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
    }
  }

  test('returns { fragments, malformed } shape', () => {
    withTempRepo((tmp) => {
      const out = readFragmentsFromDisk([], tmp);
      assert.ok('fragments' in out, 'has fragments');
      assert.ok('malformed' in out, 'has malformed');
      assert.deepEqual(out.fragments, []);
      assert.deepEqual(out.malformed, []);
    });
  });

  test('parses valid fragments and skips non-fragment paths', () => {
    withTempRepo((tmp) => {
      fs.writeFileSync(
        path.join(tmp, '.changeset', 'a.md'),
        '---\ntype: Added\npr: 1\n---\nnew feature\n',
      );
      fs.writeFileSync(
        path.join(tmp, '.changeset', 'b.md'),
        '---\ntype: Fixed\npr: 2\n---\nbug fix\n',
      );
      const { fragments, malformed } = readFragmentsFromDisk(
        ['.changeset/a.md', '.changeset/b.md', 'bin/x.js'],
        tmp,
      );
      assert.equal(fragments.length, 2);
      assert.equal(fragments[0].path, '.changeset/a.md');
      assert.equal(fragments[0].type, 'Added');
      assert.equal(fragments[0].docsExempt, null);
      assert.equal(fragments[1].type, 'Fixed');
      assert.deepEqual(malformed, []);
    });
  });

  test('skips deleted fragments (path in diff but file gone)', () => {
    withTempRepo((tmp) => {
      const { fragments, malformed } = readFragmentsFromDisk(['.changeset/deleted.md'], tmp);
      assert.deepEqual(fragments, []);
      assert.deepEqual(malformed, []);
    });
  });

  test('routes malformed fragments to the malformed list with typed reason', () => {
    withTempRepo((tmp) => {
      fs.writeFileSync(path.join(tmp, '.changeset', 'bad.md'), 'no frontmatter here\n');
      const { fragments, malformed } = readFragmentsFromDisk(['.changeset/bad.md'], tmp);
      assert.deepEqual(fragments, []);
      assert.equal(malformed.length, 1);
      assert.equal(malformed[0].path, '.changeset/bad.md');
      assert.equal(malformed[0].reason, 'missing_frontmatter');
    });
  });

  test('Added fragment with bad pr surfaces as malformed (Codex finding regression test)', () => {
    withTempRepo((tmp) => {
      fs.writeFileSync(
        path.join(tmp, '.changeset', 'a.md'),
        '---\ntype: Added\n---\nbody but no pr field\n',
      );
      const { fragments, malformed } = readFragmentsFromDisk(['.changeset/a.md'], tmp);
      assert.deepEqual(fragments, []);
      assert.equal(malformed.length, 1);
      assert.equal(malformed[0].reason, 'missing_pr');
      // End-to-end: feed straight into evaluateLint and confirm fail-closed.
      const verdict = evaluateLint({ changedFiles: ['.changeset/a.md'], fragments, malformed, labels: [] });
      assert.equal(verdict.reason, LINT_REASON.FAIL_MALFORMED_FRAGMENT);
    });
  });

  test('extracts docs-exempt marker into typed field and strips it from body', () => {
    withTempRepo((tmp) => {
      fs.writeFileSync(
        path.join(tmp, '.changeset', 'a.md'),
        '---\ntype: Added\npr: 3\n---\nnew thing\n\n<!-- docs-exempt: internal-only -->\n',
      );
      const { fragments } = readFragmentsFromDisk(['.changeset/a.md'], tmp);
      assert.equal(fragments.length, 1);
      assert.equal(fragments[0].docsExempt, 'internal-only');
      // The marker no longer appears in the rendered body — renderers append
      // `(#NNNN)` to body's last line, so the marker would otherwise leak into
      // CHANGELOG.md / GitHub release notes.
      assert.doesNotMatch(fragments[0].body, /docs-exempt/);
    });
  });
});
