/**
 * Regression test for #1860: detectConfigDir in gsd-check-update.js should
 * prioritize .claude over .config/opencode so that Claude Code sessions
 * don't report false "update available" warnings when an older OpenCode
 * install exists alongside a newer Claude Code install.
 */

'use strict';

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const CHECK_UPDATE_PATH = path.join(__dirname, '..', 'hooks', 'gsd-check-update.js');

// ─── Static source-order assertion ──────────────────────────────────────────

describe('detectConfigDir search order (#1860)', () => {
  test('.claude appears before .config/opencode in the search array', () => {
    const content = fs.readFileSync(CHECK_UPDATE_PATH, 'utf8');

    // Extract the search order array from the for..of loop in detectConfigDir
    const arrayMatch = content.match(/for\s*\(const dir of\s*\[([^\]]+)\]/);
    assert.ok(arrayMatch, 'should find the for..of search array in detectConfigDir');

    const arrayLiteral = arrayMatch[1];
    const entries = arrayLiteral.match(/'([^']+)'/g).map(s => s.replace(/'/g, ''));

    const claudeIndex = entries.indexOf('.claude');
    const openCodeIndex = entries.indexOf('.config/opencode');

    assert.ok(claudeIndex !== -1, '.claude must be in the search array');
    assert.ok(openCodeIndex !== -1, '.config/opencode must be in the search array');
    assert.ok(
      claudeIndex < openCodeIndex,
      [
        '.claude must appear BEFORE .config/opencode in the search array.',
        `Got order: ${entries.join(', ')}`,
        `.claude is at index ${claudeIndex}, .config/opencode is at index ${openCodeIndex}.`,
      ].join(' ')
    );
  });
});

// ─── Integration: hook picks the .claude version when both dirs exist ────────

describe('detectConfigDir runtime behavior (#1860)', () => {
  let tmpHome;

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-test-home-'));
  });

  afterEach(() => {
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  test('returns .claude config dir when both .claude and .config/opencode exist', () => {
    // Simulate OpenCode install with OLDER version
    const openCodeVersionDir = path.join(tmpHome, '.config', 'opencode', 'get-shit-done');
    fs.mkdirSync(openCodeVersionDir, { recursive: true });
    fs.writeFileSync(path.join(openCodeVersionDir, 'VERSION'), '1.0.0\n');

    // Simulate Claude Code install with NEWER version
    const claudeVersionDir = path.join(tmpHome, '.claude', 'get-shit-done');
    fs.mkdirSync(claudeVersionDir, { recursive: true });
    fs.writeFileSync(path.join(claudeVersionDir, 'VERSION'), '1.32.0\n');

    // Run the hook script with our fake HOME. It will error when trying to spawn
    // the background child (npm view will fail in test env) but that's OK — we
    // only care about which VERSION file path it computes. We extract that by
    // injecting a quick wrapper that calls detectConfigDir and logs the result
    // before the rest of the script runs.
    //
    // Strategy: extract detectConfigDir source from the hook and evaluate it
    // in a small test harness that uses our fake HOME.

    const hookSource = fs.readFileSync(CHECK_UPDATE_PATH, 'utf8');

    // Extract detectConfigDir function body (from 'function detectConfigDir' to the closing brace)
    const fnMatch = hookSource.match(/(function detectConfigDir\(baseDir\)\s*\{[\s\S]*?\n\})/);
    assert.ok(fnMatch, 'should be able to extract detectConfigDir function from hook source');
    const fnSource = fnMatch[1];

    // Build a test harness script that calls detectConfigDir with our fake home
    const testScript = [
      "'use strict';",
      "const fs = require('fs');",
      "const path = require('path');",
      fnSource,
      `const result = detectConfigDir(${JSON.stringify(tmpHome)});`,
      "process.stdout.write(result);",
    ].join('\n');

    const result = execFileSync(process.execPath, ['-e', testScript], {
      encoding: 'utf8',
    });

    const expectedDir = path.join(tmpHome, '.claude');
    assert.strictEqual(
      result.trim(),
      expectedDir,
      [
        'detectConfigDir should return .claude when both .claude and .config/opencode have VERSION files.',
        `Expected: ${expectedDir}`,
        `Got: ${result.trim()}`,
      ].join('\n')
    );
  });

  test('falls back to .config/opencode when .claude does not exist', () => {
    // Only OpenCode installed
    const openCodeVersionDir = path.join(tmpHome, '.config', 'opencode', 'get-shit-done');
    fs.mkdirSync(openCodeVersionDir, { recursive: true });
    fs.writeFileSync(path.join(openCodeVersionDir, 'VERSION'), '1.0.0\n');

    const hookSource = fs.readFileSync(CHECK_UPDATE_PATH, 'utf8');
    const fnMatch = hookSource.match(/(function detectConfigDir\(baseDir\)\s*\{[\s\S]*?\n\})/);
    assert.ok(fnMatch, 'should be able to extract detectConfigDir function from hook source');
    const fnSource = fnMatch[1];

    const testScript = [
      "'use strict';",
      "const fs = require('fs');",
      "const path = require('path');",
      fnSource,
      `const result = detectConfigDir(${JSON.stringify(tmpHome)});`,
      "process.stdout.write(result);",
    ].join('\n');

    const result = execFileSync(process.execPath, ['-e', testScript], {
      encoding: 'utf8',
    });

    const expectedDir = path.join(tmpHome, '.config', 'opencode');
    assert.strictEqual(
      result.trim(),
      expectedDir,
      [
        'detectConfigDir should fall back to .config/opencode when .claude does not exist.',
        `Expected: ${expectedDir}`,
        `Got: ${result.trim()}`,
      ].join('\n')
    );
  });
});
