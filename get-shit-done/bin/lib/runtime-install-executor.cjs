'use strict';

/**
 * Runtime Install Executor Module
 *
 * Executes selected runtime install plan intents. The Runtime Install Policy
 * Module owns the pure plan projection; this module owns plan-driven dispatch
 * for concrete artifact/config actions that can be shared by installer callers.
 */

const fs = require('fs');
const path = require('path');

const runtimeInstallPolicy = require('./runtime-install-policy.cjs');

const CONFIG_MUTATION_ADAPTER_REGISTRY = Object.freeze({
  'settings-json': Object.freeze({
    'ensure-managed-hooks': ({ context, adapters }) => {
      if (context.settingsPath && context.settings && adapters.writeSettings && adapters.validateHookFields) {
        adapters.writeSettings(context.settingsPath, adapters.validateHookFields(context.settings));
      }
    },
  }),
  'opencode-json': Object.freeze({
    'ensure-permissions': ({ context, adapters, configDir }) => {
      if (adapters.configureOpencodePermissions) {
        adapters.configureOpencodePermissions(context.isGlobal, configDir);
      }
    },
  }),
  'kilo-json': Object.freeze({
    'ensure-permissions': ({ context, adapters, configDir }) => {
      if (adapters.configureKiloPermissions) {
        adapters.configureKiloPermissions(context.isGlobal, configDir);
      }
    },
  }),
  'codex-toml': Object.freeze({
    'ensure-agent-profiles': ({ mutation, context, adapters, configDir }) => {
      if (adapters.configureCodexToml) adapters.configureCodexToml(mutation, { ...context, configDir });
    },
    'ensure-managed-hook-block': ({ mutation, context, adapters, configDir }) => {
      if (adapters.configureCodexToml) adapters.configureCodexToml(mutation, { ...context, configDir });
    },
  }),
  'copilot-instructions': Object.freeze({
    'ensure-managed-instructions': ({ mutation, context, adapters, configDir }) => {
      if (adapters.configureCopilotInstructions) adapters.configureCopilotInstructions(mutation, { ...context, configDir });
    },
  }),
  'cline-rules': Object.freeze({
    'ensure-runtime-rules': ({ mutation, context, adapters, configDir }) => {
      if (adapters.configureClineRules) adapters.configureClineRules(mutation, { ...context, configDir });
    },
  }),
});

function hasConfigMutation(plan, adapter, operation = null) {
  return !!(plan && Array.isArray(plan.configMutations) && plan.configMutations.some((mutation) =>
    mutation.adapter === adapter && (operation === null || mutation.operation === operation)
  ));
}

function getConfigMutationHandler(registry, mutation) {
  if (!registry || !mutation) return null;
  const adapterRegistry = registry[mutation.adapter];
  if (!adapterRegistry) return null;
  return adapterRegistry[mutation.operation] || adapterRegistry['*'] || null;
}

function applyConfigMutations(plan, context = {}) {
  if (!plan || !Array.isArray(plan.configMutations)) return;
  const adapters = context.adapters || {};
  const configDir = context.configDir || plan.targetDir;
  const registry = context.configMutationAdapterRegistry || CONFIG_MUTATION_ADAPTER_REGISTRY;

  for (const mutation of plan.configMutations) {
    const handler = getConfigMutationHandler(registry, mutation);
    if (!handler) continue;
    handler({ mutation, context, adapters, configDir });
  }
}

function shouldCopyBundledHooks(plan, opts = {}) {
  if (!plan || !plan.capabilities || !plan.capabilities.hooks) return false;
  if (plan.capabilities.toml && !opts.allowTomlHooks) return false;
  return Array.isArray(plan.artifacts) && plan.artifacts.some((artifact) => artifact.kind === 'hooks');
}

function copyRuntimeHookFile(srcFile, destFile, entry, replacements) {
  if (entry.endsWith('.js')) {
    let content = fs.readFileSync(srcFile, 'utf8');
    content = content.replace(/'\.claude'/g, replacements.configDirReplacement);
    content = content.replace(/\/\.claude\//g, `/${replacements.localDir}/`);
    content = content.replace(/\.claude\//g, `${replacements.localDir}/`);
    if (replacements.runtime === 'qwen') {
      content = content.replace(/CLAUDE\.md/g, 'QWEN.md');
      content = content.replace(/\bClaude Code\b/g, 'Qwen Code');
    }
    if (replacements.runtime === 'hermes') {
      content = content.replace(/CLAUDE\.md/g, 'HERMES.md');
      content = content.replace(/\bClaude Code\b/g, 'Hermes Agent');
    }
    content = content.replace(/\{\{GSD_VERSION\}\}/g, replacements.version);
    fs.writeFileSync(destFile, content);
    try { fs.chmodSync(destFile, 0o755); } catch (_) { /* Windows doesn't support chmod */ }
    return;
  }

  if (entry.endsWith('.sh')) {
    let content = fs.readFileSync(srcFile, 'utf8');
    content = content.replace(/\{\{GSD_VERSION\}\}/g, replacements.version);
    fs.writeFileSync(destFile, content);
    try { fs.chmodSync(destFile, 0o755); } catch (_) { /* Windows doesn't support chmod */ }
    return;
  }

  fs.copyFileSync(srcFile, destFile);
}

function copyBundledHooksArtifact(plan, context = {}) {
  if (!shouldCopyBundledHooks(plan, context)) {
    return { skipped: true, failures: [] };
  }

  const failures = [];
  const targetDir = context.targetDir || plan.targetDir;
  const packageSrc = context.packageSrc;
  if (!packageSrc) {
    throw new Error('copyBundledHooksArtifact requires packageSrc');
  }
  fs.mkdirSync(targetDir, { recursive: true });

  const log = context.log || (() => {});
  const warn = context.warn || (() => {});
  const colors = context.colors || {};
  const green = colors.green || '';
  const yellow = colors.yellow || '';
  const reset = colors.reset || '';

  if (context.writeCommonJsPackageJson !== false) {
    const pkgJsonDest = path.join(targetDir, 'package.json');
    fs.writeFileSync(pkgJsonDest, '{"type":"commonjs"}\n');
    log(`  ${green}✓${reset} Wrote package.json (CommonJS mode)`);
  }

  const hooksSrc = path.join(packageSrc, 'hooks', 'dist');
  if (!fs.existsSync(hooksSrc)) {
    return { skipped: false, missingSource: true, failures };
  }

  const hooksDest = path.join(targetDir, 'hooks');
  fs.mkdirSync(hooksDest, { recursive: true });
  const configDirReplacement = runtimeInstallPolicy.getConfigDirFromHome(plan.runtime, plan.scope === 'global');
  const replacements = {
    runtime: plan.runtime,
    localDir: plan.localDir,
    configDirReplacement,
    version: context.version || '',
  };

  for (const entry of fs.readdirSync(hooksSrc)) {
    const srcFile = path.join(hooksSrc, entry);
    if (!fs.statSync(srcFile).isFile()) continue;
    copyRuntimeHookFile(srcFile, path.join(hooksDest, entry), entry, replacements);
  }

  if (context.verifyInstalled && !context.verifyInstalled(hooksDest, 'hooks')) {
    failures.push('hooks');
  } else {
    log(`  ${green}✓${reset} Installed hooks${context.bundledLabel === false ? '' : ' (bundled)'}`);
    const expectedShHooks = ['gsd-session-state.sh', 'gsd-validate-commit.sh', 'gsd-phase-boundary.sh'];
    for (const sh of expectedShHooks) {
      if (!fs.existsSync(path.join(hooksDest, sh))) {
        warn(`  ${yellow}⚠${reset}  Missing expected hook: ${sh}`);
      }
    }
  }

  return { skipped: false, hooksDest, failures };
}

module.exports = {
  CONFIG_MUTATION_ADAPTER_REGISTRY,
  hasConfigMutation,
  getConfigMutationHandler,
  applyConfigMutations,
  shouldCopyBundledHooks,
  copyBundledHooksArtifact,
};
