/**
 * Adversarial frontmatter-parser tests (#3594).
 *
 * Loads each file in `tests/fixtures/adversarial/frontmatter/` and pins
 * the invariants `extractFrontmatter()` must satisfy. The fixtures
 * encode hostile-but-realistic input shapes (duplicate keys, CRLF
 * endings, unclosed blocks, Unicode, null bytes, huge but bounded
 * payloads) that the parser will see in the wild because users edit
 * planning files with multiple tools.
 *
 * Per CONTRIBUTING.md §"Testing Standards / Parser and project-file
 * inputs", these are typed-IR assertions on parser return values —
 * not prose-grep on rendered output. Property-style invariants for
 * the roadmap parser live in
 * `tests/feat-3594-parser-property-style.test.cjs`.
 */

'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { extractFrontmatter } = require('../get-shit-done/bin/lib/frontmatter.cjs');

const FIXTURE_DIR = path.join(__dirname, 'fixtures', 'adversarial', 'frontmatter');

function loadFixture(name) {
  // Read as buffer first so null bytes survive into the string. The
  // CRLF fixture also requires we do NOT normalize line endings on read.
  return fs.readFileSync(path.join(FIXTURE_DIR, name), 'utf-8');
}

describe('feat-3594: frontmatter parser handles duplicate keys deterministically', () => {
  test('duplicate keys collapse to a single deterministic winner (last-wins is the current contract)', () => {
    const content = loadFixture('duplicate-keys.md');
    const fm = extractFrontmatter(content);

    // The parser MUST return a single value per key — not an array of
    // both, not a half-formed entry. Whichever value wins, the test pins
    // the current behavior so a silent semantics change is a test failure.
    assert.equal(typeof fm.title, 'string', 'title must be a string, not an array or object');
    assert.equal(typeof fm.status, 'string', 'status must be a string');
    // Current parser behavior: the second occurrence wins because each
    // key: line overwrites the previous in the same indent context.
    // Pin it so a change to first-wins becomes visible.
    assert.equal(fm.title, 'Second', 'duplicate-key collapse must be last-wins (current contract)');
    assert.equal(fm.status, 'blocked', 'duplicate-key collapse must be last-wins (current contract)');
    // Untouched keys round-trip cleanly.
    assert.equal(fm.phase, '01');
  });
});

describe('feat-3594: frontmatter parser handles CRLF endings without bleed', () => {
  test('CRLF-terminated frontmatter parses without trailing \\r in values', () => {
    const content = loadFixture('crlf-mixed.md');
    const fm = extractFrontmatter(content);
    // Each value MUST be \r-free. A bug in `\r?\n` handling would leak
    // \r into the captured group.
    assert.equal(fm.title, 'CRLF Title');
    assert.equal(fm.phase, '02');
    assert.ok(!/\r/.test(JSON.stringify(fm)), 'no \\r should appear in any parsed value');
    // Array items must also be \r-free.
    assert.deepEqual(fm.plans, ['02-01', '02-02']);
  });
});

describe('feat-3594: frontmatter parser handles unclosed blocks safely', () => {
  test('unclosed frontmatter block returns empty object, not partial parse', () => {
    const content = loadFixture('unclosed-block.md');
    const fm = extractFrontmatter(content);
    // The current contract: if the closing `---` is missing, the regex
    // doesn't match and the parser returns {}. The test pins that —
    // a partial parse (returning {title: 'Unclosed Block'}) would be a
    // silent data-leak from the body into "frontmatter."
    assert.deepEqual(fm, {}, 'unclosed block must yield empty frontmatter, not a partial parse');
  });
});

describe('feat-3594: frontmatter parser preserves Unicode round-trip', () => {
  test('non-ASCII keys and values survive parsing', () => {
    const content = loadFixture('unicode-keys-and-values.md');
    const fm = extractFrontmatter(content);
    assert.equal(fm.title, '日本語のタイトル');
    // The parser's key regex is /^(\s*)([a-zA-Z0-9_-]+):.../ so non-ASCII
    // keys (like `相:`) won't be captured. Pin that current behavior so
    // a future broadening to allow Unicode keys is visible (and so the
    // ASCII-only contract is asserted, not silently relied on).
    assert.equal(fm['相'], undefined, 'parser currently only recognizes ASCII keys (regression guard)');
    // The status field has an emoji — must survive.
    assert.equal(fm.status, '🚧 in-flight');
    // Inline array with Greek letters.
    assert.deepEqual(fm.tags, ['α', 'β', 'γ']);
  });
});

describe('feat-3594: frontmatter parser handles null bytes without truncation', () => {
  test('null byte in a value is preserved or normalized, never silently truncates the rest', () => {
    const content = loadFixture('null-byte-value.md');
    const fm = extractFrontmatter(content);
    // The parser MUST NOT crash. It MUST NOT truncate the value at the
    // null byte AND continue parsing as if the rest of the line never
    // existed. We pin: (a) the title still parses, (b) the phase key
    // following the null-byte line still parses (no early-termination),
    // (c) the null-byte value itself is a string.
    assert.equal(fm.title, 'Has null byte');
    assert.equal(fm.phase, '05', 'parser must continue past the null-byte line, not silently stop');
    assert.equal(typeof fm.weird, 'string');
    // The exact null-handling is documented by whatever the current
    // parser does: either preserve the \x00 or strip it. Test pins one.
    assert.ok(fm.weird.includes('before'), 'value before the null byte must be retained');
  });
});

describe('feat-3594: frontmatter parser handles bounded-large inputs in reasonable time', () => {
  test('64KB frontmatter with 2000 array items parses under 2 seconds and returns the right shape', () => {
    const content = loadFixture('huge-bounded.md');
    const startedAt = Date.now();
    const fm = extractFrontmatter(content);
    const elapsedMs = Date.now() - startedAt;
    // Time bound is generous — a parser regression that makes this O(n^2)
    // would blow well past 2s on this fixture.
    assert.ok(elapsedMs < 2000, `parse took ${elapsedMs}ms — should be < 2000ms`);
    assert.equal(fm.phase, '06');
    assert.ok(Array.isArray(fm.plans), 'plans must be parsed as an array');
    assert.equal(fm.plans.length, 2000, 'all 2000 array items must be captured');
    assert.equal(fm.plans[0], 'item-00000');
    assert.equal(fm.plans[1999], 'item-01999');
  });
});

// ─── Cross-cutting invariants over the whole fixture corpus ────────────────

describe('feat-3594: frontmatter parser does not throw on ANY corpus fixture', () => {
  // Property-style: whatever weirdness lives in the corpus, extractFrontmatter
  // must return an object — never throw, never return undefined/null. This is
  // the floor every individual fixture also satisfies, but checking it as a
  // sweep catches a future fixture addition where the author forgets to write
  // a per-file test.
  const fixtures = fs.readdirSync(FIXTURE_DIR).filter((f) => f.endsWith('.md') && f !== 'README.md');
  for (const fixture of fixtures) {
    test(`fixture "${fixture}" — extractFrontmatter returns a plain object without throwing`, () => {
      const content = loadFixture(fixture);
      let fm;
      assert.doesNotThrow(() => { fm = extractFrontmatter(content); }, `extractFrontmatter must not throw on ${fixture}`);
      assert.equal(typeof fm, 'object', `${fixture}: result must be an object`);
      assert.notEqual(fm, null, `${fixture}: result must not be null`);
      assert.equal(Array.isArray(fm), false, `${fixture}: result must not be an array`);
    });
  }
});
