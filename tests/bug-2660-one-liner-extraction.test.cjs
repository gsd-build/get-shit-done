/**
 * Bug #2660: `gsd-tools milestone complete <version>` writes MILESTONES.md
 * bullets that read "- One-liner:" (the literal label) instead of the prose
 * after the label.
 *
 * Root cause: extractOneLinerFromBody() matches the first **...** span. In
 * `**One-liner:** prose`, the first span contains only `One-liner:` so the
 * function returns the label instead of the prose after it.
 */

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const { extractOneLinerFromBody } = require(
  path.join(__dirname, '..', 'get-shit-done', 'bin', 'lib', 'core.cjs')
);

describe('bug #2660: extractOneLinerFromBody', () => {
  test('a) body-style **One-liner:** label returns prose after the label', () => {
    const content =
      '# Phase 2 Plan 01: Foundation Summary\n\n**One-liner:** Real prose here.\n';
    assert.strictEqual(extractOneLinerFromBody(content), 'Real prose here.');
  });

  test('b) frontmatter-only one-liner returns null (caller handles frontmatter)', () => {
    const content =
      '---\none-liner: Set up project\n---\n\n# Phase 1: Foundation Summary\n\nBody prose with no bold line.\n';
    assert.strictEqual(extractOneLinerFromBody(content), null);
  });

  test('c) no one-liner at all returns null', () => {
    const content =
      '# Phase 1: Foundation Summary\n\nJust some narrative, no bold line.\n';
    assert.strictEqual(extractOneLinerFromBody(content), null);
  });

  test('d) bold spans inside the prose are preserved', () => {
    const content =
      '# Phase 1: Foundation Summary\n\n**One-liner:** This is **important** stuff.\n';
    assert.strictEqual(
      extractOneLinerFromBody(content),
      'This is **important** stuff.'
    );
  });

  test('e) empty prose after label returns null (no bogus bullet)', () => {
    const empty =
      '# Phase 1: Foundation Summary\n\n**One-liner:**\n\nRest of body.\n';
    const whitespace =
      '# Phase 1: Foundation Summary\n\n**One-liner:**   \n\nRest of body.\n';
    assert.strictEqual(extractOneLinerFromBody(empty), null);
    assert.strictEqual(extractOneLinerFromBody(whitespace), null);
  });

  test('f) legacy bare **prose** format still works (no label, no colon)', () => {
    // Preserve pre-existing behavior: SUMMARY files historically used
    // `**bold prose**` with no label. See tests/commands.test.cjs:366 and
    // tests/milestone.test.cjs:451 — both assert this form.
    const content =
      '---\nphase: "01"\n---\n\n# Phase 1: Foundation Summary\n\n**JWT auth with refresh rotation using jose library**\n\n## Performance\n';
    assert.strictEqual(
      extractOneLinerFromBody(content),
      'JWT auth with refresh rotation using jose library'
    );
  });

  test('g) other **Label:** prefixes (e.g. Summary:) also capture prose after label', () => {
    const content =
      '# Phase 1: Foundation Summary\n\n**Summary:** Built the thing.\n';
    assert.strictEqual(extractOneLinerFromBody(content), 'Built the thing.');
  });

  test('h) CRLF line endings (Windows) are handled', () => {
    const content =
      '---\r\nphase: "01"\r\n---\r\n\r\n# Phase 1: Foundation Summary\r\n\r\n**One-liner:** Windows-authored prose.\r\n';
    assert.strictEqual(
      extractOneLinerFromBody(content),
      'Windows-authored prose.'
    );
  });
});
