// allow-test-rule: docs-parity
// Extracts CONFIG_DEFAULTS keys from core.cjs source to verify planning-config.md
// stays in sync. The canonical list of defaults lives in source; there is no runtime
// API to enumerate them. Source inspection is the only practical parity check here.

/**
 * Verify planning-config.md documents all config fields from source code.
 */

const { describe, test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const REFERENCE_PATH = path.join(__dirname, '..', 'get-shit-done', 'references', 'planning-config.md');
const CORE_PATH = path.join(__dirname, '..', 'get-shit-done', 'bin', 'lib', 'core.cjs');

describe('config-field-docs', () => {
  let content;

  before(() => {
    content = fs.readFileSync(REFERENCE_PATH, 'utf-8');
  });

  test('contains Complete Field Reference section', () => {
    assert.ok(
      content.includes('## Complete Field Reference'),
      'planning-config.md must contain a "Complete Field Reference" heading'
    );
  });

  test('documents at least 15 config fields in tables', () => {
    // Count table rows that start with | `<key>` (field rows, not header/separator)
    const fieldRows = content.match(/^\| `[a-z_][a-z0-9_.]*` \|/gm);
    assert.ok(fieldRows, 'Expected markdown table rows with backtick-quoted keys');
    assert.ok(
      fieldRows.length >= 15,
      `Expected at least 15 documented fields, found ${fieldRows.length}`
    );
  });

  test('contains example configurations', () => {
    assert.ok(
      content.includes('## Example Configurations'),
      'planning-config.md must contain an "Example Configurations" section'
    );
    // Verify at least one JSON code block with a model_profile key
    assert.ok(
      content.includes('"model_profile"'),
      'Example configurations must include model_profile'
    );
  });

  test('contains field interactions section', () => {
    assert.ok(
      content.includes('## Field Interactions'),
      'planning-config.md must contain a "Field Interactions" section'
    );
  });

  test('every CONFIG_DEFAULTS key appears in the doc', () => {
    // Extract CONFIG_DEFAULTS keys from core.cjs source
    const coreSource = fs.readFileSync(CORE_PATH, 'utf-8');
    const defaultsMatch = coreSource.match(
      /const CONFIG_DEFAULTS\s*=\s*\{([\s\S]*?)\n\};/
    );
    assert.ok(defaultsMatch, 'Could not find CONFIG_DEFAULTS in core.cjs');

    const body = defaultsMatch[1];
    // Match property keys (word characters before the colon)
    const keys = [...body.matchAll(/^\s*(\w+)\s*:/gm)].map(m => m[1]);
    assert.ok(keys.length > 0, 'Could not extract any keys from CONFIG_DEFAULTS');

    // CONFIG_DEFAULTS uses flat keys; the doc may use namespaced equivalents.
    // Map flat keys to the namespace forms used in config.json and the doc.
    const NAMESPACE_MAP = {
      research: 'workflow.research',
      plan_checker: 'workflow.plan_check',
      verifier: 'workflow.verifier',
      nyquist_validation: 'workflow.nyquist_validation',
      ai_integration_phase: 'workflow.ai_integration_phase',
      text_mode: 'workflow.text_mode',
      subagent_timeout: 'workflow.subagent_timeout',
      branching_strategy: 'git.branching_strategy',
      phase_branch_template: 'git.phase_branch_template',
      milestone_branch_template: 'git.milestone_branch_template',
      quick_branch_template: 'git.quick_branch_template',
      security_enforcement: 'workflow.security_enforcement',
      security_asvs_level: 'workflow.security_asvs_level',
      security_block_on: 'workflow.security_block_on',
    };

    const missing = keys.filter(k => {
      // Check both bare key and namespaced form
      if (content.includes(`\`${k}\``)) return false;
      const ns = NAMESPACE_MAP[k];
      if (ns && content.includes(`\`${ns}\``)) return false;
      return true;
    });
    assert.deepStrictEqual(
      missing,
      [],
      `CONFIG_DEFAULTS keys missing from planning-config.md: ${missing.join(', ')}`
    );
  });

  test('documents workflow namespace fields', () => {
    const workflowFields = [
      'workflow.research',
      'workflow.plan_check',
      'workflow.verifier',
      'workflow.nyquist_validation',
      'workflow.use_worktrees',
      'workflow.subagent_timeout',
      'workflow.text_mode',
    ];
    const missing = workflowFields.filter(f => !content.includes(`\`${f}\``));
    assert.deepStrictEqual(
      missing,
      [],
      `Workflow fields missing from planning-config.md: ${missing.join(', ')}`
    );
  });

  test('documents git namespace fields', () => {
    const gitFields = [
      'git.branching_strategy',
      'git.base_branch',
      'git.phase_branch_template',
      'git.milestone_branch_template',
    ];
    const missing = gitFields.filter(f => !content.includes(`\`${f}\``));
    assert.deepStrictEqual(
      missing,
      [],
      `Git fields missing from planning-config.md: ${missing.join(', ')}`
    );
  });

  test('documents KNOWN_TOP_LEVEL internal fields not in CONFIG_DEFAULTS', () => {
    // These fields are in KNOWN_TOP_LEVEL (core.cjs) and read by loadConfig()
    // but not in CONFIG_DEFAULTS, so the CONFIG_DEFAULTS test doesn't cover them.
    const internalFields = [
      'model_overrides',
      'agent_skills',
    ];
    const missing = internalFields.filter(f => !content.includes(`\`${f}\``));
    assert.deepStrictEqual(
      missing,
      [],
      `KNOWN_TOP_LEVEL internal fields missing from planning-config.md: ${missing.join(', ')}`
    );
  });

  test('documents sub_repos field (CONFIG_DEFAULTS, no namespace form)', () => {
    // sub_repos is in CONFIG_DEFAULTS but has no NAMESPACE_MAP entry
    // (it uses a planning.sub_repos nested lookup but is documented as a
    // top-level field). Verify it explicitly since the NAMESPACE_MAP path
    // would silently skip it.
    assert.ok(
      content.includes('`sub_repos`'),
      'planning-config.md must document the sub_repos field'
    );
  });

  test('documents features.thinking_partner field', () => {
    // features.thinking_partner is in VALID_CONFIG_KEYS (config.cjs) and
    // used by discuss-phase.md and plan-phase.md for conditional extended
    // thinking at workflow decision points.
    assert.ok(
      content.includes('`features.thinking_partner`'),
      'planning-config.md must document the features.thinking_partner field'
    );
  });

  test('mode field documents correct allowed values', () => {
    // mode values are "interactive" and "yolo" per templates/config.json
    // and workflows/new-project.md — NOT "code-first"/"plan-first"/"hybrid"
    assert.ok(
      content.includes('"interactive"') && content.includes('"yolo"'),
      'mode field must document "interactive" and "yolo" as allowed values'
    );
    assert.ok(
      !content.includes('"code-first"'),
      'mode field must NOT document non-existent "code-first" value'
    );
  });

  test('discuss_mode field documents correct allowed values', () => {
    // discuss_mode values are "discuss" and "assumptions" per workflows/settings.md
    // NOT "auto" or "analyze" (those are CLI flags, not config values)
    assert.ok(
      content.includes('"assumptions"'),
      'discuss_mode must document "assumptions" as an allowed value'
    );
  });

  test('documents plan_checker alias for workflow.plan_check', () => {
    // plan_checker is the flat-key form in CONFIG_DEFAULTS; workflow.plan_check
    // is the canonical namespaced form. The doc should mention the alias.
    assert.ok(
      content.includes('`workflow.plan_check`'),
      'planning-config.md must document workflow.plan_check'
    );
    assert.ok(
      content.includes('plan_checker'),
      'planning-config.md must mention the plan_checker flat-key alias'
    );
  });
});
