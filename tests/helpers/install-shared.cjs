'use strict';

/**
 * Shared helpers and constants for install test suite.
 * Used by install.test.cjs, install-runtime-artifacts.test.cjs,
 * and install-minimal-hooks.test.cjs.
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const assert = require('node:assert/strict');

const INSTALL_SCRIPT = path.join(__dirname, '..', '..', 'bin', 'install.js');
const MANIFEST_NAME = 'gsd-file-manifest.json';

const BUILD_SCRIPT = path.join(__dirname, '..', '..', 'scripts', 'build-hooks.js');
const HOOKS_DIST = path.join(__dirname, '..', '..', 'hooks', 'dist');

const EXPECTED_SH_HOOKS = [
  'gsd-session-state.sh',
  'gsd-validate-commit.sh',
  'gsd-phase-boundary.sh',
];

const EXPECTED_ALL_HOOKS = [
  'gsd-check-update.js',
  'gsd-context-monitor.js',
  'gsd-prompt-guard.js',
  'gsd-read-guard.js',
  'gsd-read-injection-scanner.js',
  'gsd-statusline.js',
  'gsd-workflow-guard.js',
  ...EXPECTED_SH_HOOKS,
];

// ─── Runtime metadata table ───────────────────────────────────────────────────

const RUNTIME_META = {
  claude:       { localDir: '.claude',           globalSuffix: '.claude' },
  antigravity:  { localDir: '.agent',            globalSuffix: path.join('.gemini', 'antigravity') },
  augment:      { localDir: '.augment',          globalSuffix: '.augment' },
  cline:        { localDir: '.cline',            globalSuffix: '.cline' },
  codebuddy:    { localDir: '.codebuddy',        globalSuffix: '.codebuddy' },
  codex:        { localDir: '.codex',            globalSuffix: '.codex' },
  copilot:      { localDir: '.github',           globalSuffix: '.copilot' },
  cursor:       { localDir: '.cursor',           globalSuffix: '.cursor' },
  gemini:       { localDir: '.gemini',           globalSuffix: '.gemini' },
  hermes:       { localDir: '.hermes',           globalSuffix: '.hermes' },
  kilo:         { localDir: '.kilo',             globalSuffix: path.join('.config', 'kilo') },
  opencode:     { localDir: '.opencode',         globalSuffix: path.join('.config', 'opencode') },
  qwen:         { localDir: '.qwen',             globalSuffix: '.qwen' },
  trae:         { localDir: '.trae',             globalSuffix: '.trae' },
  windsurf:     { localDir: '.windsurf',         globalSuffix: path.join('.codeium', 'windsurf') },
};

// Runtimes that emit per-skill files under skills/ (not rules-based or commands-based)
const SKILL_RUNTIMES = [
  'claude', 'opencode', 'gemini', 'kilo', 'codex', 'copilot', 'antigravity',
  'cursor', 'windsurf', 'augment', 'trae', 'qwen', 'codebuddy',
];

// ─── Helper functions ─────────────────────────────────────────────────────────

function stripAnsi(str) {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

function walk(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...walk(full));
    else results.push(full);
  }
  return results;
}

function simulateHookCopy(hooksSrc, hooksDest) {
  fs.mkdirSync(hooksDest, { recursive: true });
  for (const entry of fs.readdirSync(hooksSrc)) {
    const srcFile = path.join(hooksSrc, entry);
    if (!fs.statSync(srcFile).isFile()) continue;
    const destFile = path.join(hooksDest, entry);
    if (entry.endsWith('.js')) {
      fs.writeFileSync(destFile, fs.readFileSync(srcFile, 'utf8'));
      try { fs.chmodSync(destFile, 0o755); } catch { /* Windows */ }
    } else {
      fs.copyFileSync(srcFile, destFile);
      if (entry.endsWith('.sh')) {
        try { fs.chmodSync(destFile, 0o755); } catch { /* Windows */ }
      }
    }
  }
}

/** Build a clean env for spawned installer processes.
 *  Must strip GSD_TEST_MODE so the child runs the real install, not the no-op guard. */
function installerEnv(overrides = {}) {
  const env = { ...process.env, ...overrides };
  delete env.GSD_TEST_MODE;
  return env;
}

function runMinimalInstall({ runtime, scope, extraArgs = [] }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `gsd-${runtime}-${scope}-`));
  try {
    const LOCAL_DIR_NAME = {
      claude: '.claude', opencode: '.opencode', gemini: '.gemini', kilo: '.kilo',
      codex: '.codex', copilot: '.github', antigravity: '.agent', cursor: '.cursor',
      windsurf: '.windsurf', augment: '.augment', trae: '.trae', qwen: '.qwen',
      codebuddy: '.codebuddy', cline: '.',
    };
    let configDir;
    let cwd = process.cwd();
    const args = [INSTALL_SCRIPT, `--${runtime}`];
    if (scope === 'global') {
      args.push('--global', '--config-dir', root);
      configDir = root;
    } else {
      args.push('--local');
      cwd = root;
      configDir = runtime === 'cline' ? root : path.join(root, LOCAL_DIR_NAME[runtime]);
    }
    args.push(...extraArgs);
    const result = spawnSync(process.execPath, args, {
      cwd, encoding: 'utf8',
      env: installerEnv({ HOME: root, USERPROFILE: root }),
    });
    assert.strictEqual(result.status, 0,
      `installer exited with status ${result.status} for ${runtime} --${scope}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`);
    const manifestPath = path.join(configDir, MANIFEST_NAME);
    const manifest = fs.existsSync(manifestPath)
      ? JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
      : null;
    return { manifest, configDir, root, stdout: result.stdout, stderr: result.stderr };
  } catch (err) {
    fs.rmSync(root, { recursive: true, force: true });
    throw err;
  }
}

function manifestSkillSet(manifest) {
  if (!manifest || !manifest.files) return new Set();
  const out = new Set();
  for (const key of Object.keys(manifest.files)) {
    if (key.startsWith('skills/')) {
      const seg = key.split('/')[1].replace(/^gsd-/, '').replace(/\.md$/, '');
      out.add(seg);
    } else if (key.startsWith('command/')) {
      const file = key.split('/')[1];
      out.add(file.replace(/^gsd-/, '').replace(/\.md$/, ''));
    } else if (key.startsWith('commands/gsd/')) {
      const file = key.split('/')[2];
      out.add(file.replace(/\.(md|toml)$/, ''));
    }
  }
  return out;
}

function manifestAgentCount(manifest) {
  if (!manifest || !manifest.files) return 0;
  return Object.keys(manifest.files).filter((k) => k.startsWith('agents/')).length;
}

function collectSkillBasenamesOnDisk(configDir) {
  const out = new Set();
  const skillsDir = path.join(configDir, 'skills');
  if (fs.existsSync(skillsDir)) {
    for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
      if (entry.isDirectory() && entry.name.startsWith('gsd-')) {
        out.add(entry.name.replace(/^gsd-/, ''));
      } else if (entry.isFile() && entry.name.startsWith('gsd-') && entry.name.endsWith('.md')) {
        out.add(entry.name.replace(/^gsd-/, '').replace(/\.md$/, ''));
      }
    }
  }
  const commandDir = path.join(configDir, 'command');
  if (fs.existsSync(commandDir)) {
    for (const file of fs.readdirSync(commandDir)) {
      if (file.startsWith('gsd-') && file.endsWith('.md')) {
        out.add(file.replace(/^gsd-/, '').replace(/\.md$/, ''));
      }
    }
  }
  const commandsGsdDir = path.join(configDir, 'commands', 'gsd');
  if (fs.existsSync(commandsGsdDir)) {
    for (const file of fs.readdirSync(commandsGsdDir)) {
      if (file.endsWith('.md') || file.endsWith('.toml')) {
        out.add(file.replace(/\.(md|toml)$/, ''));
      }
    }
  }
  return out;
}

module.exports = {
  INSTALL_SCRIPT,
  MANIFEST_NAME,
  BUILD_SCRIPT,
  HOOKS_DIST,
  EXPECTED_SH_HOOKS,
  EXPECTED_ALL_HOOKS,
  RUNTIME_META,
  SKILL_RUNTIMES,
  stripAnsi,
  walk,
  simulateHookCopy,
  installerEnv,
  runMinimalInstall,
  manifestSkillSet,
  manifestAgentCount,
  collectSkillBasenamesOnDisk,
};
