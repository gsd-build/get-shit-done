#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');

// Colors
const cyan = '\x1b[36m';
const green = '\x1b[32m';
const yellow = '\x1b[33m';
const dim = '\x1b[2m';
const reset = '\x1b[0m';

// Get version from package.json
const pkg = require('../package.json');

const banner = `
${cyan}   ██████╗ ███████╗██████╗
  ██╔════╝ ██╔════╝██╔══██╗
  ██║  ███╗███████╗██║  ██║
  ██║   ██║╚════██║██║  ██║
  ╚██████╔╝███████║██████╔╝
   ╚═════╝ ╚══════╝╚═════╝${reset}

  Get Shit Done ${dim}v${pkg.version}${reset}
  A meta-prompting, context engineering and spec-driven
  development system for Claude Code by TÂCHES.
`;

// Parse args
const args = process.argv.slice(2);
const hasGlobal = args.includes('--global') || args.includes('-g');
const hasLocal = args.includes('--local') || args.includes('-l');

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

console.log(banner);

// Show help if requested
if (hasHelp) {
  console.log(`  ${yellow}Usage:${reset} npx get-shit-done-cc [options]

  ${yellow}Options:${reset}
    ${cyan}-g, --global${reset}              Install globally (to Claude config directory)
    ${cyan}-l, --local${reset}               Install locally (to ./.claude in current directory)
    ${cyan}-c, --config-dir <path>${reset}   Specify custom Claude config directory
    ${cyan}-h, --help${reset}                Show this help message
    ${cyan}--force-statusline${reset}        Replace existing statusline config

  ${yellow}Examples:${reset}
    ${dim}# Install to default ~/.claude directory${reset}
    npx get-shit-done-cc --global

    ${dim}# Install to custom config directory (for multiple Claude accounts)${reset}
    npx get-shit-done-cc --global --config-dir ~/.claude-bc

    ${dim}# Using environment variable${reset}
    CLAUDE_CONFIG_DIR=~/.claude-bc npx get-shit-done-cc --global

    ${dim}# Install to current project only${reset}
    npx get-shit-done-cc --local

  ${yellow}Notes:${reset}
    The --config-dir option is useful when you have multiple Claude Code
    configurations (e.g., for different subscriptions). It takes priority
    over the CLAUDE_CONFIG_DIR environment variable.
`);
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
 * Read and parse settings.json, returning empty object if doesn't exist
 */
function readSettings(settingsPath) {
  if (fs.existsSync(settingsPath)) {
    try {
      return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    } catch (e) {
      return {};
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
 * Recursively copy directory, replacing paths in .md files
 * Deletes existing destDir first to remove orphaned files from previous versions
 */
function copyWithPathReplacement(srcDir, destDir, pathPrefix) {
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
      copyWithPathReplacement(srcPath, destPath, pathPrefix);
    } else if (entry.name.endsWith('.md')) {
      // Replace ~/.claude/ with the appropriate prefix in markdown files
      let content = fs.readFileSync(srcPath, 'utf8');
      content = content.replace(/~\/\.claude\//g, pathPrefix);
      fs.writeFileSync(destPath, content);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Clean up orphaned files from previous GSD versions
 */
function cleanupOrphanedFiles(claudeDir) {
  const orphanedFiles = [
    'hooks/gsd-notify.sh',  // Removed in v1.6.x
    'hooks/statusline.js',  // Renamed to gsd-statusline.js in v1.9.0
    'hooks/gsd-statusline.js',  // Replaced with gsd-statusline-enhanced.js in v2.0.x
  ];

  for (const relPath of orphanedFiles) {
    const fullPath = path.join(claudeDir, relPath);
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
    'gsd-statusline.js',  // Replaced with gsd-statusline-enhanced.js in v2.0.x
  ];

  let cleaned = false;

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
              cleaned = true;
              return false;  // Remove this entry
            }
          }
          return true;  // Keep this entry
        });
        settings.hooks[eventType] = filtered;
      }
    }
  }

  if (cleaned) {
    console.log(`  ${green}✓${reset} Removed orphaned hook registrations`);
  }

  return settings;
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
 * Install to the specified directory
 */
function install(isGlobal) {
  const src = path.join(__dirname, '..');
  // Priority: explicit --config-dir arg > CLAUDE_CONFIG_DIR env var > default ~/.claude
  const configDir = expandTilde(explicitConfigDir) || expandTilde(process.env.CLAUDE_CONFIG_DIR);
  const defaultGlobalDir = configDir || path.join(os.homedir(), '.claude');
  const claudeDir = isGlobal
    ? defaultGlobalDir
    : path.join(process.cwd(), '.claude');

  const locationLabel = isGlobal
    ? claudeDir.replace(os.homedir(), '~')
    : claudeDir.replace(process.cwd(), '.');

  // Path prefix for file references
  // Use actual path when CLAUDE_CONFIG_DIR is set, otherwise use ~ shorthand
  const pathPrefix = isGlobal
    ? (configDir ? `${claudeDir}/` : '~/.claude/')
    : './.claude/';

  console.log(`  Installing to ${cyan}${locationLabel}${reset}\n`);

  // Track installation failures
  const failures = [];

  // Clean up orphaned files from previous versions
  cleanupOrphanedFiles(claudeDir);

  // Create commands directory
  const commandsDir = path.join(claudeDir, 'commands');
  fs.mkdirSync(commandsDir, { recursive: true });

  // Copy commands/gsd with path replacement
  const gsdSrc = path.join(src, 'commands', 'gsd');
  const gsdDest = path.join(commandsDir, 'gsd');
  copyWithPathReplacement(gsdSrc, gsdDest, pathPrefix);
  if (verifyInstalled(gsdDest, 'commands/gsd')) {
    console.log(`  ${green}✓${reset} Installed commands/gsd`);
  } else {
    failures.push('commands/gsd');
  }

  // Copy get-shit-done skill with path replacement
  const skillSrc = path.join(src, 'get-shit-done');
  const skillDest = path.join(claudeDir, 'get-shit-done');
  copyWithPathReplacement(skillSrc, skillDest, pathPrefix);
  if (verifyInstalled(skillDest, 'get-shit-done')) {
    console.log(`  ${green}✓${reset} Installed get-shit-done`);
  } else {
    failures.push('get-shit-done');
  }

  // Copy agents to ~/.claude/agents (subagents must be at root level)
  // Only delete gsd-*.md files to preserve user's custom agents
  const agentsSrc = path.join(src, 'agents');
  if (fs.existsSync(agentsSrc)) {
    const agentsDest = path.join(claudeDir, 'agents');
    fs.mkdirSync(agentsDest, { recursive: true });

    // Remove old GSD agents (gsd-*.md) before copying new ones
    if (fs.existsSync(agentsDest)) {
      for (const file of fs.readdirSync(agentsDest)) {
        if (file.startsWith('gsd-') && file.endsWith('.md')) {
          fs.unlinkSync(path.join(agentsDest, file));
        }
      }
    }

    // Copy new agents (don't use copyWithPathReplacement which would wipe the folder)
    const agentEntries = fs.readdirSync(agentsSrc, { withFileTypes: true });
    for (const entry of agentEntries) {
      if (entry.isFile() && entry.name.endsWith('.md')) {
        let content = fs.readFileSync(path.join(agentsSrc, entry.name), 'utf8');
        content = content.replace(/~\/\.claude\//g, pathPrefix);
        fs.writeFileSync(path.join(agentsDest, entry.name), content);
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
  const changelogDest = path.join(claudeDir, 'get-shit-done', 'CHANGELOG.md');
  if (fs.existsSync(changelogSrc)) {
    fs.copyFileSync(changelogSrc, changelogDest);
    if (verifyFileInstalled(changelogDest, 'CHANGELOG.md')) {
      console.log(`  ${green}✓${reset} Installed CHANGELOG.md`);
    } else {
      failures.push('CHANGELOG.md');
    }
  }

  // Write VERSION file for whats-new command
  const versionDest = path.join(claudeDir, 'get-shit-done', 'VERSION');
  fs.writeFileSync(versionDest, pkg.version);
  if (verifyFileInstalled(versionDest, 'VERSION')) {
    console.log(`  ${green}✓${reset} Wrote VERSION (${pkg.version})`);
  } else {
    failures.push('VERSION');
  }

  // Copy hooks from dist/ (bundled with dependencies)
  const hooksSrc = path.join(src, 'hooks', 'dist');
  if (fs.existsSync(hooksSrc)) {
    const hooksDest = path.join(claudeDir, 'hooks');
    fs.mkdirSync(hooksDest, { recursive: true });
    const hookEntries = fs.readdirSync(hooksSrc);
    for (const entry of hookEntries) {
      const srcFile = path.join(hooksSrc, entry);
      // Only copy files, not directories
      if (fs.statSync(srcFile).isFile()) {
        const destFile = path.join(hooksDest, entry);
        fs.copyFileSync(srcFile, destFile);
      }
    }
    if (verifyInstalled(hooksDest, 'hooks')) {
      console.log(`  ${green}✓${reset} Installed hooks (bundled)`);
    } else {
      failures.push('hooks');
    }
  }

  // If critical components failed, exit with error
  if (failures.length > 0) {
    console.error(`\n  ${yellow}Installation incomplete!${reset} Failed: ${failures.join(', ')}`);
    console.error(`  Try running directly: node ~/.npm/_npx/*/node_modules/get-shit-done-cc/bin/install.js --global\n`);
    process.exit(1);
  }

  // Configure statusline and hooks in settings.json
  const settingsPath = path.join(claudeDir, 'settings.json');
  const settings = cleanupOrphanedHooks(readSettings(settingsPath));
  const statuslineCommand = isGlobal
    ? 'node "$HOME/.claude/hooks/gsd-statusline-enhanced.js"'
    : 'node .claude/hooks/gsd-statusline-enhanced.js';
  const updateCheckCommand = isGlobal
    ? 'node "$HOME/.claude/hooks/gsd-check-update.js"'
    : 'node .claude/hooks/gsd-check-update.js';

  // Configure SessionStart hook for update checking
  if (!settings.hooks) {
    settings.hooks = {};
  }
  if (!settings.hooks.SessionStart) {
    settings.hooks.SessionStart = [];
  }

  // Check if GSD update hook already exists
  const hasGsdUpdateHook = settings.hooks.SessionStart.some(entry =>
    entry.hooks && entry.hooks.some(h => h.command && h.command.includes('gsd-check-update'))
  );

  if (!hasGsdUpdateHook) {
    settings.hooks.SessionStart.push({
      hooks: [
        {
          type: 'command',
          command: updateCheckCommand
        }
      ]
    });
    console.log(`  ${green}✓${reset} Configured update check hook`);
  }

  // Register intel hooks for codebase intelligence
  const intelIndexCommand = isGlobal
    ? 'node "$HOME/.claude/hooks/gsd-intel-index.js"'
    : 'node .claude/hooks/gsd-intel-index.js';

  const intelSessionCommand = isGlobal
    ? 'node "$HOME/.claude/hooks/gsd-intel-session.js"'
    : 'node .claude/hooks/gsd-intel-session.js';

  // PostToolUse hook for indexing
  if (!settings.hooks.PostToolUse) {
    settings.hooks.PostToolUse = [];
  }

  const hasIntelIndexHook = settings.hooks.PostToolUse.some(entry =>
    entry.hooks && entry.hooks.some(h => h.command && h.command.includes('gsd-intel-index'))
  );

  if (!hasIntelIndexHook) {
    settings.hooks.PostToolUse.push({
      hooks: [{
        type: 'command',
        command: intelIndexCommand
      }]
    });
    console.log(`  ${green}✓${reset} Configured intel indexing hook`);
  }

  // PostToolUse hook for usage tracking
  const usagePosttoolCommand = isGlobal
    ? 'node "$HOME/.claude/hooks/gsd-usage-posttool.js"'
    : 'node .claude/hooks/gsd-usage-posttool.js';

  const hasUsagePosttoolHook = settings.hooks.PostToolUse.some(entry =>
    entry.hooks && entry.hooks.some(h => h.command && h.command.includes('gsd-usage-posttool'))
  );

  if (!hasUsagePosttoolHook) {
    settings.hooks.PostToolUse.push({
      hooks: [{
        type: 'command',
        command: usagePosttoolCommand
      }]
    });
    console.log(`  ${green}✓${reset} Configured usage tracking hook`);
  }

  // SessionStart hook for context injection
  const hasIntelSessionHook = settings.hooks.SessionStart.some(entry =>
    entry.hooks && entry.hooks.some(h => h.command && h.command.includes('gsd-intel-session'))
  );

  if (!hasIntelSessionHook) {
    settings.hooks.SessionStart.push({
      hooks: [{
        type: 'command',
        command: intelSessionCommand
      }]
    });
    console.log(`  ${green}✓${reset} Configured intel session hook`);
  }

  // SessionStart hook for usage tracking session initialization
  const usageSessionCommand = isGlobal
    ? 'node "$HOME/.claude/hooks/gsd-usage-session.js"'
    : 'node .claude/hooks/gsd-usage-session.js';

  const hasUsageSessionHook = settings.hooks.SessionStart.some(entry =>
    entry.hooks && entry.hooks.some(h => h.command && h.command.includes('gsd-usage-session'))
  );

  if (!hasUsageSessionHook) {
    settings.hooks.SessionStart.push({
      hooks: [{
        type: 'command',
        command: usageSessionCommand
      }]
    });
    console.log(`  ${green}✓${reset} Configured usage session hook`);
  }

  // SessionStart hook for team plan check
  const teamPlanCheckCommand = isGlobal
    ? 'node "$HOME/.claude/hooks/gsd-team-plan-check.js"'
    : 'node .claude/hooks/gsd-team-plan-check.js';

  const hasTeamPlanCheckHook = settings.hooks.SessionStart.some(entry =>
    entry.hooks && entry.hooks.some(h => h.command && h.command.includes('gsd-team-plan-check'))
  );

  if (!hasTeamPlanCheckHook) {
    settings.hooks.SessionStart.push({
      hooks: [{
        type: 'command',
        command: teamPlanCheckCommand
      }]
    });
    console.log(`  ${green}✓${reset} Configured team plan check hook`);
  }

  // Stop hook for pruning deleted files
  const intelPruneCommand = isGlobal
    ? 'node "$HOME/.claude/hooks/gsd-intel-prune.js"'
    : 'node .claude/hooks/gsd-intel-prune.js';

  if (!settings.hooks.Stop) {
    settings.hooks.Stop = [];
  }

  const hasIntelPruneHook = settings.hooks.Stop.some(entry =>
    entry.hooks && entry.hooks.some(h => h.command && h.command.includes('gsd-intel-prune'))
  );

  if (!hasIntelPruneHook) {
    settings.hooks.Stop.push({
      hooks: [{
        type: 'command',
        command: intelPruneCommand
      }]
    });
    console.log(`  ${green}✓${reset} Configured intel prune hook`);
  }

  return { settingsPath, settings, statuslineCommand };
}

/**
 * Apply statusline config, then print completion message
 */
function finishInstall(settingsPath, settings, statuslineCommand, shouldInstallStatusline) {
  if (shouldInstallStatusline) {
    settings.statusLine = {
      type: 'command',
      command: statuslineCommand
    };
    console.log(`  ${green}✓${reset} Configured statusline`);
  }

  // Always write settings (hooks were already configured in install())
  writeSettings(settingsPath, settings);

  console.log(`
  ${green}Done!${reset} Launch Claude Code and run ${cyan}/gsd:help${reset}.
`);
}

/**
 * Handle statusline configuration with optional prompt
 */
function handleStatusline(settings, isInteractive, callback) {
  const hasExisting = settings.statusLine != null;

  // No existing statusline - just install it
  if (!hasExisting) {
    callback(true);
    return;
  }

  // Has existing and --force-statusline flag
  if (forceStatusline) {
    callback(true);
    return;
  }

  // Has existing, non-interactive mode - skip
  if (!isInteractive) {
    console.log(`  ${yellow}⚠${reset} Skipping statusline (already configured)`);
    console.log(`    Use ${cyan}--force-statusline${reset} to replace\n`);
    callback(false);
    return;
  }

  // Has existing, interactive mode - prompt user
  const existingCmd = settings.statusLine.command || settings.statusLine.url || '(custom)';

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log(`
  ${yellow}⚠${reset} Existing statusline detected

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
 * Prompt for install location
 */
function promptLocation() {
  // Check if stdin is a TTY - if not, fall back to global install
  // This handles npx execution in environments like WSL2 where stdin may not be properly connected
  if (!process.stdin.isTTY) {
    console.log(`  ${yellow}Non-interactive terminal detected, defaulting to global install${reset}\n`);
    const { settingsPath, settings, statuslineCommand } = install(true);
    handleStatusline(settings, false, (shouldInstallStatusline) => {
      finishInstall(settingsPath, settings, statuslineCommand, shouldInstallStatusline);
    });
    return;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  // Track whether we've processed the answer to prevent double-execution
  let answered = false;

  // Handle readline close event to detect premature stdin closure
  rl.on('close', () => {
    if (!answered) {
      answered = true;
      console.log(`\n  ${yellow}Input stream closed, defaulting to global install${reset}\n`);
      const { settingsPath, settings, statuslineCommand } = install(true);
      handleStatusline(settings, false, (shouldInstallStatusline) => {
        finishInstall(settingsPath, settings, statuslineCommand, shouldInstallStatusline);
      });
    }
  });

  const configDir = expandTilde(explicitConfigDir) || expandTilde(process.env.CLAUDE_CONFIG_DIR);
  const globalPath = configDir || path.join(os.homedir(), '.claude');
  const globalLabel = globalPath.replace(os.homedir(), '~');

  console.log(`  ${yellow}Where would you like to install?${reset}

  ${cyan}1${reset}) Global ${dim}(${globalLabel})${reset} - available in all projects
  ${cyan}2${reset}) Local  ${dim}(./.claude)${reset} - this project only
`);

  rl.question(`  Choice ${dim}[1]${reset}: `, (answer) => {
    answered = true;
    rl.close();
    const choice = answer.trim() || '1';
    const isGlobal = choice !== '2';
    const { settingsPath, settings, statuslineCommand } = install(isGlobal);
    // Interactive mode - prompt for optional features
    handleStatusline(settings, true, (shouldInstallStatusline) => {
      finishInstall(settingsPath, settings, statuslineCommand, shouldInstallStatusline);
    });
  });
}

// Main
if (hasGlobal && hasLocal) {
  console.error(`  ${yellow}Cannot specify both --global and --local${reset}`);
  process.exit(1);
} else if (explicitConfigDir && hasLocal) {
  console.error(`  ${yellow}Cannot use --config-dir with --local${reset}`);
  process.exit(1);
} else if (hasGlobal) {
  const { settingsPath, settings, statuslineCommand } = install(true);
  // Non-interactive - respect flags
  handleStatusline(settings, false, (shouldInstallStatusline) => {
    finishInstall(settingsPath, settings, statuslineCommand, shouldInstallStatusline);
  });
} else if (hasLocal) {
  const { settingsPath, settings, statuslineCommand } = install(false);
  // Non-interactive - respect flags
  handleStatusline(settings, false, (shouldInstallStatusline) => {
    finishInstall(settingsPath, settings, statuslineCommand, shouldInstallStatusline);
  });
} else {
  promptLocation();
}
