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
} = require(path.join(__dirname, '..', 'scripts', 'lint-docs-required.cjs'));

// evaluateLint is pure over the resolved inputs (changedFiles, fragments, labels).
// Tests assert on the structured verdict: { ok, reason: LINT_REASON.X }.

describe('docs-required lint: pure verdict (#3213)', () => {
  test('LINT_REASON enum exposes the documented codes', () => {
    assert.deepEqual(
      Object.keys(LINT_REASON).sort(),
      [
        'FAIL_DOCS_MISSING',
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
        { path: '.changeset/silly-bears-dance.md', type: 'Fixed', body: 'fix typo' },
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
      fragments: [{ path: '.changeset/a.md', type: 'Security', body: 'cve' }],
      labels: [],
    });
    assert.equal(verdict.ok, true);
    assert.equal(verdict.reason, LINT_REASON.OK_NO_TRIGGERING_FRAGMENTS);
  });

  test('OK_DOCS_UPDATED when Added fragment ships alongside a docs/ change', () => {
    const verdict = evaluateLint({
      changedFiles: ['.changeset/a.md', 'docs/COMMANDS.md'],
      fragments: [{ path: '.changeset/a.md', type: 'Added', body: 'new cmd' }],
      labels: [],
    });
    assert.equal(verdict.ok, true);
    assert.equal(verdict.reason, LINT_REASON.OK_DOCS_UPDATED);
    assert.deepEqual(verdict.triggering, ['.changeset/a.md']);
  });

  test('OK_DOCS_UPDATED for nested docs/ paths (docs/adr/, docs/agents/)', () => {
    const verdict = evaluateLint({
      changedFiles: ['.changeset/a.md', 'docs/adr/0099-new.md'],
      fragments: [{ path: '.changeset/a.md', type: 'Changed', body: '...' }],
      labels: [],
    });
    assert.equal(verdict.reason, LINT_REASON.OK_DOCS_UPDATED);
  });

  for (const type of ['Added', 'Changed', 'Deprecated', 'Removed']) {
    test(`FAIL_DOCS_MISSING when ${type} fragment has no docs/ change and no escape hatch`, () => {
      const verdict = evaluateLint({
        changedFiles: ['.changeset/a.md', 'bin/install.js'],
        fragments: [{ path: '.changeset/a.md', type, body: '...' }],
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
      fragments: [{ path: '.changeset/a.md', type: 'Added', body: '...' }],
      labels: ['no-docs'],
    });
    assert.equal(verdict.ok, true);
    assert.equal(verdict.reason, LINT_REASON.OK_OPT_OUT_LABEL);
  });

  test('per-fragment <!-- docs-exempt: reason --> marker exempts that fragment', () => {
    const verdict = evaluateLint({
      changedFiles: ['.changeset/a.md', 'bin/install.js'],
      fragments: [
        { path: '.changeset/a.md', type: 'Added', body: 'foo\n\n<!-- docs-exempt: internal-only -->\n' },
      ],
      labels: [],
    });
    assert.equal(verdict.ok, true);
    assert.equal(verdict.reason, LINT_REASON.OK_FRAGMENTS_EXEMPT);
    assert.deepEqual(verdict.triggering, ['.changeset/a.md']);
  });

  test('partial exemption fails — one un-marked triggering fragment is enough to require docs', () => {
    const verdict = evaluateLint({
      changedFiles: ['.changeset/a.md', '.changeset/b.md', 'bin/install.js'],
      fragments: [
        { path: '.changeset/a.md', type: 'Added', body: '<!-- docs-exempt: x -->' },
        { path: '.changeset/b.md', type: 'Changed', body: 'no marker here' },
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
        { path: '.changeset/a.md', type: 'Fixed', body: '...' },
        { path: '.changeset/b.md', type: 'Added', body: '...' },
      ],
      labels: [],
    });
    assert.equal(verdict.ok, false);
    assert.equal(verdict.reason, LINT_REASON.FAIL_DOCS_MISSING);
    assert.deepEqual(verdict.triggering, ['.changeset/b.md']);
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
});

describe('docs-required lint: readFragmentsFromDisk', () => {
  function withTempRepo(fn) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-docs-lint-'));
    try {
      fs.mkdirSync(path.join(tmp, '.changeset'), { recursive: true });
      fn(tmp);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }

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
      const out = readFragmentsFromDisk(
        ['.changeset/a.md', '.changeset/b.md', 'bin/x.js'],
        tmp,
      );
      assert.equal(out.length, 2);
      assert.equal(out[0].path, '.changeset/a.md');
      assert.equal(out[0].type, 'Added');
      assert.equal(out[1].type, 'Fixed');
    });
  });

  test('skips deleted fragments (path in diff but file gone)', () => {
    withTempRepo((tmp) => {
      const out = readFragmentsFromDisk(['.changeset/deleted.md'], tmp);
      assert.deepEqual(out, []);
    });
  });

  test('skips malformed fragments (changeset lint handles them separately)', () => {
    withTempRepo((tmp) => {
      fs.writeFileSync(path.join(tmp, '.changeset', 'bad.md'), 'no frontmatter here\n');
      const out = readFragmentsFromDisk(['.changeset/bad.md'], tmp);
      assert.deepEqual(out, []);
    });
  });

  test('preserves body verbatim so docs-exempt marker is visible to evaluateLint', () => {
    withTempRepo((tmp) => {
      fs.writeFileSync(
        path.join(tmp, '.changeset', 'a.md'),
        '---\ntype: Added\npr: 3\n---\nnew thing\n<!-- docs-exempt: internal -->\n',
      );
      const out = readFragmentsFromDisk(['.changeset/a.md'], tmp);
      assert.equal(out.length, 1);
      assert.match(out[0].body, /docs-exempt/);
    });
  });
});
