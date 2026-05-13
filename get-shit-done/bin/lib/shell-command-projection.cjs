'use strict';

const path = require('path');
const fs = require('fs');
// Use non-destructured access so test-time mock.method(childProcess, 'spawnSync')
// can intercept calls from this seam — destructured imports capture references
// at load time and become un-mockable.
const childProcess = require('child_process');

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

const MANAGED_HOOK_COMMAND_BASENAMES_BY_SURFACE = {
  'settings-json': new Set([
    'gsd-check-update.js',
    'gsd-statusline.js',
    'gsd-context-monitor.js',
    'gsd-prompt-guard.js',
    'gsd-read-guard.js',
    'gsd-read-injection-scanner.js',
    'gsd-update-banner.js',
    'gsd-workflow-guard.js',
    'gsd-session-state.sh',
    'gsd-validate-commit.sh',
    'gsd-phase-boundary.sh',
  ]),
  'codex-toml': new Set([
    'gsd-check-update.js',
  ]),
  'codex-hooks-json': new Set([
    'gsd-check-update.js',
  ]),
};

const LEGACY_MANAGED_HOOK_ALIASES_BY_SURFACE = {
  'codex-toml': new Set([
    'gsd-update-check.js',
  ]),
  'codex-hooks-json': new Set([
    'gsd-update-check.js',
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

function managedHookCommandSurfaceSet(surface = 'settings-json', includeLegacyAliases = false) {
  const base = MANAGED_HOOK_COMMAND_BASENAMES_BY_SURFACE[surface]
    || MANAGED_HOOK_COMMAND_BASENAMES_BY_SURFACE['settings-json'];
  if (!includeLegacyAliases) return base;
  const aliases = LEGACY_MANAGED_HOOK_ALIASES_BY_SURFACE[surface];
  if (!aliases || aliases.size === 0) return base;
  return new Set([...base, ...aliases]);
}

function isManagedHookCommand(commandText, opts = {}) {
  if (typeof commandText !== 'string') return false;
  const surface = opts.surface || 'settings-json';
  const includeLegacyAliases = opts.includeLegacyAliases === true;
  const managedBasenames = managedHookCommandSurfaceSet(surface, includeLegacyAliases);
  if (!managedBasenames || managedBasenames.size === 0) return false;
  const normalizedCommand = commandText.replace(/\\/g, '/');

  if (typeof opts.configDir === 'string' && opts.configDir.length > 0) {
    const normalizedHooksDir = `${path.join(opts.configDir, 'hooks').replace(/\\/g, '/')}/`;
    if (!normalizedCommand.includes(normalizedHooksDir)) return false;
  }

  for (const basename of managedBasenames) {
    const escapedBasename = basename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`(^|[\\\\/\\s"'` + '`' + `])${escapedBasename}(?=$|[\\s"'` + '`' + `])`);
    if (pattern.test(normalizedCommand)) return true;
  }
  return false;
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

function projectPersistentPathExportActions({ targetDir, platform = process.platform }) {
  const projected = projectPathActionProjection({
    mode: 'persist',
    targetDir,
    platform,
  });
  return { shellActions: projected.shellActions };
}

function buildWindowsShimTriple(shimSrc) {
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

// ─── Subprocess dispatch ──────────────────────────────────────────────────────

function _spawnResult(result, program) {
  if (result.error && result.error.code === 'ENOENT') {
    return { exitCode: 127, stdout: '', stderr: `${program}: not found`, signal: null, error: result.error };
  }
  return {
    exitCode: result.status ?? 1,
    stdout: (result.stdout ?? '').toString().trim(),
    stderr: (result.stderr ?? '').toString().trim(),
    signal: result.signal ?? null,
    error: result.error ?? null,
  };
}

function execGit(args, opts = {}) {
  // Non-interactive defaults: a hung credential prompt or terminal-input
  // probe must surface as a timeout, not block the tool forever. Callers
  // can override via opts.env.
  const env = {
    ...process.env,
    GIT_TERMINAL_PROMPT: '0',
    GCM_INTERACTIVE: 'never',
    ...(opts.env || {}),
  };
  const result = childProcess.spawnSync('git', args, {
    cwd: opts.cwd,
    env,
    encoding: 'utf-8',
    stdio: 'pipe',
    timeout: opts.timeout ?? 10_000,
  });
  return _spawnResult(result, 'git');
}

function execNpm(args, opts = {}) {
  const result = childProcess.spawnSync('npm', args, {
    cwd: opts.cwd,
    shell: process.platform === 'win32',
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: opts.timeout ?? 15_000,
  });
  return _spawnResult(result, 'npm');
}

function execTool(program, args, opts = {}) {
  const result = childProcess.spawnSync(program, args, {
    cwd: opts.cwd,
    env: opts.env ? { ...process.env, ...opts.env } : undefined,
    encoding: 'utf-8',
    stdio: 'pipe',
    timeout: opts.timeout ?? 30_000,
  });
  return _spawnResult(result, program);
}

function probeTty(opts = {}) {
  const platform = opts.platform ?? process.platform;
  if (platform === 'win32') return null;
  try {
    const ttyPath = childProcess.execFileSync('tty', [], {
      encoding: 'utf-8',
      stdio: ['inherit', 'pipe', 'ignore'],
    }).trim();
    if (!ttyPath || ttyPath === 'not a tty') return null;
    return ttyPath;
  } catch {
    return null;
  }
}

// ─── Platform file I/O ────────────────────────────────────────────────────────

function _normalizeMd(content) {
  if (!content || typeof content !== 'string') return content;
  let text = content.replace(/\r\n/g, '\n');
  const lines = text.split('\n');
  const result = [];
  const fenceRegex = /^```/;
  const insideFence = new Array(lines.length);
  let fenceOpen = false;
  for (let i = 0; i < lines.length; i++) {
    if (fenceRegex.test(lines[i].trimEnd())) {
      if (fenceOpen) {
        insideFence[i] = false;
        fenceOpen = false;
      } else {
        insideFence[i] = false;
        fenceOpen = true;
      }
    } else {
      insideFence[i] = fenceOpen;
    }
  }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const prev = i > 0 ? lines[i - 1] : '';
    const prevTrimmed = prev.trimEnd();
    const trimmed = line.trimEnd();
    const isFenceLine = fenceRegex.test(trimmed);
    if (/^#{1,6}\s/.test(trimmed) && i > 0 && prevTrimmed !== '' && prevTrimmed !== '---') result.push('');
    if (isFenceLine && i > 0 && prevTrimmed !== '' && !insideFence[i] && (i === 0 || !insideFence[i - 1] || isFenceLine)) {
      if (i === 0 || !insideFence[i - 1]) result.push('');
    }
    if (/^(\s*[-*+]\s|\s*\d+\.\s)/.test(line) && i > 0 && prevTrimmed !== '' && !/^(\s*[-*+]\s|\s*\d+\.\s)/.test(prev) && prevTrimmed !== '---') result.push('');
    result.push(line);
    if (/^#{1,6}\s/.test(trimmed) && i < lines.length - 1 && (lines[i + 1] ?? '').trimEnd() !== '') result.push('');
    if (/^```\s*$/.test(trimmed) && i > 0 && insideFence[i - 1] && i < lines.length - 1 && (lines[i + 1] ?? '').trimEnd() !== '') result.push('');
    if (/^(\s*[-*+]\s|\s*\d+\.\s)/.test(line) && i < lines.length - 1) {
      const next = lines[i + 1];
      if (next !== undefined && next.trimEnd() !== '' && !/^(\s*[-*+]\s|\s*\d+\.\s)/.test(next) && !/^\s/.test(next)) result.push('');
    }
  }
  text = result.join('\n');
  text = text.replace(/\n{3,}/g, '\n\n');
  text = text.replace(/\n*$/, '\n');
  return text;
}

function normalizeContent(filePath, content, opts = {}) {
  const encoding = opts.encoding ?? 'utf-8';
  const isMd = path.extname(filePath).toLowerCase() === '.md';
  let normalized;
  if (isMd) {
    normalized = _normalizeMd(content);
  } else {
    normalized = (content ?? '').replace(/\r\n/g, '\n').replace(/\n*$/, '\n');
  }
  return { content: normalized, encoding };
}

function platformWriteSync(filePath, content, opts = {}) {
  const { content: normalized, encoding } = normalizeContent(filePath, content, opts);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmpPath = filePath + '.tmp.' + process.pid;
  try {
    fs.writeFileSync(tmpPath, normalized, encoding);
    fs.renameSync(tmpPath, filePath);
  } catch {
    try { fs.unlinkSync(tmpPath); } catch { /* already gone */ }
    fs.writeFileSync(filePath, normalized, encoding);
  }
}

function platformReadSync(filePath, opts = {}) {
  const encoding = opts.encoding ?? 'utf-8';
  try {
    return fs.readFileSync(filePath, encoding);
  } catch (err) {
    if (err.code === 'ENOENT') {
      if (opts.required) throw err;
      return null;
    }
    throw err;
  }
}

function platformEnsureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
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
  isManagedHookCommand,
  projectLegacySettingsHookCommand,
  escapeTomlDoubleQuotedString,
  projectCodexHookTomlCommand,
  projectPathActionProjection,
  renderShellActionLines,
  projectPersistentPathExportActions,
  buildWindowsShimTriple,
  formatSdkPathDiagnostic,
  execGit,
  execNpm,
  execTool,
  probeTty,
  normalizeContent,
  platformWriteSync,
  platformReadSync,
  platformEnsureDir,
};
