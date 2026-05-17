'use strict';

/**
 * Runtime artifact layout module — resolves the artifact directory shapes
 * (commands, agents, skills) for each supported runtime.
 *
 * grok is intentionally absent: it is in runtime-homes.cjs but not wired
 * here. The TypeError on unknown runtime is the loud-fail signal that a
 * runtime was added to the homes list without a layout entry.
 */

const path = require('path');
const fs = require('fs');

const {
  stageSkillsForProfile,
  stageAgentsForProfile,
  stageSkillsForRuntimeAsSkills,
} = require('./install-profiles.cjs');

// ---------------------------------------------------------------------------
// Lazy installer exports (avoids GSD_TEST_MODE env mutation at module load)
// ---------------------------------------------------------------------------

/**
 * Load bin/install.js exports in a test-safe way.
 * Sets GSD_TEST_MODE only for the duration of the require() call and only if
 * it was not already set, restoring the original value in a finally block so
 * the module-level environment is never permanently mutated.
 */
function loadInstallExports() {
  const savedTestMode = process.env.GSD_TEST_MODE;
  if (savedTestMode === undefined) process.env.GSD_TEST_MODE = '1';
  try {
    // eslint-disable-next-line global-require -- lazy import to avoid running installer at module load
    return require('../../../bin/install.js');
  } finally {
    if (savedTestMode === undefined) delete process.env.GSD_TEST_MODE;
    else process.env.GSD_TEST_MODE = savedTestMode;
  }
}

/** Cache after first successful load. */
let _installExports = null;
function getInstallExports() {
  if (!_installExports) _installExports = loadInstallExports();
  return _installExports;
}

/**
 * @typedef {'commands'|'agents'|'skills'} ArtifactKindName
 * @typedef {Object} ArtifactKind
 * @property {ArtifactKindName} kind
 * @property {string} destSubpath
 * @property {string} prefix
 * @property {(resolvedProfile: Object) => string} stage
 * @typedef {Object} Layout
 * @property {string} runtime
 * @property {string} configDir
 * @property {ArtifactKind[]} kinds
 */

// ---------------------------------------------------------------------------
// Source root finders
// ---------------------------------------------------------------------------

/**
 * Locate the GSD commands/gsd source directory.
 *
 * Resolution order:
 * 1. If runtimeConfigDir provided, check <runtimeConfigDir>/.gsd-source marker.
 * 2. Walk up from __dirname using path.dirname (no literal .. segments).
 * 3. Throw a descriptive error if neither succeeds.
 *
 * @param {string} [runtimeConfigDir] optional runtime config directory
 * @returns {string}
 */
function findInstallSourceRoot(runtimeConfigDir) {
  // Step 1: marker check
  if (runtimeConfigDir) {
    const markerPath = path.join(runtimeConfigDir, '.gsd-source');
    if (fs.existsSync(markerPath)) {
      try {
        const src = fs.readFileSync(markerPath, 'utf8').trim();
        if (src && fs.existsSync(src)) return src;
      } catch { /* fall through */ }
    }
  }

  // Step 2: walk up from __dirname
  let dir = __dirname;
  for (let i = 0; i < 6; i++) {
    const candidate = path.join(dir, 'commands', 'gsd');
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  throw new Error(`findInstallSourceRoot: could not locate commands/gsd from ${__dirname}`);
}

/**
 * Locate the GSD agents source directory.
 *
 * Resolution order:
 * 1. If runtimeConfigDir provided, check <runtimeConfigDir>/.gsd-source marker.
 * 2. Walk up from __dirname using path.dirname (no literal .. segments).
 * 3. Throw a descriptive error if neither succeeds.
 *
 * @param {string} [runtimeConfigDir] optional runtime config directory
 * @returns {string}
 */
function findAgentsSourceRoot(runtimeConfigDir) {
  // Step 1: marker check
  if (runtimeConfigDir) {
    const markerPath = path.join(runtimeConfigDir, '.gsd-source');
    if (fs.existsSync(markerPath)) {
      try {
        const src = fs.readFileSync(markerPath, 'utf8').trim();
        if (src && fs.existsSync(src)) {
          // Marker points to commands/gsd; agents/ is a sibling of commands/
          const agentsCandidate = path.resolve(path.dirname(src), '..', 'agents');
          if (fs.existsSync(agentsCandidate)) return agentsCandidate;
        }
      } catch { /* fall through */ }
    }
  }

  // Step 2: walk up from __dirname
  let dir = __dirname;
  for (let i = 0; i < 6; i++) {
    const candidate = path.join(dir, 'agents');
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  throw new Error(`findAgentsSourceRoot: could not locate agents/ from ${__dirname}`);
}

// ---------------------------------------------------------------------------
// Allowlisted runtimes
// ---------------------------------------------------------------------------

const ALLOWED_RUNTIMES = new Set([
  'claude', 'cursor', 'gemini', 'codex', 'copilot', 'antigravity',
  'windsurf', 'augment', 'trae', 'qwen', 'hermes', 'codebuddy',
  'cline', 'opencode', 'kilo',
]);

// ---------------------------------------------------------------------------
// Layout table builders
// ---------------------------------------------------------------------------

function commandsKind(destSubpath, prefix, configDir) {
  return {
    kind: 'commands',
    destSubpath,
    prefix,
    stage: (resolved) => stageSkillsForProfile(findInstallSourceRoot(configDir), resolved),
  };
}

function agentsKind(destSubpath, prefix, configDir) {
  return {
    kind: 'agents',
    destSubpath,
    prefix,
    stage: (resolved) => stageAgentsForProfile(findAgentsSourceRoot(configDir), resolved),
  };
}

/**
 * Build a skills kind descriptor.
 *
 * @param {string} destSubpath
 * @param {string} prefix
 * @param {string} converterName  name of converter function in bin/install.js exports
 * @param {string} runtime        canonical runtime ID (gates Hermes/Qwen branding in converter)
 * @param {string} configDir      runtime config dir (for .gsd-source marker resolution)
 */
function skillsKind(destSubpath, prefix, converterName, runtime, configDir) {
  return {
    kind: 'skills',
    destSubpath,
    prefix,
    stage: (resolved) => {
      const installExports = getInstallExports();
      const realConverter = installExports[converterName];
      // Compute cmdNames once per stage call for performance (#3583).
      // Extra args are ignored by converters that don't need runtime/cmdNames.
      const cmdNames = installExports.readGsdCommandNames();
      const wrappedConverter = (content, skillName) =>
        realConverter(content, skillName, runtime, cmdNames);
      return stageSkillsForRuntimeAsSkills(findInstallSourceRoot(configDir), resolved, wrappedConverter, prefix);
    },
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolve the artifact layout for a given runtime and config directory.
 *
 * @param {string} runtime
 * @param {string} configDir
 * @param {'local'|'global'} [scope]
 * @returns {Layout}
 */
function resolveRuntimeArtifactLayout(runtime, configDir, scope = 'global') {
  if (typeof configDir !== 'string' || configDir === '') {
    throw new TypeError('configDir must be a non-empty string');
  }
  if (scope !== 'local' && scope !== 'global') {
    throw new TypeError('scope must be "local" or "global"');
  }
  if (!ALLOWED_RUNTIMES.has(runtime)) {
    throw new TypeError(`Unknown runtime: '${runtime}' — add to runtime-artifact-layout.cjs table`);
  }

  let kinds;
  switch (runtime) {
    case 'claude':
      if (scope === 'local') {
        kinds = [
          commandsKind('commands/gsd', 'gsd-', configDir),
          agentsKind('agents', 'gsd-', configDir),
        ];
      } else {
        kinds = [skillsKind('skills', 'gsd-', 'convertClaudeCommandToClaudeSkill', 'claude', configDir)];
      }
      break;

    case 'cursor':
      kinds = [skillsKind('skills', 'gsd-', 'convertClaudeCommandToCursorSkill', 'cursor', configDir)];
      break;

    case 'gemini':
      kinds = [commandsKind('commands/gsd', 'gsd-', configDir)];
      break;

    case 'codex':
      kinds = [skillsKind('skills', 'gsd-', 'convertClaudeCommandToCodexSkill', 'codex', configDir)];
      break;

    case 'copilot':
      kinds = [skillsKind('skills', 'gsd-', 'convertClaudeCommandToCopilotSkill', 'copilot', configDir)];
      break;

    case 'antigravity':
      kinds = [skillsKind('skills', 'gsd-', 'convertClaudeCommandToAntigravitySkill', 'antigravity', configDir)];
      break;

    case 'windsurf':
      kinds = [skillsKind('skills', 'gsd-', 'convertClaudeCommandToWindsurfSkill', 'windsurf', configDir)];
      break;

    case 'augment':
      kinds = [skillsKind('skills', 'gsd-', 'convertClaudeCommandToAugmentSkill', 'augment', configDir)];
      break;

    case 'trae':
      kinds = [skillsKind('skills', 'gsd-', 'convertClaudeCommandToTraeSkill', 'trae', configDir)];
      break;

    case 'qwen':
      kinds = [skillsKind('skills', 'gsd-', 'convertClaudeCommandToClaudeSkill', 'qwen', configDir)];
      break;

    case 'hermes':
      kinds = [skillsKind('skills/gsd', '', 'convertClaudeCommandToClaudeSkill', 'hermes', configDir)];
      break;

    case 'codebuddy':
      kinds = [skillsKind('skills', 'gsd-', 'convertClaudeCommandToCodebuddySkill', 'codebuddy', configDir)];
      break;

    case 'cline':
      kinds = [];
      break;

    case 'opencode':
      kinds = [commandsKind('command', 'gsd-', configDir)];
      break;

    case 'kilo':
      kinds = [commandsKind('command', 'gsd-', configDir)];
      break;

    default:
      throw new TypeError(`Unknown runtime: '${runtime}' — add to runtime-artifact-layout.cjs table`);
  }

  return { runtime, configDir, kinds };
}

module.exports = { resolveRuntimeArtifactLayout, findInstallSourceRoot };
