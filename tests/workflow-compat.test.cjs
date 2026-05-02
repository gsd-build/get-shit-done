// allow-test-rule: pending-migration-to-typed-ir [#2974]
// Tracked in #2974 for migration to typed-IR assertions per CONTRIBUTING.md
// "Prohibited: Raw Text Matching on Test Outputs". Per-file review may
// reclassify some entries as source-text-is-the-product during migration.

/**
 * Regression guard for #1759: the --no-input flag was removed from Claude Code
 * >= v2.1.81 and causes an immediate crash ("error: unknown option '--no-input'").
 *
 * The -p / --print flag already handles non-interactive output so --no-input
 * must never appear in workflow, command, or agent files.
 */
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

/** Recursively collect all .md files under a directory. */
function collectMdFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectMdFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      results.push(full);
    }
  }
  return results;
}

const SCAN_DIRS = [
  path.join(ROOT, 'get-shit-done', 'workflows'),
  path.join(ROOT, 'get-shit-done', 'references'),
  path.join(ROOT, 'commands', 'gsd'),
  path.join(ROOT, 'agents'),
];

describe('workflow CLI compatibility (#1759)', () => {
  test('no workflow/command/agent file uses the deprecated --no-input flag', () => {
    const violations = [];

    for (const dir of SCAN_DIRS) {
      for (const file of collectMdFiles(dir)) {
        const content = fs.readFileSync(file, 'utf-8');
        if (content.includes('--no-input')) {
          const rel = path.relative(ROOT, file);
          violations.push(rel);
        }
      }
    }

    assert.strictEqual(
      violations.length,
      0,
      [
        '--no-input was removed in Claude Code >= v2.1.81 and must not appear in any workflow/command/agent file.',
        'Use -p / --print instead (already implies non-interactive output).',
        'Violations found:',
        ...violations.map(v => '  ' + v),
      ].join('\n')
    );
  });
});
