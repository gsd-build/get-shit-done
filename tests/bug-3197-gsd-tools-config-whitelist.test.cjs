'use strict';

/**
 * Regression test for #3197 — gsd-tools config-set rejects workflow._auto_chain_active.
 *
 * Root cause: RUNTIME_STATE_KEYS was added to sdk/src/query/config-schema.ts in #3162
 * but not to get-shit-done/bin/lib/config-schema.cjs, so gsd-tools.cjs users still hit
 * "Unknown config key" when setting workflow._auto_chain_active.
 */

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createTempProject, cleanup, runGsdTools } = require('./helpers.cjs');

describe('#3197 — gsd-tools.cjs config-set workflow._auto_chain_active', () => {
  test('config-set workflow._auto_chain_active true succeeds via gsd-tools.cjs (CJS path)', (t) => {
    const tmpDir = createTempProject();
    t.after(() => cleanup(tmpDir));

    const result = runGsdTools(['config-set', 'workflow._auto_chain_active', 'true'], tmpDir);
    assert.ok(
      result.success,
      `config-set workflow._auto_chain_active true should succeed, got:\nstdout: ${result.output}\nstderr: ${result.error}`
    );
  });

  test('config-set workflow._auto_chain_active true writes value to config.json', (t) => {
    const tmpDir = createTempProject();
    t.after(() => cleanup(tmpDir));

    runGsdTools(['config-set', 'workflow._auto_chain_active', 'true'], tmpDir);

    const configPath = path.join(tmpDir, '.planning', 'config.json');
    assert.ok(fs.existsSync(configPath), '.planning/config.json must exist after config-set');

    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    assert.ok(
      config.workflow !== undefined && config.workflow._auto_chain_active === true,
      `Expected workflow._auto_chain_active: true in config.json, got: ${JSON.stringify(config)}`
    );
  });

  test('config-set workflow._auto_chain_active false writes false to config.json', (t) => {
    const tmpDir = createTempProject();
    t.after(() => cleanup(tmpDir));

    runGsdTools(['config-set', 'workflow._auto_chain_active', 'false'], tmpDir);

    const configPath = path.join(tmpDir, '.planning', 'config.json');
    assert.ok(fs.existsSync(configPath), '.planning/config.json must exist after config-set');

    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    assert.ok(
      config.workflow !== undefined && config.workflow._auto_chain_active === false,
      `Expected workflow._auto_chain_active: false in config.json, got: ${JSON.stringify(config)}`
    );
  });
});
