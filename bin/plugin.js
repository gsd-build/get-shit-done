#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

// Colors
const cyan = '\x1b[36m';
const green = '\x1b[32m';
const yellow = '\x1b[33m';
const red = '\x1b[31m';
const dim = '\x1b[2m';
const reset = '\x1b[0m';

// Parse args
const args = process.argv.slice(2);
const command = args[0];
const source = args[1];

/**
 * Expand ~ to home directory
 */
function expandTilde(filePath) {
  if (filePath && filePath.startsWith('~/')) {
    return path.join(os.homedir(), filePath.slice(2));
  }
  return filePath;
}

/**
 * Get Claude config directory
 */
function getConfigDir() {
  const envDir = process.env.CLAUDE_CONFIG_DIR;
  if (envDir) {
    return expandTilde(envDir);
  }
  return path.join(os.homedir(), '.claude');
}

/**
 * Check if git is available
 */
function isGitAvailable() {
  try {
    execSync('git --version', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if source is a git URL
 */
function isGitUrl(source) {
  return source.startsWith('https://') ||
         source.startsWith('git@') ||
         source.startsWith('http://') ||
         source.endsWith('.git');
}

/**
 * Clone a git repository to temp directory
 */
function cloneRepo(gitUrl) {
  const tempDir = path.join(os.tmpdir(), `gsd-plugin-${Date.now()}`);

  try {
    console.log(`  Cloning ${dim}${gitUrl}${reset}...`);
    execSync(`git clone --depth 1 "${gitUrl}" "${tempDir}"`, { stdio: 'pipe' });
    return tempDir;
  } catch (err) {
    throw new Error(`Failed to clone ${gitUrl}`);
  }
}

/**
 * Clean up temp directory
 */
function cleanup(tempDir) {
  if (tempDir && tempDir.startsWith(os.tmpdir())) {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Show help message
 */
function showHelp() {
  console.log(`
  ${cyan}GSD Plugin Manager${reset}

  ${yellow}Usage:${reset}
    plugin install <source>   Install a plugin from git URL or local path
    plugin list               List installed plugins (not yet implemented)
    plugin uninstall <name>   Remove a plugin (not yet implemented)

  ${yellow}Examples:${reset}
    ${dim}# Install from git repository${reset}
    plugin install https://github.com/user/my-plugin

    ${dim}# Install from local path${reset}
    plugin install ./my-plugin
    plugin install /path/to/my-plugin

  ${yellow}Options:${reset}
    --help, -h    Show this help message
`);
}

/**
 * Install a plugin from source (git URL or local path)
 */
function installPlugin(source) {
  if (!source) {
    console.error(`  ${red}Error:${reset} No source specified`);
    console.log(`  Usage: plugin install <git-url|local-path>`);
    process.exit(1);
  }

  let pluginDir;
  let tempDir = null;

  // Determine source type and get plugin directory
  if (isGitUrl(source)) {
    // Git URL - need to clone first
    if (!isGitAvailable()) {
      console.error(`  ${red}Error:${reset} git is required for plugin installation`);
      process.exit(1);
    }

    try {
      tempDir = cloneRepo(source);
      pluginDir = tempDir;
    } catch (err) {
      console.error(`  ${red}Error:${reset} ${err.message}`);
      process.exit(1);
    }
  } else {
    // Local path
    pluginDir = path.resolve(expandTilde(source));

    if (!fs.existsSync(pluginDir)) {
      console.error(`  ${red}Error:${reset} Path not found: ${source}`);
      process.exit(1);
    }

    if (!fs.statSync(pluginDir).isDirectory()) {
      console.error(`  ${red}Error:${reset} Not a directory: ${source}`);
      process.exit(1);
    }
  }

  try {
    // Check for plugin.json
    const manifestPath = path.join(pluginDir, 'plugin.json');
    if (!fs.existsSync(manifestPath)) {
      console.error(`  ${red}Error:${reset} Not a valid GSD plugin (missing plugin.json)`);
      cleanup(tempDir);
      process.exit(1);
    }

    // Parse manifest
    let manifest;
    try {
      const manifestContent = fs.readFileSync(manifestPath, 'utf8');
      manifest = JSON.parse(manifestContent);
    } catch (parseErr) {
      console.error(`  ${red}Error:${reset} Invalid plugin.json - ${parseErr.message}`);
      cleanup(tempDir);
      process.exit(1);
    }

    // Basic validation (full validation in Task 2)
    if (!manifest.name || !manifest.version) {
      console.error(`  ${red}Error:${reset} Invalid plugin.json - missing required fields (name, version)`);
      cleanup(tempDir);
      process.exit(1);
    }

    console.log(`\n  Installing plugin: ${cyan}${manifest.name}${reset} v${manifest.version}`);

    // Placeholder for Task 2: Full validation and file copying
    // For now, just show success message
    console.log(`  ${green}Validated plugin.json${reset}`);

    // Clean up temp directory
    cleanup(tempDir);

    console.log(`\n  ${green}Done!${reset} Plugin ready for validation and installation.`);

  } catch (err) {
    cleanup(tempDir);
    console.error(`  ${red}Error:${reset} ${err.message}`);
    process.exit(1);
  }
}

// Main
if (args.includes('--help') || args.includes('-h') || !command) {
  showHelp();
  process.exit(command ? 0 : 1);
}

switch (command) {
  case 'install':
    installPlugin(source);
    break;
  case 'list':
    console.log(`  ${yellow}Not yet implemented${reset} - coming in Phase 3`);
    break;
  case 'uninstall':
    console.log(`  ${yellow}Not yet implemented${reset} - coming in Phase 3`);
    break;
  default:
    console.error(`  ${red}Error:${reset} Unknown command: ${command}`);
    showHelp();
    process.exit(1);
}
