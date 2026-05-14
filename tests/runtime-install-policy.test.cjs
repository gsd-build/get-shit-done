'use strict';

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const {
  RUNTIME_REGISTRY,
  allRuntimes,
  runtimeMap,
  getDirName,
  getConfigDirFromHome,
  getGlobalDir,
  parseRuntimeInput,
  createRuntimeInstallPlan,
  prefixReplace,
} = require('../get-shit-done/bin/lib/runtime-install-policy.cjs');

const SHARED_RUNTIME_INSTALL_POLICY = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'sdk', 'shared', 'runtime-install-policy.json'),
  'utf8'
));

const RUNTIME_ENV_KEYS = [
  'CLAUDE_CONFIG_DIR',
  'ANTIGRAVITY_CONFIG_DIR',
  'AUGMENT_CONFIG_DIR',
  'CLINE_CONFIG_DIR',
  'CODEBUDDY_CONFIG_DIR',
  'CODEX_HOME',
  'COPILOT_CONFIG_DIR',
  'CURSOR_CONFIG_DIR',
  'GEMINI_CONFIG_DIR',
  'HERMES_HOME',
  'KILO_CONFIG_DIR',
  'KILO_CONFIG',
  'OPENCODE_CONFIG_DIR',
  'OPENCODE_CONFIG',
  'QWEN_CONFIG_DIR',
  'TRAE_CONFIG_DIR',
  'WINDSURF_CONFIG_DIR',
  'XDG_CONFIG_HOME',
];

describe('Runtime Install Policy Module', () => {
  const saved = {};

  beforeEach(() => {
    for (const key of RUNTIME_ENV_KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of RUNTIME_ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  test('registry owns every interactive runtime option', () => {
    assert.deepStrictEqual(parseRuntimeInput(SHARED_RUNTIME_INSTALL_POLICY.allRuntimesOption), allRuntimes);
  });

  test('CJS runtime registry projects the shared runtime install policy without drift', () => {
    assert.deepStrictEqual(RUNTIME_REGISTRY, SHARED_RUNTIME_INSTALL_POLICY.runtimes);
    assert.equal(parseRuntimeInput(SHARED_RUNTIME_INSTALL_POLICY.allRuntimesOption).length, allRuntimes.length);
  });

  test('interactive option map is generated from shared runtime options', () => {
    const expectedRuntimeMap = Object.fromEntries(
      Object.entries(SHARED_RUNTIME_INSTALL_POLICY.runtimes).map(([runtime, policy]) => [policy.option, runtime])
    );
    const expectedAllRuntimes = Object.entries(SHARED_RUNTIME_INSTALL_POLICY.runtimes)
      .sort((a, b) => Number(a[1].option) - Number(b[1].option))
      .map(([runtime]) => runtime);

    assert.deepStrictEqual(runtimeMap, expectedRuntimeMap);
    assert.deepStrictEqual(allRuntimes, expectedAllRuntimes);
  });

  test('local dir and config-dir fragments come from registry facts', () => {
    for (const runtime of allRuntimes) {
      const policy = RUNTIME_REGISTRY[runtime];
      assert.equal(getDirName(runtime), policy.localDir, `${runtime} local dir`);
      assert.equal(getConfigDirFromHome(runtime, false), `'${policy.localDir}'`, `${runtime} local fragment`);
      assert.equal(getConfigDirFromHome(runtime, true), policy.configDirFromHomeGlobal.join(', '), `${runtime} global fragment`);
    }
  });

  test('prefixReplace only swaps an anchored prefix once', () => {
    // Duplicate prefix inside the value is left intact after the leading swap.
    assert.equal(prefixReplace('/Users/x/p/Users/x/y', '/Users/x', '~'), '~/p/Users/x/y');
    // Prefix occurring later in the string but not at position 0 is untouched.
    assert.equal(prefixReplace('/var/Users/x/p', '/Users/x', '~'), '/var/Users/x/p');
    // Falsy prefix is a no-op.
    assert.equal(prefixReplace('/Users/x/p', '', '~'), '/Users/x/p');
  });

  test('unknown runtimes fail loudly', () => {
    assert.throws(
      () => createRuntimeInstallPlan({ runtime: 'bogus' }),
      /Unknown runtime: bogus/
    );
  });

  test('global target policy honors explicit dirs before env and defaults', () => {
    assert.equal(getGlobalDir('codex', '/explicit/codex'), '/explicit/codex');
    process.env.CODEX_HOME = '/env/codex';
    assert.equal(getGlobalDir('codex'), '/env/codex');
    delete process.env.CODEX_HOME;
    assert.equal(getGlobalDir('codex'), path.join(os.homedir(), '.codex'));
  });

  test('XDG runtimes honor direct config, file config dirname, XDG, then fallback', () => {
    process.env.OPENCODE_CONFIG_DIR = '/direct/opencode';
    assert.equal(getGlobalDir('opencode'), '/direct/opencode');
    delete process.env.OPENCODE_CONFIG_DIR;

    process.env.OPENCODE_CONFIG = '/file/opencode/opencode.jsonc';
    assert.equal(getGlobalDir('opencode'), '/file/opencode');
    delete process.env.OPENCODE_CONFIG;

    process.env.XDG_CONFIG_HOME = '/xdg';
    assert.equal(getGlobalDir('opencode'), path.join('/xdg', 'opencode'));
    delete process.env.XDG_CONFIG_HOME;

    assert.equal(getGlobalDir('opencode'), path.join(os.homedir(), '.config', 'opencode'));
  });

  test('global install plan includes target, artifacts, capabilities, and config mutation intents', () => {
    const plan = createRuntimeInstallPlan({
      runtime: 'codex',
      scope: 'global',
      explicitConfigDir: '/tmp/codex-home',
      installMode: 'minimal',
    });

    assert.equal(plan.runtime, 'codex');
    assert.equal(plan.label, 'Codex');
    assert.equal(plan.targetDir, '/tmp/codex-home');
    assert.equal(plan.skillsBase, path.join('/tmp/codex-home', 'skills'));
    assert.equal(plan.capabilities.toml, true);
    assert.ok(plan.artifacts.some((artifact) => artifact.kind === 'skills' && artifact.installMode === 'minimal'));
    assert.ok(plan.artifacts.some((artifact) => artifact.kind === 'hooks'));
    assert.deepStrictEqual(
      plan.configMutations.map((mutation) => mutation.operation),
      ['ensure-agent-profiles', 'ensure-managed-hook-block']
    );
  });

  test('special skills layouts are represented in the install plan', () => {
    const hermes = createRuntimeInstallPlan({ runtime: 'hermes', scope: 'global', explicitConfigDir: '/tmp/hermes' });
    assert.equal(hermes.skillsLayout, 'hermes-nested');
    assert.equal(hermes.skillsBase, path.join('/tmp/hermes', 'skills', 'gsd'));

    const cline = createRuntimeInstallPlan({ runtime: 'cline', scope: 'local', cwd: '/repo' });
    assert.equal(cline.targetDir, '/repo');
    assert.equal(cline.skillsLayout, 'none');
    assert.equal(cline.skillsBase, null);
    assert.ok(cline.artifacts.some((artifact) => artifact.kind === 'rules-file'));
    assert.deepStrictEqual(cline.configMutations.map((mutation) => mutation.adapter), ['cline-rules']);
  });
});
