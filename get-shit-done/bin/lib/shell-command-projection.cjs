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

function projectLocalHookPrefix({ runtime = 'claude', dirName }) {
  if (!dirName) return dirName;
  return (runtime === 'gemini' || runtime === 'antigravity')
    ? dirName
    : `"$CLAUDE_PROJECT_DIR"/${dirName}`;
}

function projectPortableHookBaseDir({ configDir, homeDir }) {
  const normalizedConfigDir = String(configDir || '').replace(/\\/g, '/');
  const normalizedHome = String(homeDir || '').replace(/\\/g, '/');
  if (!normalizedConfigDir || !normalizedHome) return normalizedConfigDir;
  return normalizedConfigDir.startsWith(normalizedHome)
    ? '$HOME' + normalizedConfigDir.slice(normalizedHome.length)
    : normalizedConfigDir;
}

function projectShellCommandText({
  runnerToken,
  argTokens = [],
  runtime = 'generic',
  platform = process.platform,
}) {
  if (!runnerToken) return null;
  const parts = [runnerToken, ...argTokens.filter(Boolean)];
  return formatHookCommandForRuntime(parts.join(' '), { platform, runtime });
}

function projectManagedHookCommand({ absoluteRunner, scriptPath, runtime = 'generic', platform = process.platform }) {
  if (!absoluteRunner || !scriptPath) return null;
  const normalizedScriptPath = platform === 'win32' ? scriptPath.replace(/\\/g, '/') : scriptPath;
  return projectShellCommandText({
    runnerToken: absoluteRunner,
    argTokens: [JSON.stringify(normalizedScriptPath)],
    runtime,
    platform,
  });
}

const MANAGED_HOOK_BASENAMES_BY_SURFACE = {
  'settings-json': new Set([
    'gsd-check-update.js',
    'gsd-statusline.js',
    'gsd-context-monitor.js',
    'gsd-prompt-guard.js',
    'gsd-read-guard.js',
    'gsd-read-injection-scanner.js',
    'gsd-update-banner.js',
    'gsd-workflow-guard.js',
  ]),
  'codex-toml': new Set([
    'gsd-check-update.js',
  ]),
};

function managedHookSurfaceSet(surface = 'settings-json') {
  return MANAGED_HOOK_BASENAMES_BY_SURFACE[surface] || MANAGED_HOOK_BASENAMES_BY_SURFACE['settings-json'];
}

function isManagedHookBasename(scriptPathOrBasename, opts = {}) {
  if (!scriptPathOrBasename) return false;
  const surface = opts.surface || 'settings-json';
  const basename = String(scriptPathOrBasename).split(/[\\/]/).pop() || '';
  return managedHookSurfaceSet(surface).has(basename);
}

/**
 * Projection helper for legacy settings.json hook rewrites.
 *
 * Non-Windows keeps the original script token shape when provided (single
 * quote / bareword / quoted), while Windows normalizes to double-quoted
 * forward-slash path tokens for stable cross-shell behavior.
 */
function projectLegacySettingsHookCommand({
  absoluteRunner,
  scriptPath,
  scriptToken,
  runtime = 'generic',
  platform = process.platform,
}) {
  if (!absoluteRunner || !scriptPath) return null;
  const normalizedScriptPath = platform === 'win32' ? scriptPath.replace(/\\/g, '/') : scriptPath;
  const commandScriptToken = platform === 'win32'
    ? JSON.stringify(normalizedScriptPath)
    : (scriptToken || JSON.stringify(normalizedScriptPath));
  return projectShellCommandText({
    runnerToken: absoluteRunner,
    argTokens: [commandScriptToken],
    runtime,
    platform,
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

function escapePowerShellSingleQuoted(value) {
  return String(value).replace(/'/g, "''");
}

function escapePosixDoubleQuoted(value) {
  return String(value).replace(/[\\$"`]/g, '\\$&');
}

function escapeSingleQuotedShellLiteral(value) {
  return String(value).replace(/'/g, "'\\''");
}

function renderShellActionLines(shellActions = []) {
  return shellActions.map((action) => {
    if (!action || !action.command) return '';
    return action.label ? `${action.label}: ${action.command}` : action.command;
  }).filter(Boolean);
}

function projectPathActionProjection({
  mode = 'repair',
  targetDir,
  platform = process.platform,
}) {
  if (!targetDir) return { shellActions: [], actionLines: [] };

  const isWin32 = platform === 'win32';

  let shellActions;
  if (isWin32) {
    const psTargetDir = escapePowerShellSingleQuoted(targetDir);
    const bashTargetDir = escapeSingleQuotedShellLiteral(String(targetDir).replace(/\\/g, '/'));
    shellActions = [
      {
        label: 'PowerShell',
        shell: 'powershell',
        command: `[Environment]::SetEnvironmentVariable('PATH', '${psTargetDir};' + [Environment]::GetEnvironmentVariable('PATH', 'User'), 'User')`,
      },
      {
        label: 'cmd.exe',
        shell: 'cmd',
        command: `powershell -Command "[Environment]::SetEnvironmentVariable('PATH', '${psTargetDir};' + [Environment]::GetEnvironmentVariable('PATH', 'User'), 'User')"`,
      },
      {
        label: 'Git Bash',
        shell: 'bash',
        command: `echo 'export PATH="${bashTargetDir}:$PATH"' >> ~/.bashrc`,
      },
    ];
  } else if (mode === 'persist') {
    const bashTargetDir = escapeSingleQuotedShellLiteral(String(targetDir));
    shellActions = [
      {
        label: 'zsh',
        shell: 'zsh',
        command: `echo 'export PATH="${bashTargetDir}:$PATH"' >> ~/.zshrc`,
      },
      {
        label: 'bash',
        shell: 'bash',
        command: `echo 'export PATH="${bashTargetDir}:$PATH"' >> ~/.bashrc`,
      },
    ];
  } else {
    const posixTargetDir = escapePosixDoubleQuoted(targetDir);
    shellActions = [
      {
        label: null,
        shell: 'posix',
        command: `export PATH="${posixTargetDir}:$PATH"`,
      },
    ];
  }

  return {
    shellActions,
    actionLines: renderShellActionLines(shellActions),
  };
}

function buildWindowsShimTriple(shimSrc) {
  const path = require('path');
  const shimAbs = path.resolve(shimSrc);
  const shimQuoted = JSON.stringify(shimAbs);
  const invocation = {
    interpreter: 'node',
    target: shimAbs,
  };
  const renderCmd = () =>
    '@ECHO OFF\r\n@SETLOCAL\r\n@node ' + shimQuoted + ' %*\r\n';
  const renderPs1 = () =>
    '#!/usr/bin/env pwsh\n& node ' + shimQuoted + ' $args\nexit $LASTEXITCODE\n';
  const renderSh = () =>
    '#!/usr/bin/env sh\nexec node ' + shimQuoted + ' "$@"\n';
  return {
    invocation,
    eol: { cmd: '\r\n', ps1: '\n', sh: '\n' },
    fileNames: { cmd: 'gsd-sdk.cmd', ps1: 'gsd-sdk.ps1', sh: 'gsd-sdk' },
    render: { cmd: renderCmd, ps1: renderPs1, sh: renderSh },
  };
}

function formatSdkPathDiagnostic({ shimDir, platform, runDir }) {
  const isWin32 = platform === 'win32';
  const isNpx = typeof runDir === 'string' &&
    (runDir.includes('/_npx/') || runDir.includes('\\_npx\\'));
  const shimLocationLine = shimDir ? `Shim written to: ${shimDir}` : '';
  const actionLines = [];
  let shellActions = [];
  if (shimDir) {
    const projected = projectPathActionProjection({
      mode: 'repair',
      targetDir: shimDir,
      platform,
    });
    shellActions = projected.shellActions;
    actionLines.push('Add that directory to your PATH and restart your shell.');
    actionLines.push(...projected.actionLines);
  } else {
    actionLines.push('Could not locate a writable PATH directory to install the shim.');
    actionLines.push('Install globally to materialize the bin symlink:');
    actionLines.push('npm install -g get-shit-done-cc');
  }
  const npxNoteLines = isNpx
    ? [
        "Note: you're running via npx. For a persistent shim,",
        'install globally instead: npm install -g get-shit-done-cc',
      ]
    : [];
  return { shimLocationLine, actionLines, shellActions, npxNoteLines, isNpx, isWin32 };
}

module.exports = {
  hookCommandNeedsPowerShellCallOperator,
  formatHookCommandForRuntime,
  formatManagedHookScriptToken,
  projectLocalHookPrefix,
  projectPortableHookBaseDir,
  projectShellCommandText,
  projectManagedHookCommand,
  isManagedHookBasename,
  projectLegacySettingsHookCommand,
  escapeTomlDoubleQuotedString,
  projectCodexHookTomlCommand,
  projectPathActionProjection,
  renderShellActionLines,
  buildWindowsShimTriple,
  formatSdkPathDiagnostic,
};
