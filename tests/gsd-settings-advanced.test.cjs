'use strict';

/**
 * Tests for `/gsd-settings-advanced` — power-user configuration command (#2528).
 *
 * Covers:
 *   - Command file exists with correct frontmatter
 *   - Workflow file exists with required section structure
 *   - Every field in the issue spec is rendered in the workflow with its default
 *   - Current values are pre-selected in prompts
 *   - Config merge preserves unrelated keys (sibling preservation)
 *   - Confirmation table is rendered after save
 *   - Every field is accepted by VALID_CONFIG_KEYS
 *   - /gsd-settings confirmation output advertises /gsd-settings-advanced
 *   - Negative: non-numeric value rejected for numeric field via config-set
 */

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { createTempProject, cleanup, runGsdTools } = require('./helpers.cjs');
const { VALID_CONFIG_KEYS } = require('../get-shit-done/bin/lib/config-schema.cjs');

const ROOT = path.resolve(__dirname, '..');
const COMMAND_PATH = path.join(ROOT, 'commands', 'gsd', 'settings-advanced.md');
const WORKFLOW_PATH = path.join(ROOT, 'get-shit-done', 'workflows', 'settings-advanced.md');
const SETTINGS_WORKFLOW_PATH = path.join(ROOT, 'get-shit-done', 'workflows', 'settings.md');

// ─── Spec — every field the advanced command must expose ──────────────────────

const SPEC_FIELDS = {
  planning: [
    { key: 'workflow.plan_bounce',           default: 'false' },
    { key: 'workflow.plan_bounce_passes',    default: '2' },
    { key: 'workflow.plan_bounce_script',    default: 'null' },
    { key: 'workflow.subagent_timeout',      default: '600' },
    { key: 'workflow.inline_plan_threshold', default: '3' },
  ],
  execution: [
    { key: 'workflow.node_repair',        default: 'true' },
    { key: 'workflow.node_repair_budget', default: '2' },
    { key: 'workflow.auto_prune_state',   default: 'false' },
  ],
  discussion: [
    { key: 'workflow.max_discuss_passes', default: '3' },
  ],
  cross_ai: [
    { key: 'workflow.cross_ai_execution', default: 'false' },
    { key: 'workflow.cross_ai_command',   default: 'null' },
    { key: 'workflow.cross_ai_timeout',   default: '300' },
  ],
  git: [
    { key: 'git.base_branch',                default: 'main' },
    { key: 'git.phase_branch_template',      default: 'gsd/phase-{phase}-{slug}' },
    { key: 'git.milestone_branch_template',  default: 'gsd/{milestone}-{slug}' },
  ],
  runtime: [
    { key: 'response_language',     default: 'null' },
    { key: 'context_window',        default: '200000' },
    { key: 'search_gitignored',     default: 'false' },
    { key: 'graphify.build_timeout', default: '300' },
  ],
};

const ALL_SPEC_KEYS = Object.values(SPEC_FIELDS).flat().map((f) => f.key);

// ─── File existence + frontmatter ─────────────────────────────────────────────

describe('gsd-settings-advanced — file scaffolding', () => {
  test('command file exists at commands/gsd/settings-advanced.md', () => {
    assert.ok(fs.existsSync(COMMAND_PATH), `missing ${COMMAND_PATH}`);
  });

  test('workflow file exists at get-shit-done/workflows/settings-advanced.md', () => {
    assert.ok(fs.existsSync(WORKFLOW_PATH), `missing ${WORKFLOW_PATH}`);
  });

  test('command frontmatter has name, description, allowed-tools', () => {
    const text = fs.readFileSync(COMMAND_PATH, 'utf-8');
    const fmMatch = text.match(/^---\n([\s\S]*?)\n---/);
    assert.ok(fmMatch, 'command file missing frontmatter block');
    const fm = fmMatch[1];
    assert.match(fm, /name:\s*gsd:settings-advanced/, 'frontmatter missing name');
    assert.match(fm, /description:\s*\S/, 'frontmatter missing non-empty description');
    assert.match(fm, /allowed-tools:/, 'frontmatter missing allowed-tools');
  });

  test('command routes to the settings-advanced workflow', () => {
    const text = fs.readFileSync(COMMAND_PATH, 'utf-8');
    assert.ok(
      text.includes('workflows/settings-advanced.md'),
      'command file must reference workflows/settings-advanced.md'
    );
  });
});

// ─── Workflow content — sections and fields ───────────────────────────────────

describe('gsd-settings-advanced — workflow structure', () => {
  let workflow;
  try {
    workflow = fs.readFileSync(WORKFLOW_PATH, 'utf-8');
  } catch { workflow = ''; }

  const requiredSteps = [
    'ensure_and_load_config',
    'read_current',
    'present_settings',
    'update_config',
    'confirm',
  ];
  for (const step of requiredSteps) {
    test(`workflow defines <step name="${step}">`, () => {
      assert.ok(
        workflow.includes(`<step name="${step}">`),
        `workflow missing step ${step}`
      );
    });
  }

  const requiredSections = [
    'Planning Tuning',
    'Execution Tuning',
    'Discussion Tuning',
    'Cross-AI Execution',
    'Git Customization',
    'Runtime / Output',
  ];
  for (const section of requiredSections) {
    test(`workflow renders section "${section}"`, () => {
      assert.ok(
        workflow.includes(section),
        `workflow missing section heading "${section}"`
      );
    });
  }

  for (const field of Object.values(SPEC_FIELDS).flat()) {
    test(`workflow mentions key \`${field.key}\``, () => {
      assert.ok(
        workflow.includes(field.key),
        `workflow missing field ${field.key}`
      );
    });
    test(`workflow documents default for \`${field.key}\` (${field.default})`, () => {
      // Search for the default token in proximity to the key. Keep this
      // forgiving: same line, or within ~200 chars after the key.
      const idx = workflow.indexOf(field.key);
      assert.ok(idx >= 0, `key ${field.key} not found`);
      const window = workflow.slice(idx, idx + 400);
      assert.ok(
        window.includes(field.default),
        `default "${field.default}" not found near key ${field.key}. Window:\n${window}`
      );
    });
  }

  test('workflow pre-selects current values from loaded config', () => {
    assert.match(
      workflow,
      /pre-selected|current value|Current:/i,
      'workflow must document that current values are pre-selected'
    );
  });

  test('confirmation step renders a table with saved settings', () => {
    const confirmStart = workflow.indexOf('<step name="confirm">');
    assert.ok(confirmStart >= 0, 'confirm step missing');
    const confirmBlock = workflow.slice(confirmStart);
    assert.ok(
      confirmBlock.includes('|') && /\|[^\n]*Setting[^\n]*\|/.test(confirmBlock),
      'confirm step must render a markdown table with a Setting column'
    );
  });

  test('update_config step describes merge-preserving-siblings behavior', () => {
    assert.match(
      workflow,
      /(preserv(e|ing) (unrelated|sibling)|do not clobber|merge .*existing|...existing_config)/i,
      'update_config step must describe preserving unrelated keys'
    );
  });
});

// ─── VALID_CONFIG_KEYS membership ─────────────────────────────────────────────

describe('gsd-settings-advanced — VALID_CONFIG_KEYS coverage', () => {
  for (const key of ALL_SPEC_KEYS) {
    test(`VALID_CONFIG_KEYS contains "${key}"`, () => {
      assert.ok(
        VALID_CONFIG_KEYS.has(key),
        `VALID_CONFIG_KEYS missing ${key} — add it to get-shit-done/bin/lib/config-schema.cjs`
      );
    });
  }
});

// ─── /gsd-settings mentions /gsd-settings-advanced ────────────────────────────

describe('/gsd-settings advertises /gsd-settings-advanced', () => {
  test('settings workflow confirmation mentions gsd-settings-advanced', () => {
    const text = fs.readFileSync(SETTINGS_WORKFLOW_PATH, 'utf-8');
    assert.ok(
      text.includes('gsd-settings-advanced') || text.includes('gsd:settings-advanced'),
      'get-shit-done/workflows/settings.md must mention /gsd-settings-advanced or /gsd:settings-advanced'
    );
  });
});

// ─── Sibling-preservation via config-set ──────────────────────────────────────

describe('gsd-settings-advanced — config merge preserves unrelated keys', () => {
  test('setting workflow.plan_bounce_passes does not clobber model_profile or git.branching_strategy', (t) => {
    const tmpDir = createTempProject();
    t.after(() => cleanup(tmpDir));

    // Seed config
    const configPath = path.join(tmpDir, '.planning', 'config.json');
    const initial = {
      model_profile: 'quality',
      git: {
        branching_strategy: 'phase',
        phase_branch_template: 'feature/{phase}-{slug}',
      },
      workflow: {
        research: true,
        plan_check: false,
      },
      hooks: {
        context_warnings: true,
      },
    };
    fs.writeFileSync(configPath, JSON.stringify(initial, null, 2), 'utf-8');

    const result = runGsdTools(
      ['config-set', 'workflow.plan_bounce_passes', '5'],
      tmpDir,
      { HOME: tmpDir }
    );
    assert.ok(result.success, `config-set failed: ${result.error || result.output}`);

    const updated = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    assert.strictEqual(updated.model_profile, 'quality', 'model_profile clobbered');
    assert.strictEqual(updated.git.branching_strategy, 'phase', 'git.branching_strategy clobbered');
    assert.strictEqual(updated.git.phase_branch_template, 'feature/{phase}-{slug}', 'git.phase_branch_template clobbered');
    assert.strictEqual(updated.workflow.research, true, 'workflow.research clobbered');
    assert.strictEqual(updated.workflow.plan_check, false, 'workflow.plan_check clobbered');
    assert.strictEqual(updated.hooks.context_warnings, true, 'hooks.context_warnings clobbered');
    assert.strictEqual(updated.workflow.plan_bounce_passes, 5, 'new value not written');
  });

  test('setting context_window preserves existing top-level keys', (t) => {
    const tmpDir = createTempProject();
    t.after(() => cleanup(tmpDir));

    const configPath = path.join(tmpDir, '.planning', 'config.json');
    fs.writeFileSync(configPath, JSON.stringify({
      model_profile: 'balanced',
      response_language: 'Japanese',
      search_gitignored: true,
    }, null, 2));

    const result = runGsdTools(
      ['config-set', 'context_window', '1000000'],
      tmpDir,
      { HOME: tmpDir }
    );
    assert.ok(result.success, `config-set context_window failed: ${result.error || result.output}`);

    const updated = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    assert.strictEqual(updated.context_window, 1000000);
    assert.strictEqual(updated.model_profile, 'balanced');
    assert.strictEqual(updated.response_language, 'Japanese');
    assert.strictEqual(updated.search_gitignored, true);
  });
});

// ─── Negative: non-numeric for numeric field / unknown key rejected ───────────

describe('gsd-settings-advanced — negative scenarios', () => {
  test('config-set rejects an unknown key with a helpful error', (t) => {
    const tmpDir = createTempProject();
    t.after(() => cleanup(tmpDir));

    const result = runGsdTools(
      ['config-set', 'workflow.no_such_knob_at_all', 'true'],
      tmpDir,
      { HOME: tmpDir }
    );
    assert.ok(!result.success, 'config-set should reject unknown keys');
    const combined = (result.error || '') + (result.output || '');
    assert.match(combined, /Unknown config key/i);
  });

  test('workflow.subagent_timeout numeric input is coerced and stored as Number', (t) => {
    // The config-set parser coerces numeric-looking strings to Number.
    // This test locks in the coercion so users can't accidentally save
    // a string for a numeric knob. A non-numeric string would be stored
    // verbatim — we assert the parser prefers Number for numeric literals.
    const tmpDir = createTempProject();
    t.after(() => cleanup(tmpDir));

    const configPath = path.join(tmpDir, '.planning', 'config.json');
    fs.writeFileSync(configPath, '{}');

    const okNum = runGsdTools(
      ['config-set', 'workflow.subagent_timeout', '900'],
      tmpDir,
      { HOME: tmpDir }
    );
    assert.ok(okNum.success);
    const c1 = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    assert.strictEqual(typeof c1.workflow.subagent_timeout, 'number');
    assert.strictEqual(c1.workflow.subagent_timeout, 900);
  });

  test('workflow documents numeric-input rejection for non-numeric answers', () => {
    const workflow = fs.readFileSync(WORKFLOW_PATH, 'utf-8');
    assert.match(
      workflow,
      /(non-numeric|must be a number|integer|numeric input|re-?prompt)/i,
      'workflow must document how non-numeric input is handled for numeric fields'
    );
  });

  // Behavioral coverage for numeric-key inputs at the config-set boundary.
  // The /gsd-settings-advanced workflow promises non-numeric input is never
  // silently coerced — that promise is enforced by the AskUserQuestion
  // re-prompt loop in the workflow runner, not by config-set itself. The
  // CLI parser passes numeric-looking strings through Number() and stores
  // anything else verbatim. These tests lock in both behaviors so a future
  // regression that changes either layer surfaces immediately.
  test('config-set on a numeric key stores non-numeric input verbatim as string (workflow layer must reject before reaching here)', (t) => {
    const tmpDir = createTempProject();
    t.after(() => cleanup(tmpDir));

    const configPath = path.join(tmpDir, '.planning', 'config.json');
    fs.writeFileSync(configPath, '{}');

    const result = runGsdTools(
      ['config-set', 'workflow.subagent_timeout', 'not-a-number'],
      tmpDir,
      { HOME: tmpDir }
    );
    // The CLI layer accepts the write — type validation lives in the
    // /gsd-settings-advanced workflow. If a future change adds a numeric
    // type-check at config-set, flip this assertion to !result.success.
    assert.ok(result.success, `config-set should accept the raw value at the CLI boundary: ${result.error || result.output}`);
    const stored = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    assert.strictEqual(
      typeof stored.workflow.subagent_timeout,
      'string',
      'non-numeric input on a numeric key currently lands as a string at the CLI boundary'
    );
    assert.strictEqual(stored.workflow.subagent_timeout, 'not-a-number');
  });

  test('config-set on a numeric key coerces a numeric string to Number (parser invariant)', (t) => {
    const tmpDir = createTempProject();
    t.after(() => cleanup(tmpDir));

    const configPath = path.join(tmpDir, '.planning', 'config.json');
    fs.writeFileSync(configPath, '{}');

    const result = runGsdTools(
      ['config-set', 'workflow.max_discuss_passes', '7'],
      tmpDir,
      { HOME: tmpDir }
    );
    assert.ok(result.success, `config-set failed: ${result.error || result.output}`);
    const stored = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    assert.strictEqual(typeof stored.workflow.max_discuss_passes, 'number');
    assert.strictEqual(stored.workflow.max_discuss_passes, 7);
  });
});
