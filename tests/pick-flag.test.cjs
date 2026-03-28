/**
 * GSD Tools Tests - --pick flag
 *
 * Regression tests for the --pick CLI flag that extracts a single field
 * from JSON output, replacing the need for jq as an external dependency.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const { runGsdTools } = require('./helpers.cjs');

// ─── --pick flag ─────────────────────────────────────────────────────────────

describe('--pick flag', () => {
  test('extracts a top-level field from JSON output', () => {
    const result = runGsdTools('generate-slug "hello world" --pick slug');
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.output, 'hello-world');
  });

  test('extracts a top-level field using array args', () => {
    const result = runGsdTools(['generate-slug', 'hello world', '--pick', 'slug']);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.output, 'hello-world');
  });

  test('returns empty string for missing field', () => {
    const result = runGsdTools('generate-slug "test" --pick nonexistent');
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.output, '');
  });

  test('errors when --pick has no value', () => {
    const result = runGsdTools('generate-slug "test" --pick');
    assert.strictEqual(result.success, false);
    assert.match(result.error, /Missing value for --pick/);
  });

  test('errors when --pick value starts with --', () => {
    const result = runGsdTools(['generate-slug', 'test', '--pick', '--raw']);
    assert.strictEqual(result.success, false);
    assert.match(result.error, /Missing value for --pick/);
  });

  test('does not collide with frontmatter --field flag', () => {
    // frontmatter subcommand uses --field internally; --pick should not interfere
    const result = runGsdTools('generate-slug "test-value" --pick slug');
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.output, 'test-value');
  });

  test('works with current-timestamp command', () => {
    const result = runGsdTools('current-timestamp --pick timestamp');
    assert.strictEqual(result.success, true);
    assert.ok(result.output.length > 0, 'timestamp should not be empty');
    assert.match(result.output, /^\d{4}-\d{2}-\d{2}T/);
  });
});
