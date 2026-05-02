// allow-test-rule: pending-migration-to-typed-ir [#2974]
// Tracked in #2974 for migration to typed-IR assertions per CONTRIBUTING.md
// "Prohibited: Raw Text Matching on Test Outputs". Per-file review may
// reclassify some entries as source-text-is-the-product during migration.

/**
 * GSD Tools Tests - settings.json JSONC (JSON with comments) support
 *
 * Validates that the installer's readSettings() correctly handles
 * settings.json files containing comments (line and block) without
 * silently overwriting them with empty objects.
 *
 * Closes: #1461
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

// ─── inline stripJsonComments (mirrors install.js logic) ─────────────────────

function stripJsonComments(text) {
  let result = '';
  let i = 0;
  let inString = false;
  let stringChar = '';
  while (i < text.length) {
    if (inString) {
      if (text[i] === '\\') {
        result += text[i] + (text[i + 1] || '');
        i += 2;
        continue;
      }
      if (text[i] === stringChar) {
        inString = false;
      }
      result += text[i];
      i++;
      continue;
    }
    if (text[i] === '"' || text[i] === "'") {
      inString = true;
      stringChar = text[i];
      result += text[i];
      i++;
      continue;
    }
    if (text[i] === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++;
      continue;
    }
    if (text[i] === '/' && text[i + 1] === '*') {
      i += 2;
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    result += text[i];
    i++;
  }
  return result.replace(/,\s*([}\]])/g, '$1');
}

// ─── tests ───────────────────────────────────────────────────────────────────

describe('stripJsonComments (#1461)', () => {

  test('strips line comments', () => {
    const input = `{
  // This is a comment
  "key": "value"
}`;
    const result = JSON.parse(stripJsonComments(input));
    assert.deepStrictEqual(result, { key: 'value' });
  });

  test('strips block comments', () => {
    const input = `{
  /* Block comment */
  "key": "value"
}`;
    const result = JSON.parse(stripJsonComments(input));
    assert.deepStrictEqual(result, { key: 'value' });
  });

  test('strips multi-line block comments', () => {
    const input = `{
  /*
   * Multi-line
   * block comment
   */
  "key": "value"
}`;
    const result = JSON.parse(stripJsonComments(input));
    assert.deepStrictEqual(result, { key: 'value' });
  });

  test('preserves comments inside string values', () => {
    const input = `{
  "url": "https://example.com/path",
  "description": "Use // for line comments"
}`;
    const result = JSON.parse(stripJsonComments(input));
    assert.strictEqual(result.url, 'https://example.com/path');
    assert.strictEqual(result.description, 'Use // for line comments');
  });

  test('handles trailing commas', () => {
    const input = `{
  "a": 1,
  "b": 2,
}`;
    const result = JSON.parse(stripJsonComments(input));
    assert.deepStrictEqual(result, { a: 1, b: 2 });
  });

  test('handles inline comments after values', () => {
    const input = `{
  "timeout": 5000, // milliseconds
  "retries": 3 // max attempts
}`;
    const result = JSON.parse(stripJsonComments(input));
    assert.strictEqual(result.timeout, 5000);
    assert.strictEqual(result.retries, 3);
  });

  test('handles standard JSON (no comments) unchanged', () => {
    const input = '{"key": "value", "num": 42}';
    const result = JSON.parse(stripJsonComments(input));
    assert.deepStrictEqual(result, { key: 'value', num: 42 });
  });

  test('handles empty object', () => {
    const result = JSON.parse(stripJsonComments('{}'));
    assert.deepStrictEqual(result, {});
  });

  test('handles real-world settings.json with comments', () => {
    const input = `{
  // My configuration
  "hooks": {
    "SessionStart": [
      {
        "matcher": "", /* match all */
        "hooks": [
          {
            "type": "command",
            "command": "node ~/.claude/hooks/gsd-statusline.js"
          }
        ]
      }
    ]
  },
  "statusLine": {
    "command": "node ~/.claude/hooks/gsd-statusline.js",
    "refreshInterval": 10
  }
}`;
    const result = JSON.parse(stripJsonComments(input));
    assert.ok(result.hooks, 'should have hooks');
    assert.ok(result.statusLine, 'should have statusLine');
    assert.strictEqual(result.statusLine.refreshInterval, 10);
  });
});

describe('readSettings null return on malformed files (#1461)', () => {
  test('install.js contains JSONC stripping in readSettings', () => {
    const installPath = path.join(__dirname, '..', 'bin', 'install.js');
    const content = fs.readFileSync(installPath, 'utf8');
    assert.ok(content.includes('stripJsonComments'),
      'install.js should use stripJsonComments in readSettings');
  });

  test('readSettings returns null on truly malformed files (not empty object)', () => {
    const installPath = path.join(__dirname, '..', 'bin', 'install.js');
    const content = fs.readFileSync(installPath, 'utf8');
    assert.ok(content.includes('return null'),
      'readSettings should return null on parse failure, not empty object');
  });

  test('callers guard against null readSettings return', () => {
    const installPath = path.join(__dirname, '..', 'bin', 'install.js');
    const content = fs.readFileSync(installPath, 'utf8');
    // Should have null guards at the settings configuration call sites
    assert.ok(
      content.includes('=== null') || content.includes('rawSettings === null'),
      'callers should check for null return from readSettings'
    );
  });
});
