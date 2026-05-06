'use strict';

// allow-test-rule: inspects update worker source for shell:true — this is a
// Windows-specific bug (POSIX doesn't exhibit ENOENT without shell:true because
// npm is a real executable there). A pure behavioral RED/GREEN on macOS is not
// achievable. The structural fence here asserts the fix is present and guards
// against regression without requiring Windows CI.

/**
 * Regression fence for #3103 — `gsd-check-update-worker.js` called
 * `execFileSync('npm', [...])` without `shell: true`. On Windows, npm ships as
 * `npm.cmd`; `execFileSync` (unlike `execSync`) does NOT spawn a shell and does
 * NOT apply PATHEXT resolution, so Node throws ENOENT looking for a literal
 * file named `npm`. The error was silently swallowed, `latest` stayed `null`,
 * and the `⬆ /gsd-update` status-line indicator never rendered for Windows users.
 *
 * Fix: add `shell: true` to the `execFileSync` options object. On POSIX this
 * is a no-op (npm is a real executable). On Windows, cmd.exe resolves `npm.cmd`
 * via PATHEXT. The args (`['view', 'get-shit-done-cc', 'version']`) contain no
 * spaces or shell metacharacters, so `shell: true` does not change quoting
 * semantics on any platform.
 *
 * This test locates the `execFileSync('npm'` call in the worker source,
 * extracts the options object that follows, and asserts structurally that
 * `shell: true` is present alongside the pre-existing `windowsHide: true`.
 */

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WORKER_PATH = path.join(
  __dirname,
  '..',
  'hooks',
  'gsd-check-update-worker.js'
);

/**
 * Parse the options object literal that immediately follows the first
 * `execFileSync('npm'` call in the source text.
 *
 * Strategy: find the call, then walk forward char-by-char to collect the
 * brace-balanced options argument (up to 300 chars after the opening `{`).
 * Returns the raw options text so callers can do structural key presence
 * checks without regex on the full file.
 */
function extractNpmExecOptions(src) {
  const callMarker = "execFileSync('npm'";
  const callIdx = src.indexOf(callMarker);
  assert.notEqual(
    callIdx,
    -1,
    `gsd-check-update-worker.js must contain \`${callMarker}\``
  );

  // Scan forward from the call to find the opening brace of the options object.
  const searchWindow = src.slice(callIdx, callIdx + 300);
  const braceOffset = searchWindow.indexOf('{');
  assert.notEqual(
    braceOffset,
    -1,
    'options object opening brace `{` not found within 300 chars of execFileSync call'
  );

  // Collect chars until the matching closing brace (depth-first brace tracking).
  let depth = 0;
  let i = callIdx + braceOffset;
  let start = i;
  for (; i < callIdx + braceOffset + 300 && i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) break;
    }
  }
  assert.equal(depth, 0, 'options object brace is not closed within 300 chars');
  return src.slice(start, i + 1);
}

/**
 * Parse a key: value pair from the raw options text.
 *
 * Accepts both `key: true` and `key:true` (with or without whitespace).
 * Returns true if the key is present with value `true`.
 */
function hasOption(optionsText, key) {
  // Match `key: true` or `key:true` or `key :true` etc.
  const re = new RegExp(`\\b${key}\\s*:\\s*true\\b`);
  return re.test(optionsText);
}

describe('bug-3103: execFileSync npm call includes shell:true for Windows npm.cmd resolution', () => {
  let src;
  let optionsText;

  test('worker source file is readable', () => {
    assert.ok(
      fs.existsSync(WORKER_PATH),
      `gsd-check-update-worker.js must exist at ${WORKER_PATH}`
    );
    src = fs.readFileSync(WORKER_PATH, 'utf8');
    assert.ok(src.length > 0, 'worker source must not be empty');
  });

  test('execFileSync npm call has shell: true (Windows npm.cmd fix)', () => {
    if (!src) src = fs.readFileSync(WORKER_PATH, 'utf8');
    optionsText = extractNpmExecOptions(src);
    assert.ok(
      hasOption(optionsText, 'shell'),
      `execFileSync('npm', ...) options object must include \`shell: true\` ` +
        `to resolve npm.cmd via PATHEXT on Windows. ` +
        `Actual options text: ${optionsText}`
    );
  });

  test('execFileSync npm call retains windowsHide: true (regression guard)', () => {
    if (!src) src = fs.readFileSync(WORKER_PATH, 'utf8');
    if (!optionsText) optionsText = extractNpmExecOptions(src);
    assert.ok(
      hasOption(optionsText, 'windowsHide'),
      `execFileSync('npm', ...) options object must retain \`windowsHide: true\`. ` +
        `Actual options text: ${optionsText}`
    );
  });
});
