#!/usr/bin/env node
// gsd-hook-version: {{GSD_VERSION}}
// Check for GSD updates in background, write result to cache
// Called by SessionStart hook - runs once per session

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const homeDir = os.homedir();
const cwd = process.cwd();

// Detect runtime config directory (supports Claude, OpenCode, Kilo, Gemini)
// Respects CLAUDE_CONFIG_DIR for custom config directory setups
function detectConfigDir(baseDir) {
  // Check env override first (supports multi-account setups)
  const envDir = process.env.CLAUDE_CONFIG_DIR;
  if (envDir && fs.existsSync(path.join(envDir, 'get-shit-done', 'VERSION'))) {
    return envDir;
  }
  for (const dir of ['.claude', '.gemini', '.config/kilo', '.kilo', '.config/opencode', '.opencode']) {
    if (fs.existsSync(path.join(baseDir, dir, 'get-shit-done', 'VERSION'))) {
      return path.join(baseDir, dir);
    }
  }
  return envDir || path.join(baseDir, '.claude');
}

const globalConfigDir = detectConfigDir(homeDir);
const projectConfigDir = detectConfigDir(cwd);
// Use a shared, tool-agnostic cache directory to avoid multi-runtime
// resolution mismatches where check-update writes to one runtime's cache
// but statusline reads from another (#1421).
const cacheDir = path.join(homeDir, '.cache', 'gsd');
const cacheFile = path.join(cacheDir, 'gsd-update-check.json');

// VERSION file locations (check project first, then global)
const projectVersionFile = path.join(projectConfigDir, 'get-shit-done', 'VERSION');
const globalVersionFile = path.join(globalConfigDir, 'get-shit-done', 'VERSION');

// Ensure cache directory exists
if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir, { recursive: true });
}

// Run check in background (spawn background process, windowsHide prevents console flash)
const child = spawn(process.execPath, ['-e', `
  const fs = require('fs');
  const path = require('path');
  const { execSync } = require('child_process');

  // Compare semver: true if a > b (a is strictly newer than b)
  // Strips pre-release suffixes (e.g. '3-beta.1' → '3') to avoid NaN from Number()
  function isNewer(a, b) {
    const pa = (a || '').split('.').map(s => Number(s.replace(/-.*/, '')) || 0);
    const pb = (b || '').split('.').map(s => Number(s.replace(/-.*/, '')) || 0);
    for (let i = 0; i < 3; i++) {
      if (pa[i] > pb[i]) return true;
      if (pa[i] < pb[i]) return false;
    }
    return false;
  }

  const cacheFile = ${JSON.stringify(cacheFile)};
  const projectVersionFile = ${JSON.stringify(projectVersionFile)};
  const globalVersionFile = ${JSON.stringify(globalVersionFile)};

  // Check project directory first (local install), then global
  let installed = '0.0.0';
  let configDir = '';
  try {
    if (fs.existsSync(projectVersionFile)) {
      installed = fs.readFileSync(projectVersionFile, 'utf8').trim();
      configDir = path.dirname(path.dirname(projectVersionFile));
    } else if (fs.existsSync(globalVersionFile)) {
      installed = fs.readFileSync(globalVersionFile, 'utf8').trim();
      configDir = path.dirname(path.dirname(globalVersionFile));
    }
  } catch (e) {}

  // Check for stale hooks — compare hook version headers against installed VERSION
  // Hooks are installed at configDir/hooks/ (e.g. ~/.claude/hooks/) (#1421)
  // Only check hooks that GSD currently ships — orphaned files from removed features
  // (e.g., gsd-intel-*.js) must be ignored to avoid permanent stale warnings (#1750)
  const MANAGED_HOOKS = [
    'gsd-check-update.js',
    'gsd-context-monitor.js',
    'gsd-phase-boundary.sh',
    'gsd-prompt-guard.js',
    'gsd-read-guard.js',
    'gsd-session-state.sh',
    'gsd-statusline.js',
    'gsd-validate-commit.sh',
    'gsd-workflow-guard.js',
  ];
  let staleHooks = [];
  if (configDir) {
    const hooksDir = path.join(configDir, 'hooks');
    try {
      if (fs.existsSync(hooksDir)) {
        const hookFiles = fs.readdirSync(hooksDir).filter(f => MANAGED_HOOKS.includes(f));
        for (const hookFile of hookFiles) {
          try {
            const content = fs.readFileSync(path.join(hooksDir, hookFile), 'utf8');
            const versionMatch = content.match(/\\/\\/ gsd-hook-version:\\s*(.+)/);
            if (versionMatch) {
              const hookVersion = versionMatch[1].trim();
              if (isNewer(installed, hookVersion) && !hookVersion.includes('{{')) {
                staleHooks.push({ file: hookFile, hookVersion, installedVersion: installed });
              }
            } else {
              // No version header at all — definitely stale (pre-version-tracking)
              staleHooks.push({ file: hookFile, hookVersion: 'unknown', installedVersion: installed });
            }
          } catch (e) {}
        }
      }
    } catch (e) {}
  }

  let latest = null;
  try {
    latest = execSync('npm view get-shit-done-cc version', { encoding: 'utf8', timeout: 10000, windowsHide: true }).trim();
  } catch (e) {}

  const result = {
    update_available: latest && isNewer(latest, installed),
    installed,
    latest: latest || 'unknown',
    checked: Math.floor(Date.now() / 1000),
    stale_hooks: staleHooks.length > 0 ? staleHooks : undefined
  };

  fs.writeFileSync(cacheFile, JSON.stringify(result));
`], {
  stdio: 'ignore',
  windowsHide: true,
  detached: true  // Required on Windows for proper process detachment
});

child.unref();
