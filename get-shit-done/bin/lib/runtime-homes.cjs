'use strict';

/**
 * runtime-homes.cjs — Runtime Install Materialization Module.
 *
 * Single source of truth for resolving runtime install metadata, the global
 * config base directory, and the correct global skills directory for every
 * GSD-supported runtime.
 *
 * This is a pure, side-effect-free module safe to require() at any point
 * without triggering the installer.
 *
 * Runtime-specific notes:
 *   hermes  — GSD skills nest under skills/gsd/<skillName>/ (not the flat
 *             skills/<skillName>/ layout used by all other runtimes). This
 *             collapses 86 skill entries into one category in Hermes' system
 *             prompt (#2841).
 *   cline   — Rules-based; commands are embedded in .clinerules. Cline does
 *             not use a skills/ directory. getGlobalSkillDir() returns null
 *             for cline so the caller can emit an appropriate warning.
 */

const os = require('os');
const path = require('path');

const DEFAULT_RUNTIME = 'claude';

function deepFreeze(value) {
  if (!value || typeof value !== 'object') return value;

  for (const nested of Object.values(value)) {
    deepFreeze(nested);
  }

  if (Object.isFrozen(value)) return value;
  return Object.freeze(value);
}

const RUNTIME_INSTALL_ADAPTERS = deepFreeze({
  claude: Object.freeze({
    runtime: 'claude',
    label: 'Claude Code',
    localDirName: '.claude',
    globalHomeSegments: ['.claude'],
    configEnvVar: 'CLAUDE_CONFIG_DIR',
    skillsLayout: 'flat',
    ownedCleanupDirs: ['commands', 'agents', 'hooks', 'skills', 'get-shit-done'],
  }),
  opencode: Object.freeze({
    runtime: 'opencode',
    label: 'OpenCode',
    localDirName: '.opencode',
    globalHomeSegments: ['.config', 'opencode'],
    configEnvVar: 'OPENCODE_CONFIG_DIR',
    configFileEnvVar: 'OPENCODE_CONFIG',
    xdgConfigDirName: 'opencode',
    skillsLayout: 'flat',
    ownedCleanupDirs: ['commands', 'agents', 'hooks', 'skills', 'get-shit-done'],
  }),
  gemini: Object.freeze({
    runtime: 'gemini',
    label: 'Gemini CLI',
    localDirName: '.gemini',
    globalHomeSegments: ['.gemini'],
    configEnvVar: 'GEMINI_CONFIG_DIR',
    skillsLayout: 'flat',
    ownedCleanupDirs: ['commands', 'agents', 'hooks', 'skills', 'get-shit-done'],
  }),
  kilo: Object.freeze({
    runtime: 'kilo',
    label: 'Kilo',
    localDirName: '.kilo',
    globalHomeSegments: ['.config', 'kilo'],
    configEnvVar: 'KILO_CONFIG_DIR',
    configFileEnvVar: 'KILO_CONFIG',
    xdgConfigDirName: 'kilo',
    skillsLayout: 'flat',
    ownedCleanupDirs: ['commands', 'agents', 'hooks', 'skills', 'get-shit-done'],
  }),
  codex: Object.freeze({
    runtime: 'codex',
    label: 'Codex',
    localDirName: '.codex',
    globalHomeSegments: ['.codex'],
    configEnvVar: 'CODEX_HOME',
    skillsLayout: 'flat',
    ownedCleanupDirs: ['agents', 'hooks', 'skills', 'get-shit-done'],
  }),
  copilot: Object.freeze({
    runtime: 'copilot',
    label: 'Copilot',
    localDirName: '.github',
    globalHomeSegments: ['.copilot'],
    configEnvVar: 'COPILOT_CONFIG_DIR',
    skillsLayout: 'flat',
    ownedCleanupDirs: ['instructions', 'prompts', 'skills', 'get-shit-done'],
  }),
  antigravity: Object.freeze({
    runtime: 'antigravity',
    label: 'Antigravity',
    localDirName: '.agent',
    globalHomeSegments: ['.gemini', 'antigravity'],
    configEnvVar: 'ANTIGRAVITY_CONFIG_DIR',
    skillsLayout: 'flat',
    ownedCleanupDirs: ['agents', 'commands', 'hooks', 'skills', 'get-shit-done'],
  }),
  cursor: Object.freeze({
    runtime: 'cursor',
    label: 'Cursor',
    localDirName: '.cursor',
    globalHomeSegments: ['.cursor'],
    configEnvVar: 'CURSOR_CONFIG_DIR',
    skillsLayout: 'flat',
    ownedCleanupDirs: ['commands', 'agents', 'hooks', 'skills', 'get-shit-done'],
  }),
  windsurf: Object.freeze({
    runtime: 'windsurf',
    label: 'Windsurf',
    localDirName: '.windsurf',
    globalHomeSegments: ['.codeium', 'windsurf'],
    configEnvVar: 'WINDSURF_CONFIG_DIR',
    skillsLayout: 'flat',
    ownedCleanupDirs: ['commands', 'agents', 'hooks', 'skills', 'get-shit-done'],
  }),
  augment: Object.freeze({
    runtime: 'augment',
    label: 'Augment',
    localDirName: '.augment',
    globalHomeSegments: ['.augment'],
    configEnvVar: 'AUGMENT_CONFIG_DIR',
    skillsLayout: 'flat',
    ownedCleanupDirs: ['commands', 'agents', 'hooks', 'skills', 'get-shit-done'],
  }),
  trae: Object.freeze({
    runtime: 'trae',
    label: 'Trae',
    localDirName: '.trae',
    globalHomeSegments: ['.trae'],
    configEnvVar: 'TRAE_CONFIG_DIR',
    skillsLayout: 'flat',
    ownedCleanupDirs: ['commands', 'agents', 'hooks', 'skills', 'get-shit-done'],
  }),
  qwen: Object.freeze({
    runtime: 'qwen',
    label: 'Qwen Code',
    localDirName: '.qwen',
    globalHomeSegments: ['.qwen'],
    configEnvVar: 'QWEN_CONFIG_DIR',
    skillsLayout: 'flat',
    ownedCleanupDirs: ['commands', 'agents', 'hooks', 'skills', 'get-shit-done'],
  }),
  hermes: Object.freeze({
    runtime: 'hermes',
    label: 'Hermes Agent',
    localDirName: '.hermes',
    globalHomeSegments: ['.hermes'],
    configEnvVar: 'HERMES_HOME',
    skillsLayout: 'category',
    skillCategory: 'gsd',
    ownedCleanupDirs: ['agents', 'hooks', 'skills/gsd', 'get-shit-done'],
  }),
  codebuddy: Object.freeze({
    runtime: 'codebuddy',
    label: 'CodeBuddy',
    localDirName: '.codebuddy',
    globalHomeSegments: ['.codebuddy'],
    configEnvVar: 'CODEBUDDY_CONFIG_DIR',
    skillsLayout: 'flat',
    ownedCleanupDirs: ['commands', 'agents', 'hooks', 'skills', 'get-shit-done'],
  }),
  cline: Object.freeze({
    runtime: 'cline',
    label: 'Cline',
    localDirName: '.cline',
    globalHomeSegments: ['.cline'],
    configEnvVar: 'CLINE_CONFIG_DIR',
    skillsLayout: 'none',
    ownedCleanupDirs: ['get-shit-done'],
  }),
});

/**
 * Expand a leading ~ to os.homedir().
 * @param {string} p
 * @returns {string}
 */
function expandTilde(p) {
  if (!p) return p;
  if (p.startsWith('~/') || p === '~') return path.join(os.homedir(), p.slice(1));
  return p;
}

function getRuntimeInstallAdapter(runtime) {
  if (runtime == null || runtime === '') {
    return RUNTIME_INSTALL_ADAPTERS[DEFAULT_RUNTIME];
  }

  const adapter = RUNTIME_INSTALL_ADAPTERS[runtime];
  if (!adapter) {
    throw new Error(`Unsupported runtime: ${runtime}`);
  }

  return adapter;
}

function getRuntimeLocalDirName(runtime) {
  return getRuntimeInstallAdapter(runtime).localDirName;
}

function getConfigDirFromHome(runtime, isGlobal) {
  const adapter = getRuntimeInstallAdapter(runtime);
  const segments = isGlobal ? adapter.globalHomeSegments : [adapter.localDirName];
  return segments.map((segment) => `'${segment}'`).join(', ');
}

/**
 * Return the global config base directory for the given runtime.
 * Respects the same env-var overrides as bin/install.js getGlobalDir().
 *
 * @param {string} runtime
 * @returns {string} Absolute path to the runtime's global config directory
 */
function getGlobalConfigDir(runtime) {
  return getGlobalConfigDirForInstall(runtime, null);
}

function getGlobalConfigDirForInstall(runtime, explicitDir = null) {
  if (explicitDir) return expandTilde(explicitDir);

  const home = os.homedir();
  const env = process.env;
  const adapter = getRuntimeInstallAdapter(runtime);

  if (adapter.configEnvVar && env[adapter.configEnvVar]) {
    return expandTilde(env[adapter.configEnvVar]);
  }

  if (adapter.configFileEnvVar && env[adapter.configFileEnvVar]) {
    return path.dirname(expandTilde(env[adapter.configFileEnvVar]));
  }

  if (adapter.xdgConfigDirName && env.XDG_CONFIG_HOME) {
    return path.join(expandTilde(env.XDG_CONFIG_HOME), adapter.xdgConfigDirName);
  }

  return path.join(home, ...adapter.globalHomeSegments);
}

/**
 * Return the global skills base directory for the given runtime.
 * Most runtimes: <configDir>/skills
 * Hermes: <configDir>/skills/gsd  (nested category layout — #2841)
 * Cline:  null (rules-based, no skills directory)
 *
 * @param {string} runtime
 * @returns {string|null}
 */
function getGlobalSkillsBase(runtime) {
  const adapter = getRuntimeInstallAdapter(runtime);
  if (adapter.skillsLayout === 'none') return null;
  const configDir = getGlobalConfigDir(runtime);
  if (adapter.skillsLayout === 'category') return path.join(configDir, 'skills', adapter.skillCategory);
  return path.join(configDir, 'skills');
}

/**
 * Return the full path to a specific skill's directory for the given runtime.
 * Returns null for runtimes that don't use a skills directory (cline).
 *
 * @param {string} runtime
 * @param {string} skillName - e.g. 'gsd-executor'
 * @returns {string|null}
 */
function getGlobalSkillDir(runtime, skillName) {
  const base = getGlobalSkillsBase(runtime);
  if (base === null) return null;
  return path.join(base, skillName);
}

/**
 * Return a human-readable display path for a global skill (for log messages).
 *
 * @param {string} runtime
 * @param {string} skillName
 * @returns {string}
 */
function getGlobalSkillDisplayPath(runtime, skillName) {
  const dir = getGlobalSkillDir(runtime, skillName);
  if (!dir) return `(${runtime} does not use a skills directory)`;
  // Replace homedir prefix with ~ for readability
  const home = os.homedir();
  return dir.startsWith(home) ? '~' + dir.slice(home.length) : dir;
}

module.exports = {
  RUNTIME_INSTALL_ADAPTERS,
  getRuntimeInstallAdapter,
  getRuntimeLocalDirName,
  getConfigDirFromHome,
  getGlobalConfigDir,
  getGlobalConfigDirForInstall,
  getGlobalSkillsBase,
  getGlobalSkillDir,
  getGlobalSkillDisplayPath,
};
