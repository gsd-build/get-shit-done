'use strict';
// allow-test-rule: pending-migration-to-typed-ir [#2974]
// Tracked in #2974 for migration to typed-IR assertions per CONTRIBUTING.md
// "Prohibited: Raw Text Matching on Test Outputs". Do not copy this pattern.

process.env.GSD_TEST_MODE = '1';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { detectVarBindingViolations, VIOLATION } = require(path.join(__dirname, '..', 'scripts', 'lint-no-source-grep-extras.cjs'));

// detectVarBindingViolations is pure: takes source text, returns a list of
// violation records. Tests assert on the structured records, not on the
// detector's prose (per "Prohibited: Raw Text Matching on Test Outputs").

describe('Bug #2982: var-binding readFileSync.includes() detector', () => {
  test('VIOLATION enum exposes the documented codes', () => {
    assert.deepEqual(
      Object.keys(VIOLATION).sort(),
      ['VAR_FROM_READFILE_USED_IN_TEXT_MATCH', 'WRAPPED_ASSERT_OK_MATCH'].sort(),
    );
  });

  test('flags a single var bound from readFileSync then used with .includes() later', () => {
    const src = [
      "const x = fs.readFileSync('foo.cjs', 'utf8');",
      '// some lines later',
      "if (x.includes('foo')) { /* ... */ }",
    ].join('\n');
    const findings = detectVarBindingViolations(src);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].kind, VIOLATION.VAR_FROM_READFILE_USED_IN_TEXT_MATCH);
    assert.equal(findings[0].variable, 'x');
    assert.equal(findings[0].method, 'includes');
  });
});

describe('Bug #2982: var-binding detector — coverage of methods (#2982)', () => {
  const { detectVarBindingViolations, VIOLATION } = require(require('node:path').join(__dirname, '..', 'scripts', 'lint-no-source-grep-extras.cjs'));

  for (const method of ['includes', 'startsWith', 'endsWith', 'match', 'search']) {
    test(`flags <var>.${method}( on a readFileSync-bound variable`, () => {
      const src = `const c = fs.readFileSync('x.cjs','utf8');\nc.${method}('foo');\n`;
      const findings = detectVarBindingViolations(src);
      assert.equal(findings.length, 1);
      assert.equal(findings[0].method, method);
    });
  }

  test('flags multiple violations across multiple variables', () => {
    const src = [
      "const a = readFileSync('a.cjs', 'utf8');",
      "const b = fs.readFileSync('b.cjs');",
      "if (a.includes('x')) {}",
      "if (b.startsWith('y')) {}",
      "a.endsWith('z');",
    ].join('\n');
    const findings = detectVarBindingViolations(src);
    assert.equal(findings.length, 3);
    const byVar = findings.reduce((acc, f) => {
      acc[f.variable] = (acc[f.variable] || []).concat(f.method);
      return acc;
    }, {});
    assert.deepEqual(byVar.a.sort(), ['endsWith', 'includes']);
    assert.deepEqual(byVar.b, ['startsWith']);
  });

  test('does NOT flag .includes() on a variable that was not bound from readFileSync', () => {
    const src = "const arr = [1, 2, 3];\nif (arr.includes(2)) {}";
    assert.deepEqual(detectVarBindingViolations(src), []);
  });

  test('does NOT flag a fresh string literal substring check', () => {
    const src = "if ('hello world'.includes('world')) {}";
    assert.deepEqual(detectVarBindingViolations(src), []);
  });
});

describe('Bug #2982: assert.ok(...match(...)) detector', () => {
  const { detectWrappedAssertOkMatch, VIOLATION } = require(require('node:path').join(__dirname, '..', 'scripts', 'lint-no-source-grep-extras.cjs'));

  test('flags assert.ok(text.match(/.../)) which escapes assert.match', () => {
    const src = "assert.ok(text.match(/Failures: \\d+/));";
    const findings = detectWrappedAssertOkMatch(src);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].kind, VIOLATION.WRAPPED_ASSERT_OK_MATCH);
  });

  test('does NOT flag assert.match itself (covered by base lint)', () => {
    const src = "assert.match(text, /foo/);";
    assert.deepEqual(detectWrappedAssertOkMatch(src), []);
  });

  test('does NOT flag .matchAll(...) — matchAll is not match, so assert.ok(.matchAll(...)) is not flagged', () => {
    const src = "assert.ok([...text.matchAll(/foo/g)].length > 0);";
    assert.deepEqual(detectWrappedAssertOkMatch(src), []);
  });
});
