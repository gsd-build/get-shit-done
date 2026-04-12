'use strict';

const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

// ─── Config Gate ─────────────────────────────────────────────────────────────

/**
 * Check whether graphify is enabled in the project config.
 * Reads config.json directly via fs. Returns false by default
 * (when no config, no graphify key, or on error).
 *
 * @param {string} planningDir - Path to .planning directory
 * @returns {boolean}
 */
function isGraphifyEnabled(planningDir) {
  try {
    const configPath = path.join(planningDir, 'config.json');
    if (!fs.existsSync(configPath)) return false;
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (config && config.graphify && config.graphify.enabled === true) return true;
    return false;
  } catch (_e) {
    return false;
  }
}

/**
 * Return the standard disabled response object.
 * @returns {{ disabled: true, message: string }}
 */
function disabledResponse() {
  return { disabled: true, message: 'graphify is not enabled. Enable with: gsd-tools config-set graphify.enabled true' };
}

// ─── Subprocess Helper ───────────────────────────────────────────────────────

/**
 * Execute graphify CLI as a subprocess with proper env and timeout handling.
 *
 * @param {string} cwd - Working directory for the subprocess
 * @param {string[]} args - Arguments to pass to graphify
 * @param {{ timeout?: number }} [options={}] - Options (timeout in ms, default 30000)
 * @returns {{ exitCode: number, stdout: string, stderr: string }}
 */
function execGraphify(cwd, args, options = {}) {
  const timeout = options.timeout ?? 30000;
  const result = childProcess.spawnSync('graphify', args, {
    cwd,
    stdio: 'pipe',
    encoding: 'utf-8',
    timeout,
    env: { ...process.env, PYTHONUNBUFFERED: '1' },
  });

  // ENOENT -- graphify binary not found on PATH
  if (result.error && result.error.code === 'ENOENT') {
    return { exitCode: 127, stdout: '', stderr: 'graphify not found on PATH' };
  }

  // Timeout -- subprocess killed via SIGTERM
  if (result.signal === 'SIGTERM') {
    return {
      exitCode: 124,
      stdout: (result.stdout ?? '').toString().trim(),
      stderr: 'graphify timed out after ' + timeout + 'ms',
    };
  }

  return {
    exitCode: result.status ?? 1,
    stdout: (result.stdout ?? '').toString().trim(),
    stderr: (result.stderr ?? '').toString().trim(),
  };
}

// ─── Presence & Version ──────────────────────────────────────────────────────

/**
 * Check whether the graphify CLI binary is installed and accessible on PATH.
 * Uses --help (NOT --version, which graphify does not support).
 *
 * @returns {{ installed: boolean, message?: string }}
 */
function checkGraphifyInstalled() {
  const result = childProcess.spawnSync('graphify', ['--help'], {
    stdio: 'pipe',
    encoding: 'utf-8',
    timeout: 5000,
  });

  if (result.error) {
    return {
      installed: false,
      message: 'graphify is not installed.\n\nInstall with:\n  uv pip install graphifyy && graphify install',
    };
  }

  return { installed: true };
}

/**
 * Detect graphify version via python3 importlib.metadata and check compatibility.
 * Tested range: >=0.4.0,<1.0
 *
 * @returns {{ version: string|null, compatible: boolean|null, warning: string|null }}
 */
function checkGraphifyVersion() {
  const result = childProcess.spawnSync('python3', [
    '-c',
    'from importlib.metadata import version; print(version("graphifyy"))',
  ], {
    stdio: 'pipe',
    encoding: 'utf-8',
    timeout: 5000,
  });

  if (result.status !== 0 || !result.stdout || !result.stdout.trim()) {
    return { version: null, compatible: null, warning: 'Could not determine graphify version' };
  }

  const versionStr = result.stdout.trim();
  const parts = versionStr.split('.').map(Number);

  if (parts.length < 2 || parts.some(isNaN)) {
    return { version: versionStr, compatible: null, warning: 'Could not parse version: ' + versionStr };
  }

  const compatible = parts[0] === 0 && parts[1] >= 4;
  const warning = compatible ? null : 'graphify version ' + versionStr + ' is outside tested range >=0.4.0,<1.0';

  return { version: versionStr, compatible, warning };
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  isGraphifyEnabled,
  disabledResponse,
  execGraphify,
  checkGraphifyInstalled,
  checkGraphifyVersion,
};
