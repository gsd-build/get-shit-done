#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');
const crypto = require('crypto');

// Colors
const cyan = '\x1b[36m';
const green = '\x1b[32m';
const yellow = '\x1b[33m';
const red = '\x1b[31m';
const bold = '\x1b[1m';
const dim = '\x1b[2m';
const reset = '\x1b[0m';

// Codex config.toml constants
const GSD_CODEX_MARKER = '# GSD Agent Configuration \u2014 managed by get-shit-done installer';
const GSD_CODEX_HOOKS_OWNERSHIP_PREFIX = '# GSD codex_hooks ownership: ';

// Copilot instructions marker constants
const GSD_COPILOT_INSTRUCTIONS_MARKER = '<!-- GSD Configuration \u2014 managed by get-shit-done installer -->';
const GSD_COPILOT_INSTRUCTIONS_CLOSE_MARKER = '<!-- /GSD Configuration -->';

const CODEX_AGENT_SANDBOX = {
  'gsd-executor': 'workspace-write',
  'gsd-planner': 'workspace-write',
  'gsd-phase-researcher': 'workspace-write',
  'gsd-project-researcher': 'workspace-write',
  'gsd-research-synthesizer': 'workspace-write',
  'gsd-verifier': 'workspace-write',
  'gsd-codebase-mapper': 'workspace-write',
  'gsd-roadmapper': 'workspace-write',
  'gsd-debugger': 'workspace-write',
  'gsd-plan-checker': 'read-only',
  'gsd-integration-checker': 'read-only',
};

// Copilot tool name mapping — Claude Code tools to GitHub Copilot tools
// Tool mapping applies ONLY to agents, NOT to skills (per CONTEXT.md decision)
const claudeToCopilotTools = {
  Read: 'read',
  Write: 'edit',
  Edit: 'edit',
  Bash: 'execute',
  Grep: 'search',
  Glob: 'search',
  Task: 'agent',
  WebSearch: 'web',
  WebFetch: 'web',
  TodoWrite: 'todo',
  AskUserQuestion: 'ask_user',
  SlashCommand: 'skill',
};

// Get version from package.json
const pkg = require('../package.json');

// #2517 — runtime-aware tier resolution shared with core.cjs.
// Hoisted to top with absolute __dirname-based paths so `gsd install codex` works
// when invoked via npm global install (cwd is the user's project, not the gsd repo
// root). Inline `require('../get-shit-done/...')` from inside install functions
// works only because Node resolves it relative to the install.js file regardless
// of cwd, but keeping the require at the top makes the dependency explicit and
// surfaces resolution failures at process start instead of at first install call.
const _gsdLibDir = path.join(__dirname, '..', 'get-shit-done', 'bin', 'lib');
const { MODEL_PROFILES: GSD_MODEL_PROFILES } = require(path.join(_gsdLibDir, 'model-profiles.cjs'));
const {
  RUNTIME_PROFILE_MAP: GSD_RUNTIME_PROFILE_MAP,
  resolveTierEntry: gsdResolveTierEntry,
} = require(path.join(_gsdLibDir, 'core.cjs'));

const {
  MINIMAL_SKILL_ALLOWLIST,
  isMinimalMode,
  stageSkillsForMode,
} = require(path.join(_gsdLibDir, 'install-profiles.cjs'));

// Parse args
const args = process.argv.slice(2);
const hasGlobal = args.includes('--global') || args.includes('-g');
const hasLocal = args.includes('--local') || args.includes('-l');
const hasOpencode = args.includes('--opencode');
const hasClaude = args.includes('--claude');
const hasGemini = args.includes('--gemini');
const hasKilo = args.includes('--kilo');
const hasCodex = args.includes('--codex');
const hasCopilot = args.includes('--copilot');
const hasAntigravity = args.includes('--antigravity');
const hasCursor = args.includes('--cursor');
const hasWindsurf = args.includes('--windsurf');
const hasAugment = args.includes('--augment');
const hasTrae = args.includes('--trae');
const hasQwen = args.includes('--qwen');
const hasHermes = args.includes('--hermes');
const hasCodebuddy = args.includes('--codebuddy');
const hasCline = args.includes('--cline');
const hasBoth = args.includes('--both'); // Legacy flag, keeps working
const hasAll = args.includes('--all');
const hasUninstall = args.includes('--uninstall') || args.includes('-u');
const hasSkillsRoot = args.includes('--skills-root');
const hasPortableHooks = args.includes('--portable-hooks') || process.env.GSD_PORTABLE_HOOKS === '1';
const hasMinimal = args.includes('--minimal') || args.includes('--core-only');
const installMode = hasMinimal ? 'minimal' : 'full';
const hasSdk = args.includes('--sdk');
const hasNoSdk = args.includes('--no-sdk');

if (hasSdk && hasNoSdk) {
  console.error(`  ${yellow}Cannot specify both --sdk and --no-sdk${reset}`);
  process.exit(1);
}

// Runtime selection - can be set by flags or interactive prompt
let selectedRuntimes = [];
if (hasAll) {
  selectedRuntimes = ['claude', 'kilo', 'opencode', 'gemini', 'codex', 'copilot', 'antigravity', 'cursor', 'windsurf', 'augment', 'trae', 'qwen', 'hermes', 'codebuddy', 'cline'];
} else if (hasBoth) {
  selectedRuntimes = ['claude', 'opencode'];
} else {
  if (hasClaude) selectedRuntimes.push('claude');
  if (hasOpencode) selectedRuntimes.push('opencode');
  if (hasGemini) selectedRuntimes.push('gemini');
  if (hasKilo) selectedRuntimes.push('kilo');
  if (hasCodex) selectedRuntimes.push('codex');
  if (hasCopilot) selectedRuntimes.push('copilot');
  if (hasAntigravity) selectedRuntimes.push('antigravity');
  if (hasCursor) selectedRuntimes.push('cursor');
  if (hasWindsurf) selectedRuntimes.push('windsurf');
  if (hasAugment) selectedRuntimes.push('augment');
  if (hasTrae) selectedRuntimes.push('trae');
  if (hasQwen) selectedRuntimes.push('qwen');
  if (hasHermes) selectedRuntimes.push('hermes');
  if (hasCodebuddy) selectedRuntimes.push('codebuddy');
  if (hasCline) selectedRuntimes.push('cline');
}

// WSL + Windows Node.js detection
// When Windows-native Node runs on WSL, os.homedir() and path.join() produce
// backslash paths that don't resolve correctly on the Linux filesystem.
if (process.platform === 'win32') {
  let isWSL = false;
  try {
    if (process.env.WSL_DISTRO_NAME) {
      isWSL = true;
    } else if (fs.existsSync('/proc/version')) {
      const procVersion = fs.readFileSync('/proc/version', 'utf8').toLowerCase();
      if (procVersion.includes('microsoft') || procVersion.includes('wsl')) {
        isWSL = true;
      }
    }
  } catch {
    // Ignore read errors — not WSL
  }

  if (isWSL) {
    console.error(`
${yellow}⚠ Detected WSL with Windows-native Node.js.${reset}

This causes path resolution issues that prevent correct installation.
Please install a Linux-native Node.js inside WSL:

  curl -fsSL https://fnm.vercel.app/install | bash
  fnm install --lts

Then re-run: npx get-shit-done-cc@latest
`);
    process.exit(1);
  }
}

// Helper to get directory name for a runtime (used for local/project installs)
function getDirName(runtime) {
  if (runtime === 'copilot') return '.github';
  if (runtime === 'opencode') return '.opencode';
  if (runtime === 'gemini') return '.gemini';
  if (runtime === 'kilo') return '.kilo';
  if (runtime === 'codex') return '.codex';
  if (runtime === 'antigravity') return '.agent';
  if (runtime === 'cursor') return '.cursor';
  if (runtime === 'windsurf') return '.windsurf';
  if (runtime === 'augment') return '.augment';
  if (runtime === 'trae') return '.trae';
  if (runtime === 'qwen') return '.qwen';
  if (runtime === 'hermes') return '.hermes';
  if (runtime === 'codebuddy') return '.codebuddy';
  if (runtime === 'cline') return '.cline';
  return '.claude';
}

/**
 * Get the config directory path relative to home directory for a runtime
 * Used for templating hooks that use path.join(homeDir, '<configDir>', ...)
 * @param {string} runtime - 'claude', 'opencode', 'gemini', 'codex', or 'copilot'
 * @param {boolean} isGlobal - Whether this is a global install
 */
function getConfigDirFromHome(runtime, isGlobal) {
  if (!isGlobal) {
    // Local installs use the same dir name pattern
    return `'${getDirName(runtime)}'`;
  }
  // Global installs - OpenCode uses XDG path structure
  if (runtime === 'copilot') return "'.copilot'";
  if (runtime === 'opencode') {
    // OpenCode: ~/.config/opencode -> '.config', 'opencode'
    // Return as comma-separated for path.join() replacement
    return "'.config', 'opencode'";
  }
  if (runtime === 'gemini') return "'.gemini'";
  if (runtime === 'kilo') return "'.config', 'kilo'";
  if (runtime === 'codex') return "'.codex'";
  if (runtime === 'antigravity') {
    if (!isGlobal) return "'.agent'";
    return "'.gemini', 'antigravity'";
  }
  if (runtime === 'cursor') return "'.cursor'";
  if (runtime === 'windsurf') return "'.windsurf'";
  if (runtime === 'augment') return "'.augment'";
  if (runtime === 'trae') return "'.trae'";
  if (runtime === 'qwen') return "'.qwen'";
  if (runtime === 'hermes') return "'.hermes'";
  if (runtime === 'codebuddy') return "'.codebuddy'";
  if (runtime === 'cline') return "'.cline'";
  return "'.claude'";
}

/**
 * Get the global config directory for OpenCode
 * OpenCode follows XDG Base Directory spec and uses ~/.config/opencode/
 * Priority: OPENCODE_CONFIG_DIR > dirname(OPENCODE_CONFIG) > XDG_CONFIG_HOME/opencode > ~/.config/opencode
 */
function getOpencodeGlobalDir() {
  // 1. Explicit OPENCODE_CONFIG_DIR env var
  if (process.env.OPENCODE_CONFIG_DIR) {
    return expandTilde(process.env.OPENCODE_CONFIG_DIR);
  }

  // 2. OPENCODE_CONFIG env var (use its directory)
  if (process.env.OPENCODE_CONFIG) {
    return path.dirname(expandTilde(process.env.OPENCODE_CONFIG));
  }

  // 3. XDG_CONFIG_HOME/opencode
  if (process.env.XDG_CONFIG_HOME) {
    return path.join(expandTilde(process.env.XDG_CONFIG_HOME), 'opencode');
  }

  // 4. Default: ~/.config/opencode (XDG default)
  return path.join(os.homedir(), '.config', 'opencode');
}

/**
 * Get the global config directory for Kilo
 * Kilo follows XDG Base Directory spec and uses ~/.config/kilo/
 * Priority: KILO_CONFIG_DIR > dirname(KILO_CONFIG) > XDG_CONFIG_HOME/kilo > ~/.config/kilo
 */
function getKiloGlobalDir() {
  // 1. Explicit KILO_CONFIG_DIR env var
  if (process.env.KILO_CONFIG_DIR) {
    return expandTilde(process.env.KILO_CONFIG_DIR);
  }

  // 2. KILO_CONFIG env var (use its directory)
  if (process.env.KILO_CONFIG) {
    return path.dirname(expandTilde(process.env.KILO_CONFIG));
  }

  // 3. XDG_CONFIG_HOME/kilo
  if (process.env.XDG_CONFIG_HOME) {
    return path.join(expandTilde(process.env.XDG_CONFIG_HOME), 'kilo');
  }

  // 4. Default: ~/.config/kilo (XDG default)
  return path.join(os.homedir(), '.config', 'kilo');
}

/**
 * Get the global config directory for a runtime
 * @param {string} runtime - 'claude', 'opencode', 'gemini', 'codex', or 'copilot'
 * @param {string|null} explicitDir - Explicit directory from --config-dir flag
 */
function getGlobalDir(runtime, explicitDir = null) {
  if (runtime === 'opencode') {
    // For OpenCode, --config-dir overrides env vars
    if (explicitDir) {
      return expandTilde(explicitDir);
    }
    return getOpencodeGlobalDir();
  }

  if (runtime === 'kilo') {
    // For Kilo, --config-dir overrides env vars
    if (explicitDir) {
      return expandTilde(explicitDir);
    }
    return getKiloGlobalDir();
  }

  if (runtime === 'gemini') {
    // Gemini: --config-dir > GEMINI_CONFIG_DIR > ~/.gemini
    if (explicitDir) {
      return expandTilde(explicitDir);
    }
    if (process.env.GEMINI_CONFIG_DIR) {
      return expandTilde(process.env.GEMINI_CONFIG_DIR);
    }
    return path.join(os.homedir(), '.gemini');
  }

  if (runtime === 'codex') {
    // Codex: --config-dir > CODEX_HOME > ~/.codex
    if (explicitDir) {
      return expandTilde(explicitDir);
    }
    if (process.env.CODEX_HOME) {
      return expandTilde(process.env.CODEX_HOME);
    }
    return path.join(os.homedir(), '.codex');
  }

  if (runtime === 'copilot') {
    // Copilot: --config-dir > COPILOT_CONFIG_DIR > ~/.copilot
    if (explicitDir) {
      return expandTilde(explicitDir);
    }
    if (process.env.COPILOT_CONFIG_DIR) {
      return expandTilde(process.env.COPILOT_CONFIG_DIR);
    }
    return path.join(os.homedir(), '.copilot');
  }

  if (runtime === 'antigravity') {
    // Antigravity: --config-dir > ANTIGRAVITY_CONFIG_DIR > ~/.gemini/antigravity
    if (explicitDir) {
      return expandTilde(explicitDir);
    }
    if (process.env.ANTIGRAVITY_CONFIG_DIR) {
      return expandTilde(process.env.ANTIGRAVITY_CONFIG_DIR);
    }
    return path.join(os.homedir(), '.gemini', 'antigravity');
  }

  if (runtime === 'cursor') {
    // Cursor: --config-dir > CURSOR_CONFIG_DIR > ~/.cursor
    if (explicitDir) {
      return expandTilde(explicitDir);
    }
    if (process.env.CURSOR_CONFIG_DIR) {
      return expandTilde(process.env.CURSOR_CONFIG_DIR);
    }
    return path.join(os.homedir(), '.cursor');
  }

  if (runtime === 'windsurf') {
    // Windsurf: --config-dir > WINDSURF_CONFIG_DIR > ~/.codeium/windsurf
    if (explicitDir) {
      return expandTilde(explicitDir);
    }
    if (process.env.WINDSURF_CONFIG_DIR) {
      return expandTilde(process.env.WINDSURF_CONFIG_DIR);
    }
    return path.join(os.homedir(), '.codeium', 'windsurf');
  }

  if (runtime === 'augment') {
    // Augment: --config-dir > AUGMENT_CONFIG_DIR > ~/.augment
    if (explicitDir) {
      return expandTilde(explicitDir);
    }
    if (process.env.AUGMENT_CONFIG_DIR) {
      return expandTilde(process.env.AUGMENT_CONFIG_DIR);
    }
    return path.join(os.homedir(), '.augment');
  }
  if (runtime === 'trae') {
    // Trae: --config-dir > TRAE_CONFIG_DIR > ~/.trae
    if (explicitDir) {
      return expandTilde(explicitDir);
    }
    if (process.env.TRAE_CONFIG_DIR) {
      return expandTilde(process.env.TRAE_CONFIG_DIR);
    }
    return path.join(os.homedir(), '.trae');
  }

  if (runtime === 'qwen') {
    if (explicitDir) {
      return expandTilde(explicitDir);
    }
    if (process.env.QWEN_CONFIG_DIR) {
      return expandTilde(process.env.QWEN_CONFIG_DIR);
    }
    return path.join(os.homedir(), '.qwen');
  }

  if (runtime === 'hermes') {
    // Hermes Agent: --config-dir > HERMES_HOME > ~/.hermes
    // Honors HERMES_HOME which Hermes users set for profile mode / Docker
    // deploys (docs: https://hermes-agent.nousresearch.com/docs).
    if (explicitDir) {
      return expandTilde(explicitDir);
    }
    if (process.env.HERMES_HOME) {
      return expandTilde(process.env.HERMES_HOME);
    }
    return path.join(os.homedir(), '.hermes');
  }

  if (runtime === 'codebuddy') {
    // CodeBuddy: --config-dir > CODEBUDDY_CONFIG_DIR > ~/.codebuddy
    if (explicitDir) {
      return expandTilde(explicitDir);
    }
    if (process.env.CODEBUDDY_CONFIG_DIR) {
      return expandTilde(process.env.CODEBUDDY_CONFIG_DIR);
    }
    return path.join(os.homedir(), '.codebuddy');
  }

  if (runtime === 'cline') {
    // Cline: --config-dir > CLINE_CONFIG_DIR > ~/.cline
    if (explicitDir) {
      return expandTilde(explicitDir);
    }
    if (process.env.CLINE_CONFIG_DIR) {
      return expandTilde(process.env.CLINE_CONFIG_DIR);
    }
    return path.join(os.homedir(), '.cline');
  }

  // Claude Code: --config-dir > CLAUDE_CONFIG_DIR > ~/.claude
  if (explicitDir) {
    return expandTilde(explicitDir);
  }
  if (process.env.CLAUDE_CONFIG_DIR) {
    return expandTilde(process.env.CLAUDE_CONFIG_DIR);
  }
  return path.join(os.homedir(), '.claude');
}

const banner = '\n' +
  cyan + '   ██████╗ ███████╗██████╗\n' +
  '  ██╔════╝ ██╔════╝██╔══██╗\n' +
  '  ██║  ███╗███████╗██║  ██║\n' +
  '  ██║   ██║╚════██║██║  ██║\n' +
  '  ╚██████╔╝███████║██████╔╝\n' +
  '   ╚═════╝ ╚══════╝╚═════╝' + reset + '\n' +
  '\n' +
  '  Get Shit Done ' + dim + 'v' + pkg.version + reset + '\n' +
  '  A meta-prompting, context engineering and spec-driven\n' +
  '  development system for Claude Code, OpenCode, Gemini, Kilo, Codex, Copilot, Antigravity, Cursor, Windsurf, Augment, Trae, Qwen Code, Hermes Agent, Cline and CodeBuddy by TÂCHES.\n';

// Parse --config-dir argument
function parseConfigDirArg() {
  const configDirIndex = args.findIndex(arg => arg === '--config-dir' || arg === '-c');
  if (configDirIndex !== -1) {
    const nextArg = args[configDirIndex + 1];
    // Error if --config-dir is provided without a value or next arg is another flag
    if (!nextArg || nextArg.startsWith('-')) {
      console.error(`  ${yellow}--config-dir requires a path argument${reset}`);
      process.exit(1);
    }
    return nextArg;
  }
  // Also handle --config-dir=value format
  const configDirArg = args.find(arg => arg.startsWith('--config-dir=') || arg.startsWith('-c='));
  if (configDirArg) {
    const value = configDirArg.split('=')[1];
    if (!value) {
      console.error(`  ${yellow}--config-dir requires a non-empty path${reset}`);
      process.exit(1);
    }
    return value;
  }
  return null;
}
const explicitConfigDir = parseConfigDirArg();
const hasHelp = args.includes('--help') || args.includes('-h');
const forceStatusline = args.includes('--force-statusline');

if (!hasSkillsRoot) console.log(banner);

if (hasUninstall) {
  console.log('  Mode: Uninstall\n');
}

// Show help if requested
if (hasHelp) {
  console.log(`  ${yellow}Usage:${reset} npx get-shit-done-cc [options]\n\n  ${yellow}Options:${reset}\n    ${cyan}-g, --global${reset}              Install globally (to config directory)\n    ${cyan}-l, --local${reset}               Install locally (to current directory)\n    ${cyan}--claude${reset}                  Install for Claude Code only\n    ${cyan}--opencode${reset}                Install for OpenCode only\n    ${cyan}--gemini${reset}                  Install for Gemini only\n    ${cyan}--kilo${reset}                    Install for Kilo only\n    ${cyan}--codex${reset}                   Install for Codex only\n    ${cyan}--copilot${reset}                 Install for Copilot only\n    ${cyan}--antigravity${reset}             Install for Antigravity only\n    ${cyan}--cursor${reset}                  Install for Cursor only\n    ${cyan}--windsurf${reset}                Install for Windsurf only\n    ${cyan}--augment${reset}                 Install for Augment only\n    ${cyan}--trae${reset}                    Install for Trae only\n    ${cyan}--qwen${reset}                    Install for Qwen Code only\n    ${cyan}--hermes${reset}                  Install for Hermes Agent only\n    ${cyan}--cline${reset}                   Install for Cline only\n    ${cyan}--codebuddy${reset}              Install for CodeBuddy only\n    ${cyan}--all${reset}                     Install for all runtimes\n    ${cyan}-u, --uninstall${reset}           Uninstall GSD (remove all GSD files)\n    ${cyan}-c, --config-dir <path>${reset}   Specify custom config directory\n    ${cyan}-h, --help${reset}                Show this help message\n    ${cyan}--force-statusline${reset}        Replace existing statusline config\n    ${cyan}--portable-hooks${reset}          Emit \$HOME-relative hook paths in settings.json\n                              (for WSL/Docker bind-mount setups; also GSD_PORTABLE_HOOKS=1)\n    ${cyan}--minimal${reset}                 Install only the main-loop skills (new-project,\n                              discuss-phase, plan-phase, execute-phase, help, update)\n                              and zero gsd-* subagents. Cuts cold-start system-prompt\n                              overhead from ~12k tokens to ~700 — useful for local LLMs\n                              with 32K–128K context. Re-run \`gsd update\` (without --minimal)\n                              to expand to the full surface. Alias: --core-only.\n\n  ${yellow}Examples:${reset}\n    ${dim}# Interactive install (prompts for runtime and location)${reset}\n    npx get-shit-done-cc\n\n    ${dim}# Install for Claude Code globally${reset}\n    npx get-shit-done-cc --claude --global\n\n    ${dim}# Install for Gemini globally${reset}\n    npx get-shit-done-cc --gemini --global\n\n    ${dim}# Install for Kilo globally${reset}\n    npx get-shit-done-cc --kilo --global\n\n    ${dim}# Install for Codex globally${reset}\n    npx get-shit-done-cc --codex --global\n\n    ${dim}# Install for Copilot globally${reset}\n    npx get-shit-done-cc --copilot --global\n\n    ${dim}# Install for Copilot locally${reset}\n    npx get-shit-done-cc --copilot --local\n\n    ${dim}# Install for Antigravity globally${reset}\n    npx get-shit-done-cc --antigravity --global\n\n    ${dim}# Install for Antigravity locally${reset}\n    npx get-shit-done-cc --antigravity --local\n\n    ${dim}# Install for Cursor globally${reset}\n    npx get-shit-done-cc --cursor --global\n\n    ${dim}# Install for Cursor locally${reset}\n    npx get-shit-done-cc --cursor --local\n\n    ${dim}# Install for Windsurf globally${reset}\n    npx get-shit-done-cc --windsurf --global\n\n    ${dim}# Install for Windsurf locally${reset}\n    npx get-shit-done-cc --windsurf --local\n\n    ${dim}# Install for Augment globally${reset}\n    npx get-shit-done-cc --augment --global\n\n    ${dim}# Install for Augment locally${reset}\n    npx get-shit-done-cc --augment --local\n\n    ${dim}# Install for Trae globally${reset}\n    npx get-shit-done-cc --trae --global\n\n    ${dim}# Install for Trae locally${reset}\n    npx get-shit-done-cc --trae --local\n\n    ${dim}# Install for Hermes Agent globally${reset}\n    npx get-shit-done-cc --hermes --global\n\n    ${dim}# Install for Hermes Agent locally${reset}\n    npx get-shit-done-cc --hermes --local\n\n    ${dim}# Install for Cline locally${reset}\n    npx get-shit-done-cc --cline --local\n\n    ${dim}# Install for CodeBuddy globally${reset}\n    npx get-shit-done-cc --codebuddy --global\n\n    ${dim}# Install for CodeBuddy locally${reset}\n    npx get-shit-done-cc --codebuddy --local\n\n    ${dim}# Install for all runtimes globally${reset}\n    npx get-shit-done-cc --all --global\n\n    ${dim}# Install to custom config directory${reset}\n    npx get-shit-done-cc --kilo --global --config-dir ~/.kilo-work\n\n    ${dim}# Install to current project only${reset}\n    npx get-shit-done-cc --claude --local\n\n    ${dim}# Uninstall GSD from Cursor globally${reset}\n    npx get-shit-done-cc --cursor --global --uninstall\n\n  ${yellow}Notes:${reset}\n    The --config-dir option is useful when you have multiple configurations.\n    It takes priority over CLAUDE_CONFIG_DIR / OPENCODE_CONFIG_DIR / GEMINI_CONFIG_DIR / KILO_CONFIG_DIR / CODEX_HOME / COPILOT_CONFIG_DIR / ANTIGRAVITY_CONFIG_DIR / CURSOR_CONFIG_DIR / WINDSURF_CONFIG_DIR / AUGMENT_CONFIG_DIR / TRAE_CONFIG_DIR / QWEN_CONFIG_DIR / HERMES_HOME / CLINE_CONFIG_DIR / CODEBUDDY_CONFIG_DIR environment variables.\n`);
  process.exit(0);
}

/**
 * Expand ~ to home directory (shell doesn't expand in env vars passed to node)
 */
function expandTilde(filePath) {
  if (filePath && filePath.startsWith('~/')) {
    return path.join(os.homedir(), filePath.slice(2));
  }
  return filePath;
}

/**
 * Compute the path prefix used for `@file` references in installed command/skill
 * markdown. For global installs into a runtime config dir under $HOME, we
 * normally substitute the home prefix with `$HOME` so paths expand correctly
 * inside double-quoted shell commands. OpenCode is exempt on every platform:
 * its `@file` include syntax does NOT shell-expand `$HOME`, so a literal
 * `@$HOME/...` is treated as a path relative to the config command/ dir, which
 * resolves to `command/$HOME/...` (file not found). For OpenCode we always emit
 * the absolute resolved path. (#2376 Windows, #2831 macOS/Linux.)
 *
 * @param {object} args
 * @param {boolean} args.isGlobal - Global runtime install vs local project
 * @param {boolean} args.isOpencode - Whether the runtime is OpenCode
 * @param {boolean} args.isWindowsHost - process.platform === 'win32'
 * @param {string} args.resolvedTarget - Absolute target dir, forward-slashed
 * @param {string} args.homeDir - User home dir, forward-slashed
 * @returns {string} pathPrefix ending with '/'
 */
function computePathPrefix({ isGlobal, isOpencode, isWindowsHost: _isWindowsHost, resolvedTarget, homeDir }) {
  if (isGlobal && resolvedTarget.startsWith(homeDir) && !isOpencode) {
    return '$HOME' + resolvedTarget.slice(homeDir.length) + '/';
  }
  return `${resolvedTarget}/`;
}

/**
 * Resolve the absolute path to the node binary running the installer.
 * Used as the runner for .js hooks so they execute in GUI/minimal-PATH
 * runtimes (Gemini, Antigravity, Codex CLIs launched from a Finder
 * shortcut etc.) where bare `node` is not on `/usr/bin:/bin:/usr/sbin:/sbin`
 * and the hook would fail with `node: command not found` (#2979).
 *
 * Returns a forward-slash-normalized, double-quoted path so the emitted
 * command is shell-safe across POSIX and Windows. `process.execPath`
 * gives the absolute path of the node binary actively running the
 * installer — that is the version the user just installed under, and
 * the right default runtime for hooks invoked under the same install.
 */
function resolveNodeRunner() {
  const execPath = typeof process.execPath === 'string' ? process.execPath : '';
  if (!execPath) return null;
  // JSON.stringify produces a properly escaped double-quoted shell token,
  // safe for paths containing spaces or unusual characters.
  return JSON.stringify(execPath.replace(/\\/g, '/'));
}

/**
 * Rewrite legacy `node .../gsd-*.js` command strings in settings.hooks to use
 * the absolute Node binary path (#2979 follow-up: CR feedback on #3002).
 *
 * The original #2979 fix only emitted absolute paths for *newly registered*
 * hooks. Pre-existing entries kept their bare `node ` prefix on reinstall,
 * which left them broken under minimal-PATH GUI runtimes — exactly the
 * failure mode the original fix was meant to close. This walker normalizes
 * any managed-hook entry whose command starts with bare `node ` to
 * `<absoluteRunner> <script>` while leaving non-managed and non-bare-node
 * entries (user-authored hooks, shell scripts, etc.) untouched.
 *
 * Returns true if any entry was rewritten.
 */
function rewriteLegacyManagedNodeHookCommands(settings, absoluteRunner) {
  if (!settings || !settings.hooks || !absoluteRunner) return false;
  const MANAGED_HOOK_FILES = new Set([
    'gsd-check-update.js',
    'gsd-statusline.js',
    'gsd-context-monitor.js',
    'gsd-prompt-guard.js',
    'gsd-read-guard.js',
    'gsd-read-injection-scanner.js',
    'gsd-update-banner.js',
    'gsd-workflow-guard.js',
  ]);
  let changed = false;
  for (const entries of Object.values(settings.hooks)) {
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      if (!entry || !Array.isArray(entry.hooks)) continue;
      for (const h of entry.hooks) {
        if (!h || typeof h.command !== 'string') continue;
        const trimmed = h.command.trim();
        // Match the EXACT legacy form: `node <script>` with optional quoting.
        // The previous shape used `trimmed.includes(<filename>)` which would
        // false-positive on user-authored hooks whose path merely contained
        // a managed filename as a substring (e.g.
        // /home/me/scripts/wraps-gsd-check-update.js-and-more.js). #3002 CR.
        const m = trimmed.match(/^node\s+("([^"]+)"|'([^']+)'|(\S+))\s*$/);
        if (!m) continue;
        const scriptToken = m[1];
        const scriptPath = m[2] || m[3] || m[4] || '';
        // Take the basename — match against MANAGED_HOOK_FILES by exact
        // equality, not substring containment. Handles both forward and
        // backslash separators (Windows).
        const scriptBase = scriptPath.split(/[\\/]/).pop() || '';
        if (!MANAGED_HOOK_FILES.has(scriptBase)) continue;
        h.command = `${absoluteRunner} ${scriptToken}`;
        changed = true;
      }
    }
  }
  return changed;
}

/**
 * Codex managed-hook filenames eligible for legacy-bare-node migration.
 * Mirrors the settings.json allowlist in rewriteLegacyManagedNodeHookCommands.
 * Centralized so the codex toml branch and the settings.json branch can't drift.
 */
const CODEX_MANAGED_HOOK_BASENAMES = new Set([
  'gsd-check-update.js',
]);

/**
 * Build the GSD-managed Codex SessionStart hook block for config.toml.
 *
 * Issue #3017: the previous shape inlined `command = "node ${path}"` which
 * fails under GUI/minimal-PATH runtimes where bare `node` doesn't resolve
 * (same failure mode as #2979 → fixed for settings.json by #3002, this
 * helper closes the gap for Codex's TOML hook surface).
 *
 * Returns null when `absoluteRunner` is null so callers can warn-and-skip
 * registration — emitting a broken bare-node hook is strictly worse than
 * not registering one (the user can re-run install once node is on PATH).
 *
 * @param {string} targetDir - Resolved absolute Codex config dir (e.g. ~/.codex).
 * @param {{ absoluteRunner: string|null, eol?: string }} opts
 *   absoluteRunner: result of resolveNodeRunner() — a JSON-stringified
 *   absolute node path with forward slashes (e.g. `"/usr/local/bin/node"`),
 *   or null when process.execPath was unavailable.
 *   eol: line ending to emit ('\n' or '\r\n') — caller passes
 *   detectLineEnding(configContent) so existing CRLF files stay CRLF.
 *   Defaults to '\n'.
 * @returns {string|null} The toml block to append, or null on missing runner.
 */
function buildCodexHookBlock(targetDir, opts) {
  const absoluteRunner = opts && opts.absoluteRunner;
  if (!absoluteRunner) return null;
  const eol = (opts && opts.eol) || '\n';
  const updateCheckScript = path.resolve(targetDir, 'hooks', 'gsd-check-update.js').replace(/\\/g, '/');
  // toml requires escaped interior quotes (\"). The runner is already a
  // JSON-stringified token (with literal " around the absolute path); we
  // need to escape those quotes so the toml parser sees them as part of
  // the string value, not as the closing quote of the command field.
  const runnerEscaped = absoluteRunner.replace(/"/g, '\\"');
  const hookPathEscaped = updateCheckScript.replace(/"/g, '\\"');
  return `${eol}# GSD Hooks${eol}` +
    `[[hooks.SessionStart]]${eol}` +
    `${eol}` +
    `[[hooks.SessionStart.hooks]]${eol}` +
    `type = "command"${eol}` +
    `command = "${runnerEscaped} \\"${hookPathEscaped}\\""${eol}`;
}

/**
 * Rewrite legacy bare-`node` managed-hook command lines in a Codex
 * config.toml string to use the absolute Node runner. Mirror of
 * rewriteLegacyManagedNodeHookCommands but for the toml surface (#3017).
 *
 * Only rewrites entries whose script basename matches CODEX_MANAGED_HOOK_BASENAMES
 * (basename equality, not substring containment) — user-authored bare-node
 * hooks pointing at scripts outside the managed allowlist are left alone.
 *
 * @param {string} content - Current config.toml contents.
 * @param {string|null} absoluteRunner - Result of resolveNodeRunner().
 * @returns {{ content: string, changed: boolean }}
 */
function rewriteLegacyCodexHookBlock(content, absoluteRunner) {
  if (!content || !absoluteRunner) return { content, changed: false };
  let changed = false;
  // Match `command = "node <scriptToken>"` lines where scriptToken is
  // either an unquoted path (no spaces) or a toml-escaped quoted path.
  // The whole RHS is a toml-double-quoted string; interior quotes are \".
  // Examples we want to migrate:
  //   command = "node /Users/x/.codex/hooks/gsd-check-update.js"
  //   command = "node \"/Users/x/.codex/hooks/gsd-check-update.js\""
  // Examples we must leave alone:
  //   command = "\"/usr/local/bin/node\" \"/path/to/gsd-check-update.js\""  ← already absolute
  //   command = "node /home/me/my-custom.js"                                ← user-owned filename
  const updated = content.replace(
    /^(command\s*=\s*")node\s+((?:\\"[^"]+\\"|\S+))("\s*)$/gm,
    (full, prefix, scriptToken, suffix) => {
      // Extract the underlying script path from the captured token —
      // either the bare token or the inner content of \"...\".
      const quoted = scriptToken.match(/^\\"(.+)\\"$/);
      const scriptPath = quoted ? quoted[1] : scriptToken;
      const base = scriptPath.split(/[\\/]/).pop() || '';
      if (!CODEX_MANAGED_HOOK_BASENAMES.has(base)) return full;
      changed = true;
      const runnerEscaped = absoluteRunner.replace(/"/g, '\\"');
      // Always re-quote the path on output for consistency with the new
      // builder's shape.
      return `${prefix}${runnerEscaped} \\"${scriptPath}\\"${suffix}`;
    },
  );
  return { content: updated, changed };
}

/**
 * Build a hook command path using forward slashes for cross-platform compatibility.
 * On Windows, $HOME is not expanded by cmd.exe/PowerShell, so we use the actual path.
 *
 * @param {string} configDir - Resolved absolute config directory path
 * @param {string} hookName - Hook filename (e.g. 'gsd-statusline.js')
 * @param {{ portableHooks?: boolean }} [opts] - Options
 *   portableHooks: when true, emit $HOME-relative paths instead of absolute paths.
 *   Safe for Linux/macOS global installs and WSL/Docker bind-mount scenarios.
 *   Not suitable for pure Windows (cmd.exe/PowerShell do not expand $HOME).
 */
function buildHookCommand(configDir, hookName, opts) {
  if (!opts) opts = {};
  // .sh hooks run under /bin/bash (POSIX std PATH always includes /bin),
  // so bare `bash` is fine. .js hooks need the absolute node path because
  // GUI-launched runtimes start with a minimal PATH that does not include
  // nvm/Homebrew/Volta-installed node binaries (#2979).
  const nodeRunner = resolveNodeRunner();
  const runner = hookName.endsWith('.sh') ? 'bash' : nodeRunner;
  // resolveNodeRunner returns null when process.execPath is unavailable.
  // Fall through with null so callers can skip registration with a warning
  // instead of emitting bare `node` (which would recreate the #2979 bug).
  if (runner === null) return null;

  if (opts.portableHooks) {
    // Replace the home directory prefix with $HOME so the path works when
    // ~/.claude is bind-mounted into a container at a different absolute path.
    const home = os.homedir().replace(/\\/g, '/');
    const normalized = configDir.replace(/\\/g, '/');
    const relative = normalized.startsWith(home)
      ? '$HOME' + normalized.slice(home.length)
      : normalized;
    return `${runner} "${relative}/hooks/${hookName}"`;
  }

  // Default: absolute path with forward slashes (Windows-safe, fixes #2045/#2046).
  const hooksPath = configDir.replace(/\\/g, '/') + '/hooks/' + hookName;
  return `${runner} "${hooksPath}"`;
}

/**
 * Resolve the opencode config file path, preferring .jsonc if it exists.
 */
function resolveOpencodeConfigPath(configDir) {
  const jsoncPath = path.join(configDir, 'opencode.jsonc');
  if (fs.existsSync(jsoncPath)) {
    return jsoncPath;
  }
  return path.join(configDir, 'opencode.json');
}

/**
 * Resolve the Kilo config file path, preferring .jsonc if it exists.
 */
function resolveKiloConfigPath(configDir) {
  const jsoncPath = path.join(configDir, 'kilo.jsonc');
  if (fs.existsSync(jsoncPath)) {
    return jsoncPath;
  }
  return path.join(configDir, 'kilo.json');
}

/**
 * Strip JSONC comments (// and /* *​/) from a string to produce valid JSON.
 * Handles comments inside strings correctly (does not strip them).
 */
function stripJsonComments(text) {
  let result = '';
  let i = 0;
  let inString = false;
  let stringChar = '';
  while (i < text.length) {
    // Handle string literals — don't strip comments inside strings
    if (inString) {
      if (text[i] === '\\') {
        result += text[i] + (text[i + 1] || '');
        i += 2;
        continue;
      }
      if (text[i] === stringChar) {
        inString = false;
      }
      result += text[i];
      i++;
      continue;
    }
    // Start of string
    if (text[i] === '"' || text[i] === "'") {
      inString = true;
      stringChar = text[i];
      result += text[i];
      i++;
      continue;
    }
    // Line comment
    if (text[i] === '/' && text[i + 1] === '/') {
      // Skip to end of line
      while (i < text.length && text[i] !== '\n') i++;
      continue;
    }
    // Block comment
    if (text[i] === '/' && text[i + 1] === '*') {
      i += 2;
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++;
      i += 2; // skip closing */
      continue;
    }
    result += text[i];
    i++;
  }
  // Remove trailing commas before } or ] (common in JSONC)
  return result.replace(/,\s*([}\]])/g, '$1');
}

/**
 * Read and parse settings.json, returning empty object if it doesn't exist.
 * Supports JSONC (JSON with comments) — many CLI tools allow comments in
 * their settings files, so we strip them before parsing to avoid silent
 * data loss from JSON.parse failures.
 */
function readSettings(settingsPath) {
  if (fs.existsSync(settingsPath)) {
    try {
      const raw = fs.readFileSync(settingsPath, 'utf8');
      // Try standard JSON first (fast path)
      try {
        return JSON.parse(raw);
      } catch {
        // Fall back to JSONC stripping
        return JSON.parse(stripJsonComments(raw));
      }
    } catch (e) {
      // If even JSONC stripping fails, warn instead of silently returning {}
      console.warn('  ' + yellow + '⚠' + reset + '  Warning: Could not parse ' + settingsPath + ' — file may be malformed. Existing settings preserved.');
      return null;
    }
  }
  return {};
}

/**
 * Write settings.json with proper formatting
 */
function writeSettings(settingsPath, settings) {
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
}

/**
 * Read model_overrides from ~/.gsd/defaults.json at install time.
 * Returns an object mapping agent names to model IDs, or null if the file
 * doesn't exist or has no model_overrides entry.
 * Used by Codex TOML and OpenCode agent file generators to embed per-agent
 * model assignments so that model_overrides is respected on non-Claude runtimes (#2256).
 */
function readGsdGlobalModelOverrides() {
  try {
    const defaultsPath = path.join(os.homedir(), '.gsd', 'defaults.json');
    if (!fs.existsSync(defaultsPath)) return null;
    const raw = fs.readFileSync(defaultsPath, 'utf-8');
    const parsed = JSON.parse(raw);
    const overrides = parsed.model_overrides;
    if (!overrides || typeof overrides !== 'object') return null;
    return overrides;
  } catch {
    return null;
  }
}

/**
 * Effective per-agent model_overrides for the Codex / OpenCode install paths.
 *
 * Merges `~/.gsd/defaults.json` (global) with per-project
 * `<project>/.planning/config.json`. Per-project keys win on conflict so a
 * user can tune a single agent's model in one repo without re-setting the
 * global defaults for every other repo. Non-conflicting keys from both
 * sources are preserved.
 *
 * This is the fix for #2256: both adapters previously read only the global
 * file, so a per-project `model_overrides` (the common case the reporter
 * described — a per-project override for `gsd-codebase-mapper` in
 * `.planning/config.json`) was silently dropped and child agents inherited
 * the session default.
 *
 * `targetDir` is the consuming runtime's install root (e.g. `~/.codex` for
 * a global install, or `<project>/.codex` for a local install). We walk up
 * from there looking for `.planning/` so both cases resolve the correct
 * project root. When `targetDir` is null/undefined only the global file is
 * consulted (matches prior behavior for code paths that have no project
 * context).
 *
 * Returns a plain `{ agentName: modelId }` object, or `null` when neither
 * source defines `model_overrides`.
 */
function readGsdEffectiveModelOverrides(targetDir = null) {
  const global = readGsdGlobalModelOverrides();

  let projectOverrides = null;
  if (targetDir) {
    let probeDir = path.resolve(targetDir);
    for (let depth = 0; depth < 8; depth += 1) {
      const candidate = path.join(probeDir, '.planning', 'config.json');
      if (fs.existsSync(candidate)) {
        try {
          const parsed = JSON.parse(fs.readFileSync(candidate, 'utf-8'));
          if (parsed && typeof parsed === 'object' && parsed.model_overrides
              && typeof parsed.model_overrides === 'object') {
            projectOverrides = parsed.model_overrides;
          }
        } catch {
          // Malformed config.json — fall back to global; readGsdRuntimeProfileResolver
          // surfaces a parse warning via _readGsdConfigFile already.
        }
        break;
      }
      const parent = path.dirname(probeDir);
      if (parent === probeDir) break;
      probeDir = parent;
    }
  }

  if (!global && !projectOverrides) return null;
  // Per-project wins on conflict; preserve non-conflicting global keys.
  return { ...(global || {}), ...(projectOverrides || {}) };
}

/**
 * #2517 — Read a single GSD config file (defaults.json or per-project
 * config.json) into a plain object, returning null on missing/empty files
 * and warning to stderr on JSON parse failures so silent corruption can't
 * mask broken configs (review finding #5).
 */
function _readGsdConfigFile(absPath, label) {
  if (!fs.existsSync(absPath)) return null;
  let raw;
  try {
    raw = fs.readFileSync(absPath, 'utf-8');
  } catch (err) {
    process.stderr.write(`gsd: warning — could not read ${label} (${absPath}): ${err.message}\n`);
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    process.stderr.write(`gsd: warning — invalid JSON in ${label} (${absPath}): ${err.message}\n`);
    return null;
  }
}

/**
 * #2517 — Build a runtime-aware tier resolver for the install path.
 *
 * Probes BOTH per-project `<targetDir>/.planning/config.json` AND
 * `~/.gsd/defaults.json`, with per-project keys winning over global. This
 * matches `loadConfig`'s precedence and is the only way the PR's headline claim
 * — "set runtime in .planning/config.json and the Codex TOML emit picks it up"
 * — actually holds end-to-end (review finding #1).
 *
 * `targetDir` should be the consuming runtime's install root — install code
 * passes `path.dirname(<runtime root>)` so `.planning/config.json` resolves
 * relative to the user's project. When `targetDir` is null/undefined, only the
 * global defaults are consulted.
 *
 * Returns null if no `runtime` is configured (preserves prior behavior — only
 * model_overrides is embedded, no tier/reasoning-effort inference). Returns
 * null when `model_profile` is `inherit` so the literal alias passes through
 * unchanged.
 *
 * Returns { runtime, resolve(agentName) -> { model, reasoning_effort? } | null }
 */
function readGsdRuntimeProfileResolver(targetDir = null) {
  const homeDefaults = _readGsdConfigFile(
    path.join(os.homedir(), '.gsd', 'defaults.json'),
    '~/.gsd/defaults.json'
  );

  // Per-project config probe. Resolve the project root by walking up from
  // targetDir until we hit a `.planning/` directory; this covers both the
  // common case (caller passes the project root) and the case where caller
  // passes a nested install dir like `<root>/.codex/`.
  let projectConfig = null;
  if (targetDir) {
    let probeDir = path.resolve(targetDir);
    for (let depth = 0; depth < 8; depth += 1) {
      const candidate = path.join(probeDir, '.planning', 'config.json');
      if (fs.existsSync(candidate)) {
        projectConfig = _readGsdConfigFile(candidate, '.planning/config.json');
        break;
      }
      const parent = path.dirname(probeDir);
      if (parent === probeDir) break;
      probeDir = parent;
    }
  }

  // Per-project wins. Only fall back to ~/.gsd/defaults.json when the project
  // didn't set the field. Field-level merge (not whole-object replace) so a
  // user can keep `runtime` global while overriding only `model_profile` per
  // project, and vice versa.
  const merged = {
    runtime:
      (projectConfig && projectConfig.runtime) ||
      (homeDefaults && homeDefaults.runtime) ||
      null,
    model_profile:
      (projectConfig && projectConfig.model_profile) ||
      (homeDefaults && homeDefaults.model_profile) ||
      'balanced',
    model_profile_overrides:
      (projectConfig && projectConfig.model_profile_overrides) ||
      (homeDefaults && homeDefaults.model_profile_overrides) ||
      null,
  };

  if (!merged.runtime) return null;

  const profile = String(merged.model_profile).toLowerCase();
  if (profile === 'inherit') return null;

  return {
    runtime: merged.runtime,
    resolve(agentName) {
      const agentModels = GSD_MODEL_PROFILES[agentName];
      if (!agentModels) return null;
      const tier = agentModels[profile] || agentModels.balanced;
      if (!tier) return null;
      return gsdResolveTierEntry({
        runtime: merged.runtime,
        tier,
        overrides: merged.model_profile_overrides,
      });
    },
  };
}

// Cache for attribution settings (populated once per runtime during install)
const attributionCache = new Map();

/**
 * Get commit attribution setting for a runtime
 * @param {string} runtime - 'claude', 'opencode', 'gemini', 'codex', or 'copilot'
 * @returns {null|undefined|string} null = remove, undefined = keep default, string = custom
 */
function getCommitAttribution(runtime) {
  // Return cached value if available
  if (attributionCache.has(runtime)) {
    return attributionCache.get(runtime);
  }

  let result;

  if (runtime === 'opencode' || runtime === 'kilo') {
    const resolveConfigPath = runtime === 'opencode'
      ? resolveOpencodeConfigPath
      : resolveKiloConfigPath;
    const config = readSettings(resolveConfigPath(getGlobalDir(runtime, null)));
    result = (config && config.disable_ai_attribution === true) ? null : undefined;
  } else if (runtime === 'gemini') {
    // Gemini: check gemini settings.json for attribution config
    const settings = readSettings(path.join(getGlobalDir('gemini', explicitConfigDir), 'settings.json'));
    if (!settings || !settings.attribution || settings.attribution.commit === undefined) {
      result = undefined;
    } else if (settings.attribution.commit === '') {
      result = null;
    } else {
      result = settings.attribution.commit;
    }
  } else if (runtime === 'claude') {
    // Claude Code
    const settings = readSettings(path.join(getGlobalDir('claude', explicitConfigDir), 'settings.json'));
    if (!settings || !settings.attribution || settings.attribution.commit === undefined) {
      result = undefined;
    } else if (settings.attribution.commit === '') {
      result = null;
    } else {
      result = settings.attribution.commit;
    }
  } else {
    // Codex and Copilot currently have no attribution setting equivalent
    result = undefined;
  }

  // Cache and return
  attributionCache.set(runtime, result);
  return result;
}

/**
 * Process Co-Authored-By lines based on attribution setting
 * @param {string} content - File content to process
 * @param {null|undefined|string} attribution - null=remove, undefined=keep, string=replace
 * @returns {string} Processed content
 */
function processAttribution(content, attribution) {
  if (attribution === null) {
    // Remove Co-Authored-By lines and the preceding blank line
    return content.replace(/(\r?\n){2}Co-Authored-By:.*$/gim, '');
  }
  if (attribution === undefined) {
    return content;
  }
  // Replace with custom attribution (escape $ to prevent backreference injection)
  const safeAttribution = attribution.replace(/\$/g, '$$$$');
  return content.replace(/Co-Authored-By:.*$/gim, `Co-Authored-By: ${safeAttribution}`);
}

/**
 * Convert Claude Code frontmatter to opencode format
 * - Converts 'allowed-tools:' array to 'permission:' object
 * @param {string} content - Markdown file content with YAML frontmatter
 * @returns {string} - Content with converted frontmatter
 */
// Color name to hex mapping for opencode compatibility
const colorNameToHex = {
  cyan: '#00FFFF',
  red: '#FF0000',
  green: '#00FF00',
  blue: '#0000FF',
  yellow: '#FFFF00',
  magenta: '#FF00FF',
  orange: '#FFA500',
  purple: '#800080',
  pink: '#FFC0CB',
  white: '#FFFFFF',
  black: '#000000',
  gray: '#808080',
  grey: '#808080',
};

// Tool name mapping from Claude Code to OpenCode
// OpenCode uses lowercase tool names; special mappings for renamed tools
const claudeToOpencodeTools = {
  AskUserQuestion: 'question',
  SlashCommand: 'skill',
  TodoWrite: 'todowrite',
  WebFetch: 'webfetch',
  WebSearch: 'websearch',  // Plugin/MCP - keep for compatibility
};

// Tool name mapping from Claude Code to Gemini CLI
// Gemini CLI uses snake_case built-in tool names
const claudeToGeminiTools = {
  Read: 'read_file',
  Write: 'write_file',
  Edit: 'replace',
  Bash: 'run_shell_command',
  Glob: 'glob',
  Grep: 'search_file_content',
  WebSearch: 'google_web_search',
  WebFetch: 'web_fetch',
  TodoWrite: 'write_todos',
  AskUserQuestion: 'ask_user',
};

/**
 * Convert a Claude Code tool name to OpenCode format
 * - Applies special mappings (AskUserQuestion -> question, etc.)
 * - Converts to lowercase (except MCP tools which keep their format)
 */
function convertToolName(claudeTool) {
  // Check for special mapping first
  if (claudeToOpencodeTools[claudeTool]) {
    return claudeToOpencodeTools[claudeTool];
  }
  // MCP tools (mcp__*) keep their format
  if (claudeTool.startsWith('mcp__')) {
    return claudeTool;
  }
  // Default: convert to lowercase
  return claudeTool.toLowerCase();
}

/**
 * Convert a Claude Code tool name to Gemini CLI format
 * - Applies Claude→Gemini mapping (Read→read_file, Bash→run_shell_command, etc.)
 * - Filters out MCP tools (mcp__*) — they are auto-discovered at runtime in Gemini
 * - Filters out Task — agents are auto-registered as tools in Gemini
 * @returns {string|null} Gemini tool name, or null if tool should be excluded
 */
function convertGeminiToolName(claudeTool) {
  // MCP tools: exclude — auto-discovered from mcpServers config at runtime
  if (claudeTool.startsWith('mcp__')) {
    return null;
  }
  // Task: exclude — agents are auto-registered as callable tools
  if (claudeTool === 'Task') {
    return null;
  }
  // Check for explicit mapping
  if (claudeToGeminiTools[claudeTool]) {
    return claudeToGeminiTools[claudeTool];
  }
  // Default: lowercase
  return claudeTool.toLowerCase();
}

const claudeToKiloAgentPermissions = {
  Read: 'read',
  Write: 'edit',
  Edit: 'edit',
  Bash: 'bash',
  Grep: 'grep',
  Glob: 'glob',
  Task: 'task',
  WebFetch: 'webfetch',
  WebSearch: 'websearch',
  TodoWrite: 'todowrite',
  AskUserQuestion: 'question',
  SlashCommand: 'skill',
};

const kiloAgentPermissionOrder = [
  'read',
  'edit',
  'bash',
  'grep',
  'glob',
  'task',
  'webfetch',
  'websearch',
  'skill',
  'question',
  'todowrite',
  'list',
  'codesearch',
  'lsp',
];

function convertClaudeToKiloPermissionTool(claudeTool) {
  return claudeToKiloAgentPermissions[claudeTool] || null;
}

function buildKiloAgentPermissionBlock(claudeTools) {
  const allowedPermissions = new Set();

  for (const tool of claudeTools) {
    const mapped = convertClaudeToKiloPermissionTool(tool);
    if (mapped) {
      allowedPermissions.add(mapped);
    }
  }

  const lines = ['permission:'];
  for (const permission of kiloAgentPermissionOrder) {
    lines.push(`  ${permission}: ${allowedPermissions.has(permission) ? 'allow' : 'deny'}`);
  }

  return lines;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function replaceRelativePathReference(content, fromPath, toPath) {
  const escapedPath = escapeRegExp(fromPath);
  return content.replace(
    new RegExp(`(^|[^A-Za-z0-9_./-])${escapedPath}`, 'g'),
    (_, prefix) => `${prefix}${toPath}`,
  );
}

/**
 * Convert a Claude Code tool name to GitHub Copilot format.
 * - Applies explicit mapping from claudeToCopilotTools
 * - Handles mcp__context7__* prefix → io.github.upstash/context7/*
 * - Falls back to lowercase for unknown tools
 */
function convertCopilotToolName(claudeTool) {
  // mcp__context7__* wildcard → io.github.upstash/context7/*
  if (claudeTool.startsWith('mcp__context7__')) {
    return 'io.github.upstash/context7/' + claudeTool.slice('mcp__context7__'.length);
  }
  // Check explicit mapping
  if (claudeToCopilotTools[claudeTool]) {
    return claudeToCopilotTools[claudeTool];
  }
  // Default: lowercase
  return claudeTool.toLowerCase();
}

/**
 * Apply Copilot-specific content conversion — CONV-06 (paths) + CONV-07 (command names).
 * Path mappings depend on install mode:
 *   Global: ~/.claude/ → ~/.copilot/, ./.claude/ → ./.github/
 *   Local:  ~/.claude/ → ./.github/, ./.claude/ → ./.github/
 * Applied to ALL Copilot content (skills, agents, engine files).
 * @param {string} content - Source content to convert
 * @param {boolean} [isGlobal=false] - Whether this is a global install
 */
function convertClaudeToCopilotContent(content, isGlobal = false) {
  let c = content;
  // CONV-06: Path replacement — most specific first to avoid substring matches.
  // Handle both `~/.claude/foo` (trailing slash) and bare `~/.claude` forms in
  // one pass via a capture group, matching the approach used by Antigravity,
  // OpenCode, Kilo, and Codex converters (issue #2545).
  if (isGlobal) {
    c = c.replace(/\$HOME\/\.claude(\/|\b)/g, '$HOME/.copilot$1');
    c = c.replace(/~\/\.claude(\/|\b)/g, '~/.copilot$1');
  } else {
    c = c.replace(/\$HOME\/\.claude\//g, '.github/');
    c = c.replace(/~\/\.claude\//g, '.github/');
    c = c.replace(/\$HOME\/\.claude\b/g, '.github');
    c = c.replace(/~\/\.claude\b/g, '.github');
  }
  c = c.replace(/\.\/\.claude\//g, './.github/');
  c = c.replace(/\.claude\//g, '.github/');
  // CONV-07: Command name conversion (all gsd: references → gsd-)
  c = c.replace(/gsd:/g, 'gsd-');
  // Runtime-neutral agent name replacement (#766)
  c = neutralizeAgentReferences(c, 'copilot-instructions.md');
  return c;
}

/**
 * Convert a Claude command (.md) to a Copilot skill (SKILL.md).
 * Transforms frontmatter only — body passes through with CONV-06/07 applied.
 * Skills keep original tool names (no mapping) per CONTEXT.md decision.
 */
function convertClaudeCommandToCopilotSkill(content, skillName, isGlobal = false) {
  const converted = convertClaudeToCopilotContent(content, isGlobal);
  const { frontmatter, body } = extractFrontmatterAndBody(converted);
  if (!frontmatter) return converted;

  const description = extractFrontmatterField(frontmatter, 'description') || '';
  const argumentHint = extractFrontmatterField(frontmatter, 'argument-hint');
  const agent = extractFrontmatterField(frontmatter, 'agent');

  // CONV-02: Extract allowed-tools YAML multiline list → comma-separated string
  const toolsMatch = frontmatter.match(/^allowed-tools:\s*\n((?:\s+-\s+.+\n?)*)/m);
  let toolsLine = '';
  if (toolsMatch) {
    const tools = toolsMatch[1].match(/^\s+-\s+(.+)/gm);
    if (tools) {
      toolsLine = tools.map(t => t.replace(/^\s+-\s+/, '').trim()).join(', ');
    }
  }

  // Reconstruct frontmatter in Copilot format
  // #2876: descriptions starting with a YAML flow indicator (`[BETA] …`,
  // `{ … }`, `*ref`, `&anchor`, etc.) parse as flow sequences/mappings and
  // crash gh-copilot's frontmatter loader. Always quote so any leading
  // character is parser-safe.
  let fm = `---\nname: ${skillName}\ndescription: ${yamlQuote(description)}\n`;
  if (argumentHint) fm += `argument-hint: ${yamlQuote(argumentHint)}\n`;
  if (agent) fm += `agent: ${agent}\n`;
  if (toolsLine) fm += `allowed-tools: ${toolsLine}\n`;
  fm += '---';

  return `${fm}\n${body}`;
}

/**
 * Map a skill directory name (gsd-<cmd>) to the frontmatter `name:` used
 * by Claude Code as the skill identity. Emits the hyphen form (gsd-<cmd>)
 * so Claude Code autocomplete shows the canonical invocation form, not the
 * deprecated colon form. See #2808.
 *
 * Historical note: this previously returned `gsd:<cmd>` (colon) because
 * workflows called Skill(skill="gsd:<cmd>"). Those calls have been updated
 * to use hyphen form (#2808) so the colon rewrite is no longer needed.
 *
 * Codex must NOT use this helper: its adapter invokes skills as `$gsd-<cmd>`
 * (shell-var syntax) — hyphen form is already correct there.
 */
function skillFrontmatterName(skillDirName) {
  if (typeof skillDirName !== 'string') return skillDirName;
  // Return the hyphen form as-is (gsd-<cmd>) — canonical since #2808.
  return skillDirName;
}

/**
 * Convert a Claude command (.md) to a Claude skill (SKILL.md).
 * Claude Code is the native format, so minimal conversion needed —
 * preserve allowed-tools as YAML multiline list, preserve argument-hint.
 * Emits `name: gsd-<cmd>` (hyphen) so Skill(skill="gsd-<cmd>") calls and
 * tab autocomplete use the canonical command namespace.
 */
function convertClaudeCommandToClaudeSkill(content, skillName, runtime = null) {
  const { frontmatter, body } = extractFrontmatterAndBody(content);
  if (!frontmatter) return content;

  const description = extractFrontmatterField(frontmatter, 'description') || '';
  const argumentHint = extractFrontmatterField(frontmatter, 'argument-hint');
  const agent = extractFrontmatterField(frontmatter, 'agent');

  // Preserve allowed-tools as YAML multiline list (Claude native format)
  const toolsMatch = frontmatter.match(/^allowed-tools:\s*\n((?:\s+-\s+.+\n?)*)/m);
  let toolsBlock = '';
  if (toolsMatch) {
    toolsBlock = 'allowed-tools:\n' + toolsMatch[1];
    // Ensure trailing newline
    if (!toolsBlock.endsWith('\n')) toolsBlock += '\n';
  }

  // Reconstruct frontmatter in Claude skill format
  const frontmatterName = skillFrontmatterName(skillName);
  let fm = `---\nname: ${frontmatterName}\ndescription: ${yamlQuote(description)}\n`;
  // Hermes' SKILL.md spec lists `version` as a required frontmatter field.
  // Track GSD's package version so Hermes' skill_view() reports a stable
  // identifier per install.
  if (runtime === 'hermes') fm += `version: ${yamlQuote(pkg.version)}\n`;
  if (argumentHint) fm += `argument-hint: ${yamlQuote(argumentHint)}\n`;
  if (agent) fm += `agent: ${agent}\n`;
  if (toolsBlock) fm += toolsBlock;
  fm += '---';

  return `${fm}\n${body}`;
}

/**
 * Convert a Claude agent (.md) to a Copilot agent (.agent.md).
 * Applies tool mapping + deduplication, formats tools as JSON array.
 * CONV-04: JSON array format. CONV-05: Tool name mapping.
 */
function convertClaudeAgentToCopilotAgent(content, isGlobal = false) {
  const converted = convertClaudeToCopilotContent(content, isGlobal);
  const { frontmatter, body } = extractFrontmatterAndBody(converted);
  if (!frontmatter) return converted;

  const name = extractFrontmatterField(frontmatter, 'name') || 'unknown';
  const description = extractFrontmatterField(frontmatter, 'description') || '';
  const color = extractFrontmatterField(frontmatter, 'color');
  const toolsRaw = extractFrontmatterField(frontmatter, 'tools') || '';

  // CONV-04 + CONV-05: Map tools, deduplicate, format as JSON array
  const claudeTools = toolsRaw.split(',').map(t => t.trim()).filter(Boolean);
  const mappedTools = claudeTools.map(t => convertCopilotToolName(t));
  const uniqueTools = [...new Set(mappedTools)];
  const toolsArray = uniqueTools.length > 0
    ? "['" + uniqueTools.join("', '") + "']"
    : '[]';

  // Reconstruct frontmatter in Copilot format. Quote description (#2876)
  // so a leading YAML flow indicator (`[BETA] …`, `{ … }`, etc.) doesn't
  // crash the Copilot frontmatter loader.
  let fm = `---\nname: ${name}\ndescription: ${yamlQuote(description)}\ntools: ${toolsArray}\n`;
  if (color) fm += `color: ${color}\n`;
  fm += '---';

  return `${fm}\n${body}`;
}

/**
 * Apply Antigravity-specific content conversion — path replacement + command name conversion.
 * Path mappings depend on install mode:
 *   Global: ~/.claude/ → ~/.gemini/antigravity/, ./.claude/ → ./.agent/
 *   Local:  ~/.claude/ → .agent/, ./.claude/ → ./.agent/
 * Applied to ALL Antigravity content (skills, agents, engine files).
 * @param {string} content - Source content to convert
 * @param {boolean} [isGlobal=false] - Whether this is a global install
 */
function convertClaudeToAntigravityContent(content, isGlobal = false) {
  let c = content;
  if (isGlobal) {
    c = c.replace(/\$HOME\/\.claude\//g, '$HOME/.gemini/antigravity/');
    c = c.replace(/~\/\.claude\//g, '~/.gemini/antigravity/');
    // Bare form (no trailing slash) — must come after slash form to avoid double-replace
    c = c.replace(/\$HOME\/\.claude\b/g, '$HOME/.gemini/antigravity');
    c = c.replace(/~\/\.claude\b/g, '~/.gemini/antigravity');
  } else {
    c = c.replace(/\$HOME\/\.claude\//g, '.agent/');
    c = c.replace(/~\/\.claude\//g, '.agent/');
    // Bare form (no trailing slash) — must come after slash form to avoid double-replace
    c = c.replace(/\$HOME\/\.claude\b/g, '.agent');
    c = c.replace(/~\/\.claude\b/g, '.agent');
  }
  c = c.replace(/\.\/\.claude\//g, './.agent/');
  c = c.replace(/\.claude\//g, '.agent/');
  // Command name conversion (all gsd: references → gsd-)
  c = c.replace(/gsd:/g, 'gsd-');
  // Runtime-neutral agent name replacement (#766)
  c = neutralizeAgentReferences(c, 'GEMINI.md');
  return c;
}

/**
 * Convert a Claude command (.md) to an Antigravity skill (SKILL.md).
 * Transforms frontmatter to minimal name + description only.
 * Body passes through with path/command conversions applied.
 */
function convertClaudeCommandToAntigravitySkill(content, skillName, isGlobal = false) {
  const converted = convertClaudeToAntigravityContent(content, isGlobal);
  const { frontmatter, body } = extractFrontmatterAndBody(converted);
  if (!frontmatter) return converted;

  const name = skillName || extractFrontmatterField(frontmatter, 'name') || 'unknown';
  const description = extractFrontmatterField(frontmatter, 'description') || '';

  // #2876: quote description so YAML flow indicators in the source
  // (e.g. `[BETA] …`) don't break downstream frontmatter parsers.
  const fm = `---\nname: ${name}\ndescription: ${yamlQuote(description)}\n---`;
  return `${fm}\n${body}`;
}

/**
 * Convert a Claude agent (.md) to an Antigravity agent.
 * Uses Gemini tool names since Antigravity runs on Gemini 3 backend.
 */
function convertClaudeAgentToAntigravityAgent(content, isGlobal = false) {
  const converted = convertClaudeToAntigravityContent(content, isGlobal);
  const { frontmatter, body } = extractFrontmatterAndBody(converted);
  if (!frontmatter) return converted;

  const name = extractFrontmatterField(frontmatter, 'name') || 'unknown';
  const description = extractFrontmatterField(frontmatter, 'description') || '';
  const color = extractFrontmatterField(frontmatter, 'color');
  const toolsRaw = extractFrontmatterField(frontmatter, 'tools') || '';

  // Map tools to Gemini equivalents (reuse existing convertGeminiToolName)
  const claudeTools = toolsRaw.split(',').map(t => t.trim()).filter(Boolean);
  const mappedTools = claudeTools.map(t => convertGeminiToolName(t)).filter(Boolean);

  // #2876: quote description for the same reason as the skill variant.
  let fm = `---\nname: ${name}\ndescription: ${yamlQuote(description)}\ntools: ${mappedTools.join(', ')}\n`;
  if (color) fm += `color: ${color}\n`;
  fm += '---';

  return `${fm}\n${body}`;
}

function toSingleLine(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function yamlQuote(value) {
  return JSON.stringify(value);
}

function yamlIdentifier(value) {
  const text = String(value).trim();
  if (/^[A-Za-z0-9][A-Za-z0-9-]*$/.test(text)) {
    return text;
  }
  return yamlQuote(text);
}

function extractFrontmatterAndBody(content) {
  if (!content.startsWith('---')) {
    return { frontmatter: null, body: content };
  }

  const endIndex = content.indexOf('---', 3);
  if (endIndex === -1) {
    return { frontmatter: null, body: content };
  }

  return {
    frontmatter: content.substring(3, endIndex).trim(),
    body: content.substring(endIndex + 3),
  };
}

function extractFrontmatterField(frontmatter, fieldName) {
  const regex = new RegExp(`^${fieldName}:\\s*(.+)$`, 'm');
  const match = frontmatter.match(regex);
  if (!match) return null;
  return match[1].trim().replace(/^['"]|['"]$/g, '');
}

// Tool name mapping from Claude Code to Cursor CLI
const claudeToCursorTools = {
  Bash: 'Shell',
  Edit: 'StrReplace',
  AskUserQuestion: null, // No direct equivalent — use conversational prompting
  SlashCommand: null,    // No equivalent — skills are auto-discovered
};

/**
 * Convert a Claude Code tool name to Cursor CLI format
 * @returns {string|null} Cursor tool name, or null if tool should be excluded
 */
function convertCursorToolName(claudeTool) {
  if (claudeTool in claudeToCursorTools) {
    return claudeToCursorTools[claudeTool];
  }
  // MCP tools keep their format (Cursor supports MCP)
  if (claudeTool.startsWith('mcp__')) {
    return claudeTool;
  }
  // Most tools share the same name (Read, Write, Glob, Grep, Task, WebSearch, WebFetch, TodoWrite)
  return claudeTool;
}

function convertSlashCommandsToCursorSkillMentions(content) {
  // Keep leading "/" for slash commands; only normalize gsd: -> gsd-.
  // This preserves rendered "next step" commands like "/gsd-execute-phase 17".
  return content.replace(/gsd:/gi, 'gsd-');
}

function convertClaudeToCursorMarkdown(content) {
  let converted = convertSlashCommandsToCursorSkillMentions(content);
  // Replace tool name references in body text
  converted = converted.replace(/\bBash\(/g, 'Shell(');
  converted = converted.replace(/\bEdit\(/g, 'StrReplace(');
  converted = converted.replace(/\bAskUserQuestion\b/g, 'conversational prompting');
  // Replace subagent_type from Claude to Cursor format
  converted = converted.replace(/subagent_type="general-purpose"/g, 'subagent_type="generalPurpose"');
  converted = converted.replace(/\$ARGUMENTS\b/g, '{{GSD_ARGS}}');
  // Replace project-level Claude conventions with Cursor equivalents
  converted = converted.replace(/`\.\/CLAUDE\.md`/g, '`.cursor/rules/`');
  converted = converted.replace(/\.\/CLAUDE\.md/g, '.cursor/rules/');
  converted = converted.replace(/`CLAUDE\.md`/g, '`.cursor/rules/`');
  converted = converted.replace(/\bCLAUDE\.md\b/g, '.cursor/rules/');
  converted = converted.replace(/\.claude\/skills\//g, '.cursor/skills/');
  // Remove Claude Code-specific bug workarounds before brand replacement
  converted = converted.replace(/\*\*Known Claude Code bug \(classifyHandoffIfNeeded\):\*\*[^\n]*\n/g, '');
  converted = converted.replace(/- \*\*classifyHandoffIfNeeded false failure:\*\*[^\n]*\n/g, '');
  // Replace "Claude Code" brand references with "Cursor"
  converted = converted.replace(/\bClaude Code\b/g, 'Cursor');
  return converted;
}

function getCursorSkillAdapterHeader(skillName) {
  return `<cursor_skill_adapter>
## A. Skill Invocation
- This skill is invoked when the user mentions \`${skillName}\` or describes a task matching this skill.
- Treat all user text after the skill mention as \`{{GSD_ARGS}}\`.
- If no arguments are present, treat \`{{GSD_ARGS}}\` as empty.

## B. User Prompting
When the workflow needs user input, prompt the user conversationally:
- Present options as a numbered list in your response text
- Ask the user to reply with their choice
- For multi-select, ask for comma-separated numbers

## C. Tool Usage
Use these Cursor tools when executing GSD workflows:
- \`Shell\` for running commands (terminal operations)
- \`StrReplace\` for editing existing files
- \`Read\`, \`Write\`, \`Glob\`, \`Grep\`, \`Task\`, \`WebSearch\`, \`WebFetch\`, \`TodoWrite\` as needed

## D. Subagent Spawning
When the workflow needs to spawn a subagent:
- Use \`Task(subagent_type="generalPurpose", ...)\`
- The \`model\` parameter maps to Cursor's model options (e.g., "fast")
</cursor_skill_adapter>`;
}

function convertClaudeCommandToCursorSkill(content, skillName) {
  const converted = convertClaudeToCursorMarkdown(content);
  const { frontmatter, body } = extractFrontmatterAndBody(converted);
  let description = `Run GSD workflow ${skillName}.`;
  if (frontmatter) {
    const maybeDescription = extractFrontmatterField(frontmatter, 'description');
    if (maybeDescription) {
      description = maybeDescription;
    }
  }
  description = toSingleLine(description);
  const shortDescription = description.length > 180 ? `${description.slice(0, 177)}...` : description;
  const adapter = getCursorSkillAdapterHeader(skillName);

  return `---\nname: ${yamlIdentifier(skillName)}\ndescription: ${yamlQuote(shortDescription)}\n---\n\n${adapter}\n\n${body.trimStart()}`;
}

/**
 * Convert Claude Code agent markdown to Cursor agent format.
 * Strips frontmatter fields Cursor doesn't support (color, skills),
 * converts tool references, and adds a role context header.
 */
function convertClaudeAgentToCursorAgent(content) {
  let converted = convertClaudeToCursorMarkdown(content);

  const { frontmatter, body } = extractFrontmatterAndBody(converted);
  if (!frontmatter) return converted;

  const name = extractFrontmatterField(frontmatter, 'name') || 'unknown';
  const description = extractFrontmatterField(frontmatter, 'description') || '';

  const cleanFrontmatter = `---\nname: ${yamlIdentifier(name)}\ndescription: ${yamlQuote(toSingleLine(description))}\n---`;

  return `${cleanFrontmatter}\n${body}`;
}

// --- Windsurf converters ---
// Windsurf uses a tool set similar to Cursor.
// Config lives in .windsurf/ (local) and ~/.codeium/windsurf/ (global).

// Tool name mapping from Claude Code to Windsurf Cascade
const claudeToWindsurfTools = {
  Bash: 'Shell',
  Edit: 'StrReplace',
  AskUserQuestion: null, // No direct equivalent — use conversational prompting
  SlashCommand: null,    // No equivalent — skills are auto-discovered
};

/**
 * Convert a Claude Code tool name to Windsurf Cascade format
 * @returns {string|null} Windsurf tool name, or null if tool should be excluded
 */
function convertWindsurfToolName(claudeTool) {
  if (claudeTool in claudeToWindsurfTools) {
    return claudeToWindsurfTools[claudeTool];
  }
  // MCP tools keep their format (Windsurf supports MCP)
  if (claudeTool.startsWith('mcp__')) {
    return claudeTool;
  }
  // Most tools share the same name (Read, Write, Glob, Grep, Task, WebSearch, WebFetch, TodoWrite)
  return claudeTool;
}

function convertSlashCommandsToWindsurfSkillMentions(content) {
  // Keep leading "/" for slash commands; only normalize gsd: -> gsd-.
  return content.replace(/gsd:/gi, 'gsd-');
}

function convertClaudeToWindsurfMarkdown(content) {
  let converted = convertSlashCommandsToWindsurfSkillMentions(content);
  // Replace tool name references in body text
  converted = converted.replace(/\bBash\(/g, 'Shell(');
  converted = converted.replace(/\bEdit\(/g, 'StrReplace(');
  converted = converted.replace(/\bAskUserQuestion\b/g, 'conversational prompting');
  // Replace subagent_type from Claude to Windsurf format
  converted = converted.replace(/subagent_type="general-purpose"/g, 'subagent_type="generalPurpose"');
  converted = converted.replace(/\$ARGUMENTS\b/g, '{{GSD_ARGS}}');
  // Replace project-level Claude conventions with Windsurf equivalents
  converted = converted.replace(/`\.\/CLAUDE\.md`/g, '`.windsurf/rules`');
  converted = converted.replace(/\.\/CLAUDE\.md/g, '.windsurf/rules');
  converted = converted.replace(/`CLAUDE\.md`/g, '`.windsurf/rules`');
  converted = converted.replace(/\bCLAUDE\.md\b/g, '.windsurf/rules');
  converted = converted.replace(/\.claude\/skills\//g, '.windsurf/skills/');
  // Remove Claude Code-specific bug workarounds before brand replacement
  converted = converted.replace(/\*\*Known Claude Code bug \(classifyHandoffIfNeeded\):\*\*[^\n]*\n/g, '');
  converted = converted.replace(/- \*\*classifyHandoffIfNeeded false failure:\*\*[^\n]*\n/g, '');
  // Replace "Claude Code" brand references with "Windsurf"
  converted = converted.replace(/\bClaude Code\b/g, 'Windsurf');
  return converted;
}

function getWindsurfSkillAdapterHeader(skillName) {
  return `<windsurf_skill_adapter>
## A. Skill Invocation
- This skill is invoked when the user mentions \`${skillName}\` or describes a task matching this skill.
- Treat all user text after the skill mention as \`{{GSD_ARGS}}\`.
- If no arguments are present, treat \`{{GSD_ARGS}}\` as empty.

## B. User Prompting
When the workflow needs user input, prompt the user conversationally:
- Present options as a numbered list in your response text
- Ask the user to reply with their choice
- For multi-select, ask for comma-separated numbers

## C. Tool Usage
Use these Windsurf tools when executing GSD workflows:
- \`Shell\` for running commands (terminal operations)
- \`StrReplace\` for editing existing files
- \`Read\`, \`Write\`, \`Glob\`, \`Grep\`, \`Task\`, \`WebSearch\`, \`WebFetch\`, \`TodoWrite\` as needed

## D. Subagent Spawning
When the workflow needs to spawn a subagent:
- Use \`Task(subagent_type="generalPurpose", ...)\`
- The \`model\` parameter maps to Windsurf's model options (e.g., "fast")
</windsurf_skill_adapter>`;
}

function convertClaudeCommandToWindsurfSkill(content, skillName) {
  const converted = convertClaudeToWindsurfMarkdown(content);
  const { frontmatter, body } = extractFrontmatterAndBody(converted);
  let description = `Run GSD workflow ${skillName}.`;
  if (frontmatter) {
    const maybeDescription = extractFrontmatterField(frontmatter, 'description');
    if (maybeDescription) {
      description = maybeDescription;
    }
  }
  description = toSingleLine(description);
  const shortDescription = description.length > 180 ? `${description.slice(0, 177)}...` : description;
  const adapter = getWindsurfSkillAdapterHeader(skillName);

  return `---\nname: ${yamlIdentifier(skillName)}\ndescription: ${yamlQuote(shortDescription)}\n---\n\n${adapter}\n\n${body.trimStart()}`;
}

/**
 * Convert Claude Code agent markdown to Windsurf agent format.
 * Strips frontmatter fields Windsurf doesn't support (color, skills),
 * converts tool references, and adds a role context header.
 */
function convertClaudeAgentToWindsurfAgent(content) {
  let converted = convertClaudeToWindsurfMarkdown(content);

  const { frontmatter, body } = extractFrontmatterAndBody(converted);
  if (!frontmatter) return converted;

  const name = extractFrontmatterField(frontmatter, 'name') || 'unknown';
  const description = extractFrontmatterField(frontmatter, 'description') || '';

  const cleanFrontmatter = `---\nname: ${yamlIdentifier(name)}\ndescription: ${yamlQuote(toSingleLine(description))}\n---`;

  return `${cleanFrontmatter}\n${body}`;
}

// --- Augment converters ---
// Augment uses a tool set similar to Cursor/Windsurf.
// Config lives in .augment/ (local) and ~/.augment/ (global).

const claudeToAugmentTools = {
  Bash: 'launch-process',
  Edit: 'str-replace-editor',
  AskUserQuestion: null,
  SlashCommand: null,
  TodoWrite: 'add_tasks',
};

function convertAugmentToolName(claudeTool) {
  if (claudeTool in claudeToAugmentTools) {
    return claudeToAugmentTools[claudeTool];
  }
  if (claudeTool.startsWith('mcp__')) {
    return claudeTool;
  }
  const toolMapping = {
    Read: 'view',
    Write: 'save-file',
    Glob: 'view',
    Grep: 'grep',
    Task: null,
    WebSearch: 'web-search',
    WebFetch: 'web-fetch',
  };
  return toolMapping[claudeTool] || claudeTool;
}

function convertSlashCommandsToAugmentSkillMentions(content) {
  return content.replace(/gsd:/gi, 'gsd-');
}

function convertClaudeToAugmentMarkdown(content) {
  let converted = convertSlashCommandsToAugmentSkillMentions(content);
  converted = converted.replace(/\bBash\(/g, 'launch-process(');
  converted = converted.replace(/\bEdit\(/g, 'str-replace-editor(');
  converted = converted.replace(/\bRead\(/g, 'view(');
  converted = converted.replace(/\bWrite\(/g, 'save-file(');
  converted = converted.replace(/\bTodoWrite\(/g, 'add_tasks(');
  converted = converted.replace(/\bAskUserQuestion\b/g, 'conversational prompting');
  // Replace subagent_type from Claude to Augment format
  converted = converted.replace(/subagent_type="general-purpose"/g, 'subagent_type="generalPurpose"');
  converted = converted.replace(/\$ARGUMENTS\b/g, '{{GSD_ARGS}}');
  // Replace project-level Claude conventions with Augment equivalents
  converted = converted.replace(/`\.\/CLAUDE\.md`/g, '`.augment/rules/`');
  converted = converted.replace(/\.\/CLAUDE\.md/g, '.augment/rules/');
  converted = converted.replace(/`CLAUDE\.md`/g, '`.augment/rules/`');
  converted = converted.replace(/\bCLAUDE\.md\b/g, '.augment/rules/');
  converted = converted.replace(/\.claude\/skills\//g, '.augment/skills/');
  // Remove Claude Code-specific bug workarounds before brand replacement
  converted = converted.replace(/\*\*Known Claude Code bug \(classifyHandoffIfNeeded\):\*\*[^\n]*\n/g, '');
  converted = converted.replace(/- \*\*classifyHandoffIfNeeded false failure:\*\*[^\n]*\n/g, '');
  // Replace "Claude Code" brand references with "Augment"
  converted = converted.replace(/\bClaude Code\b/g, 'Augment');
  return converted;
}

function getAugmentSkillAdapterHeader(skillName) {
  return `<augment_skill_adapter>
## A. Skill Invocation
- This skill is invoked when the user mentions \`${skillName}\` or describes a task matching this skill.
- Treat all user text after the skill mention as \`{{GSD_ARGS}}\`.
- If no arguments are present, treat \`{{GSD_ARGS}}\` as empty.

## B. User Prompting
When the workflow needs user input, prompt the user conversationally:
- Present options as a numbered list in your response text
- Ask the user to reply with their choice
- For multi-select, ask for comma-separated numbers

## C. Tool Usage
Use these Augment tools when executing GSD workflows:
- \`launch-process\` for running commands (terminal operations)
- \`str-replace-editor\` for editing existing files
- \`view\` for reading files and listing directories
- \`save-file\` for creating new files
- \`grep\` for searching code (or use MCP servers for advanced search)
- \`web-search\`, \`web-fetch\` for web queries
- \`add_tasks\`, \`view_tasklist\`, \`update_tasks\` for task management

## D. Subagent Spawning
When the workflow needs to spawn a subagent:
- Use the built-in subagent spawning capability
- Define agent prompts in \`.augment/agents/\` directory
</augment_skill_adapter>`;
}

function convertClaudeCommandToAugmentSkill(content, skillName) {
  const converted = convertClaudeToAugmentMarkdown(content);
  const { frontmatter, body } = extractFrontmatterAndBody(converted);
  let description = `Run GSD workflow ${skillName}.`;
  if (frontmatter) {
    const maybeDescription = extractFrontmatterField(frontmatter, 'description');
    if (maybeDescription) {
      description = maybeDescription;
    }
  }
  description = toSingleLine(description);
  const shortDescription = description.length > 180 ? `${description.slice(0, 177)}...` : description;
  const adapter = getAugmentSkillAdapterHeader(skillName);

  return `---\nname: ${yamlIdentifier(skillName)}\ndescription: ${yamlQuote(shortDescription)}\n---\n\n${adapter}\n\n${body.trimStart()}`;
}

/**
 * Convert Claude Code agent markdown to Augment agent format.
 * Strips frontmatter fields Augment doesn't support (color, skills),
 * converts tool references, and cleans up for Augment agents.
 */
function convertClaudeAgentToAugmentAgent(content) {
  let converted = convertClaudeToAugmentMarkdown(content);

  const { frontmatter, body } = extractFrontmatterAndBody(converted);
  if (!frontmatter) return converted;

  const name = extractFrontmatterField(frontmatter, 'name') || 'unknown';
  const description = extractFrontmatterField(frontmatter, 'description') || '';

  const cleanFrontmatter = `---\nname: ${yamlIdentifier(name)}\ndescription: ${yamlQuote(toSingleLine(description))}\n---`;

  return `${cleanFrontmatter}\n${body}`;
}

/**
 * Copy Claude commands as Augment skills — one folder per skill with SKILL.md.
 * Mirrors copyCommandsAsCursorSkills but uses Augment converters.
 */
function copyCommandsAsAugmentSkills(srcDir, skillsDir, prefix, pathPrefix, runtime) {
  if (!fs.existsSync(srcDir)) {
    return;
  }

  fs.mkdirSync(skillsDir, { recursive: true });

  // Remove previous GSD Augment skills to avoid stale command skills
  const existing = fs.readdirSync(skillsDir, { withFileTypes: true });
  for (const entry of existing) {
    if (entry.isDirectory() && entry.name.startsWith(`${prefix}-`)) {
      fs.rmSync(path.join(skillsDir, entry.name), { recursive: true });
    }
  }

  function recurse(currentSrcDir, currentPrefix) {
    const entries = fs.readdirSync(currentSrcDir, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(currentSrcDir, entry.name);
      if (entry.isDirectory()) {
        recurse(srcPath, `${currentPrefix}-${entry.name}`);
        continue;
      }

      if (!entry.name.endsWith('.md')) {
        continue;
      }

      const baseName = entry.name.replace('.md', '');
      const skillName = `${currentPrefix}-${baseName}`;
      const skillDir = path.join(skillsDir, skillName);
      fs.mkdirSync(skillDir, { recursive: true });

      let content = fs.readFileSync(srcPath, 'utf8');
      const globalClaudeRegex = /~\/\.claude\//g;
      const globalClaudeHomeRegex = /\$HOME\/\.claude\//g;
      const localClaudeRegex = /\.\/\.claude\//g;
      const augmentDirRegex = /~\/\.augment\//g;
      content = content.replace(globalClaudeRegex, pathPrefix);
      content = content.replace(globalClaudeHomeRegex, pathPrefix);
      content = content.replace(localClaudeRegex, `./${getDirName(runtime)}/`);
      content = content.replace(augmentDirRegex, pathPrefix);
      content = processAttribution(content, getCommitAttribution(runtime));
      content = convertClaudeCommandToAugmentSkill(content, skillName);

      fs.writeFileSync(path.join(skillDir, 'SKILL.md'), content);
    }
  }

  recurse(srcDir, prefix);
}

function convertSlashCommandsToTraeSkillMentions(content) {
  return content.replace(/\/gsd:([a-z0-9-]+)/g, (_, commandName) => {
    return `/gsd-${commandName}`;
  });
}

function convertClaudeToTraeMarkdown(content) {
  let converted = convertSlashCommandsToTraeSkillMentions(content);
  converted = converted.replace(/\bBash\(/g, 'Shell(');
  converted = converted.replace(/\bEdit\(/g, 'StrReplace(');
  // Replace general-purpose subagent type with Trae's equivalent "general_purpose_task"
  converted = converted.replace(/subagent_type="general-purpose"/g, 'subagent_type="general_purpose_task"');
  converted = converted.replace(/\$ARGUMENTS\b/g, '{{GSD_ARGS}}');
  converted = converted.replace(/`\.\/CLAUDE\.md`/g, '`.trae/rules/`');
  converted = converted.replace(/\.\/CLAUDE\.md/g, '.trae/rules/');
  converted = converted.replace(/`CLAUDE\.md`/g, '`.trae/rules/`');
  converted = converted.replace(/\bCLAUDE\.md\b/g, '.trae/rules/');
  converted = converted.replace(/\.claude\/skills\//g, '.trae/skills/');
  converted = converted.replace(/\.\/\.claude\//g, './.trae/');
  converted = converted.replace(/\.claude\//g, '.trae/');
  converted = converted.replace(/\*\*Known Claude Code bug \(classifyHandoffIfNeeded\):\*\*[^\n]*\n/g, '');
  converted = converted.replace(/- \*\*classifyHandoffIfNeeded false failure:\*\*[^\n]*\n/g, '');
  converted = converted.replace(/\bClaude Code\b/g, 'Trae');
  return converted;
}

function convertClaudeCommandToTraeSkill(content, skillName) {
  const converted = convertClaudeToTraeMarkdown(content);
  const { frontmatter, body } = extractFrontmatterAndBody(converted);
  let description = `Run GSD workflow ${skillName}.`;
  if (frontmatter) {
    const maybeDescription = extractFrontmatterField(frontmatter, 'description');
    if (maybeDescription) {
      description = maybeDescription;
    }
  }
  description = toSingleLine(description);
  const shortDescription = description.length > 180 ? `${description.slice(0, 177)}...` : description;
  // #2876: quote so YAML flow indicators (`[BETA] …`) don't break Trae's
  // frontmatter parser.
  return `---\nname: ${yamlIdentifier(skillName)}\ndescription: ${yamlQuote(shortDescription)}\n---\n${body}`;
}

function convertClaudeAgentToTraeAgent(content) {
  let converted = convertClaudeToTraeMarkdown(content);

  const { frontmatter, body } = extractFrontmatterAndBody(converted);
  if (!frontmatter) return converted;

  const name = extractFrontmatterField(frontmatter, 'name') || 'unknown';
  const description = extractFrontmatterField(frontmatter, 'description') || '';

  const cleanFrontmatter = `---\nname: ${yamlIdentifier(name)}\ndescription: ${yamlQuote(toSingleLine(description))}\n---`;

  return `${cleanFrontmatter}\n${body}`;
}

function convertSlashCommandsToCodebuddySkillMentions(content) {
  return content.replace(/\/gsd:([a-z0-9-]+)/g, (_, commandName) => {
    return `/gsd-${commandName}`;
  });
}

function convertClaudeToCodebuddyMarkdown(content) {
  let converted = convertSlashCommandsToCodebuddySkillMentions(content);
  // CodeBuddy uses the same tool names as Claude Code (Bash, Edit, Read, Write, etc.)
  // No tool name conversion needed
  converted = converted.replace(/\$ARGUMENTS\b/g, '{{GSD_ARGS}}');
  converted = converted.replace(/`\.\/CLAUDE\.md`/g, '`CODEBUDDY.md`');
  converted = converted.replace(/\.\/CLAUDE\.md/g, 'CODEBUDDY.md');
  converted = converted.replace(/`CLAUDE\.md`/g, '`CODEBUDDY.md`');
  converted = converted.replace(/\bCLAUDE\.md\b/g, 'CODEBUDDY.md');
  converted = converted.replace(/\.claude\/skills\//g, '.codebuddy/skills/');
  converted = converted.replace(/\.\/\.claude\//g, './.codebuddy/');
  converted = converted.replace(/\.claude\//g, '.codebuddy/');
  converted = converted.replace(/\*\*Known Claude Code bug \(classifyHandoffIfNeeded\):\*\*[^\n]*\n/g, '');
  converted = converted.replace(/- \*\*classifyHandoffIfNeeded false failure:\*\*[^\n]*\n/g, '');
  converted = converted.replace(/\bClaude Code\b/g, 'CodeBuddy');
  return converted;
}

function convertClaudeCommandToCodebuddySkill(content, skillName) {
  const converted = convertClaudeToCodebuddyMarkdown(content);
  const { frontmatter, body } = extractFrontmatterAndBody(converted);
  let description = `Run GSD workflow ${skillName}.`;
  if (frontmatter) {
    const maybeDescription = extractFrontmatterField(frontmatter, 'description');
    if (maybeDescription) {
      description = maybeDescription;
    }
  }
  description = toSingleLine(description);
  const shortDescription = description.length > 180 ? `${description.slice(0, 177)}...` : description;
  // #2876: quote so YAML flow indicators (`[BETA] …`) don't break
  // CodeBuddy's frontmatter parser.
  return `---\nname: ${yamlIdentifier(skillName)}\ndescription: ${yamlQuote(shortDescription)}\n---\n${body}`;
}

function convertClaudeAgentToCodebuddyAgent(content) {
  let converted = convertClaudeToCodebuddyMarkdown(content);

  const { frontmatter, body } = extractFrontmatterAndBody(converted);
  if (!frontmatter) return converted;

  const name = extractFrontmatterField(frontmatter, 'name') || 'unknown';
  const description = extractFrontmatterField(frontmatter, 'description') || '';

  const cleanFrontmatter = `---\nname: ${yamlIdentifier(name)}\ndescription: ${yamlQuote(toSingleLine(description))}\n---`;

  return `${cleanFrontmatter}\n${body}`;
}

// ── Cline converters ────────────────────────────────────────────────────────

function convertClaudeToCliineMarkdown(content) {
  let converted = content;
  // Cline uses the same tool names as Claude Code — no tool name conversion needed
  converted = converted.replace(/`\.\/CLAUDE\.md`/g, '`.clinerules`');
  converted = converted.replace(/\.\/CLAUDE\.md/g, '.clinerules');
  converted = converted.replace(/`CLAUDE\.md`/g, '`.clinerules`');
  converted = converted.replace(/\bCLAUDE\.md\b/g, '.clinerules');
  converted = converted.replace(/\.claude\/skills\//g, '.cline/skills/');
  converted = converted.replace(/\.\/\.claude\//g, './.cline/');
  converted = converted.replace(/\.claude\//g, '.cline/');
  converted = converted.replace(/\*\*Known Claude Code bug \(classifyHandoffIfNeeded\):\*\*[^\n]*\n/g, '');
  converted = converted.replace(/- \*\*classifyHandoffIfNeeded false failure:\*\*[^\n]*\n/g, '');
  converted = converted.replace(/\bClaude Code\b/g, 'Cline');
  return converted;
}

function convertClaudeAgentToClineAgent(content) {
  let converted = convertClaudeToCliineMarkdown(content);
  const { frontmatter, body } = extractFrontmatterAndBody(converted);
  if (!frontmatter) return converted;
  const name = extractFrontmatterField(frontmatter, 'name') || 'unknown';
  const description = extractFrontmatterField(frontmatter, 'description') || '';
  const cleanFrontmatter = `---\nname: ${yamlIdentifier(name)}\ndescription: ${yamlQuote(toSingleLine(description))}\n---`;
  return `${cleanFrontmatter}\n${body}`;
}

// ── End Cline converters ─────────────────────────────────────────────────────

function convertSlashCommandsToCodexSkillMentions(content) {
  // Convert colon-style skill invocations to Codex $ prefix
  let converted = content.replace(/\/gsd:([a-z0-9-]+)/gi, (_, commandName) => {
    return `$gsd-${String(commandName).toLowerCase()}`;
  });
  // Convert hyphen-style command references (workflow output) to Codex $ prefix.
  // Negative lookbehind excludes file paths like bin/gsd-tools.cjs where
  // the slash is preceded by a word char, dot, or another slash.
  converted = converted.replace(/(?<![a-zA-Z0-9./])\/gsd-([a-z0-9-]+)/gi, (_, commandName) => {
    return `$gsd-${String(commandName).toLowerCase()}`;
  });
  return converted;
}

function convertClaudeToCodexMarkdown(content) {
  let converted = convertSlashCommandsToCodexSkillMentions(content);
  converted = converted.replace(/\$ARGUMENTS\b/g, '{{GSD_ARGS}}');
  // Remove /clear references — Codex has no equivalent command
  // Handle backtick-wrapped: `\/clear` then: → (removed)
  converted = converted.replace(/`\/clear`\s*,?\s*then:?\s*\n?/gi, '');
  // Handle bare: /clear then: → (removed)
  converted = converted.replace(/\/clear\s*,?\s*then:?\s*\n?/gi, '');
  // Handle standalone /clear on its own line
  converted = converted.replace(/^\s*`?\/clear`?\s*$/gm, '');
  // Path replacement: .claude → .codex (#1430)
  converted = converted.replace(/\$HOME\/\.claude\//g, '$HOME/.codex/');
  converted = converted.replace(/~\/\.claude\//g, '~/.codex/');
  converted = converted.replace(/\.\/\.claude\//g, './.codex/');
  // Bare/project-relative .claude/... references (#2639). Covers strings like
  // "check `.claude/skills/`" where there is no ~/, $HOME/, or ./ anchor.
  // Negative lookbehind prevents double-replacing already-anchored forms and
  // avoids matching inside URLs or other slash-prefixed paths.
  converted = converted.replace(/(?<![A-Za-z0-9_\-./~$])\.claude\//g, '.codex/');
  // `.claudeignore` → `.codexignore` (#2639). Codex honors its own ignore
  // file; leaving the Claude-specific name is misleading in agent prompts.
  converted = converted.replace(/\.claudeignore\b/g, '.codexignore');
  // Runtime-neutral agent name replacement (#766)
  converted = neutralizeAgentReferences(converted, 'AGENTS.md');
  return converted;
}

function getCodexSkillAdapterHeader(skillName) {
  const invocation = `$${skillName}`;
  return `<codex_skill_adapter>
## A. Skill Invocation
- This skill is invoked by mentioning \`${invocation}\`.
- Treat all user text after \`${invocation}\` as \`{{GSD_ARGS}}\`.
- If no arguments are present, treat \`{{GSD_ARGS}}\` as empty.

## B. AskUserQuestion → request_user_input Mapping
GSD workflows use \`AskUserQuestion\` (Claude Code syntax). Translate to Codex \`request_user_input\`:

Parameter mapping:
- \`header\` → \`header\`
- \`question\` → \`question\`
- Options formatted as \`"Label" — description\` → \`{label: "Label", description: "description"}\`
- Generate \`id\` from header: lowercase, replace spaces with underscores

Batched calls:
- \`AskUserQuestion([q1, q2])\` → single \`request_user_input\` with multiple entries in \`questions[]\`

Multi-select workaround:
- Codex has no \`multiSelect\`. Use sequential single-selects, or present a numbered freeform list asking the user to enter comma-separated numbers.

Execute mode fallback:
- When \`request_user_input\` is rejected or unavailable, you MUST stop and present the questions as a plain-text numbered list, then wait for the user's reply. Do NOT pick a default and continue (#3018).
- You may only proceed without a user answer when one of these is true:
  (a) the invocation included an explicit non-interactive flag (\`--auto\` or \`--all\`),
  (b) the user has explicitly approved a specific default for this question, or
  (c) the workflow's documented contract says defaults are safe (e.g. autonomous lifecycle paths).
- Do NOT write workflow artifacts (CONTEXT.md, DISCUSSION-LOG.md, PLAN.md, checkpoint files) until the user has answered the plain-text questions or one of (a)-(c) above applies. Surfacing the questions and waiting is the correct response — silently defaulting and writing artifacts is the #3018 failure mode.

## C. Task() → spawn_agent Mapping
GSD workflows use \`Task(...)\` (Claude Code syntax). Translate to Codex collaboration tools:

Direct mapping:
- \`Task(subagent_type="X", prompt="Y")\` → \`spawn_agent(agent_type="X", message="Y")\`
- \`Task(model="...")\` → omit. \`spawn_agent\` has no inline \`model\` parameter;
  GSD embeds the resolved per-agent model directly into each agent's \`.toml\`
  at install time so \`model_overrides\` from \`.planning/config.json\` and
  \`~/.gsd/defaults.json\` are honored automatically by Codex's agent router.
- \`fork_context: false\` by default — GSD agents load their own context via \`<files_to_read>\` blocks

Spawn restriction:
- Codex restricts \`spawn_agent\` to cases where the user has explicitly
  requested sub-agents. When automatic spawning is not permitted, do the
  work inline in the current agent rather than attempting to force a spawn.

Parallel fan-out:
- Spawn multiple agents → collect agent IDs → \`wait(ids)\` for all to complete

Result parsing:
- Look for structured markers in agent output: \`CHECKPOINT\`, \`PLAN COMPLETE\`, \`SUMMARY\`, etc.
- \`close_agent(id)\` after collecting results from each agent
</codex_skill_adapter>`;
}

function convertClaudeCommandToCodexSkill(content, skillName) {
  const converted = convertClaudeToCodexMarkdown(content);
  const { frontmatter, body } = extractFrontmatterAndBody(converted);
  let description = `Run GSD workflow ${skillName}.`;
  if (frontmatter) {
    const maybeDescription = extractFrontmatterField(frontmatter, 'description');
    if (maybeDescription) {
      description = maybeDescription;
    }
  }
  description = toSingleLine(description);
  const shortDescription = description.length > 180 ? `${description.slice(0, 177)}...` : description;
  const adapter = getCodexSkillAdapterHeader(skillName);

  return `---\nname: ${yamlQuote(skillName)}\ndescription: ${yamlQuote(description)}\nmetadata:\n  short-description: ${yamlQuote(shortDescription)}\n---\n\n${adapter}\n\n${body.trimStart()}`;
}

/**
 * Convert Claude Code agent markdown to Codex agent format.
 * Applies base markdown conversions, then adds a <codex_agent_role> header
 * and cleans up frontmatter (removes tools/color fields).
 */
function convertClaudeAgentToCodexAgent(content) {
  let converted = convertClaudeToCodexMarkdown(content);

  const { frontmatter, body } = extractFrontmatterAndBody(converted);
  if (!frontmatter) return converted;

  const name = extractFrontmatterField(frontmatter, 'name') || 'unknown';
  const description = extractFrontmatterField(frontmatter, 'description') || '';
  const tools = extractFrontmatterField(frontmatter, 'tools') || '';

  const roleHeader = `<codex_agent_role>
role: ${name}
tools: ${tools}
purpose: ${toSingleLine(description)}
</codex_agent_role>`;

  const cleanFrontmatter = `---\nname: ${yamlQuote(name)}\ndescription: ${yamlQuote(toSingleLine(description))}\n---`;

  return `${cleanFrontmatter}\n\n${roleHeader}\n${body}`;
}

/**
 * Generate a per-agent .toml config file for Codex.
 * Sets required agent metadata, sandbox_mode, and developer_instructions
 * from the agent markdown content.
 */
function generateCodexAgentToml(agentName, agentContent, modelOverrides = null, runtimeResolver = null) {
  const sandboxMode = CODEX_AGENT_SANDBOX[agentName] || 'read-only';
  const { frontmatter, body } = extractFrontmatterAndBody(agentContent);
  const frontmatterText = frontmatter || '';
  const resolvedName = extractFrontmatterField(frontmatterText, 'name') || agentName;
  const resolvedDescription = toSingleLine(
    extractFrontmatterField(frontmatterText, 'description') || `GSD agent ${resolvedName}`
  );
  const instructions = body.trim();

  const lines = [
    `name = ${JSON.stringify(resolvedName)}`,
    `description = ${JSON.stringify(resolvedDescription)}`,
    `sandbox_mode = "${sandboxMode}"`,
  ];

  // Embed model override when configured in ~/.gsd/defaults.json so that
  // model_overrides is respected on Codex (which uses static TOML, not inline
  // Task() model parameters). See #2256.
  // Precedence: per-agent model_overrides > runtime-aware tier resolution (#2517).
  const modelOverride = modelOverrides?.[resolvedName] || modelOverrides?.[agentName];
  if (modelOverride) {
    lines.push(`model = ${JSON.stringify(modelOverride)}`);
  } else if (runtimeResolver) {
    // #2517 — runtime-aware tier resolution. Embeds Codex-native model + reasoning_effort
    // from RUNTIME_PROFILE_MAP / model_profile_overrides for the configured tier.
    const entry = runtimeResolver.resolve(resolvedName) || runtimeResolver.resolve(agentName);
    if (entry?.model) {
      lines.push(`model = ${JSON.stringify(entry.model)}`);
      if (entry.reasoning_effort) {
        lines.push(`model_reasoning_effort = ${JSON.stringify(entry.reasoning_effort)}`);
      }
    }
  }

  // Agent prompts contain raw backslashes in regexes and shell snippets.
  // TOML literal multiline strings preserve them without escape parsing.
  lines.push(`developer_instructions = '''`);
  lines.push(instructions);
  lines.push(`'''`);

  return lines.join('\n') + '\n';
}

/**
 * Generate the GSD config block for Codex config.toml.
 * @param {Array<{name: string, description: string}>} agents
 */
function generateCodexConfigBlock(agents, targetDir) {
  // Use absolute paths when targetDir is provided — Codex ≥0.116 requires
  // AbsolutePathBuf for config_file and cannot resolve relative paths.
  const agentsPrefix = targetDir
    ? path.join(targetDir, 'agents').replace(/\\/g, '/')
    : 'agents';
  const lines = [
    GSD_CODEX_MARKER,
    '',
  ];

  for (const { name, description } of agents) {
    // #2727 — Codex 0.124.0 requires [agents.<name>] struct format, not [[agents]] sequence.
    // [[agents]] (introduced in #2645) is rejected by codex-cli 0.124.0 with
    // "invalid type: sequence, expected struct AgentsToml in `agents`".
    lines.push(`[agents.${name}]`);
    lines.push(`description = ${JSON.stringify(description)}`);
    lines.push(`config_file = "${agentsPrefix}/${name}.toml"`);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Strip any managed GSD agent sections from a TOML string.
 *
 * Used by the uninstall path (`stripGsdFromCodexConfig`). Removes only what GSD
 * owns; user-authored `[agents.<name>]` and `[[agents]]` entries are preserved
 * so uninstall returns the file to its pre-GSD shape.
 *
 * Handles BOTH shapes so reinstall self-heals configs from all GSD versions:
 *   - Current (#2727): `[agents.gsd-*]` struct tables (Codex 0.120.0+).
 *   - Legacy (#2645): `[[agents]]` array-of-tables whose `name = "gsd-*"`.
 *
 * A section runs from its header to the next `[` header or EOF.
 */
function stripCodexGsdAgentSections(content) {
  // Use the TOML-aware section parser so we never absorb adjacent user-authored
  // tables — even if their headers are indented or otherwise oddly placed.
  const sections = getTomlTableSections(content).filter((section) => {
    // Current `[agents.gsd-<name>]` struct tables (#2727, Codex 0.120.0+).
    if (!section.array && /^agents\.gsd-/.test(section.path)) {
      return true;
    }

    // Legacy `[[agents]]` array-of-tables (#2645) — only strip blocks whose
    // `name = "gsd-..."`, preserving user-authored [[agents]] entries.
    if (section.array && section.path === 'agents') {
      const body = content.slice(section.headerEnd, section.end);
      const nameMatch = body.match(/^[ \t]*name[ \t]*=[ \t]*["']([^"']+)["']/m);
      return Boolean(nameMatch && /^gsd-/.test(nameMatch[1]));
    }

    return false;
  });

  return removeContentRanges(
    content,
    sections.map(({ start, end }) => ({ start, end })),
  );
}

/**
 * Strip GSD sections from Codex config.toml content.
 * Returns cleaned content, or null if file would be empty.
 */
function stripGsdFromCodexConfig(content) {
  const eol = detectLineEnding(content);
  const markerIndex = content.indexOf(GSD_CODEX_MARKER);
  const codexHooksOwnership = getManagedCodexHooksOwnership(content);

  if (markerIndex !== -1) {
    // Has GSD marker — remove everything from marker to EOF
    let before = content.substring(0, markerIndex);
    before = stripCodexHooksFeatureAssignments(before, codexHooksOwnership);
    // Also strip GSD-injected feature keys above the marker (Case 3 inject)
    before = before.replace(/^multi_agent\s*=\s*true\s*(?:\r?\n)?/m, '');
    before = before.replace(/^default_mode_request_user_input\s*=\s*true\s*(?:\r?\n)?/m, '');
    before = before.replace(/^\[features\]\s*\n(?=\[|$)/m, '');
    before = before.replace(/^\[agents\]\s*\n(?=\[|$)/m, '');
    before = before.replace(/^(?:\r?\n)+/, '').trimEnd();
    if (!before) return null;
    return before + eol;
  }

  // No marker but may have GSD-injected feature keys
  let cleaned = content;
  cleaned = stripCodexHooksFeatureAssignments(cleaned, codexHooksOwnership);
  cleaned = cleaned.replace(/^multi_agent\s*=\s*true\s*(?:\r?\n)?/m, '');
  cleaned = cleaned.replace(/^default_mode_request_user_input\s*=\s*true\s*(?:\r?\n)?/m, '');

  // Remove [agents.gsd-*] sections (from header to next section or EOF)
  cleaned = stripCodexGsdAgentSections(cleaned);

  // Remove [features] section if now empty (only header, no keys before next section)
  cleaned = cleaned.replace(/^\[features\]\s*\n(?=\[|$)/m, '');

  // Remove [agents] section if now empty
  cleaned = cleaned.replace(/^\[agents\]\s*\n(?=\[|$)/m, '');

  cleaned = cleaned.replace(/^(?:\r?\n)+/, '').trimEnd();

  if (!cleaned) return null;
  return cleaned + eol;
}

function detectLineEnding(content) {
  const firstNewlineIndex = content.indexOf('\n');
  if (firstNewlineIndex === -1) {
    return '\n';
  }
  return firstNewlineIndex > 0 && content[firstNewlineIndex - 1] === '\r' ? '\r\n' : '\n';
}

function splitTomlLines(content) {
  const lines = [];
  let start = 0;

  while (start < content.length) {
    const newlineIndex = content.indexOf('\n', start);
    if (newlineIndex === -1) {
      lines.push({
        start,
        end: content.length,
        text: content.slice(start),
        eol: '',
      });
      break;
    }

    const hasCr = newlineIndex > start && content[newlineIndex - 1] === '\r';
    const end = hasCr ? newlineIndex - 1 : newlineIndex;
    lines.push({
      start,
      end,
      text: content.slice(start, end),
      eol: hasCr ? '\r\n' : '\n',
    });
    start = newlineIndex + 1;
  }

  return lines;
}

function findTomlCommentStart(line) {
  let i = 0;
  let multilineState = null;

  while (i < line.length) {
    if (multilineState === 'literal') {
      const closeIndex = line.indexOf('\'\'\'', i);
      if (closeIndex === -1) {
        return -1;
      }
      i = closeIndex + 3;
      multilineState = null;
      continue;
    }

    if (multilineState === 'basic') {
      const closeIndex = findMultilineBasicStringClose(line, i);
      if (closeIndex === -1) {
        return -1;
      }
      i = closeIndex + 3;
      multilineState = null;
      continue;
    }

    const ch = line[i];

    if (ch === '#') {
      return i;
    }

    if (ch === '\'') {
      if (line.startsWith('\'\'\'', i)) {
        multilineState = 'literal';
        i += 3;
        continue;
      }
      const close = line.indexOf('\'', i + 1);
      if (close === -1) return -1;
      i = close + 1;
      continue;
    }

    if (ch === '"') {
      if (line.startsWith('"""', i)) {
        multilineState = 'basic';
        i += 3;
        continue;
      }
      i += 1;
      while (i < line.length) {
        if (line[i] === '\\') {
          i += 2;
          continue;
        }
        if (line[i] === '"') {
          i += 1;
          break;
        }
        i += 1;
      }
      continue;
    }

    i += 1;
  }

  return -1;
}

function isEscapedInBasicString(line, index) {
  let slashCount = 0;
  let cursor = index - 1;

  while (cursor >= 0 && line[cursor] === '\\') {
    slashCount += 1;
    cursor -= 1;
  }

  return slashCount % 2 === 1;
}

function findMultilineBasicStringClose(line, startIndex) {
  let searchIndex = startIndex;

  while (searchIndex < line.length) {
    const closeIndex = line.indexOf('"""', searchIndex);
    if (closeIndex === -1) {
      return -1;
    }
    if (!isEscapedInBasicString(line, closeIndex)) {
      return closeIndex;
    }
    searchIndex = closeIndex + 1;
  }

  return -1;
}

function advanceTomlMultilineStringState(line, multilineState) {
  let i = 0;
  let state = multilineState;

  while (i < line.length) {
    if (state === 'literal') {
      const closeIndex = line.indexOf('\'\'\'', i);
      if (closeIndex === -1) {
        return state;
      }
      i = closeIndex + 3;
      state = null;
      continue;
    }

    if (state === 'basic') {
      const closeIndex = findMultilineBasicStringClose(line, i);
      if (closeIndex === -1) {
        return state;
      }
      i = closeIndex + 3;
      state = null;
      continue;
    }

    const ch = line[i];

    if (ch === '#') {
      return state;
    }

    if (ch === '\'') {
      if (line.startsWith('\'\'\'', i)) {
        state = 'literal';
        i += 3;
        continue;
      }
      const close = line.indexOf('\'', i + 1);
      if (close === -1) {
        return state;
      }
      i = close + 1;
      continue;
    }

    if (ch === '"') {
      if (line.startsWith('"""', i)) {
        state = 'basic';
        i += 3;
        continue;
      }
      i += 1;
      while (i < line.length) {
        if (line[i] === '\\') {
          i += 2;
          continue;
        }
        if (line[i] === '"') {
          i += 1;
          break;
        }
        i += 1;
      }
      continue;
    }

    i += 1;
  }

  return state;
}

function parseTomlBracketHeader(line, array) {
  let i = 0;

  while (i < line.length && /\s/.test(line[i])) {
    i += 1;
  }

  const open = array ? '[[' : '[';
  const close = array ? ']]' : ']';
  if (!line.startsWith(open, i)) {
    return null;
  }

  i += open.length;
  const start = i;

  while (i < line.length) {
    if (line[i] === '\'' || line[i] === '"') {
      const quote = line[i];
      i += 1;

      while (i < line.length) {
        if (quote === '"' && line[i] === '\\') {
          i += 2;
          continue;
        }

        if (line[i] === quote) {
          i += 1;
          break;
        }

        i += 1;
      }

      continue;
    }

    if (line.startsWith(close, i)) {
      const rawPath = line.slice(start, i).trim();
      const segments = parseTomlKeyPath(rawPath);
      if (!segments) {
        return null;
      }

      i += close.length;
      while (i < line.length && /\s/.test(line[i])) {
        i += 1;
      }

      if (i < line.length && line[i] !== '#') {
        return null;
      }

      return { path: segments.join('.'), segments, array };
    }

    if (line[i] === '#' || line[i] === '\r' || line[i] === '\n') {
      return null;
    }

    i += 1;
  }

  return null;
}

function parseTomlTableHeader(line) {
  return parseTomlBracketHeader(line, true) || parseTomlBracketHeader(line, false);
}

function findTomlAssignmentEquals(line) {
  let i = 0;

  while (i < line.length) {
    const ch = line[i];

    if (ch === '#') {
      return -1;
    }

    if (ch === '\'') {
      i += 1;
      while (i < line.length) {
        if (line[i] === '\'') {
          i += 1;
          break;
        }
        i += 1;
      }
      continue;
    }

    if (ch === '"') {
      i += 1;
      while (i < line.length) {
        if (line[i] === '\\') {
          i += 2;
          continue;
        }
        if (line[i] === '"') {
          i += 1;
          break;
        }
        i += 1;
      }
      continue;
    }

    if (ch === '=') {
      return i;
    }

    i += 1;
  }

  return -1;
}

function parseTomlKeyPath(keyText) {
  const segments = [];
  let i = 0;

  while (i < keyText.length) {
    while (i < keyText.length && /\s/.test(keyText[i])) {
      i += 1;
    }

    if (i >= keyText.length) {
      break;
    }

    if (keyText[i] === '\'' || keyText[i] === '"') {
      const quote = keyText[i];
      let segment = '';
      let closed = false;
      i += 1;

      while (i < keyText.length) {
        if (quote === '"' && keyText[i] === '\\') {
          if (i + 1 >= keyText.length) {
            return null;
          }
          segment += keyText[i + 1];
          i += 2;
          continue;
        }

        if (keyText[i] === quote) {
          i += 1;
          closed = true;
          break;
        }

        segment += keyText[i];
        i += 1;
      }

      if (!closed) {
        return null;
      }

      segments.push(segment);
    } else {
      const match = keyText.slice(i).match(/^[A-Za-z0-9_-]+/);
      if (!match) {
        return null;
      }
      segments.push(match[0]);
      i += match[0].length;
    }

    while (i < keyText.length && /\s/.test(keyText[i])) {
      i += 1;
    }

    if (i >= keyText.length) {
      break;
    }

    if (keyText[i] !== '.') {
      return null;
    }

    i += 1;
  }

  return segments.length > 0 ? segments : null;
}

function parseTomlKey(line) {
  const header = parseTomlTableHeader(line);
  if (header) {
    return null;
  }

  const equalsIndex = findTomlAssignmentEquals(line);
  if (equalsIndex === -1) {
    return null;
  }

  const raw = line.slice(0, equalsIndex).trim();
  const segments = parseTomlKeyPath(raw);
  if (!segments) {
    return null;
  }

  return { raw, segments };
}

function getTomlLineRecords(content) {
  const lines = splitTomlLines(content);
  const records = [];
  let currentTablePath = null;
  let multilineState = null;

  for (const line of lines) {
    const startsInMultilineString = multilineState !== null;
    const record = {
      ...line,
      startsInMultilineString,
      tablePath: currentTablePath,
      tableHeader: null,
      keySegments: null,
    };

    if (!startsInMultilineString) {
      const header = parseTomlTableHeader(line.text);
      if (header) {
        record.tableHeader = header;
        currentTablePath = header.path;
      } else {
        const key = parseTomlKey(line.text);
        record.keySegments = key ? key.segments : null;
        record.keyRaw = key ? key.raw : null;
      }
    }

    multilineState = advanceTomlMultilineStringState(line.text, multilineState);
    records.push(record);
  }

  return records;
}

function getTomlTableSections(content) {
  const headerLines = getTomlLineRecords(content).filter((record) => record.tableHeader);

  return headerLines.map((record, index) => ({
    path: record.tableHeader.path,
    // segments preserves the true parsed key count so callers that need to
    // distinguish a 2-segment path like hooks."before.tool" from a 3-segment
    // path like hooks.SessionStart.hooks can do so without splitting on dots
    // (which misclassifies quoted key names that contain dot characters).
    segments: record.tableHeader.segments,
    array: record.tableHeader.array,
    start: record.start,
    headerEnd: record.end + record.eol.length,
    end: index + 1 < headerLines.length ? headerLines[index + 1].start : content.length,
  }));
}

function collapseTomlBlankLines(content) {
  const eol = detectLineEnding(content);
  return content.replace(/(?:\r?\n){3,}/g, eol + eol);
}

function removeContentRanges(content, ranges) {
  const normalizedRanges = ranges
    .filter((range) => range && range.start < range.end)
    .sort((a, b) => a.start - b.start);

  if (normalizedRanges.length === 0) {
    return content;
  }

  const mergedRanges = [{ ...normalizedRanges[0] }];

  for (let i = 1; i < normalizedRanges.length; i += 1) {
    const current = normalizedRanges[i];
    const previous = mergedRanges[mergedRanges.length - 1];

    if (current.start <= previous.end) {
      previous.end = Math.max(previous.end, current.end);
      continue;
    }

    mergedRanges.push({ ...current });
  }

  let cleaned = '';
  let cursor = 0;

  for (const range of mergedRanges) {
    cleaned += content.slice(cursor, range.start);
    cursor = range.end;
  }

  cleaned += content.slice(cursor);
  return cleaned;
}

function stripCodexHooksFeatureAssignments(content, ownership = null) {
  const lineRecords = getTomlLineRecords(content);
  const tableSections = getTomlTableSections(content);
  const removalRanges = [];
  const featuresSection = tableSections.find((section) => !section.array && section.path === 'features');
  const shouldStripSectionKey = ownership === 'section' || ownership === 'all';
  const shouldStripRootDottedKey = ownership === 'root_dotted' || ownership === 'all';

  if (featuresSection && shouldStripSectionKey) {
    const sectionRecords = lineRecords.filter((record) =>
      !record.tableHeader &&
      record.start >= featuresSection.headerEnd &&
      record.end + record.eol.length <= featuresSection.end
    );

    const codexHookRecords = sectionRecords.filter((record) =>
      !record.startsInMultilineString &&
      record.keySegments &&
      record.keySegments.length === 1 &&
      record.keySegments[0] === 'codex_hooks'
    );

    for (const record of codexHookRecords) {
      removalRanges.push({
        start: record.start,
        end: findTomlAssignmentBlockEnd(content, record),
      });
    }

    if (codexHookRecords.length > 0) {
      const removedStarts = new Set(codexHookRecords.map((record) => record.start));
      const hasRemainingContent = sectionRecords.some((record) => {
        if (removedStarts.has(record.start)) {
          return false;
        }

        const trimmed = record.text.trim();
        return trimmed !== '' && !trimmed.startsWith('#');
      });
      const hasRemainingComments = sectionRecords.some((record) => {
        if (removedStarts.has(record.start)) {
          return false;
        }

        return record.text.trim().startsWith('#');
      });

      if (!hasRemainingContent && !hasRemainingComments) {
        removalRanges.push({
          start: featuresSection.start,
          end: featuresSection.end,
        });
      }
    }
  }

  if (shouldStripRootDottedKey) {
    const rootCodexHookRecords = lineRecords.filter((record) =>
      !record.tableHeader &&
      !record.startsInMultilineString &&
      record.tablePath === null &&
      record.keySegments &&
      record.keySegments.length === 2 &&
      record.keySegments[0] === 'features' &&
      record.keySegments[1] === 'codex_hooks'
    );

    for (const record of rootCodexHookRecords) {
      removalRanges.push({
        start: record.start,
        end: findTomlAssignmentBlockEnd(content, record),
      });
    }
  }

  return removeContentRanges(content, removalRanges);
}

function getManagedCodexHooksOwnership(content) {
  const markerIndex = content.indexOf(GSD_CODEX_MARKER);
  if (markerIndex === -1) {
    return null;
  }

  const afterMarker = content.slice(markerIndex + GSD_CODEX_MARKER.length);
  const match = afterMarker.match(/^\r?\n# GSD codex_hooks ownership: (section|root_dotted)\r?\n/);
  return match ? match[1] : null;
}

function setManagedCodexHooksOwnership(content, ownership) {
  const markerIndex = content.indexOf(GSD_CODEX_MARKER);
  if (markerIndex === -1) {
    return content;
  }

  const eol = detectLineEnding(content);
  const markerEnd = markerIndex + GSD_CODEX_MARKER.length;
  const afterMarker = content.slice(markerEnd);
  const normalizedAfterMarker = afterMarker.replace(
    /^\r?\n# GSD codex_hooks ownership: (?:section|root_dotted)\r?\n/,
    eol
  );

  if (!ownership) {
    return content.slice(0, markerEnd) + normalizedAfterMarker;
  }

  const remainder = normalizedAfterMarker.replace(/^\r?\n/, '');
  return content.slice(0, markerEnd) +
    eol +
    `${GSD_CODEX_HOOKS_OWNERSHIP_PREFIX}${ownership}${eol}` +
    remainder;
}

function isLegacyGsdAgentsSection(body) {
  const lineRecords = getTomlLineRecords(body);
  const legacyKeys = new Set(['max_threads', 'max_depth']);
  let sawLegacyKey = false;

  for (const record of lineRecords) {
    if (record.startsInMultilineString) {
      return false;
    }

    if (record.tableHeader) {
      return false;
    }

    const trimmed = record.text.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    if (!record.keySegments || record.keySegments.length !== 1 || !legacyKeys.has(record.keySegments[0])) {
      return false;
    }

    sawLegacyKey = true;
  }

  return sawLegacyKey;
}

function stripLeakedGsdCodexSections(content) {
  // Defensive precedence (#2760): we own the `agents` namespace under our
  // managed `gsd-*` names, and the legacy bare-table and sequence forms
  // (`[agents]`, `[[agents]]`) are invalid in the current Codex schema —
  // they trigger "invalid type: ..., expected struct AgentsToml" and break
  // every Codex CLI invocation. They MUST never coexist with the new
  // `[agents.<name>]` struct format we now emit, so install-time always
  // purges them regardless of GSD marker presence. Users who had legitimate
  // user-authored `[[agents]]` entries before are already broken on Codex
  // ≥0.124 — purging is the only path to a loadable config.
  const leakedSections = getTomlTableSections(content)
    .filter((section) => {
      // Legacy [agents.gsd-<name>] map tables (pre-#2645).
      if (!section.array && section.path.startsWith('agents.gsd-')) return true;

      // ANY bare [agents] single-bracket table — invalid in current Codex
      // schema, always purged at install time (#2760). Previously gated
      // on `isLegacyGsdAgentsSection`, which missed bare tables holding
      // arbitrary user keys (`default = "..."`, etc.) that still produce
      // the AgentsToml type error.
      if (!section.array && section.path === 'agents') return true;

      // ANY [[agents]] array-of-tables — invalid in current Codex schema,
      // always purged at install time (#2760). Previously gated on
      // `name = "gsd-..."` which preserved user-authored entries that are
      // themselves rejected by Codex 0.124+.
      if (section.array && section.path === 'agents') return true;

      return false;
    });

  if (leakedSections.length === 0) {
    return content;
  }

  let cleaned = '';
  let cursor = 0;

  for (const section of leakedSections) {
    cleaned += content.slice(cursor, section.start);
    cursor = section.end;
  }

  cleaned += content.slice(cursor);
  return collapseTomlBlankLines(cleaned);
}

/**
 * Strip GSD-managed legacy Codex hook blocks from a config.toml string
 * using the TOML AST already used elsewhere in this file
 * (`getTomlTableSections` + `removeContentRanges`). The earlier regex-based
 * implementation required a precise key order, exact single-space padding
 * around `=`, and exactly one blank line between Shape 4's parent/child
 * tables — any deviation (an extra blank line, key reorder, an added
 * `timeout` key, `event="SessionStart"` without spaces) silently leaked the
 * stale block, sometimes corrupting the file by leaving orphaned key=value
 * lines outside any table.
 *
 * The structural approach: find every `hooks*` table whose body contains a
 * `command = "...gsd-(check-update|update-check).js"` value, remove its
 * exact byte range, and additionally remove any orphaned parent
 * `[[hooks.SessionStart]]` whose body becomes empty as a result (Shape 4).
 * The leading `# GSD Hooks` header line is swallowed by extending the
 * removal range backward through any single preceding comment line.
 *
 * Pure function, exported for test coverage. Returns the input unchanged
 * if no GSD-managed hook section is present.
 */
// Legacy hook command basenames to detect during strip. Template-literal
// form so install-hooks-copy.test.cjs's quoted-literal guard continues to
// catch accidental regressions where someone *registers* the inverted
// `gsd-update-check.js` filename in a Codex hook command.
const STALE_HOOK_BASENAMES = new Set([
  `gsd-update-check.js`,
  `gsd-check-update.js`,
]);
function stripStaleGsdHookBlocks(configContent) {
  const sections = getTomlTableSections(configContent);
  const lineRecords = getTomlLineRecords(configContent);
  const hookSections = sections.filter(
    (s) => s.path === 'hooks' || s.path.startsWith('hooks.')
  );
  if (hookSections.length === 0) {
    return configContent;
  }

  // A section is GSD-managed if any structural `command` key inside its
  // body parses to a string whose basename matches `gsd-(check-update|
  // update-check).js`. The TOML line parser already classified each line's
  // `keySegments`, so we never inspect raw text — this handles arbitrary
  // whitespace, key reordering, and additional keys robustly.
  function sectionHasStaleCommand(section) {
    const records = lineRecords.filter(
      (r) => !r.startsInMultilineString
        && !r.tableHeader
        && r.start >= section.headerEnd
        && r.end + r.eol.length <= section.end
        && r.keySegments
        && r.keySegments.length === 1
        && r.keySegments[0] === 'command'
    );
    for (const record of records) {
      const equalsIndex = findTomlAssignmentEquals(record.text);
      if (equalsIndex === -1) continue;
      let parsed;
      try {
        parsed = parseTomlValue(record.text, equalsIndex + 1);
      } catch {
        continue;
      }
      if (typeof parsed.value !== 'string') continue;
      // Match the basename — Codex configs reference these files by absolute
      // path under the user's `.codex/hooks/` directory.
      const basename = parsed.value.split(/[\\/]/).pop() || '';
      if (STALE_HOOK_BASENAMES.has(basename)) {
        return true;
      }
    }
    return false;
  }

  const stale = new Set(hookSections.filter(sectionHasStaleCommand));
  if (stale.size === 0) {
    return configContent;
  }

  // Shape 4: a `[[hooks.SessionStart]]` event-table whose body is empty and
  // whose immediately following section is a stale child handler table
  // (`[[hooks.SessionStart.hooks]]`) becomes orphaned once the child is
  // stripped. Detect emptiness via line records — no key/value lines and no
  // non-blank, non-comment text between this section's header and the next.
  function sectionBodyHasContent(section) {
    return lineRecords.some(
      (r) => !r.startsInMultilineString
        && !r.tableHeader
        && r.start >= section.headerEnd
        && r.end + r.eol.length <= section.end
        && r.text.trim() !== ''
        && !r.text.trim().startsWith('#')
    );
  }
  for (let i = 0; i < sections.length; i += 1) {
    const parent = sections[i];
    if (stale.has(parent)) continue;
    if (!parent.array || parent.path !== 'hooks.SessionStart') continue;
    if (sectionBodyHasContent(parent)) continue;
    const next = sections[i + 1];
    if (next && stale.has(next) && next.path.startsWith('hooks.SessionStart.')) {
      stale.add(parent);
    }
  }

  // Each removal range starts at the table header. If the immediately
  // preceding line is the GSD marker comment `# GSD Hooks` (and is not part
  // of an already-removed section), extend the range backward to swallow it
  // — preserves cleanliness on round-trip strip+rewrite.
  const ranges = [];
  for (const section of stale) {
    let start = section.start;
    const headerLineIdx = lineRecords.findIndex((r) => r.start === section.start);
    const prev = headerLineIdx > 0 ? lineRecords[headerLineIdx - 1] : null;
    if (prev && !prev.startsInMultilineString && prev.text.trim() === '# GSD Hooks') {
      start = prev.start;
    }
    ranges.push({ start, end: section.end });
  }

  return collapseTomlBlankLines(removeContentRanges(configContent, ranges));
}

/**
 * Migrate legacy Codex [hooks] map format to [[hooks]] array-of-tables format.
 *
 * Codex 0.124.0 changed from the old map-style hooks config:
 *   [hooks]
 *     [hooks.shell]
 *     command = "..."
 *
 * to the new array-of-tables format. #2760 CR5 finding 3 — emit the
 * namespaced AoT shape directly so a mixed flat + namespaced layout never
 * arises post-install:
 *   [[hooks.shell]]
 *   command = "..."
 *
 * This function detects any non-array hooks sections in the config and
 * converts them to the namespaced `[[hooks.<TYPE>]]` array-of-tables form,
 * preserving all key-value pairs and user comments. Bare [hooks] container
 * sections (no key-value content) are dropped. User-authored AoT entries are
 * left untouched.
 *
 * Returns the migrated content, or the original content unchanged if no
 * legacy hooks sections were found.
 */
function migrateCodexHooksMapFormat(content) {
  const sections = getTomlTableSections(content);

  // Find all non-array hooks sections: bare [hooks] container or [hooks.TYPE] event tables.
  // Use section.segments (parsed key count) rather than section.path.startsWith() so that
  // nested handler tables like [hooks.SessionStart.hooks] (3 segments) are not mistakenly
  // included and re-emitted as an event named "SessionStart.hooks".
  const legacyMapSections = sections.filter(
    (section) => !section.array && (
      section.path === 'hooks' ||
      (section.path.startsWith('hooks.') && section.segments.length === 2)
    )
  );

  // Find flat [[hooks]] array-of-tables entries (path === 'hooks', array === true).
  // These are incompatible with [[hooks.<EVENT>]] namespaced form — both cannot
  // coexist in the same TOML file because `hooks` cannot be simultaneously an
  // array and a table. Migrate each flat entry to [[hooks.<EVENT>]] form using
  // the `event` key as the event name.
  const flatAotSections = sections.filter(
    (section) => section.array && section.path === 'hooks'
  );

  // Find [[hooks.TYPE]] namespaced AoT entries that carry handler fields
  // (command, type, timeout, statusMessage) at event-entry level but have no
  // [[hooks.TYPE.hooks]] sub-table. This is the pre-#2773 single-block shape
  // that Codex 0.124.0+ rejects. Promote them to the two-level nested form.
  // Entries that already have a [[hooks.TYPE.hooks]] sub-table are left untouched.
  // Matcher-only entries (no handler fields) are intentionally valid and skipped.
  const STALE_HANDLER_FIELD_PATTERN = /^\s*(?:command|type|timeout|statusMessage)\s*=/m;
  const staleNamespacedAotSections = sections.filter((section) => {
    if (!section.array) return false;
    if (!section.path.startsWith('hooks.')) return false;
    // [[hooks.TYPE.hooks]] sub-tables have 3 parsed segments — skip them.
    // Use section.segments (true parsed key count) rather than splitting
    // section.path on '.', which misclassifies quoted event names that contain
    // dots (e.g. [[hooks."before.tool"]] has segments ['hooks','before.tool']
    // but path 'hooks.before.tool' would split into 3 parts).
    if (section.segments.length !== 2) return false;
    // Must carry at least one handler field at event-entry level.
    const body = content.slice(section.headerEnd, section.end);
    if (!STALE_HANDLER_FIELD_PATTERN.test(body)) return false;
    // Don't migrate when the nested [[hooks.TYPE.hooks]] sub-table already exists.
    const subPath = section.path + '.hooks';
    return !sections.some((s) => s.array && s.path === subPath);
  });

  if (legacyMapSections.length === 0 && flatAotSections.length === 0 && staleNamespacedAotSections.length === 0) {
    return content;
  }

  const eol = detectLineEnding(content);

  // Helper: parse a hooks body into event-level and handler-level entries,
  // returning { eventEntries, handlerEntries, hasExplicitType }.
  // Event-level keys: matcher. Everything else is handler-level.
  // The `event` key (used in flat [[hooks]] blocks) is consumed as the type
  // name and excluded from both levels.
  const EVENT_LEVEL_KEYS = new Set(['matcher']);
  function parseHooksBody(body, skipKeys = new Set()) {
    const bodyLines = body.split(/\r?\n/);
    const eventEntries = [];
    const handlerEntries = [];
    let hasExplicitType = false;
    for (const line of bodyLines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      // Use parseTomlKey so hyphenated keys (e.g. status-message) and quoted
      // keys are recognised — the old /^([\w.]+)\s*=/ regex silently dropped them.
      const parsed = parseTomlKey(trimmed);
      if (!parsed) continue;
      // Hook body keys are always single-segment; use segments[0] for the name.
      const key = parsed.segments[0];
      if (skipKeys.has(key)) continue;
      if (key === 'type') {
        hasExplicitType = true;
        handlerEntries.push(trimmed);
      } else if (EVENT_LEVEL_KEYS.has(key)) {
        eventEntries.push(trimmed);
      } else {
        handlerEntries.push(trimmed);
      }
    }
    return { eventEntries, handlerEntries, hasExplicitType };
  }

  // TOML key quoting: bare keys may only contain [A-Za-z0-9_-]. Event names
  // containing spaces, dots, or other punctuation must be wrapped in double-
  // quoted TOML strings with backslash and double-quote characters escaped.
  // Using raw event names in [[hooks.${type}]] headers produces invalid TOML
  // for any non-bare-key character (e.g. "Before Tool" → [[hooks.Before Tool]]).
  function tomlBareKey(key) {
    if (/^[A-Za-z0-9_-]+$/.test(key)) return key;
    return '"' + key.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
  }

  function buildNestedBlock(type, body, skipKeys = new Set()) {
    const quotedType = tomlBareKey(type);
    const { eventEntries, handlerEntries, hasExplicitType } = parseHooksBody(body, skipKeys);
    const eventBody = eventEntries.length > 0 ? eventEntries.join(eol) + eol : '';
    // If no handler fields were found (e.g. matcher-only entry), do not synthesise
    // an empty [[hooks.TYPE.hooks]] block — that would produce structurally valid
    // TOML but semantically broken output (a handler entry with no command).
    if (handlerEntries.length === 0) {
      return `[[hooks.${quotedType}]]${eol}${eventBody}`;
    }
    if (!hasExplicitType) handlerEntries.unshift('type = "command"');
    const handlerBody = handlerEntries.join(eol) + eol;
    return `[[hooks.${quotedType}]]${eol}${eventBody}${eol}[[hooks.${quotedType}.hooks]]${eol}${handlerBody}`;
  }

  // Extract the event name from a flat [[hooks]] section body.
  // Returns null if no `event` key is found, if the value is an empty string, or if
  // the quoting is unrecognised. Both TOML double-quoted ("...") and single-quoted
  // ('...') strings are accepted. An empty event string (event = "" or event = '')
  // is explicitly rejected — it cannot be meaningfully namespaced and is left untouched.
  function extractFlatHookEventName(body) {
    const TOML_EVENT_CAPTURE = /^\s*event\s*=\s*(?:"((?:[^"\\]|\\.)*)"|'([^']*)')/m;
    const m = body.match(TOML_EVENT_CAPTURE);
    if (!m) return null;
    const name = (m[1] ?? m[2] ?? '').trim();
    return name || null;
  }

  const migratedFlatAotSections = flatAotSections.filter((section) => {
    const body = content.slice(section.headerEnd, section.end);
    return extractFlatHookEventName(body) !== null;
  });

  const legacyHooksSections = [...legacyMapSections, ...migratedFlatAotSections, ...staleNamespacedAotSections];

  // Remove all legacy hooks sections from the content
  let result = removeContentRanges(
    content,
    legacyHooksSections.map(({ start, end }) => ({ start, end })),
  );
  result = collapseTomlBlankLines(result);

  // Map-format blocks ([hooks.TYPE]) are inserted at the position of the first
  // remaining table section (preserving their relative placement in the file).
  // Flat AoT blocks ([[hooks]] with event = "...") are always APPENDED because
  // flat [[hooks]] entries only appear at the END of a TOML file (AoT cannot
  // precede a regular table), and inserting before the first table would push
  // them above [features] / [model] etc., corrupting relative ordering.
  const mapOnlyBlocks = legacyMapSections
    .filter((s) => s.path !== 'hooks')   // skip bare [hooks] container
    .map((s) => {
      const type = s.path.slice('hooks.'.length);
      const body = content.slice(s.headerEnd, s.end);
      return buildNestedBlock(type, body);
    });

  // Stale namespaced AoT blocks: [[hooks.TYPE]] entries with handler fields at
  // event-entry level (no .hooks sub-table). Treated like map-format blocks —
  // inserted before the first remaining table section.
  const staleNamespacedAotBlocks = staleNamespacedAotSections.map((s) => {
    const type = s.path.slice('hooks.'.length);
    const body = content.slice(s.headerEnd, s.end);
    return buildNestedBlock(type, body);
  });

  const flatAotBlocks = migratedFlatAotSections.map((s) => {
    const body = content.slice(s.headerEnd, s.end);
    const eventName = extractFlatHookEventName(body);
    if (!eventName) return '';
    return buildNestedBlock(eventName, body, new Set(['event']));
  }).filter(Boolean);

  // Insert map-format and stale-namespaced-AoT conversions before the first
  // remaining table section (both share the same placement strategy).
  const allMapStyleBlocks = [...mapOnlyBlocks, ...staleNamespacedAotBlocks];
  if (allMapStyleBlocks.length > 0) {
    const insertionText = allMapStyleBlocks.join('');
    const remainingSections = getTomlTableSections(result);
    if (remainingSections.length > 0) {
      const firstTable = remainingSections[0];
      const before = result.slice(0, firstTable.start);
      const after = result.slice(firstTable.start);
      const needsLeadingGap = before.length > 0 && !before.endsWith(eol + eol);
      const needsTrailingGap = after.length > 0 && !insertionText.endsWith(eol + eol);
      result = before +
        (needsLeadingGap ? eol : '') +
        insertionText +
        (needsTrailingGap ? eol : '') +
        after;
    } else {
      const needsGap = result.length > 0 && !result.endsWith(eol + eol);
      result = result + (needsGap ? eol : '') + insertionText;
    }
  }

  // Insert flat-AoT conversions before the GSD managed marker (if present) so
  // the migrated user hooks stay in the "user" portion of the file and are not
  // swept away when stripGsdFromCodexConfig strips from the marker to EOF.
  // If no marker exists, append at the end of the file.
  if (flatAotBlocks.length > 0) {
    const insertionText = flatAotBlocks.join('');
    const markerIdx = result.indexOf(GSD_CODEX_MARKER);
    if (markerIdx !== -1) {
      const before = result.slice(0, markerIdx).trimEnd();
      const after = result.slice(markerIdx);
      result = before + eol + eol + insertionText + eol + after;
    } else {
      const needsGap = result.length > 0 && !result.endsWith(eol + eol);
      result = result + (needsGap ? eol : '') + insertionText;
    }
  }

  return result;
}

/**
 * Detect whether the user already uses the namespaced AoT hooks form
 * (`[[hooks.<EVENT>]]`) for the given event in the config. When true,
 * the GSD-managed hook block must be emitted in the same shape so it
 * coexists cleanly — mixing `[[hooks]]` (flat) with `[[hooks.SessionStart]]`
 * (namespaced) in the same file confuses round-trip writers and can
 * produce a config that Codex rejects (#2760, defect 3).
 */
function hasUserNamespacedAotHooks(content, event) {
  const sections = getTomlTableSections(content);
  return sections.some(
    (section) => section.array && section.path === `hooks.${event}`
  );
}

/**
 * Parse a TOML value RHS expression starting at index `i` of `text`.
 * Returns { value, end } on success or throws on parse failure.
 *
 * Supports the value forms GSD emits or that real Codex configs commonly use:
 *   - basic strings ("…" with simple escapes)
 *   - literal strings ('…')
 *   - booleans (true / false)
 *   - integers (optional sign, decimal digits)
 *   - inline arrays of the above
 *   - inline tables { k = v, … }
 *
 * This is intentionally not a complete TOML implementation — it is the
 * minimal value grammar required to validate Codex config structure and to
 * back behavioral assertions in tests (#2760).
 */
function parseTomlValue(text, i) {
  // Skip leading whitespace.
  while (i < text.length && (text[i] === ' ' || text[i] === '\t')) {
    i += 1;
  }
  if (i >= text.length) {
    throw new Error('expected value, got end of input');
  }

  const ch = text[i];

  // Basic string
  if (ch === '"') {
    if (text.startsWith('"""', i)) {
      const close = findMultilineBasicStringClose(text, i + 3);
      if (close === -1) {
        throw new Error('unterminated multi-line basic string');
      }
      const raw = text.slice(i + 3, close);
      return { value: raw.replace(/^\r?\n/, ''), end: close + 3 };
    }
    let j = i + 1;
    let out = '';
    while (j < text.length) {
      const c = text[j];
      if (c === '\\') {
        const next = text[j + 1];
        if (next === 'n') { out += '\n'; j += 2; continue; }
        if (next === 't') { out += '\t'; j += 2; continue; }
        if (next === 'r') { out += '\r'; j += 2; continue; }
        if (next === '\\') { out += '\\'; j += 2; continue; }
        if (next === '"') { out += '"'; j += 2; continue; }
        if (next === '/') { out += '/'; j += 2; continue; }
        // Pass-through unrecognized escape (Codex/GSD don't use these).
        out += next === undefined ? '' : next;
        j += 2;
        continue;
      }
      if (c === '"') {
        return { value: out, end: j + 1 };
      }
      out += c;
      j += 1;
    }
    throw new Error('unterminated basic string');
  }

  // Literal string
  if (ch === '\'') {
    if (text.startsWith('\'\'\'', i)) {
      const close = text.indexOf('\'\'\'', i + 3);
      if (close === -1) throw new Error('unterminated multi-line literal string');
      return { value: text.slice(i + 3, close).replace(/^\r?\n/, ''), end: close + 3 };
    }
    const close = text.indexOf('\'', i + 1);
    if (close === -1) throw new Error('unterminated literal string');
    return { value: text.slice(i + 1, close), end: close + 1 };
  }

  // Boolean
  if (text.startsWith('true', i) && !/[A-Za-z0-9_-]/.test(text[i + 4] || '')) {
    return { value: true, end: i + 4 };
  }
  if (text.startsWith('false', i) && !/[A-Za-z0-9_-]/.test(text[i + 5] || '')) {
    return { value: false, end: i + 5 };
  }

  // Inline array
  if (ch === '[') {
    const arr = [];
    let j = i + 1;
    while (true) {
      while (j < text.length && /[\s\r\n]/.test(text[j])) j += 1;
      if (j >= text.length) throw new Error('unterminated inline array');
      if (text[j] === ']') return { value: arr, end: j + 1 };
      if (text[j] === '#') {
        const nl = text.indexOf('\n', j);
        j = nl === -1 ? text.length : nl + 1;
        continue;
      }
      const parsed = parseTomlValue(text, j);
      arr.push(parsed.value);
      j = parsed.end;
      while (j < text.length && /[\s\r\n]/.test(text[j])) j += 1;
      if (j < text.length && text[j] === ',') {
        j += 1;
        continue;
      }
      while (j < text.length && /[\s\r\n]/.test(text[j])) j += 1;
      if (text[j] === ']') return { value: arr, end: j + 1 };
      throw new Error(`expected , or ] in inline array at offset ${j}`);
    }
  }

  // Inline table
  if (ch === '{') {
    const obj = {};
    let j = i + 1;
    while (true) {
      while (j < text.length && /[\s\r\n]/.test(text[j])) j += 1;
      if (text[j] === '}') return { value: obj, end: j + 1 };
      const keyMatch = text.slice(j).match(/^([A-Za-z0-9_-]+|"[^"]*"|'[^']*')\s*=\s*/);
      if (!keyMatch) throw new Error(`expected key in inline table at offset ${j}`);
      let rawKey = keyMatch[1];
      if ((rawKey.startsWith('"') && rawKey.endsWith('"')) || (rawKey.startsWith('\'') && rawKey.endsWith('\''))) {
        rawKey = rawKey.slice(1, -1);
      }
      j += keyMatch[0].length;
      const parsed = parseTomlValue(text, j);
      obj[rawKey] = parsed.value;
      j = parsed.end;
      while (j < text.length && /[\s\r\n]/.test(text[j])) j += 1;
      if (text[j] === ',') { j += 1; continue; }
      if (text[j] === '}') return { value: obj, end: j + 1 };
      throw new Error(`expected , or } in inline table at offset ${j}`);
    }
  }

  // Number (integer with optional sign). Float / date / time / hex / oct / bin
  // are NOT supported — we reject them explicitly instead of silently truncating
  // an integer prefix off a `0.5` float or `1979-05-27` date. (#2760 CR4 finding 3)
  const numMatch = text.slice(i).match(/^[+-]?\d[\d_]*/);
  if (numMatch) {
    const after = text[i + numMatch[0].length];
    // Reject: float (`.`, `e`, `E`), date/time (`-`, `:`, `T`, `Z`), or any
    // continuation digit/letter that suggests an unsupported numeric form.
    if (after !== undefined && /[.eE:\-TZ]/.test(after)) {
      throw new Error(
        `unsupported TOML value at offset ${i}: floats, dates, and times are not supported (got ${text.slice(i, i + 20)})`
      );
    }
    const digits = numMatch[0].replace(/_/g, '');
    const n = Number(digits);
    if (!Number.isFinite(n)) throw new Error(`invalid number: ${numMatch[0]}`);
    return { value: n, end: i + numMatch[0].length };
  }

  throw new Error(`unsupported value at offset ${i}: ${text.slice(i, i + 20)}`);
}

/**
 * Parse TOML content into a JavaScript object. Throws on malformed input.
 *
 * Handles `[table]`, `[[array.of.tables]]`, dotted key paths, and the value
 * forms supported by parseTomlValue. Sufficient for validating Codex config
 * structure and for behavioral test assertions in #2760 — not a general
 * TOML implementation.
 */
function parseTomlToObject(content) {
  const root = {};
  const records = getTomlLineRecords(content);
  // Tracks the *object* (not path) that subsequent key=value lines target.
  let currentTable = root;

  // #2760 CR5 finding 2 — track shape and definition status of every path so
  // we can reject duplicate header redeclarations, shape mismatches, and
  // duplicate keys per real TOML 1.0 semantics. Without this, walkPath
  // silently reuses existing tables and assignment overwrites existing keys —
  // a real TOML parser would refuse the file.
  //
  // pathShape: dotted path -> 'table' | 'array' | 'inline_parent' | 'key'
  //   - 'table' — declared via [a.b]
  //   - 'array' — declared via [[a.b]] (path is the array itself; each
  //               element is its own implicit table)
  //   - 'inline_parent' — created implicitly while walking parents
  //   - 'key'   — assigned a scalar value
  // declaredHeaders: set of dotted paths explicitly declared via [hdr] (not
  //   [[arr]]) — used to reject duplicate [a] / [a] sections.
  // tableKeys: dotted-path -> Set<string> of keys assigned in that exact
  //   table instance. For [[arr]] elements we use a per-element marker.
  const pathShape = new Map();
  const declaredHeaders = new Set();
  const tableKeys = new Map();
  // currentTableId — string identifier for the current table instance, used
  // as the key into tableKeys so that key uniqueness is per-table-instance
  // (each [[arr]] element gets its own id).
  let currentTableId = '__root__';
  pathShape.set('__root__', 'table');
  tableKeys.set('__root__', new Set());

  function ensureKeySet(id) {
    if (!tableKeys.has(id)) tableKeys.set(id, new Set());
    return tableKeys.get(id);
  }

  function walkPath(segments, { creatingArrayElement = false } = {}) {
    let node = root;
    const parents = segments.slice(0, -1);
    const last = segments[segments.length - 1];

    for (let p = 0; p < parents.length; p += 1) {
      const seg = parents[p];
      const partialPath = parents.slice(0, p + 1).join('.');
      if (node[seg] === undefined) {
        node[seg] = {};
        if (!pathShape.has(partialPath)) {
          pathShape.set(partialPath, 'inline_parent');
        }
      } else if (Array.isArray(node[seg])) {
        // Walk into the latest element of an array-of-tables.
        node = node[seg][node[seg].length - 1];
        continue;
      } else if (typeof node[seg] !== 'object' || node[seg] === null) {
        throw new Error(`path segment ${seg} is not a table`);
      }
      node = node[seg];
    }

    const fullPath = segments.join('.');

    if (creatingArrayElement) {
      const existingShape = pathShape.get(fullPath);
      if (node[last] === undefined) {
        node[last] = [];
        pathShape.set(fullPath, 'array');
      } else if (!Array.isArray(node[last])) {
        throw new Error(
          `duplicate or shape-mismatched table header at ${fullPath}: ` +
          `cannot redefine as array of tables (previously seen as ${existingShape || 'table'})`
        );
      } else if (existingShape && existingShape !== 'array') {
        throw new Error(
          `duplicate or shape-mismatched table header at ${fullPath}: ` +
          `previously seen as ${existingShape}, cannot extend as array of tables`
        );
      }
      const elem = {};
      node[last].push(elem);
      const elemId = `${fullPath}[${node[last].length - 1}]`;
      pathShape.set(elemId, 'array_element');
      tableKeys.set(elemId, new Set());
      currentTableId = elemId;
      return elem;
    }

    // Plain [table] header.
    if (node[last] === undefined) {
      node[last] = {};
      pathShape.set(fullPath, 'table');
      declaredHeaders.add(fullPath);
      tableKeys.set(fullPath, new Set());
    } else if (Array.isArray(node[last])) {
      throw new Error(
        `duplicate or shape-mismatched table header at ${fullPath}: ` +
          `previously declared as array of tables ([[${fullPath}]]), cannot redeclare as table ([${fullPath}])`
      );
    } else if (typeof node[last] !== 'object') {
      throw new Error(`cannot redefine ${fullPath} as table`);
    } else if (declaredHeaders.has(fullPath)) {
      throw new Error(
        `duplicate or shape-mismatched table header at ${fullPath}: ` +
          `[${fullPath}] declared more than once`
      );
    } else {
      // Implicitly created earlier (e.g., as a parent path); first explicit
      // declaration is allowed.
      pathShape.set(fullPath, 'table');
      declaredHeaders.add(fullPath);
      if (!tableKeys.has(fullPath)) tableKeys.set(fullPath, new Set());
    }
    currentTableId = fullPath;
    return node[last];
  }

  for (let idx = 0; idx < records.length; idx += 1) {
    const rec = records[idx];
    if (rec.startsInMultilineString) continue;
    if (rec.tableHeader) {
      const segs = rec.tableHeader.segments;
      currentTable = walkPath(segs, { creatingArrayElement: rec.tableHeader.array });
      continue;
    }

    const trimmed = rec.text.trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;

    const equalsIndex = findTomlAssignmentEquals(rec.text);
    if (equalsIndex === -1) continue;

    const keyText = rec.text.slice(0, equalsIndex).trim();
    const segments = parseTomlKeyPath(keyText);
    if (!segments) {
      throw new Error(`invalid TOML key on line ${idx + 1}: ${rec.text}`);
    }

    // Value RHS may span multiple lines (inline arrays, multi-line strings,
    // inline tables). Parse from the absolute content offset right after `=`.
    const valueStartAbs = rec.start + equalsIndex + 1;
    const parsed = parseTomlValue(content, valueStartAbs);

    // #2760 CR4 finding 3 — verify the full RHS was consumed. Anything other
    // than whitespace + optional # comment between parsed.end and the next
    // newline (or EOF) means the parser silently accepted a prefix and
    // dropped trailing bytes. Reject so malformed TOML cannot slip past
    // "parse before commit" guarantees.
    let scan = parsed.end;
    while (scan < content.length && (content[scan] === ' ' || content[scan] === '\t')) {
      scan += 1;
    }
    if (scan < content.length && content[scan] !== '\n' && content[scan] !== '\r' && content[scan] !== '#') {
      const lineEnd = content.indexOf('\n', scan);
      const trailing = content.slice(scan, lineEnd === -1 ? content.length : lineEnd);
      throw new Error(
        `trailing bytes after value on line ${idx + 1}: ${JSON.stringify(trailing)}`
      );
    }

    // Place value into currentTable under dotted key.
    // #2760 CR5 finding 2 — reject duplicate keys per real TOML 1.0. Track
    // the dotted key against the current table instance id; an exact repeat
    // throws.
    let target = currentTable;
    for (let s = 0; s < segments.length - 1; s += 1) {
      const seg = segments[s];
      if (target[seg] === undefined) target[seg] = {};
      else if (typeof target[seg] !== 'object' || Array.isArray(target[seg])) {
        throw new Error(`cannot descend into non-table key ${seg}`);
      }
      target = target[seg];
    }
    const finalKey = segments[segments.length - 1];
    const dottedKey = segments.join('.');
    const keySet = ensureKeySet(currentTableId);
    if (keySet.has(dottedKey) || Object.prototype.hasOwnProperty.call(target, finalKey)) {
      throw new Error(
        `duplicate key ${dottedKey} in ${currentTableId === '__root__' ? 'root table' : currentTableId}`
      );
    }
    keySet.add(dottedKey);
    target[finalKey] = parsed.value;
  }

  return root;
}

/**
 * Validate that the post-install config.toml matches Codex's expected schema
 * (#2760, fix 3). Returns { ok: true } on success, or { ok: false, reason }
 * with a human-readable explanation of the offending section.
 *
 * Strategy: parse the bytes into a structured object first — malformed TOML
 * fails validation immediately rather than slipping past a header-only scan.
 * Then enforce the schema-shape rules against the parsed structure.
 *
 * Schema rules enforced:
 *   - File MUST parse as TOML (no syntax errors).
 *   - `agents` MUST be a struct table (`[agents.<name>]`) — never a bare
 *     table value or an array of tables.
 *   - `hooks.<Event>` MUST be an array of tables when present (Codex ≥0.124
 *     rejects bare `[hooks.<Event>]` single-bracket maps).
 */
function validateCodexConfigSchema(content) {
  let parsed;
  try {
    parsed = parseTomlToObject(content);
  } catch (e) {
    return {
      ok: false,
      reason: `TOML parse failed: ${e.message}`,
    };
  }

  // Header-shape check: arrays-of-tables are visible in the parsed structure
  // (as Array values) but bare-vs-struct distinction for `[agents]` requires
  // looking at section headers too — `[agents]` with `default = "x"` parses
  // to `{ agents: { default: 'x' } }`, indistinguishable from
  // `[agents.foo]` writing into the same shape. Use header sections to
  // disambiguate.
  const sections = getTomlTableSections(content);

  for (const section of sections) {
    if (section.array && section.path === 'agents') {
      return {
        ok: false,
        reason: '[[agents]] sequence form is invalid in current Codex schema (expected [agents.<name>] struct form)',
      };
    }

    if (!section.array && section.path === 'agents') {
      return {
        ok: false,
        reason: 'bare [agents] table is invalid in current Codex schema (expected [agents.<name>] struct form)',
      };
    }

    if (!section.array && section.path.startsWith('hooks.')) {
      return {
        ok: false,
        reason: `bare [${section.path}] table is invalid in current Codex schema (expected [[${section.path}]] array-of-tables)`,
      };
    }
  }

  // Structural confirmation against parsed object: any present hooks.<Event>
  // must be an array, and flat top-level [[hooks]] (parsed as Array on root)
  // is rejected — Codex 0.124.0+ requires [[hooks.<Event>]] namespaced form.
  if (parsed.hooks !== undefined) {
    if (Array.isArray(parsed.hooks)) {
      return {
        ok: false,
        reason: 'flat [[hooks]] array-of-tables is invalid in Codex 0.124.0+ (expected [[hooks.<Event>]] namespaced form)',
      };
    }
    if (typeof parsed.hooks === 'object' && parsed.hooks !== null) {
      for (const [event, value] of Object.entries(parsed.hooks)) {
        // Skip the nested .hooks sub-array — it lives under hooks.<Event>[n].hooks
        // and is validated separately below.
        if (!Array.isArray(value)) {
          return {
            ok: false,
            reason: `hooks.${event} must be an array of tables, got ${typeof value}`,
          };
        }
        // Each entry in hooks.<Event> must either be a matcher-only filter (no
        // handler fields) or carry a .hooks sub-array of handler tables.
        // Entries with handler fields (command, type, timeout, statusMessage) at
        // event-entry level but without a .hooks sub-table are the pre-#2773
        // single-block shape that Codex 0.124.0+ rejects. migrateCodexHooksMapFormat
        // converts these before validation runs; their presence here means migration
        // failed to cover this entry — fail loudly rather than pass a broken config.
        const HANDLER_FIELD_NAMES = new Set(['command', 'type', 'timeout', 'statusMessage']);
        for (const entry of value) {
          if (!entry || typeof entry !== 'object') continue;
          if (entry.hooks === undefined) {
            const strayKey = Object.keys(entry).find((k) => HANDLER_FIELD_NAMES.has(k));
            if (strayKey) {
              return {
                ok: false,
                reason: `hooks.${event}[] entry has handler field "${strayKey}" at event-entry level; ` +
                  `Codex 0.124.0+ requires handler fields nested under [[hooks.${event}.hooks]]`,
              };
            }
            continue;
          }
          if (!Array.isArray(entry.hooks)) {
            return {
              ok: false,
              reason: `hooks.${event}[].hooks must be an array of handler tables, got ${typeof entry.hooks}`,
            };
          }
          for (const handler of entry.hooks) {
            if (handler && typeof handler === 'object' && handler.type !== undefined) {
              if (handler.type !== 'command') {
                return {
                  ok: false,
                  reason: `hooks.${event}[].hooks[].type must be "command", got "${handler.type}"`,
                };
              }
            }
          }
        }
      }
    }
  }

  return { ok: true };
}

function normalizeCodexHooksLine(line, key) {
  const leadingWhitespace = line.match(/^\s*/)[0];
  const commentStart = findTomlCommentStart(line);
  const comment = commentStart === -1 ? '' : line.slice(commentStart);
  return `${leadingWhitespace}${key} = true${comment ? ` ${comment}` : ''}`;
}

function findTomlAssignmentBlockEnd(content, record) {
  const equalsIndex = findTomlAssignmentEquals(record.text);
  if (equalsIndex === -1) {
    return record.end + record.eol.length;
  }

  let i = record.start + equalsIndex + 1;
  let arrayDepth = 0;
  let inlineTableDepth = 0;

  while (i < content.length) {
    if (content.startsWith('\'\'\'', i)) {
      const closeIndex = content.indexOf('\'\'\'', i + 3);
      if (closeIndex === -1) {
        return content.length;
      }
      i = closeIndex + 3;
      continue;
    }

    if (content.startsWith('"""', i)) {
      const closeIndex = findMultilineBasicStringClose(content, i + 3);
      if (closeIndex === -1) {
        return content.length;
      }
      i = closeIndex + 3;
      continue;
    }

    const ch = content[i];

    if (ch === '\'') {
      i += 1;
      while (i < content.length) {
        if (content[i] === '\'') {
          i += 1;
          break;
        }
        i += 1;
      }
      continue;
    }

    if (ch === '"') {
      i += 1;
      while (i < content.length) {
        if (content[i] === '\\') {
          i += 2;
          continue;
        }
        if (content[i] === '"') {
          i += 1;
          break;
        }
        i += 1;
      }
      continue;
    }

    if (ch === '[') {
      arrayDepth += 1;
      i += 1;
      continue;
    }

    if (ch === ']') {
      if (arrayDepth > 0) {
        arrayDepth -= 1;
      }
      i += 1;
      continue;
    }

    if (ch === '{') {
      inlineTableDepth += 1;
      i += 1;
      continue;
    }

    if (ch === '}') {
      if (inlineTableDepth > 0) {
        inlineTableDepth -= 1;
      }
      i += 1;
      continue;
    }

    if (ch === '#') {
      while (i < content.length && content[i] !== '\n') {
        i += 1;
      }
      continue;
    }

    if (ch === '\n' && arrayDepth === 0 && inlineTableDepth === 0) {
      return i + 1;
    }

    i += 1;
  }

  return content.length;
}

function rewriteTomlKeyLines(content, matches, key) {
  if (matches.length === 0) {
    return content;
  }

  let rewritten = '';
  let cursor = 0;

  matches.forEach((match, index) => {
    rewritten += content.slice(cursor, match.start);
    if (index === 0) {
      const blockEnd = findTomlAssignmentBlockEnd(content, match);
      const blockEol = blockEnd > 0 && content[blockEnd - 1] === '\n'
        ? (blockEnd > 1 && content[blockEnd - 2] === '\r' ? '\r\n' : '\n')
        : '';
      rewritten += normalizeCodexHooksLine(match.text, match.keyRaw || key) + blockEol;
      cursor = blockEnd;
      return;
    }
    cursor = findTomlAssignmentBlockEnd(content, match);
  });

  rewritten += content.slice(cursor);
  return rewritten;
}

/**
 * Atomic write — write to <target>.tmp-<pid>-<n> first, then renameSync over
 * the target. Eliminates the partial-write corruption window: an interrupted
 * write leaves the temp file (which we clean up) but never truncates the
 * original target. Used for any mutation of Codex config.toml so we cannot
 * leave the user with a half-written file (#2760 fix 4).
 */
let __atomicWriteCounter = 0;
function atomicWriteFileSync(target, data, options) {
  __atomicWriteCounter += 1;
  const tmp = `${target}.tmp-${process.pid}-${__atomicWriteCounter}`;
  try {
    fs.writeFileSync(tmp, data, options);
    fs.renameSync(tmp, target);
  } catch (e) {
    // Best-effort cleanup of the partial temp file; never mask the real error.
    try { fs.rmSync(tmp, { force: true }); } catch (_) { /* ignore */ }
    throw e;
  }
}

/**
 * Merge GSD config block into an existing or new config.toml.
 * Three cases: new file, existing with GSD marker, existing without marker.
 *
 * All writes go through atomicWriteFileSync so a mid-write failure leaves
 * the original config.toml untouched (#2760 fix 4).
 */
function mergeCodexConfig(configPath, gsdBlock) {
  // Case 1: No config.toml — create fresh
  if (!fs.existsSync(configPath)) {
    atomicWriteFileSync(configPath, gsdBlock + '\n');
    return;
  }

  const existing = fs.readFileSync(configPath, 'utf8');
  const eol = detectLineEnding(existing);
  const normalizedGsdBlock = gsdBlock.replace(/\r?\n/g, eol);
  const markerIndex = existing.indexOf(GSD_CODEX_MARKER);

  // Case 2: Has GSD marker — truncate and re-append
  if (markerIndex !== -1) {
    let before = existing.substring(0, markerIndex).trimEnd();
    if (before) {
      // Strip any GSD-managed sections that leaked above the marker from previous installs
      before = stripLeakedGsdCodexSections(before).trimEnd();

      atomicWriteFileSync(configPath, before + eol + eol + normalizedGsdBlock + eol);
    } else {
      atomicWriteFileSync(configPath, normalizedGsdBlock + eol);
    }
    return;
  }

  // Case 3: No marker — append GSD block
  let content = stripLeakedGsdCodexSections(existing).trimEnd();
  if (content) {
    content = content + eol + eol + normalizedGsdBlock + eol;
  } else {
    content = normalizedGsdBlock + eol;
  }

  atomicWriteFileSync(configPath, content);
}

/**
 * Repair config.toml files corrupted by pre-#1346 GSD installs.
 * Non-boolean keys (e.g. model = "gpt-5.3-codex") that ended up under [features]
 * are relocated before the [features] header so Codex can parse them correctly.
 * Returns the content unchanged if no trapped keys are found.
 */
function repairTrappedFeaturesKeys(content) {
  const eol = detectLineEnding(content);
  const lineRecords = getTomlLineRecords(content);
  const featuresSection = getTomlTableSections(content)
    .find((section) => !section.array && section.path === 'features');

  if (!featuresSection) {
    return content;
  }

  // Find non-boolean key-value lines inside [features] that don't belong there.
  // Boolean keys (codex_hooks, multi_agent, etc.) are legitimate feature flags.
  const trappedLines = lineRecords.filter((record) => {
    if (record.tableHeader || record.startsInMultilineString) return false;
    if (record.tablePath !== 'features') return false;
    if (record.start < featuresSection.headerEnd) return false;
    if (record.end + record.eol.length > featuresSection.end) return false;
    if (!record.keySegments || record.keySegments.length === 0) return false;

    // Check if the value is a boolean — if so, it belongs under [features]
    const equalsIndex = findTomlAssignmentEquals(record.text);
    if (equalsIndex === -1) return false;
    const commentStart = findTomlCommentStart(record.text);
    const valueText = record.text
      .slice(equalsIndex + 1, commentStart === -1 ? record.text.length : commentStart)
      .trim();
    if (valueText === 'true' || valueText === 'false') return false;

    // Skip values that start a multiline string — they may legitimately live
    // under [features] and spanning multiple lines makes relocation unsafe.
    if (valueText.startsWith("'''") || valueText.startsWith('"""')) return false;

    // Non-boolean value — this key is trapped
    return true;
  });

  if (trappedLines.length === 0) {
    return content;
  }

  // Build the relocated text block from trapped lines
  const relocatedText = trappedLines.map((r) => r.text).join(eol) + eol;

  // Remove trapped lines from their current positions (with their EOLs)
  const removalRanges = trappedLines.map((r) => ({
    start: r.start,
    end: r.end + r.eol.length,
  }));
  let cleaned = removeContentRanges(content, removalRanges);

  // Collapse any runs of 3+ blank lines left behind
  cleaned = collapseTomlBlankLines(cleaned);

  // Re-locate the [features] header in the cleaned content
  const cleanedRecords = getTomlLineRecords(cleaned);
  const cleanedFeaturesHeader = cleanedRecords.find(
    (r) => r.tableHeader && r.tableHeader.path === 'features' && !r.tableHeader.array
  );

  if (!cleanedFeaturesHeader) {
    return cleaned;
  }

  // Insert relocated keys before [features]
  const before = cleaned.slice(0, cleanedFeaturesHeader.start);
  const after = cleaned.slice(cleanedFeaturesHeader.start);
  const needsGap = before.length > 0 && !before.endsWith(eol + eol);
  const trailingGap = after.length > 0 && !relocatedText.endsWith(eol + eol) ? eol : '';

  return before + (needsGap ? eol : '') + relocatedText + trailingGap + after;
}

function ensureCodexHooksFeature(configContent) {
  const eol = detectLineEnding(configContent);
  const lineRecords = getTomlLineRecords(configContent);

  const featuresSection = getTomlTableSections(configContent)
    .find((section) => !section.array && section.path === 'features');

  if (featuresSection) {
    const sectionLines = lineRecords
      .filter((record) =>
        !record.tableHeader &&
        !record.startsInMultilineString &&
        record.tablePath === 'features' &&
        record.start >= featuresSection.headerEnd &&
        record.end + record.eol.length <= featuresSection.end &&
        record.keySegments &&
        record.keySegments.length === 1 &&
        record.keySegments[0] === 'codex_hooks'
      );

    if (sectionLines.length > 0) {
      const rewritten = rewriteTomlKeyLines(configContent, sectionLines, 'codex_hooks');
      return {
        content: repairTrappedFeaturesKeys(rewritten),
        ownership: null,
      };
    }

    const sectionBody = configContent.slice(featuresSection.headerEnd, featuresSection.end);
    const needsSeparator = sectionBody.length > 0 && !sectionBody.endsWith('\n') && !sectionBody.endsWith('\r\n');
    const insertPrefix = sectionBody.length === 0 && featuresSection.headerEnd === configContent.length ? eol : '';
    const insertText = `${insertPrefix}${needsSeparator ? eol : ''}codex_hooks = true${eol}`;
    const merged = configContent.slice(0, featuresSection.end) + insertText + configContent.slice(featuresSection.end);
    return {
      content: repairTrappedFeaturesKeys(merged),
      ownership: 'section',
    };
  }

  const rootFeatureLines = lineRecords
    .filter((record) =>
      !record.tableHeader &&
      !record.startsInMultilineString &&
      record.tablePath === null &&
      record.keySegments &&
      record.keySegments[0] === 'features'
    );

  const rootCodexHooksLines = rootFeatureLines
    .filter((record) => record.keySegments.length === 2 && record.keySegments[1] === 'codex_hooks');

  if (rootCodexHooksLines.length > 0) {
    return {
      content: rewriteTomlKeyLines(configContent, rootCodexHooksLines, 'features.codex_hooks'),
      ownership: null,
    };
  }

  const rootFeaturesValueLines = rootFeatureLines
    .filter((record) => record.keySegments.length === 1);

  if (rootFeaturesValueLines.length > 0) {
    return { content: configContent, ownership: null };
  }

  if (rootFeatureLines.length > 0) {
    const lastFeatureLine = rootFeatureLines[rootFeatureLines.length - 1];
    const insertAt = findTomlAssignmentBlockEnd(configContent, lastFeatureLine);
    const prefix = insertAt > 0 && configContent[insertAt - 1] === '\n' ? '' : eol;
    return {
      content: configContent.slice(0, insertAt) +
        `${prefix}features.codex_hooks = true${eol}` +
        configContent.slice(insertAt),
      ownership: 'root_dotted',
    };
  }

  const featuresBlock = `[features]${eol}codex_hooks = true${eol}`;
  if (!configContent) {
    return { content: featuresBlock, ownership: 'section' };
  }
  // Insert [features] before the first table header, preserving bare top-level keys.
  // Prepending would trap them under [features] where Codex expects only booleans (#1202).
  const firstTableHeader = lineRecords.find(r => r.tableHeader);
  if (firstTableHeader) {
    const before = configContent.slice(0, firstTableHeader.start);
    const after = configContent.slice(firstTableHeader.start);
    const needsGap = before.length > 0 && !before.endsWith(eol + eol);
    return {
      content: before + (needsGap ? eol : '') + featuresBlock + eol + after,
      ownership: 'section',
    };
  }
  // No table headers — append [features] after top-level keys
  const needsGap = configContent.length > 0 && !configContent.endsWith(eol + eol);
  return { content: configContent + (needsGap ? eol : '') + featuresBlock, ownership: 'section' };
}

function hasEnabledCodexHooksFeature(configContent) {
  const lineRecords = getTomlLineRecords(configContent);

  return lineRecords.some((record) => {
    if (record.tableHeader || record.startsInMultilineString || !record.keySegments) {
      return false;
    }

    const isSectionKey = record.tablePath === 'features' &&
      record.keySegments.length === 1 &&
      record.keySegments[0] === 'codex_hooks';
    const isRootDottedKey = record.tablePath === null &&
      record.keySegments.length === 2 &&
      record.keySegments[0] === 'features' &&
      record.keySegments[1] === 'codex_hooks';

    if (!isSectionKey && !isRootDottedKey) {
      return false;
    }

    const equalsIndex = findTomlAssignmentEquals(record.text);
    if (equalsIndex === -1) {
      return false;
    }

    const commentStart = findTomlCommentStart(record.text);
    const valueText = record.text.slice(equalsIndex + 1, commentStart === -1 ? record.text.length : commentStart).trim();
    return valueText === 'true';
  });
}

/**
 * Merge GSD instructions into copilot-instructions.md.
 * Three cases: new file, existing with markers, existing without markers.
 * @param {string} filePath - Full path to copilot-instructions.md
 * @param {string} gsdContent - Template content (without markers)
 */
function mergeCopilotInstructions(filePath, gsdContent) {
  const gsdBlock = GSD_COPILOT_INSTRUCTIONS_MARKER + '\n' +
    gsdContent.trim() + '\n' +
    GSD_COPILOT_INSTRUCTIONS_CLOSE_MARKER;

  // Case 1: No file — create fresh
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, gsdBlock + '\n');
    return;
  }

  const existing = fs.readFileSync(filePath, 'utf8');
  const openIndex = existing.indexOf(GSD_COPILOT_INSTRUCTIONS_MARKER);
  const closeIndex = existing.indexOf(GSD_COPILOT_INSTRUCTIONS_CLOSE_MARKER);

  // Case 2: Has GSD markers — replace between markers
  if (openIndex !== -1 && closeIndex !== -1) {
    const before = existing.substring(0, openIndex).trimEnd();
    const after = existing.substring(closeIndex + GSD_COPILOT_INSTRUCTIONS_CLOSE_MARKER.length).trimStart();
    let newContent = '';
    if (before) newContent += before + '\n\n';
    newContent += gsdBlock;
    if (after) newContent += '\n\n' + after;
    newContent += '\n';
    fs.writeFileSync(filePath, newContent);
    return;
  }

  // Case 3: No markers — append at end
  const content = existing.trimEnd() + '\n\n' + gsdBlock + '\n';
  fs.writeFileSync(filePath, content);
}

/**
 * Strip GSD section from copilot-instructions.md content.
 * Returns cleaned content, or null if file should be deleted (was GSD-only).
 * @param {string} content - File content
 * @returns {string|null} - Cleaned content or null if empty
 */
function stripGsdFromCopilotInstructions(content) {
  const openIndex = content.indexOf(GSD_COPILOT_INSTRUCTIONS_MARKER);
  const closeIndex = content.indexOf(GSD_COPILOT_INSTRUCTIONS_CLOSE_MARKER);

  if (openIndex !== -1 && closeIndex !== -1) {
    const before = content.substring(0, openIndex).trimEnd();
    const after = content.substring(closeIndex + GSD_COPILOT_INSTRUCTIONS_CLOSE_MARKER.length).trimStart();
    const cleaned = (before + (before && after ? '\n\n' : '') + after).trim();
    if (!cleaned) return null;
    return cleaned + '\n';
  }

  // No markers found — nothing to strip
  return content;
}

/**
 * Generate config.toml and per-agent .toml files for Codex.
 * Reads agent .md files from source, extracts metadata, writes .toml configs.
 */
function installCodexConfig(targetDir, agentsSrc) {
  const configPath = path.join(targetDir, 'config.toml');
  const agentsTomlDir = path.join(targetDir, 'agents');
  fs.mkdirSync(agentsTomlDir, { recursive: true });

  const agentEntries = fs.readdirSync(agentsSrc).filter(f => f.startsWith('gsd-') && f.endsWith('.md'));
  const agents = [];

  // Compute the Codex GSD install path (absolute, so subagents with empty $HOME work — #820)
  const codexGsdPath = `${path.resolve(targetDir, 'get-shit-done').replace(/\\/g, '/')}/`;

  for (const file of agentEntries) {
    let content = fs.readFileSync(path.join(agentsSrc, file), 'utf8');
    // Replace full .claude/get-shit-done prefix so path resolves to the Codex
    // GSD install before generic .claude → .codex conversion rewrites it.
    content = content.replace(/~\/\.claude\/get-shit-done\//g, codexGsdPath);
    content = content.replace(/\$HOME\/\.claude\/get-shit-done\//g, codexGsdPath);
    // Route TOML emit through the same full Claude→Codex conversion pipeline
    // used on the `.md` emit path (#2639). Covers: slash-command rewrites,
    // $ARGUMENTS → {{GSD_ARGS}}, /clear removal, anchored and bare .claude/
    // paths, .claudeignore → .codexignore, and standalone "Claude" /
    // CLAUDE.md neutralization via neutralizeAgentReferences(..., 'AGENTS.md').
    content = convertClaudeToCodexMarkdown(content);
    const { frontmatter } = extractFrontmatterAndBody(content);
    const name = extractFrontmatterField(frontmatter, 'name') || file.replace('.md', '');
    const description = extractFrontmatterField(frontmatter, 'description') || '';

    agents.push({ name, description: toSingleLine(description) });

    // Pass model overrides from both per-project `.planning/config.json` and
    // `~/.gsd/defaults.json` (project wins on conflict) so Codex TOML files
    // embed the configured model — Codex cannot receive model inline (#2256).
    // Previously only the global file was read, which silently dropped the
    // per-project override the reporter had set for gsd-codebase-mapper.
    // #2517 — also pass the runtime-aware tier resolver so profile tiers can
    // resolve to Codex-native model IDs + reasoning_effort when `runtime: "codex"`
    // is set in defaults.json.
    const modelOverrides = readGsdEffectiveModelOverrides(targetDir);
    // Pass `targetDir` so per-project .planning/config.json wins over global
    // ~/.gsd/defaults.json — without this, the PR's headline claim that
    // setting runtime in the project config reaches the Codex emit path is
    // false (review finding #1).
    const runtimeResolver = readGsdRuntimeProfileResolver(targetDir);
    const tomlContent = generateCodexAgentToml(name, content, modelOverrides, runtimeResolver);
    fs.writeFileSync(path.join(agentsTomlDir, `${name}.toml`), tomlContent);
  }

  const gsdBlock = generateCodexConfigBlock(agents, targetDir);
  mergeCodexConfig(configPath, gsdBlock);

  return agents.length;
}

/**
 * Strip HTML <sub> tags for Gemini CLI output
 * Terminals don't support subscript — Gemini renders these as raw HTML.
 * Converts <sub>text</sub> to italic *(text)* for readable terminal output.
 */
/**
 * Runtime-neutral agent name and instruction file replacement.
 * Used by ALL non-Claude runtime converters to avoid Claude-specific
 * references in workflow prompts, agent definitions, and documentation.
 *
 * Replaces:
 * - Standalone "Claude" (agent name) → "the agent"
 *   Preserves: "Claude Code" (product), "Claude Opus/Sonnet/Haiku" (models),
 *   "claude-" (prefixes), "CLAUDE.md" (handled separately)
 * - "CLAUDE.md" → runtime-appropriate instruction file
 * - "Do NOT load full AGENTS.md" → removed (harmful for AGENTS.md runtimes)
 *
 * @param {string} content - File content to neutralize
 * @param {string} instructionFile - Runtime's instruction file ('AGENTS.md', 'GEMINI.md', etc.)
 * @returns {string} Content with runtime-neutral references
 */
function neutralizeAgentReferences(content, instructionFile) {
  let c = content;
  // Replace standalone "Claude" (the agent) but preserve product/model names.
  // Negative lookahead avoids: Claude Code, Claude Opus/Sonnet/Haiku, Claude native, Claude-based
  c = c.replace(/\bClaude(?! Code| Opus| Sonnet| Haiku| native| based|-)\b(?!\.md)/g, 'the agent');
  // Replace CLAUDE.md with runtime-appropriate instruction file
  if (instructionFile) {
    c = c.replace(/CLAUDE\.md/g, instructionFile);
  }
  // Remove instructions that conflict with AGENTS.md-based runtimes
  c = c.replace(/Do NOT load full `AGENTS\.md` files[^\n]*/g, '');
  return c;
}

function stripSubTags(content) {
  return content.replace(/<sub>(.*?)<\/sub>/g, '*($1)*');
}

/**
 * Convert Claude Code agent frontmatter to Gemini CLI format
 * Gemini agents use .md files with YAML frontmatter, same as Claude,
 * but with different field names and formats:
 * - tools: must be a YAML array (not comma-separated string)
 * - tool names: must use Gemini built-in names (read_file, not Read)
 * - color: must be removed (causes validation error)
 * - skills: must be removed (causes validation error)
 * - mcp__* tools: must be excluded (auto-discovered at runtime)
 */
let _gsdCommandRoster = null;
let _gsdCommandRosterWarned = false;

/**
 * Get the list of known GSD commands from the source directory.
 * Caches the result after the first scan. Emits a one-shot warning if the
 * source directory cannot be located — an empty roster silently neutralises
 * every Gemini slash-command conversion, which is the bug this code exists
 * to prevent. The warning is gated on GSD_TEST_MODE to keep test output clean.
 * @returns {Set<string>} Set of command names (without .md extension)
 */
function getGsdCommandRoster() {
  if (_gsdCommandRoster) return _gsdCommandRoster;
  const baseDir = (typeof __dirname !== 'undefined') ? __dirname : process.cwd();
  const gsdSrc = path.join(baseDir, '..', 'commands', 'gsd');
  if (fs.existsSync(gsdSrc)) {
    _gsdCommandRoster = new Set(
      fs.readdirSync(gsdSrc)
        .filter(f => f.endsWith('.md'))
        .map(f => f.replace('.md', ''))
    );
  } else {
    _gsdCommandRoster = new Set();
    if (!_gsdCommandRosterWarned && !process.env.GSD_TEST_MODE) {
      _gsdCommandRosterWarned = true;
      console.warn(
        `WARNING: GSD command roster not found at ${gsdSrc}. ` +
        `Gemini /gsd- → /gsd: conversion will be a no-op. ` +
        `This usually means the package was installed without commands/gsd/.`
      );
    }
  }
  return _gsdCommandRoster;
}

// Test-only: reset the cached roster. Exported via GSD_TEST_MODE bundle below.
function _resetGsdCommandRoster() {
  _gsdCommandRoster = null;
  _gsdCommandRosterWarned = false;
}

function convertSlashCommandsToGeminiMentions(content) {
  const commands = getGsdCommandRoster();
  // Defense in depth: regex boundary AND roster lookup must both agree.
  //
  // - Lookbehind `(?<![A-Za-z0-9./])` rejects URLs (`example.com/gsd-…`),
  //   sub-paths (`bin/gsd-…`), and root-relative file paths preceded by a
  //   path char. Without it the roster alone is insufficient: a URL like
  //   `https://example.com/gsd-plan-phase` ends in a known command name and
  //   would convert incorrectly.
  // - `(?!\/)` rejects sub-path continuation (`/gsd-foo/bar`).
  // - `(?!\.[a-z])` rejects file extensions (`.cjs`, `.md`) but PERMITS
  //   sentence-ending punctuation like `/gsd-help.` because `.` at end of
  //   string or before whitespace is not followed by a lowercase letter.
  // - Roster lookup ensures only real commands convert — agent names like
  //   `gsd-planner` (no leading slash anyway) and unknown tokens pass through.
  //
  // GSD commands are always lowercase, so no case-insensitive flag.
  return content.replace(/(?<![A-Za-z0-9./])\/gsd-([a-z0-9-]+)(?!\/)(?!\.[a-z])/g, (match, commandName) => {
    return commands.has(commandName) ? `/gsd:${commandName}` : match;
  });
}

function convertClaudeToGeminiMarkdown(content, { isCommand = false } = {}) {
  // Apply Gemini-specific slash command namespacing
  let converted = convertSlashCommandsToGeminiMentions(content);
  // Strip HTML subscript tags — terminals can't render them. Done before
  // TOML conversion so the prompt body of a command file is also clean.
  converted = stripSubTags(converted);

  if (isCommand) {
    // Convert to Gemini TOML format
    converted = convertClaudeToGeminiToml(converted);
  }

  return converted;
}

function convertClaudeToGeminiAgent(content) {
  if (!content.startsWith('---')) return content;

  const endIndex = content.indexOf('---', 3);
  if (endIndex === -1) return content;

  const frontmatter = content.substring(3, endIndex).trim();
  const body = content.substring(endIndex + 3);

  const lines = frontmatter.split('\n');
  const newLines = [];
  let inAllowedTools = false;
  let inSkippedArrayField = false;
  const tools = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (inSkippedArrayField) {
      if (!trimmed || trimmed.startsWith('- ')) {
        continue;
      }
      inSkippedArrayField = false;
    }

    // Convert allowed-tools YAML array to tools list
    if (trimmed.startsWith('allowed-tools:')) {
      inAllowedTools = true;
      continue;
    }

    // Handle inline tools: field (comma-separated string)
    if (trimmed.startsWith('tools:')) {
      const toolsValue = trimmed.substring(6).trim();
      if (toolsValue) {
        const parsed = toolsValue.split(',').map(t => t.trim()).filter(t => t);
        for (const t of parsed) {
          const mapped = convertGeminiToolName(t);
          if (mapped) tools.push(mapped);
        }
      } else {
        // tools: with no value means YAML array follows
        inAllowedTools = true;
      }
      continue;
    }

    // Strip color field (not supported by Gemini CLI, causes validation error)
    if (trimmed.startsWith('color:')) continue;

    // Strip skills field (not supported by Gemini CLI, causes validation error)
    if (trimmed.startsWith('skills:')) {
      inSkippedArrayField = true;
      continue;
    }

    // Collect allowed-tools/tools array items
    if (inAllowedTools) {
      if (trimmed.startsWith('- ')) {
        const mapped = convertGeminiToolName(trimmed.substring(2).trim());
        if (mapped) tools.push(mapped);
        continue;
      } else if (trimmed && !trimmed.startsWith('-')) {
        inAllowedTools = false;
      }
    }

    if (!inAllowedTools) {
      newLines.push(line);
    }
  }

  // Add tools as YAML array (Gemini requires array format)
  if (tools.length > 0) {
    newLines.push('tools:');
    for (const tool of tools) {
      newLines.push(`  - ${tool}`);
    }
  }

  const newFrontmatter = newLines.join('\n').trim();

  // Escape ${VAR} patterns in agent body for Gemini CLI compatibility.
  // Gemini's templateString() treats all ${word} patterns as template variables
  // and throws "Template validation failed: Missing required input parameters"
  // when they can't be resolved. GSD agents use ${PHASE}, ${PLAN}, etc. as
  // shell variables in bash code blocks — convert to $VAR (no braces) which
  // is equivalent bash and invisible to Gemini's /\$\{(\w+)\}/g regex.
  const escapedBody = body.replace(/\$\{(\w+)\}/g, '$$$1');

  // Runtime-neutral agent name replacement (#766)
  const neutralBody = neutralizeAgentReferences(escapedBody, 'GEMINI.md');
  // Apply Gemini-specific transformations (slash commands + sub-tag stripping)
  const geminiBody = convertClaudeToGeminiMarkdown(neutralBody);
  return `---\n${newFrontmatter}\n---${geminiBody}`;
}

function convertClaudeToOpencodeFrontmatter(content, { isAgent = false, modelOverride = null } = {}) {
  // Replace tool name references in content (applies to all files)
  let convertedContent = content;
  convertedContent = convertedContent.replace(/\bAskUserQuestion\b/g, 'question');
  convertedContent = convertedContent.replace(/\bSlashCommand\b/g, 'skill');
  convertedContent = convertedContent.replace(/\bTodoWrite\b/g, 'todowrite');
  // Replace /gsd-command colon variant with /gsd-command for opencode (flat command structure)
  convertedContent = convertedContent.replace(/\/gsd:/g, '/gsd-');
  // Replace ~/.claude and $HOME/.claude with OpenCode's config location
  convertedContent = convertedContent.replace(/~\/\.claude\b/g, '~/.config/opencode');
  convertedContent = convertedContent.replace(/\$HOME\/\.claude\b/g, '$HOME/.config/opencode');
  // Replace general-purpose subagent type with OpenCode's equivalent "general"
  convertedContent = convertedContent.replace(/subagent_type="general-purpose"/g, 'subagent_type="general"');
  // Runtime-neutral agent name replacement (#766)
  convertedContent = neutralizeAgentReferences(convertedContent, 'AGENTS.md');

  // Check if content has frontmatter
  if (!convertedContent.startsWith('---')) {
    return convertedContent;
  }

  // Find the end of frontmatter
  const endIndex = convertedContent.indexOf('---', 3);
  if (endIndex === -1) {
    return convertedContent;
  }

  const frontmatter = convertedContent.substring(3, endIndex).trim();
  const body = convertedContent.substring(endIndex + 3);

  // Parse frontmatter line by line (simple YAML parsing)
  const lines = frontmatter.split('\n');
  const newLines = [];
  let inAllowedTools = false;
  let inSkippedArray = false;
  const allowedTools = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // For agents: skip commented-out lines (e.g. hooks blocks)
    if (isAgent && trimmed.startsWith('#')) {
      continue;
    }

    // Detect start of allowed-tools array
    if (trimmed.startsWith('allowed-tools:')) {
      inAllowedTools = true;
      continue;
    }

    // Detect inline tools: field (comma-separated string)
    if (trimmed.startsWith('tools:')) {
      if (isAgent) {
        // Agents: strip tools entirely (not supported in OpenCode agent frontmatter)
        inSkippedArray = true;
        continue;
      }
      const toolsValue = trimmed.substring(6).trim();
      if (toolsValue) {
        // Parse comma-separated tools
        const tools = toolsValue.split(',').map(t => t.trim()).filter(t => t);
        allowedTools.push(...tools);
      }
      continue;
    }

    // For agents: strip skills:, color:, memory:, maxTurns:, permissionMode:, disallowedTools:
    if (isAgent && /^(skills|color|memory|maxTurns|permissionMode|disallowedTools):/.test(trimmed)) {
      inSkippedArray = true;
      continue;
    }

    // Skip continuation lines of a stripped array/object field
    if (inSkippedArray) {
      if (trimmed.startsWith('- ') || trimmed.startsWith('#') || /^\s/.test(line)) {
        continue;
      }
      inSkippedArray = false;
    }

    // For commands: remove name: field (opencode uses filename for command name)
    // For agents: keep name: (required by OpenCode agents)
    if (!isAgent && trimmed.startsWith('name:')) {
      continue;
    }

    // Strip model: field — OpenCode doesn't support Claude Code model aliases
    // like 'haiku', 'sonnet', 'opus', or 'inherit'. Omitting lets OpenCode use
    // its configured default model. See #1156.
    if (trimmed.startsWith('model:')) {
      continue;
    }

    // Convert color names to hex for opencode (commands only; agents strip color above)
    if (trimmed.startsWith('color:')) {
      const colorValue = trimmed.substring(6).trim().toLowerCase();
      const hexColor = colorNameToHex[colorValue];
      if (hexColor) {
        newLines.push(`color: "${hexColor}"`);
      } else if (colorValue.startsWith('#')) {
        // Validate hex color format (#RGB or #RRGGBB)
        if (/^#[0-9a-f]{3}$|^#[0-9a-f]{6}$/i.test(colorValue)) {
          // Already hex and valid, keep as is
          newLines.push(line);
        }
        // Skip invalid hex colors
      }
      // Skip unknown color names
      continue;
    }

    // Collect allowed-tools items
    if (inAllowedTools) {
      if (trimmed.startsWith('- ')) {
        allowedTools.push(trimmed.substring(2).trim());
        continue;
      } else if (trimmed && !trimmed.startsWith('-')) {
        // End of array, new field started
        inAllowedTools = false;
      }
    }

    // Keep other fields
    if (!inAllowedTools) {
      newLines.push(line);
    }
  }

  // For agents: add required OpenCode agent fields
  // Note: Do NOT add 'model: inherit' — OpenCode does not recognize the 'inherit'
  // keyword and throws ProviderModelNotFoundError. Omitting model: lets OpenCode
  // use its default model for subagents. See #1156.
  if (isAgent) {
    newLines.push('mode: subagent');
    // Embed model override from ~/.gsd/defaults.json so model_overrides is
    // respected on OpenCode (which uses static agent frontmatter, not inline
    // Task() model parameters). See #2256.
    if (modelOverride) {
      newLines.push(`model: ${modelOverride}`);
    }
  }

  // For commands: add tools object if we had allowed-tools or tools
  if (!isAgent && allowedTools.length > 0) {
    newLines.push('tools:');
    for (const tool of allowedTools) {
      newLines.push(`  ${convertToolName(tool)}: true`);
    }
  }

  // Rebuild frontmatter (body already has tool names converted)
  const newFrontmatter = newLines.join('\n').trim();
  return `---\n${newFrontmatter}\n---${body}`;
}

// Kilo CLI — same conversion logic as OpenCode, different config paths.
function convertClaudeToKiloFrontmatter(content, { isAgent = false } = {}) {
  // Replace tool name references in content (applies to all files)
  let convertedContent = content;
  convertedContent = convertedContent.replace(/\bAskUserQuestion\b/g, 'question');
  convertedContent = convertedContent.replace(/\bSlashCommand\b/g, 'skill');
  convertedContent = convertedContent.replace(/\bTodoWrite\b/g, 'todowrite');
  // Replace /gsd-command colon variant with /gsd-command for Kilo (flat command structure)
  convertedContent = convertedContent.replace(/\/gsd:/g, '/gsd-');
  // Replace ~/.claude and $HOME/.claude with Kilo's config location
  convertedContent = convertedContent.replace(/~\/\.claude\b/g, '~/.config/kilo');
  convertedContent = convertedContent.replace(/\$HOME\/\.claude\b/g, '$HOME/.config/kilo');
  convertedContent = convertedContent.replace(/\.\/\.claude\//g, './.kilo/');
  // Normalize both Claude skill directory variants to Kilo's canonical skills dir.
  convertedContent = replaceRelativePathReference(convertedContent, '.claude/skills/', '.kilo/skills/');
  convertedContent = replaceRelativePathReference(convertedContent, '.agents/skills/', '.kilo/skills/');
  convertedContent = replaceRelativePathReference(convertedContent, '.claude/agents/', '.kilo/agents/');
  // Replace general-purpose subagent type with Kilo's equivalent "general"
  convertedContent = convertedContent.replace(/subagent_type="general-purpose"/g, 'subagent_type="general"');
  // Runtime-neutral agent name replacement (#766)
  convertedContent = neutralizeAgentReferences(convertedContent, 'AGENTS.md');

  // Check if content has frontmatter
  if (!convertedContent.startsWith('---')) {
    return convertedContent;
  }

  // Find the end of frontmatter
  const endIndex = convertedContent.indexOf('---', 3);
  if (endIndex === -1) {
    return convertedContent;
  }

  const frontmatter = convertedContent.substring(3, endIndex).trim();
  const body = convertedContent.substring(endIndex + 3);

  // Parse frontmatter line by line (simple YAML parsing)
  const lines = frontmatter.split('\n');
  const newLines = [];
  let inAllowedTools = false;
  let inAgentTools = false;
  let inSkippedArray = false;
  const allowedTools = [];
  const agentTools = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // For agents: skip commented-out lines (e.g. hooks blocks)
    if (isAgent && trimmed.startsWith('#')) {
      continue;
    }

    // Detect start of allowed-tools array
    if (trimmed.startsWith('allowed-tools:')) {
      inAllowedTools = true;
      continue;
    }

    if (isAgent && inAgentTools) {
      if (trimmed.startsWith('- ')) {
        agentTools.push(trimmed.substring(2).trim());
        continue;
      }
      if (trimmed && !trimmed.startsWith('-')) {
        inAgentTools = false;
      }
    }

    // Detect inline tools: field (comma-separated string)
    if (trimmed.startsWith('tools:')) {
      if (isAgent) {
        const toolsValue = trimmed.substring(6).trim();
        if (toolsValue) {
          const tools = toolsValue.split(',').map(t => t.trim()).filter(t => t);
          agentTools.push(...tools);
        } else {
          inAgentTools = true;
        }
        continue;
      }
      const toolsValue = trimmed.substring(6).trim();
      if (toolsValue) {
        // Parse comma-separated tools
        const tools = toolsValue.split(',').map(t => t.trim()).filter(t => t);
        allowedTools.push(...tools);
      }
      continue;
    }

    // For agents: strip skills:, color:, memory:, maxTurns:, permissionMode:, disallowedTools:
    if (isAgent && /^(skills|color|memory|maxTurns|permissionMode|disallowedTools):/.test(trimmed)) {
      inSkippedArray = true;
      continue;
    }

    // Skip continuation lines of a stripped array/object field
    if (inSkippedArray) {
      if (trimmed.startsWith('- ') || trimmed.startsWith('#') || /^\s/.test(line)) {
        continue;
      }
      inSkippedArray = false;
    }

    // For commands: remove name: field (Kilo uses filename for command name)
    // For agents: keep name: (required by Kilo agents)
    if (!isAgent && trimmed.startsWith('name:')) {
      continue;
    }

    // Strip model: field — Kilo doesn't support Claude Code model aliases
    // like 'haiku', 'sonnet', 'opus', or 'inherit'. Omitting lets Kilo use
    // its configured default model.
    if (trimmed.startsWith('model:')) {
      continue;
    }

    // Convert color names to hex for Kilo (commands only; agents strip color above)
    if (trimmed.startsWith('color:')) {
      const colorValue = trimmed.substring(6).trim().toLowerCase();
      const hexColor = colorNameToHex[colorValue];
      if (hexColor) {
        newLines.push(`color: "${hexColor}"`);
      } else if (colorValue.startsWith('#')) {
        // Validate hex color format (#RGB or #RRGGBB)
        if (/^#[0-9a-f]{3}$|^#[0-9a-f]{6}$/i.test(colorValue)) {
          // Already hex and valid, keep as is
          newLines.push(line);
        }
        // Skip invalid hex colors
      }
      // Skip unknown color names
      continue;
    }

    // Collect allowed-tools items
    if (inAllowedTools) {
      if (trimmed.startsWith('- ')) {
        const tool = trimmed.substring(2).trim();
        if (isAgent) {
          agentTools.push(tool);
        } else {
          allowedTools.push(tool);
        }
        continue;
      } else if (trimmed && !trimmed.startsWith('-')) {
        // End of array, new field started
        inAllowedTools = false;
      }
    }

    // Keep other fields
    if (!inAllowedTools) {
      newLines.push(line);
    }
  }

  // For agents: add required Kilo agent fields
  if (isAgent) {
    newLines.push('mode: subagent');
    newLines.push(...buildKiloAgentPermissionBlock(agentTools));
  }

  // For commands: add tools object if we had allowed-tools or tools
  if (!isAgent && allowedTools.length > 0) {
    newLines.push('tools:');
    for (const tool of allowedTools) {
      newLines.push(`  ${convertToolName(tool)}: true`);
    }
  }

  // Rebuild frontmatter (body already has tool names converted)
  const newFrontmatter = newLines.join('\n').trim();
  return `---\n${newFrontmatter}\n---${body}`;
}

/**
 * Convert Claude Code markdown command to Gemini TOML format
 * @param {string} content - Markdown file content with YAML frontmatter
 * @returns {string} - TOML content
 */
function convertClaudeToGeminiToml(content) {
  // Check if content has frontmatter
  if (!content.startsWith('---')) {
    return `prompt = ${JSON.stringify(content)}\n`;
  }

  const endIndex = content.indexOf('---', 3);
  if (endIndex === -1) {
    return `prompt = ${JSON.stringify(content)}\n`;
  }

  const frontmatter = content.substring(3, endIndex).trim();
  const body = content.substring(endIndex + 3).trim();

  // Extract description from frontmatter
  let description = '';
  const lines = frontmatter.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('description:')) {
      description = trimmed.substring(12).trim();
      break;
    }
  }

  // Construct TOML
  let toml = '';
  if (description) {
    toml += `description = ${JSON.stringify(description)}\n`;
  }

  toml += `prompt = ${JSON.stringify(body)}\n`;

  return toml;
}

/**
 * Copy commands to a flat structure for OpenCode
 * OpenCode expects: command/gsd-help.md (invoked as /gsd-help)
 * Source structure: commands/gsd/help.md
 * 
 * @param {string} srcDir - Source directory (e.g., commands/gsd/)
 * @param {string} destDir - Destination directory (e.g., command/)
 * @param {string} prefix - Prefix for filenames (e.g., 'gsd')
 * @param {string} pathPrefix - Path prefix for file references
 * @param {string} runtime - Target runtime ('claude', 'opencode', or 'kilo')
 */
function copyFlattenedCommands(srcDir, destDir, prefix, pathPrefix, runtime) {
  if (!fs.existsSync(srcDir)) {
    return;
  }

  // Remove old gsd-*.md files before copying new ones
  if (fs.existsSync(destDir)) {
    for (const file of fs.readdirSync(destDir)) {
      if (file.startsWith(`${prefix}-`) && file.endsWith('.md')) {
        fs.unlinkSync(path.join(destDir, file));
      }
    }
  } else {
    fs.mkdirSync(destDir, { recursive: true });
  }

  const entries = fs.readdirSync(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);

    if (entry.isDirectory()) {
      // Recurse into subdirectories, adding to prefix
      // e.g., commands/gsd/debug/start.md -> command/gsd-debug-start.md
      copyFlattenedCommands(srcPath, destDir, `${prefix}-${entry.name}`, pathPrefix, runtime);
    } else if (entry.name.endsWith('.md')) {
      // Flatten: help.md -> gsd-help.md
      const baseName = entry.name.replace('.md', '');
      const destName = `${prefix}-${baseName}.md`;
      const destPath = path.join(destDir, destName);

      let content = fs.readFileSync(srcPath, 'utf8');
      const globalClaudeRegex = /~\/\.claude\//g;
      const globalClaudeHomeRegex = /\$HOME\/\.claude\//g;
      const localClaudeRegex = /\.\/\.claude\//g;
      const opencodeDirRegex = /~\/\.opencode\//g;
      const kiloDirRegex = /~\/\.kilo\//g;
      content = content.replace(globalClaudeRegex, pathPrefix);
      content = content.replace(globalClaudeHomeRegex, pathPrefix);
      content = content.replace(localClaudeRegex, `./${getDirName(runtime)}/`);
      content = content.replace(opencodeDirRegex, pathPrefix);
      content = content.replace(kiloDirRegex, pathPrefix);
      content = processAttribution(content, getCommitAttribution(runtime));
      content = runtime === 'kilo'
        ? convertClaudeToKiloFrontmatter(content)
        : convertClaudeToOpencodeFrontmatter(content);

      fs.writeFileSync(destPath, content);
    }
  }
}

function listCodexSkillNames(skillsDir, prefix = 'gsd-') {
  if (!fs.existsSync(skillsDir)) return [];
  const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
  return entries
    .filter(entry => entry.isDirectory() && entry.name.startsWith(prefix))
    .filter(entry => fs.existsSync(path.join(skillsDir, entry.name, 'SKILL.md')))
    .map(entry => entry.name)
    .sort();
}

function copyCommandsAsCodexSkills(srcDir, skillsDir, prefix, pathPrefix, runtime) {
  if (!fs.existsSync(srcDir)) {
    return;
  }

  fs.mkdirSync(skillsDir, { recursive: true });

  // Remove previous GSD Codex skills to avoid stale command skills.
  const existing = fs.readdirSync(skillsDir, { withFileTypes: true });
  for (const entry of existing) {
    if (entry.isDirectory() && entry.name.startsWith(`${prefix}-`)) {
      fs.rmSync(path.join(skillsDir, entry.name), { recursive: true });
    }
  }

  function recurse(currentSrcDir, currentPrefix) {
    const entries = fs.readdirSync(currentSrcDir, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(currentSrcDir, entry.name);
      if (entry.isDirectory()) {
        recurse(srcPath, `${currentPrefix}-${entry.name}`);
        continue;
      }

      if (!entry.name.endsWith('.md')) {
        continue;
      }

      const baseName = entry.name.replace('.md', '');
      const skillName = `${currentPrefix}-${baseName}`;
      const skillDir = path.join(skillsDir, skillName);
      fs.mkdirSync(skillDir, { recursive: true });

      let content = fs.readFileSync(srcPath, 'utf8');
      const globalClaudeRegex = /~\/\.claude\//g;
      const globalClaudeHomeRegex = /\$HOME\/\.claude\//g;
      const localClaudeRegex = /\.\/\.claude\//g;
      const codexDirRegex = /~\/\.codex\//g;
      content = content.replace(globalClaudeRegex, pathPrefix);
      content = content.replace(globalClaudeHomeRegex, pathPrefix);
      content = content.replace(localClaudeRegex, `./${getDirName(runtime)}/`);
      content = content.replace(codexDirRegex, pathPrefix);
      content = processAttribution(content, getCommitAttribution(runtime));
      content = convertClaudeCommandToCodexSkill(content, skillName);

      fs.writeFileSync(path.join(skillDir, 'SKILL.md'), content);
    }
  }

  recurse(srcDir, prefix);
}

function copyCommandsAsCursorSkills(srcDir, skillsDir, prefix, pathPrefix, runtime) {
  if (!fs.existsSync(srcDir)) {
    return;
  }

  fs.mkdirSync(skillsDir, { recursive: true });

  // Remove previous GSD Cursor skills to avoid stale command skills
  const existing = fs.readdirSync(skillsDir, { withFileTypes: true });
  for (const entry of existing) {
    if (entry.isDirectory() && entry.name.startsWith(`${prefix}-`)) {
      fs.rmSync(path.join(skillsDir, entry.name), { recursive: true });
    }
  }

  function recurse(currentSrcDir, currentPrefix) {
    const entries = fs.readdirSync(currentSrcDir, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(currentSrcDir, entry.name);
      if (entry.isDirectory()) {
        recurse(srcPath, `${currentPrefix}-${entry.name}`);
        continue;
      }

      if (!entry.name.endsWith('.md')) {
        continue;
      }

      const baseName = entry.name.replace('.md', '');
      const skillName = `${currentPrefix}-${baseName}`;
      const skillDir = path.join(skillsDir, skillName);
      fs.mkdirSync(skillDir, { recursive: true });

      let content = fs.readFileSync(srcPath, 'utf8');
      const globalClaudeRegex = /~\/\.claude\//g;
      const globalClaudeHomeRegex = /\$HOME\/\.claude\//g;
      const localClaudeRegex = /\.\/\.claude\//g;
      const cursorDirRegex = /~\/\.cursor\//g;
      content = content.replace(globalClaudeRegex, pathPrefix);
      content = content.replace(globalClaudeHomeRegex, pathPrefix);
      content = content.replace(localClaudeRegex, `./${getDirName(runtime)}/`);
      content = content.replace(cursorDirRegex, pathPrefix);
      content = processAttribution(content, getCommitAttribution(runtime));
      content = convertClaudeCommandToCursorSkill(content, skillName);

      fs.writeFileSync(path.join(skillDir, 'SKILL.md'), content);
    }
  }

  recurse(srcDir, prefix);
}

/**
 * Copy Claude commands as Windsurf skills — one folder per skill with SKILL.md.
 * Mirrors copyCommandsAsCursorSkills but uses Windsurf converters.
 */
function copyCommandsAsWindsurfSkills(srcDir, skillsDir, prefix, pathPrefix, runtime) {
  if (!fs.existsSync(srcDir)) {
    return;
  }

  fs.mkdirSync(skillsDir, { recursive: true });

  // Remove previous GSD Windsurf skills to avoid stale command skills
  const existing = fs.readdirSync(skillsDir, { withFileTypes: true });
  for (const entry of existing) {
    if (entry.isDirectory() && entry.name.startsWith(`${prefix}-`)) {
      fs.rmSync(path.join(skillsDir, entry.name), { recursive: true });
    }
  }

  function recurse(currentSrcDir, currentPrefix) {
    const entries = fs.readdirSync(currentSrcDir, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(currentSrcDir, entry.name);
      if (entry.isDirectory()) {
        recurse(srcPath, `${currentPrefix}-${entry.name}`);
        continue;
      }

      if (!entry.name.endsWith('.md')) {
        continue;
      }

      const baseName = entry.name.replace('.md', '');
      const skillName = `${currentPrefix}-${baseName}`;
      const skillDir = path.join(skillsDir, skillName);
      fs.mkdirSync(skillDir, { recursive: true });

      let content = fs.readFileSync(srcPath, 'utf8');
      const globalClaudeRegex = /~\/\.claude\//g;
      const globalClaudeHomeRegex = /\$HOME\/\.claude\//g;
      const localClaudeRegex = /\.\/\.claude\//g;
      const windsurfDirRegex = /~\/\.codeium\/windsurf\//g;
      content = content.replace(globalClaudeRegex, pathPrefix);
      content = content.replace(globalClaudeHomeRegex, pathPrefix);
      content = content.replace(localClaudeRegex, `./${getDirName(runtime)}/`);
      content = content.replace(windsurfDirRegex, pathPrefix);
      content = processAttribution(content, getCommitAttribution(runtime));
      content = convertClaudeCommandToWindsurfSkill(content, skillName);

      fs.writeFileSync(path.join(skillDir, 'SKILL.md'), content);
    }
  }

  recurse(srcDir, prefix);
}

function copyCommandsAsTraeSkills(srcDir, skillsDir, prefix, pathPrefix, runtime) {
  if (!fs.existsSync(srcDir)) {
    return;
  }

  fs.mkdirSync(skillsDir, { recursive: true });

  const existing = fs.readdirSync(skillsDir, { withFileTypes: true });
  for (const entry of existing) {
    if (entry.isDirectory() && entry.name.startsWith(`${prefix}-`)) {
      fs.rmSync(path.join(skillsDir, entry.name), { recursive: true });
    }
  }

  function recurse(currentSrcDir, currentPrefix) {
    const entries = fs.readdirSync(currentSrcDir, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(currentSrcDir, entry.name);
      if (entry.isDirectory()) {
        recurse(srcPath, `${currentPrefix}-${entry.name}`);
        continue;
      }

      if (!entry.name.endsWith('.md')) {
        continue;
      }

      const baseName = entry.name.replace('.md', '');
      const skillName = `${currentPrefix}-${baseName}`;
      const skillDir = path.join(skillsDir, skillName);
      fs.mkdirSync(skillDir, { recursive: true });

      let content = fs.readFileSync(srcPath, 'utf8');
      const globalClaudeRegex = /~\/\.claude\//g;
      const globalClaudeHomeRegex = /\$HOME\/\.claude\//g;
      const localClaudeRegex = /\.\/\.claude\//g;
      const bareGlobalClaudeRegex = /~\/\.claude\b/g;
      const bareGlobalClaudeHomeRegex = /\$HOME\/\.claude\b/g;
      const bareLocalClaudeRegex = /\.\/\.claude\b/g;
      const traeDirRegex = /~\/\.trae\//g;
      const normalizedPathPrefix = pathPrefix.replace(/\/$/, '');
      content = content.replace(globalClaudeRegex, pathPrefix);
      content = content.replace(globalClaudeHomeRegex, pathPrefix);
      content = content.replace(localClaudeRegex, `./${getDirName(runtime)}/`);
      content = content.replace(bareGlobalClaudeRegex, normalizedPathPrefix);
      content = content.replace(bareGlobalClaudeHomeRegex, normalizedPathPrefix);
      content = content.replace(bareLocalClaudeRegex, `./${getDirName(runtime)}`);
      content = content.replace(traeDirRegex, pathPrefix);
      content = processAttribution(content, getCommitAttribution(runtime));
      content = convertClaudeCommandToTraeSkill(content, skillName);

      fs.writeFileSync(path.join(skillDir, 'SKILL.md'), content);
    }
  }

  recurse(srcDir, prefix);
}

/**
 * Copy Claude commands as CodeBuddy skills — one folder per skill with SKILL.md.
 * CodeBuddy uses the same tool names as Claude Code, but has its own config directory structure.
 */
function copyCommandsAsCodebuddySkills(srcDir, skillsDir, prefix, pathPrefix, runtime) {
  if (!fs.existsSync(srcDir)) {
    return;
  }

  fs.mkdirSync(skillsDir, { recursive: true });

  const existing = fs.readdirSync(skillsDir, { withFileTypes: true });
  for (const entry of existing) {
    if (entry.isDirectory() && entry.name.startsWith(`${prefix}-`)) {
      fs.rmSync(path.join(skillsDir, entry.name), { recursive: true });
    }
  }

  function recurse(currentSrcDir, currentPrefix) {
    const entries = fs.readdirSync(currentSrcDir, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(currentSrcDir, entry.name);
      if (entry.isDirectory()) {
        recurse(srcPath, `${currentPrefix}-${entry.name}`);
        continue;
      }

      if (!entry.name.endsWith('.md')) {
        continue;
      }

      const baseName = entry.name.replace('.md', '');
      const skillName = `${currentPrefix}-${baseName}`;
      const skillDir = path.join(skillsDir, skillName);
      fs.mkdirSync(skillDir, { recursive: true });

      let content = fs.readFileSync(srcPath, 'utf8');
      const globalClaudeRegex = /~\/\.claude\//g;
      const globalClaudeHomeRegex = /\$HOME\/\.claude\//g;
      const localClaudeRegex = /\.\/\.claude\//g;
      const bareGlobalClaudeRegex = /~\/\.claude\b/g;
      const bareGlobalClaudeHomeRegex = /\$HOME\/\.claude\b/g;
      const bareLocalClaudeRegex = /\.\/\.claude\b/g;
      const codebuddyDirRegex = /~\/\.codebuddy\//g;
      const normalizedPathPrefix = pathPrefix.replace(/\/$/, '');
      content = content.replace(globalClaudeRegex, pathPrefix);
      content = content.replace(globalClaudeHomeRegex, pathPrefix);
      content = content.replace(localClaudeRegex, `./${getDirName(runtime)}/`);
      content = content.replace(bareGlobalClaudeRegex, normalizedPathPrefix);
      content = content.replace(bareGlobalClaudeHomeRegex, normalizedPathPrefix);
      content = content.replace(bareLocalClaudeRegex, `./${getDirName(runtime)}`);
      content = content.replace(codebuddyDirRegex, pathPrefix);
      content = processAttribution(content, getCommitAttribution(runtime));
      content = convertClaudeCommandToCodebuddySkill(content, skillName);

      fs.writeFileSync(path.join(skillDir, 'SKILL.md'), content);
    }
  }

  recurse(srcDir, prefix);
}

/**
 * Copy Claude commands as Copilot skills — one folder per skill with SKILL.md.
 * Applies CONV-01 (structure), CONV-02 (allowed-tools), CONV-06 (paths), CONV-07 (command names).
 */
function copyCommandsAsCopilotSkills(srcDir, skillsDir, prefix, isGlobal = false) {
  if (!fs.existsSync(srcDir)) {
    return;
  }

  fs.mkdirSync(skillsDir, { recursive: true });

  // Remove previous GSD Copilot skills
  const existing = fs.readdirSync(skillsDir, { withFileTypes: true });
  for (const entry of existing) {
    if (entry.isDirectory() && entry.name.startsWith(`${prefix}-`)) {
      fs.rmSync(path.join(skillsDir, entry.name), { recursive: true });
    }
  }

  function recurse(currentSrcDir, currentPrefix) {
    const entries = fs.readdirSync(currentSrcDir, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(currentSrcDir, entry.name);
      if (entry.isDirectory()) {
        recurse(srcPath, `${currentPrefix}-${entry.name}`);
        continue;
      }

      if (!entry.name.endsWith('.md')) {
        continue;
      }

      const baseName = entry.name.replace('.md', '');
      const skillName = `${currentPrefix}-${baseName}`;
      const skillDir = path.join(skillsDir, skillName);
      fs.mkdirSync(skillDir, { recursive: true });

      let content = fs.readFileSync(srcPath, 'utf8');
      content = convertClaudeCommandToCopilotSkill(content, skillName, isGlobal);
      content = processAttribution(content, getCommitAttribution('copilot'));

      fs.writeFileSync(path.join(skillDir, 'SKILL.md'), content);
    }
  }

  recurse(srcDir, prefix);
}

/**
 * Copy Claude commands as Claude skills — one folder per skill with SKILL.md.
 * Claude Code 2.1.88+ uses skills/xxx/SKILL.md instead of commands/gsd/xxx.md.
 * Claude is the native format so no path replacement is needed — only
 * frontmatter restructuring via convertClaudeCommandToClaudeSkill.
 * @param {string} srcDir - Source commands directory
 * @param {string} skillsDir - Target skills directory
 * @param {string} prefix - Skill name prefix (e.g. 'gsd')
 * @param {string} pathPrefix - Path prefix for file references
 * @param {string} runtime - Target runtime
 * @param {boolean} isGlobal - Whether this is a global install
 */
function copyCommandsAsClaudeSkills(srcDir, skillsDir, prefix, pathPrefix, runtime, isGlobal = false) {
  if (!fs.existsSync(srcDir)) {
    return;
  }

  fs.mkdirSync(skillsDir, { recursive: true });

  // #2973 (CR follow-up on #3003): preserve user-generated skills across the
  // wipe-and-replace. `gsd-dev-preferences/SKILL.md` is written by the user
  // via `/gsd-profile-user --refresh`; it is NOT shipped by the npm package,
  // so a wipe without snapshot deletes the user's content with nothing to
  // restore from. Snapshot the SKILL.md (and any sibling files in that
  // directory) before the wipe and restore them after.
  const USER_OWNED_SKILLS = new Set(['gsd-dev-preferences']);
  const preservedUserSkills = new Map(); // skillName -> Map(relPath -> Buffer)
  for (const skillName of USER_OWNED_SKILLS) {
    const skillDir = path.join(skillsDir, skillName);
    if (!fs.existsSync(skillDir)) continue;
    const files = new Map();
    const walkSnap = (curRel, curAbs) => {
      for (const e of fs.readdirSync(curAbs, { withFileTypes: true })) {
        const childRel = curRel ? path.join(curRel, e.name) : e.name;
        const childAbs = path.join(curAbs, e.name);
        if (e.isDirectory()) walkSnap(childRel, childAbs);
        else if (e.isFile()) files.set(childRel, fs.readFileSync(childAbs));
      }
    };
    walkSnap('', skillDir);
    if (files.size > 0) preservedUserSkills.set(skillName, files);
  }

  // Remove previous GSD Claude skills to avoid stale command skills
  const existing = fs.readdirSync(skillsDir, { withFileTypes: true });
  for (const entry of existing) {
    if (entry.isDirectory() && entry.name.startsWith(`${prefix}-`)) {
      fs.rmSync(path.join(skillsDir, entry.name), { recursive: true });
    }
  }

  // Restore user-owned skills after the wipe but before recursive copy populates
  // shipped skills. If the npm package later happens to ship a same-named skill
  // (currently it does not for gsd-dev-preferences), the restored user content
  // is the source of truth: the recurse() loop below would overwrite it on
  // collision, but the USER_OWNED_SKILLS set is by definition disjoint from
  // shipped-skill names.
  for (const [skillName, files] of preservedUserSkills) {
    const skillDir = path.join(skillsDir, skillName);
    fs.mkdirSync(skillDir, { recursive: true });
    for (const [relPath, buf] of files) {
      const absPath = path.join(skillDir, relPath);
      fs.mkdirSync(path.dirname(absPath), { recursive: true });
      fs.writeFileSync(absPath, buf);
    }
  }

  function recurse(currentSrcDir, currentPrefix) {
    const entries = fs.readdirSync(currentSrcDir, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(currentSrcDir, entry.name);
      if (entry.isDirectory()) {
        recurse(srcPath, `${currentPrefix}-${entry.name}`);
        continue;
      }

      if (!entry.name.endsWith('.md')) {
        continue;
      }

      const baseName = entry.name.replace('.md', '');
      const skillName = `${currentPrefix}-${baseName}`;
      const skillDir = path.join(skillsDir, skillName);
      fs.mkdirSync(skillDir, { recursive: true });

      let content = fs.readFileSync(srcPath, 'utf8');
      content = content.replace(/~\/\.claude\//g, pathPrefix);
      content = content.replace(/\$HOME\/\.claude\//g, pathPrefix);
      content = content.replace(/\.\/\.claude\//g, `./${getDirName(runtime)}/`);
      content = content.replace(/~\/\.qwen\//g, pathPrefix);
      content = content.replace(/\$HOME\/\.qwen\//g, pathPrefix);
      content = content.replace(/\.\/\.qwen\//g, `./${getDirName(runtime)}/`);
      content = content.replace(/~\/\.hermes\//g, pathPrefix);
      content = content.replace(/\$HOME\/\.hermes\//g, pathPrefix);
      content = content.replace(/\.\/\.hermes\//g, `./${getDirName(runtime)}/`);
      // Qwen reuses Claude skill format but needs runtime-specific content replacement
      if (runtime === 'qwen') {
        content = content.replace(/CLAUDE\.md/g, 'QWEN.md');
        content = content.replace(/\bClaude Code\b/g, 'Qwen Code');
        content = content.replace(/\.claude\//g, '.qwen/');
      }
      // Hermes Agent reuses Claude skill format; rewrite branding + paths.
      if (runtime === 'hermes') {
        content = content.replace(/CLAUDE\.md/g, 'HERMES.md');
        content = content.replace(/\bClaude Code\b/g, 'Hermes Agent');
        content = content.replace(/\.claude\//g, '.hermes/');
      }
      content = processAttribution(content, getCommitAttribution(runtime));
      content = convertClaudeCommandToClaudeSkill(content, skillName, runtime);

      fs.writeFileSync(path.join(skillDir, 'SKILL.md'), content);
    }
  }

  recurse(srcDir, prefix);
}

/**
 * Write the Hermes "gsd" category DESCRIPTION.md.
 * Hermes' skill loader reads DESCRIPTION.md at the top of each skill category
 * directory and surfaces it in the system prompt so the model knows when to
 * reach for that category. Per spec in #2841 we collapse all 86 GSD commands
 * under a single "gsd" category to keep system-prompt overhead bounded.
 */
function writeHermesCategoryDescription(categoryDir) {
  fs.mkdirSync(categoryDir, { recursive: true });
  const body = [
    '---',
    'name: gsd',
    `version: ${pkg.version}`,
    'description: Get Shit Done — disciplined planning, execution, and shipping workflows. Use any gsd-* skill in this category to drive a project through new-project → discuss-phase → plan-phase → execute-phase → ship.',
    '---',
    '',
    '# Get Shit Done (GSD)',
    '',
    'GSD is a structured development workflow. Skills in this category cover',
    'project initialization, phase planning, execution, code review, and shipping.',
    '',
    'Invoke any `gsd-*` skill in this category to drive the corresponding step.',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(categoryDir, 'DESCRIPTION.md'), body);
}

/**
 * Recursively install GSD commands as Antigravity skills.
 * Each command becomes a skill-name/ folder containing SKILL.md.
 * Mirrors copyCommandsAsCopilotSkills but uses Antigravity converters.
 * @param {string} srcDir - Source commands directory
 * @param {string} skillsDir - Target skills directory
 * @param {string} prefix - Skill name prefix (e.g. 'gsd')
 * @param {boolean} isGlobal - Whether this is a global install
 */
function copyCommandsAsAntigravitySkills(srcDir, skillsDir, prefix, isGlobal = false) {
  if (!fs.existsSync(srcDir)) {
    return;
  }

  fs.mkdirSync(skillsDir, { recursive: true });

  // Remove previous GSD Antigravity skills
  const existing = fs.readdirSync(skillsDir, { withFileTypes: true });
  for (const entry of existing) {
    if (entry.isDirectory() && entry.name.startsWith(`${prefix}-`)) {
      fs.rmSync(path.join(skillsDir, entry.name), { recursive: true });
    }
  }

  function recurse(currentSrcDir, currentPrefix) {
    const entries = fs.readdirSync(currentSrcDir, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(currentSrcDir, entry.name);
      if (entry.isDirectory()) {
        recurse(srcPath, `${currentPrefix}-${entry.name}`);
        continue;
      }

      if (!entry.name.endsWith('.md')) {
        continue;
      }

      const baseName = entry.name.replace('.md', '');
      const skillName = `${currentPrefix}-${baseName}`;
      const skillDir = path.join(skillsDir, skillName);
      fs.mkdirSync(skillDir, { recursive: true });

      let content = fs.readFileSync(srcPath, 'utf8');
      content = convertClaudeCommandToAntigravitySkill(content, skillName, isGlobal);
      content = processAttribution(content, getCommitAttribution('antigravity'));

      fs.writeFileSync(path.join(skillDir, 'SKILL.md'), content);
    }
  }

  recurse(srcDir, prefix);
}

/**
 * Single source of truth for user-owned artifacts inside get-shit-done/.
 *
 * These files are created/refreshed by user-facing workflows (e.g.
 * /gsd-profile-user) and must be preserved across reinstalls. Critically, they
 * MUST be excluded from gsd-file-manifest.json — otherwise saveLocalPatches()
 * will compare a refreshed file against a stale manifest hash and emit a
 * spurious "locally modified GSD file" warning (bug #2771).
 *
 * Invariant: a file is either distribution (manifest-tracked, diff'd against
 * manifest) or user artifact (preserved across installs, never diff'd). Never
 * both. Both preserveUserArtifacts call sites and writeManifest must agree on
 * this list, which is why it lives here as a single constant.
 *
 * Paths are relative to the get-shit-done/ directory.
 */
const USER_OWNED_ARTIFACTS = ['USER-PROFILE.md'];

/**
 * Save user-generated files from destDir to an in-memory map before a wipe.
 *
 * @param {string} destDir - Directory that is about to be wiped
 * @param {string[]} fileNames - Relative file names (e.g. ['USER-PROFILE.md']) to preserve
 * @returns {Map<string, string>} Map of fileName → file content (only entries that existed)
 */
function preserveUserArtifacts(destDir, fileNames) {
  const saved = new Map();
  for (const name of fileNames) {
    const fullPath = path.join(destDir, name);
    if (fs.existsSync(fullPath)) {
      try {
        saved.set(name, fs.readFileSync(fullPath, 'utf8'));
      } catch { /* skip unreadable files */ }
    }
  }
  return saved;
}

/**
 * Restore user-generated files saved by preserveUserArtifacts after a wipe.
 *
 * @param {string} destDir - Directory that was wiped and recreated
 * @param {Map<string, string>} saved - Map returned by preserveUserArtifacts
 */
function restoreUserArtifacts(destDir, saved) {
  for (const [name, content] of saved) {
    const fullPath = path.join(destDir, name);
    try {
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, content, 'utf8');
    } catch { /* skip unwritable paths */ }
  }
}

/**
 * Migrate a legacy dev-preferences.md (saved from commands/gsd/) into the
 * skills/gsd-dev-preferences/SKILL.md location used by the writer after #2973.
 *
 * Skips silently if no legacy file was preserved, or if a SKILL.md already
 * exists at the new location (don't clobber user-customized skill content
 * — they may have edited the new file directly). Returns true on actual
 * migration so callers can log a one-line confirmation.
 *
 * @param {string} targetDir - Resolved runtime config directory (e.g. ~/.claude)
 * @param {Map<string, string>} saved - Map returned by preserveUserArtifacts
 * @returns {boolean} - true if a file was migrated, false otherwise
 */
function migrateLegacyDevPreferencesToSkill(targetDir, saved) {
  if (!saved || !saved.has('dev-preferences.md')) return false;
  const skillDir = path.join(targetDir, 'skills', 'gsd-dev-preferences');
  const skillFile = path.join(skillDir, 'SKILL.md');
  if (fs.existsSync(skillFile)) return false;
  try {
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(skillFile, saved.get('dev-preferences.md'), 'utf8');
    return true;
  } catch {
    return false;
  }
}

/**
 * Recursively copy directory, replacing paths in .md files
 * Deletes existing destDir first to remove orphaned files from previous versions
 * @param {string} srcDir - Source directory
 * @param {string} destDir - Destination directory
 * @param {string} pathPrefix - Path prefix for file references
 * @param {string} runtime - Target runtime ('claude', 'opencode', 'gemini', 'codex')
 * @param {boolean} isCommand - Whether the source is a command directory
 * @param {boolean} isGlobal - Whether the install is global
 */
function copyWithPathReplacement(srcDir, destDir, pathPrefix, runtime, isCommand = false, isGlobal = false) {
  const isOpencode = runtime === 'opencode';
  const isKilo = runtime === 'kilo';
  const isGemini = runtime === 'gemini';
  const isCodex = runtime === 'codex';
  const isCopilot = runtime === 'copilot';
  const isAntigravity = runtime === 'antigravity';
  const isCursor = runtime === 'cursor';
  const isWindsurf = runtime === 'windsurf';
  const isAugment = runtime === 'augment';
  const isTrae = runtime === 'trae';
  const isQwen = runtime === 'qwen';
  const isHermes = runtime === 'hermes';
  const isCline = runtime === 'cline';
  const dirName = getDirName(runtime);

  // Clean install: remove existing destination to prevent orphaned files
  if (fs.existsSync(destDir)) {
    fs.rmSync(destDir, { recursive: true });
  }
  fs.mkdirSync(destDir, { recursive: true });

  const entries = fs.readdirSync(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);

    if (entry.isDirectory()) {
      copyWithPathReplacement(srcPath, destPath, pathPrefix, runtime, isCommand, isGlobal);
    } else if (entry.name.endsWith('.md')) {
      // Replace ~/.claude/ and $HOME/.claude/ and ./.claude/ with runtime-appropriate paths
      // Skip generic replacement for Copilot — convertClaudeToCopilotContent handles all paths
      let content = fs.readFileSync(srcPath, 'utf8');
      if (!isCopilot && !isAntigravity) {
        const globalClaudeRegex = /~\/\.claude\//g;
        const globalClaudeHomeRegex = /\$HOME\/\.claude\//g;
        const localClaudeRegex = /\.\/\.claude\//g;
        content = content.replace(globalClaudeRegex, pathPrefix);
        content = content.replace(globalClaudeHomeRegex, pathPrefix);
        content = content.replace(localClaudeRegex, `./${dirName}/`);
        content = content.replace(/~\/\.qwen\//g, pathPrefix);
        content = content.replace(/\$HOME\/\.qwen\//g, pathPrefix);
        content = content.replace(/\.\/\.qwen\//g, `./${dirName}/`);
        content = content.replace(/~\/\.hermes\//g, pathPrefix);
        content = content.replace(/\$HOME\/\.hermes\//g, pathPrefix);
        content = content.replace(/\.\/\.hermes\//g, `./${dirName}/`);
      }
      content = processAttribution(content, getCommitAttribution(runtime));

      // Convert frontmatter for opencode compatibility
      if (isOpencode || isKilo) {
        content = isKilo
          ? convertClaudeToKiloFrontmatter(content)
          : convertClaudeToOpencodeFrontmatter(content);
        fs.writeFileSync(destPath, content);
      } else if (isGemini) {
        // Apply Gemini-specific Markdown transformations (slash commands, TOML)
        const processed = convertClaudeToGeminiMarkdown(content, { isCommand });
        const finalPath = isCommand ? destPath.replace(/\.md$/, '.toml') : destPath;
        fs.writeFileSync(finalPath, processed);
      } else if (isCodex) {
        content = convertClaudeToCodexMarkdown(content);
        fs.writeFileSync(destPath, content);
      } else if (isCopilot) {
        content = convertClaudeToCopilotContent(content, isGlobal);
        content = processAttribution(content, getCommitAttribution(runtime));
        fs.writeFileSync(destPath, content);
      } else if (isAntigravity) {
        content = convertClaudeToAntigravityContent(content, isGlobal);
        content = processAttribution(content, getCommitAttribution(runtime));
        fs.writeFileSync(destPath, content);
      } else if (isCursor) {
        content = convertClaudeToCursorMarkdown(content);
        fs.writeFileSync(destPath, content);
      } else if (isWindsurf) {
        content = convertClaudeToWindsurfMarkdown(content);
        fs.writeFileSync(destPath, content);
      } else if (isTrae) {
        content = convertClaudeToTraeMarkdown(content);
        fs.writeFileSync(destPath, content);
      } else if (isCline) {
        content = convertClaudeToCliineMarkdown(content);
        fs.writeFileSync(destPath, content);
      } else if (isQwen) {
        content = content.replace(/CLAUDE\.md/g, 'QWEN.md');
        content = content.replace(/\bClaude Code\b/g, 'Qwen Code');
        content = content.replace(/\.claude\//g, '.qwen/');
        fs.writeFileSync(destPath, content);
      } else if (isHermes) {
        content = content.replace(/CLAUDE\.md/g, 'HERMES.md');
        content = content.replace(/\bClaude Code\b/g, 'Hermes Agent');
        content = content.replace(/\.claude\//g, '.hermes/');
        fs.writeFileSync(destPath, content);
      } else {
        fs.writeFileSync(destPath, content);
      }
    } else if (isCopilot && (entry.name.endsWith('.cjs') || entry.name.endsWith('.js'))) {
      // Copilot: also transform .cjs/.js files for CONV-06 and CONV-07
      let content = fs.readFileSync(srcPath, 'utf8');
      content = convertClaudeToCopilotContent(content, isGlobal);
      fs.writeFileSync(destPath, content);
    } else if (isAntigravity && (entry.name.endsWith('.cjs') || entry.name.endsWith('.js'))) {
      // Antigravity: also transform .cjs/.js files for path/command conversions
      let content = fs.readFileSync(srcPath, 'utf8');
      content = convertClaudeToAntigravityContent(content, isGlobal);
      fs.writeFileSync(destPath, content);
    } else if (isCursor && (entry.name.endsWith('.cjs') || entry.name.endsWith('.js'))) {
      // For Cursor, also convert Claude references in JS/CJS utility scripts
      let jsContent = fs.readFileSync(srcPath, 'utf8');
      jsContent = jsContent.replace(/gsd:/gi, 'gsd-');
      jsContent = jsContent.replace(/\.claude\/skills\//g, '.cursor/skills/');
      jsContent = jsContent.replace(/CLAUDE\.md/g, '.cursor/rules/');
      jsContent = jsContent.replace(/\bClaude Code\b/g, 'Cursor');
      fs.writeFileSync(destPath, jsContent);
    } else if (isWindsurf && (entry.name.endsWith('.cjs') || entry.name.endsWith('.js'))) {
      // For Windsurf, also convert Claude references in JS/CJS utility scripts
      let jsContent = fs.readFileSync(srcPath, 'utf8');
      jsContent = jsContent.replace(/gsd:/gi, 'gsd-');
      jsContent = jsContent.replace(/\.claude\/skills\//g, '.windsurf/skills/');
      jsContent = jsContent.replace(/CLAUDE\.md/g, '.windsurf/rules');
      jsContent = jsContent.replace(/\bClaude Code\b/g, 'Windsurf');
      fs.writeFileSync(destPath, jsContent);
    } else if (isTrae && (entry.name.endsWith('.cjs') || entry.name.endsWith('.js'))) {
      let jsContent = fs.readFileSync(srcPath, 'utf8');
      jsContent = jsContent.replace(/\/gsd:([a-z0-9-]+)/g, (_, commandName) => {
        return `/gsd-${commandName}`;
      });
      jsContent = jsContent.replace(/\.claude\/skills\//g, '.trae/skills/');
      jsContent = jsContent.replace(/CLAUDE\.md/g, '.trae/rules/');
      jsContent = jsContent.replace(/\bClaude Code\b/g, 'Trae');
      fs.writeFileSync(destPath, jsContent);
    } else if (isCline && (entry.name.endsWith('.cjs') || entry.name.endsWith('.js'))) {
      let jsContent = fs.readFileSync(srcPath, 'utf8');
      jsContent = jsContent.replace(/\.claude\/skills\//g, '.cline/skills/');
      jsContent = jsContent.replace(/CLAUDE\.md/g, '.clinerules');
      jsContent = jsContent.replace(/\bClaude Code\b/g, 'Cline');
      fs.writeFileSync(destPath, jsContent);
    } else if (isQwen && (entry.name.endsWith('.cjs') || entry.name.endsWith('.js'))) {
      let jsContent = fs.readFileSync(srcPath, 'utf8');
      jsContent = jsContent.replace(/\.claude\/skills\//g, '.qwen/skills/');
      jsContent = jsContent.replace(/\.claude\//g, '.qwen/');
      jsContent = jsContent.replace(/CLAUDE\.md/g, 'QWEN.md');
      jsContent = jsContent.replace(/\bClaude Code\b/g, 'Qwen Code');
      fs.writeFileSync(destPath, jsContent);
    } else if (isHermes && (entry.name.endsWith('.cjs') || entry.name.endsWith('.js'))) {
      let jsContent = fs.readFileSync(srcPath, 'utf8');
      jsContent = jsContent.replace(/\.claude\/skills\//g, '.hermes/skills/');
      jsContent = jsContent.replace(/\.claude\//g, '.hermes/');
      jsContent = jsContent.replace(/CLAUDE\.md/g, 'HERMES.md');
      jsContent = jsContent.replace(/\bClaude Code\b/g, 'Hermes Agent');
      fs.writeFileSync(destPath, jsContent);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Clean up orphaned files from previous GSD versions
 */
function cleanupOrphanedFiles(configDir) {
  const orphanedFiles = [
    'hooks/gsd-notify.sh',  // Removed in v1.6.x
    'hooks/statusline.js',  // Renamed to gsd-statusline.js in v1.9.0
  ];

  for (const relPath of orphanedFiles) {
    const fullPath = path.join(configDir, relPath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      console.log(`  ${green}✓${reset} Removed orphaned ${relPath}`);
    }
  }
}

/**
 * Clean up orphaned hook registrations from settings.json
 */
function cleanupOrphanedHooks(settings) {
  const orphanedHookPatterns = [
    'gsd-notify.sh',  // Removed in v1.6.x
    'hooks/statusline.js',  // Renamed to gsd-statusline.js in v1.9.0
    'gsd-intel-index.js',  // Removed in v1.9.2
    'gsd-intel-session.js',  // Removed in v1.9.2
    'gsd-intel-prune.js',  // Removed in v1.9.2
  ];

  let cleanedHooks = false;

  // Check all hook event types (Stop, SessionStart, etc.)
  if (settings.hooks) {
    for (const eventType of Object.keys(settings.hooks)) {
      const hookEntries = settings.hooks[eventType];
      if (Array.isArray(hookEntries)) {
        // Filter out entries that contain orphaned hooks
        const filtered = hookEntries.filter(entry => {
          if (entry.hooks && Array.isArray(entry.hooks)) {
            // Check if any hook in this entry matches orphaned patterns
            const hasOrphaned = entry.hooks.some(h =>
              h.command && orphanedHookPatterns.some(pattern => h.command.includes(pattern))
            );
            if (hasOrphaned) {
              cleanedHooks = true;
              return false;  // Remove this entry
            }
          }
          return true;  // Keep this entry
        });
        settings.hooks[eventType] = filtered;
      }
    }
  }

  if (cleanedHooks) {
    console.log(`  ${green}✓${reset} Removed orphaned hook registrations`);
  }

  // Fix #330: Update statusLine if it points to old GSD statusline.js path
  // Only match the specific old GSD path pattern (hooks/statusline.js),
  // not third-party statusline scripts that happen to contain 'statusline.js'
  if (settings.statusLine && settings.statusLine.command &&
    /hooks[\/\\]statusline\.js/.test(settings.statusLine.command)) {
    settings.statusLine.command = settings.statusLine.command.replace(
      /hooks([\/\\])statusline\.js/,
      'hooks$1gsd-statusline.js'
    );
    console.log(`  ${green}✓${reset} Updated statusline path (hooks/statusline.js → hooks/gsd-statusline.js)`);
  }

  return settings;
}

/**
 * Validate hook field requirements to prevent silent settings.json rejection.
 *
 * Claude Code validates the entire settings file with a strict Zod schema.
 * If ANY hook has an invalid schema (e.g., type: "agent" missing "prompt"),
 * the ENTIRE settings.json is silently discarded — disabling all plugins,
 * env vars, and other configuration.
 *
 * This defensive check removes invalid hook entries and cleans up empty
 * event arrays to prevent this. It validates:
 *   - agent hooks require a "prompt" field
 *   - command hooks require a "command" field
 *   - entries must have a valid "hooks" array (non-array/missing is removed)
 *
 * @param {object} settings - The settings object (mutated in place)
 * @returns {object} The same settings object
 */
function validateHookFields(settings) {
  if (!settings.hooks || typeof settings.hooks !== 'object') return settings;

  let fixedHooks = false;
  const emptyKeys = [];

  for (const [eventType, hookEntries] of Object.entries(settings.hooks)) {
    if (!Array.isArray(hookEntries)) continue;

    // Pass 1: validate each entry, building a new array without mutation
    const validated = [];
    for (const entry of hookEntries) {
      // Entries without a hooks sub-array are structurally invalid — remove them
      if (!entry.hooks || !Array.isArray(entry.hooks)) {
        fixedHooks = true;
        continue;
      }

      // Filter invalid hooks within the entry
      const validHooks = entry.hooks.filter(h => {
        if (h.type === 'agent' && !h.prompt) {
          fixedHooks = true;
          return false;
        }
        if (h.type === 'command' && !h.command) {
          fixedHooks = true;
          return false;
        }
        return true;
      });

      // Drop entries whose hooks are now empty
      if (validHooks.length === 0) {
        fixedHooks = true;
        continue;
      }

      // Build a clean copy instead of mutating the original entry
      validated.push({ ...entry, hooks: validHooks });
    }

    settings.hooks[eventType] = validated;

    // Collect empty event arrays for removal (avoid delete during iteration)
    if (validated.length === 0) {
      emptyKeys.push(eventType);
      fixedHooks = true;
    }
  }

  // Pass 2: remove empty event arrays
  for (const key of emptyKeys) {
    delete settings.hooks[key];
  }

  if (fixedHooks) {
    console.log(`  ${green}✓${reset} Fixed invalid hook entries (prevents settings.json schema rejection)`);
  }

  return settings;
}

/**
 * Uninstall GSD from the specified directory for a specific runtime
 * Removes only GSD-specific files/directories, preserves user content
 * @param {boolean} isGlobal - Whether to uninstall from global or local
 * @param {string} runtime - Target runtime ('claude', 'opencode', 'gemini', 'codex', 'copilot')
 */
function uninstall(isGlobal, runtime = 'claude') {
  const isOpencode = runtime === 'opencode';
  const isKilo = runtime === 'kilo';
  const isGemini = runtime === 'gemini';
  const isCodex = runtime === 'codex';
  const isCopilot = runtime === 'copilot';
  const isAntigravity = runtime === 'antigravity';
  const isCursor = runtime === 'cursor';
  const isWindsurf = runtime === 'windsurf';
  const isAugment = runtime === 'augment';
  const isTrae = runtime === 'trae';
  const isQwen = runtime === 'qwen';
  const isHermes = runtime === 'hermes';
  const isCodebuddy = runtime === 'codebuddy';
  const dirName = getDirName(runtime);

  // Get the target directory based on runtime and install type
  const targetDir = isGlobal
    ? getGlobalDir(runtime, explicitConfigDir)
    : path.join(process.cwd(), dirName);

  const locationLabel = isGlobal
    ? targetDir.replace(os.homedir(), '~')
    : targetDir.replace(process.cwd(), '.');

  let runtimeLabel = 'Claude Code';
  if (runtime === 'opencode') runtimeLabel = 'OpenCode';
  if (runtime === 'gemini') runtimeLabel = 'Gemini';
  if (runtime === 'kilo') runtimeLabel = 'Kilo';
  if (runtime === 'codex') runtimeLabel = 'Codex';
  if (runtime === 'copilot') runtimeLabel = 'Copilot';
  if (runtime === 'antigravity') runtimeLabel = 'Antigravity';
  if (runtime === 'cursor') runtimeLabel = 'Cursor';
  if (runtime === 'windsurf') runtimeLabel = 'Windsurf';
  if (runtime === 'augment') runtimeLabel = 'Augment';
  if (runtime === 'trae') runtimeLabel = 'Trae';
  if (runtime === 'qwen') runtimeLabel = 'Qwen Code';
  if (runtime === 'hermes') runtimeLabel = 'Hermes Agent';
  if (runtime === 'codebuddy') runtimeLabel = 'CodeBuddy';

  console.log(`  Uninstalling GSD from ${cyan}${runtimeLabel}${reset} at ${cyan}${locationLabel}${reset}\n`);

  // Check if target directory exists
  if (!fs.existsSync(targetDir)) {
    console.log(`  ${yellow}⚠${reset} Directory does not exist: ${locationLabel}`);
    console.log(`  Nothing to uninstall.\n`);
    return;
  }

  let removedCount = 0;

  // 1. Remove GSD commands/skills
  if (isOpencode || isKilo) {
    // OpenCode/Kilo: remove command/gsd-*.md files
    const commandDir = path.join(targetDir, 'command');
    if (fs.existsSync(commandDir)) {
      const files = fs.readdirSync(commandDir);
      for (const file of files) {
        if (file.startsWith('gsd-') && file.endsWith('.md')) {
          fs.unlinkSync(path.join(commandDir, file));
          removedCount++;
        }
      }
      console.log(`  ${green}✓${reset} Removed GSD commands from command/`);
    }
  } else if (isCodex || isCursor || isWindsurf || isTrae || isCodebuddy) {
    // Codex/Cursor/Windsurf/Trae/CodeBuddy: remove skills/gsd-*/SKILL.md skill directories
    const skillsDir = path.join(targetDir, 'skills');
    if (fs.existsSync(skillsDir)) {
      let skillCount = 0;
      const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && entry.name.startsWith('gsd-')) {
          fs.rmSync(path.join(skillsDir, entry.name), { recursive: true });
          skillCount++;
        }
      }
      if (skillCount > 0) {
        removedCount++;
        console.log(`  ${green}✓${reset} Removed ${skillCount} ${runtimeLabel} skills`);
      }
    }

    // Codex-only: remove GSD agent .toml config files and config.toml sections
    if (isCodex) {
      const codexAgentsDir = path.join(targetDir, 'agents');
      if (fs.existsSync(codexAgentsDir)) {
        const tomlFiles = fs.readdirSync(codexAgentsDir);
        let tomlCount = 0;
        for (const file of tomlFiles) {
          if (file.startsWith('gsd-') && file.endsWith('.toml')) {
            fs.unlinkSync(path.join(codexAgentsDir, file));
            tomlCount++;
          }
        }
        if (tomlCount > 0) {
          removedCount++;
          console.log(`  ${green}✓${reset} Removed ${tomlCount} agent .toml configs`);
        }
      }

      // Codex: clean GSD sections from config.toml
      const configPath = path.join(targetDir, 'config.toml');
      if (fs.existsSync(configPath)) {
        const content = fs.readFileSync(configPath, 'utf8');
        const cleaned = stripGsdFromCodexConfig(content);
        if (cleaned === null) {
          // File is empty after stripping — delete it
          fs.unlinkSync(configPath);
          removedCount++;
          console.log(`  ${green}✓${reset} Removed config.toml (was GSD-only)`);
        } else if (cleaned !== content) {
          fs.writeFileSync(configPath, cleaned);
          removedCount++;
          console.log(`  ${green}✓${reset} Cleaned GSD sections from config.toml`);
        }
      }
    }
  } else if (isCopilot) {
    // Copilot: remove skills/gsd-*/ directories (same layout as Codex skills)
    const skillsDir = path.join(targetDir, 'skills');
    if (fs.existsSync(skillsDir)) {
      let skillCount = 0;
      const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && entry.name.startsWith('gsd-')) {
          fs.rmSync(path.join(skillsDir, entry.name), { recursive: true });
          skillCount++;
        }
      }
      if (skillCount > 0) {
        removedCount++;
        console.log(`  ${green}✓${reset} Removed ${skillCount} Copilot skills`);
      }
    }

    // Copilot: clean GSD section from copilot-instructions.md
    const instructionsPath = path.join(targetDir, 'copilot-instructions.md');
    if (fs.existsSync(instructionsPath)) {
      const content = fs.readFileSync(instructionsPath, 'utf8');
      const cleaned = stripGsdFromCopilotInstructions(content);
      if (cleaned === null) {
        fs.unlinkSync(instructionsPath);
        removedCount++;
        console.log(`  ${green}✓${reset} Removed copilot-instructions.md (was GSD-only)`);
      } else if (cleaned !== content) {
        fs.writeFileSync(instructionsPath, cleaned);
        removedCount++;
        console.log(`  ${green}✓${reset} Cleaned GSD section from copilot-instructions.md`);
      }
    }
  } else if (isAntigravity) {
    // Antigravity: remove skills/gsd-*/ directories (same layout as Copilot skills)
    const skillsDir = path.join(targetDir, 'skills');
    if (fs.existsSync(skillsDir)) {
      let skillCount = 0;
      const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && entry.name.startsWith('gsd-')) {
          fs.rmSync(path.join(skillsDir, entry.name), { recursive: true });
          skillCount++;
        }
      }
      if (skillCount > 0) {
        removedCount++;
        console.log(`  ${green}✓${reset} Removed ${skillCount} Antigravity skills`);
      }
    }
  } else if (isQwen) {
    const skillsDir = path.join(targetDir, 'skills');
    if (fs.existsSync(skillsDir)) {
      let skillCount = 0;
      const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && entry.name.startsWith('gsd-')) {
          fs.rmSync(path.join(skillsDir, entry.name), { recursive: true });
          skillCount++;
        }
      }
      if (skillCount > 0) {
        removedCount++;
        console.log(`  ${green}✓${reset} Removed ${skillCount} Qwen Code skills`);
      }
    }

    const legacyCommandsDir = path.join(targetDir, 'commands', 'gsd');
    if (fs.existsSync(legacyCommandsDir)) {
      const savedLegacyArtifacts = preserveUserArtifacts(legacyCommandsDir, ['dev-preferences.md']);
      fs.rmSync(legacyCommandsDir, { recursive: true });
      removedCount++;
      console.log(`  ${green}✓${reset} Removed legacy commands/gsd/`);
      // #2973: also migrate dev-preferences.md content into the new
      // skills/gsd-dev-preferences/SKILL.md location (skills-aware runtimes).
      // This prevents the legacy file from being orphaned after the writer
      // starts targeting the skills path. No-op if SKILL.md already exists.
      restoreUserArtifacts(legacyCommandsDir, savedLegacyArtifacts);
      if (migrateLegacyDevPreferencesToSkill(targetDir, savedLegacyArtifacts)) {
        console.log(`  ${green}✓${reset} Migrated dev-preferences.md → skills/gsd-dev-preferences/SKILL.md (#2973)`);
      }
    }
  } else if (isHermes) {
    // Hermes Agent: skills live under skills/gsd/ as a single category (per
    // spec in #2841). Remove the whole gsd/ category directory; also clean up
    // any pre-nested-layout flat skills/gsd-*/ left over from older installs.
    const skillsDir = path.join(targetDir, 'skills');
    let skillCount = 0;
    const nestedCategoryDir = path.join(skillsDir, 'gsd');
    if (fs.existsSync(nestedCategoryDir)) {
      const entries = fs.readdirSync(nestedCategoryDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && entry.name.startsWith('gsd-')) {
          skillCount++;
        }
      }
      fs.rmSync(nestedCategoryDir, { recursive: true });
    }
    if (fs.existsSync(skillsDir)) {
      const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && entry.name.startsWith('gsd-')) {
          fs.rmSync(path.join(skillsDir, entry.name), { recursive: true });
          skillCount++;
        }
      }
    }
    if (skillCount > 0) {
      removedCount++;
      console.log(`  ${green}✓${reset} Removed ${skillCount} Hermes Agent skills`);
    }

    const legacyCommandsDir = path.join(targetDir, 'commands', 'gsd');
    if (fs.existsSync(legacyCommandsDir)) {
      const savedLegacyArtifacts = preserveUserArtifacts(legacyCommandsDir, ['dev-preferences.md']);
      fs.rmSync(legacyCommandsDir, { recursive: true });
      removedCount++;
      console.log(`  ${green}✓${reset} Removed legacy commands/gsd/`);
      // #2973: also migrate dev-preferences.md content into the new
      // skills/gsd-dev-preferences/SKILL.md location (skills-aware runtimes).
      // This prevents the legacy file from being orphaned after the writer
      // starts targeting the skills path. No-op if SKILL.md already exists.
      restoreUserArtifacts(legacyCommandsDir, savedLegacyArtifacts);
      if (migrateLegacyDevPreferencesToSkill(targetDir, savedLegacyArtifacts)) {
        console.log(`  ${green}✓${reset} Migrated dev-preferences.md → skills/gsd-dev-preferences/SKILL.md (#2973)`);
      }
    }
  } else if (isGemini) {
    // Gemini: still uses commands/gsd/
    const gsdCommandsDir = path.join(targetDir, 'commands', 'gsd');
    if (fs.existsSync(gsdCommandsDir)) {
      // Preserve user-generated files before wipe (#1423)
      // Note: if more user files are added, consider a naming convention (e.g., USER-*.md)
      // and preserve all matching files instead of listing each one individually.
      const devPrefsPath = path.join(gsdCommandsDir, 'dev-preferences.md');
      const preservedDevPrefs = fs.existsSync(devPrefsPath) ? fs.readFileSync(devPrefsPath, 'utf-8') : null;

      fs.rmSync(gsdCommandsDir, { recursive: true });
      removedCount++;
      console.log(`  ${green}✓${reset} Removed commands/gsd/`);

      // Restore user-generated files
      if (preservedDevPrefs) {
        try {
          fs.mkdirSync(gsdCommandsDir, { recursive: true });
          fs.writeFileSync(devPrefsPath, preservedDevPrefs);
          console.log(`  ${green}✓${reset} Preserved commands/gsd/dev-preferences.md`);
        } catch (err) {
          console.error(`  ${red}✗${reset} Failed to restore dev-preferences.md: ${err.message}`);
        }
      }
    }
  } else if (isGlobal) {
    // Claude Code global: remove skills/gsd-*/ directories (primary global install location)
    const skillsDir = path.join(targetDir, 'skills');
    if (fs.existsSync(skillsDir)) {
      let skillCount = 0;
      const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && entry.name.startsWith('gsd-')) {
          fs.rmSync(path.join(skillsDir, entry.name), { recursive: true });
          skillCount++;
        }
      }
      if (skillCount > 0) {
        removedCount++;
        console.log(`  ${green}✓${reset} Removed ${skillCount} Claude Code skills`);
      }
    }

    // Also clean up legacy commands/gsd/ from older global installs
    const legacyCommandsDir = path.join(targetDir, 'commands', 'gsd');
    if (fs.existsSync(legacyCommandsDir)) {
      // Preserve user-generated files before legacy wipe (#1423)
      const devPrefsPath = path.join(legacyCommandsDir, 'dev-preferences.md');
      const preservedDevPrefs = fs.existsSync(devPrefsPath) ? fs.readFileSync(devPrefsPath, 'utf-8') : null;

      fs.rmSync(legacyCommandsDir, { recursive: true });
      removedCount++;
      console.log(`  ${green}✓${reset} Removed legacy commands/gsd/`);

      if (preservedDevPrefs) {
        try {
          fs.mkdirSync(legacyCommandsDir, { recursive: true });
          fs.writeFileSync(devPrefsPath, preservedDevPrefs);
          console.log(`  ${green}✓${reset} Preserved commands/gsd/dev-preferences.md`);
        } catch (err) {
          console.error(`  ${red}✗${reset} Failed to restore dev-preferences.md: ${err.message}`);
        }
      }
    }
  } else {
    // Claude Code local: remove commands/gsd/ (primary local install location since #1736)
    const gsdCommandsDir = path.join(targetDir, 'commands', 'gsd');
    if (fs.existsSync(gsdCommandsDir)) {
      // Preserve user-generated files before wipe (#1423)
      const devPrefsPath = path.join(gsdCommandsDir, 'dev-preferences.md');
      const preservedDevPrefs = fs.existsSync(devPrefsPath) ? fs.readFileSync(devPrefsPath, 'utf-8') : null;

      fs.rmSync(gsdCommandsDir, { recursive: true });
      removedCount++;
      console.log(`  ${green}✓${reset} Removed commands/gsd/`);

      if (preservedDevPrefs) {
        try {
          fs.mkdirSync(gsdCommandsDir, { recursive: true });
          fs.writeFileSync(devPrefsPath, preservedDevPrefs);
          console.log(`  ${green}✓${reset} Preserved commands/gsd/dev-preferences.md`);
        } catch (err) {
          console.error(`  ${red}✗${reset} Failed to restore dev-preferences.md: ${err.message}`);
        }
      }
    }
  }

  // 2. Remove get-shit-done directory
  const gsdDir = path.join(targetDir, 'get-shit-done');
  if (fs.existsSync(gsdDir)) {
    // Preserve user-generated files before wipe (#1423)
    const userProfilePath = path.join(gsdDir, 'USER-PROFILE.md');
    const preservedProfile = fs.existsSync(userProfilePath) ? fs.readFileSync(userProfilePath, 'utf-8') : null;

    fs.rmSync(gsdDir, { recursive: true });
    removedCount++;
    console.log(`  ${green}✓${reset} Removed get-shit-done/`);

    // Restore user-generated files
    if (preservedProfile) {
      try {
        fs.mkdirSync(gsdDir, { recursive: true });
        fs.writeFileSync(userProfilePath, preservedProfile);
        console.log(`  ${green}✓${reset} Preserved get-shit-done/USER-PROFILE.md`);
      } catch (err) {
        console.error(`  ${red}✗${reset} Failed to restore USER-PROFILE.md: ${err.message}`);
      }
    }
  }

  // 3. Remove GSD agents (gsd-*.md files only)
  const agentsDir = path.join(targetDir, 'agents');
  if (fs.existsSync(agentsDir)) {
    const files = fs.readdirSync(agentsDir);
    let agentCount = 0;
    for (const file of files) {
      if (file.startsWith('gsd-') && file.endsWith('.md')) {
        fs.unlinkSync(path.join(agentsDir, file));
        agentCount++;
      }
    }
    if (agentCount > 0) {
      removedCount++;
      console.log(`  ${green}✓${reset} Removed ${agentCount} GSD agents`);
    }
  }

  // 4. Remove GSD hooks
  const hooksDir = path.join(targetDir, 'hooks');
  if (fs.existsSync(hooksDir)) {
    const gsdHooks = ['gsd-statusline.js', 'gsd-check-update.js', 'gsd-context-monitor.js', 'gsd-prompt-guard.js', 'gsd-read-guard.js', 'gsd-read-injection-scanner.js', 'gsd-update-banner.js', 'gsd-workflow-guard.js', 'gsd-session-state.sh', 'gsd-validate-commit.sh', 'gsd-phase-boundary.sh'];
    let hookCount = 0;
    for (const hook of gsdHooks) {
      const hookPath = path.join(hooksDir, hook);
      if (fs.existsSync(hookPath)) {
        fs.unlinkSync(hookPath);
        hookCount++;
      }
    }
    if (hookCount > 0) {
      removedCount++;
      console.log(`  ${green}✓${reset} Removed ${hookCount} GSD hooks`);
    }
  }

  // 5. Remove GSD package.json (CommonJS mode marker)
  const pkgJsonPath = path.join(targetDir, 'package.json');
  if (fs.existsSync(pkgJsonPath)) {
    try {
      const content = fs.readFileSync(pkgJsonPath, 'utf8').trim();
      // Only remove if it's our minimal CommonJS marker
      if (content === '{"type":"commonjs"}') {
        fs.unlinkSync(pkgJsonPath);
        removedCount++;
        console.log(`  ${green}✓${reset} Removed GSD package.json`);
      }
    } catch (e) {
      // Ignore read errors
    }
  }

  // 6. Clean up settings.json (remove GSD hooks and statusline)
  const settingsPath = path.join(targetDir, 'settings.json');
  if (fs.existsSync(settingsPath)) {
    let settings = readSettings(settingsPath);
    if (settings === null) {
      console.log(`  ${yellow}i${reset} Skipping settings.json cleanup — file could not be parsed`);
      settings = {}; // prevent downstream crashes, but don't write back
    }
    let settingsModified = false;

    // Remove GSD statusline if it references our hook
    if (settings.statusLine && settings.statusLine.command &&
      settings.statusLine.command.includes('gsd-statusline')) {
      delete settings.statusLine;
      settingsModified = true;
      console.log(`  ${green}✓${reset} Removed GSD statusline from settings`);
    }

    // Remove GSD hooks from settings — per-hook granularity to preserve
    // user hooks that share an entry with a GSD hook (#1755 followup)
    const isGsdHookCommand = (cmd) =>
      cmd && (cmd.includes('gsd-check-update') || cmd.includes('gsd-statusline') ||
        cmd.includes('gsd-session-state') || cmd.includes('gsd-context-monitor') ||
        cmd.includes('gsd-phase-boundary') || cmd.includes('gsd-prompt-guard') ||
        cmd.includes('gsd-read-guard') || cmd.includes('gsd-read-injection-scanner') ||
        cmd.includes('gsd-update-banner') ||
        cmd.includes('gsd-validate-commit') || cmd.includes('gsd-workflow-guard'));

    for (const eventName of ['SessionStart', 'PostToolUse', 'AfterTool', 'PreToolUse', 'BeforeTool']) {
      if (settings.hooks && settings.hooks[eventName]) {
        const before = JSON.stringify(settings.hooks[eventName]);
        settings.hooks[eventName] = settings.hooks[eventName]
          .map(entry => {
            if (!entry.hooks || !Array.isArray(entry.hooks)) return entry;
            // Filter out individual GSD hooks, keep user hooks
            entry.hooks = entry.hooks.filter(h => !isGsdHookCommand(h.command));
            return entry.hooks.length > 0 ? entry : null;
          })
          .filter(Boolean);
        if (JSON.stringify(settings.hooks[eventName]) !== before) {
          settingsModified = true;
        }
        if (settings.hooks[eventName].length === 0) {
          delete settings.hooks[eventName];
        }
      }
    }
    if (settingsModified) {
      console.log(`  ${green}✓${reset} Removed GSD hooks from settings`);
    }

    // Clean up empty hooks object
    if (settings.hooks && Object.keys(settings.hooks).length === 0) {
      delete settings.hooks;
    }

    if (settingsModified) {
      writeSettings(settingsPath, settings);
      removedCount++;
    }
  }

  // 6. For OpenCode, clean up permissions from opencode.json or opencode.jsonc
  if (isOpencode) {
    const configPath = resolveOpencodeConfigPath(targetDir);
    if (fs.existsSync(configPath)) {
      try {
        const config = parseJsonc(fs.readFileSync(configPath, 'utf8'));
        let modified = false;

        // Remove GSD permission entries
        if (config.permission) {
          for (const permType of ['read', 'external_directory']) {
            if (config.permission[permType]) {
              const keys = Object.keys(config.permission[permType]);
              for (const key of keys) {
                if (key.includes('get-shit-done')) {
                  delete config.permission[permType][key];
                  modified = true;
                }
              }
              // Clean up empty objects
              if (Object.keys(config.permission[permType]).length === 0) {
                delete config.permission[permType];
              }
            }
          }
          if (Object.keys(config.permission).length === 0) {
            delete config.permission;
          }
        }

        if (modified) {
          fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
          removedCount++;
          console.log(`  ${green}✓${reset} Removed GSD permissions from ${path.basename(configPath)}`);
        }
      } catch (e) {
        // Ignore JSON parse errors
      }
    }
  }

  // 7. For Kilo, clean up permissions from kilo.json or kilo.jsonc
  if (isKilo) {
    const configPath = resolveKiloConfigPath(targetDir);
    if (fs.existsSync(configPath)) {
      try {
        const config = parseJsonc(fs.readFileSync(configPath, 'utf8'));
        let modified = false;

        // Remove GSD permission entries
        if (config.permission) {
          for (const permType of ['read', 'external_directory']) {
            if (config.permission[permType]) {
              const keys = Object.keys(config.permission[permType]);
              for (const key of keys) {
                if (key.includes('get-shit-done')) {
                  delete config.permission[permType][key];
                  modified = true;
                }
              }
              // Clean up empty objects
              if (Object.keys(config.permission[permType]).length === 0) {
                delete config.permission[permType];
              }
            }
          }
          if (Object.keys(config.permission).length === 0) {
            delete config.permission;
          }
        }

        if (modified) {
          fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
          removedCount++;
          console.log(`  ${green}✓${reset} Removed GSD permissions from ${path.basename(configPath)}`);
        }
      } catch (e) {
        // Ignore JSON parse errors
      }
    }
  }

  // Remove the file manifest that the installer wrote at install time.
  // Without this step the metadata file persists after uninstall (#1908).
  const manifestPath = path.join(targetDir, MANIFEST_NAME);
  if (fs.existsSync(manifestPath)) {
    fs.rmSync(manifestPath, { force: true });
    removedCount++;
    console.log(`  ${green}✓${reset} Removed ${MANIFEST_NAME}`);
  }

  if (removedCount === 0) {
    console.log(`  ${yellow}⚠${reset} No GSD files found to remove.`);
  }

  console.log(`
  ${green}Done!${reset} GSD has been uninstalled from ${runtimeLabel}.
  Your other files and settings have been preserved.
`);
}

/**
 * Parse JSONC (JSON with Comments) by stripping comments and trailing commas.
 * OpenCode supports JSONC format via jsonc-parser, so users may have comments.
 * This is a lightweight inline parser to avoid adding dependencies.
 */
function parseJsonc(content) {
  // Strip BOM if present
  if (content.charCodeAt(0) === 0xFEFF) {
    content = content.slice(1);
  }

  // Remove single-line and block comments while preserving strings
  let result = '';
  let inString = false;
  let i = 0;
  while (i < content.length) {
    const char = content[i];
    const next = content[i + 1];

    if (inString) {
      result += char;
      // Handle escape sequences
      if (char === '\\' && i + 1 < content.length) {
        result += next;
        i += 2;
        continue;
      }
      if (char === '"') {
        inString = false;
      }
      i++;
    } else {
      if (char === '"') {
        inString = true;
        result += char;
        i++;
      } else if (char === '/' && next === '/') {
        // Skip single-line comment until end of line
        while (i < content.length && content[i] !== '\n') {
          i++;
        }
      } else if (char === '/' && next === '*') {
        // Skip block comment
        i += 2;
        while (i < content.length - 1 && !(content[i] === '*' && content[i + 1] === '/')) {
          i++;
        }
        i += 2; // Skip closing */
      } else {
        result += char;
        i++;
      }
    }
  }

  // Remove trailing commas before } or ]
  result = result.replace(/,(\s*[}\]])/g, '$1');

  return JSON.parse(result);
}

/**
 * Configure OpenCode permissions to allow reading GSD reference docs
 * This prevents permission prompts when GSD accesses the get-shit-done directory
 * @param {boolean} isGlobal - Whether this is a global or local install
 * @param {string|null} configDir - Resolved config directory when already known
 */
function configureOpencodePermissions(isGlobal = true, configDir = null) {
  // For local installs, use ./.opencode/
  // For global installs, use ~/.config/opencode/
  const opencodeConfigDir = configDir || (isGlobal
    ? getGlobalDir('opencode', explicitConfigDir)
    : path.join(process.cwd(), '.opencode'));
  // Ensure config directory exists
  fs.mkdirSync(opencodeConfigDir, { recursive: true });

  const configPath = resolveOpencodeConfigPath(opencodeConfigDir);

  // Read existing config or create empty object
  let config = {};
  if (fs.existsSync(configPath)) {
    try {
      const content = fs.readFileSync(configPath, 'utf8');
      config = parseJsonc(content);
    } catch (e) {
      // Cannot parse - DO NOT overwrite user's config
      const configFile = path.basename(configPath);
      console.log(`  ${yellow}⚠${reset} Could not parse ${configFile} - skipping permission config`);
      console.log(`    ${dim}Reason: ${e.message}${reset}`);
      console.log(`    ${dim}Your config was NOT modified. Fix the syntax manually if needed.${reset}`);
      return;
    }
  }

  // OpenCode also allows a top-level string permission like "allow".
  // In that case, path-specific permission entries are unnecessary.
  if (typeof config.permission === 'string') {
    return;
  }

  // Ensure permission structure exists
  if (!config.permission || typeof config.permission !== 'object') {
    config.permission = {};
  }

  // Build the GSD path using the actual config directory
  // Use ~ shorthand if it's in the default location, otherwise use full path
  const defaultConfigDir = path.join(os.homedir(), '.config', 'opencode');
  const gsdPath = opencodeConfigDir === defaultConfigDir
    ? '~/.config/opencode/get-shit-done/*'
    : `${opencodeConfigDir.replace(/\\/g, '/')}/get-shit-done/*`;

  let modified = false;

  // Configure read permission
  if (!config.permission.read || typeof config.permission.read !== 'object') {
    config.permission.read = {};
  }
  if (config.permission.read[gsdPath] !== 'allow') {
    config.permission.read[gsdPath] = 'allow';
    modified = true;
  }

  // Configure external_directory permission (the safety guard for paths outside project)
  if (!config.permission.external_directory || typeof config.permission.external_directory !== 'object') {
    config.permission.external_directory = {};
  }
  if (config.permission.external_directory[gsdPath] !== 'allow') {
    config.permission.external_directory[gsdPath] = 'allow';
    modified = true;
  }

  if (!modified) {
    return; // Already configured
  }

  // Write config back
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
  console.log(`  ${green}✓${reset} Configured read permission for GSD docs`);
}

/**
 * Configure Kilo permissions to allow reading GSD reference docs
 * This prevents permission prompts when GSD accesses the get-shit-done directory
 * @param {boolean} isGlobal - Whether this is a global or local install
 * @param {string|null} configDir - Resolved config directory when already known
 */
function configureKiloPermissions(isGlobal = true, configDir = null) {
  // For local installs, use ./.kilo/
  // For global installs, use ~/.config/kilo/
  const kiloConfigDir = configDir || (isGlobal
    ? getGlobalDir('kilo', explicitConfigDir)
    : path.join(process.cwd(), '.kilo'));
  // Ensure config directory exists
  fs.mkdirSync(kiloConfigDir, { recursive: true });

  const configPath = resolveKiloConfigPath(kiloConfigDir);

  // Read existing config or create empty object
  let config = {};
  if (fs.existsSync(configPath)) {
    try {
      const content = fs.readFileSync(configPath, 'utf8');
      config = parseJsonc(content);
    } catch (e) {
      // Cannot parse - DO NOT overwrite user's config
      const configFile = path.basename(configPath);
      console.log(`  ${yellow}⚠${reset} Could not parse ${configFile} - skipping permission config`);
      console.log(`    ${dim}Reason: ${e.message}${reset}`);
      console.log(`    ${dim}Your config was NOT modified. Fix the syntax manually if needed.${reset}`);
      return;
    }
  }

  // Ensure permission structure exists
  if (!config.permission || typeof config.permission !== 'object') {
    config.permission = {};
  }

  // Build the GSD path using the actual config directory
  // Use ~ shorthand if it's in the default location, otherwise use full path
  const defaultConfigDir = path.join(os.homedir(), '.config', 'kilo');
  const gsdPath = kiloConfigDir === defaultConfigDir
    ? '~/.config/kilo/get-shit-done/*'
    : `${kiloConfigDir.replace(/\\/g, '/')}/get-shit-done/*`;

  let modified = false;

  // Configure read permission
  if (!config.permission.read || typeof config.permission.read !== 'object') {
    config.permission.read = {};
  }
  if (config.permission.read[gsdPath] !== 'allow') {
    config.permission.read[gsdPath] = 'allow';
    modified = true;
  }

  // Configure external_directory permission (the safety guard for paths outside project)
  if (!config.permission.external_directory || typeof config.permission.external_directory !== 'object') {
    config.permission.external_directory = {};
  }
  if (config.permission.external_directory[gsdPath] !== 'allow') {
    config.permission.external_directory[gsdPath] = 'allow';
    modified = true;
  }

  if (!modified) {
    return; // Already configured
  }

  // Write config back
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
  console.log(`  ${green}✓${reset} Configured read permission for GSD docs`);
}

/**
 * Verify a directory exists and contains files
 */
function verifyInstalled(dirPath, description) {
  if (!fs.existsSync(dirPath)) {
    console.error(`  ${yellow}✗${reset} Failed to install ${description}: directory not created`);
    return false;
  }
  try {
    const entries = fs.readdirSync(dirPath);
    if (entries.length === 0) {
      console.error(`  ${yellow}✗${reset} Failed to install ${description}: directory is empty`);
      return false;
    }
  } catch (e) {
    console.error(`  ${yellow}✗${reset} Failed to install ${description}: ${e.message}`);
    return false;
  }
  return true;
}

/**
 * Verify a file exists
 */
function verifyFileInstalled(filePath, description) {
  if (!fs.existsSync(filePath)) {
    console.error(`  ${yellow}✗${reset} Failed to install ${description}: file not created`);
    return false;
  }
  return true;
}

/**
 * Install to the specified directory for a specific runtime
 * @param {boolean} isGlobal - Whether to install globally or locally
 * @param {string} runtime - Target runtime ('claude', 'opencode', 'gemini', 'codex')
 */

// ──────────────────────────────────────────────────────
// Local Patch Persistence
// ──────────────────────────────────────────────────────

const PATCHES_DIR_NAME = 'gsd-local-patches';
const MANIFEST_NAME = 'gsd-file-manifest.json';

/**
 * Compute SHA256 hash of file contents
 */
function fileHash(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Recursively collect all files in dir with their hashes
 */
function generateManifest(dir, baseDir) {
  if (!baseDir) baseDir = dir;
  const manifest = {};
  if (!fs.existsSync(dir)) return manifest;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
    if (entry.isDirectory()) {
      Object.assign(manifest, generateManifest(fullPath, baseDir));
    } else {
      manifest[relPath] = fileHash(fullPath);
    }
  }
  return manifest;
}

/**
 * Write file manifest after installation for future modification detection
 */
function writeManifest(configDir, runtime = 'claude', options = {}) {
  const isOpencode = runtime === 'opencode';
  const isKilo = runtime === 'kilo';
  const isGemini = runtime === 'gemini';
  const isCodex = runtime === 'codex';
  const isCopilot = runtime === 'copilot';
  const isAntigravity = runtime === 'antigravity';
  const isCursor = runtime === 'cursor';
  const isWindsurf = runtime === 'windsurf';
  const isTrae = runtime === 'trae';
  const isCline = runtime === 'cline';
  const isHermes = runtime === 'hermes';
  const gsdDir = path.join(configDir, 'get-shit-done');
  const commandsDir = path.join(configDir, 'commands', 'gsd');
  const opencodeCommandDir = path.join(configDir, 'command');
  // Hermes nests GSD skills under skills/gsd/ as a single category (#2841).
  // All other runtimes that use the Codex-style skills layout use a flat skills/ root.
  const codexSkillsDir = isHermes
    ? path.join(configDir, 'skills', 'gsd')
    : path.join(configDir, 'skills');
  const codexSkillsManifestPrefix = isHermes ? 'skills/gsd/' : 'skills/';
  const agentsDir = path.join(configDir, 'agents');
  const manifest = {
    version: pkg.version,
    timestamp: new Date().toISOString(),
    mode: options.mode === 'minimal' ? 'minimal' : 'full',
    files: {},
  };

  const gsdHashes = generateManifest(gsdDir);
  for (const [rel, hash] of Object.entries(gsdHashes)) {
    // Skip user-owned artifacts (e.g. USER-PROFILE.md). They are preserved
    // across reinstalls by preserveUserArtifacts and must NOT be hashed into
    // the manifest — otherwise saveLocalPatches() would flag every refresh
    // as a "local patch" (bug #2771). Single source of truth:
    // USER_OWNED_ARTIFACTS at top of file.
    if (USER_OWNED_ARTIFACTS.includes(rel)) continue;
    manifest.files['get-shit-done/' + rel] = hash;
  }
  // Record commands/gsd/ for any runtime that emits it (Gemini globally,
  // Claude Code locally — see #2923). Manifest must reflect everything on
  // disk so saveLocalPatches() can detect user edits and so per-runtime
  // assertions about minimal-mode emit can read manifest.files instead of
  // re-walking the dir.
  if (fs.existsSync(commandsDir)) {
    const cmdHashes = generateManifest(commandsDir);
    for (const [rel, hash] of Object.entries(cmdHashes)) {
      manifest.files['commands/gsd/' + rel] = hash;
    }
  }
  if ((isOpencode || isKilo) && fs.existsSync(opencodeCommandDir)) {
    for (const file of fs.readdirSync(opencodeCommandDir)) {
      if (file.startsWith('gsd-') && file.endsWith('.md')) {
        manifest.files['command/' + file] = fileHash(path.join(opencodeCommandDir, file));
      }
    }
  }
  if ((isCodex || isCopilot || isAntigravity || isCursor || isWindsurf || isTrae || (!isOpencode && !isGemini)) && fs.existsSync(codexSkillsDir)) {
    for (const skillName of listCodexSkillNames(codexSkillsDir)) {
      const skillRoot = path.join(codexSkillsDir, skillName);
      const skillHashes = generateManifest(skillRoot);
      for (const [rel, hash] of Object.entries(skillHashes)) {
        manifest.files[`${codexSkillsManifestPrefix}${skillName}/${rel}`] = hash;
      }
    }
    // For Hermes, also hash the category DESCRIPTION.md so reinstall detects drift.
    if (isHermes) {
      const descPath = path.join(codexSkillsDir, 'DESCRIPTION.md');
      if (fs.existsSync(descPath)) {
        manifest.files['skills/gsd/DESCRIPTION.md'] = fileHash(descPath);
      }
    }
  }
  if (fs.existsSync(agentsDir)) {
    for (const file of fs.readdirSync(agentsDir)) {
      if (file.startsWith('gsd-') && file.endsWith('.md')) {
        manifest.files['agents/' + file] = fileHash(path.join(agentsDir, file));
      }
    }
  }
  // Track .clinerules file in manifest for Cline installs
  if (isCline) {
    const clinerulesDest = path.join(configDir, '.clinerules');
    if (fs.existsSync(clinerulesDest)) {
      manifest.files['.clinerules'] = fileHash(clinerulesDest);
    }
  }

  // Track hook files so saveLocalPatches() can detect user modifications
  // Hooks are only installed for runtimes that use settings.json (not Codex/Copilot/Cline)
  if (!isCodex && !isCopilot && !isCline) {
    const hooksDir = path.join(configDir, 'hooks');
    if (fs.existsSync(hooksDir)) {
      for (const file of fs.readdirSync(hooksDir)) {
        if (file.startsWith('gsd-') && (file.endsWith('.js') || file.endsWith('.sh'))) {
          manifest.files['hooks/' + file] = fileHash(path.join(hooksDir, file));
        }
      }
    }
  }

  fs.writeFileSync(path.join(configDir, MANIFEST_NAME), JSON.stringify(manifest, null, 2));
  return manifest;
}

/**
 * Populate gsd-pristine/ with the transformed pristine versions of every
 * `modified` file, derived from the current package's source tree by
 * running the install transform pipeline (`copyWithPathReplacement`)
 * into a tmp directory, then copying out only the relevant paths.
 *
 * Pristine semantically represents "what the install would write to
 * configDir/<relPath> if the user had not modified it." This is what the
 * /gsd-reapply-patches Step 5 verifier (#2972) uses as the diff base
 * for "user-added lines" — lines in the user's backup that are NOT in
 * the pristine baseline. Without this dir, the verifier degrades to its
 * over-broad fallback ("every significant backup line"), exactly the
 * silent-success-on-lost-content failure mode #2969 was designed to
 * prevent (#2998).
 *
 * Implementation note: we run the FULL transform pipeline against a tmp
 * staging dir (one-time, only when modified.length > 0), then copy out
 * just the modified paths. This re-uses the existing transform code
 * exactly — pristine is byte-identical to what `copyWithPathReplacement`
 * would have written under normal install. Cost: one extra full transform
 * pass per install where local patches were detected; acceptable.
 */
function populatePristineDir({ packageSrc, pristineDir, modified, runtime, pathPrefix, isGlobal }) {
  if (!modified || modified.length === 0) return 0;
  // Modified paths come from manifest.files which can live under several
  // install roots: get-shit-done/, commands/gsd/, command/, skills/, agents/,
  // hooks/, plus runtime-specific root files (#3004 CR). Stage every
  // top-level dir that actually contains a modified path; root-level files
  // are copied directly without the transform pipeline (they don't need
  // path replacement).
  const stageRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-pristine-stage-'));
  let written = 0;
  try {
    const topLevels = new Set();
    for (const relPath of modified) {
      const norm = relPath.replace(/\\/g, '/');
      const slash = norm.indexOf('/');
      topLevels.add(slash === -1 ? '' : norm.slice(0, slash));
    }

    for (const top of topLevels) {
      if (top === '') {
        // Root-level files — copy directly from package source. The transform
        // pipeline is directory-oriented; root files don't need path-prefix
        // substitution (they're not markdown content with embedded paths).
        for (const relPath of modified) {
          const norm = relPath.replace(/\\/g, '/');
          if (norm.includes('/')) continue;
          const src = path.join(packageSrc, relPath);
          if (!fs.existsSync(src)) continue;
          const stagedFile = path.join(stageRoot, relPath);
          fs.mkdirSync(path.dirname(stagedFile), { recursive: true });
          fs.copyFileSync(src, stagedFile);
        }
        continue;
      }
      const srcDir = path.join(packageSrc, top);
      const stageDir = path.join(stageRoot, top);
      if (!fs.existsSync(srcDir)) continue;
      copyWithPathReplacement(srcDir, stageDir, pathPrefix, runtime, false, isGlobal);
    }

    for (const relPath of modified) {
      // Only populate pristine for paths we successfully staged. If a path's
      // source dir does not exist (obsolete manifest entry), skip silently
      // rather than corrupting pristine with stale data.
      const stagedPath = path.join(stageRoot, relPath);
      if (!fs.existsSync(stagedPath)) continue;
      const out = path.join(pristineDir, relPath);
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.copyFileSync(stagedPath, out);
      written++;
    }
  } finally {
    try { fs.rmSync(stageRoot, { recursive: true, force: true }); } catch { /* best-effort cleanup */ }
  }
  return written;
}

/**
 * Detect user-modified GSD files by comparing against install manifest.
 * Backs up modified files to gsd-local-patches/ for reapply after update.
 * Also saves pristine copies (from manifest) to gsd-pristine/ to enable
 * three-way merge during reapply-patches (pristine vs user vs new).
 *
 * The optional `pristineCtx` parameter (set by the install entry point)
 * carries the source package root, runtime, pathPrefix, and isGlobal
 * needed to populate gsd-pristine/. If omitted (legacy callers), pristine
 * stays empty — the verifier falls back to its over-broad heuristic, same
 * behavior as before #2998.
 */
function saveLocalPatches(configDir, pristineCtx) {
  const manifestPath = path.join(configDir, MANIFEST_NAME);
  if (!fs.existsSync(manifestPath)) return [];

  let manifest;
  try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); } catch { return []; }

  // Normalize legacy manifests written before #2771 fix: strip user-owned artifacts
  // that were incorrectly recorded so refreshes don't surface false patches warnings.
  if (manifest.files) {
    for (const artifact of USER_OWNED_ARTIFACTS) {
      delete manifest.files[`get-shit-done/${artifact}`];
    }
  }

  const patchesDir = path.join(configDir, PATCHES_DIR_NAME);
  const pristineDir = path.join(configDir, 'gsd-pristine');
  const modified = [];

  for (const [relPath, originalHash] of Object.entries(manifest.files || {})) {
    const fullPath = path.join(configDir, relPath);
    if (!fs.existsSync(fullPath)) continue;
    const currentHash = fileHash(fullPath);
    if (currentHash !== originalHash) {
      // Back up the user's modified version
      const backupPath = path.join(patchesDir, relPath);
      fs.mkdirSync(path.dirname(backupPath), { recursive: true });
      fs.copyFileSync(fullPath, backupPath);
      modified.push(relPath);
    }
  }

  // Save pristine copies of modified files from the CURRENT install (before wipe).
  // Pristine semantically represents "what the install would write to configDir
  // if the user had not modified it" — used by /gsd-reapply-patches Step 5
  // (#2972) as the diff baseline for the user-added-lines computation. Without
  // this dir the verifier degrades to its over-broad fallback heuristic (#2998).
  if (modified.length > 0) {
    const meta = {
      backed_up_at: new Date().toISOString(),
      from_version: manifest.version,
      from_manifest_timestamp: manifest.timestamp,
      files: modified,
      pristine_hashes: {}
    };
    // Record the original (pristine) hash for each modified file
    // This lets the reapply workflow verify reconstructed pristine files
    for (const relPath of modified) {
      meta.pristine_hashes[relPath] = manifest.files[relPath];
    }
    fs.writeFileSync(path.join(patchesDir, 'backup-meta.json'), JSON.stringify(meta, null, 2));
    console.log('  ' + yellow + 'i' + reset + '  Found ' + modified.length + ' locally modified GSD file(s) — backed up to ' + PATCHES_DIR_NAME + '/');
    for (const f of modified) {
      console.log('     ' + dim + f + reset);
    }

    // #2998: populate gsd-pristine/ via the install transform pipeline so the
    // reapply-patches verifier (#2972) gets a real diff baseline instead of
    // falling back to its over-broad "every significant backup line" heuristic.
    if (pristineCtx) {
      // #3004 CR: wipe any pre-existing pristine content BEFORE populating
      // (and again in the catch path). Without this, a previous run's stale
      // pristine could be picked up by the verifier as if it were the
      // baseline for THIS modified set, causing a misleading three-way diff.
      try { fs.rmSync(pristineDir, { recursive: true, force: true }); } catch { /* not present */ }
      try {
        const written = populatePristineDir({
          packageSrc: pristineCtx.packageSrc,
          pristineDir,
          modified,
          runtime: pristineCtx.runtime,
          pathPrefix: pristineCtx.pathPrefix,
          isGlobal: pristineCtx.isGlobal,
        });
        if (written > 0) {
          console.log('  ' + green + '✓' + reset + '  Populated ' + cyan + 'gsd-pristine/' + reset + ' (' + written + ' file(s)) for three-way merge');
        }
      } catch (err) {
        // Soft failure: keep the install moving even if the transform pipeline
        // throws on an unusual configuration. Wipe the partial pristine so the
        // verifier falls back cleanly to its pre-#2998 heuristic instead of
        // reading half-populated data (#3004 CR).
        try { fs.rmSync(pristineDir, { recursive: true, force: true }); } catch { /* best-effort */ }
        console.log('  ' + yellow + 'i' + reset + '  Could not populate gsd-pristine/ (' + (err && err.message ? err.message : 'unknown') + '). Falls back to over-broad verify heuristic.');
      }
    }
  }
  return modified;
}

/**
 * After install, report backed-up patches for user to reapply.
 */
function reportLocalPatches(configDir, runtime = 'claude') {
  const patchesDir = path.join(configDir, PATCHES_DIR_NAME);
  const metaPath = path.join(patchesDir, 'backup-meta.json');
  if (!fs.existsSync(metaPath)) return [];

  let meta;
  try { meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')); } catch { return []; }

  if (meta.files && meta.files.length > 0) {
    const reapplyCommand = (runtime === 'opencode' || runtime === 'kilo' || runtime === 'copilot')
      ? '/gsd-update --reapply'
      : runtime === 'gemini'
        ? '/gsd:update --reapply'
        : runtime === 'codex'
          ? '$gsd-update --reapply'
        : runtime === 'cursor'
          ? 'gsd-update --reapply (mention the skill name)'
          : '/gsd-update --reapply';
    console.log('');
    console.log('  ' + yellow + 'Local patches detected' + reset + ' (from v' + meta.from_version + '):');
    for (const f of meta.files) {
      console.log('     ' + cyan + f + reset);
    }
    console.log('');
    console.log('  Your modifications are saved in ' + cyan + PATCHES_DIR_NAME + '/' + reset);
    console.log('  Run ' + cyan + reapplyCommand + reset + ' to merge them into the new version.');
    console.log('  Or manually compare and merge the files.');
    console.log('');
  }
  return meta.files || [];
}

function install(isGlobal, runtime = 'claude') {
  const isOpencode = runtime === 'opencode';
  const isGemini = runtime === 'gemini';
  const isKilo = runtime === 'kilo';
  const isCodex = runtime === 'codex';
  const isCopilot = runtime === 'copilot';
  const isAntigravity = runtime === 'antigravity';
  const isCursor = runtime === 'cursor';
  const isWindsurf = runtime === 'windsurf';
  const isAugment = runtime === 'augment';
  const isTrae = runtime === 'trae';
  const isQwen = runtime === 'qwen';
  const isHermes = runtime === 'hermes';
  const isCodebuddy = runtime === 'codebuddy';
  const isCline = runtime === 'cline';
  const dirName = getDirName(runtime);
  const src = path.join(__dirname, '..');

  // Get the target directory based on runtime and install type.
  // Cline local installs write to the project root (like Claude Code) — .clinerules
  // lives at the root, not inside a .cline/ subdirectory.
  const targetDir = isGlobal
    ? getGlobalDir(runtime, explicitConfigDir)
    : isCline
      ? process.cwd()
      : path.join(process.cwd(), dirName);

  const locationLabel = isGlobal
    ? targetDir.replace(os.homedir(), '~')
    : targetDir.replace(process.cwd(), '.');

  // Path prefix for file references in markdown content (e.g. gsd-tools.cjs).
  // Replaces $HOME/.claude/ or ~/.claude/ so the result is <pathPrefix>get-shit-done/bin/...
  // For global installs: use $HOME/ so paths expand correctly inside double-quoted
  // shell commands (~ does NOT expand inside double quotes, causing MODULE_NOT_FOUND).
  // For local installs: use resolved absolute path (may be outside $HOME).
  // Exception: OpenCode does not expand $HOME in @file references on any platform —
  // `@$HOME/...` is treated as a literal path relative to the config dir, producing
  // `command/$HOME/...` (file not found). Use the absolute path for OpenCode so
  // @-references resolve correctly (#2376 Windows, #2831 macOS/Linux).
  const resolvedTarget = path.resolve(targetDir).replace(/\\/g, '/');
  const homeDir = os.homedir().replace(/\\/g, '/');
  const isWindowsHost = process.platform === 'win32';
  const pathPrefix = computePathPrefix({
    isGlobal,
    isOpencode,
    isWindowsHost,
    resolvedTarget,
    homeDir,
  });

  let runtimeLabel = 'Claude Code';
  if (isOpencode) runtimeLabel = 'OpenCode';
  if (isGemini) runtimeLabel = 'Gemini';
  if (isKilo) runtimeLabel = 'Kilo';
  if (isCodex) runtimeLabel = 'Codex';
  if (isCopilot) runtimeLabel = 'Copilot';
  if (isAntigravity) runtimeLabel = 'Antigravity';
  if (isCursor) runtimeLabel = 'Cursor';
  if (isWindsurf) runtimeLabel = 'Windsurf';
  if (isAugment) runtimeLabel = 'Augment';
  if (isTrae) runtimeLabel = 'Trae';
  if (isQwen) runtimeLabel = 'Qwen Code';
  if (isHermes) runtimeLabel = 'Hermes Agent';
  if (isCodebuddy) runtimeLabel = 'CodeBuddy';
  if (isCline) runtimeLabel = 'Cline';

  console.log(`  Installing for ${cyan}${runtimeLabel}${reset} to ${cyan}${locationLabel}${reset}\n`);

  // Track installation failures
  const failures = [];

  // Save any locally modified GSD files before they get wiped.
  // The pristine context lets saveLocalPatches populate gsd-pristine/ via
  // the install transform pipeline, giving the reapply-patches Step 5
  // verifier a real diff baseline (#2998).
  saveLocalPatches(targetDir, {
    packageSrc: src,
    runtime,
    pathPrefix,
    isGlobal,
  });

  // Clean up orphaned files from previous versions
  cleanupOrphanedFiles(targetDir);

  // OpenCode/Kilo use command/ (flat), Codex uses skills/, Claude/Gemini use commands/gsd/
  if (isOpencode || isKilo) {
    // OpenCode/Kilo: flat structure in command/ directory
    const commandDir = path.join(targetDir, 'command');
    fs.mkdirSync(commandDir, { recursive: true });

    // Copy commands/gsd/*.md as command/gsd-*.md (flatten structure)
    const gsdSrc = stageSkillsForMode(path.join(src, 'commands', 'gsd'), installMode);
    copyFlattenedCommands(gsdSrc, commandDir, 'gsd', pathPrefix, runtime);
    if (verifyInstalled(commandDir, 'command/gsd-*')) {
      const count = fs.readdirSync(commandDir).filter(f => f.startsWith('gsd-')).length;
      console.log(`  ${green}✓${reset} Installed ${count} commands to command/`);
    } else {
      failures.push('command/gsd-*');
    }
  } else if (isCodex) {
    const skillsDir = path.join(targetDir, 'skills');
    const gsdSrc = stageSkillsForMode(path.join(src, 'commands', 'gsd'), installMode);
    copyCommandsAsCodexSkills(gsdSrc, skillsDir, 'gsd', pathPrefix, runtime);
    const installedSkillNames = listCodexSkillNames(skillsDir);
    if (installedSkillNames.length > 0) {
      console.log(`  ${green}✓${reset} Installed ${installedSkillNames.length} skills to skills/`);
    } else {
      failures.push('skills/gsd-*');
    }
  } else if (isCopilot) {
    const skillsDir = path.join(targetDir, 'skills');
    const gsdSrc = stageSkillsForMode(path.join(src, 'commands', 'gsd'), installMode);
    copyCommandsAsCopilotSkills(gsdSrc, skillsDir, 'gsd', isGlobal);
    if (fs.existsSync(skillsDir)) {
      const count = fs.readdirSync(skillsDir, { withFileTypes: true })
        .filter(e => e.isDirectory() && e.name.startsWith('gsd-')).length;
      if (count > 0) {
        console.log(`  ${green}✓${reset} Installed ${count} skills to skills/`);
      } else {
        failures.push('skills/gsd-*');
      }
    } else {
      failures.push('skills/gsd-*');
    }
  } else if (isAntigravity) {
    const skillsDir = path.join(targetDir, 'skills');
    const gsdSrc = stageSkillsForMode(path.join(src, 'commands', 'gsd'), installMode);
    copyCommandsAsAntigravitySkills(gsdSrc, skillsDir, 'gsd', isGlobal);
    if (fs.existsSync(skillsDir)) {
      const count = fs.readdirSync(skillsDir, { withFileTypes: true })
        .filter(e => e.isDirectory() && e.name.startsWith('gsd-')).length;
      if (count > 0) {
        console.log(`  ${green}✓${reset} Installed ${count} skills to skills/`);
      } else {
        failures.push('skills/gsd-*');
      }
    } else {
      failures.push('skills/gsd-*');
    }
  } else if (isCursor) {
    const skillsDir = path.join(targetDir, 'skills');
    const gsdSrc = stageSkillsForMode(path.join(src, 'commands', 'gsd'), installMode);
    copyCommandsAsCursorSkills(gsdSrc, skillsDir, 'gsd', pathPrefix, runtime);
    const installedSkillNames = listCodexSkillNames(skillsDir); // reuse — same dir structure
    if (installedSkillNames.length > 0) {
      console.log(`  ${green}✓${reset} Installed ${installedSkillNames.length} skills to skills/`);
    } else {
      failures.push('skills/gsd-*');
    }
  } else if (isWindsurf) {
    const skillsDir = path.join(targetDir, 'skills');
    const gsdSrc = stageSkillsForMode(path.join(src, 'commands', 'gsd'), installMode);
    copyCommandsAsWindsurfSkills(gsdSrc, skillsDir, 'gsd', pathPrefix, runtime);
    const installedSkillNames = listCodexSkillNames(skillsDir); // reuse — same dir structure
    if (installedSkillNames.length > 0) {
      console.log(`  ${green}✓${reset} Installed ${installedSkillNames.length} skills to skills/`);
    } else {
      failures.push('skills/gsd-*');
    }
  } else if (isAugment) {
    const skillsDir = path.join(targetDir, 'skills');
    const gsdSrc = stageSkillsForMode(path.join(src, 'commands', 'gsd'), installMode);
    copyCommandsAsAugmentSkills(gsdSrc, skillsDir, 'gsd', pathPrefix, runtime);
    const installedSkillNames = listCodexSkillNames(skillsDir);
    if (installedSkillNames.length > 0) {
      console.log(`  ${green}✓${reset} Installed ${installedSkillNames.length} skills to skills/`);
    } else {
      failures.push('skills/gsd-*');
    }
  } else if (isTrae) {
    const skillsDir = path.join(targetDir, 'skills');
    const gsdSrc = stageSkillsForMode(path.join(src, 'commands', 'gsd'), installMode);
    copyCommandsAsTraeSkills(gsdSrc, skillsDir, 'gsd', pathPrefix, runtime);
    const installedSkillNames = listCodexSkillNames(skillsDir);
    if (installedSkillNames.length > 0) {
      console.log(`  ${green}✓${reset} Installed ${installedSkillNames.length} skills to skills/`);
    } else {
      failures.push('skills/gsd-*');
    }
  } else if (isQwen) {
    const skillsDir = path.join(targetDir, 'skills');
    const gsdSrc = stageSkillsForMode(path.join(src, 'commands', 'gsd'), installMode);
    copyCommandsAsClaudeSkills(gsdSrc, skillsDir, 'gsd', pathPrefix, runtime, isGlobal);
    if (fs.existsSync(skillsDir)) {
      const count = fs.readdirSync(skillsDir, { withFileTypes: true })
        .filter(e => e.isDirectory() && e.name.startsWith('gsd-')).length;
      if (count > 0) {
        console.log(`  ${green}✓${reset} Installed ${count} skills to skills/`);
      } else {
        failures.push('skills/gsd-*');
      }
    } else {
      failures.push('skills/gsd-*');
    }

    const legacyCommandsDir = path.join(targetDir, 'commands', 'gsd');
    if (fs.existsSync(legacyCommandsDir)) {
      const savedLegacyArtifacts = preserveUserArtifacts(legacyCommandsDir, ['dev-preferences.md']);
      fs.rmSync(legacyCommandsDir, { recursive: true });
      console.log(`  ${green}✓${reset} Removed legacy commands/gsd/ directory`);
      // #2973: also migrate dev-preferences.md content into the new
      // skills/gsd-dev-preferences/SKILL.md location (skills-aware runtimes).
      // This prevents the legacy file from being orphaned after the writer
      // starts targeting the skills path. No-op if SKILL.md already exists.
      restoreUserArtifacts(legacyCommandsDir, savedLegacyArtifacts);
      if (migrateLegacyDevPreferencesToSkill(targetDir, savedLegacyArtifacts)) {
        console.log(`  ${green}✓${reset} Migrated dev-preferences.md → skills/gsd-dev-preferences/SKILL.md (#2973)`);
      }
    }
  } else if (isHermes) {
    // Hermes Agent: nests all GSD skills under skills/gsd/ as a single
    // category (per spec in #2841) so the 86 gsd-* skills collapse into a
    // single entry in Hermes' system prompt instead of 86 top-level entries.
    // The Claude skill pipeline writes each gsd-<cmd>/SKILL.md inside the
    // gsd/ category dir, alongside a DESCRIPTION.md that Hermes uses as the
    // category summary.
    const hermesSkillsDir = path.join(targetDir, 'skills', 'gsd');
    const gsdSrc = stageSkillsForMode(path.join(src, 'commands', 'gsd'), installMode);
    copyCommandsAsClaudeSkills(gsdSrc, hermesSkillsDir, 'gsd', pathPrefix, runtime, isGlobal);
    writeHermesCategoryDescription(hermesSkillsDir);
    if (fs.existsSync(hermesSkillsDir)) {
      const count = fs.readdirSync(hermesSkillsDir, { withFileTypes: true })
        .filter(e => e.isDirectory() && e.name.startsWith('gsd-')).length;
      if (count > 0) {
        console.log(`  ${green}✓${reset} Installed ${count} skills to skills/gsd/`);
      } else {
        failures.push('skills/gsd/gsd-*');
      }
    } else {
      failures.push('skills/gsd/gsd-*');
    }

    // Migrate any prior flat-layout install (skills/gsd-*/) into the nested
    // skills/gsd/ category — keeps existing users from carrying duplicates
    // after upgrading to the nested layout.
    const flatSkillsDir = path.join(targetDir, 'skills');
    if (fs.existsSync(flatSkillsDir)) {
      const stale = fs.readdirSync(flatSkillsDir, { withFileTypes: true })
        .filter(e => e.isDirectory() && e.name.startsWith('gsd-'));
      for (const entry of stale) {
        fs.rmSync(path.join(flatSkillsDir, entry.name), { recursive: true });
      }
    }

    const legacyCommandsDir = path.join(targetDir, 'commands', 'gsd');
    if (fs.existsSync(legacyCommandsDir)) {
      const savedLegacyArtifacts = preserveUserArtifacts(legacyCommandsDir, ['dev-preferences.md']);
      fs.rmSync(legacyCommandsDir, { recursive: true });
      console.log(`  ${green}✓${reset} Removed legacy commands/gsd/ directory`);
      // #2973: also migrate dev-preferences.md content into the new
      // skills/gsd-dev-preferences/SKILL.md location (skills-aware runtimes).
      // This prevents the legacy file from being orphaned after the writer
      // starts targeting the skills path. No-op if SKILL.md already exists.
      restoreUserArtifacts(legacyCommandsDir, savedLegacyArtifacts);
      if (migrateLegacyDevPreferencesToSkill(targetDir, savedLegacyArtifacts)) {
        console.log(`  ${green}✓${reset} Migrated dev-preferences.md → skills/gsd-dev-preferences/SKILL.md (#2973)`);
      }
    }
  } else if (isCodebuddy) {
    const skillsDir = path.join(targetDir, 'skills');
    const gsdSrc = stageSkillsForMode(path.join(src, 'commands', 'gsd'), installMode);
    copyCommandsAsCodebuddySkills(gsdSrc, skillsDir, 'gsd', pathPrefix, runtime);
    const installedSkillNames = listCodexSkillNames(skillsDir);
    if (installedSkillNames.length > 0) {
      console.log(`  ${green}✓${reset} Installed ${installedSkillNames.length} skills to skills/`);
    } else {
      failures.push('skills/gsd-*');
    }
  } else if (isCline) {
    // Cline is rules-based — commands are embedded in .clinerules (generated below).
    // No skills/commands directory needed. Engine is installed via copyWithPathReplacement.
    console.log(`  ${green}✓${reset} Cline: commands will be available via .clinerules`);
  } else if (isGemini) {
    // #3037: when running --local --gemini and a GSD-managed user-scope
    // command directory already exists at ~/.gemini/commands/gsd/, skip
    // the local copy. Gemini conflict-detects by command name across
    // scopes and renames every overlapping /gsd:* command to
    // /workspace.gsd:* and /user.gsd:*, breaking the documented namespace.
    // The user-scope install already provides the same commands, so the
    // local copy adds zero value at the cost of namespace conflicts.
    //
    // CR #3041 (Major): the detection must be specific to PACKAGE-MANAGED
    // GSD content, not just "directory is non-empty". A user who hand-
    // dropped a single override (e.g. ~/.gemini/commands/gsd/my-override
    // .toml) would otherwise be unable to run a local install at all.
    // Detection rule: at least 3 of the canonical GSD command files
    // ('help.toml', 'progress.toml', 'new-project.toml') must be present.
    // These three ship in every GSD Gemini install (minimal mode included
    // — they're in the core skill set per #2790's consolidation), and 3-of-
    // 3 with that specific basename set is structurally impossible to
    // produce by accident.
    const homeGeminiGsd = path.join(os.homedir(), '.gemini', 'commands', 'gsd');
    const GSD_MANAGED_CANARIES = ['help.toml', 'progress.toml', 'new-project.toml'];
    const userScopeHasGsd =
      !isGlobal &&
      path.resolve(targetDir) !== path.resolve(path.join(os.homedir(), '.gemini')) &&
      fs.existsSync(homeGeminiGsd) &&
      GSD_MANAGED_CANARIES.every((f) =>
        fs.existsSync(path.join(homeGeminiGsd, f))
      );

    if (userScopeHasGsd) {
      console.log(
        `  ${yellow}⚠${reset}  Skipping commands/gsd/ for local install — GSD is already installed at user scope (${homeGeminiGsd}).`
      );
      console.log(
        `      Gemini conflict-detects across scopes and would rename every /gsd:* command to /workspace.gsd:* and /user.gsd:*.`
      );
      console.log(
        `      The user-scope install already provides /gsd:* commands in this project; no local copy is needed.`
      );
    } else {
      const commandsDir = path.join(targetDir, 'commands');
      fs.mkdirSync(commandsDir, { recursive: true });
      const gsdSrc = stageSkillsForMode(path.join(src, 'commands', 'gsd'), installMode);
      const gsdDest = path.join(commandsDir, 'gsd');
      copyWithPathReplacement(gsdSrc, gsdDest, pathPrefix, runtime, true, isGlobal);
      if (verifyInstalled(gsdDest, 'commands/gsd')) {
        console.log(`  ${green}✓${reset} Installed commands/gsd`);
      } else {
        failures.push('commands/gsd');
      }
    }
  } else if (isGlobal) {
    // Claude Code global: skills/ format (2.1.88+ compatibility)
    const skillsDir = path.join(targetDir, 'skills');
    const gsdSrc = stageSkillsForMode(path.join(src, 'commands', 'gsd'), installMode);
    copyCommandsAsClaudeSkills(gsdSrc, skillsDir, 'gsd', pathPrefix, runtime, isGlobal);
    if (fs.existsSync(skillsDir)) {
      const count = fs.readdirSync(skillsDir, { withFileTypes: true })
        .filter(e => e.isDirectory() && e.name.startsWith('gsd-')).length;
      if (count > 0) {
        console.log(`  ${green}✓${reset} Installed ${count} skills to skills/`);
      } else {
        failures.push('skills/gsd-*');
      }
    } else {
      failures.push('skills/gsd-*');
    }

    // Clean up legacy commands/gsd/ from previous global installs
    // Preserve user-generated files (dev-preferences.md) before wiping the directory
    const legacyCommandsDir = path.join(targetDir, 'commands', 'gsd');
    if (fs.existsSync(legacyCommandsDir)) {
      const savedLegacyArtifacts = preserveUserArtifacts(legacyCommandsDir, ['dev-preferences.md']);
      fs.rmSync(legacyCommandsDir, { recursive: true });
      console.log(`  ${green}✓${reset} Removed legacy commands/gsd/ directory`);
      // #2973: also migrate dev-preferences.md content into the new
      // skills/gsd-dev-preferences/SKILL.md location (skills-aware runtimes).
      // This prevents the legacy file from being orphaned after the writer
      // starts targeting the skills path. No-op if SKILL.md already exists.
      restoreUserArtifacts(legacyCommandsDir, savedLegacyArtifacts);
      if (migrateLegacyDevPreferencesToSkill(targetDir, savedLegacyArtifacts)) {
        console.log(`  ${green}✓${reset} Migrated dev-preferences.md → skills/gsd-dev-preferences/SKILL.md (#2973)`);
      }
    }
  } else {
    // Claude Code local: commands/gsd/ format — Claude Code reads local project
    // commands from .claude/commands/gsd/, not .claude/skills/
    const commandsDir = path.join(targetDir, 'commands');
    fs.mkdirSync(commandsDir, { recursive: true });
    const gsdSrc = stageSkillsForMode(path.join(src, 'commands', 'gsd'), installMode);
    const gsdDest = path.join(commandsDir, 'gsd');
    copyWithPathReplacement(gsdSrc, gsdDest, pathPrefix, runtime, true, isGlobal);
    if (verifyInstalled(gsdDest, 'commands/gsd')) {
      const count = fs.readdirSync(gsdDest).filter(f => f.endsWith('.md')).length;
      console.log(`  ${green}✓${reset} Installed ${count} commands to commands/gsd/`);
    } else {
      failures.push('commands/gsd');
    }

    // Clean up any stale skills/ from a previous local install
    const staleSkillsDir = path.join(targetDir, 'skills');
    if (fs.existsSync(staleSkillsDir)) {
      const staleGsd = fs.readdirSync(staleSkillsDir, { withFileTypes: true })
        .filter(e => e.isDirectory() && e.name.startsWith('gsd-'));
      for (const e of staleGsd) {
        fs.rmSync(path.join(staleSkillsDir, e.name), { recursive: true });
      }
      if (staleGsd.length > 0) {
        console.log(`  ${green}✓${reset} Removed ${staleGsd.length} stale GSD skill(s) from skills/`);
      }
    }
  }

  // Copy get-shit-done skill with path replacement
  // Preserve user-generated files before the wipe-and-copy so they survive re-install
  const skillSrc = path.join(src, 'get-shit-done');
  const skillDest = path.join(targetDir, 'get-shit-done');
  const savedGsdArtifacts = preserveUserArtifacts(skillDest, USER_OWNED_ARTIFACTS);
  copyWithPathReplacement(skillSrc, skillDest, pathPrefix, runtime, false, isGlobal);
  restoreUserArtifacts(skillDest, savedGsdArtifacts);
  if (verifyInstalled(skillDest, 'get-shit-done')) {
    console.log(`  ${green}✓${reset} Installed get-shit-done`);
  } else {
    failures.push('get-shit-done');
  }

  // Copy agents to agents directory.
  // Skipped under --minimal: gsd-* subagent descriptions are eagerly loaded
  // into the runtime's Agent tool schema, costing ~6k tokens per turn even
  // when no GSD workflow is active. See gsd-build/get-shit-done#2762.
  const agentsSrc = path.join(src, 'agents');
  const agentsDest = path.join(targetDir, 'agents');

  // Always remove stale gsd-* agents first so re-installing with
  // `--minimal` actually shrinks a previously-full install.
  // For Codex this also covers per-agent `.toml` files alongside the `.md`
  // sources so a full → minimal switch doesn't leave stale registrations.
  if (fs.existsSync(agentsDest)) {
    for (const file of fs.readdirSync(agentsDest)) {
      if (
        file.startsWith('gsd-') &&
        (file.endsWith('.md') || (isCodex && file.endsWith('.toml')))
      ) {
        fs.unlinkSync(path.join(agentsDest, file));
      }
    }
  }

  if (isMinimalMode(installMode)) {
    // Codex registers agents in `config.toml` via `[agents.gsd-*]` sections.
    // Without stripping them here, a full → minimal reinstall would leave the
    // runtime advertising the old full agent surface even though the agent
    // files are gone. Reuse the same helper that powers `--uninstall`.
    if (isCodex) {
      const codexConfigPath = path.join(targetDir, 'config.toml');
      if (fs.existsSync(codexConfigPath)) {
        const existing = fs.readFileSync(codexConfigPath, 'utf8');
        const cleaned = stripGsdFromCodexConfig(existing);
        if (cleaned === null) {
          fs.unlinkSync(codexConfigPath);
        } else if (cleaned !== existing) {
          fs.writeFileSync(codexConfigPath, cleaned);
        }
      }
    }
    console.log(`  ${dim}↳${reset} Skipping agents (minimal install — run \`gsd update\` without \`--minimal\` to add full surface)`);
  } else if (fs.existsSync(agentsSrc)) {
    fs.mkdirSync(agentsDest, { recursive: true });

    // Copy new agents
    const agentEntries = fs.readdirSync(agentsSrc, { withFileTypes: true });
    for (const entry of agentEntries) {
      if (entry.isFile() && entry.name.endsWith('.md')) {
        let content = fs.readFileSync(path.join(agentsSrc, entry.name), 'utf8');
        // Replace ~/.claude/ and $HOME/.claude/ as they are the source of truth in the repo
        const dirRegex = /~\/\.claude\//g;
        const homeDirRegex = /\$HOME\/\.claude\//g;
        const bareDirRegex = /~\/\.claude\b/g;
        const bareHomeDirRegex = /\$HOME\/\.claude\b/g;
        const normalizedPathPrefix = pathPrefix.replace(/\/$/, '');
        if (!isCopilot && !isAntigravity) {
          content = content.replace(dirRegex, pathPrefix);
          content = content.replace(homeDirRegex, pathPrefix);
          content = content.replace(bareDirRegex, normalizedPathPrefix);
          content = content.replace(bareHomeDirRegex, normalizedPathPrefix);
        }
        content = processAttribution(content, getCommitAttribution(runtime));
        // Convert frontmatter for runtime compatibility (agents need different handling)
        if (isOpencode) {
          // Resolve per-agent model for OpenCode agents.
          // Precedence: model_overrides[agent] > model_profile_overrides.opencode.<tier> > omit.
          // model_overrides (#2256): explicit per-agent override, highest precedence.
          // model_profile_overrides (#2794): tier-based runtime resolver, same parity as Codex.
          const _ocAgentName = entry.name.replace(/\.md$/, '');
          const _ocModelOverrides = readGsdEffectiveModelOverrides(targetDir);
          let _ocModelOverride = _ocModelOverrides?.[_ocAgentName] || null;
          if (!_ocModelOverride) {
            // Fall back to tier-based resolution via model_profile_overrides.opencode.<tier>.
            const _ocRuntimeResolver = readGsdRuntimeProfileResolver(targetDir);
            if (_ocRuntimeResolver) {
              const _ocEntry = _ocRuntimeResolver.resolve(_ocAgentName);
              if (_ocEntry?.model) {
                _ocModelOverride = _ocEntry.model;
              }
            }
          }
          content = convertClaudeToOpencodeFrontmatter(content, { isAgent: true, modelOverride: _ocModelOverride });
        } else if (isKilo) {
          content = convertClaudeToKiloFrontmatter(content, { isAgent: true });
        } else if (isGemini) {
          content = convertClaudeToGeminiAgent(content);
        } else if (isCodex) {
          content = convertClaudeAgentToCodexAgent(content);
        } else if (isCopilot) {
          content = convertClaudeAgentToCopilotAgent(content, isGlobal);
        } else if (isAntigravity) {
          content = convertClaudeAgentToAntigravityAgent(content, isGlobal);
        } else if (isCursor) {
          content = convertClaudeAgentToCursorAgent(content);
        } else if (isWindsurf) {
          content = convertClaudeAgentToWindsurfAgent(content);
        } else if (isAugment) {
          content = convertClaudeAgentToAugmentAgent(content);
        } else if (isTrae) {
          content = convertClaudeAgentToTraeAgent(content);
        } else if (isCodebuddy) {
          content = convertClaudeAgentToCodebuddyAgent(content);
        } else if (isCline) {
          content = convertClaudeAgentToClineAgent(content);
        } else if (isQwen) {
          content = content.replace(/CLAUDE\.md/g, 'QWEN.md');
          content = content.replace(/\bClaude Code\b/g, 'Qwen Code');
          content = content.replace(/\.claude\//g, '.qwen/');
        } else if (isHermes) {
          content = content.replace(/CLAUDE\.md/g, 'HERMES.md');
          content = content.replace(/\bClaude Code\b/g, 'Hermes Agent');
          content = content.replace(/\.claude\//g, '.hermes/');
        }
        const destName = isCopilot ? entry.name.replace('.md', '.agent.md') : entry.name;
        fs.writeFileSync(path.join(agentsDest, destName), content);
      }
    }
    if (verifyInstalled(agentsDest, 'agents')) {
      console.log(`  ${green}✓${reset} Installed agents`);
    } else {
      failures.push('agents');
    }
  }

  // Copy CHANGELOG.md
  const changelogSrc = path.join(src, 'CHANGELOG.md');
  const changelogDest = path.join(targetDir, 'get-shit-done', 'CHANGELOG.md');
  if (fs.existsSync(changelogSrc)) {
    fs.copyFileSync(changelogSrc, changelogDest);
    if (verifyFileInstalled(changelogDest, 'CHANGELOG.md')) {
      console.log(`  ${green}✓${reset} Installed CHANGELOG.md`);
    } else {
      failures.push('CHANGELOG.md');
    }
  }

  // Write VERSION file
  const versionDest = path.join(targetDir, 'get-shit-done', 'VERSION');
  fs.writeFileSync(versionDest, pkg.version);
  if (verifyFileInstalled(versionDest, 'VERSION')) {
    console.log(`  ${green}✓${reset} Wrote VERSION (${pkg.version})`);
  } else {
    failures.push('VERSION');
  }

  if (!isCodex && !isCopilot && !isCursor && !isWindsurf && !isTrae && !isCline) {
    // Write package.json to force CommonJS mode for GSD scripts
    // Prevents "require is not defined" errors when project has "type": "module"
    // Node.js walks up looking for package.json - this stops inheritance from project
    const pkgJsonDest = path.join(targetDir, 'package.json');
    fs.writeFileSync(pkgJsonDest, '{"type":"commonjs"}\n');
    console.log(`  ${green}✓${reset} Wrote package.json (CommonJS mode)`);

    // Copy hooks from dist/ (bundled with dependencies)
    // Template paths for the target runtime (replaces '.claude' with correct config dir)
    const hooksSrc = path.join(src, 'hooks', 'dist');
    if (fs.existsSync(hooksSrc)) {
      const hooksDest = path.join(targetDir, 'hooks');
      fs.mkdirSync(hooksDest, { recursive: true });
      const hookEntries = fs.readdirSync(hooksSrc);
      const configDirReplacement = getConfigDirFromHome(runtime, isGlobal);
      for (const entry of hookEntries) {
        const srcFile = path.join(hooksSrc, entry);
        if (fs.statSync(srcFile).isFile()) {
          const destFile = path.join(hooksDest, entry);
          // Template .js files to replace '.claude' with runtime-specific config dir
          // and stamp the current GSD version into the hook version header
          if (entry.endsWith('.js')) {
            let content = fs.readFileSync(srcFile, 'utf8');
            content = content.replace(/'\.claude'/g, configDirReplacement);
            content = content.replace(/\/\.claude\//g, `/${getDirName(runtime)}/`);
            content = content.replace(/\.claude\//g, `${getDirName(runtime)}/`);
            if (isQwen) {
              content = content.replace(/CLAUDE\.md/g, 'QWEN.md');
              content = content.replace(/\bClaude Code\b/g, 'Qwen Code');
            }
            if (isHermes) {
              content = content.replace(/CLAUDE\.md/g, 'HERMES.md');
              content = content.replace(/\bClaude Code\b/g, 'Hermes Agent');
            }
            content = content.replace(/\{\{GSD_VERSION\}\}/g, pkg.version);
            fs.writeFileSync(destFile, content);
            // Ensure hook files are executable (fixes #1162 — missing +x permission)
            try { fs.chmodSync(destFile, 0o755); } catch (e) { /* Windows doesn't support chmod */ }
          } else {
            // .sh hooks carry a gsd-hook-version header so gsd-check-update.js can
            // detect staleness after updates — stamp the version just like .js hooks.
            if (entry.endsWith('.sh')) {
              let content = fs.readFileSync(srcFile, 'utf8');
              content = content.replace(/\{\{GSD_VERSION\}\}/g, pkg.version);
              fs.writeFileSync(destFile, content);
              try { fs.chmodSync(destFile, 0o755); } catch (e) { /* Windows doesn't support chmod */ }
            } else {
              fs.copyFileSync(srcFile, destFile);
            }
          }
        }
      }
      if (verifyInstalled(hooksDest, 'hooks')) {
        console.log(`  ${green}✓${reset} Installed hooks (bundled)`);
        // Warn if expected community .sh hooks are missing (non-fatal)
        const expectedShHooks = ['gsd-session-state.sh', 'gsd-validate-commit.sh', 'gsd-phase-boundary.sh'];
        for (const sh of expectedShHooks) {
          if (!fs.existsSync(path.join(hooksDest, sh))) {
            console.warn(`  ${yellow}⚠${reset}  Missing expected hook: ${sh}`);
          }
        }
      } else {
        failures.push('hooks');
      }
    }
  }

  // Clear stale update cache so next session re-evaluates hook versions
  // Cache lives at ~/.cache/gsd/ (see hooks/gsd-check-update.js line 35-36)
  const updateCacheFile = path.join(os.homedir(), '.cache', 'gsd', 'gsd-update-check.json');
  try { fs.unlinkSync(updateCacheFile); } catch (e) { /* cache may not exist yet */ }

  if (failures.length > 0) {
    console.error(`\n  ${yellow}Installation incomplete!${reset} Failed: ${failures.join(', ')}`);
    process.exit(1);
  }

  // Write file manifest for future modification detection
  writeManifest(targetDir, runtime, { mode: installMode });
  console.log(`  ${green}✓${reset} Wrote file manifest (${MANIFEST_NAME})`);

  // Report any backed-up local patches
  reportLocalPatches(targetDir, runtime);

  // Verify no leaked .claude paths in non-Claude runtimes
  if (runtime !== 'claude') {
    const leakedPaths = [];
    function scanForLeakedPaths(dir) {
      if (!fs.existsSync(dir)) return;
      let entries;
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch (err) {
        if (err.code === 'EPERM' || err.code === 'EACCES') {
          return; // skip inaccessible directories
        }
        throw err;
      }
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanForLeakedPaths(fullPath);
        } else if ((entry.name.endsWith('.md') || entry.name.endsWith('.toml')) && entry.name !== 'CHANGELOG.md') {
          let content;
          try {
            content = fs.readFileSync(fullPath, 'utf8');
          } catch (err) {
            if (err.code === 'EPERM' || err.code === 'EACCES') {
              continue; // skip inaccessible files
            }
            throw err;
          }
          const matches = content.match(/(?:~|\$HOME)\/\.claude\b/g);
          if (matches) {
            leakedPaths.push({ file: fullPath.replace(targetDir + '/', ''), count: matches.length });
          }
        }
      }
    }
    scanForLeakedPaths(targetDir);
    if (leakedPaths.length > 0) {
      const totalLeaks = leakedPaths.reduce((sum, l) => sum + l.count, 0);
      console.warn(`\n  ${yellow}⚠${reset}  Found ${totalLeaks} unreplaced .claude path reference(s) in ${leakedPaths.length} file(s):`);
      for (const leak of leakedPaths.slice(0, 5)) {
        console.warn(`     ${dim}${leak.file}${reset} (${leak.count})`);
      }
      if (leakedPaths.length > 5) {
        console.warn(`     ${dim}... and ${leakedPaths.length - 5} more file(s)${reset}`);
      }
      console.warn(`  ${dim}These paths may not resolve correctly for ${runtimeLabel}.${reset}`);
    }
  }

  if (isCodex && !isMinimalMode(installMode)) {
    // Capture pre-install snapshot of config.toml before ANY GSD mutation
    // (#2760 fix 3). On post-write schema-validation failure OR any throw
    // during the mutation sequence (write failure, merge throw, etc.) we
    // restore these exact bytes so the user is never left with a broken
    // Codex CLI (#2760 fix 4 — extends snapshot coverage to write-failure
    // paths, paired with atomic temp-file writes in mergeCodexConfig and
    // the final hooks-write below).
    const codexConfigPathPreInstall = path.join(targetDir, 'config.toml');
    const codexConfigPreInstallSnapshot = fs.existsSync(codexConfigPathPreInstall)
      ? fs.readFileSync(codexConfigPathPreInstall)
      : null;

    const restoreCodexSnapshot = () => {
      if (codexConfigPreInstallSnapshot !== null) {
        try { fs.writeFileSync(codexConfigPathPreInstall, codexConfigPreInstallSnapshot); }
        catch (_) { /* best-effort restore — surface the original error */ }
      } else if (fs.existsSync(codexConfigPathPreInstall)) {
        try { fs.rmSync(codexConfigPathPreInstall); } catch (_) { /* best-effort */ }
      }
    };

    let agentCount;
    try {
      // Generate Codex config.toml and per-agent .toml files.
      // Skipped under --minimal — same rationale as filesystem agents above.
      agentCount = installCodexConfig(targetDir, agentsSrc);
    } catch (e) {
      restoreCodexSnapshot();
      throw e;
    }
    console.log(`  ${green}✓${reset} Generated config.toml with ${agentCount} agent roles`);
    console.log(`  ${green}✓${reset} Generated ${agentCount} agent .toml config files`);

    // Copy hook files that are referenced in config.toml (#2153)
    // The main hook-copy block is gated to non-Codex runtimes, but Codex registers
    // gsd-check-update.js in config.toml — the file must physically exist.
    const codexHooksSrc = path.join(src, 'hooks', 'dist');
    if (fs.existsSync(codexHooksSrc)) {
      const codexHooksDest = path.join(targetDir, 'hooks');
      fs.mkdirSync(codexHooksDest, { recursive: true });
      const configDirReplacement = getConfigDirFromHome(runtime, isGlobal);
      for (const entry of fs.readdirSync(codexHooksSrc)) {
        const srcFile = path.join(codexHooksSrc, entry);
        if (!fs.statSync(srcFile).isFile()) continue;
        const destFile = path.join(codexHooksDest, entry);
        if (entry.endsWith('.js')) {
          let content = fs.readFileSync(srcFile, 'utf8');
          content = content.replace(/'\.claude'/g, configDirReplacement);
          content = content.replace(/\/\.claude\//g, `/${getDirName(runtime)}/`);
          content = content.replace(/\.claude\//g, `${getDirName(runtime)}/`);
          content = content.replace(/\{\{GSD_VERSION\}\}/g, pkg.version);
          fs.writeFileSync(destFile, content);
          try { fs.chmodSync(destFile, 0o755); } catch (e) { /* Windows */ }
        } else {
          if (entry.endsWith('.sh')) {
            let content = fs.readFileSync(srcFile, 'utf8');
            content = content.replace(/\{\{GSD_VERSION\}\}/g, pkg.version);
            fs.writeFileSync(destFile, content);
            try { fs.chmodSync(destFile, 0o755); } catch (e) { /* Windows */ }
          } else {
            fs.copyFileSync(srcFile, destFile);
          }
        }
      }
      console.log(`  ${green}✓${reset} Installed hooks`);
    }

    // Add Codex hooks (SessionStart for update checking) — requires codex_hooks feature flag
    const configPath = path.join(targetDir, 'config.toml');
    // Use the pre-install snapshot captured before installCodexConfig ran so
    // restore returns the file to its true pre-GSD state on validation
    // failure (#2760 fix 3) — not to the post-agent-merge state.
    const preWriteBackup = codexConfigPreInstallSnapshot;
    try {
      let configContent = fs.existsSync(configPath) ? fs.readFileSync(configPath, 'utf-8') : '';
      const eol = detectLineEnding(configContent);

      // Strip ALL prior GSD-managed hook blocks BEFORE migration so the migration
      // only touches user-authored hooks, not GSD-owned stale entries. Running
      // strip after migration causes Shape 1 (legacy gsd-update-check filename)
      // to be converted by migration before the strip regex can match it (#2698).
      //
      // Historical shapes stripped, in order:
      //   Shape 1 — legacy gsd-update-check filename (pre-#1755): flat [[hooks]] + event
      //   Shape 2 — flat [[hooks]] + event = "SessionStart" (#2637 era, never correct)
      //   Shape 4 — correct two-block nested (strip before shape 3 to avoid orphaned header)
      //   Shape 3 — single-block [[hooks.SessionStart]] without nested .hooks (#2760 era)
      configContent = stripStaleGsdHookBlocks(configContent);

      // Migrate legacy [hooks] map format and flat [[hooks]] AoT entries to the
      // namespaced [[hooks.<EVENT>]] form after stripping GSD-managed stale blocks.
      // Running migration after strip ensures only user-authored hooks are migrated
      // (#2698 regression: migration before strip converts stale GSD blocks before
      // the strip regexes can match their original shape).
      const migratedContent = migrateCodexHooksMapFormat(configContent);
      if (migratedContent !== configContent) {
        configContent = migratedContent;
        console.log(`  ${green}✓${reset} Migrated legacy Codex [hooks] format to two-level nested AoT`);
      }

      const codexHooksFeature = ensureCodexHooksFeature(configContent);
      configContent = setManagedCodexHooksOwnership(codexHooksFeature.content, codexHooksFeature.ownership);

      // Add SessionStart hook for update checking. Codex 0.124.0+ requires the
      // two-level nested AoT schema: [[hooks.SessionStart]] for the event entry
      // (holds optional matcher) and [[hooks.SessionStart.hooks]] for the handler
      // (holds type, command, statusMessage, timeout). (#2637, #2760, #2773)
      //
      // #3017: route through buildCodexHookBlock() so the absolute Node binary
      // path is emitted (matching the settings.json branch via #3002), so the
      // hook resolves under GUI/minimal-PATH runtimes where bare `node` doesn't.
      const codexNodeRunner = resolveNodeRunner();
      const hookBlock = buildCodexHookBlock(targetDir, { absoluteRunner: codexNodeRunner, eol });

      if (hasEnabledCodexHooksFeature(configContent)) {
        // Reinstall path: rewrite a legacy bare-node managed-hook entry to the
        // absolute runner. Mirrors rewriteLegacyManagedNodeHookCommands for the
        // settings.json surface (#3002 CR).
        const rewrite = rewriteLegacyCodexHookBlock(configContent, codexNodeRunner);
        if (rewrite.changed) {
          configContent = rewrite.content;
          console.log(`  ${green}✓${reset} Migrated legacy bare-node Codex hook to absolute runner (#3017)`);
        }
        if (!configContent.includes('gsd-check-update')) {
          if (hookBlock !== null) {
            configContent += hookBlock;
          } else {
            // resolveNodeRunner() returned null — process.execPath unavailable.
            // Match the settings.json branch's warn-and-skip behavior rather
            // than emit a broken bare-node hook (the #2979 / #3017 failure mode).
            console.warn(`  ${yellow}⚠${reset}  Skipping Codex SessionStart hook registration — Node executable path unavailable (process.execPath is empty). See #2979 / #3002 / #3017.`);
          }
        }
      }

      // #2760 fix 3 — post-write schema validation. Parse the bytes we are
      // about to commit and assert they match Codex's expected shape. If
      // validation fails we restore the pre-install backup and abort so the
      // user is never left with a Codex CLI that won't load.
      // Test seam: tests can inject `__codexSchemaValidator` to force the
      // validator to fail and exercise the restore-and-abort path.
      const validatorFn = (typeof module !== 'undefined' && module.exports && module.exports.__codexSchemaValidator)
        ? module.exports.__codexSchemaValidator
        : validateCodexConfigSchema;
      const validation = validatorFn(configContent);
      if (!validation.ok) {
        restoreCodexSnapshot();
        throw new Error(
          `post-write Codex schema validation failed: ${validation.reason}. ` +
          `Restored ${preWriteBackup !== null ? 'pre-install backup' : 'empty state'}.`
        );
      }

      // Atomic write (#2760 fix 4) — write to a sibling temp file, then
      // renameSync over the target. A mid-write failure cannot truncate the
      // existing config; the snapshot restore below is a second line of
      // defense if even the rename fails.
      try {
        atomicWriteFileSync(configPath, configContent, 'utf-8');
      } catch (writeErr) {
        // #2760 CR4 finding 1 — write failure must be loud and fatal. Wrap
        // with a `post-write` prefix the outer catch recognises so install
        // aborts with a clear error rather than warn-and-continue (which
        // produced "Done!" with no Codex agents configured).
        restoreCodexSnapshot();
        const wrapped = new Error(
          `post-write Codex install failed: ${writeErr && writeErr.message ? writeErr.message : String(writeErr)}. ` +
          `Restored ${preWriteBackup !== null ? 'pre-install backup' : 'empty state'}.`
        );
        throw wrapped;
      }
      console.log(`  ${green}✓${reset} Configured Codex hooks (SessionStart)`);
    } catch (e) {
      // #2760 — schema-validation and write failures must be loud and fatal
      // so the user is never left with a config Codex refuses to load (or no
      // Codex agents configured at all). The pre-install snapshot restore has
      // already run for write-side throws via the inner catch above and via
      // restoreCodexSnapshot in the validation branch.
      if (e && typeof e.message === 'string' && e.message.startsWith('post-write')) {
        console.error(`  ${red}✗${reset} ${e.message}`);
        throw e;
      }
      // #2760 CR5 finding 1 — pre-write failures (migrateCodexHooksMapFormat,
      // ensureCodexHooksFeature, config reads, configContent construction,
      // etc.) must ALSO be fatal. Previously this branch downgraded to a
      // console.warn, leaving the install to print "Done!" with no Codex
      // hooks configured — same defect class as finding 1, different layer.
      // Restore the pre-install snapshot and rethrow so the outer install
      // pipeline aborts.
      restoreCodexSnapshot();
      const wrapped = new Error(
        `Codex hook configuration failed (pre-write): ${e && e.message ? e.message : String(e)}. ` +
          `Restored ${preWriteBackup !== null ? 'pre-install backup' : 'empty state'}.`
      );
      console.error(`  ${red}✗${reset} ${wrapped.message}`);
      throw wrapped;
    }

    return { settingsPath: null, settings: null, statuslineCommand: null, updateBannerCommand: null, runtime, configDir: targetDir };
  }

  if (isCopilot) {
    // Generate copilot-instructions.md
    const templatePath = path.join(targetDir, 'get-shit-done', 'templates', 'copilot-instructions.md');
    const instructionsPath = path.join(targetDir, 'copilot-instructions.md');
    if (fs.existsSync(templatePath)) {
      const template = fs.readFileSync(templatePath, 'utf8');
      mergeCopilotInstructions(instructionsPath, template);
      console.log(`  ${green}✓${reset} Generated copilot-instructions.md`);
    }
    // Copilot: no settings.json, no hooks, no statusline (like Codex)
    return { settingsPath: null, settings: null, statuslineCommand: null, updateBannerCommand: null, runtime, configDir: targetDir };
  }

  if (isCursor) {
    // Cursor uses skills — no config.toml, no settings.json hooks needed
    return { settingsPath: null, settings: null, statuslineCommand: null, updateBannerCommand: null, runtime, configDir: targetDir };
  }

  if (isWindsurf) {
    // Windsurf uses skills — no config.toml, no settings.json hooks needed
    return { settingsPath: null, settings: null, statuslineCommand: null, updateBannerCommand: null, runtime, configDir: targetDir };
  }

  if (isTrae) {
    // Trae uses skills — no settings.json hooks needed
    return { settingsPath: null, settings: null, statuslineCommand: null, updateBannerCommand: null, runtime, configDir: targetDir };
  }

  if (isCline) {
    // Cline uses .clinerules — generate a rules file with GSD system instructions
    const clinerulesDest = path.join(targetDir, '.clinerules');
    const clinerules = [
      '# GSD — Get Shit Done',
      '',
      '- GSD workflows live in `get-shit-done/workflows/`. Load the relevant workflow when',
      '  the user runs a `/gsd-*` command.',
      '- GSD agents live in `agents/`. Use the matching agent when spawning subagents.',
      '- GSD tools are at `get-shit-done/bin/gsd-tools.cjs`. Run with `node`.',
      '- Planning artifacts live in `.planning/`. Never edit them outside a GSD workflow.',
      '- Do not apply GSD workflows unless the user explicitly asks for them.',
      '- When a GSD command triggers a deliverable (feature, fix, docs), offer the next',
      '  step to the user using Cline\'s ask_user tool after completing it.',
    ].join('\n') + '\n';
    fs.writeFileSync(clinerulesDest, clinerules);
    console.log(`  ${green}✓${reset} Wrote .clinerules`);
    return { settingsPath: null, settings: null, statuslineCommand: null, updateBannerCommand: null, runtime, configDir: targetDir };
  }

  // Configure statusline and hooks in settings.json
  // Gemini and Antigravity use AfterTool instead of PostToolUse for post-tool hooks
  const postToolEvent = (runtime === 'gemini' || runtime === 'antigravity') ? 'AfterTool' : 'PostToolUse';
  const settingsPath = path.join(targetDir, 'settings.json');
  const rawSettings = readSettings(settingsPath);
  if (rawSettings === null) {
    console.log('  ' + yellow + 'i' + reset + '  Skipping settings.json configuration — file could not be parsed (comments or malformed JSON). Your existing settings are preserved.');
    return;
  }
  const settings = validateHookFields(cleanupOrphanedHooks(rawSettings));
  // #3002 CR: rewrite legacy `node .../gsd-*.js` command strings carried over
  // from pre-#2979 installs to use the absolute node binary path. Without this,
  // existing managed hook entries stay bare-`node`-prefixed across reinstalls
  // and remain broken under GUI/minimal-PATH runtimes.
  const settingsRunner = resolveNodeRunner();
  if (settingsRunner && rewriteLegacyManagedNodeHookCommands(settings, settingsRunner)) {
    console.log(`  ${green}✓${reset} Rewrote legacy bare-node managed-hook commands to absolute path (#2979)`);
  }
  // Local installs anchor hook paths so they resolve regardless of cwd (#1906).
  // Claude Code sets $CLAUDE_PROJECT_DIR; Gemini/Antigravity do not — and on
  // Windows their own substitution logic doubles the path (#2557). Those runtimes
  // run project hooks with the project dir as cwd, so bare relative paths work.
  const localPrefix = (runtime === 'gemini' || runtime === 'antigravity')
    ? dirName
    : '"$CLAUDE_PROJECT_DIR"/' + dirName;
  const hookOpts = { portableHooks: hasPortableHooks };
  // #2979: local-install hook commands also use the absolute node path so
  // GUI/minimal-PATH runtimes can resolve them. Bare `node` fails when the
  // host launches the runtime with a stripped PATH (Finder/Antigravity/etc).
  const localNodeRunner = resolveNodeRunner();
  // If we cannot resolve an absolute node path AND this is a local install,
  // skip managed-hook registration. Returning null from buildHookCommand on
  // global installs has the same effect. Better to skip than to emit a bare
  // `node` command that recreates the #2979 failure.
  const localCmd = (hookFile) => localNodeRunner === null
    ? null
    : localNodeRunner + ' ' + localPrefix + '/hooks/' + hookFile;
  const statuslineCommand = isGlobal
    ? buildHookCommand(targetDir, 'gsd-statusline.js', hookOpts)
    : localCmd('gsd-statusline.js');
  const updateCheckCommand = isGlobal
    ? buildHookCommand(targetDir, 'gsd-check-update.js', hookOpts)
    : localCmd('gsd-check-update.js');
  const contextMonitorCommand = isGlobal
    ? buildHookCommand(targetDir, 'gsd-context-monitor.js', hookOpts)
    : localCmd('gsd-context-monitor.js');
  const promptGuardCommand = isGlobal
    ? buildHookCommand(targetDir, 'gsd-prompt-guard.js', hookOpts)
    : localCmd('gsd-prompt-guard.js');
  const readGuardCommand = isGlobal
    ? buildHookCommand(targetDir, 'gsd-read-guard.js', hookOpts)
    : localCmd('gsd-read-guard.js');
  const readInjectionScannerCommand = isGlobal
    ? buildHookCommand(targetDir, 'gsd-read-injection-scanner.js', hookOpts)
    : localCmd('gsd-read-injection-scanner.js');

  // #3002 CR: when resolveNodeRunner() returns null, every dependent JS-hook
  // command is null too. Emit one warning here so the operator sees the cause
  // ONCE instead of per-hook. Each registration site below also guards on its
  // own *Command variable being truthy, so we never write `command: null`
  // entries to settings.json (which the runtime's hook schema would reject).
  const anyJsHookCommandNull = !statuslineCommand
    || !updateCheckCommand
    || !contextMonitorCommand
    || !promptGuardCommand
    || !readGuardCommand
    || !readInjectionScannerCommand;
  if (anyJsHookCommandNull) {
    console.warn(`  ${yellow}⚠${reset}  Skipping managed JS hook registration — Node executable path unavailable (process.execPath is empty). See #2979 / #3002.`);
  }

  // Enable experimental agents for Gemini CLI (required for custom sub-agents)
  if (isGemini) {
    if (!settings.experimental) {
      settings.experimental = {};
    }
    if (!settings.experimental.enableAgents) {
      settings.experimental.enableAgents = true;
      console.log(`  ${green}✓${reset} Enabled experimental agents`);
    }
  }

  // Configure SessionStart hook for update checking (skip for opencode)
  if (!isOpencode && !isKilo) {
    if (!settings.hooks) {
      settings.hooks = {};
    }
    if (!settings.hooks.SessionStart) {
      settings.hooks.SessionStart = [];
    }

    const hasGsdUpdateHook = settings.hooks.SessionStart.some(entry =>
      entry.hooks && entry.hooks.some(h => h.command && h.command.includes('gsd-check-update'))
    );

    // Guard: only register if the hook file was actually installed (#1754).
    // When hooks/dist/ is missing from the npm package (as in v1.32.0), the
    // copy step produces no files but the registration step ran unconditionally,
    // causing "hook error" on every tool invocation.
    const checkUpdateFile = path.join(targetDir, 'hooks', 'gsd-check-update.js');
    if (!hasGsdUpdateHook && fs.existsSync(checkUpdateFile) && updateCheckCommand) {
      settings.hooks.SessionStart.push({
        hooks: [
          {
            type: 'command',
            command: updateCheckCommand
          }
        ]
      });
      console.log(`  ${green}✓${reset} Configured update check hook`);
    } else if (!hasGsdUpdateHook && !fs.existsSync(checkUpdateFile)) {
      console.warn(`  ${yellow}⚠${reset}  Skipped update check hook — gsd-check-update.js not found at target`);
    }

    // Configure post-tool hook for context window monitoring
    if (!settings.hooks[postToolEvent]) {
      settings.hooks[postToolEvent] = [];
    }

    const hasContextMonitorHook = settings.hooks[postToolEvent].some(entry =>
      entry.hooks && entry.hooks.some(h => h.command && h.command.includes('gsd-context-monitor'))
    );

    const contextMonitorFile = path.join(targetDir, 'hooks', 'gsd-context-monitor.js');
    if (!hasContextMonitorHook && fs.existsSync(contextMonitorFile) && contextMonitorCommand) {
      settings.hooks[postToolEvent].push({
        matcher: 'Bash|Edit|Write|MultiEdit|Agent|Task',
        hooks: [
          {
            type: 'command',
            command: contextMonitorCommand,
            timeout: 10
          }
        ]
      });
      console.log(`  ${green}✓${reset} Configured context window monitor hook`);
    } else if (!hasContextMonitorHook && !fs.existsSync(contextMonitorFile)) {
      console.warn(`  ${yellow}⚠${reset}  Skipped context monitor hook — gsd-context-monitor.js not found at target`);
    } else {
      // Migrate existing context monitor hooks: add matcher and timeout if missing
      for (const entry of settings.hooks[postToolEvent]) {
        if (entry.hooks && entry.hooks.some(h => h.command && h.command.includes('gsd-context-monitor'))) {
          let migrated = false;
          if (!entry.matcher) {
            entry.matcher = 'Bash|Edit|Write|MultiEdit|Agent|Task';
            migrated = true;
          }
          for (const h of entry.hooks) {
            if (h.command && h.command.includes('gsd-context-monitor') && !h.timeout) {
              h.timeout = 10;
              migrated = true;
            }
          }
          if (migrated) {
            console.log(`  ${green}✓${reset} Updated context monitor hook (added matcher + timeout)`);
          }
        }
      }
    }

    // Configure PreToolUse hook for prompt injection detection
    // Gemini and Antigravity use BeforeTool instead of PreToolUse for pre-tool hooks
    const preToolEvent = (runtime === 'gemini' || runtime === 'antigravity') ? 'BeforeTool' : 'PreToolUse';
    if (!settings.hooks[preToolEvent]) {
      settings.hooks[preToolEvent] = [];
    }

    const hasPromptGuardHook = settings.hooks[preToolEvent].some(entry =>
      entry.hooks && entry.hooks.some(h => h.command && h.command.includes('gsd-prompt-guard'))
    );

    const promptGuardFile = path.join(targetDir, 'hooks', 'gsd-prompt-guard.js');
    if (!hasPromptGuardHook && fs.existsSync(promptGuardFile) && promptGuardCommand) {
      settings.hooks[preToolEvent].push({
        matcher: 'Write|Edit',
        hooks: [
          {
            type: 'command',
            command: promptGuardCommand,
            timeout: 5
          }
        ]
      });
      console.log(`  ${green}✓${reset} Configured prompt injection guard hook`);
    } else if (!hasPromptGuardHook && !fs.existsSync(promptGuardFile)) {
      console.warn(`  ${yellow}⚠${reset}  Skipped prompt guard hook — gsd-prompt-guard.js not found at target`);
    }

    // Configure PreToolUse hook for read-before-edit guidance (#1628)
    // Prevents infinite retry loops when non-Claude models attempt to edit
    // files without reading them first. Advisory-only — does not block.
    const hasReadGuardHook = settings.hooks[preToolEvent].some(entry =>
      entry.hooks && entry.hooks.some(h => h.command && h.command.includes('gsd-read-guard'))
    );

    const readGuardFile = path.join(targetDir, 'hooks', 'gsd-read-guard.js');
    if (!hasReadGuardHook && fs.existsSync(readGuardFile) && readGuardCommand) {
      settings.hooks[preToolEvent].push({
        matcher: 'Write|Edit',
        hooks: [
          {
            type: 'command',
            command: readGuardCommand,
            timeout: 5
          }
        ]
      });
      console.log(`  ${green}✓${reset} Configured read-before-edit guard hook`);
    } else if (!hasReadGuardHook && !fs.existsSync(readGuardFile)) {
      console.warn(`  ${yellow}⚠${reset}  Skipped read guard hook — gsd-read-guard.js not found at target`);
    }

    // Configure PostToolUse hook for read-time prompt injection scanning (#2201)
    // Scans content returned by the Read tool for injection patterns, including
    // summarisation-specific patterns that survive context compression.
    const hasReadInjectionScannerHook = settings.hooks[postToolEvent].some(entry =>
      entry.hooks && entry.hooks.some(h => h.command && h.command.includes('gsd-read-injection-scanner'))
    );

    const readInjectionScannerFile = path.join(targetDir, 'hooks', 'gsd-read-injection-scanner.js');
    if (!hasReadInjectionScannerHook && fs.existsSync(readInjectionScannerFile) && readInjectionScannerCommand) {
      settings.hooks[postToolEvent].push({
        matcher: 'Read',
        hooks: [
          {
            type: 'command',
            command: readInjectionScannerCommand,
            timeout: 5
          }
        ]
      });
      console.log(`  ${green}✓${reset} Configured read injection scanner hook`);
    } else if (!hasReadInjectionScannerHook && !fs.existsSync(readInjectionScannerFile)) {
      console.warn(`  ${yellow}⚠${reset}  Skipped read injection scanner hook — gsd-read-injection-scanner.js not found at target`);
    }

    // Community hooks — registered on install but opt-in at runtime.
    // Each hook checks .planning/config.json for hooks.community: true
    // and exits silently (no-op) if not enabled. This lets users enable
    // them per-project by adding: "hooks": { "community": true }

    // Configure workflow guard hook (opt-in via hooks.workflow_guard: true)
    // Detects file edits outside GSD workflow context and advises using
    // /gsd-quick or /gsd-fast for state-tracked changes. Advisory only.
    const workflowGuardCommand = isGlobal
      ? buildHookCommand(targetDir, 'gsd-workflow-guard.js', hookOpts)
      : localCmd('gsd-workflow-guard.js');
    const hasWorkflowGuardHook = settings.hooks[preToolEvent].some(entry =>
      entry.hooks && entry.hooks.some(h => h.command && h.command.includes('gsd-workflow-guard'))
    );

    const workflowGuardFile = path.join(targetDir, 'hooks', 'gsd-workflow-guard.js');
    if (!hasWorkflowGuardHook && fs.existsSync(workflowGuardFile) && workflowGuardCommand) {
      settings.hooks[preToolEvent].push({
        matcher: 'Write|Edit',
        hooks: [
          {
            type: 'command',
            command: workflowGuardCommand,
            timeout: 5
          }
        ]
      });
      console.log(`  ${green}✓${reset} Configured workflow guard hook (opt-in via hooks.workflow_guard)`);
    } else if (!hasWorkflowGuardHook && !fs.existsSync(workflowGuardFile)) {
      console.warn(`  ${yellow}⚠${reset}  Skipped workflow guard hook — gsd-workflow-guard.js not found at target`);
    }

    // Configure commit validation hook (Conventional Commits enforcement, opt-in)
    const validateCommitCommand = isGlobal
      ? buildHookCommand(targetDir, 'gsd-validate-commit.sh', hookOpts)
      : 'bash ' + localPrefix + '/hooks/gsd-validate-commit.sh';
    const hasValidateCommitHook = settings.hooks[preToolEvent].some(entry =>
      entry.hooks && entry.hooks.some(h => h.command && h.command.includes('gsd-validate-commit'))
    );
    // Guard: only register if the .sh file was actually installed. If the npm package
    // omitted the file (as happened in v1.32.0, bug #1817), registering a missing hook
    // causes a hook error on every Bash tool invocation.
    const validateCommitFile = path.join(targetDir, 'hooks', 'gsd-validate-commit.sh');
    if (!hasValidateCommitHook && fs.existsSync(validateCommitFile)) {
      settings.hooks[preToolEvent].push({
        matcher: 'Bash',
        hooks: [
          {
            type: 'command',
            command: validateCommitCommand,
            timeout: 5
          }
        ]
      });
      console.log(`  ${green}✓${reset} Configured commit validation hook (opt-in via config)`);
    } else if (!hasValidateCommitHook && !fs.existsSync(validateCommitFile)) {
      console.warn(`  ${yellow}⚠${reset}  Skipped commit validation hook — gsd-validate-commit.sh not found at target`);
    }

    // Configure session state orientation hook (opt-in)
    const sessionStateCommand = isGlobal
      ? buildHookCommand(targetDir, 'gsd-session-state.sh', hookOpts)
      : 'bash ' + localPrefix + '/hooks/gsd-session-state.sh';
    const hasSessionStateHook = settings.hooks.SessionStart.some(entry =>
      entry.hooks && entry.hooks.some(h => h.command && h.command.includes('gsd-session-state'))
    );
    const sessionStateFile = path.join(targetDir, 'hooks', 'gsd-session-state.sh');
    if (!hasSessionStateHook && fs.existsSync(sessionStateFile)) {
      settings.hooks.SessionStart.push({
        hooks: [
          {
            type: 'command',
            command: sessionStateCommand
          }
        ]
      });
      console.log(`  ${green}✓${reset} Configured session state orientation hook (opt-in via config)`);
    } else if (!hasSessionStateHook && !fs.existsSync(sessionStateFile)) {
      console.warn(`  ${yellow}⚠${reset}  Skipped session state hook — gsd-session-state.sh not found at target`);
    }

    // Configure phase boundary detection hook (opt-in)
    const phaseBoundaryCommand = isGlobal
      ? buildHookCommand(targetDir, 'gsd-phase-boundary.sh', hookOpts)
      : 'bash ' + localPrefix + '/hooks/gsd-phase-boundary.sh';
    const hasPhaseBoundaryHook = settings.hooks[postToolEvent].some(entry =>
      entry.hooks && entry.hooks.some(h => h.command && h.command.includes('gsd-phase-boundary'))
    );
    const phaseBoundaryFile = path.join(targetDir, 'hooks', 'gsd-phase-boundary.sh');
    if (!hasPhaseBoundaryHook && fs.existsSync(phaseBoundaryFile)) {
      settings.hooks[postToolEvent].push({
        matcher: 'Write|Edit',
        hooks: [
          {
            type: 'command',
            command: phaseBoundaryCommand,
            timeout: 5
          }
        ]
      });
      console.log(`  ${green}✓${reset} Configured phase boundary detection hook (opt-in via config)`);
    } else if (!hasPhaseBoundaryHook && !fs.existsSync(phaseBoundaryFile)) {
      console.warn(`  ${yellow}⚠${reset}  Skipped phase boundary hook — gsd-phase-boundary.sh not found at target`);
    }
  }

  // Compute the update-banner hook command alongside the others so
  // installAllRuntimes can register it at finalize time when the user opts
  // in (#2795). Computed here (not in finishInstall) so the same buildHookCommand
  // / localCmd resolution logic is shared with the other JS hooks.
  const updateBannerCommand = isOpencode || isKilo
    ? null
    : (isGlobal
      ? buildHookCommand(targetDir, 'gsd-update-banner.js', hookOpts)
      : localCmd('gsd-update-banner.js'));

  return {
    settingsPath,
    settings,
    statuslineCommand,
    updateBannerCommand,
    runtime,
    configDir: targetDir,
  };
}

/**
 * Apply statusline config, then print completion message
 */
function finishInstall(settingsPath, settings, statuslineCommand, shouldInstallStatusline, runtime = 'claude', isGlobal = true, configDir = null, bannerOpts = {}) {
  const isOpencode = runtime === 'opencode';
  const isKilo = runtime === 'kilo';
  const isCodex = runtime === 'codex';
  const isCopilot = runtime === 'copilot';
  const isCursor = runtime === 'cursor';
  const isWindsurf = runtime === 'windsurf';
  const isTrae = runtime === 'trae';
  const isCline = runtime === 'cline';

  if (shouldInstallStatusline && !isOpencode && !isKilo && !isCodex && !isCopilot && !isCursor && !isWindsurf && !isTrae) {
    if (!isGlobal && !forceStatusline) {
      // Local installs skip statusLine by default: repo settings.json takes precedence over
      // profile-level settings.json in Claude Code, so writing here would silently clobber
      // any profile-level statusLine the user has configured (#2248).
      // Pass --force-statusline to override this guard.
      console.log(`  ${yellow}⚠${reset} Skipping statusLine for local install (avoids overriding profile-level settings; use --force-statusline to override)`);
    } else if (!statuslineCommand) {
      // #3002 CR: don't write { type: 'command', command: null } — the
      // runtime's settings schema rejects null commands and the failure
      // surfaces as a confusing parse error rather than a usable diagnostic.
      console.warn(`  ${yellow}⚠${reset}  Skipped statusline registration — Node executable path unavailable (process.execPath is empty). See #2979 / #3002.`);
    } else {
      settings.statusLine = {
        type: 'command',
        command: statuslineCommand
      };
      console.log(`  ${green}✓${reset} Configured statusline`);
    }
  }

  // Register the opt-in update banner (#2795) when the user accepted the
  // banner offer at install time. Only applies to runtimes that own a
  // settings.json hooks block — opencode/kilo/codex/cursor/windsurf/trae/
  // cline either lack the surface or use a different config schema.
  const { shouldInstallBanner, bannerCommand } = bannerOpts;
  if (shouldInstallBanner && settings && !isOpencode && !isKilo && !isCodex && !isCopilot && !isCursor && !isWindsurf && !isTrae && !isCline) {
    if (!bannerCommand) {
      console.warn(`  ${yellow}⚠${reset}  Skipped update banner registration — Node executable path unavailable. See #2979 / #3002.`);
    } else {
      if (!settings.hooks) settings.hooks = {};
      if (!settings.hooks.SessionStart) settings.hooks.SessionStart = [];
      const alreadyRegistered = settings.hooks.SessionStart.some(entry =>
        entry && entry.hooks && entry.hooks.some(h => h && h.command && h.command.includes('gsd-update-banner'))
      );
      const bannerHookFile = configDir ? path.join(configDir, 'hooks', 'gsd-update-banner.js') : null;
      const bannerInstalled = bannerHookFile ? fs.existsSync(bannerHookFile) : false;
      if (alreadyRegistered) {
        // Idempotent re-install: don't double-register.
      } else if (!bannerInstalled) {
        console.warn(`  ${yellow}⚠${reset}  Skipped update banner — gsd-update-banner.js not found at target`);
      } else {
        const entry = buildUpdateBannerHookEntry(bannerCommand);
        if (entry) {
          settings.hooks.SessionStart.push(entry);
          console.log(`  ${green}✓${reset} Configured update banner hook (opt-in)`);
        }
      }
    }
  }

  // Write settings when runtime supports settings.json.
  // #3002 CR: defense-in-depth — re-run validateHookFields right before
  // serialization. The push-site guards above already skip null-command
  // entries, but a future regression that bypasses them would still produce
  // {type: 'command', command: null} items that the runtime hook schema
  // rejects at parse time. validateHookFields filters those out so the file
  // we write is always schema-valid.
  if (!isCodex && !isCopilot && !isKilo && !isCursor && !isWindsurf && !isTrae && !isCline) {
    writeSettings(settingsPath, validateHookFields(settings));
  }

  // Configure OpenCode permissions
  if (isOpencode) {
    configureOpencodePermissions(isGlobal, configDir);
  }

  // Configure Kilo permissions
  if (isKilo) {
    configureKiloPermissions(isGlobal, configDir);
  }

  // For non-Claude runtimes, set resolve_model_ids: "omit" in ~/.gsd/defaults.json
  // so resolveModelInternal() returns '' instead of Claude aliases (opus/sonnet/haiku)
  // that the runtime can't resolve. Users can still use model_overrides for explicit IDs.
  // See #1156.
  if (runtime !== 'claude') {
    const gsdDir = path.join(os.homedir(), '.gsd');
    const defaultsPath = path.join(gsdDir, 'defaults.json');
    try {
      fs.mkdirSync(gsdDir, { recursive: true });
      let defaults = {};
      try { defaults = JSON.parse(fs.readFileSync(defaultsPath, 'utf8')); } catch { /* new file */ }
      if (defaults.resolve_model_ids !== 'omit') {
        defaults.resolve_model_ids = 'omit';
        fs.writeFileSync(defaultsPath, JSON.stringify(defaults, null, 2) + '\n');
        console.log(`  ${green}✓${reset} Set resolve_model_ids: "omit" in ~/.gsd/defaults.json`);
      }
    } catch (e) {
      console.log(`  ${yellow}⚠${reset} Could not write ~/.gsd/defaults.json: ${e.message}`);
    }
  }

  let program = 'Claude Code';
  if (runtime === 'opencode') program = 'OpenCode';
  if (runtime === 'gemini') program = 'Gemini';
  if (runtime === 'kilo') program = 'Kilo';
  if (runtime === 'codex') program = 'Codex';
  if (runtime === 'copilot') program = 'Copilot';
  if (runtime === 'antigravity') program = 'Antigravity';
  if (runtime === 'cursor') program = 'Cursor';
  if (runtime === 'windsurf') program = 'Windsurf';
  if (runtime === 'augment') program = 'Augment';
  if (runtime === 'trae') program = 'Trae';
  if (runtime === 'cline') program = 'Cline';
  if (runtime === 'qwen') program = 'Qwen Code';
  if (runtime === 'hermes') program = 'Hermes Agent';

  let command = '/gsd-new-project';
  if (runtime === 'opencode') command = '/gsd-new-project';
  if (runtime === 'kilo') command = '/gsd-new-project';
  if (runtime === 'gemini') command = '/gsd:new-project';
  if (runtime === 'codex') command = '$gsd-new-project';
  if (runtime === 'copilot') command = '/gsd-new-project';
  if (runtime === 'antigravity') command = '/gsd-new-project';
  if (runtime === 'cursor') command = 'gsd-new-project (mention the skill name)';
  if (runtime === 'windsurf') command = '/gsd-new-project';
  if (runtime === 'augment') command = '/gsd-new-project';
  if (runtime === 'trae') command = '/gsd-new-project';
  if (runtime === 'cline') command = '/gsd-new-project';
  if (runtime === 'qwen') command = '/gsd-new-project';
  if (runtime === 'hermes') command = '/gsd-new-project';

  // Claude Code global installs use the skills/ format (CC 2.1.88+).
  // Restart is required for CC to pick up newly-installed skills, and the
  // slash-menu surface depends on CC version — so the instruction needs to
  // cover both invocation paths to avoid #2957-style "no commands appear".
  if (runtime === 'claude' && isGlobal) {
    console.log(`
  ${green}Done!${reset} Restart ${program}, then in any directory either type ${cyan}${command}${reset} or ask Claude to run the ${cyan}gsd-new-project${reset} skill.

  ${cyan}Join the community:${reset} https://discord.gg/mYgfVNfA2r
`);
    return;
  }

  console.log(`
  ${green}Done!${reset} Open a blank directory in ${program} and run ${cyan}${command}${reset}.

  ${cyan}Join the community:${reset} https://discord.gg/mYgfVNfA2r
`);
}

/**
 * Handle statusline configuration with optional prompt
 */
function handleStatusline(settings, isInteractive, callback) {
  const hasExisting = settings.statusLine != null;

  if (!hasExisting) {
    callback(true);
    return;
  }

  if (forceStatusline) {
    callback(true);
    return;
  }

  if (!isInteractive) {
    console.log(`  ${yellow}⚠${reset} Skipping statusline (already configured)`);
    console.log(`    Use ${cyan}--force-statusline${reset} to replace\n`);
    callback(false);
    return;
  }

  const existingCmd = settings.statusLine.command || settings.statusLine.url || '(custom)';

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log(`
  ${yellow}⚠${reset} Existing statusline detected\n
  Your current statusline:
    ${dim}command: ${existingCmd}${reset}

  GSD includes a statusline showing:
    • Model name
    • Current task (from todo list)
    • Context window usage (color-coded)

  ${cyan}1${reset}) Keep existing
  ${cyan}2${reset}) Replace with GSD statusline
`);

  rl.question(`  Choice ${dim}[1]${reset}: `, (answer) => {
    rl.close();
    const choice = answer.trim() || '1';
    callback(choice === '2');
  });
}

/**
 * Prompt for runtime selection
 */
/**
 * Runtime selection options for the interactive installer prompt.
 * Module-level so tests can import and assert structurally without grepping source.
 */
const runtimeMap = {
  '1': 'claude',
  '2': 'antigravity',
  '3': 'augment',
  '4': 'cline',
  '5': 'codebuddy',
  '6': 'codex',
  '7': 'copilot',
  '8': 'cursor',
  '9': 'gemini',
  '10': 'hermes',
  '11': 'kilo',
  '12': 'opencode',
  '13': 'qwen',
  '14': 'trae',
  '15': 'windsurf'
};
const allRuntimes = ['claude', 'antigravity', 'augment', 'cline', 'codebuddy', 'codex', 'copilot', 'cursor', 'gemini', 'hermes', 'kilo', 'opencode', 'qwen', 'trae', 'windsurf'];
const ALL_RUNTIMES_OPTION = '16';

/**
 * Build the runtime-selection prompt text shown by the interactive installer.
 * Pure function — no I/O. Exported for tests so they can assert against the
 * rendered prompt instead of grepping bin/install.js source text.
 */
function buildRuntimePromptText() {
  return `  ${yellow}Which runtime(s) would you like to install for?${reset}\n\n  ${cyan}1${reset}) Claude Code  ${dim}(~/.claude)${reset}
  ${cyan}2${reset}) Antigravity  ${dim}(~/.gemini/antigravity)${reset}
  ${cyan}3${reset}) Augment      ${dim}(~/.augment)${reset}
  ${cyan}4${reset}) Cline        ${dim}(.clinerules)${reset}
  ${cyan}5${reset}) CodeBuddy    ${dim}(~/.codebuddy)${reset}
  ${cyan}6${reset}) Codex        ${dim}(~/.codex)${reset}
  ${cyan}7${reset}) Copilot      ${dim}(~/.copilot)${reset}
  ${cyan}8${reset}) Cursor       ${dim}(~/.cursor)${reset}
  ${cyan}9${reset}) Gemini       ${dim}(~/.gemini)${reset}
  ${cyan}10${reset}) Hermes Agent ${dim}(~/.hermes)${reset}
  ${cyan}11${reset}) Kilo         ${dim}(~/.config/kilo)${reset}
  ${cyan}12${reset}) OpenCode     ${dim}(~/.config/opencode)${reset}
  ${cyan}13${reset}) Qwen Code    ${dim}(~/.qwen)${reset}
  ${cyan}14${reset}) Trae         ${dim}(~/.trae)${reset}
  ${cyan}15${reset}) Windsurf     ${dim}(~/.codeium/windsurf)${reset}
  ${cyan}16${reset}) All

  ${dim}Select multiple: 1,2,6 or 1 2 6${reset}
`;
}

/**
 * Parse user input from the runtime-selection prompt into a runtime list.
 * Pure function — exported so tests can verify split/dedupe/fallback behavior.
 *  - Accepts comma- and/or whitespace-separated choices
 *  - Deduplicates while preserving order
 *  - Maps option 16 ("All") to every runtime
 *  - Falls back to ['claude'] when nothing valid is selected
 */
function parseRuntimeInput(answer) {
  const input = (answer == null ? '' : String(answer)).trim() || '1';

  // Tokenize first so the all-runtimes shortcut also fires for inputs the
  // prompt encourages — "16,", "16 1", etc. — not just the bare "16".
  const choices = input.split(/[\s,]+/).filter(Boolean);
  if (choices.includes(ALL_RUNTIMES_OPTION)) {
    return allRuntimes.slice();
  }

  const selected = [];
  for (const c of choices) {
    const runtime = runtimeMap[c];
    if (runtime && !selected.includes(runtime)) {
      selected.push(runtime);
    }
  }

  return selected.length > 0 ? selected : ['claude'];
}

function promptRuntime(callback) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  let answered = false;

  rl.on('close', () => {
    if (!answered) {
      answered = true;
      console.log(`\n  ${yellow}Installation cancelled${reset}\n`);
      process.exit(0);
    }
  });

  console.log(buildRuntimePromptText());

  rl.question(`  Choice ${dim}[1]${reset}: `, (answer) => {
    answered = true;
    rl.close();
    callback(parseRuntimeInput(answer));
  });
}

// ─── Update banner (#2795) ──────────────────────────────────────────────────

/**
 * Build the prompt text shown when offering the opt-in update banner.
 * Pure function — no I/O. Exported for tests so they can assert against the
 * rendered prompt structurally instead of grepping bin/install.js source.
 */
function buildUpdateBannerPromptText() {
  return `
  ${yellow}Optional: GSD update banner${reset}
  Without GSD's statusline, update notifications won't be visible. You can
  install a SessionStart banner that surfaces a one-line message when a new
  GSD release is available. The banner appears only at session start and
  only when an update exists.

  ${cyan}1${reset}) ${dim}No banner (default)${reset}
  ${cyan}2${reset}) Install update banner
`;
}

/**
 * Parse user input from the banner prompt. Returns true when the user opted
 * in. Pure function — exported for direct unit testing.
 *
 *  - Empty input or "1" → false (default: no banner).
 *  - "2" → true.
 *  - "y" / "yes" (case-insensitive) → true. Affirmative shortcuts.
 */
function parseUpdateBannerInput(answer) {
  const input = (answer == null ? '' : String(answer)).trim().toLowerCase();
  if (input === '2' || input === 'y' || input === 'yes') return true;
  return false;
}

/**
 * Build a SessionStart hook entry (settings.json shape) that runs the
 * update-banner script. Returns null when the input command is empty so
 * callers can warn-and-skip rather than writing { command: null } and
 * tripping the runtime's hook schema (#3002).
 *
 * @param {string|null} bannerCommand - Result of buildHookCommand() / localCmd().
 * @returns {{hooks: Array<{type: 'command', command: string}>}|null}
 */
function buildUpdateBannerHookEntry(bannerCommand) {
  if (!bannerCommand) return null;
  return {
    hooks: [
      {
        type: 'command',
        command: bannerCommand,
      },
    ],
  };
}

/**
 * Interactive prompt that asks the user whether to install the opt-in
 * update banner. Used by `installAllRuntimes` only when GSD's statusline
 * was declined or skipped.
 *
 * @param {boolean} isInteractive
 * @param {(shouldInstallBanner: boolean) => void} callback
 */
function handleUpdateBanner(isInteractive, callback) {
  if (!isInteractive) {
    // Never auto-install in non-interactive mode — user can re-run install
    // interactively or hand-edit settings.json to opt in later.
    callback(false);
    return;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log(buildUpdateBannerPromptText());

  rl.question(`  Choice ${dim}[1]${reset}: `, (answer) => {
    rl.close();
    callback(parseUpdateBannerInput(answer));
  });
}

/**
 * Prompt for install location
 */
function promptLocation(runtimes) {
  if (!process.stdin.isTTY) {
    console.log(`  ${yellow}Non-interactive terminal detected, defaulting to global install${reset}\n`);
    installAllRuntimes(runtimes, true, false);
    return;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  let answered = false;

  rl.on('close', () => {
    if (!answered) {
      answered = true;
      console.log(`\n  ${yellow}Installation cancelled${reset}\n`);
      process.exit(0);
    }
  });

  const pathExamples = runtimes.map(r => {
    const globalPath = getGlobalDir(r, explicitConfigDir);
    return globalPath.replace(os.homedir(), '~');
  }).join(', ');

  const localExamples = runtimes.map(r => `./${getDirName(r)}`).join(', ');

  console.log(`  ${yellow}Where would you like to install?${reset}\n\n  ${cyan}1${reset}) Global ${dim}(${pathExamples})${reset} - available in all projects
  ${cyan}2${reset}) Local  ${dim}(${localExamples})${reset} - this project only
`);

  rl.question(`  Choice ${dim}[1]${reset}: `, (answer) => {
    answered = true;
    rl.close();
    const choice = answer.trim() || '1';
    const isGlobal = choice !== '2';
    installAllRuntimes(runtimes, isGlobal, true);
  });
}

/**
 * Check whether any common shell rc file already contains a `PATH=` line
 * whose HOME-expanded value places `globalBin` on PATH (#2620).
 *
 * Parses `~/.zshrc`, `~/.bashrc`, `~/.bash_profile`, `~/.profile` (or the
 * override list in `rcFileNames`), matches `export PATH=` / bare `PATH=`
 * lines, and substitutes the common HOME forms (`$HOME`, `${HOME}`, `~`)
 * with `homeDir` before comparing each PATH segment against `globalBin`.
 *
 * Best-effort: any unreadable / malformed / non-existent rc file is ignored
 * and the fallback is the caller's existing absolute-path suggestion. Only
 * the `$HOME/…`, `${HOME}/…`, and `~/…` forms are handled — we do not try
 * to fully parse bash syntax.
 *
 * @param {string} globalBin  Absolute path to npm's global bin directory.
 * @param {string} homeDir    Absolute path used to substitute HOME / ~.
 * @param {string[]} [rcFileNames]  Override the default rc file list.
 * @returns {boolean}         true iff any rc file adds globalBin to PATH.
 */
function homePathCoveredByRc(globalBin, homeDir, rcFileNames) {
  if (!globalBin || !homeDir) return false;
  const path = require('path');
  const fs = require('fs');

  const normalise = (p) => {
    if (!p) return '';
    let n = p.replace(/[\\/]+$/g, '');
    if (n === '') n = p.startsWith('/') ? '/' : p;
    return n;
  };

  const targetAbs = normalise(path.resolve(globalBin));
  const homeAbs = path.resolve(homeDir);
  const files = rcFileNames || ['.zshrc', '.bashrc', '.bash_profile', '.profile'];

  const expandHome = (segment) => {
    let s = segment;
    s = s.replace(/\$\{HOME\}/g, homeAbs);
    s = s.replace(/\$HOME/g, homeAbs);
    if (s.startsWith('~/') || s === '~') {
      s = s === '~' ? homeAbs : path.join(homeAbs, s.slice(2));
    }
    return s;
  };

  // Match `PATH=…` (optionally prefixed with `export `). The RHS captures
  // through end-of-line; surrounding quotes are stripped before splitting.
  const assignRe = /^\s*(?:export\s+)?PATH\s*=\s*(.+?)\s*$/;

  for (const name of files) {
    const rcPath = path.join(homeAbs, name);
    let content;
    try {
      content = fs.readFileSync(rcPath, 'utf8');
    } catch {
      continue;
    }

    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.replace(/^\s+/, '');
      if (line.startsWith('#')) continue;

      const m = assignRe.exec(rawLine);
      if (!m) continue;

      let rhs = m[1];
      if ((rhs.startsWith('"') && rhs.endsWith('"')) ||
          (rhs.startsWith("'") && rhs.endsWith("'"))) {
        rhs = rhs.slice(1, -1);
      }

      for (const segment of rhs.split(':')) {
        if (!segment) continue;
        const trimmed = segment.trim();
        const expanded = expandHome(trimmed);
        if (expanded.includes('$')) continue;
        // Skip segments that are still relative after HOME expansion. A bare
        // `bin` entry (or `./bin`, `node_modules/.bin`, etc.) depends on the
        // shell's cwd at lookup time — it is NOT equivalent to `$HOME/bin`,
        // so resolving against homeAbs would produce false positives.
        if (!path.isAbsolute(expanded)) continue;
        try {
          const abs = normalise(path.resolve(expanded));
          if (abs === targetAbs) return true;
        } catch {
          // ignore unresolvable segments
        }
      }
    }
  }

  return false;
}

/**
 * Emit a PATH-export suggestion if globalBin is not already on PATH AND
 * the user's shell rc files do not already cover it via a HOME-relative
 * entry (#2620).
 *
 * Prints one of:
 *   - nothing, if `globalBin` is already present on `process.env.PATH`
 *   - a diagnostic "already covered via rc file" note, if an rc file has
 *     `export PATH="$HOME/…/bin:$PATH"` (or equivalent) and the user just
 *     needs to reopen their shell
 *   - the absolute `echo 'export PATH="…:$PATH"' >> ~/.zshrc` suggestion,
 *     if neither PATH nor any rc file covers globalBin
 *
 * Exported for tests; the installer calls this from finishInstall.
 *
 * @param {string} globalBin  Absolute path to npm's global bin directory.
 * @param {string} homeDir    Absolute HOME path.
 */
function maybeSuggestPathExport(globalBin, homeDir) {
  if (!globalBin || !homeDir) return;
  const path = require('path');

  const pathEnv = process.env.PATH || '';
  const targetAbs = path.resolve(globalBin).replace(/[\\/]+$/g, '') || globalBin;
  const onPath = pathEnv.split(path.delimiter).some((seg) => {
    if (!seg) return false;
    const abs = path.resolve(seg).replace(/[\\/]+$/g, '') || seg;
    return abs === targetAbs;
  });
  if (onPath) return;

  if (homePathCoveredByRc(globalBin, homeDir)) {
    console.log(`  ${yellow}⚠${reset} ${bold}gsd-sdk${reset}'s directory is already on your PATH via an rc file entry — try reopening your shell (or ${cyan}source ~/.zshrc${reset}).`);
    return;
  }

  console.log('');
  console.log(`  ${yellow}⚠${reset} ${bold}${globalBin}${reset} is not on your PATH.`);
  console.log(`    Add it with one of:`);
  console.log(`      ${cyan}echo 'export PATH="${globalBin}:$PATH"' >> ~/.zshrc${reset}`);
  console.log(`      ${cyan}echo 'export PATH="${globalBin}:$PATH"' >> ~/.bashrc${reset}`);
  console.log('');
}

/**
 * Verify the prebuilt SDK dist is present and the gsd-sdk shim is wired up.
 *
 * As of fix/2441-sdk-decouple, sdk/dist/ is shipped prebuilt inside the
 * get-shit-done-cc npm tarball. The parent package declares a bin entry
 * "gsd-sdk": "bin/gsd-sdk.js" so npm chmods the shim correctly when
 * installing from a packed tarball — eliminating the mode-644 failure
 * (issue #2453) and the build-from-source failure modes (#2439, #2441).
 *
 * This function verifies the invariant: sdk/dist/cli.js exists and is
 * executable. If the execute bit is missing (possible in dev/clone setups
 * where sdk/dist was committed without +x), we fix it in-place.
 *
 * --no-sdk skips the check entirely (back-compat).
 * --sdk forces the check even if it would otherwise be skipped.
 */
/**
 * Classify the install context for the SDK directory.
 *
 * Distinguishes three shapes the installer must handle differently when
 * `sdk/dist/` is missing:
 *
 *   - `tarball` + `npxCache: true`
 *       User ran `npx get-shit-done-cc@latest`. sdk/ lives under
 *       `<npm-cache>/_npx/<hash>/node_modules/get-shit-done-cc/sdk` which
 *       is treated as read-only by npm/npx on Windows (#2649). We MUST
 *       NOT attempt a nested `npm install` there — it will fail with
 *       EACCES/EPERM and produce the misleading "Failed to npm install
 *       in sdk/" error the user reported. Point at the global upgrade.
 *
 *   - `tarball` + `npxCache: false`
 *       User ran a global install (`npm i -g get-shit-done-cc`). sdk/dist
 *       ships in the published tarball; if it's missing, the published
 *       artifact itself is broken (see #2647). Same user-facing fix:
 *       upgrade to latest.
 *
 *   - `dev-clone`
 *       Developer running from a git clone. Keep the existing "cd sdk &&
 *       npm install && npm run build" hint — the user is expected to run
 *       that themselves. The installer itself never shells out to npm.
 *
 * Detection heuristics are path-based and side-effect-free: we look for
 * `_npx` and `node_modules` segments that indicate a packaged install,
 * and for a `.git` directory nearby that indicates a clone. A best-effort
 * write probe detects read-only filesystems (tmpfile create + unlink);
 * probe failures are treated as read-only.
 */
function classifySdkInstall(sdkDir) {
  const path = require('path');
  const fs = require('fs');
  const segments = sdkDir.split(/[\\/]+/);
  const npxCache = segments.includes('_npx');
  const inNodeModules = segments.includes('node_modules');
  const parent = path.dirname(sdkDir);
  const hasGitNearby = fs.existsSync(path.join(parent, '.git'));

  let mode;
  if (hasGitNearby && !npxCache && !inNodeModules) {
    mode = 'dev-clone';
  } else if (npxCache || inNodeModules) {
    mode = 'tarball';
  } else {
    mode = 'dev-clone';
  }

  let readOnly = npxCache; // assume true for npx cache
  if (!readOnly) {
    try {
      const probe = path.join(sdkDir, `.gsd-write-probe-${process.pid}`);
      fs.writeFileSync(probe, '');
      fs.unlinkSync(probe);
    } catch {
      readOnly = true;
    }
  }

  return { mode, npxCache, readOnly };
}

/**
 * #2974: pure builder for the SDK fail-fast report. Returns a structured IR
 * with everything the renderer needs PLUS everything tests need to assert
 * on. Tests can call `buildSdkFailFastReport(sdkDir, sdkCliPath)` directly
 * and assert on `report.reason`, `report.context`, `report.fix_command`
 * etc. without intercepting console.error or matching against rendered
 * text.
 *
 * Shape (frozen contract — extending requires a new test):
 *   {
 *     ok: false,
 *     reason: 'sdk_fail_fast',                 // ERROR_REASON.SDK_FAIL_FAST
 *     context: 'npx-cache' | 'tarball' | 'dev-clone',
 *     missing_path: '<path>/sdk/dist/cli.js',
 *     missing_artifact: 'sdk/dist',
 *     fix_command: 'npm install -g get-shit-done-cc@latest' | 'cd sdk && npm install && npm run build',
 *     attempted_nested_install: false,         // contract: never true
 *   }
 */
function buildSdkFailFastReport(sdkDir, sdkCliPath) {
  const ctx = classifySdkInstall(sdkDir);
  let context, fix_command;
  if (ctx.mode === 'tarball') {
    context = ctx.npxCache ? 'npx-cache' : 'tarball';
    fix_command = 'npm install -g get-shit-done-cc@latest';
  } else {
    context = 'dev-clone';
    fix_command = 'cd sdk && npm install && npm run build';
  }
  return {
    ok: false,
    reason: 'sdk_fail_fast',
    context,
    missing_path: sdkCliPath,
    missing_artifact: 'sdk/dist',
    fix_command,
    attempted_nested_install: false,
  };
}

/**
 * Renderer for the structured fail-fast report. Text formatting only —
 * tests never call this. Splits the IR fields back into the same human-
 * readable lines the previous shape produced.
 */
function renderSdkFailFastReport(ir) {
  const bar = '━'.repeat(72);
  const redBold = `${red}${bold}`;
  console.error('');
  console.error(`${redBold}${bar}${reset}`);
  console.error(`${redBold}  ✗ GSD SDK dist not found — /gsd-* commands will not work${reset}`);
  console.error(`${redBold}${bar}${reset}`);
  console.error(`  ${red}Reason:${reset} ${ir.missing_artifact}/cli.js not found at ${ir.missing_path}`);
  console.error('');
  if (ir.context === 'npx-cache') {
    console.error(`  Detected read-only npx cache install (${dim}${path.dirname(ir.missing_path).replace(/\/dist$/, '')}${reset}).`);
    console.error(`  The installer will ${bold}not${reset} attempt \`npm install\` inside the npx cache.`);
    console.error('');
    console.error(`  Fix: install a version that ships sdk/dist/ globally:`);
    console.error(`    ${cyan}${ir.fix_command}${reset}`);
    console.error(`  Or, if you prefer a one-shot run, clear the npx cache first:`);
    console.error(`    ${cyan}npx --yes get-shit-done-cc@latest${reset}`);
    console.error(`  Or build from source (git clone):`);
    console.error(`    ${cyan}git clone https://github.com/gsd-build/get-shit-done && cd get-shit-done/sdk && npm install && npm run build${reset}`);
  } else if (ir.context === 'tarball') {
    console.error(`  The published tarball appears to be missing sdk/dist/ (see #2647).`);
    console.error('');
    console.error(`  Fix: install a version that ships sdk/dist/ globally:`);
    console.error(`    ${cyan}${ir.fix_command}${reset}`);
    console.error(`  Or build from source (git clone):`);
    console.error(`    ${cyan}git clone https://github.com/gsd-build/get-shit-done && cd get-shit-done/sdk && npm install && npm run build${reset}`);
  } else {
    console.error(`  Running from a git clone — build the SDK first:`);
    console.error(`    ${cyan}${ir.fix_command}${reset}`);
  }
  console.error(`${redBold}${bar}${reset}`);
  console.error('');
}

function installSdkIfNeeded(opts) {
  opts = opts || {};
  if (hasNoSdk && !opts.sdkDir) {
    console.log(`\n  ${dim}Skipping GSD SDK check (--no-sdk)${reset}`);
    return;
  }

  const path = require('path');
  const fs = require('fs');

  const sdkDir = opts.sdkDir || path.resolve(__dirname, '..', 'sdk');
  const sdkCliPath = path.join(sdkDir, 'dist', 'cli.js');

  // #2678 / #2829: local installs do not write to global node_modules, so we
  // cannot fall through to the global-install error path. But the parent
  // package (which carries bin/gsd-sdk.js and sdk/dist/cli.js) IS available
  // wherever the installer is running from — npx cache, npm-global, or git
  // clone. The shim resolves sdk/dist/cli.js relative to its own __dirname,
  // so a self-link into a user-writable PATH dir makes `gsd-sdk` callable
  // from local-mode installs too. Only when the dist is genuinely missing
  // do we bail out with a non-fatal warning.
  if (opts.isLocal && !fs.existsSync(sdkCliPath)) {
    console.warn(`\n  ${yellow}⚠${reset}  Skipping SDK check for local install — sdk/dist/cli.js not found at ${sdkCliPath}.`);
    return;
  }

  if (!fs.existsSync(sdkCliPath)) {
    const ir = buildSdkFailFastReport(sdkDir, sdkCliPath);
    renderSdkFailFastReport(ir);
    process.exit(1);
  }

  // Ensure execute bit is set. tsc emits files at 0o644; git clone preserves
  // whatever mode was committed. Fix in-place so node-invoked paths work too.
  try {
    const stat = fs.statSync(sdkCliPath);
    const isExecutable = !!(stat.mode & 0o111);
    if (!isExecutable) {
      fs.chmodSync(sdkCliPath, stat.mode | 0o111);
    }
  } catch {
    // Non-fatal: if chmod fails (e.g. read-only fs) the shim still works via
    // `node sdkCliPath` invocation in bin/gsd-sdk.js.
  }

  // #2775: do not assert "GSD SDK ready" until `gsd-sdk` actually resolves on
  // PATH. `npx get-shit-done-cc` only links the package's primary bin; the
  // secondary `gsd-sdk` shim is left dangling under the npx cache and is NOT
  // callable as a bare command. The previous file-presence-only check was a
  // strictly weaker invariant than the one workflows depend on
  // (`command -v gsd-sdk` resolving), and led to a false ✓ in npx-cache
  // installs (issue #2775).
  const shimSrc = path.resolve(__dirname, 'gsd-sdk.js');
  let onPath = isGsdSdkOnPath();

  // Track WHERE we wrote the shim so the diagnostic can be specific even
  // when isGsdSdkOnPath() returns false because the write target isn't on
  // PATH (#3011: Windows users hit this when npm's global bin dir is
  // populated but not on every shell's PATH — Git Bash vs PowerShell vs
  // cmd.exe each read PATH from different sources).
  let shimDir = null;
  if (!onPath) {
    // Try to materialize the shim into a user-writable PATH location so the
    // installer can deliver on the success message without requiring the user
    // to run `npm install -g` separately. Picks the first PATH entry that
    // looks like a user-owned bin dir; falls back to ~/.local/bin even if
    // it's not on PATH (then a follow-up suggestion is printed).
    const linked = trySelfLinkGsdSdk(shimSrc);
    if (linked) {
      shimDir = path.dirname(linked);
      onPath = isGsdSdkOnPath();
      if (onPath) {
        console.log(`  ${dim}↪ linked gsd-sdk → ${linked}${reset}`);
      }
    }
  }

  // #3020: cross-shell PATH verification. Even when the install-time
  // process.env.PATH walk found the shim, the user's later interactive
  // shells may have a different PATH — Windows cross-shell .cmd/no-ext
  // mismatch, POSIX ~/.local/bin missing from login shell, or node-
  // version-manager PATH shims. Probe the user's login shell PATH and
  // require the shim to be reachable there too before claiming ✓.
  // POSIX-only probe; on Windows getUserShellPath() returns null and
  // we trust the existing check (Windows-specific fix is separate).
  const userShellPath = getUserShellPath();
  if (onPath && userShellPath !== null) {
    const userSees = isGsdSdkOnPath(userShellPath);
    if (!userSees) {
      onPath = false;
    }
  }

  if (onPath) {
    console.log(`  ${green}✓${reset} GSD SDK ready (sdk/dist/cli.js)`);
  } else {
    // #3011: actionable diagnostic. The previous shape printed a generic
    // "not on your PATH" message that didn't tell the user where to look.
    // formatSdkPathDiagnostic produces a typed IR that we then render to
    // stdout; tests assert on the IR (no source-grep, no console capture).
    const ir = formatSdkPathDiagnostic({
      shimDir,
      platform: process.platform,
      runDir: __dirname,
    });
    console.log('');
    console.log(`  ${yellow}⚠${reset} GSD SDK files are present but ${bold}gsd-sdk${reset} is not on your PATH.`);
    console.log(`    Workflows that call ${cyan}gsd-sdk query …${reset} will fail with "command not found".`);
    if (ir.shimLocationLine) console.log(`    ${ir.shimLocationLine}`);
    for (const line of ir.actionLines) console.log(`    ${line}`);
    if (ir.npxNoteLines.length > 0) {
      for (const line of ir.npxNoteLines) console.log(`    ${line}`);
    }
    console.log('');
  }

  // #2620: warn if npm's global bin is not on PATH, suppressing the
  // absolute-path suggestion when the user's rc already covers it via
  // a HOME-relative entry (e.g. `export PATH="$HOME/.npm-global/bin:$PATH"`).
  try {
    const cp = require('child_process');
    const npmPrefix = cp.execSync('npm prefix -g', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    if (npmPrefix) {
      // On Windows npm prefix IS the bin dir; on POSIX it's `${prefix}/bin`.
      const globalBin = process.platform === 'win32' ? npmPrefix : path.join(npmPrefix, 'bin');
      maybeSuggestPathExport(globalBin, os.homedir());
    }
  } catch {
    // npm not available / exec failed — silently skip the PATH advice.
  }
}

/**
 * #2775 helper: check whether a callable `gsd-sdk` exists on a PATH.
 *
 * Pure PATH walk (no spawn) — we look for a regular file or symlink named
 * `gsd-sdk` (or `gsd-sdk.cmd`/`.exe` on Windows) in any directory on PATH and
 * verify it carries the execute bit on POSIX. Avoids paying spawn cost and
 * avoids the chicken-and-egg of needing to run the not-yet-installed binary.
 *
 * #3020: accepts an optional explicit PATH string. The install subprocess's
 * process.env.PATH is not the same set the user's later interactive shells
 * see (Windows cross-shell, POSIX ~/.local/bin, node-version-manager
 * shims). Callers can pass the user-shell PATH from getUserShellPath() to
 * verify the shim is reachable from the runtime shell, not just the
 * install context. Zero-arg form preserves existing behavior.
 */
function isGsdSdkOnPath(pathString) {
  const path = require('path');
  const fs = require('fs');
  // Type-guard the explicit input (#3028 CR): callers may pass null
  // (getUserShellPath() can return null), and `null.split()` throws.
  // Only honor pathString when it's a string; fall back otherwise.
  const pathEnv = typeof pathString === 'string' ? pathString : (process.env.PATH || '');
  const exts = process.platform === 'win32' ? ['.cmd', '.exe', '.bat', ''] : [''];
  for (const seg of pathEnv.split(path.delimiter)) {
    if (!seg) continue;
    for (const ext of exts) {
      const candidate = path.join(seg, `gsd-sdk${ext}`);
      try {
        const st = fs.statSync(candidate);
        if (st.isFile()) {
          if (process.platform === 'win32') return true;
          if ((st.mode & 0o111) !== 0) return true;
        }
      } catch {
        // missing / EACCES on dir — keep scanning.
      }
    }
  }
  return false;
}

/**
 * #3020: probe the user's login shell to learn the PATH that will be
 * visible at workflow runtime.
 *
 * The install subprocess inherits process.env.PATH from npm/npx, which
 * may include directories the user's interactive shells do not (e.g.
 * ~/.local/bin auto-injected by npm-prefix tooling, or nvm-shimmed
 * paths). Asserting `gsd-sdk` is on the install-subprocess PATH is a
 * weaker invariant than the runtime contract — workflows shell out via
 * `bash -c "gsd-sdk …"`, and that bash inherits PATH from the user's
 * login shell.
 *
 * Uses `$SHELL -lc 'printf %s "$PATH"'` on POSIX. Returns null on Windows
 * (cross-shell PATH probing requires a different strategy — Git Bash
 * vs PowerShell vs cmd.exe each read PATH from different sources, and
 * a future revision can build a Windows-aware probe). Returns null
 * when $SHELL is unset, when the spawn fails, or when the result is
 * empty — callers must fall back to process.env.PATH in those cases.
 *
 * Synchronous so it can be called from the existing post-install check
 * without restructuring the whole flow as async.
 */
function getUserShellPath() {
  if (process.platform === 'win32') return null;
  const shellEnv = typeof process.env.SHELL === 'string' ? process.env.SHELL : '';
  if (!shellEnv) return null;
  const cp = require('child_process');
  try {
    const out = cp.execFileSync(shellEnv, ['-lc', 'printf %s "$PATH"'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      // 2-second cap so a misconfigured rc file (e.g. interactive prompt)
      // can't hang the install. The probe is best-effort — null on timeout
      // is the safe fallback.
      timeout: 2000,
    });
    // #3028 CR: login startup scripts can print banners / motd / stale
    // log lines BEFORE the printf, polluting stdout. Take the LAST
    // non-empty line as the PATH candidate so noise doesn't flip the
    // cross-shell check to false. PATH itself is single-line.
    const lines = String(out || '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    const candidate = lines.length > 0 ? lines[lines.length - 1] : '';
    return candidate.length > 0 ? candidate : null;
  } catch {
    return null;
  }
}

/**
 * #2775 helper: attempt to materialize the `gsd-sdk` shim at a user-writable
 * PATH location. Returns the absolute path created on success, or null if no
 * suitable location was usable.
 *
 * Strategy (POSIX): prefer ~/.local/bin (creating it if absent — many distros
 * already have it on PATH via .profile). Fall back to the first PATH entry
 * under HOME we can write to. Skip on Windows (npm install -g is the right
 * primitive there; we don't try to fabricate a .cmd shim).
 */
function trySelfLinkGsdSdk(shimSrc) {
  if (process.platform === 'win32') {
    return trySelfLinkGsdSdkWindows(shimSrc);
  }
  const path = require('path');
  const fs = require('fs');
  const home = os.homedir();
  if (!home) return null;

  const localBin = path.join(home, '.local', 'bin');
  const pathCandidates = [];
  const pathEnv = process.env.PATH || '';
  for (const seg of pathEnv.split(path.delimiter)) {
    if (!seg) continue;
    const abs = path.resolve(seg);
    if (abs.startsWith(home + path.sep) && !pathCandidates.includes(abs)) {
      pathCandidates.push(abs);
    }
  }
  // If ~/.local/bin is already on PATH, keep it first (preserves existing UX
  // for the common case). Otherwise prefer PATH-backed HOME dirs first so we
  // self-link somewhere actually on PATH, falling back to ~/.local/bin only
  // when no on-PATH HOME dir is writable. (#2775 CodeRabbit follow-up)
  const candidates = pathCandidates.includes(localBin)
    ? [localBin, ...pathCandidates.filter((dir) => dir !== localBin)]
    : [...pathCandidates, localBin];

  for (const dir of candidates) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      const target = path.join(dir, 'gsd-sdk');
      // Replace any existing entry — it may be stale (prior install of an
      // older version pointing at a now-absent shim).
      try { fs.unlinkSync(target); } catch {}
      try {
        fs.symlinkSync(shimSrc, target);
      } catch {
        // Filesystems that don't support symlinks (some FUSE mounts): write a
        // tiny wrapper that `require()`s the real shim by absolute path. We
        // cannot copyFileSync(shimSrc, target) — bin/gsd-sdk.js resolves the
        // CLI via `path.resolve(__dirname, '..', 'sdk', 'dist', 'cli.js')`,
        // and after a copy `__dirname` would be the link directory (e.g.
        // ~/.local/bin), causing the resolved CLI path to be broken
        // (~/.local/sdk/dist/cli.js). Wrapping via require() preserves
        // __dirname resolution because the require runs against shimSrc's
        // own location. (#2775 CodeRabbit follow-up)
        fs.writeFileSync(
          target,
          `#!/usr/bin/env node\nrequire(${JSON.stringify(shimSrc)});\n`,
        );
        try { fs.chmodSync(target, 0o755); } catch {}
      }
      return target;
    } catch {
      // permission / EROFS — try next candidate.
    }
  }
  return null;
}

/**
 * #2962: Windows counterpart to trySelfLinkGsdSdk. Prior to this, the function
 * unconditionally returned null on Windows ("we don't try to fabricate a .cmd
 * shim there"), which left `--sdk --global` installs without a callable
 * `gsd-sdk` on PATH despite the installer reporting success.
 *
 * Strategy: discover npm's global bin directory via `npm prefix -g` (which on
 * Windows IS the bin dir, no `bin/` suffix — see line 8721) and write the same
 * three-file shim set npm itself emits: `gsd-sdk.cmd` (cmd.exe), `gsd-sdk.ps1`
 * (PowerShell), and a Bash wrapper named `gsd-sdk` (for Cygwin/MSYS/Git-Bash).
 * Each shim invokes `node "<absolute path to bin/gsd-sdk.js>"` with passed
 * args so the shim location is decoupled from the SDK location — same logical
 * structure as the POSIX wrapper-via-require() fallback above.
 *
 * Returns the .cmd file path on success (the primary handle the installer's
 * onPath check looks for), null otherwise.
 */
/**
 * Pure builder: compute the structured Windows shim triple from a shimSrc path.
 * No filesystem I/O, no spawn — produces the IR that `trySelfLinkGsdSdkWindows`
 * then renders to disk. Exposed for tests so assertions can run against typed
 * fields (interpreter, shimAbs, eol, fileNames) instead of substring matches
 * over rendered shim text.
 */
function buildWindowsShimTriple(shimSrc) {
  const path = require('path');
  const shimAbs = path.resolve(shimSrc);
  // JSON.stringify produces a double-quoted string with backslash+quote
  // escaping — the safe quoting form for cmd.exe and PowerShell paths alike.
  const shimQuoted = JSON.stringify(shimAbs);

  const invocation = {
    interpreter: 'node',
    target: shimAbs,
  };

  // Renderers are template literals — the only place text is constructed.
  // Tests do not parse these strings; they assert on the typed fields above.
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

/**
 * #3011: pure builder for the SDK-not-on-PATH diagnostic. Takes the
 * resolved shim directory (or null if write failed), the current platform,
 * and the install.js __dirname (used to detect npx-cache invocation).
 * Returns a typed IR with:
 *   - shimLocationLine: prose mentioning where the shim is (or empty if no
 *     write happened)
 *   - actionLines: ordered list of commands the user can run to add the
 *     shim dir to their PATH (platform-specific shells), or fallback to
 *     `npm install -g` advice when no shim was written
 *   - npxNoteLines: ordered list of lines warning about npx persistence
 *     when runDir is under an `_npx` cache segment
 *
 * Tests assert on the typed fields (paths/commands), not on rendered
 * console output. Pure function — no fs, no spawn, no console.
 */
function formatSdkPathDiagnostic({ shimDir, platform, runDir }) {
  const path = require('path');
  const isWin32 = platform === 'win32';
  // Detect either path separator — the test fixtures pass Windows-style
  // paths while running on POSIX, and real users hit either depending on
  // their npm/npx setup. Anchor on `_npx` between separators.
  const isNpx = typeof runDir === 'string' &&
    (runDir.includes('/_npx/') || runDir.includes('\\_npx\\'));

  const shimLocationLine = shimDir ? `Shim written to: ${shimDir}` : '';
  const actionLines = [];

  if (shimDir) {
    // Escape shimDir for each shell context. A path containing a single
    // quote (e.g. C:\Users\O'Neil\AppData\...) would otherwise generate
    // broken commands the user can't paste:
    //   - PowerShell single-quoted string: '' escapes a literal single quote
    //   - bash inside outer single quotes: '\'' (close, escaped quote, reopen)
    //   - POSIX export inside double quotes: escape \ $ " ` so the path is
    //     copied verbatim and $PATH (which is OUTSIDE the escaped substring)
    //     still expands at paste time.
    const psShimDir   = shimDir.replace(/'/g, "''");
    const bashShimDir = shimDir.replace(/\\/g, '/').replace(/'/g, "'\\''");
    const posixShimDir = shimDir.replace(/[\\$"`]/g, '\\$&');
    actionLines.push('Add that directory to your PATH and restart your shell.');
    if (isWin32) {
      actionLines.push(`PowerShell: [Environment]::SetEnvironmentVariable('PATH', '${psShimDir};' + [Environment]::GetEnvironmentVariable('PATH', 'User'), 'User')`);
      // setx PATH "...;%PATH%" silently truncates above 1024 chars and
      // expands %PATH% / %SystemRoot% to literals (turning REG_EXPAND_SZ
      // into REG_SZ), permanently breaking lazy variable references.
      // Invoke PowerShell from cmd.exe with the same SetEnvironmentVariable
      // call as the PowerShell line so cmd.exe users get a safe command.
      actionLines.push(`cmd.exe   : powershell -Command "[Environment]::SetEnvironmentVariable('PATH', '${psShimDir};' + [Environment]::GetEnvironmentVariable('PATH', 'User'), 'User')"`);
      actionLines.push(`Git Bash  : echo 'export PATH="${bashShimDir}:$PATH"' >> ~/.bashrc`);
    } else {
      actionLines.push(`export PATH="${posixShimDir}:$PATH"`);
    }
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

  return { shimLocationLine, actionLines, npxNoteLines, isNpx, isWin32 };
}

function trySelfLinkGsdSdkWindows(shimSrc) {
  const path = require('path');
  const fs = require('fs');
  const cp = require('child_process');

  let npmPrefix;
  try {
    // On Windows, `npm` is `npm.cmd` — Node's child_process docs explicitly
    // call out that .cmd/.bat files cannot be spawned via execFile/execFileSync
    // without a shell ("Spawning .bat and .cmd files on Windows" section).
    // Match the existing convention at line ~8718 which uses execSync for the
    // same `npm prefix -g` lookup. Inputs here are static literals, so shell
    // interpolation is not an injection vector.
    npmPrefix = cp
      .execSync('npm prefix -g', {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      })
      .trim();
  } catch {
    return null;
  }
  if (!npmPrefix || !fs.existsSync(npmPrefix)) return null;

  // Verify writability before producing partial shim sets.
  try {
    fs.mkdirSync(npmPrefix, { recursive: true });
    const probe = path.join(npmPrefix, '.gsd-sdk-write-probe');
    fs.writeFileSync(probe, '');
    fs.unlinkSync(probe);
  } catch {
    return null;
  }

  const triple = buildWindowsShimTriple(shimSrc);
  const targets = {
    cmd: path.join(npmPrefix, triple.fileNames.cmd),
    ps1: path.join(npmPrefix, triple.fileNames.ps1),
    sh: path.join(npmPrefix, triple.fileNames.sh),
  };

  try {
    // Replace any existing shims — they may be stale (prior install of an
    // older version pointing at a now-absent shim path).
    for (const target of Object.values(targets)) {
      try { fs.unlinkSync(target); } catch {}
    }
    fs.writeFileSync(targets.cmd, triple.render.cmd());
    fs.writeFileSync(targets.ps1, triple.render.ps1());
    fs.writeFileSync(targets.sh, triple.render.sh());
    // chmod is a no-op on Windows-native node but harmless; sets exec bit on
    // WSL-mounted filesystems where Bash users live.
    try { fs.chmodSync(targets.sh, 0o755); } catch {}
    return targets.cmd;
  } catch {
    // Partial-write on permission flap — best-effort cleanup so the next run
    // starts from a clean slate.
    for (const target of Object.values(targets)) {
      try { fs.unlinkSync(target); } catch {}
    }
    return null;
  }
}

/**
 * Install GSD for all selected runtimes
 */
function installAllRuntimes(runtimes, isGlobal, isInteractive) {
  const results = [];

  for (const runtime of runtimes) {
    const result = install(isGlobal, runtime);
    results.push(result);
  }

  const statuslineRuntimes = ['claude', 'gemini'];
  const primaryStatuslineResult = results.find(r => statuslineRuntimes.includes(r.runtime));

  const finalize = (shouldInstallStatusline, shouldInstallBanner) => {
    // Verify sdk/dist/cli.js is present and executable. The dist is shipped
    // prebuilt in the tarball (fix/2441-sdk-decouple); gsd-sdk reaches users via
    // the parent package's bin/gsd-sdk.js shim, so no sub-install is needed.
    // Skip with --no-sdk. Skip with isLocal (#2678 — local installs don't own global npm).
    installSdkIfNeeded({ isLocal: !isGlobal });

    const printSummaries = () => {
      for (const result of results) {
        const useStatusline = statuslineRuntimes.includes(result.runtime) && shouldInstallStatusline;
        finishInstall(
          result.settingsPath,
          result.settings,
          result.statuslineCommand,
          useStatusline,
          result.runtime,
          isGlobal,
          result.configDir,
          { shouldInstallBanner: !!shouldInstallBanner, bannerCommand: result.updateBannerCommand }
        );
      }
    };

    printSummaries();
  };

  // Statusline first; if it won't actually be installed (declined, or local
  // install without --force-statusline silently skips it per #2248), offer
  // the opt-in update banner (#2795) as the secondary surface for update
  // notifications. Skip the banner prompt entirely when no runtime in this
  // install set can host the banner (e.g. Codex/Copilot/Cursor/Windsurf/
  // Trae/Cline-only installs whose updateBannerCommand is null).
  //
  // CR #3035: gate on actual installability — `shouldInstallStatusline`
  // returned by handleStatusline is the raw user choice, but
  // `finishInstall` later skips the statusline write on local installs
  // unless --force-statusline is set. Passing the raw flag to
  // continueAfterStatusline previously caused two bugs: (1) interactive
  // local installs got neither a statusline nor a banner offer, and (2)
  // banner-incapable runtimes got prompted even though every
  // updateBannerCommand was null.
  const canInstallBanner = results.some((r) => r && r.updateBannerCommand);
  const continueAfterStatusline = (shouldInstallStatusline) => {
    const willInstallStatusline =
      shouldInstallStatusline && (isGlobal || forceStatusline);
    if (willInstallStatusline) {
      finalize(true, false);
      return;
    }
    if (!canInstallBanner) {
      finalize(shouldInstallStatusline, false);
      return;
    }
    handleUpdateBanner(isInteractive, (shouldInstallBanner) => {
      finalize(shouldInstallStatusline, shouldInstallBanner);
    });
  };

  if (primaryStatuslineResult) {
    handleStatusline(primaryStatuslineResult.settings, isInteractive, continueAfterStatusline);
  } else if (canInstallBanner) {
    // No statusline-capable runtime, but at least one runtime can host the
    // banner — still offer it.
    handleUpdateBanner(isInteractive, (shouldInstallBanner) => {
      finalize(false, shouldInstallBanner);
    });
  } else {
    // Nothing to prompt about — no statusline, no banner-capable runtime.
    finalize(false, false);
  }
}

// Test-only exports — skip main logic when loaded as a module for testing
if (process.env.GSD_TEST_MODE) {
  module.exports = {
    yamlIdentifier,
    computePathPrefix,
    getCodexSkillAdapterHeader,
    convertClaudeCommandToCursorSkill,
    convertClaudeAgentToCursorAgent,
    convertClaudeToGeminiMarkdown,
    convertSlashCommandsToGeminiMentions,
    _resetGsdCommandRoster,
    convertClaudeToGeminiAgent,
    convertClaudeAgentToCodexAgent,
    generateCodexAgentToml,
    generateCodexConfigBlock,
    stripGsdFromCodexConfig,
    migrateCodexHooksMapFormat,
    stripStaleGsdHookBlocks,
    hasUserNamespacedAotHooks,
    parseTomlToObject,
    validateCodexConfigSchema,
    mergeCodexConfig,
    installCodexConfig,
    readGsdRuntimeProfileResolver,
    readGsdEffectiveModelOverrides,
    install,
    uninstall,
    installSdkIfNeeded,
    buildSdkFailFastReport,
    renderSdkFailFastReport,
    classifySdkInstall,
    convertClaudeCommandToCodexSkill,
    convertClaudeToOpencodeFrontmatter,
    convertClaudeToKiloFrontmatter,
    configureOpencodePermissions,
    neutralizeAgentReferences,
    GSD_CODEX_MARKER,
    CODEX_AGENT_SANDBOX,
    getDirName,
    getGlobalDir,
    getConfigDirFromHome,
    resolveKiloConfigPath,
    configureKiloPermissions,
    claudeToCopilotTools,
    convertCopilotToolName,
    convertClaudeToCopilotContent,
    convertClaudeCommandToCopilotSkill,
    convertClaudeAgentToCopilotAgent,
    copyCommandsAsCopilotSkills,
    GSD_COPILOT_INSTRUCTIONS_MARKER,
    GSD_COPILOT_INSTRUCTIONS_CLOSE_MARKER,
    mergeCopilotInstructions,
    stripGsdFromCopilotInstructions,
    convertClaudeToAntigravityContent,
    convertClaudeCommandToAntigravitySkill,
    convertClaudeAgentToAntigravityAgent,
    copyCommandsAsAntigravitySkills,
    convertClaudeCommandToClaudeSkill,
    skillFrontmatterName,
    copyCommandsAsClaudeSkills,
    convertClaudeToWindsurfMarkdown,
    convertClaudeCommandToWindsurfSkill,
    convertClaudeAgentToWindsurfAgent,
    copyCommandsAsWindsurfSkills,
    convertClaudeToAugmentMarkdown,
    convertClaudeCommandToAugmentSkill,
    convertClaudeAgentToAugmentAgent,
    copyCommandsAsAugmentSkills,
    convertClaudeToTraeMarkdown,
    convertClaudeCommandToTraeSkill,
    convertClaudeAgentToTraeAgent,
    copyCommandsAsTraeSkills,
    convertClaudeToCodebuddyMarkdown,
    convertClaudeCommandToCodebuddySkill,
    convertClaudeAgentToCodebuddyAgent,
    copyCommandsAsCodebuddySkills,
    convertClaudeToCliineMarkdown,
    convertClaudeAgentToClineAgent,
    writeManifest,
    reportLocalPatches,
    validateHookFields,
    preserveUserArtifacts,
    restoreUserArtifacts,
    migrateLegacyDevPreferencesToSkill,
    populatePristineDir,
    USER_OWNED_ARTIFACTS,
    finishInstall,
    trySelfLinkGsdSdk,
    trySelfLinkGsdSdkWindows,
    buildWindowsShimTriple,
    formatSdkPathDiagnostic,
    isGsdSdkOnPath,
    getUserShellPath,
    homePathCoveredByRc,
    maybeSuggestPathExport,
    runtimeMap,
    allRuntimes,
    parseRuntimeInput,
    buildRuntimePromptText,
    buildUpdateBannerPromptText,
    parseUpdateBannerInput,
    buildUpdateBannerHookEntry,
    buildHookCommand,
    resolveNodeRunner,
    rewriteLegacyManagedNodeHookCommands,
    buildCodexHookBlock,
    rewriteLegacyCodexHookBlock,
  };
} else {

  // Main logic
  if (hasSkillsRoot) {
    // Print the skills root directory for a given runtime (used by /gsd-sync-skills).
    // Usage: node install.js --skills-root <runtime>
    const runtimeArg = args[args.indexOf('--skills-root') + 1];
    if (!runtimeArg || runtimeArg.startsWith('--')) {
      console.error('Usage: node install.js --skills-root <runtime>');
      process.exit(1);
    }
    const globalDir = getGlobalDir(runtimeArg, null);
    // Hermes nests GSD skills under skills/gsd/ as a single category (#2841).
    // Other runtimes use a flat skills/ root.
    const skillsRoot = runtimeArg === 'hermes'
      ? path.join(globalDir, 'skills', 'gsd')
      : path.join(globalDir, 'skills');
    console.log(skillsRoot);
  } else if (hasGlobal && hasLocal) {
    console.error(`  ${yellow}Cannot specify both --global and --local${reset}`);
    process.exit(1);
  } else if (explicitConfigDir && hasLocal) {
    console.error(`  ${yellow}Cannot use --config-dir with --local${reset}`);
    process.exit(1);
  } else if (hasUninstall) {
    if (!hasGlobal && !hasLocal) {
      console.error(`  ${yellow}--uninstall requires --global or --local${reset}`);
      process.exit(1);
    }
    const runtimes = selectedRuntimes.length > 0 ? selectedRuntimes : ['claude'];
    for (const runtime of runtimes) {
      uninstall(hasGlobal, runtime);
    }
  } else if (selectedRuntimes.length > 0) {
    if (!hasGlobal && !hasLocal) {
      promptLocation(selectedRuntimes);
    } else {
      installAllRuntimes(selectedRuntimes, hasGlobal, false);
    }
  } else if (hasGlobal || hasLocal) {
    // Default to Claude if no runtime specified but location is
    installAllRuntimes(['claude'], hasGlobal, false);
  } else {
    // Interactive
    if (!process.stdin.isTTY) {
      console.log(`  ${yellow}Non-interactive terminal detected, defaulting to Claude Code global install${reset}\n`);
      installAllRuntimes(['claude'], true, false);
    } else {
      promptRuntime((runtimes) => {
        promptLocation(runtimes);
      });
    }
  }

} // end of else block for GSD_TEST_MODE
