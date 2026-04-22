/**
 * GSD Tools Tests — workflow.tdd_mode config key
 *
 * Validates that the tdd_mode workflow toggle is a first-class config key
 * with correct default, round-trip behavior, and presence in VALID_CONFIG_KEYS.
 *
 * Requirements: #1871
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

// ─── helpers ──────────────────────────────────────────────────────────────────

function readConfig(tmpDir) {
  const configPath = path.join(tmpDir, '.planning', 'config.json');
  return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
}

// ─── VALID_CONFIG_KEYS ──────────────────────────────────────────────────────

describe('workflow.tdd_mode in VALID_CONFIG_KEYS', () => {
  test('workflow.tdd_mode is a recognized config key', () => {
    const { VALID_CONFIG_KEYS } = require('../get-shit-done/bin/lib/config.cjs');
    assert.ok(
      VALID_CONFIG_KEYS.has('workflow.tdd_mode'),
      'workflow.tdd_mode should be in VALID_CONFIG_KEYS'
    );
  });
});

// ─── config default value ───────────────────────────────────────────────────

describe('workflow.tdd_mode default value', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('defaults to false in new project config', () => {
    // Ensure config is created with defaults
    const result = runGsdTools('config-ensure-section', tmpDir, { HOME: tmpDir });
    assert.ok(result.success, `config-ensure-section failed: ${result.error}`);

    const config = readConfig(tmpDir);
    assert.strictEqual(
      config.workflow.tdd_mode,
      false,
      'workflow.tdd_mode should default to false'
    );
  });
});

// ─── config round-trip (set / get) ─────────────────────────────────────────

describe('workflow.tdd_mode config round-trip', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    // Create a config file first
    runGsdTools('config-ensure-section', tmpDir, { HOME: tmpDir });
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('config-set workflow.tdd_mode true round-trips via config-get', () => {
    const setResult = runGsdTools('config-set workflow.tdd_mode true', tmpDir);
    assert.ok(setResult.success, `config-set failed: ${setResult.error}`);

    const getResult = runGsdTools('config-get workflow.tdd_mode', tmpDir);
    assert.ok(getResult.success, `config-get failed: ${getResult.error}`);
    assert.strictEqual(getResult.output, 'true');
  });

  test('config-set workflow.tdd_mode false round-trips via config-get', () => {
    // First set to true, then back to false
    runGsdTools('config-set workflow.tdd_mode true', tmpDir);

    const setResult = runGsdTools('config-set workflow.tdd_mode false', tmpDir);
    assert.ok(setResult.success, `config-set failed: ${setResult.error}`);

    const getResult = runGsdTools('config-get workflow.tdd_mode', tmpDir);
    assert.ok(getResult.success, `config-get failed: ${getResult.error}`);
    assert.strictEqual(getResult.output, 'false');
  });

  test('persists in config.json as boolean', () => {
    runGsdTools('config-set workflow.tdd_mode true', tmpDir);

    const config = readConfig(tmpDir);
    assert.strictEqual(config.workflow.tdd_mode, true);
    assert.strictEqual(typeof config.workflow.tdd_mode, 'boolean');
  });
});

// ─── init JSON exposure ────────────────────────────────────────────────────

describe('tdd_mode in init plan-phase JSON output', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    // Create ROADMAP.md with a phase so init plan-phase can find it
    const roadmap = [
      '# Roadmap',
      '',
      '## Phase 1 — Foundation',
      '**Status:** Planned',
      '**Requirements:** [R1]',
    ].join('\n');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), roadmap);
    // Ensure config exists
    runGsdTools('config-ensure-section', tmpDir, { HOME: tmpDir });
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('init plan-phase includes tdd_mode: false by default', () => {
    const result = runGsdTools('init plan-phase 1', tmpDir);
    assert.ok(result.success, `init plan-phase failed: ${result.error}`);
    const json = JSON.parse(result.output);
    assert.strictEqual(json.tdd_mode, false);
  });

  test('init plan-phase --tdd overrides to tdd_mode: true', () => {
    const result = runGsdTools('init plan-phase 1 --tdd', tmpDir);
    assert.ok(result.success, `init plan-phase --tdd failed: ${result.error}`);
    const json = JSON.parse(result.output);
    assert.strictEqual(json.tdd_mode, true);
  });

  test('config workflow.tdd_mode: true surfaces in init plan-phase without flag', () => {
    runGsdTools('config-set workflow.tdd_mode true', tmpDir);
    const result = runGsdTools('init plan-phase 1', tmpDir);
    assert.ok(result.success, `init plan-phase failed: ${result.error}`);
    const json = JSON.parse(result.output);
    assert.strictEqual(json.tdd_mode, true);
  });

  test('--tdd flag overrides config value of false', () => {
    runGsdTools('config-set workflow.tdd_mode false', tmpDir);
    const result = runGsdTools('init plan-phase 1 --tdd', tmpDir);
    assert.ok(result.success, `init plan-phase --tdd failed: ${result.error}`);
    const json = JSON.parse(result.output);
    assert.strictEqual(json.tdd_mode, true);
  });
});

describe('tdd_mode in init execute-phase JSON output', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    // Create ROADMAP.md with a phase so init execute-phase can find it
    const roadmap = [
      '# Roadmap',
      '',
      '## Phase 1 — Foundation',
      '**Status:** Planned',
      '**Requirements:** [R1]',
    ].join('\n');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), roadmap);
    // Ensure config exists
    runGsdTools('config-ensure-section', tmpDir, { HOME: tmpDir });
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('init execute-phase includes tdd_mode: false by default', () => {
    const result = runGsdTools('init execute-phase 1', tmpDir);
    assert.ok(result.success, `init execute-phase failed: ${result.error}`);
    const json = JSON.parse(result.output);
    assert.strictEqual(json.tdd_mode, false);
  });

  test('init execute-phase --tdd overrides to tdd_mode: true', () => {
    const result = runGsdTools('init execute-phase 1 --tdd', tmpDir);
    assert.ok(result.success, `init execute-phase --tdd failed: ${result.error}`);
    const json = JSON.parse(result.output);
    assert.strictEqual(json.tdd_mode, true);
  });

  test('config workflow.tdd_mode: true surfaces in init execute-phase without flag', () => {
    runGsdTools('config-set workflow.tdd_mode true', tmpDir);
    const result = runGsdTools('init execute-phase 1', tmpDir);
    assert.ok(result.success, `init execute-phase failed: ${result.error}`);
    const json = JSON.parse(result.output);
    assert.strictEqual(json.tdd_mode, true);
  });

  test('--tdd flag overrides config value of false', () => {
    runGsdTools('config-set workflow.tdd_mode false', tmpDir);
    const result = runGsdTools('init execute-phase 1 --tdd', tmpDir);
    assert.ok(result.success, `init execute-phase --tdd failed: ${result.error}`);
    const json = JSON.parse(result.output);
    assert.strictEqual(json.tdd_mode, true);
  });
});
