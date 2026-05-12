'use strict';

/**
 * Shell Command Projection Module
 *
 * Tracer-bullet seam for runtime-aware projection of serialized command text
 * that GSD writes into runtime config or prints for copy/paste. This module
 * does NOT execute commands; it only renders command text for external shells
 * and runtimes.
 */

/**
 * Return true when a managed hook command must be prefixed with PowerShell's
 * call operator so a quoted executable token is invokable by the target
 * runtime/shell combination.
 *
 * Current evidence-backed policy:
 * - Gemini on Windows requires `& ` for quoted node/bash runners.
 * - Claude Code on Windows does NOT: its hook commands execute under bash/Git
 *   Bash and `& ` breaks there (#3413).
 *
 * Keep the policy conservative until another runtime has a verified need.
 */
function hookCommandNeedsPowerShellCallOperator(opts = {}) {
  const platform = opts.platform || process.platform;
  const runtime = opts.runtime || 'generic';
  return platform === 'win32' && runtime === 'gemini';
}

/**
 * Project a fully-assembled hook command string for the target runtime.
 */
function formatHookCommandForRuntime(command, opts = {}) {
  return hookCommandNeedsPowerShellCallOperator(opts) ? `& ${command}` : command;
}

/**
 * Project a managed hook script path token for serialized shell commands.
 * Windows managed hook commands normalize to forward slashes so the same path
 * survives JSON/TOML/config surfaces consistently.
 */
function formatManagedHookScriptToken(scriptPath, opts = {}) {
  const platform = opts.platform || process.platform;
  if (platform !== 'win32') return null;
  return JSON.stringify(scriptPath.replace(/\\/g, '/'));
}

function projectManagedHookCommand({ absoluteRunner, scriptPath, runtime = 'generic', platform = process.platform }) {
  if (!absoluteRunner || !scriptPath) return null;
  const normalizedScriptPath = platform === 'win32' ? scriptPath.replace(/\\/g, '/') : scriptPath;
  return formatHookCommandForRuntime(`${absoluteRunner} ${JSON.stringify(normalizedScriptPath)}`, {
    platform,
    runtime,
  });
}

function escapeTomlDoubleQuotedString(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function projectCodexHookTomlCommand({ absoluteRunner, scriptPath, platform = process.platform }) {
  const command = projectManagedHookCommand({
    absoluteRunner,
    scriptPath,
    runtime: 'codex',
    platform,
  });
  return command === null ? null : escapeTomlDoubleQuotedString(command);
}

module.exports = {
  hookCommandNeedsPowerShellCallOperator,
  formatHookCommandForRuntime,
  formatManagedHookScriptToken,
  projectManagedHookCommand,
  escapeTomlDoubleQuotedString,
  projectCodexHookTomlCommand,
};
