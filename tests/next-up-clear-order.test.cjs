'use strict';

/**
 * Next Up /clear Order Tests (#1623)
 *
 * Validates that /clear always appears BEFORE the command in Next Up blocks,
 * not as a <sub> footnote after the command. Users should see /clear first
 * so they run it before copy-pasting the actual command.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const glob = require('path');

const GSD_ROOT = path.join(__dirname, '..', 'get-shit-done');
const UI_BRAND = path.join(GSD_ROOT, 'references', 'ui-brand.md');
const CONTINUATION_FORMAT = path.join(GSD_ROOT, 'references', 'continuation-format.md');
const WORKFLOWS_DIR = path.join(GSD_ROOT, 'workflows');

/**
 * Recursively collect all .md files in a directory.
 */
function collectMarkdownFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectMarkdownFiles(full));
    } else if (entry.name.endsWith('.md')) {
      results.push(full);
    }
  }
  return results;
}

describe('ui-brand.md — Next Up template has /clear before command', () => {
  const content = fs.readFileSync(UI_BRAND, 'utf-8');

  test('Next Up block template does not use <sub>/clear pattern', () => {
    const subClearPattern = /<sub>[^<]*\/clear[^<]*<\/sub>/gi;
    const matches = content.match(subClearPattern);
    assert.strictEqual(
      matches,
      null,
      'ui-brand.md must not contain <sub>/clear</sub> pattern — /clear should appear before the command'
    );
  });

  test('Next Up block template shows /clear then: before {copy-paste command}', () => {
    // Extract the Next Up Block section
    const nextUpSection = content.slice(
      content.indexOf('## Next Up Block'),
      content.indexOf('## Error Box')
    );
    assert.ok(nextUpSection.length > 0, 'Should find Next Up Block section');

    const clearIndex = nextUpSection.indexOf('/clear');
    const commandIndex = nextUpSection.indexOf('{copy-paste command}');
    assert.ok(clearIndex > -1, 'Should contain /clear');
    assert.ok(commandIndex > -1, 'Should contain {copy-paste command}');
    assert.ok(
      clearIndex < commandIndex,
      `/clear (at ${clearIndex}) must appear before {copy-paste command} (at ${commandIndex})`
    );
  });
});

describe('continuation-format.md — Next Up examples have /clear before commands', () => {
  const content = fs.readFileSync(CONTINUATION_FORMAT, 'utf-8');

  test('no <sub>/clear patterns remain', () => {
    const subClearPattern = /<sub>[^<]*\/clear[^<]*<\/sub>/gi;
    const matches = content.match(subClearPattern);
    assert.strictEqual(
      matches,
      null,
      'continuation-format.md must not contain <sub>/clear</sub> pattern'
    );
  });
});

describe('workflow files — no <sub>/clear patterns in Next Up blocks', () => {
  const workflowFiles = collectMarkdownFiles(WORKFLOWS_DIR);

  test('found workflow .md files to scan', () => {
    assert.ok(
      workflowFiles.length > 0,
      `Expected workflow .md files in ${WORKFLOWS_DIR}`
    );
  });

  test('no workflow file contains <sub> with /clear', () => {
    const subClearPattern = /<sub>[^<]*\/clear[^<]*<\/sub>/gi;
    const failures = [];

    for (const filePath of workflowFiles) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const matches = content.match(subClearPattern);
      if (matches) {
        failures.push({
          file: path.relative(GSD_ROOT, filePath),
          matches: matches.length,
          examples: matches.slice(0, 3),
        });
      }
    }

    assert.strictEqual(
      failures.length,
      0,
      `Found <sub>/clear</sub> pattern in ${failures.length} workflow file(s):\n` +
        failures
          .map(
            (f) =>
              `  ${f.file}: ${f.matches} match(es) — e.g. ${f.examples[0]}`
          )
          .join('\n')
    );
  });
});

describe('reference files — no <sub>/clear patterns', () => {
  const referencesDir = path.join(GSD_ROOT, 'references');
  const refFiles = collectMarkdownFiles(referencesDir);

  test('found reference .md files to scan', () => {
    assert.ok(
      refFiles.length > 0,
      `Expected reference .md files in ${referencesDir}`
    );
  });

  test('no reference file contains <sub> with /clear', () => {
    const subClearPattern = /<sub>[^<]*\/clear[^<]*<\/sub>/gi;
    const failures = [];

    for (const filePath of refFiles) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const matches = content.match(subClearPattern);
      if (matches) {
        failures.push({
          file: path.relative(GSD_ROOT, filePath),
          matches: matches.length,
          examples: matches.slice(0, 3),
        });
      }
    }

    assert.strictEqual(
      failures.length,
      0,
      `Found <sub>/clear</sub> pattern in ${failures.length} reference file(s):\n` +
        failures
          .map(
            (f) =>
              `  ${f.file}: ${f.matches} match(es) — e.g. ${f.examples[0]}`
          )
          .join('\n')
    );
  });
});
