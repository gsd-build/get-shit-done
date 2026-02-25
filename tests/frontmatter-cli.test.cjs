/**
 * GSD Tools Tests - frontmatter CLI integration
 *
 * Integration tests for the 4 frontmatter subcommands (get, set, merge, validate)
 * exercised through gsd-tools.cjs via execSync.
 *
 * Each test creates its own temp file, runs the CLI command, asserts output,
 * and cleans up in afterEach (per-test cleanup with individual temp files).
 */

const { test, describe, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { runGsdTools } = require('./helpers.cjs');

// Track temp files for cleanup
let tempFiles = [];

function writeTempFile(content) {
  const tmpFile = path.join(os.tmpdir(), `gsd-fm-test-${Date.now()}-${Math.random().toString(36).slice(2)}.md`);
  fs.writeFileSync(tmpFile, content, 'utf-8');
  tempFiles.push(tmpFile);
  return tmpFile;
}

afterEach(() => {
  for (const f of tempFiles) {
    try { fs.unlinkSync(f); } catch { /* already cleaned */ }
  }
  tempFiles = [];
});

// ─── frontmatter get ────────────────────────────────────────────────────────

describe('frontmatter get', () => {
  test('returns all fields as JSON', () => {
    const file = writeTempFile('---\nphase: 01\nplan: 01\ntype: execute\n---\nbody text');
    const result = runGsdTools(`frontmatter get ${file}`);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.phase, '01');
    assert.strictEqual(parsed.plan, '01');
    assert.strictEqual(parsed.type, 'execute');
  });

  test('returns specific field with --field', () => {
    const file = writeTempFile('---\nphase: 01\nplan: 02\ntype: tdd\n---\nbody');
    const result = runGsdTools(`frontmatter get ${file} --field phase`);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.phase, '01');
  });

  test('returns error for missing field', () => {
    const file = writeTempFile('---\nphase: 01\n---\n');
    const result = runGsdTools(`frontmatter get ${file} --field nonexistent`);
    // The command succeeds (exit 0) but returns an error object in JSON
    assert.ok(result.success, 'Command should exit 0');
    const parsed = JSON.parse(result.output);
    assert.ok(parsed.error, 'Should have error field');
    assert.ok(parsed.error.includes('Field not found'), 'Error should mention "Field not found"');
  });

  test('returns error for missing file', () => {
    const result = runGsdTools('frontmatter get /nonexistent/path/file.md');
    assert.ok(result.success, 'Command should exit 0 with error JSON');
    const parsed = JSON.parse(result.output);
    assert.ok(parsed.error, 'Should have error field');
  });

  test('handles file with no frontmatter', () => {
    const file = writeTempFile('Plain text with no frontmatter delimiters.');
    const result = runGsdTools(`frontmatter get ${file}`);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const parsed = JSON.parse(result.output);
    assert.deepStrictEqual(parsed, {}, 'Should return empty object for no frontmatter');
  });
});

// ─── frontmatter set ────────────────────────────────────────────────────────

describe('frontmatter set', () => {
  test('updates existing field', () => {
    const file = writeTempFile('---\nphase: 01\ntype: execute\n---\nbody');
    const result = runGsdTools(`frontmatter set ${file} --field phase --value "02"`);
    assert.ok(result.success, `Command failed: ${result.error}`);

    // Read back and verify
    const content = fs.readFileSync(file, 'utf-8');
    const { extractFrontmatter } = require('../get-shit-done/bin/lib/frontmatter.cjs');
    const fm = extractFrontmatter(content);
    assert.strictEqual(fm.phase, '02');
  });

  test('adds new field', () => {
    const file = writeTempFile('---\nphase: 01\n---\nbody');
    const result = runGsdTools(`frontmatter set ${file} --field status --value "active"`);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const content = fs.readFileSync(file, 'utf-8');
    const { extractFrontmatter } = require('../get-shit-done/bin/lib/frontmatter.cjs');
    const fm = extractFrontmatter(content);
    assert.strictEqual(fm.status, 'active');
  });

  test('handles JSON array value', () => {
    const file = writeTempFile('---\nphase: 01\n---\nbody');
    const result = runGsdTools(`frontmatter set ${file} --field tags --value '["a","b"]'`);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const content = fs.readFileSync(file, 'utf-8');
    const { extractFrontmatter } = require('../get-shit-done/bin/lib/frontmatter.cjs');
    const fm = extractFrontmatter(content);
    assert.ok(Array.isArray(fm.tags), 'tags should be an array');
    assert.deepStrictEqual(fm.tags, ['a', 'b']);
  });

  test('returns error for missing file', () => {
    const result = runGsdTools('frontmatter set /nonexistent/file.md --field phase --value "01"');
    assert.ok(result.success, 'Command should exit 0 with error JSON');
    const parsed = JSON.parse(result.output);
    assert.ok(parsed.error, 'Should have error field');
  });

  test('preserves body content after set', () => {
    const bodyText = '\n\n# My Heading\n\nSome paragraph with special chars: $, %, &.';
    const file = writeTempFile('---\nphase: 01\n---' + bodyText);
    runGsdTools(`frontmatter set ${file} --field phase --value "02"`);

    const content = fs.readFileSync(file, 'utf-8');
    assert.ok(content.includes('# My Heading'), 'heading should be preserved');
    assert.ok(content.includes('Some paragraph with special chars: $, %, &.'), 'body content should be preserved');
  });
});
