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
    const result = runGsdTools(['frontmatter', 'set', file, '--field', 'tags', '--value', '["a","b"]']);
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

// ─── frontmatter merge ──────────────────────────────────────────────────────

describe('frontmatter merge', () => {
  test('merges multiple fields into frontmatter', () => {
    const file = writeTempFile('---\nphase: 01\n---\nbody');
    const result = runGsdTools(['frontmatter', 'merge', file, '--data', '{"plan":"02","type":"tdd"}']);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const content = fs.readFileSync(file, 'utf-8');
    const { extractFrontmatter } = require('../get-shit-done/bin/lib/frontmatter.cjs');
    const fm = extractFrontmatter(content);
    assert.strictEqual(fm.phase, '01', 'original field should be preserved');
    assert.strictEqual(fm.plan, '02', 'merged field should be present');
    assert.strictEqual(fm.type, 'tdd', 'merged field should be present');
  });

  test('overwrites existing fields on conflict', () => {
    const file = writeTempFile('---\nphase: 01\ntype: execute\n---\nbody');
    const result = runGsdTools(['frontmatter', 'merge', file, '--data', '{"phase":"02"}']);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const content = fs.readFileSync(file, 'utf-8');
    const { extractFrontmatter } = require('../get-shit-done/bin/lib/frontmatter.cjs');
    const fm = extractFrontmatter(content);
    assert.strictEqual(fm.phase, '02', 'conflicting field should be overwritten');
    assert.strictEqual(fm.type, 'execute', 'non-conflicting field should be preserved');
  });

  test('returns error for missing file', () => {
    const result = runGsdTools(`frontmatter merge /nonexistent/file.md --data '{"phase":"01"}'`);
    assert.ok(result.success, 'Command should exit 0 with error JSON');
    const parsed = JSON.parse(result.output);
    assert.ok(parsed.error, 'Should have error field');
  });

  test('returns error for invalid JSON data', () => {
    const file = writeTempFile('---\nphase: 01\n---\nbody');
    const result = runGsdTools(`frontmatter merge ${file} --data 'not json'`);
    // cmdFrontmatterMerge calls error() which exits with code 1
    assert.ok(!result.success, 'Command should fail with non-zero exit code');
    assert.ok(result.error.includes('Invalid JSON'), 'Error should mention invalid JSON');
  });
});

// ─── frontmatter validate ───────────────────────────────────────────────────

describe('frontmatter validate', () => {
  test('reports valid for complete plan frontmatter', () => {
    const content = `---
phase: 01
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: [src/auth.ts]
autonomous: true
must_haves:
  truths:
    - "All tests pass"
---
body`;
    const file = writeTempFile(content);
    const result = runGsdTools(`frontmatter validate ${file} --schema plan`);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.valid, true, 'Should be valid');
    assert.deepStrictEqual(parsed.missing, [], 'No fields should be missing');
    assert.strictEqual(parsed.schema, 'plan');
  });

  test('reports invalid with missing fields', () => {
    const file = writeTempFile('---\nphase: 01\n---\nbody');
    const result = runGsdTools(`frontmatter validate ${file} --schema plan`);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.valid, false, 'Should be invalid');
    assert.ok(parsed.missing.length > 0, 'Should have missing fields');
    // plan schema requires: phase, plan, type, wave, depends_on, files_modified, autonomous, must_haves
    // phase is present, so 7 should be missing
    assert.strictEqual(parsed.missing.length, 7, 'Should have 7 missing required fields');
    assert.ok(parsed.missing.includes('plan'), 'plan should be in missing');
    assert.ok(parsed.missing.includes('type'), 'type should be in missing');
    assert.ok(parsed.missing.includes('must_haves'), 'must_haves should be in missing');
  });

  test('validates against summary schema', () => {
    const content = `---
phase: 01
plan: 01
subsystem: testing
tags: [unit-tests, yaml]
duration: 5min
completed: 2026-02-25
---
body`;
    const file = writeTempFile(content);
    const result = runGsdTools(`frontmatter validate ${file} --schema summary`);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.valid, true, 'Should be valid for summary schema');
    assert.strictEqual(parsed.schema, 'summary');
  });

  test('validates against verification schema', () => {
    const content = `---
phase: 01
verified: 2026-02-25
status: passed
score: 5/5
---
body`;
    const file = writeTempFile(content);
    const result = runGsdTools(`frontmatter validate ${file} --schema verification`);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.valid, true, 'Should be valid for verification schema');
    assert.strictEqual(parsed.schema, 'verification');
  });

  test('returns error for unknown schema', () => {
    const file = writeTempFile('---\nphase: 01\n---\n');
    const result = runGsdTools(`frontmatter validate ${file} --schema unknown`);
    // cmdFrontmatterValidate calls error() which exits with code 1
    assert.ok(!result.success, 'Command should fail with non-zero exit code');
    assert.ok(result.error.includes('Unknown schema'), 'Error should mention unknown schema');
  });

  test('returns error for missing file', () => {
    const result = runGsdTools('frontmatter validate /nonexistent/file.md --schema plan');
    assert.ok(result.success, 'Command should exit 0 with error JSON');
    const parsed = JSON.parse(result.output);
    assert.ok(parsed.error, 'Should have error field');
  });
});
