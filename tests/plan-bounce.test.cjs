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

const GSD_ROOT = path.join(__dirname, '..', 'get-shit-done');
const CONFIG_CJS_PATH = path.join(GSD_ROOT, 'bin', 'lib', 'config-schema.cjs');
const CONFIG_TEMPLATE_PATH = path.join(GSD_ROOT, 'templates', 'config.json');
const PLAN_PHASE_PATH = path.join(GSD_ROOT, 'workflows', 'plan-phase.md');

describe('Plan Bounce: config keys', () => {
  test('workflow.plan_bounce is in VALID_CONFIG_KEYS', () => {
    const content = fs.readFileSync(CONFIG_CJS_PATH, 'utf-8');
    assert.ok(
      content.includes("'workflow.plan_bounce'"),
      'VALID_CONFIG_KEYS should contain workflow.plan_bounce'
    );
  });

  test('workflow.plan_bounce_script is in VALID_CONFIG_KEYS', () => {
    const content = fs.readFileSync(CONFIG_CJS_PATH, 'utf-8');
    assert.ok(
      content.includes("'workflow.plan_bounce_script'"),
      'VALID_CONFIG_KEYS should contain workflow.plan_bounce_script'
    );
  });

  test('workflow.plan_bounce_passes is in VALID_CONFIG_KEYS', () => {
    const content = fs.readFileSync(CONFIG_CJS_PATH, 'utf-8');
    assert.ok(
      content.includes("'workflow.plan_bounce_passes'"),
      'VALID_CONFIG_KEYS should contain workflow.plan_bounce_passes'
    );
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

describe('Plan Bounce: plan-phase.md step 12.5', () => {
  let content;

  test('plan-phase.md contains step 12.5', () => {
    content = fs.readFileSync(PLAN_PHASE_PATH, 'utf-8');
    assert.ok(
      content.includes('## 12.5'),
      'plan-phase.md should contain step 12.5'
    );
  });

  test('step 12.5 references plan bounce', () => {
    content = content || fs.readFileSync(PLAN_PHASE_PATH, 'utf-8');
    // The step title should mention bounce
    assert.ok(
      /## 12\.5.*[Bb]ounce/i.test(content),
      'step 12.5 should reference plan bounce in its title'
    );
  });

  test('plan-phase.md has --bounce flag handling', () => {
    content = content || fs.readFileSync(PLAN_PHASE_PATH, 'utf-8');
    assert.ok(
      content.includes('--bounce'),
      'plan-phase.md should handle --bounce flag'
    );
  });

  test('plan-phase.md has --skip-bounce flag handling', () => {
    content = content || fs.readFileSync(PLAN_PHASE_PATH, 'utf-8');
    assert.ok(
      content.includes('--skip-bounce'),
      'plan-phase.md should handle --skip-bounce flag'
    );
  });

  test('plan-phase.md has backup pattern (pre-bounce.md)', () => {
    content = content || fs.readFileSync(PLAN_PHASE_PATH, 'utf-8');
    assert.ok(
      content.includes('pre-bounce.md'),
      'plan-phase.md should reference pre-bounce.md backup files'
    );
  });

  test('plan-phase.md has frontmatter integrity validation for bounced plans', () => {
    content = content || fs.readFileSync(PLAN_PHASE_PATH, 'utf-8');
    // Should mention YAML frontmatter validation after bounce
    assert.ok(
      /frontmatter.*bounced|bounced.*frontmatter|YAML.*bounce|bounce.*YAML/i.test(content),
      'plan-phase.md should validate frontmatter integrity on bounced plans'
    );
  });

  test('plan-phase.md re-runs checker on bounced plans', () => {
    content = content || fs.readFileSync(PLAN_PHASE_PATH, 'utf-8');
    // Should mention re-running plan checker after bounce
    assert.ok(
      /[Rr]e-run.*checker.*bounce|bounce.*checker.*re-run|checker.*bounced/i.test(content),
      'plan-phase.md should re-run plan checker on bounced plans'
    );
  });

  test('plan-phase.md references plan_bounce config keys', () => {
    content = content || fs.readFileSync(PLAN_PHASE_PATH, 'utf-8');
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
    content = content || fs.readFileSync(PLAN_PHASE_PATH, 'utf-8');
    // Should mention that --gaps disables bounce
    assert.ok(
      /--gaps.*bounce|bounce.*--gaps/i.test(content),
      'plan-phase.md should disable bounce when --gaps flag is present'
    );
  });

  test('plan-phase.md restores original on script failure', () => {
    content = content || fs.readFileSync(PLAN_PHASE_PATH, 'utf-8');
    // Should mention restoring from backup on failure
    assert.ok(
      /restore.*original|restore.*pre-bounce|original.*restore/i.test(content),
      'plan-phase.md should restore original plan on script failure'
    );
  });
});
