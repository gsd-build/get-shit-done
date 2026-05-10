'use strict';

/**
 * Runtime Install Policy Module
 *
 * Owns pure runtime install plan projection. Installers execute these plans;
 * they do not re-own runtime registry facts, target directory policy, skills
 * layout, capabilities, or config mutation intent selection.
 */

const os = require('os');
const path = require('path');

const cyan = '\x1b[36m';
const yellow = '\x1b[33m';
const dim = '\x1b[2m';
const reset = '\x1b[0m';

function expandTilde(p, homeDir = os.homedir()) {
  if (!p) return p;
  if (p === '~') return homeDir;
  if (p.startsWith('~/')) return path.join(homeDir, p.slice(1));
  return p;
}

const _policyCandidates = [
  path.resolve(__dirname, '..', 'shared', 'runtime-install-policy.json'),
  path.resolve(__dirname, '..', '..', '..', 'sdk', 'shared', 'runtime-install-policy.json'),
  process.env.GSD_RUNTIME_INSTALL_POLICY ? path.resolve(process.env.GSD_RUNTIME_INSTALL_POLICY) : null,
].filter(Boolean);

let runtimeInstallPolicyData = null;
let _policyLastErr = null;
for (const _p of _policyCandidates) {
  try {
    runtimeInstallPolicyData = require(_p);
    break;
  } catch (e) {
    const isMissingCandidate =
      (e && e.code === 'MODULE_NOT_FOUND' && String(e.message || '').includes(_p)) ||
      (e && e.code === 'ENOENT');
    if (!isMissingCandidate) throw e;
    _policyLastErr = e;
  }
}
if (!runtimeInstallPolicyData) {
  throw new Error(
    `runtime-install-policy.json not found. Tried:\n${_policyCandidates.map((p) => `  ${p}`).join('\n')}\nLast error: ${_policyLastErr?.message}`
  );
}

const RUNTIME_REGISTRY = Object.freeze(runtimeInstallPolicyData.runtimes);
const ALL_RUNTIMES_OPTION = runtimeInstallPolicyData.allRuntimesOption || '16';

const runtimeMap = Object.freeze(Object.fromEntries(
  Object.entries(RUNTIME_REGISTRY).map(([runtime, entry]) => [entry.option, runtime])
));

const allRuntimes = Object.freeze(Object.entries(RUNTIME_REGISTRY)
  .sort((a, b) => Number(a[1].option) - Number(b[1].option))
  .map(([runtime]) => runtime));

function getRuntimePolicy(runtime) {
  return RUNTIME_REGISTRY[runtime] || RUNTIME_REGISTRY.claude;
}

function getDirName(runtime) {
  return getRuntimePolicy(runtime).localDir;
}

function getConfigDirFromHome(runtime, isGlobal) {
  const policy = getRuntimePolicy(runtime);
  if (!isGlobal) return `'${policy.localDir}'`;
  return policy.configDirFromHomeGlobal.join(', ');
}

function getGlobalDir(runtime, explicitDir = null, opts = {}) {
  const policy = getRuntimePolicy(runtime);
  const env = opts.env || process.env;
  const homeDir = opts.homeDir || os.homedir();
  if (explicitDir) return expandTilde(explicitDir, homeDir);
  if (policy.global.env && env[policy.global.env]) return expandTilde(env[policy.global.env], homeDir);
  if (policy.global.fileEnv && env[policy.global.fileEnv]) return path.dirname(expandTilde(env[policy.global.fileEnv], homeDir));
  if (policy.global.xdgName && env.XDG_CONFIG_HOME) return path.join(expandTilde(env.XDG_CONFIG_HOME, homeDir), policy.global.xdgName);
  return path.join(homeDir, ...policy.global.fallback);
}

function buildRuntimePromptText() {
  const lines = allRuntimes.map((runtime) => {
    const policy = getRuntimePolicy(runtime);
    const option = String(policy.option).padEnd(2, ' ');
    const label = policy.label.padEnd(runtime === 'hermes' ? 12 : 11, ' ');
    return `  ${cyan}${option.trim()}${reset}) ${label} ${dim}(${policy.promptPath})${reset}`;
  });

  return `  ${yellow}Which runtime(s) would you like to install for?${reset}\n\n${lines.join('\n')}\n  ${cyan}${ALL_RUNTIMES_OPTION}${reset}) All\n\n  ${dim}Select multiple: 1,2,6 or 1 2 6${reset}\n`;
}

function parseRuntimeInput(answer) {
  const input = (answer == null ? '' : String(answer)).trim() || '1';
  const choices = input.split(/[\s,]+/).filter(Boolean);
  if (choices.includes(ALL_RUNTIMES_OPTION)) return allRuntimes.slice();
  const selected = [];
  for (const choice of choices) {
    const runtime = runtimeMap[choice];
    if (runtime && !selected.includes(runtime)) selected.push(runtime);
  }
  return selected.length > 0 ? selected : ['claude'];
}

function createRuntimeInstallPlan(options = {}) {
  const runtime = options.runtime || 'claude';
  const policy = getRuntimePolicy(runtime);
  const scope = options.scope || (options.isGlobal ? 'global' : 'local');
  const cwd = options.cwd || process.cwd();
  const targetDir = scope === 'global'
    ? getGlobalDir(runtime, options.explicitConfigDir || null, options)
    : policy.localTarget === 'project-root'
      ? cwd
      : path.join(cwd, policy.localDir);
  const skillsBase = policy.skillsLayout === 'none'
    ? null
    : policy.skillsLayout === 'hermes-nested'
      ? path.join(targetDir, 'skills', 'gsd')
      : path.join(targetDir, 'skills');

  const directories = [
    targetDir,
    path.join(targetDir, 'get-shit-done'),
    policy.capabilities.agents ? path.join(targetDir, 'agents') : null,
    skillsBase,
    policy.capabilities.hooks ? path.join(targetDir, 'hooks') : null,
  ].filter(Boolean);

  const artifacts = [
    { kind: 'engine', target: path.join(targetDir, 'get-shit-done') },
    policy.capabilities.agents ? { kind: 'agents', target: path.join(targetDir, 'agents') } : null,
    skillsBase ? { kind: 'skills', target: skillsBase, layout: policy.skillsLayout, installMode: options.installMode || 'full' } : null,
    policy.capabilities.hooks ? { kind: 'hooks', target: path.join(targetDir, 'hooks') } : null,
    policy.capabilities.rulesFile ? { kind: 'rules-file', target: path.join(targetDir, '.clinerules') } : null,
  ].filter(Boolean);

  return {
    runtime,
    label: policy.label,
    scope,
    targetDir,
    localDir: policy.localDir,
    locationLabel: scope === 'global'
      ? targetDir.replace(options.homeDir || os.homedir(), '~')
      : targetDir.replace(cwd, '.'),
    firstRunCommand: policy.firstRunCommand,
    skillsLayout: policy.skillsLayout,
    skillsBase,
    capabilities: { ...policy.capabilities },
    directories,
    artifacts,
    configMutations: policy.configMutations.map((mutation) => ({ ...mutation })),
    warnings: [],
  };
}

module.exports = {
  RUNTIME_REGISTRY,
  runtimeMap,
  allRuntimes,
  ALL_RUNTIMES_OPTION,
  getRuntimePolicy,
  getDirName,
  getConfigDirFromHome,
  getGlobalDir,
  buildRuntimePromptText,
  parseRuntimeInput,
  createRuntimeInstallPlan,
  expandTilde,
};
