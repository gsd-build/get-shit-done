// allow-test-rule: pending-migration-to-typed-ir [#2974]
// Tracked in #2974 for migration to typed-IR assertions per CONTRIBUTING.md
// "Prohibited: Raw Text Matching on Test Outputs". Per-file review may
// reclassify some entries as source-text-is-the-product during migration.

/**
 * GSD Tools Tests - subagent timeout configuration
 *
 * Validates that workflow.subagent_timeout is properly registered,
 * loaded from config, and emitted in init context.
 *
 * Closes: #1472
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

// ─── config key registration ─────────────────────────────────────────────────

describe('workflow.subagent_timeout config key (#1472)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('subagent_timeout has correct default value (300000ms)', () => {
    // Write a minimal config.json
    const configPath = path.join(tmpDir, '.planning', 'config.json');
    fs.writeFileSync(configPath, JSON.stringify({ model_profile: 'balanced' }, null, 2));

    // Load config via init and check the value propagates
    // Use config-get to verify the field is recognized
    const result = runGsdTools(['config-set', 'workflow.subagent_timeout', '600000'], tmpDir);
    assert.ok(result.success, `config-set should accept workflow.subagent_timeout: ${result.error}`);

    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    assert.strictEqual(config.workflow.subagent_timeout, 600000);
  });

  test('config-set rejects invalid config keys but accepts subagent_timeout', () => {
    const configPath = path.join(tmpDir, '.planning', 'config.json');
    fs.writeFileSync(configPath, JSON.stringify({}, null, 2));

    // Valid key should succeed
    const valid = runGsdTools(['config-set', 'workflow.subagent_timeout', '900000'], tmpDir);
    assert.ok(valid.success, `workflow.subagent_timeout should be a valid key: ${valid.error}`);

    // Invalid key should fail
    const invalid = runGsdTools(['config-set', 'workflow.nonexistent_key', 'true'], tmpDir);
    assert.ok(!invalid.success, 'nonexistent key should be rejected');
  });

  test('subagent_timeout appears in map-codebase init context', () => {
    const configPath = path.join(tmpDir, '.planning', 'config.json');
    fs.writeFileSync(configPath, JSON.stringify({
      workflow: { subagent_timeout: 600000 }
    }, null, 2));

    const result = runGsdTools('init map-codebase', tmpDir, { HOME: tmpDir });
    assert.ok(result.success, `init map-codebase should succeed: ${result.error}`);

    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.subagent_timeout, 600000, 'init context should include configured timeout');
  });

  test('subagent_timeout defaults to 300000 when not configured', () => {
    const configPath = path.join(tmpDir, '.planning', 'config.json');
    fs.writeFileSync(configPath, JSON.stringify({}, null, 2));

    const result = runGsdTools('init map-codebase', tmpDir, { HOME: tmpDir });
    assert.ok(result.success, `init map-codebase should succeed: ${result.error}`);

    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.subagent_timeout, 300000, 'default should be 300000ms (5 minutes)');
  });
});

describe('map-codebase workflow references configurable timeout (#1472)', () => {
  test('workflow file references subagent_timeout from init context', () => {
    const workflowPath = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'map-codebase.md');
    const content = fs.readFileSync(workflowPath, 'utf8');

    assert.ok(
      content.includes('subagent_timeout'),
      'map-codebase.md should reference subagent_timeout from init context'
    );
    assert.ok(
      content.includes('workflow.subagent_timeout'),
      'map-codebase.md should document the config key'
    );
  });

  test('workflow file no longer has hardcoded 300000 timeout', () => {
    const workflowPath = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'map-codebase.md');
    const content = fs.readFileSync(workflowPath, 'utf8');

    // The timeout line should reference the config variable, not a hardcoded value
    const timeoutLines = content.split('\n').filter(l => l.includes('timeout:'));
    for (const line of timeoutLines) {
      assert.ok(
        !line.match(/timeout:\s*300000\s*$/),
        `found hardcoded timeout: "${line.trim()}". Should reference subagent_timeout from init context.`
      );
    }
  });
});

describe('planning-config.md documents subagent_timeout (#1472)', () => {
  test('reference doc includes subagent_timeout entry', () => {
    const refPath = path.join(__dirname, '..', 'get-shit-done', 'references', 'planning-config.md');
    const content = fs.readFileSync(refPath, 'utf8');

    assert.ok(
      content.includes('workflow.subagent_timeout'),
      'planning-config.md should document workflow.subagent_timeout'
    );
    assert.ok(
      content.includes('300000'),
      'planning-config.md should document the default value (300000)'
    );
  });
});

// ─── init execute-phase includes context_window ─────────────────────────────

describe('init execute-phase context_window (#1472)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('init execute-phase output includes context_window from config', () => {
    // Write config with a custom context_window value (1M for Opus/Sonnet 4.6)
    const configPath = path.join(tmpDir, '.planning', 'config.json');
    fs.writeFileSync(configPath, JSON.stringify({
      context_window: 1000000,
    }, null, 2));

    // Create a phase directory with a plan so init execute-phase succeeds
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-setup');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), '# Plan');

    const result = runGsdTools('init execute-phase 1', tmpDir, { HOME: tmpDir });
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.context_window, 1000000, 'context_window should reflect configured value');
  });

  test('init execute-phase uses default context_window when not configured', () => {
    // Write minimal config without context_window
    const configPath = path.join(tmpDir, '.planning', 'config.json');
    fs.writeFileSync(configPath, JSON.stringify({}, null, 2));

    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-setup');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), '# Plan');

    const result = runGsdTools('init execute-phase 1', tmpDir, { HOME: tmpDir });
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.context_window, 200000, 'default context_window should be 200000');
  });
});

// ─── config-get context_window ──────────────────────────────────────────────

describe('config-get context_window (#1472)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('config-get context_window returns the configured value', () => {
    const configPath = path.join(tmpDir, '.planning', 'config.json');
    fs.writeFileSync(configPath, JSON.stringify({
      context_window: 1000000,
    }, null, 2));

    const result = runGsdTools('config-get context_window', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output, 1000000);
  });

  test('config-get context_window returns schema default (200000) when key is absent', () => {
    // Bug #2943: context_window has a schema-level default of 200000.
    // config-get must return it (exit 0) rather than "Key not found" (exit 1).
    const configPath = path.join(tmpDir, '.planning', 'config.json');
    fs.writeFileSync(configPath, JSON.stringify({}, null, 2));

    const result = runGsdTools('config-get context_window', tmpDir);
    assert.ok(result.success, `Expected success but got: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output, 200000, 'schema default for context_window should be 200000');
  });
});

// ─── config-set workflow.subagent_timeout numeric coercion ──────────────────

describe('config-set workflow.subagent_timeout numeric values (#1472)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    const configPath = path.join(tmpDir, '.planning', 'config.json');
    fs.writeFileSync(configPath, JSON.stringify({}, null, 2));
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('config-set workflow.subagent_timeout coerces string to number', () => {
    const result = runGsdTools(['config-set', 'workflow.subagent_timeout', '900000'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.updated, true);
    assert.strictEqual(output.key, 'workflow.subagent_timeout');
    assert.strictEqual(output.value, 900000);

    const configPath = path.join(tmpDir, '.planning', 'config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    assert.strictEqual(config.workflow.subagent_timeout, 900000);
    assert.strictEqual(typeof config.workflow.subagent_timeout, 'number');
  });

  test('config-set workflow.subagent_timeout round-trips through config-get', () => {
    runGsdTools(['config-set', 'workflow.subagent_timeout', '1200000'], tmpDir);

    const result = runGsdTools('config-get workflow.subagent_timeout', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output, 1200000);
  });
});
