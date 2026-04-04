/**
 * Hardcoded Path Detection Tests
 *
 * Statically scans source files to catch hardcoded platform-specific paths
 * submitted in contributions. Catches issues that previously required a real
 * Windows runner to detect.
 *
 * Checks for:
 *  1. Windows drive-letter paths (C:\, D:\, etc.) inside string literals
 *  2. Hardcoded Linux home dirs (/home/<user>/) in string literals
 *  3. Hardcoded macOS home dirs (/Users/<user>/) in string literals
 *  4. Hardcoded /tmp/ that should use os.tmpdir() instead
 *
 * Test files are excluded — they may intentionally contain these strings as
 * fixtures (e.g., path-replacement.test.cjs simulates Windows paths).
 */

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..');

/**
 * Collect all .js and .cjs files under a directory, recursively.
 * Skips node_modules and the tests/ directory.
 */
function collectSourceFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectSourceFiles(fullPath));
    } else if (entry.name.endsWith('.js') || entry.name.endsWith('.cjs')) {
      results.push(fullPath);
    }
  }
  return results;
}

// Scan source dirs only — exclude tests/ which may contain intentional fixtures
const sourceDirs = ['bin', 'scripts', 'hooks', path.join('get-shit-done', 'bin')].map(
  d => path.join(repoRoot, d)
);
const sourceFiles = sourceDirs.flatMap(collectSourceFiles);

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Scan files for a pattern, skipping comment lines.
 * Returns an array of human-readable failure strings.
 */
function scanFiles(files, pattern, description) {
  const failures = [];
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trimStart();
      // Skip pure comment lines
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('#')) continue;
      if (pattern.test(line)) {
        failures.push(`${path.relative(repoRoot, file)}:${i + 1}: ${trimmed.slice(0, 120)}`);
      }
    }
  }
  return failures;
}

// ─── 1. Windows Drive-Letter Paths ──────────────────────────────────────────
// Matches a string literal containing a Windows drive path: 'C:\...' or "D:\..."
// Requires: quote + single capital letter + colon + backslash (escaped as \\ in JS source)
// This avoids false positives from regex patterns, URLs (https://), etc.

describe('no hardcoded Windows drive-letter paths', () => {
  test('source files exist to scan', () => {
    assert.ok(sourceFiles.length > 0, 'Expected source files to scan — check sourceDirs config');
  });

  test('no C:\\ / D:\\ style drive paths in string literals', () => {
    // In JS source, a literal backslash is written as \\ inside a string.
    // So 'C:\Users' appears as 'C:\\Users' in the raw source text.
    // Pattern: quote char + capital letter + :\ (as :\\ in source) + word char
    const drivePath = /['"`][A-Z]:\\{1,2}[A-Za-z_]/;
    const failures = scanFiles(sourceFiles, drivePath);
    assert.deepStrictEqual(
      failures, [],
      `Hardcoded Windows drive-letter paths found in string literals.\n` +
      `Use path.join() or os.homedir() instead:\n  ${failures.join('\n  ')}`
    );
  });
});

// ─── 2. Hardcoded /home/<user>/ Paths ───────────────────────────────────────
// Catches '/home/ubuntu/', '/home/runner/', etc. in string literals.
// /home/ is a Linux-specific path — use os.homedir() for cross-platform code.

describe('no hardcoded /home/ absolute paths', () => {
  test('no /home/<username>/ paths in string literals', () => {
    // Requires: quote + /home/ + non-slash chars (the username) + /
    // This avoids matching things like regex patterns /^home/
    const homePath = /['"`]\/home\/[^/\s'"` \n]+\//;
    const failures = scanFiles(sourceFiles, homePath);
    assert.deepStrictEqual(
      failures, [],
      `Hardcoded /home/ paths found in string literals.\n` +
      `Use os.homedir() or path.join() instead:\n  ${failures.join('\n  ')}`
    );
  });
});

// ─── 3. Hardcoded /Users/<user>/ Paths ──────────────────────────────────────
// Catches '/Users/john/', '/Users/runner/', etc. in string literals.
// /Users/ is macOS-specific — use os.homedir() for cross-platform code.

describe('no hardcoded /Users/ absolute paths', () => {
  test('no /Users/<username>/ paths in string literals', () => {
    // Requires: quote + /Users/ + username chars + /
    const usersPath = /['"`]\/Users\/[^/\s'"` \n]+\//;
    const failures = scanFiles(sourceFiles, usersPath);
    assert.deepStrictEqual(
      failures, [],
      `Hardcoded /Users/ paths found in string literals.\n` +
      `Use os.homedir() or path.join() instead:\n  ${failures.join('\n  ')}`
    );
  });
});

// ─── 4. Hardcoded /tmp/ Paths ────────────────────────────────────────────────
// /tmp/ is Linux-specific. On Windows the temp dir is %TEMP% or %LOCALAPPDATA%\Temp.
// os.tmpdir() is the cross-platform API for the system temp directory.

describe('no hardcoded /tmp/ paths', () => {
  test('source files use os.tmpdir() not hardcoded /tmp/', () => {
    // Requires: quote + /tmp/ — distinct from regex like /tmp\// which has no leading quote
    const tmpPath = /['"`]\/tmp\//;
    const failures = scanFiles(sourceFiles, tmpPath);
    assert.deepStrictEqual(
      failures, [],
      `Hardcoded /tmp/ paths found in string literals.\n` +
      `Use os.tmpdir() instead for cross-platform compatibility:\n  ${failures.join('\n  ')}`
    );
  });
});
