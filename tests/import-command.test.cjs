// allow-test-rule: pending-migration-to-typed-ir [#2974]
// Tracked in #2974 for migration to typed-IR assertions per CONTRIBUTING.md
// "Prohibited: Raw Text Matching on Test Outputs". Per-file review may
// reclassify some entries as source-text-is-the-product during migration.

/**
 * Import Command Tests — import-command.test.cjs
 *
 * Structural assertions for the /gsd-import command and workflow files.
 */

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const CMD_PATH = path.join(__dirname, '..', 'commands', 'gsd', 'import.md');
const WF_PATH = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'import.md');

// ─── File Existence ────────────────────────────────────────────────────────────

describe('import command file structure', () => {
  test('command file exists', () => {
    assert.ok(fs.existsSync(CMD_PATH), 'commands/gsd/import.md should exist');
  });

  test('workflow file exists', () => {
    assert.ok(fs.existsSync(WF_PATH), 'get-shit-done/workflows/import.md should exist');
  });
});

// ─── Command Frontmatter ───────────────────────────────────────────────────────

describe('import command frontmatter', () => {
  const content = fs.readFileSync(CMD_PATH, 'utf-8');

  test('has name field', () => {
    assert.match(content, /^name:\s*gsd:import$/m);
  });

  test('has description field', () => {
    assert.match(content, /^description:\s*.+$/m);
  });

  test('has argument-hint with --from', () => {
    assert.match(content, /^argument-hint:.*--from/m);
  });
});

// ─── Command References Workflow ───────────────────────────────────────────────

describe('import command references', () => {
  const content = fs.readFileSync(CMD_PATH, 'utf-8');

  test('references the import workflow', () => {
    assert.ok(
      content.includes('@~/.claude/get-shit-done/workflows/import.md'),
      'command should reference the workflow via @~/.claude/get-shit-done/workflows/import.md'
    );
  });
});

// ─── Workflow Content ──────────────────────────────────────────────────────────

describe('import workflow content', () => {
  const content = fs.readFileSync(WF_PATH, 'utf-8');

  test('contains --from mode handling', () => {
    assert.ok(
      content.includes('--from'),
      'workflow should contain --from mode handling'
    );
  });

  test('does NOT contain --prd implementation', () => {
    // --prd should be mentioned as deferred/future only, not implemented
    assert.ok(
      content.includes('--prd'),
      'workflow should mention --prd exists'
    );
    assert.ok(
      content.includes('not yet implemented') || content.includes('follow-up PR') || content.includes('future release'),
      'workflow should defer --prd to a future release'
    );
    // Should not have a full "Path B: MODE=prd" implementation section
    assert.ok(
      !content.includes('## Path B: MODE=prd'),
      'workflow should NOT have a Path B implementation for --prd'
    );
  });

  test('references path validation for --from argument', () => {
    // After fix: inline path check instead of security.cjs CLI invocation
    assert.ok(
      content.includes('traversal') || content.includes('validatePath') || content.includes('..'),
      'workflow should validate the file path'
    );
  });

  test('includes REQUIREMENTS.md in conflict detection context loading', () => {
    assert.ok(
      content.includes('REQUIREMENTS.md'),
      'workflow should load REQUIREMENTS.md for conflict detection'
    );
  });

  test('includes BLOCKER/WARNING/INFO conflict severity model', () => {
    assert.ok(content.includes('[BLOCKER]'), 'workflow should include BLOCKER severity');
    assert.ok(content.includes('[WARNING]'), 'workflow should include WARNING severity');
    assert.ok(content.includes('[INFO]'), 'workflow should include INFO severity');
  });

  test('includes plan-checker validation gate', () => {
    assert.ok(
      content.includes('gsd-plan-checker'),
      'workflow should delegate validation to gsd-plan-checker'
    );
  });

  test('no-args usage display is present', () => {
    assert.ok(
      content.includes('Usage: /gsd:import') || content.includes('Usage: /gsd-import'),
      'workflow should display usage when no arguments provided'
    );
  });
});
