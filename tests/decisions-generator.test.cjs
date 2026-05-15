'use strict';

/**
 * Parity test: decisions.generated.cjs vs sdk/src/query/decisions.ts
 *
 * Verifies that the generated CJS artifact matches the SDK source-of-truth
 * for all supported ID formats (numeric and alphanumeric) and edge cases.
 *
 * Covers: Phase 6 (#3575) MIGRATE_ME resolution for decisions.cjs.
 */

const assert = require('assert');
const { describe, test } = require('node:test');
const { parseDecisions } = require('../get-shit-done/bin/lib/decisions.cjs');

// ─── Core parity: numeric IDs (legacy format) ────────────────────────────────

describe('decisions-generator parity — numeric IDs (legacy)', () => {
  test('extracts D-NN entries with {id, text}', () => {
    const md = `
<decisions>
## Implementation Decisions

### Auth
- **D-01:** Use OAuth 2.0 with PKCE
- **D-02:** Session storage in Redis

### Storage
- **D-03:** Postgres 15 with pgvector
</decisions>
`;
    const ds = parseDecisions(md);
    assert.deepStrictEqual(ds.map(d => d.id), ['D-01', 'D-02', 'D-03']);
    assert.strictEqual(ds[0].text, 'Use OAuth 2.0 with PKCE');
  });

  test('returns [] when no <decisions> block is present', () => {
    assert.deepStrictEqual(parseDecisions('# Just a header\nno decisions here'), []);
  });

  test('returns [] for empty / null / undefined input', () => {
    assert.deepStrictEqual(parseDecisions(''), []);
    assert.deepStrictEqual(parseDecisions(null), []);
    assert.deepStrictEqual(parseDecisions(undefined), []);
  });

  test('ignores D-IDs outside the <decisions> block', () => {
    const md = `
Top of file. - **D-99:** Not a real decision (outside block).
<decisions>
- **D-01:** Real decision
</decisions>
After the block. - **D-77:** Also not real.
`;
    const ds = parseDecisions(md);
    assert.deepStrictEqual(ds.map(d => d.id), ['D-01']);
  });
});

// ─── Phase 6 extension: alphanumeric IDs ─────────────────────────────────────

describe('decisions-generator parity — alphanumeric IDs (Phase 6 extension)', () => {
  test('accepts alphanumeric IDs: D-INFRA-01', () => {
    const md = `
<decisions>
### Infrastructure
- **D-INFRA-01:** Use Kubernetes for orchestration
</decisions>
`;
    const ds = parseDecisions(md);
    assert.strictEqual(ds.length, 1);
    assert.strictEqual(ds[0].id, 'D-INFRA-01');
    assert.strictEqual(ds[0].text, 'Use Kubernetes for orchestration');
  });

  test('accepts alphanumeric IDs: D-42 (single numeric)', () => {
    const md = `
<decisions>
### Architecture
- **D-42:** Use microservices
</decisions>
`;
    const ds = parseDecisions(md);
    assert.strictEqual(ds[0].id, 'D-42');
  });

  test('accepts mixed numeric and alphanumeric IDs in same block', () => {
    const md = `
<decisions>
### Planning
- **D-01:** First numeric decision
- **D-FOO_BAR:** Alphanumeric with underscore
- **D-ARCH-123:** Mixed alphanumeric with hyphen
</decisions>
`;
    const ds = parseDecisions(md);
    const ids = ds.map(d => d.id);
    assert.ok(ids.includes('D-01'), 'should have D-01');
    assert.ok(ids.includes('D-FOO_BAR'), 'should have D-FOO_BAR');
    assert.ok(ids.includes('D-ARCH-123'), 'should have D-ARCH-123');
  });

  test('CJS callers can use {id, text} shape — extra fields present but safe to ignore', () => {
    const md = `
<decisions>
### Category
- **D-INFRA-01:** Database selection
</decisions>
`;
    const ds = parseDecisions(md);
    const d = ds[0];
    // Verify {id, text} is present as CJS callers expect
    assert.strictEqual(typeof d.id, 'string');
    assert.strictEqual(typeof d.text, 'string');
    // Extra SDK fields are present but can be ignored
    assert.ok('category' in d, 'category field present');
    assert.ok('tags' in d, 'tags field present');
    assert.ok('trackable' in d, 'trackable field present');
  });
});

// ─── Richer schema fields (SDK extension) ────────────────────────────────────

describe('decisions-generator parity — richer schema', () => {
  test('marks decisions under "Claude\'s Discretion" as non-trackable', () => {
    const md = `
<decisions>
### Claude's Discretion
- **D-50:** Internal naming is flexible
</decisions>
`;
    const ds = parseDecisions(md);
    assert.strictEqual(ds[0].trackable, false);
  });

  test('marks [informational] tagged decisions as non-trackable', () => {
    const md = `
<decisions>
### Info
- **D-03 [informational]:** Background context only
</decisions>
`;
    const ds = parseDecisions(md);
    assert.strictEqual(ds[0].trackable, false);
    assert.ok(ds[0].tags.includes('informational'));
  });

  test('marks [folded] tagged decisions as non-trackable', () => {
    const md = `
<decisions>
### Deferred
- **D-05 [folded]:** Will handle later
</decisions>
`;
    const ds = parseDecisions(md);
    assert.strictEqual(ds[0].trackable, false);
  });

  test('extracts category from ### heading', () => {
    const md = `
<decisions>
### Storage Backend
- **D-01:** Use PostgreSQL
</decisions>
`;
    const ds = parseDecisions(md);
    assert.strictEqual(ds[0].category, 'Storage Backend');
  });

  test('parses ALL <decisions> blocks (not just first)', () => {
    const md = `
<decisions>
### One
- **D-01:** First batch
</decisions>

Some prose.

<decisions>
### Two
- **D-02:** Second batch
</decisions>
`;
    const ids = parseDecisions(md).map(d => d.id);
    assert.ok(ids.includes('D-01'));
    assert.ok(ids.includes('D-02'));
  });

  test('strips fenced code blocks before parsing', () => {
    const md = `
\`\`\`
<decisions>
### Fake
- **D-99:** Should not be parsed
</decisions>
\`\`\`

<decisions>
### Real
- **D-01:** Real decision
</decisions>
`;
    const ds = parseDecisions(md);
    const ids = ds.map(d => d.id);
    assert.ok(ids.includes('D-01'));
    assert.ok(!ids.includes('D-99'));
  });

  test('curly-quote "Claude’s Discretion" variant is non-trackable', () => {
    const content =
      '<decisions>\n### Claude’s Discretion\n- **D-50:** Should be non-trackable\n</decisions>';
    const ds = parseDecisions(content);
    const d50 = ds.find(d => d.id === 'D-50');
    assert.ok(d50, 'D-50 should be found');
    assert.strictEqual(d50.trackable, false);
  });
});
