/**
 * GSD Tools Tests - config.cjs
 *
 * CLI integration tests for config-ensure-section, config-set, and config-get
 * commands exercised through gsd-tools.cjs via execSync.
 *
 * Requirements: TEST-13
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

// ─── helpers ──────────────────────────────────────────────────────────────────

function readConfig(tmpDir) {
  const configPath = path.join(tmpDir, '.planning', 'config.json');
  return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
}

function writeConfig(tmpDir, obj) {
  const configPath = path.join(tmpDir, '.planning', 'config.json');
  fs.writeFileSync(configPath, JSON.stringify(obj, null, 2), 'utf-8');
}

// ─── config-ensure-section ───────────────────────────────────────────────────

describe('config-ensure-section command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('creates config.json with expected structure and types', () => {
    const result = runGsdTools('config-ensure-section', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.created, true);

    const config = readConfig(tmpDir);
    // Verify structure and types — exact values may vary if ~/.gsd/defaults.json exists
    assert.strictEqual(typeof config.model_profile, 'string');
    assert.strictEqual(typeof config.commit_docs, 'boolean');
    assert.strictEqual(typeof config.parallelization, 'boolean');
    assert.strictEqual(typeof config.branching_strategy, 'string');
    assert.ok(config.workflow && typeof config.workflow === 'object', 'workflow should be an object');
    assert.strictEqual(typeof config.workflow.research, 'boolean');
    assert.strictEqual(typeof config.workflow.plan_check, 'boolean');
    assert.strictEqual(typeof config.workflow.verifier, 'boolean');
    assert.strictEqual(typeof config.workflow.nyquist_validation, 'boolean');
    // These hardcoded defaults are always present (may be overridden by user defaults)
    assert.ok('model_profile' in config, 'model_profile should exist');
    assert.ok('brave_search' in config, 'brave_search should exist');
    assert.ok('search_gitignored' in config, 'search_gitignored should exist');
  });

  test('is idempotent — returns already_exists on second call', () => {
    const first = runGsdTools('config-ensure-section', tmpDir);
    assert.ok(first.success, `First call failed: ${first.error}`);
    const firstOutput = JSON.parse(first.output);
    assert.strictEqual(firstOutput.created, true);

    const second = runGsdTools('config-ensure-section', tmpDir);
    assert.ok(second.success, `Second call failed: ${second.error}`);
    const secondOutput = JSON.parse(second.output);
    assert.strictEqual(secondOutput.created, false);
    assert.strictEqual(secondOutput.reason, 'already_exists');
  });

  // NOTE: This test touches ~/.gsd/ on the real filesystem. It uses save/restore
  // try/finally and skips if the file already exists to avoid corrupting user config.
  test('detects Brave Search from file-based key', () => {
    const homedir = os.homedir();
    const gsdDir = path.join(homedir, '.gsd');
    const braveKeyFile = path.join(gsdDir, 'brave_api_key');

    // Skip if file already exists (don't mess with user's real config)
    if (fs.existsSync(braveKeyFile)) {
      return;
    }

    // Create .gsd dir and brave_api_key file
    const gsdDirExisted = fs.existsSync(gsdDir);
    try {
      if (!gsdDirExisted) {
        fs.mkdirSync(gsdDir, { recursive: true });
      }
      fs.writeFileSync(braveKeyFile, 'test-key', 'utf-8');

      const result = runGsdTools('config-ensure-section', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);

      const config = readConfig(tmpDir);
      assert.strictEqual(config.brave_search, true);
    } finally {
      // Clean up
      try { fs.unlinkSync(braveKeyFile); } catch { /* ignore */ }
      if (!gsdDirExisted) {
        try { fs.rmdirSync(gsdDir); } catch { /* ignore if not empty */ }
      }
    }
  });

  // NOTE: This test touches ~/.gsd/ on the real filesystem. It uses save/restore
  // try/finally and skips if the file already exists to avoid corrupting user config.
  test('merges user defaults from defaults.json', () => {
    const homedir = os.homedir();
    const gsdDir = path.join(homedir, '.gsd');
    const defaultsFile = path.join(gsdDir, 'defaults.json');

    // Save existing defaults if present
    let existingDefaults = null;
    const gsdDirExisted = fs.existsSync(gsdDir);
    if (fs.existsSync(defaultsFile)) {
      existingDefaults = fs.readFileSync(defaultsFile, 'utf-8');
    }

    try {
      if (!gsdDirExisted) {
        fs.mkdirSync(gsdDir, { recursive: true });
      }
      fs.writeFileSync(defaultsFile, JSON.stringify({
        model_profile: 'quality',
        commit_docs: false,
      }), 'utf-8');

      const result = runGsdTools('config-ensure-section', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);

      const config = readConfig(tmpDir);
      assert.strictEqual(config.model_profile, 'quality', 'model_profile should be overridden');
      assert.strictEqual(config.commit_docs, false, 'commit_docs should be overridden');
      assert.strictEqual(typeof config.branching_strategy, 'string', 'branching_strategy should be a string');
    } finally {
      // Restore
      if (existingDefaults !== null) {
        fs.writeFileSync(defaultsFile, existingDefaults, 'utf-8');
      } else {
        try { fs.unlinkSync(defaultsFile); } catch { /* ignore */ }
      }
      if (!gsdDirExisted) {
        try { fs.rmdirSync(gsdDir); } catch { /* ignore */ }
      }
    }
  });

  // NOTE: This test touches ~/.gsd/ on the real filesystem. It uses save/restore
  // try/finally and skips if the file already exists to avoid corrupting user config.
  test('merges nested workflow keys from defaults.json preserving unset keys', () => {
    const homedir = os.homedir();
    const gsdDir = path.join(homedir, '.gsd');
    const defaultsFile = path.join(gsdDir, 'defaults.json');

    let existingDefaults = null;
    const gsdDirExisted = fs.existsSync(gsdDir);
    if (fs.existsSync(defaultsFile)) {
      existingDefaults = fs.readFileSync(defaultsFile, 'utf-8');
    }

    try {
      if (!gsdDirExisted) {
        fs.mkdirSync(gsdDir, { recursive: true });
      }
      fs.writeFileSync(defaultsFile, JSON.stringify({
        workflow: { research: false },
      }), 'utf-8');

      const result = runGsdTools('config-ensure-section', tmpDir);
      assert.ok(result.success, `Command failed: ${result.error}`);

      const config = readConfig(tmpDir);
      assert.strictEqual(config.workflow.research, false, 'research should be overridden');
      assert.strictEqual(typeof config.workflow.plan_check, 'boolean', 'plan_check should be a boolean');
      assert.strictEqual(typeof config.workflow.verifier, 'boolean', 'verifier should be a boolean');
    } finally {
      if (existingDefaults !== null) {
        fs.writeFileSync(defaultsFile, existingDefaults, 'utf-8');
      } else {
        try { fs.unlinkSync(defaultsFile); } catch { /* ignore */ }
      }
      if (!gsdDirExisted) {
        try { fs.rmdirSync(gsdDir); } catch { /* ignore */ }
      }
    }
  });
});

// ─── config-set ──────────────────────────────────────────────────────────────

describe('config-set command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    // Create initial config
    runGsdTools('config-ensure-section', tmpDir);
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('sets a top-level string value', () => {
    const result = runGsdTools('config-set model_profile quality', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.updated, true);
    assert.strictEqual(output.key, 'model_profile');
    assert.strictEqual(output.value, 'quality');

    const config = readConfig(tmpDir);
    assert.strictEqual(config.model_profile, 'quality');
  });

  test('coerces true to boolean', () => {
    const result = runGsdTools('config-set commit_docs true', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const config = readConfig(tmpDir);
    assert.strictEqual(config.commit_docs, true);
    assert.strictEqual(typeof config.commit_docs, 'boolean');
  });

  test('coerces false to boolean', () => {
    const result = runGsdTools('config-set commit_docs false', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const config = readConfig(tmpDir);
    assert.strictEqual(config.commit_docs, false);
    assert.strictEqual(typeof config.commit_docs, 'boolean');
  });

  test('coerces numeric strings to numbers', () => {
    const result = runGsdTools('config-set some_number 42', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const config = readConfig(tmpDir);
    assert.strictEqual(config.some_number, 42);
    assert.strictEqual(typeof config.some_number, 'number');
  });

  test('preserves plain strings', () => {
    const result = runGsdTools('config-set some_string hello', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const config = readConfig(tmpDir);
    assert.strictEqual(config.some_string, 'hello');
    assert.strictEqual(typeof config.some_string, 'string');
  });

  test('sets nested values via dot-notation', () => {
    const result = runGsdTools('config-set workflow.research false', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const config = readConfig(tmpDir);
    assert.strictEqual(config.workflow.research, false);
  });

  test('auto-creates nested objects for deep dot-notation', () => {
    // Start with empty config
    writeConfig(tmpDir, {});

    const result = runGsdTools('config-set a.b.c deep_value', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const config = readConfig(tmpDir);
    assert.strictEqual(config.a.b.c, 'deep_value');
    assert.strictEqual(typeof config.a, 'object');
    assert.strictEqual(typeof config.a.b, 'object');
  });

  test('errors when no key path provided', () => {
    const result = runGsdTools('config-set', tmpDir);
    assert.strictEqual(result.success, false);
  });
});

// ─── config-get ──────────────────────────────────────────────────────────────

describe('config-get command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    // Create config with known values
    runGsdTools('config-ensure-section', tmpDir);
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('gets a top-level value', () => {
    const result = runGsdTools('config-get model_profile', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output, 'balanced');
  });

  test('gets a nested value via dot-notation', () => {
    const result = runGsdTools('config-get workflow.research', tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output, true);
  });

  test('errors for nonexistent key', () => {
    const result = runGsdTools('config-get nonexistent_key', tmpDir);
    assert.strictEqual(result.success, false);
    assert.ok(
      result.error.includes('Key not found'),
      `Expected "Key not found" in error: ${result.error}`
    );
  });

  test('errors for deeply nested nonexistent key', () => {
    const result = runGsdTools('config-get workflow.nonexistent', tmpDir);
    assert.strictEqual(result.success, false);
    assert.ok(
      result.error.includes('Key not found'),
      `Expected "Key not found" in error: ${result.error}`
    );
  });

  test('errors when config.json does not exist', () => {
    const emptyTmpDir = createTempProject();
    try {
      const result = runGsdTools('config-get model_profile', emptyTmpDir);
      assert.strictEqual(result.success, false);
      assert.ok(
        result.error.includes('No config.json'),
        `Expected "No config.json" in error: ${result.error}`
      );
    } finally {
      cleanup(emptyTmpDir);
    }
  });

  test('errors when no key path provided', () => {
    const result = runGsdTools('config-get', tmpDir);
    assert.strictEqual(result.success, false);
  });
});
