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
  Meta-prompting system for Claude Code and OpenCode by TÂCHES
  Context engineering • Spec-driven development
`;

// Parse args
const args = process.argv.slice(2);
const hasGlobal = args.includes('--global') || args.includes('-g');
const hasLocal = args.includes('--local') || args.includes('-l');

// Parse --platform argument
function parsePlatformArg() {
  const platformIndex = args.findIndex(arg => arg === '--platform');
  if (platformIndex !== -1) {
    const nextArg = args[platformIndex + 1];
    if (!nextArg || nextArg.startsWith('-')) {
      console.error(`  ${yellow}--platform requires a value (claude-code or opencode)${reset}`);
      process.exit(1);
    }
    if (nextArg !== 'claude-code' && nextArg !== 'opencode') {
      console.error(`  ${yellow}--platform must be 'claude-code' or 'opencode'${reset}`);
      process.exit(1);
    }
    return nextArg;
  }
  // Also handle --platform=value format
  const platformArg = args.find(arg => arg.startsWith('--platform='));
  if (platformArg) {
    const value = platformArg.split('=')[1];
    if (value !== 'claude-code' && value !== 'opencode') {
      console.error(`  ${yellow}--platform must be 'claude-code' or 'opencode'${reset}`);
      process.exit(1);
    }
    return value;
  }
  return null;
}
const explicitPlatform = parsePlatformArg();

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
    return configDirArg.split('=')[1];
  }
  return null;
}
const explicitConfigDir = parseConfigDirArg();
const hasHelp = args.includes('--help') || args.includes('-h');

console.log(banner);

// Show help if requested
if (hasHelp) {
  console.log(`  ${yellow}Usage:${reset} npx get-shit-done-cc [options]

  ${yellow}Options:${reset}
    ${cyan}--platform <name>${reset}          Target platform (claude-code or opencode)
    ${cyan}-g, --global${reset}              Install globally
    ${cyan}-l, --local${reset}               Install locally (to ./.claude or .opencode)
    ${cyan}-c, --config-dir <path>${reset}   Specify custom Claude config directory
    ${cyan}-h, --help${reset}                Show this help message

  ${yellow}Examples:${reset}
    ${dim}# Interactive prompt (choose platform and location)${reset}
    npx get-shit-done-cc

    ${dim}# Install to Claude Code global directory${reset}
    npx get-shit-done-cc --platform claude-code --global

    ${dim}# Install to OpenCode local directory${reset}
    npx get-shit-done-cc --platform opencode --local

    ${dim}# Install to custom Claude config directory${reset}
    npx get-shit-done-cc --platform claude-code --global --config-dir ~/.claude-bc

    ${dim}# Using environment variable${reset}
    CLAUDE_CONFIG_DIR=~/.claude-bc npx get-shit-done-cc --platform claude-code --global

  ${yellow}Notes:${reset}
    Without --platform, you will be prompted to choose between:
      • claude-code: Installs to ~/.claude/ or ./.claude/
      • opencode: Installs to ~/.config/opencode/ or .opencode/

    The --config-dir option only applies to claude-code platform.
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
 * Transform content for OpenCode platform
 */
function transformForOpenCode(content) {
  // Remove name: line
  content = content.replace(/^name:\s+gsd:.+$/m, '');

  // Remove argument-hint: line
  content = content.replace(/^argument-hint:\s+.+$/m, '');

  // Remove allowed-tools block (multiline YAML array)
  content = content.replace(/^allowed-tools:\n(  - .+\n)*/m, '');

  // Transform command references from /gsd:command to /gsd/command
  content = content.replace(/\/gsd:(\S+)/g, '/gsd/$1');

  // Clean up empty frontmatter or lines with only whitespace
  content = content.replace(/^---\n\n+---/, '---\n---');

  // If frontmatter is empty, add a minimal description comment
  if (content.match(/^---\n---/)) {
    content = content.replace(/^---\n---/, '---\ndescription: GSD command for OpenCode\n---');
  }

  return content;
}

/**
 * Recursively copy directory, replacing paths in .md files
 */
function copyWithPathReplacement(srcDir, destDir, pathPrefix, platform) {
  fs.mkdirSync(destDir, { recursive: true });

  const entries = fs.readdirSync(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);

    if (entry.isDirectory()) {
      copyWithPathReplacement(srcPath, destPath, pathPrefix, platform);
    } else if (entry.name.endsWith('.md')) {
      // Read file
      let content = fs.readFileSync(srcPath, 'utf8');

      // Transform for OpenCode if needed
      if (platform === 'opencode') {
        content = transformForOpenCode(content);
      }

      // Replace paths with platform-specific prefix
      if (platform === 'opencode') {
        content = content.replace(/~\/\.claude\/get-shit-done\//g, '~/.config/opencode/gsd/');
        content = content.replace(/~\/\.claude\/commands\//g, '~/.config/opencode/command/');
        content = content.replace(/\.\/\.claude\/get-shit-done\//g, '.opencode/gsd/');
        content = content.replace(/\.\/\.claude\/commands\//g, '.opencode/command/');
      } else {
        // Claude Code platform
        content = content.replace(/~\/\.claude\//g, pathPrefix);
      }

      fs.writeFileSync(destPath, content);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Install to the specified directory
 */
function install(isGlobal, platform) {
  const src = path.join(__dirname, '..');

  let targetDir, commandsSubdir, frameworkDirName, locationLabel, pathPrefix;

  if (platform === 'claude-code') {
    // Claude Code directories
    const configDir = expandTilde(explicitConfigDir) || expandTilde(process.env.CLAUDE_CONFIG_DIR);
    const defaultGlobalDir = configDir || path.join(os.homedir(), '.claude');
    targetDir = isGlobal ? defaultGlobalDir : path.join(process.cwd(), '.claude');
    commandsSubdir = 'commands';
    frameworkDirName = 'get-shit-done';
    locationLabel = isGlobal
      ? targetDir.replace(os.homedir(), '~')
      : targetDir.replace(process.cwd(), '.');
    pathPrefix = isGlobal
      ? (configDir ? `${targetDir}/` : '~/.claude/')
      : './.claude/';
  } else if (platform === 'opencode') {
    // OpenCode directories
    targetDir = isGlobal
      ? path.join(os.homedir(), '.config', 'opencode')
      : path.join(process.cwd(), '.opencode');
    commandsSubdir = 'command'; // singular for OpenCode
    frameworkDirName = 'gsd'; // simplified for OpenCode
    locationLabel = isGlobal
      ? targetDir.replace(os.homedir(), '~')
      : targetDir.replace(process.cwd(), '.');
    pathPrefix = isGlobal ? '~/.config/opencode/' : '.opencode/';
  }

  console.log(`  Installing to ${cyan}${locationLabel}${reset} ${dim}(${platform})${reset}\n`);

  // Create commands directory
  const commandsDir = path.join(targetDir, commandsSubdir);
  fs.mkdirSync(commandsDir, { recursive: true });

  // Copy commands/gsd with path replacement
  const gsdSrc = path.join(src, 'commands', 'gsd');
  const gsdDest = path.join(commandsDir, 'gsd');
  copyWithPathReplacement(gsdSrc, gsdDest, pathPrefix, platform);
  console.log(`  ${green}✓${reset} Installed ${commandsSubdir}/gsd`);

  // Copy framework with path replacement
  const skillSrc = path.join(src, 'get-shit-done');
  const skillDest = path.join(targetDir, frameworkDirName);
  copyWithPathReplacement(skillSrc, skillDest, pathPrefix, platform);
  console.log(`  ${green}✓${reset} Installed ${frameworkDirName}`);

  // Copy CHANGELOG.md
  const changelogSrc = path.join(src, 'CHANGELOG.md');
  const changelogDest = path.join(targetDir, frameworkDirName, 'CHANGELOG.md');
  if (fs.existsSync(changelogSrc)) {
    fs.copyFileSync(changelogSrc, changelogDest);
    console.log(`  ${green}✓${reset} Installed CHANGELOG.md`);
  }

  // Write VERSION file for whats-new command
  const versionDest = path.join(targetDir, frameworkDirName, 'VERSION');
  fs.writeFileSync(versionDest, pkg.version);
  console.log(`  ${green}✓${reset} Wrote VERSION (${pkg.version})`);

  const commandName = platform === 'claude-code' ? '/gsd:help' : '@general';
  console.log(`
  ${green}Done!${reset} Launch ${platform === 'claude-code' ? 'Claude Code' : 'OpenCode'} and run ${cyan}${commandName}${reset}.
`);
}

/**
 * Prompt for platform selection
 */
function promptPlatform(callback) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log(`  ${yellow}Which platform?${reset}

  ${cyan}1${reset}) Claude Code
  ${cyan}2${reset}) OpenCode
`);

  rl.question(`  Choice ${dim}[1]${reset}: `, (answer) => {
    rl.close();
    const choice = answer.trim() || '1';
    const platform = choice === '2' ? 'opencode' : 'claude-code';
    callback(platform);
  });
}

/**
 * Prompt for install location
 */
function promptLocation(platform) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  let globalLabel, localLabel;
  if (platform === 'claude-code') {
    const configDir = expandTilde(explicitConfigDir) || expandTilde(process.env.CLAUDE_CONFIG_DIR);
    const globalPath = configDir || path.join(os.homedir(), '.claude');
    globalLabel = globalPath.replace(os.homedir(), '~');
    localLabel = './.claude';
  } else {
    globalLabel = '~/.config/opencode';
    localLabel = './.opencode';
  }

  console.log(`  ${yellow}Where would you like to install?${reset}

  ${cyan}1${reset}) Global ${dim}(${globalLabel})${reset} - available in all projects
  ${cyan}2${reset}) Local  ${dim}(${localLabel})${reset} - this project only
`);

  rl.question(`  Choice ${dim}[1]${reset}: `, (answer) => {
    rl.close();
    const choice = answer.trim() || '1';
    const isGlobal = choice !== '2';
    install(isGlobal, platform);
  });
}

// Main
if (hasGlobal && hasLocal) {
  console.error(`  ${yellow}Cannot specify both --global and --local${reset}`);
  process.exit(1);
} else if (explicitConfigDir && hasLocal) {
  console.error(`  ${yellow}Cannot use --config-dir with --local${reset}`);
  process.exit(1);
} else if (explicitConfigDir && explicitPlatform && explicitPlatform !== 'claude-code') {
  console.error(`  ${yellow}--config-dir only applies to claude-code platform${reset}`);
  process.exit(1);
}

// Determine if we have everything we need
const platformDetermined = explicitPlatform !== null;
const locationDetermined = hasGlobal || hasLocal;

if (platformDetermined && locationDetermined) {
  // All args provided
  install(hasGlobal, explicitPlatform);
} else if (platformDetermined && !locationDetermined) {
  // Platform specified, need location
  promptLocation(explicitPlatform);
} else if (!platformDetermined && locationDetermined) {
  // Location specified, need platform
  promptPlatform((platform) => {
    install(hasGlobal, platform);
  });
} else {
  // Need both platform and location
  promptPlatform((platform) => {
    promptLocation(platform);
  });
}
