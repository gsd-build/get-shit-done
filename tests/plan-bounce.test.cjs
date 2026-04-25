/**
 * Plan Bounce Tests
 *
 * Validates plan bounce hook feature (step 12.5 in plan-phase):
 * - Config key registration (workflow.plan_bounce, workflow.plan_bounce_script, workflow.plan_bounce_passes)
 * - Config template defaults
 * - Workflow step 12.5 content in plan-phase.md
 * - Flag handling (--bounce, --skip-bounce)
 * - Backup/restore pattern (pre-bounce.md)
 * - Frontmatter integrity validation
 * - Re-runs checker on bounced plans
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

const GSD_ROOT = path.join(__dirname, '..', 'get-shit-done');
const CONFIG_TEMPLATE_PATH = path.join(GSD_ROOT, 'templates', 'config.json');
const PLAN_PHASE_PATH = path.join(GSD_ROOT, 'workflows', 'plan-phase.md');

describe('Plan Bounce: config keys', () => {
  test('config-set accepts workflow.plan_bounce', () => {
    const tmpDir = createTempProject();
    try {
      const result = runGsdTools('config-set workflow.plan_bounce true', tmpDir);
      assert.ok(result.success, `config-set should accept workflow.plan_bounce: ${result.error}`);
    } finally {
      cleanup(tmpDir);
    }
  });

  test('config-set accepts workflow.plan_bounce_script', () => {
    const tmpDir = createTempProject();
    try {
      const result = runGsdTools('config-set workflow.plan_bounce_script ./bounce.sh', tmpDir);
      assert.ok(result.success, `config-set should accept workflow.plan_bounce_script: ${result.error}`);
    } finally {
      cleanup(tmpDir);
    }
  });

  test('config-set accepts workflow.plan_bounce_passes', () => {
    const tmpDir = createTempProject();
    try {
      const result = runGsdTools('config-set workflow.plan_bounce_passes 2', tmpDir);
      assert.ok(result.success, `config-set should accept workflow.plan_bounce_passes: ${result.error}`);
    } finally {
      cleanup(tmpDir);
    }
  });
});

describe('Plan Bounce: config template defaults', () => {
  test('config template has plan_bounce default (false)', () => {
    const template = JSON.parse(fs.readFileSync(CONFIG_TEMPLATE_PATH, 'utf-8'));
    assert.strictEqual(
      template.workflow.plan_bounce,
      false,
      'config template workflow.plan_bounce should default to false'
    );
  });

  test('config template has plan_bounce_script default (null)', () => {
    const template = JSON.parse(fs.readFileSync(CONFIG_TEMPLATE_PATH, 'utf-8'));
    assert.strictEqual(
      template.workflow.plan_bounce_script,
      null,
      'config template workflow.plan_bounce_script should default to null'
    );
  });

  test('config template has plan_bounce_passes default (2)', () => {
    const template = JSON.parse(fs.readFileSync(CONFIG_TEMPLATE_PATH, 'utf-8'));
    assert.strictEqual(
      template.workflow.plan_bounce_passes,
      2,
      'config template workflow.plan_bounce_passes should default to 2'
    );
  });
});

// allow-test-rule: source-text-is-the-product
// plan-phase.md is the installed AI workflow instruction — its text content IS what executes.
// String presence tests guard against accidental deletion of bounce step clauses.
describe('Plan Bounce: plan-phase.md step 12.5', () => {
  const content = fs.readFileSync(PLAN_PHASE_PATH, 'utf-8');

  test('plan-phase.md contains step 12.5', () => {
    assert.ok(
      content.includes('## 12.5'),
      'plan-phase.md should contain step 12.5'
    );
  });

  test('step 12.5 references plan bounce', () => {
    // The step title should mention bounce
    assert.ok(
      /## 12\.5.*[Bb]ounce/i.test(content),
      'step 12.5 should reference plan bounce in its title'
    );
  });

  test('plan-phase.md has --bounce flag handling', () => {
    assert.ok(
      content.includes('--bounce'),
      'plan-phase.md should handle --bounce flag'
    );
  });

  test('plan-phase.md has --skip-bounce flag handling', () => {
    assert.ok(
      content.includes('--skip-bounce'),
      'plan-phase.md should handle --skip-bounce flag'
    );
  });

  test('plan-phase.md has backup pattern (pre-bounce.md)', () => {
    assert.ok(
      content.includes('pre-bounce.md'),
      'plan-phase.md should reference pre-bounce.md backup files'
    );
  });

  test('plan-phase.md has frontmatter integrity validation for bounced plans', () => {
    // Should mention YAML frontmatter validation after bounce
    assert.ok(
      /frontmatter.*bounced|bounced.*frontmatter|YAML.*bounce|bounce.*YAML/i.test(content),
      'plan-phase.md should validate frontmatter integrity on bounced plans'
    );
  });

  test('plan-phase.md re-runs checker on bounced plans', () => {
    // Should mention re-running plan checker after bounce
    assert.ok(
      /[Rr]e-run.*checker.*bounce|bounce.*checker.*re-run|checker.*bounced/i.test(content),
      'plan-phase.md should re-run plan checker on bounced plans'
    );
  });

  test('plan-phase.md references plan_bounce config keys', () => {
    assert.ok(
      content.includes('plan_bounce_script'),
      'plan-phase.md should reference plan_bounce_script config'
    );
    assert.ok(
      content.includes('plan_bounce_passes'),
      'plan-phase.md should reference plan_bounce_passes config'
    );
  });

  test('plan-phase.md disables bounce when --gaps flag is present', () => {
    // Should mention that --gaps disables bounce
    assert.ok(
      /--gaps.*bounce|bounce.*--gaps/i.test(content),
      'plan-phase.md should disable bounce when --gaps flag is present'
    );
  });

  test('plan-phase.md restores original on script failure', () => {
    // Should mention restoring from backup on failure
    assert.ok(
      /restore.*original|restore.*pre-bounce|original.*restore/i.test(content),
      'plan-phase.md should restore original plan on script failure'
    );
  });
});
