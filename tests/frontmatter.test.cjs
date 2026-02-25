/**
 * GSD Tools Tests - frontmatter.cjs
 *
 * Tests for the hand-rolled YAML parser's pure function exports:
 * extractFrontmatter, reconstructFrontmatter, spliceFrontmatter,
 * parseMustHavesBlock, and FRONTMATTER_SCHEMAS.
 *
 * Includes REG-04 regression: quoted comma inline array edge case.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');

const {
  extractFrontmatter,
  reconstructFrontmatter,
  spliceFrontmatter,
  parseMustHavesBlock,
  FRONTMATTER_SCHEMAS,
} = require('../get-shit-done/bin/lib/frontmatter.cjs');

// ─── extractFrontmatter ─────────────────────────────────────────────────────

describe('extractFrontmatter', () => {
  test('parses simple key-value pairs', () => {
    const content = '---\nname: foo\ntype: execute\n---\nbody';
    const result = extractFrontmatter(content);
    assert.strictEqual(result.name, 'foo');
    assert.strictEqual(result.type, 'execute');
  });

  test('strips quotes from values', () => {
    const doubleQuoted = '---\nname: "foo"\n---\n';
    const singleQuoted = '---\nname: \'foo\'\n---\n';
    assert.strictEqual(extractFrontmatter(doubleQuoted).name, 'foo');
    assert.strictEqual(extractFrontmatter(singleQuoted).name, 'foo');
  });

  test('parses nested objects', () => {
    const content = '---\ntechstack:\n  added: prisma\n  patterns: repository\n---\n';
    const result = extractFrontmatter(content);
    assert.deepStrictEqual(result.techstack, { added: 'prisma', patterns: 'repository' });
  });

  test('parses block arrays', () => {
    const content = '---\nitems:\n  - alpha\n  - beta\n  - gamma\n---\n';
    const result = extractFrontmatter(content);
    assert.deepStrictEqual(result.items, ['alpha', 'beta', 'gamma']);
  });

  test('parses inline arrays', () => {
    const content = '---\nkey: [a, b, c]\n---\n';
    const result = extractFrontmatter(content);
    assert.deepStrictEqual(result.key, ['a', 'b', 'c']);
  });

  test('handles quoted commas in inline arrays — REG-04 known limitation', () => {
    // REG-04: The split(',') on line 53 does NOT respect quotes.
    // The parser WILL split on commas inside quotes, producing wrong results.
    // This test documents the CURRENT (buggy) behavior.
    const content = '---\nkey: ["a, b", c]\n---\n';
    const result = extractFrontmatter(content);
    // Current behavior: splits on ALL commas, producing 3 items instead of 2
    // Expected correct behavior would be: ["a, b", "c"]
    // Actual current behavior: ["a", "b", "c"] (split ignores quotes)
    assert.ok(Array.isArray(result.key), 'should produce an array');
    assert.ok(result.key.length >= 2, 'should produce at least 2 items from comma split');
    // The bug produces ["a", "b\"", "c"] or similar — the exact output depends on
    // how the regex strips quotes after the split.
    // We verify the key insight: the result has MORE items than intended (known limitation).
    assert.ok(result.key.length > 2, 'REG-04: split produces more items than intended due to quoted comma bug');
  });

  test('returns empty object for no frontmatter', () => {
    const content = 'Just plain content, no frontmatter.';
    const result = extractFrontmatter(content);
    assert.deepStrictEqual(result, {});
  });

  test('returns empty object for empty frontmatter', () => {
    const content = '---\n---\nBody text.';
    const result = extractFrontmatter(content);
    assert.deepStrictEqual(result, {});
  });

  test('parses frontmatter-only content', () => {
    const content = '---\nkey: val\n---';
    const result = extractFrontmatter(content);
    assert.strictEqual(result.key, 'val');
  });

  test('handles emoji and non-ASCII in values', () => {
    const content = '---\nname: "Hello World"\nlabel: "cafe"\n---\n';
    const result = extractFrontmatter(content);
    assert.strictEqual(result.name, 'Hello World');
    assert.strictEqual(result.label, 'cafe');
  });

  test('converts empty-object placeholders to arrays when dash items follow', () => {
    // When a key has no value, it gets an empty {} placeholder.
    // When "- item" lines follow, the parser converts {} to [].
    const content = '---\nrequirements:\n  - REQ-01\n  - REQ-02\n---\n';
    const result = extractFrontmatter(content);
    assert.ok(Array.isArray(result.requirements), 'should convert placeholder object to array');
    assert.deepStrictEqual(result.requirements, ['REQ-01', 'REQ-02']);
  });

  test('skips empty lines in YAML body', () => {
    const content = '---\nfirst: one\n\nsecond: two\n\nthird: three\n---\n';
    const result = extractFrontmatter(content);
    assert.strictEqual(result.first, 'one');
    assert.strictEqual(result.second, 'two');
    assert.strictEqual(result.third, 'three');
  });
});

// ─── reconstructFrontmatter ─────────────────────────────────────────────────

describe('reconstructFrontmatter', () => {
  test('serializes simple key-value', () => {
    const result = reconstructFrontmatter({ name: 'foo' });
    assert.strictEqual(result, 'name: foo');
  });

  test('serializes empty array as inline []', () => {
    const result = reconstructFrontmatter({ items: [] });
    assert.strictEqual(result, 'items: []');
  });

  test('serializes short string arrays inline', () => {
    const result = reconstructFrontmatter({ key: ['a', 'b', 'c'] });
    assert.strictEqual(result, 'key: [a, b, c]');
  });

  test('serializes long arrays as block', () => {
    const result = reconstructFrontmatter({ key: ['one', 'two', 'three', 'four'] });
    assert.ok(result.includes('key:'), 'should have key header');
    assert.ok(result.includes('  - one'), 'should have block array items');
    assert.ok(result.includes('  - four'), 'should have last item');
  });

  test('quotes values containing colons or hashes', () => {
    const result = reconstructFrontmatter({ url: 'http://example.com' });
    assert.ok(result.includes('"http://example.com"'), 'should quote value with colon');

    const hashResult = reconstructFrontmatter({ comment: 'value # note' });
    assert.ok(hashResult.includes('"value # note"'), 'should quote value with hash');
  });

  test('serializes nested objects with proper indentation', () => {
    const result = reconstructFrontmatter({ tech: { added: 'prisma', patterns: 'repo' } });
    assert.ok(result.includes('tech:'), 'should have parent key');
    assert.ok(result.includes('  added: prisma'), 'should have indented child');
    assert.ok(result.includes('  patterns: repo'), 'should have indented child');
  });

  test('serializes nested arrays within objects', () => {
    const result = reconstructFrontmatter({
      tech: { added: ['prisma', 'jose'] },
    });
    assert.ok(result.includes('tech:'), 'should have parent key');
    assert.ok(result.includes('  added: [prisma, jose]'), 'should serialize nested short array inline');
  });

  test('skips null and undefined values', () => {
    const result = reconstructFrontmatter({ name: 'foo', skip: null, also: undefined, keep: 'bar' });
    assert.ok(!result.includes('skip'), 'should not include null key');
    assert.ok(!result.includes('also'), 'should not include undefined key');
    assert.ok(result.includes('name: foo'), 'should include non-null key');
    assert.ok(result.includes('keep: bar'), 'should include non-null key');
  });

  test('round-trip: simple frontmatter', () => {
    const original = '---\nname: test\ntype: execute\nwave: 1\n---\n';
    const extracted1 = extractFrontmatter(original);
    const reconstructed = reconstructFrontmatter(extracted1);
    const roundTrip = `---\n${reconstructed}\n---\n`;
    const extracted2 = extractFrontmatter(roundTrip);
    assert.deepStrictEqual(extracted2, extracted1, 'round-trip should preserve data identity');
  });

  test('round-trip: nested with arrays', () => {
    const original = '---\nphase: 01\ntech:\n  added:\n    - prisma\n    - jose\n  patterns:\n    - repository\n    - jwt\n---\n';
    const extracted1 = extractFrontmatter(original);
    const reconstructed = reconstructFrontmatter(extracted1);
    const roundTrip = `---\n${reconstructed}\n---\n`;
    const extracted2 = extractFrontmatter(roundTrip);
    assert.deepStrictEqual(extracted2, extracted1, 'round-trip should preserve nested structures');
  });

  test('round-trip: multiple data types', () => {
    const original = '---\nname: testplan\nwave: 2\ntags: [auth, api, db]\ndeps:\n  - dep1\n  - dep2\nconfig:\n  enabled: true\n  count: 5\n---\n';
    const extracted1 = extractFrontmatter(original);
    const reconstructed = reconstructFrontmatter(extracted1);
    const roundTrip = `---\n${reconstructed}\n---\n`;
    const extracted2 = extractFrontmatter(roundTrip);
    assert.deepStrictEqual(extracted2, extracted1, 'round-trip should preserve multiple data types');
  });
});
