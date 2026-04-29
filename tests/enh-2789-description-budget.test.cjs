'use strict';

// allow-test-rule: source-text-is-the-product
// commands/gsd/*.md text IS what the runtime loads — testing description
// length tests the deployed system-prompt contract.

/**
 * Tests for #2789 — Trim skill description anti-patterns; enforce 100-char budget
 *
 * Verifies:
 * 1. All skill descriptions in commands/gsd/*.md are <= 100 chars
 * 2. No descriptions contain flag documentation anti-patterns (Use --)
 * 3. No descriptions contain "Triggers:" keyword stuffing
 * 4. lint-descriptions.cjs rejects descriptions over 100 chars
 * 5. lint-descriptions.cjs accepts descriptions under 100 chars
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const os = require('node:os');

const COMMANDS_DIR = path.join(__dirname, '../commands/gsd');
const LINT_SCRIPT = path.join(__dirname, '../scripts/lint-descriptions.cjs');

const MAX_DESCRIPTION_LENGTH = 100;

/**
 * Parse the description field from a frontmatter block in a .md file.
 * Returns null if no description is found.
 */
function parseDescription(content) {
  // Extract frontmatter block between --- markers
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fmMatch) return null;
  const fm = fmMatch[1];

  // Handle multi-line or quoted values: description: "..." or description: plain text
  // Match: description: "value" or description: value (to end of line)
  const quoted = fm.match(/^description:\s+"((?:[^"\\]|\\.)*)"\s*$/m);
  if (quoted) return quoted[1];

  const plain = fm.match(/^description:\s+(.+)$/m);
  if (plain) return plain[1].trim();

  return null;
}

/**
 * Get all .md files in commands/gsd/ with their descriptions.
 */
function getAllCommandDescriptions() {
  const files = fs.readdirSync(COMMANDS_DIR).filter(f => f.endsWith('.md'));
  return files.map(file => {
    const filePath = path.join(COMMANDS_DIR, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const description = parseDescription(content);
    return { file, filePath, description };
  });
}

// ── Test 1: All descriptions <= 100 chars ────────────────────────────────────

describe('description length budget', () => {
  test('all commands/gsd/*.md descriptions are <= 100 chars', () => {
    const commands = getAllCommandDescriptions();
    const violators = commands
      .filter(c => c.description !== null && c.description.length > MAX_DESCRIPTION_LENGTH)
      .map(c => [
        'length=' + c.description.length,
        'file=' + c.file,
        'desc=' + c.description,
      ].join(' | '));

    assert.strictEqual(
      violators.length,
      0,
      [
        `${violators.length} description(s) exceed ${MAX_DESCRIPTION_LENGTH} chars:`,
        ...violators.map(v => '  ' + v),
      ].join('\n')
    );
  });
});

// ── Test 2: No flag documentation anti-patterns ──────────────────────────────

describe('description anti-patterns', () => {
  test('no descriptions contain flag documentation (Use --, use --, via --)', () => {
    const commands = getAllCommandDescriptions();
    const FLAG_PATTERNS = ['Use --', 'use --', 'via --'];
    const violators = commands
      .filter(c => {
        if (!c.description) return false;
        return FLAG_PATTERNS.some(p => c.description.includes(p));
      })
      .map(c => 'file=' + c.file + ' | desc=' + c.description);

    assert.strictEqual(
      violators.length,
      0,
      [
        `${violators.length} description(s) contain flag documentation anti-patterns:`,
        ...violators.map(v => '  ' + v),
      ].join('\n')
    );
  });

  // ── Test 3: No Triggers: keyword stuffing ─────────────────────────────────

  test('no descriptions contain "Triggers:" keyword stuffing', () => {
    const commands = getAllCommandDescriptions();
    const violators = commands
      .filter(c => c.description && /triggers:/i.test(c.description))
      .map(c => 'file=' + c.file + ' | desc=' + c.description);

    assert.strictEqual(
      violators.length,
      0,
      [
        `${violators.length} description(s) contain "Triggers:" keyword stuffing:`,
        ...violators.map(v => '  ' + v),
      ].join('\n')
    );
  });
});

// ── Test 4 & 5: lint-descriptions.cjs script ─────────────────────────────────

describe('lint-descriptions.cjs', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-lint-desc-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('rejects a command file with a description over 100 chars', () => {
    const longDesc = 'A'.repeat(101);
    const content = [
      '---',
      'name: gsd:test-long',
      'description: ' + longDesc,
      '---',
      '',
      'Body text.',
    ].join('\n');

    const tmpFile = path.join(tmpDir, 'long-desc.md');
    fs.writeFileSync(tmpFile, content, 'utf-8');

    const result = spawnSync(process.execPath, [LINT_SCRIPT, tmpFile], {
      encoding: 'utf-8',
    });

    assert.notStrictEqual(result.status, 0, [
      'lint-descriptions.cjs should exit non-zero for description > 100 chars',
      'stdout: ' + result.stdout,
      'stderr: ' + result.stderr,
    ].join('\n'));
  });

  test('accepts a command file with a description under 100 chars', () => {
    const shortDesc = 'Short routing description for this skill.';
    const content = [
      '---',
      'name: gsd:test-short',
      'description: ' + shortDesc,
      '---',
      '',
      'Body text.',
    ].join('\n');

    const tmpFile = path.join(tmpDir, 'short-desc.md');
    fs.writeFileSync(tmpFile, content, 'utf-8');

    const result = spawnSync(process.execPath, [LINT_SCRIPT, tmpFile], {
      encoding: 'utf-8',
    });

    assert.strictEqual(result.status, 0, [
      'lint-descriptions.cjs should exit 0 for description <= 100 chars',
      'stdout: ' + result.stdout,
      'stderr: ' + result.stderr,
    ].join('\n'));
  });
});
