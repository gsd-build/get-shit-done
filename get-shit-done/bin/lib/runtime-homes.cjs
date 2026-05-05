'use strict';

/**
 * runtime-homes.cjs — canonical runtime → global config/skills directory mapping.
 *
 * Single source of truth for resolving the global config base directory and
 * the correct global skills directory for every GSD-supported runtime.
 *
 * Mirrors the logic in bin/install.js getGlobalDir() but as a pure,
 * side-effect-free module safe to require() at any point without triggering
 * the installer. bin/install.js is the authoritative source — keep in sync.
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

/**
 * Return the global config base directory for the given runtime.
 * Respects the same env-var overrides as bin/install.js getGlobalDir().
 *
 * @param {string} runtime
 * @returns {string} Absolute path to the runtime's global config directory
 */
function getGlobalConfigDir(runtime) {
  const home = os.homedir();
  const env = process.env;

  switch (runtime) {
    // ── Claude Code ──────────────────────────────────────────────────────────
    case 'claude':
      return env.CLAUDE_CONFIG_DIR ? expandTilde(env.CLAUDE_CONFIG_DIR) : path.join(home, '.claude');

    // ── Cursor ───────────────────────────────────────────────────────────────
    case 'cursor':
      return env.CURSOR_CONFIG_DIR ? expandTilde(env.CURSOR_CONFIG_DIR) : path.join(home, '.cursor');

    // ── Gemini CLI ───────────────────────────────────────────────────────────
    case 'gemini':
      return env.GEMINI_CONFIG_DIR ? expandTilde(env.GEMINI_CONFIG_DIR) : path.join(home, '.gemini');

    // ── Codex ────────────────────────────────────────────────────────────────
    case 'codex':
      return env.CODEX_HOME ? expandTilde(env.CODEX_HOME) : path.join(home, '.codex');

    // ── Copilot (VS Code) ────────────────────────────────────────────────────
    case 'copilot':
      return env.COPILOT_CONFIG_DIR ? expandTilde(env.COPILOT_CONFIG_DIR) : path.join(home, '.copilot');

    // ── Antigravity ──────────────────────────────────────────────────────────
    case 'antigravity':
      return env.ANTIGRAVITY_CONFIG_DIR
        ? expandTilde(env.ANTIGRAVITY_CONFIG_DIR)
        : path.join(home, '.gemini', 'antigravity');

    // ── Windsurf ─────────────────────────────────────────────────────────────
    case 'windsurf':
      return env.WINDSURF_CONFIG_DIR
        ? expandTilde(env.WINDSURF_CONFIG_DIR)
        : path.join(home, '.codeium', 'windsurf');

    // ── Augment ──────────────────────────────────────────────────────────────
    case 'augment':
      return env.AUGMENT_CONFIG_DIR ? expandTilde(env.AUGMENT_CONFIG_DIR) : path.join(home, '.augment');

    // ── Trae ─────────────────────────────────────────────────────────────────
    case 'trae':
      return env.TRAE_CONFIG_DIR ? expandTilde(env.TRAE_CONFIG_DIR) : path.join(home, '.trae');

    // ── Qwen Code ────────────────────────────────────────────────────────────
    case 'qwen':
      return env.QWEN_CONFIG_DIR ? expandTilde(env.QWEN_CONFIG_DIR) : path.join(home, '.qwen');

    // ── Hermes Agent ─────────────────────────────────────────────────────────
    // Note: skills use a nested layout (skills/gsd/<skill>/) — see getGlobalSkillDir().
    case 'hermes':
      return env.HERMES_HOME ? expandTilde(env.HERMES_HOME) : path.join(home, '.hermes');

    // ── CodeBuddy ────────────────────────────────────────────────────────────
    case 'codebuddy':
      return env.CODEBUDDY_CONFIG_DIR ? expandTilde(env.CODEBUDDY_CONFIG_DIR) : path.join(home, '.codebuddy');

    // ── Cline ────────────────────────────────────────────────────────────────
    // Note: Cline is rules-based (.clinerules) — no skills/ directory.
    // getGlobalSkillDir() returns null for cline.
    case 'cline':
      return env.CLINE_CONFIG_DIR ? expandTilde(env.CLINE_CONFIG_DIR) : path.join(home, '.cline');

    // ── OpenCode (XDG) ───────────────────────────────────────────────────────
    case 'opencode': {
      if (env.OPENCODE_CONFIG_DIR) return expandTilde(env.OPENCODE_CONFIG_DIR);
      if (env.XDG_CONFIG_HOME) return path.join(expandTilde(env.XDG_CONFIG_HOME), 'opencode');
      return path.join(home, '.config', 'opencode');
    }

    // ── Kilo (XDG) ───────────────────────────────────────────────────────────
    case 'kilo': {
      if (env.KILO_CONFIG_DIR) return expandTilde(env.KILO_CONFIG_DIR);
      if (env.XDG_CONFIG_HOME) return path.join(expandTilde(env.XDG_CONFIG_HOME), 'kilo');
      return path.join(home, '.config', 'kilo');
    }

    // ── Default (Claude fallback) ─────────────────────────────────────────────
    default:
      return env.CLAUDE_CONFIG_DIR ? expandTilde(env.CLAUDE_CONFIG_DIR) : path.join(home, '.claude');
  }
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
  if (runtime === 'cline') return null;
  const configDir = getGlobalConfigDir(runtime);
  if (runtime === 'hermes') return path.join(configDir, 'skills', 'gsd');
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
  getGlobalConfigDir,
  getGlobalSkillsBase,
  getGlobalSkillDir,
  getGlobalSkillDisplayPath,
};
