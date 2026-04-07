/**
 * Stale /gsd: colon reference detection test
 *
 * Guards against regression of bug #1748: after the command naming migration
 * from colon to hyphen format, no stale colon references should remain in
 * source, workflows, commands, docs, issue templates, or hooks.
 *
 * Test input strings that deliberately test colon-to-hyphen conversion are
 * allowed (they are the INPUT to a converter function). Everything else is stale.
 *
 * Uses node:test and node:assert/strict (NOT Jest).
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

/**
 * Recursively collect files matching the given extensions, excluding
 * CHANGELOG.md, node_modules/, .git/, and dist/.
 */
function collectFiles(dir, extensions, results = []) {
  const EXCLUDED_DIRS = new Set(['node_modules', '.git', 'dist', '.claude', '.worktrees']);
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    if (EXCLUDED_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectFiles(full, extensions, results);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (extensions.has(ext) && entry.name !== 'CHANGELOG.md') {
        results.push(full);
      }
    }
  }
  return results;
}

/**
 * Determine whether a /gsd: match in a test file is a legitimate test input
 * (i.e., the input string fed to a colon-to-hyphen converter).
 */
function isTestInput(filePath, line) {
  const rel = path.relative(ROOT, filePath).replace(/\\/g, '/');

  // SDK test files (.ts) that test sanitizer stripping of /gsd: patterns
  if (rel === 'sdk/src/prompt-sanitizer.test.ts') return true;
  if (rel === 'sdk/src/init-runner.test.ts') return true;
  if (rel === 'sdk/src/phase-prompt.test.ts') return true;

  // Conversion test files: input strings to convert* functions contain /gsd:
  const conversionTestFiles = [
    'tests/windsurf-conversion.test.cjs',
    'tests/augment-conversion.test.cjs',
    'tests/cursor-conversion.test.cjs',
    'tests/antigravity-install.test.cjs',
    'tests/copilot-install.test.cjs',
    'tests/codex-config.test.cjs',
    'tests/trae-install.test.cjs',
    'tests/codebuddy-install.test.cjs',
  ];

  if (conversionTestFiles.includes(rel)) {
    const trimmed = line.trim();
    // JSDoc block-comment lines with /gsd: in description are stale
    if (/^\*/.test(trimmed)) return false;
    // Everything else in conversion test files is a test input
    return true;
  }

  return false;
}

describe('No stale /gsd: colon references (#1748)', () => {
  test('all /gsd: references should be hyphenated except test inputs', () => {
    const extensions = new Set(['.md', '.js', '.cjs', '.ts', '.yml', '.sh', '.svg']);
    const files = collectFiles(ROOT, extensions);

    const staleRefs = [];
    const pattern = /\/gsd:[a-z]/g;

    for (const filePath of files) {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!pattern.test(line)) continue;
        pattern.lastIndex = 0;

        if (!isTestInput(filePath, line)) {
          const rel = path.relative(ROOT, filePath).replace(/\\/g, '/');
          staleRefs.push(`  ${rel}:${i + 1}: ${line.trim()}`);
        }
      }
    }

    if (staleRefs.length > 0) {
      assert.fail(
        `Found ${staleRefs.length} stale /gsd: colon reference(s) that should use /gsd- hyphen format:\n${staleRefs.join('\n')}`
      );
    }
  });
});
