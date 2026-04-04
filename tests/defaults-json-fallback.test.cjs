/**
 * GSD Tools Tests — ~/.gsd/defaults.json fallback (#1683)
 *
 * When .planning/config.json is missing, loadConfig() should consult
 * ~/.gsd/defaults.json before returning hardcoded defaults.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { createTempProject, cleanup } = require('./helpers.cjs');

const { loadConfig } = require('../get-shit-done/bin/lib/core.cjs');

describe('loadConfig ~/.gsd/defaults.json fallback (#1683)', () => {
  test('no project config, no defaults.json → hardcoded defaults', (t) => {
    const tmpDir = createTempProject();
    // Remove config.json so the primary path fails
    const configPath = path.join(tmpDir, '.planning', 'config.json');
    try { fs.unlinkSync(configPath); } catch { /* already absent */ }

    // Point HOME to tmpDir so ~/.gsd/defaults.json doesn't exist
    const origHome = process.env.HOME;
    process.env.HOME = tmpDir;
    t.after(() => { process.env.HOME = origHome; cleanup(tmpDir); });

    const config = loadConfig(tmpDir);
    assert.strictEqual(config.model_profile, 'balanced');
    assert.strictEqual(config.context_window, 200000);
    assert.strictEqual(config.research, true);
    assert.strictEqual(config.subagent_timeout, 300000);
  });

  test('no project config, defaults.json exists → merges with hardcoded defaults', (t) => {
    const tmpDir = createTempProject();
    const configPath = path.join(tmpDir, '.planning', 'config.json');
    try { fs.unlinkSync(configPath); } catch { /* already absent */ }

    // Create ~/.gsd/defaults.json under fake HOME
    const gsdDir = path.join(tmpDir, '.gsd');
    fs.mkdirSync(gsdDir, { recursive: true });
    fs.writeFileSync(
      path.join(gsdDir, 'defaults.json'),
      JSON.stringify({ model_profile: 'quality', context_window: 1000000 })
    );

    const origHome = process.env.HOME;
    process.env.HOME = tmpDir;
    t.after(() => { process.env.HOME = origHome; cleanup(tmpDir); });

    const config = loadConfig(tmpDir);
    // Values from defaults.json
    assert.strictEqual(config.model_profile, 'quality');
    assert.strictEqual(config.context_window, 1000000);
    // Hardcoded defaults for keys not in defaults.json
    assert.strictEqual(config.research, true);
    assert.strictEqual(config.subagent_timeout, 300000);
    assert.strictEqual(config.parallelization, true);
  });

  test('project config exists → project config wins, defaults.json NOT consulted', (t) => {
    const tmpDir = createTempProject();

    // Write project-level config
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

    const origHome = process.env.HOME;
    process.env.HOME = tmpDir;
    t.after(() => { process.env.HOME = origHome; cleanup(tmpDir); });

    const config = loadConfig(tmpDir);
    // Project config wins
    assert.strictEqual(config.model_profile, 'budget');
    // defaults.json context_window NOT applied — project config path succeeded
    assert.strictEqual(config.context_window, 200000);
  });

  test('defaults.json with unknown keys → unknown keys NOT passed through', (t) => {
    const tmpDir = createTempProject();
    const configPath = path.join(tmpDir, '.planning', 'config.json');
    try { fs.unlinkSync(configPath); } catch { /* already absent */ }

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

    const origHome = process.env.HOME;
    process.env.HOME = tmpDir;
    t.after(() => { process.env.HOME = origHome; cleanup(tmpDir); });

    const config = loadConfig(tmpDir);
    assert.strictEqual(config.model_profile, 'quality');
    assert.strictEqual(config.unknown_key, undefined);
    assert.strictEqual(config.another_unknown, undefined);
  });

  test('defaults.json with invalid JSON → returns hardcoded defaults', (t) => {
    const tmpDir = createTempProject();
    const configPath = path.join(tmpDir, '.planning', 'config.json');
    try { fs.unlinkSync(configPath); } catch { /* already absent */ }

    const gsdDir = path.join(tmpDir, '.gsd');
    fs.mkdirSync(gsdDir, { recursive: true });
    fs.writeFileSync(path.join(gsdDir, 'defaults.json'), '{ not valid json !!!');

    const origHome = process.env.HOME;
    process.env.HOME = tmpDir;
    t.after(() => { process.env.HOME = origHome; cleanup(tmpDir); });

    const config = loadConfig(tmpDir);
    assert.strictEqual(config.model_profile, 'balanced');
    assert.strictEqual(config.context_window, 200000);
  });
});
