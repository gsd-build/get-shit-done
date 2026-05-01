'use strict';

process.env.GSD_TEST_MODE = '1';

/**
 * Regression guard for #2962-class bugs.
 *
 * "Nothing for Windows should be deferred — if it wasn't in, it was missed
 * not deferred." (maintainer guidance, 2026-05-01.)
 *
 * Specifically forbids the pattern:
 *
 *   if (process.platform === 'win32') return null;
 *   if (process.platform === 'win32') return;
 *   if (process.platform === 'win32') { return null; }
 *
 * inside any function in `bin/install.js`. These early returns silently
 * disable functionality on Windows without any equivalent path being
 * called — exactly the gap that #2775 left behind for #2962 to find.
 *
 * Legitimate Windows-conditional code paths look like:
 *   - return early to dispatch to a Windows-specific helper
 *     (e.g. `return trySelfLinkGsdSdkWindows(...)`)
 *   - branch on platform inside a return value
 *     (e.g. `process.platform === 'win32' ? a : b`)
 *   - inverted check that makes Windows the primary path
 *     (e.g. `if (process.platform !== 'win32') ...`)
 *
 * Those are unaffected by this test.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const FILES_TO_GUARD = [
  path.join(ROOT, 'bin', 'install.js'),
];

describe('no unconditional win32 skip in installer', () => {
  for (const file of FILES_TO_GUARD) {
    test(`${path.relative(ROOT, file)} has no \`if (process.platform === 'win32') return null|undefined;\` skip-only branches`, () => {
      const src = fs.readFileSync(file, 'utf8');
      const lines = src.split(/\r?\n/);
      const offences = [];
      // Match: `if (process.platform === 'win32') return [null|;];`
      // Allow: trailing comment, optional braces, single-statement body.
      // The guard pattern: a return statement on the same line OR the next
      // line, where the return value is `null` or empty (bare `return;`).
      const inlineRe = /^\s*if\s*\(\s*process\.platform\s*===\s*['"]win32['"]\s*\)\s*\{?\s*return\s*(null)?\s*;/;
      // Two-line pattern: `if (process.platform === 'win32') {` followed by
      // a `return null;` or `return;` on the next non-blank line.
      const headerRe = /^\s*if\s*\(\s*process\.platform\s*===\s*['"]win32['"]\s*\)\s*\{\s*$/;
      const returnOnlyRe = /^\s*return\s*(null)?\s*;\s*$/;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (inlineRe.test(line)) {
          offences.push(`line ${i + 1}: ${line.trim()}`);
          continue;
        }
        if (headerRe.test(line)) {
          // Look ahead for the next non-blank, non-comment line.
          for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
            const next = lines[j];
            if (/^\s*$/.test(next) || /^\s*\/\//.test(next)) continue;
            if (returnOnlyRe.test(next)) {
              offences.push(`lines ${i + 1}-${j + 1}: ${line.trim()} ${next.trim()}`);
            }
            break;
          }
        }
      }
      assert.deepEqual(
        offences,
        [],
        `Found unconditional Windows-skip(s) in ${path.relative(ROOT, file)}:\n  ${offences.join('\n  ')}\n\n` +
          `If you intended to write a no-op early return for Windows, replace it with a dispatch ` +
          `to a Windows-specific helper. Per maintainer guidance, Windows parity is never deferred.`,
      );
    });
  }
});
