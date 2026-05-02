// allow-test-rule: pending-migration-to-typed-ir [#2974]
// Tracked in #2974 for migration to typed-IR assertions per CONTRIBUTING.md
// "Prohibited: Raw Text Matching on Test Outputs". Per-file review may
// reclassify some entries as source-text-is-the-product during migration.

/**
 * Tests for code_review_command hook in ship workflow (#1876)
 *
 * Validates that the external code review command integration is properly
 * wired into config, templates, and the ship workflow.
 */

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createTempProject, cleanup, runGsdTools } = require('./helpers.cjs');

const CONFIG_CJS_PATH = path.join(__dirname, '..', 'get-shit-done', 'bin', 'lib', 'config.cjs');
const SHIP_MD_PATH = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'ship.md');
const CONFIG_TEMPLATE_PATH = path.join(__dirname, '..', 'get-shit-done', 'templates', 'config.json');

describe('code_review_command config key', () => {
  test('workflow.code_review_command is in VALID_CONFIG_KEYS', () => {
    const { VALID_CONFIG_KEYS } = require(CONFIG_CJS_PATH);
    assert.ok(
      VALID_CONFIG_KEYS.has('workflow.code_review_command'),
      'workflow.code_review_command must be in VALID_CONFIG_KEYS'
    );
  });

  test('config-set accepts workflow.code_review_command', () => {
    const tmpDir = createTempProject();
    try {
      // Create config.json first
      fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });
      fs.writeFileSync(
        path.join(tmpDir, '.planning', 'config.json'),
        JSON.stringify({ workflow: {} }, null, 2)
      );

      const result = runGsdTools(
        ['config-set', 'workflow.code_review_command', 'my-review-tool --review'],
        tmpDir,
        { HOME: tmpDir }
      );
      assert.ok(result.success, 'config-set should succeed');

      const parsed = JSON.parse(result.output);
      assert.strictEqual(parsed.updated, true);
      assert.strictEqual(parsed.key, 'workflow.code_review_command');
      assert.strictEqual(parsed.value, 'my-review-tool --review');
    } finally {
      cleanup(tmpDir);
    }
  });
});

describe('config template', () => {
  test('config.json template has code_review_command under workflow section', () => {
    const template = JSON.parse(fs.readFileSync(CONFIG_TEMPLATE_PATH, 'utf-8'));
    assert.ok(template.workflow, 'template must have workflow section');
    assert.ok(
      'code_review_command' in template.workflow,
      'workflow section must contain code_review_command key'
    );
    assert.strictEqual(
      template.workflow.code_review_command,
      null,
      'code_review_command default should be null'
    );
  });
});

describe('ship workflow code_review_command integration', () => {
  const shipContent = fs.readFileSync(SHIP_MD_PATH, 'utf-8');

  test('ship.md contains code_review_command config check', () => {
    assert.ok(
      shipContent.includes('code_review_command'),
      'ship.md must reference code_review_command'
    );
  });

  test('ship.md has external review sub-step that reads config', () => {
    assert.ok(
      shipContent.includes('config-get') && shipContent.includes('workflow.code_review_command'),
      'ship.md must read workflow.code_review_command from config'
    );
  });

  test('ship.md generates diff against base branch for review', () => {
    assert.ok(
      shipContent.includes('git diff') && shipContent.includes('BASE_BRANCH'),
      'ship.md must generate a diff using BASE_BRANCH for the external review'
    );
  });

  test('ship.md has JSON parsing for external review output', () => {
    assert.ok(
      shipContent.includes('verdict') && shipContent.includes('APPROVED'),
      'ship.md must parse JSON output with verdict field'
    );
    assert.ok(
      shipContent.includes('REVISE'),
      'ship.md must handle REVISE verdict'
    );
  });

  test('ship.md has timeout handling for external review command (120s)', () => {
    assert.ok(
      shipContent.includes('120') || shipContent.includes('timeout'),
      'ship.md must have timeout handling (120s) for external review command'
    );
  });

  test('ship.md has stderr capture on failure', () => {
    assert.ok(
      shipContent.includes('stderr'),
      'ship.md must capture stderr on external review command failure'
    );
  });

  test('ship.md pipes review prompt to command via stdin', () => {
    assert.ok(
      shipContent.includes('stdin'),
      'ship.md must pipe the review prompt to the command via stdin'
    );
  });

  test('ship.md includes diff stats in review prompt', () => {
    assert.ok(
      shipContent.includes('diff --stat') || shipContent.includes('diffstat') || shipContent.includes('--stat'),
      'ship.md must include diff stats in the review prompt'
    );
  });

  test('ship.md falls through to existing review flow on failure', () => {
    // The external review should not block the existing manual review options
    assert.ok(
      shipContent.includes('AskUserQuestion') || shipContent.includes('Skip review'),
      'ship.md must still offer the existing manual review flow after external review'
    );
  });
});
