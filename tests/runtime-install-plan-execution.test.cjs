'use strict';

process.env.GSD_TEST_MODE = '1';

const { afterEach, describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  applyConfigMutations,
  createRuntimeInstallPlan,
  hasConfigMutation,
} = require('../bin/install.js');
const {
  CONFIG_MUTATION_ADAPTER_REGISTRY,
  copyBundledHooksArtifact,
  applyConfigMutations: applyExecutorConfigMutations,
  getConfigMutationHandler,
} = require('../get-shit-done/bin/lib/runtime-install-executor.cjs');

describe('Runtime install plan execution', () => {
  const tempDirs = [];
  function makeTempDir(prefix) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    tempDirs.push(tmp);
    return tmp;
  }

  afterEach(() => {
    for (const tmp of tempDirs.splice(0)) {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('settings-json mutation writes managed settings through the plan dispatcher', () => {
    const tmp = makeTempDir('gsd-runtime-plan-settings-');
    const settingsPath = path.join(tmp, 'settings.json');
    const plan = createRuntimeInstallPlan({ runtime: 'claude', scope: 'local', cwd: tmp });

    assert.equal(hasConfigMutation(plan, 'settings-json', 'ensure-managed-hooks'), true);

    applyConfigMutations(plan, {
      isGlobal: false,
      configDir: plan.targetDir,
      settingsPath,
      settings: { hooks: { SessionStart: [] } },
    });

    assert.deepStrictEqual(JSON.parse(fs.readFileSync(settingsPath, 'utf8')), {
      hooks: {},
    });
  });

  test('json permission mutations execute for runtimes without settings.json', () => {
    const tmp = makeTempDir('gsd-runtime-plan-opencode-');
    const plan = createRuntimeInstallPlan({ runtime: 'opencode', scope: 'local', cwd: tmp });

    assert.equal(plan.capabilities.settingsJson, false);
    assert.equal(hasConfigMutation(plan, 'opencode-json', 'ensure-permissions'), true);

    applyConfigMutations(plan, {
      isGlobal: false,
      configDir: plan.targetDir,
    });

    const config = JSON.parse(fs.readFileSync(path.join(plan.targetDir, 'opencode.json'), 'utf8'));
    const gsdPath = `${plan.targetDir.replace(/\\/g, '/')}/get-shit-done/*`;
    assert.equal(config.permission.read[gsdPath], 'allow');
    assert.equal(config.permission.external_directory[gsdPath], 'allow');
  });

  test('toml mutation intents dispatch through executor adapters', () => {
    const plan = createRuntimeInstallPlan({ runtime: 'codex', scope: 'global', explicitConfigDir: '/tmp/codex' });
    const calls = [];

    applyExecutorConfigMutations(plan, {
      isGlobal: true,
      configDir: plan.targetDir,
      adapters: {
        configureCodexToml(mutation, context) {
          calls.push({ operation: mutation.operation, configDir: context.configDir });
        },
      },
    });

    assert.deepStrictEqual(calls, [
      { operation: 'ensure-agent-profiles', configDir: '/tmp/codex' },
      { operation: 'ensure-managed-hook-block', configDir: '/tmp/codex' },
    ]);
  });

  test('config mutation adapter registry exposes every plan adapter operation', () => {
    const seen = new Set();

    for (const runtime of ['claude', 'opencode', 'kilo', 'codex', 'copilot', 'cline']) {
      const plan = createRuntimeInstallPlan({ runtime, scope: 'global', explicitConfigDir: `/tmp/${runtime}` });
      for (const mutation of plan.configMutations) {
        seen.add(`${mutation.adapter}:${mutation.operation}`);
        assert.equal(
          typeof getConfigMutationHandler(CONFIG_MUTATION_ADAPTER_REGISTRY, mutation),
          'function',
          `${mutation.adapter}:${mutation.operation} must have a registered executor handler`
        );
      }
    }

    assert.deepStrictEqual([...seen].sort(), [
      'cline-rules:ensure-runtime-rules',
      'codex-toml:ensure-agent-profiles',
      'codex-toml:ensure-managed-hook-block',
      'copilot-instructions:ensure-managed-instructions',
      'kilo-json:ensure-permissions',
      'opencode-json:ensure-permissions',
      'settings-json:ensure-managed-hooks',
    ]);
  });

  test('unregistered config mutation adapters fail fast', () => {
    assert.throws(() => {
      applyExecutorConfigMutations({
        targetDir: '/tmp/runtime',
        configMutations: [
          { adapter: 'unknown-json', operation: 'ensure-something' },
        ],
      });
    }, /No config mutation handler registered for adapter="unknown-json" operation="ensure-something"/);

    assert.throws(() => {
      applyExecutorConfigMutations({
        targetDir: '/tmp/runtime',
        configMutations: [
          { adapter: 'settings-json', operation: 'unknown-operation' },
        ],
      });
    }, /No config mutation handler registered for adapter="settings-json" operation="unknown-operation"/);
  });

  test('registered config mutation adapters require their executor functions', () => {
    const plan = createRuntimeInstallPlan({ runtime: 'copilot', scope: 'global', explicitConfigDir: '/tmp/copilot' });

    assert.throws(() => {
      applyExecutorConfigMutations(plan, {
        configDir: plan.targetDir,
        adapters: {},
      });
    }, /Missing required config mutation adapter "configureCopilotInstructions" for adapter="copilot-instructions" operation="ensure-managed-instructions"/);
  });

  test('every registry entry fails fast when its required adapter is missing', () => {
    const cases = [
      { runtime: 'claude',   adapter: 'settings-json',        operation: 'ensure-managed-hooks',         missing: 'writeSettings' },
      { runtime: 'opencode', adapter: 'opencode-json',        operation: 'ensure-permissions',           missing: 'configureOpencodePermissions' },
      { runtime: 'kilo',     adapter: 'kilo-json',            operation: 'ensure-permissions',           missing: 'configureKiloPermissions' },
      { runtime: 'codex',    adapter: 'codex-toml',           operation: 'ensure-agent-profiles',        missing: 'configureCodexToml' },
      { runtime: 'copilot',  adapter: 'copilot-instructions', operation: 'ensure-managed-instructions',  missing: 'configureCopilotInstructions' },
      { runtime: 'cline',    adapter: 'cline-rules',          operation: 'ensure-runtime-rules',         missing: 'configureClineRules' },
    ];

    for (const { runtime, adapter, operation, missing } of cases) {
      const expected = new RegExp(
        `Missing required config mutation adapter "${missing}" for adapter="${adapter}" operation="${operation}"`
      );
      assert.throws(() => {
        applyExecutorConfigMutations(
          { runtime, targetDir: `/tmp/${runtime}`, configMutations: [{ adapter, operation }] },
          { configDir: `/tmp/${runtime}`, adapters: {} }
        );
      }, expected, `${runtime}/${adapter}/${operation} should fail fast on missing ${missing}`);
    }
  });

  test('no-settings runtimes with no mutation intents are executor no-ops', () => {
    const tmp = makeTempDir('gsd-runtime-plan-trae-');
    const plan = createRuntimeInstallPlan({ runtime: 'trae', scope: 'local', cwd: tmp });

    assert.equal(plan.capabilities.settingsJson, false);
    assert.deepStrictEqual(plan.configMutations, []);

    applyExecutorConfigMutations(plan, {
      isGlobal: false,
      configDir: plan.targetDir,
      adapters: {
        writeSettings() {
          throw new Error('settings adapter should not run');
        },
      },
    });

    assert.equal(fs.existsSync(path.join(plan.targetDir, 'settings.json')), false);
  });

  test('bundled hook artifact copies runtime-templated hook files', () => {
    const tmp = makeTempDir('gsd-runtime-plan-hooks-');
    const packageSrc = path.join(tmp, 'pkg');
    const hooksDist = path.join(packageSrc, 'hooks', 'dist');
    fs.mkdirSync(hooksDist, { recursive: true });
    fs.writeFileSync(
      path.join(hooksDist, 'gsd-check-update.js'),
      "const config = '.claude'; // {{GSD_VERSION}}\n// ~/.claude/path\n"
    );
    fs.writeFileSync(path.join(hooksDist, 'gsd-session-state.sh'), '# {{GSD_VERSION}}\n');
    fs.writeFileSync(path.join(hooksDist, 'note.txt'), 'plain\n');

    const plan = createRuntimeInstallPlan({ runtime: 'qwen', scope: 'local', cwd: tmp });
    const result = copyBundledHooksArtifact(plan, {
      packageSrc,
      version: '1.2.3',
      warn: () => {},
    });

    assert.deepStrictEqual(result.failures, []);
    assert.equal(fs.readFileSync(path.join(plan.targetDir, 'package.json'), 'utf8'), '{"type":"commonjs"}\n');
    const js = fs.readFileSync(path.join(plan.targetDir, 'hooks', 'gsd-check-update.js'), 'utf8');
    assert.match(js, /'\.qwen'/);
    assert.match(js, /~\/\.qwen\/path/);
    assert.match(js, /1\.2\.3/);
    assert.equal(fs.readFileSync(path.join(plan.targetDir, 'hooks', 'note.txt'), 'utf8'), 'plain\n');
  });
});
