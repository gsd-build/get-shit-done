/**
 * Learnings Store Tests
 *
 * Tests for the global learnings CRUD library: write, read, list, query,
 * delete, dedup, empty store, malformed file handling, copyFromProject, prune.
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  learningsWrite,
  learningsRead,
  learningsList,
  learningsQuery,
  learningsDelete,
  learningsCopyFromProject,
  learningsPrune,
} = require('../get-shit-done/bin/lib/learnings.cjs');
const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

// ─── Test Helpers ────────────────────────────────────────────────────────────

/**
 * Create a unique temp directory for each test.
 * @returns {string}
 */
function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-learnings-test-'));
}

/**
 * Remove a directory recursively.
 * @param {string} dir
 */
function cleanupDir(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// ─── Write ───────────────────────────────────────────────────────────────────

describe('learningsWrite', () => {
  let storeDir;
  beforeEach(() => { storeDir = makeTempDir(); });
  afterEach(() => { cleanupDir(storeDir); });

  test('creates a learning file with all required fields', () => {
    const result = learningsWrite({
      source_project: 'test-project',
      learning: 'Always validate inputs before processing',
      context: 'security review',
      tags: ['security', 'validation'],
    }, { storeDir });

    assert.ok(result.id, 'should return an id');
    assert.strictEqual(result.created, true);
    assert.ok(result.content_hash, 'should return a content_hash');

    // Verify file exists and has correct structure
    const filePath = path.join(storeDir, `${result.id}.json`);
    assert.ok(fs.existsSync(filePath), 'file should exist on disk');

    const record = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    assert.strictEqual(record.id, result.id);
    assert.strictEqual(record.source_project, 'test-project');
    assert.strictEqual(record.learning, 'Always validate inputs before processing');
    assert.strictEqual(record.context, 'security review');
    assert.deepStrictEqual(record.tags, ['security', 'validation']);
    assert.strictEqual(record.content_hash, result.content_hash);
    assert.ok(record.date, 'should have a date');
  });

  test('creates store directory on first write', () => {
    const nestedDir = path.join(storeDir, 'nested', 'store');
    assert.ok(!fs.existsSync(nestedDir), 'dir should not exist yet');

    learningsWrite({
      source_project: 'test',
      learning: 'test learning',
    }, { storeDir: nestedDir });

    assert.ok(fs.existsSync(nestedDir), 'dir should be created on write');
  });

  test('defaults context to empty string and tags to empty array', () => {
    const result = learningsWrite({
      source_project: 'test',
      learning: 'minimal entry',
    }, { storeDir });

    const record = learningsRead(result.id, { storeDir });
    assert.strictEqual(record.context, '');
    assert.deepStrictEqual(record.tags, []);
  });
});

// ─── Deduplication ───────────────────────────────────────────────────────────

describe('deduplication', () => {
  let storeDir;
  beforeEach(() => { storeDir = makeTempDir(); });
  afterEach(() => { cleanupDir(storeDir); });

  test('same content from same project is not stored twice', () => {
    const entry = {
      source_project: 'my-project',
      learning: 'Use content hashing for dedup',
      tags: ['dedup'],
    };

    const first = learningsWrite(entry, { storeDir });
    const second = learningsWrite(entry, { storeDir });

    assert.strictEqual(first.created, true);
    assert.strictEqual(second.created, false);
    assert.strictEqual(first.content_hash, second.content_hash);
    assert.strictEqual(first.id, second.id);

    // Only one file on disk
    const files = fs.readdirSync(storeDir).filter(f => f.endsWith('.json'));
    assert.strictEqual(files.length, 1);
  });

  test('same learning from different projects creates separate entries', () => {
    const learning = 'Same learning text';

    const first = learningsWrite({
      source_project: 'project-a',
      learning,
    }, { storeDir });

    const second = learningsWrite({
      source_project: 'project-b',
      learning,
    }, { storeDir });

    assert.strictEqual(first.created, true);
    assert.strictEqual(second.created, true);
    assert.notStrictEqual(first.content_hash, second.content_hash);

    const files = fs.readdirSync(storeDir).filter(f => f.endsWith('.json'));
    assert.strictEqual(files.length, 2);
  });
});

// ─── Read ────────────────────────────────────────────────────────────────────

describe('learningsRead', () => {
  let storeDir;
  beforeEach(() => { storeDir = makeTempDir(); });
  afterEach(() => { cleanupDir(storeDir); });

  test('returns a learning by ID', () => {
    const { id } = learningsWrite({
      source_project: 'test',
      learning: 'readable entry',
      tags: ['read'],
    }, { storeDir });

    const record = learningsRead(id, { storeDir });
    assert.ok(record);
    assert.strictEqual(record.id, id);
    assert.strictEqual(record.learning, 'readable entry');
  });

  test('returns null for non-existent ID', () => {
    const record = learningsRead('does-not-exist', { storeDir });
    assert.strictEqual(record, null);
  });
});

// ─── List ────────────────────────────────────────────────────────────────────

describe('learningsList', () => {
  let storeDir;
  beforeEach(() => { storeDir = makeTempDir(); });
  afterEach(() => { cleanupDir(storeDir); });

  test('returns empty array for empty store', () => {
    const results = learningsList({ storeDir });
    assert.deepStrictEqual(results, []);
  });

  test('returns empty array when store dir does not exist', () => {
    const results = learningsList({ storeDir: path.join(storeDir, 'nonexistent') });
    assert.deepStrictEqual(results, []);
  });

  test('returns all learnings sorted by date (newest first)', () => {
    // Write three entries with controlled dates
    const id1 = learningsWrite({
      source_project: 'p1',
      learning: 'first',
    }, { storeDir }).id;

    // Manually adjust dates to control sort order
    const file1 = path.join(storeDir, `${id1}.json`);
    const rec1 = JSON.parse(fs.readFileSync(file1, 'utf-8'));
    rec1.date = '2025-01-01T00:00:00.000Z';
    fs.writeFileSync(file1, JSON.stringify(rec1));

    const id2 = learningsWrite({
      source_project: 'p2',
      learning: 'second',
    }, { storeDir }).id;

    const file2 = path.join(storeDir, `${id2}.json`);
    const rec2 = JSON.parse(fs.readFileSync(file2, 'utf-8'));
    rec2.date = '2025-06-15T00:00:00.000Z';
    fs.writeFileSync(file2, JSON.stringify(rec2));

    const id3 = learningsWrite({
      source_project: 'p3',
      learning: 'third',
    }, { storeDir }).id;

    const file3 = path.join(storeDir, `${id3}.json`);
    const rec3 = JSON.parse(fs.readFileSync(file3, 'utf-8'));
    rec3.date = '2025-03-10T00:00:00.000Z';
    fs.writeFileSync(file3, JSON.stringify(rec3));

    const results = learningsList({ storeDir });
    assert.strictEqual(results.length, 3);
    assert.strictEqual(results[0].learning, 'second');  // newest
    assert.strictEqual(results[1].learning, 'third');    // middle
    assert.strictEqual(results[2].learning, 'first');    // oldest
  });
});

// ─── Query ───────────────────────────────────────────────────────────────────

describe('learningsQuery', () => {
  let storeDir;
  beforeEach(() => { storeDir = makeTempDir(); });
  afterEach(() => { cleanupDir(storeDir); });

  test('filters by tag', () => {
    learningsWrite({
      source_project: 'p1',
      learning: 'auth lesson',
      tags: ['auth', 'security'],
    }, { storeDir });

    learningsWrite({
      source_project: 'p2',
      learning: 'ui lesson',
      tags: ['ui', 'css'],
    }, { storeDir });

    learningsWrite({
      source_project: 'p3',
      learning: 'auth pattern',
      tags: ['auth', 'patterns'],
    }, { storeDir });

    const results = learningsQuery({ tag: 'auth' }, { storeDir });
    assert.strictEqual(results.length, 2);
    assert.ok(results.every(r => r.tags.includes('auth')));
  });

  test('returns all when no tag filter', () => {
    learningsWrite({ source_project: 'p1', learning: 'a' }, { storeDir });
    learningsWrite({ source_project: 'p2', learning: 'b' }, { storeDir });

    const results = learningsQuery({}, { storeDir });
    assert.strictEqual(results.length, 2);
  });

  test('returns empty array when tag not found', () => {
    learningsWrite({
      source_project: 'p1',
      learning: 'something',
      tags: ['other'],
    }, { storeDir });

    const results = learningsQuery({ tag: 'nonexistent' }, { storeDir });
    assert.strictEqual(results.length, 0);
  });
});

// ─── Delete ──────────────────────────────────────────────────────────────────

describe('learningsDelete', () => {
  let storeDir;
  beforeEach(() => { storeDir = makeTempDir(); });
  afterEach(() => { cleanupDir(storeDir); });

  test('removes a learning by ID', () => {
    const { id } = learningsWrite({
      source_project: 'test',
      learning: 'to be deleted',
    }, { storeDir });

    assert.strictEqual(learningsDelete(id, { storeDir }), true);
    assert.strictEqual(learningsRead(id, { storeDir }), null);

    const files = fs.readdirSync(storeDir).filter(f => f.endsWith('.json'));
    assert.strictEqual(files.length, 0);
  });

  test('returns false for non-existent ID', () => {
    assert.strictEqual(learningsDelete('nonexistent', { storeDir }), false);
  });
});

// ─── Malformed File Handling ─────────────────────────────────────────────────

describe('malformed file handling', () => {
  let storeDir;
  beforeEach(() => { storeDir = makeTempDir(); });
  afterEach(() => { cleanupDir(storeDir); });

  test('list skips malformed JSON files with warning', () => {
    // Write a valid entry
    learningsWrite({
      source_project: 'test',
      learning: 'valid entry',
    }, { storeDir });

    // Write a malformed JSON file
    fs.writeFileSync(path.join(storeDir, 'bad-entry.json'), '{not valid json!!!', 'utf-8');

    const results = learningsList({ storeDir });
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].learning, 'valid entry');
  });

  test('write dedup check skips malformed files without crashing', () => {
    // Write a malformed JSON file first
    fs.writeFileSync(path.join(storeDir, 'corrupt.json'), 'corrupted!', 'utf-8');

    // Writing should still succeed
    const result = learningsWrite({
      source_project: 'test',
      learning: 'new entry after corrupt',
    }, { storeDir });

    assert.strictEqual(result.created, true);
  });
});

// ─── Copy From Project ───────────────────────────────────────────────────────

describe('learningsCopyFromProject', () => {
  let storeDir;
  let projectDir;

  beforeEach(() => {
    storeDir = makeTempDir();
    projectDir = makeTempDir();
  });
  afterEach(() => {
    cleanupDir(storeDir);
    cleanupDir(projectDir);
  });

  test('copies learnings from LEARNINGS.md into global store', () => {
    const learningsMd = `# Project Learnings

## Authentication Patterns
Always use OAuth2 for third-party auth.
Never store tokens in localStorage.

## Database Design
Normalize to 3NF unless read performance demands denormalization.

## Error Handling
Use custom error classes that extend Error.
`;
    fs.writeFileSync(path.join(projectDir, 'LEARNINGS.md'), learningsMd, 'utf-8');

    const result = learningsCopyFromProject(projectDir, {
      storeDir,
      sourceProject: 'my-app',
    });

    assert.strictEqual(result.created, 3);
    assert.strictEqual(result.skipped, 0);

    const all = learningsList({ storeDir });
    assert.strictEqual(all.length, 3);

    // Verify content was captured
    const learningTexts = all.map(r => r.learning);
    assert.ok(learningTexts.some(t => t.includes('OAuth2')));
    assert.ok(learningTexts.some(t => t.includes('Normalize to 3NF')));
    assert.ok(learningTexts.some(t => t.includes('custom error classes')));
  });

  test('deduplicates on second copy', () => {
    const learningsMd = `# Learnings

## Testing
Always write tests first.
`;
    fs.writeFileSync(path.join(projectDir, 'LEARNINGS.md'), learningsMd, 'utf-8');

    learningsCopyFromProject(projectDir, { storeDir, sourceProject: 'app' });
    const second = learningsCopyFromProject(projectDir, { storeDir, sourceProject: 'app' });

    assert.strictEqual(second.created, 0);
    assert.strictEqual(second.skipped, 1);

    const all = learningsList({ storeDir });
    assert.strictEqual(all.length, 1);
  });

  test('returns zero counts when LEARNINGS.md does not exist', () => {
    const result = learningsCopyFromProject(projectDir, { storeDir });
    assert.deepStrictEqual(result, { total: 0, created: 0, skipped: 0 });
  });

  test('skips sections with empty body', () => {
    const learningsMd = `# Learnings

## Empty Section

## Has Content
Real content here.
`;
    fs.writeFileSync(path.join(projectDir, 'LEARNINGS.md'), learningsMd, 'utf-8');

    const result = learningsCopyFromProject(projectDir, { storeDir, sourceProject: 'app' });
    assert.strictEqual(result.created, 1);

    const all = learningsList({ storeDir });
    assert.strictEqual(all.length, 1);
    assert.ok(all[0].learning.includes('Real content'));
  });
});

// ─── Prune ───────────────────────────────────────────────────────────────────

describe('learningsPrune', () => {
  let storeDir;
  beforeEach(() => { storeDir = makeTempDir(); });
  afterEach(() => { cleanupDir(storeDir); });

  test('removes entries older than threshold', () => {
    // Create an old entry
    const oldId = learningsWrite({
      source_project: 'old-project',
      learning: 'ancient wisdom',
    }, { storeDir }).id;

    // Backdate it to 100 days ago
    const oldFile = path.join(storeDir, `${oldId}.json`);
    const oldRec = JSON.parse(fs.readFileSync(oldFile, 'utf-8'));
    oldRec.date = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString();
    fs.writeFileSync(oldFile, JSON.stringify(oldRec));

    // Create a recent entry
    learningsWrite({
      source_project: 'new-project',
      learning: 'fresh knowledge',
    }, { storeDir });

    const result = learningsPrune('90d', { storeDir });
    assert.strictEqual(result.removed, 1);
    assert.strictEqual(result.kept, 1);

    const remaining = learningsList({ storeDir });
    assert.strictEqual(remaining.length, 1);
    assert.strictEqual(remaining[0].learning, 'fresh knowledge');
  });

  test('keeps all entries when none are old enough', () => {
    learningsWrite({ source_project: 'p', learning: 'recent' }, { storeDir });

    const result = learningsPrune('30d', { storeDir });
    assert.strictEqual(result.removed, 0);
    assert.strictEqual(result.kept, 1);
  });

  test('returns zeros when store does not exist', () => {
    const result = learningsPrune('90d', { storeDir: path.join(storeDir, 'nope') });
    assert.deepStrictEqual(result, { removed: 0, kept: 0 });
  });

  test('throws on invalid duration format', () => {
    assert.throws(
      () => learningsPrune('invalid', { storeDir }),
      /Invalid duration format/
    );
  });
});

// ─── CLI Integration ────────────────────────────────────────────────────────

describe('CLI integration', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = createTempProject(); });
  afterEach(() => { cleanup(tmpDir); });

  test('learnings list returns valid JSON', () => {
    const res = runGsdTools(['learnings', 'list'], tmpDir, { HOME: tmpDir });
    assert.strictEqual(res.success, true);
    const parsed = JSON.parse(res.output);
    assert.ok(Array.isArray(parsed.learnings));
    assert.strictEqual(typeof parsed.count, 'number');
  });

  test('learnings query --tag succeeds', () => {
    const res = runGsdTools(['learnings', 'query', '--tag', 'auth'], tmpDir, { HOME: tmpDir });
    assert.strictEqual(res.success, true);
    const parsed = JSON.parse(res.output);
    assert.ok(Array.isArray(parsed.learnings));
  });

  test('learnings prune with bad format exits non-zero', () => {
    const res = runGsdTools(['learnings', 'prune', '--older-than', 'badformat'], tmpDir, { HOME: tmpDir });
    assert.strictEqual(res.success, false);
    assert.ok(res.error.includes('Invalid duration format'));
  });

  test('learnings unknown subcommand exits non-zero', () => {
    const res = runGsdTools(['learnings', 'unknown'], tmpDir, { HOME: tmpDir });
    assert.strictEqual(res.success, false);
    assert.ok(res.error.includes('Unknown learnings subcommand'));
  });
});
