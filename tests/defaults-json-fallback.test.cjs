/**
 * GSD Tools Tests — ~/.gsd/defaults.json fallback (#1683)
 *
 * When .planning/ does not exist (pre-project context), loadConfig() should
 * consult ~/.gsd/defaults.json before returning hardcoded defaults.
 * When .planning/ exists but config.json is missing, hardcoded defaults are used.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { cleanup } = require('./helpers.cjs');

const { loadConfig } = require('../get-shit-done/bin/lib/core.cjs');

/** Create a bare temp dir (no .planning/) to simulate pre-project context */
function createBareTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-test-'));
}

describe('loadConfig ~/.gsd/defaults.json fallback (#1683)', () => {
  test('pre-project, no defaults.json → hardcoded defaults', (t) => {
    const tmpDir = createBareTmpDir();
    process.env.GSD_HOME = tmpDir;
    t.after(() => { delete process.env.GSD_HOME; cleanup(tmpDir); });

    const config = loadConfig(tmpDir);
    assert.strictEqual(config.model_profile, 'balanced');
    assert.strictEqual(config.context_window, 200000);
    assert.strictEqual(config.research, true);
    assert.strictEqual(config.subagent_timeout, 300000);
  });

  test('pre-project, defaults.json exists → merges with hardcoded defaults', (t) => {
    const tmpDir = createBareTmpDir();

    // Create ~/.gsd/defaults.json under fake GSD_HOME
    const gsdDir = path.join(tmpDir, '.gsd');
    fs.mkdirSync(gsdDir, { recursive: true });
    fs.writeFileSync(
      path.join(gsdDir, 'defaults.json'),
      JSON.stringify({ model_profile: 'quality', context_window: 1000000 })
    );

    process.env.GSD_HOME = tmpDir;
    t.after(() => { delete process.env.GSD_HOME; cleanup(tmpDir); });

    const config = loadConfig(tmpDir);
    // Values from defaults.json
    assert.strictEqual(config.model_profile, 'quality');
    assert.strictEqual(config.context_window, 1000000);
    // Hardcoded defaults for keys not in defaults.json
    assert.strictEqual(config.research, true);
    assert.strictEqual(config.subagent_timeout, 300000);
    assert.strictEqual(config.parallelization, true);
  });

  test('.planning/ exists but no config.json → hardcoded defaults (not defaults.json)', (t) => {
    const tmpDir = createBareTmpDir();
    // Create .planning/ without config.json
    fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });

    // Create defaults.json — should NOT be consulted
    const gsdDir = path.join(tmpDir, '.gsd');
    fs.mkdirSync(gsdDir, { recursive: true });
    fs.writeFileSync(
      path.join(gsdDir, 'defaults.json'),
      JSON.stringify({ model_profile: 'quality', context_window: 1000000 })
    );

    process.env.GSD_HOME = tmpDir;
    t.after(() => { delete process.env.GSD_HOME; cleanup(tmpDir); });

    const config = loadConfig(tmpDir);
    // Hardcoded defaults — NOT defaults.json values
    assert.strictEqual(config.model_profile, 'balanced');
    assert.strictEqual(config.context_window, 200000);
  });

  test('project config exists → project config wins', (t) => {
    const tmpDir = createBareTmpDir();
    fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ model_profile: 'budget' })
    );

    // Also write defaults.json with a different value
    const gsdDir = path.join(tmpDir, '.gsd');
    fs.mkdirSync(gsdDir, { recursive: true });
    fs.writeFileSync(
      path.join(gsdDir, 'defaults.json'),
      JSON.stringify({ model_profile: 'quality', context_window: 1000000 })
    );

    process.env.GSD_HOME = tmpDir;
    t.after(() => { delete process.env.GSD_HOME; cleanup(tmpDir); });

    const config = loadConfig(tmpDir);
    assert.strictEqual(config.model_profile, 'budget');
    assert.strictEqual(config.context_window, 200000);
  });

  test('defaults.json with unknown keys → unknown keys NOT passed through', (t) => {
    const tmpDir = createBareTmpDir();

    const gsdDir = path.join(tmpDir, '.gsd');
    fs.mkdirSync(gsdDir, { recursive: true });
    fs.writeFileSync(
      path.join(gsdDir, 'defaults.json'),
      JSON.stringify({
        model_profile: 'quality',
        unknown_key: 'should_not_appear',
        another_unknown: 42,
      })
    );

    process.env.GSD_HOME = tmpDir;
    t.after(() => { delete process.env.GSD_HOME; cleanup(tmpDir); });

    const config = loadConfig(tmpDir);
    assert.strictEqual(config.model_profile, 'quality');
    assert.strictEqual(config.unknown_key, undefined);
    assert.strictEqual(config.another_unknown, undefined);
  });

  test('defaults.json with invalid JSON → returns hardcoded defaults', (t) => {
    const tmpDir = createBareTmpDir();

    const gsdDir = path.join(tmpDir, '.gsd');
    fs.mkdirSync(gsdDir, { recursive: true });
    fs.writeFileSync(path.join(gsdDir, 'defaults.json'), '{ not valid json !!!');

    process.env.GSD_HOME = tmpDir;
    t.after(() => { delete process.env.GSD_HOME; cleanup(tmpDir); });

    const config = loadConfig(tmpDir);
    assert.strictEqual(config.model_profile, 'balanced');
    assert.strictEqual(config.context_window, 200000);
  });
});
