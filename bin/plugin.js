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

// Flags
const verbose = args.includes('--verbose') || args.includes('-v');
const force = args.includes('--force') || args.includes('-f');
const link = args.includes('--link') || args.includes('-l');
const dryRun = args.includes('--dry-run');

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
 * Validate manifest according to plugin-format.md rules
 */
function validateManifest(manifest, pluginDir) {
  const errors = [];

  // Name validation: kebab-case, 3-50 chars, starts with letter
  const nameRegex = /^[a-z][a-z0-9-]{2,49}$/;
  if (!manifest.name) {
    errors.push('Missing required field: name');
  } else if (!nameRegex.test(manifest.name)) {
    errors.push(`Invalid plugin name "${manifest.name}" - must be kebab-case, 3-50 chars, start with letter`);
  }

  // Version validation: semver MAJOR.MINOR.PATCH
  const versionRegex = /^\d+\.\d+\.\d+$/;
  if (!manifest.version) {
    errors.push('Missing required field: version');
  } else if (!versionRegex.test(manifest.version)) {
    errors.push(`Invalid version "${manifest.version}" - must be semver (MAJOR.MINOR.PATCH)`);
  }

  // Required fields
  if (!manifest.description) {
    errors.push('Missing required field: description');
  }
  if (!manifest.author) {
    errors.push('Missing required field: author');
  }

  // Validate gsd section and referenced directories
  const gsd = manifest.gsd || {};

  // Check commands directory exists if commands are defined
  if (gsd.commands && Array.isArray(gsd.commands) && gsd.commands.length > 0) {
    const commandsDir = path.join(pluginDir, 'commands');
    if (!fs.existsSync(commandsDir)) {
      errors.push('Commands defined in manifest but commands/ directory is missing');
    }

    for (const cmd of gsd.commands) {
      // Command name must match pluginName:command format
      if (cmd.name) {
        const expectedPrefix = manifest.name + ':';
        if (!cmd.name.startsWith(expectedPrefix)) {
          errors.push(`Command "${cmd.name}" prefix doesn't match plugin name "${manifest.name}"`);
        }
      }

      // File must exist and not use absolute paths or traversal
      if (cmd.file) {
        if (path.isAbsolute(cmd.file)) {
          errors.push(`Command file path must be relative: ${cmd.file}`);
        } else if (cmd.file.includes('..')) {
          errors.push(`Command file path cannot use '..': ${cmd.file}`);
        } else {
          const filePath = path.join(pluginDir, cmd.file);
          if (!fs.existsSync(filePath)) {
            errors.push(`Referenced file not found: ${cmd.file}`);
          }
        }
      }
    }
  }

  // Check agents directory exists if agents are defined
  if (gsd.agents && Array.isArray(gsd.agents) && gsd.agents.length > 0) {
    const agentsDir = path.join(pluginDir, 'agents');
    if (!fs.existsSync(agentsDir)) {
      errors.push('Agents defined in manifest but agents/ directory is missing');
    }

    for (const agent of gsd.agents) {
      if (agent.file) {
        const filePath = path.join(pluginDir, agent.file);
        if (!fs.existsSync(filePath)) {
          errors.push(`Referenced agent file not found: ${agent.file}`);
        }
      }
    }
  }

  // Check workflows directory exists if workflows are defined
  if (gsd.workflows && Array.isArray(gsd.workflows) && gsd.workflows.length > 0) {
    const workflowsDir = path.join(pluginDir, 'workflows');
    if (!fs.existsSync(workflowsDir)) {
      errors.push('Workflows defined in manifest but workflows/ directory is missing');
    }

    for (const workflow of gsd.workflows) {
      if (workflow.file) {
        const filePath = path.join(pluginDir, workflow.file);
        if (!fs.existsSync(filePath)) {
          errors.push(`Referenced workflow file not found: ${workflow.file}`);
        }
      }
    }
  }

  // Check hooks directory exists if hooks are defined
  if (gsd.hooks && Array.isArray(gsd.hooks) && gsd.hooks.length > 0) {
    const hooksDir = path.join(pluginDir, 'hooks');
    if (!fs.existsSync(hooksDir)) {
      errors.push('Hooks defined in manifest but hooks/ directory is missing');
    }

    for (const hook of gsd.hooks) {
      if (hook.file) {
        const filePath = path.join(pluginDir, hook.file);
        if (!fs.existsSync(filePath)) {
          errors.push(`Referenced hook file not found: ${hook.file}`);
        }
      }
    }
  }

  return errors;
}

/**
 * Copy directory recursively with path replacement in .md files
 */
function copyWithPathReplacement(srcDir, destDir, pluginName, options = {}) {
  const { verbose: showVerbose = false, isLink = false } = options;
  fs.mkdirSync(destDir, { recursive: true });

  const entries = fs.readdirSync(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);

    if (entry.isDirectory()) {
      copyWithPathReplacement(srcPath, destPath, pluginName, options);
    } else if (isLink) {
      // Create symlink instead of copying
      createSymlink(srcPath, destPath, 'file');
      if (showVerbose) {
        console.log(`    ${dim}Linked${reset} ${entry.name} -> ${destPath}`);
      }
    } else if (entry.name.endsWith('.md')) {
      // Replace relative path references with installed paths
      let content = fs.readFileSync(srcPath, 'utf8');
      // Replace @./workflows/ with @~/.claude/{plugin}/workflows/
      content = content.replace(/@\.\/workflows\//g, `@~/.claude/${pluginName}/workflows/`);
      content = content.replace(/@\.\/templates\//g, `@~/.claude/${pluginName}/templates/`);
      content = content.replace(/@\.\/references\//g, `@~/.claude/${pluginName}/references/`);
      content = content.replace(/@\.\/hooks\//g, `@~/.claude/${pluginName}/hooks/`);
      fs.writeFileSync(destPath, content);
      if (showVerbose) {
        console.log(`    ${dim}Copying${reset} ${entry.name} -> ${destPath}`);
      }
    } else {
      fs.copyFileSync(srcPath, destPath);
      if (showVerbose) {
        console.log(`    ${dim}Copying${reset} ${entry.name} -> ${destPath}`);
      }
    }
  }
}

/**
 * Create symlink with cross-platform support
 */
function createSymlink(src, dest, type) {
  // Windows needs 'junction' for directories to avoid admin rights
  const linkType = process.platform === 'win32' && type === 'dir' ? 'junction' : type;
  try {
    // Remove existing file/symlink if it exists
    if (fs.existsSync(dest)) {
      fs.unlinkSync(dest);
    }
    fs.symlinkSync(src, dest, linkType);
  } catch (err) {
    if (err.code === 'EPERM' && process.platform === 'win32') {
      console.error(`  ${red}Error:${reset} Creating symlinks on Windows requires admin rights or Developer Mode`);
      console.error(`  ${dim}Alternative: Run without --link to copy files instead${reset}`);
      process.exit(1);
    }
    throw err;
  }
}

/**
 * Check if Docker Compose is available
 * Returns { available: boolean, command: 'docker compose' | 'docker-compose' | null }
 */
function isDockerAvailable() {
  // Try modern Docker CLI first (docker compose)
  try {
    execSync('docker compose version', { stdio: 'pipe' });
    return { available: true, command: 'docker compose' };
  } catch {
    // Fallback to legacy docker-compose
    try {
      execSync('docker-compose --version', { stdio: 'pipe' });
      return { available: true, command: 'docker-compose' };
    } catch {
      return { available: false, command: null };
    }
  }
}

/**
 * Get service configuration from installed plugin manifest
 */
function getServiceConfig(pluginName) {
  const configDir = getConfigDir();
  const manifestPath = path.join(configDir, pluginName, 'plugin.json');

  try {
    if (!fs.existsSync(manifestPath)) {
      return null;
    }
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    return manifest.gsd?.services || null;
  } catch {
    // Return null gracefully if manifest is corrupted
    return null;
  }
}

/**
 * Start Docker services for a plugin
 */
function startServices(pluginName) {
  const services = getServiceConfig(pluginName);
  if (!services || !services['docker-compose']) {
    return false;
  }

  const docker = isDockerAvailable();
  if (!docker.available) {
    console.log(`  ${yellow}Warning:${reset} Docker not available, skipping services for ${pluginName}`);
    return false;
  }

  const configDir = getConfigDir();
  const composePath = path.join(configDir, pluginName, services['docker-compose']);

  if (!fs.existsSync(composePath)) {
    console.log(`  ${yellow}Warning:${reset} Docker Compose file not found: ${composePath}`);
    return false;
  }

  try {
    console.log(`  Starting services for ${cyan}${pluginName}${reset}...`);
    execSync(`${docker.command} -f "${composePath}" up -d`, { stdio: 'pipe' });
    console.log(`  ${green}✓${reset} Services started`);
    return true;
  } catch (err) {
    console.log(`  ${yellow}Warning:${reset} Failed to start services: ${err.message}`);
    return false;
  }
}

/**
 * Stop Docker services for a plugin
 */
function stopServices(pluginName) {
  const services = getServiceConfig(pluginName);
  if (!services || !services['docker-compose']) {
    return false;
  }

  const docker = isDockerAvailable();
  if (!docker.available) {
    console.log(`  ${yellow}Warning:${reset} Docker not available, skipping service shutdown for ${pluginName}`);
    return false;
  }

  const configDir = getConfigDir();
  const composePath = path.join(configDir, pluginName, services['docker-compose']);

  if (!fs.existsSync(composePath)) {
    console.log(`  ${yellow}Warning:${reset} Docker Compose file not found: ${composePath}`);
    return false;
  }

  try {
    console.log(`  Stopping services for ${cyan}${pluginName}${reset}...`);
    execSync(`${docker.command} -f "${composePath}" down`, { stdio: 'pipe' });
    console.log(`  ${green}✓${reset} Services stopped`);
    return true;
  } catch (err) {
    console.log(`  ${yellow}Warning:${reset} Failed to stop services: ${err.message}`);
    return false;
  }
}

/**
 * Clean up Docker services for a plugin (stop, remove containers, and remove volumes)
 * Used during uninstall for complete cleanup
 */
function cleanupServices(pluginName, composePath) {
  const docker = isDockerAvailable();
  if (!docker.available) {
    console.log(`  ${yellow}Warning:${reset} Docker not available, skipping container cleanup for ${pluginName}`);
    return false;
  }

  if (!fs.existsSync(composePath)) {
    console.log(`  ${yellow}Warning:${reset} Docker Compose file not found: ${composePath}`);
    return false;
  }

  try {
    console.log(`  Cleaning up containers and volumes for ${cyan}${pluginName}${reset}...`);
    execSync(`${docker.command} -f "${composePath}" down -v --remove-orphans`, { stdio: 'pipe' });
    console.log(`  ${green}✓${reset} Containers and volumes removed`);
    return true;
  } catch (err) {
    console.log(`  ${yellow}Warning:${reset} Failed to clean up services: ${err.message}`);
    return false;
  }
}

/**
 * Check health of plugin services by running health check script
 * Returns: { status: 'healthy'|'unhealthy'|'no-services'|'no-healthcheck'|'missing-script'|'error', error?, path? }
 */
function checkServiceHealth(pluginName) {
  const services = getServiceConfig(pluginName);
  if (!services) {
    return { status: 'no-services' };
  }

  if (!services.healthCheck) {
    return { status: 'no-healthcheck' };
  }

  const configDir = getConfigDir();
  const pluginDir = path.join(configDir, pluginName);
  const healthCheckPath = path.join(pluginDir, services.healthCheck);

  // Verify script exists
  if (!fs.existsSync(healthCheckPath)) {
    return { status: 'missing-script', path: healthCheckPath };
  }

  try {
    execSync(healthCheckPath, { cwd: pluginDir, stdio: 'pipe' });
    return { status: 'healthy' };
  } catch (err) {
    // Process exited with non-zero code
    const stderr = err.stderr ? err.stderr.toString().trim() : err.message;
    return { status: 'unhealthy', error: stderr };
  }
}

/**
 * Get service running status from Docker
 * Returns: { running: boolean, containers?: number, reason?: string, error?: string }
 */
function getServiceStatus(pluginName) {
  const services = getServiceConfig(pluginName);
  if (!services || !services['docker-compose']) {
    return { running: false, reason: 'no-services' };
  }

  const docker = isDockerAvailable();
  if (!docker.available) {
    return { running: false, reason: 'no-docker' };
  }

  const configDir = getConfigDir();
  const composePath = path.join(configDir, pluginName, services['docker-compose']);

  if (!fs.existsSync(composePath)) {
    return { running: false, reason: 'no-compose-file' };
  }

  try {
    // Try with --format json first (modern docker compose)
    let output;
    try {
      output = execSync(`${docker.command} -f "${composePath}" ps --format json`, { stdio: 'pipe' }).toString();
    } catch {
      // Fallback to plain output for older docker-compose
      output = execSync(`${docker.command} -f "${composePath}" ps`, { stdio: 'pipe' }).toString();
    }

    // Parse JSON output (one JSON object per line for modern docker compose)
    if (output.trim().startsWith('{') || output.trim().startsWith('[')) {
      const lines = output.trim().split('\n').filter(line => line.trim());
      let runningCount = 0;

      for (const line of lines) {
        try {
          const container = JSON.parse(line);
          // Check if container is running (State can be "running" or Status contains "Up")
          if (container.State === 'running' || (container.Status && container.Status.toLowerCase().includes('up'))) {
            runningCount++;
          }
        } catch {
          // Skip invalid JSON lines
        }
      }

      return { running: runningCount > 0, containers: runningCount };
    }

    // Parse plain text output (legacy docker-compose)
    // Look for lines with "Up" status
    const lines = output.split('\n');
    let runningCount = 0;
    for (const line of lines) {
      if (line.toLowerCase().includes(' up ')) {
        runningCount++;
      }
    }

    return { running: runningCount > 0, containers: runningCount };
  } catch (err) {
    return { running: false, reason: 'error', error: err.message };
  }
}

/**
 * Install plugin files to Claude config directory
 */
function installPluginFiles(pluginDir, manifest, options = {}) {
  const { verbose: showVerbose = false, isLink = false } = options;
  const configDir = getConfigDir();
  const pluginName = manifest.name;
  const installedFiles = [];

  // Installation mapping from plugin-format.md:
  // commands/*.md -> ~/.claude/commands/{plugin-name}/*.md
  // agents/*.md -> ~/.claude/agents/*.md (root level)
  // workflows/*.md -> ~/.claude/{plugin-name}/workflows/*.md
  // templates/*.md -> ~/.claude/{plugin-name}/templates/*.md
  // references/*.md -> ~/.claude/{plugin-name}/references/*.md
  // hooks/*.md -> ~/.claude/{plugin-name}/hooks/*.md
  // docker/* -> ~/.claude/{plugin-name}/docker/*

  const mappings = [
    { src: 'commands', dest: path.join(configDir, 'commands', pluginName) },
    { src: 'agents', dest: path.join(configDir, 'agents') },
    { src: 'workflows', dest: path.join(configDir, pluginName, 'workflows') },
    { src: 'templates', dest: path.join(configDir, pluginName, 'templates') },
    { src: 'references', dest: path.join(configDir, pluginName, 'references') },
    { src: 'hooks', dest: path.join(configDir, pluginName, 'hooks') },
    { src: 'docker', dest: path.join(configDir, pluginName, 'docker') },
  ];

  for (const mapping of mappings) {
    const srcPath = path.join(pluginDir, mapping.src);
    if (fs.existsSync(srcPath) && fs.statSync(srcPath).isDirectory()) {
      if (showVerbose) {
        console.log(`  ${dim}Processing ${mapping.src}/${reset}`);
      }
      copyWithPathReplacement(srcPath, mapping.dest, pluginName, { verbose: showVerbose, isLink });

      // Track installed files
      const files = fs.readdirSync(srcPath);
      for (const file of files) {
        installedFiles.push(path.join(mapping.dest, file));
      }
    }
  }

  // Copy plugin.json to ~/.claude/{plugin-name}/plugin.json for management
  const pluginMetaDir = path.join(configDir, pluginName);
  fs.mkdirSync(pluginMetaDir, { recursive: true });
  const manifestDest = path.join(pluginMetaDir, 'plugin.json');

  // Add installed files list to manifest for uninstall tracking
  const manifestWithTracking = {
    ...manifest,
    _installed: {
      date: new Date().toISOString(),
      files: installedFiles,
      linked: isLink,
      source: isLink ? pluginDir : undefined,
    },
  };
  fs.writeFileSync(manifestDest, JSON.stringify(manifestWithTracking, null, 2));

  return installedFiles;
}

/**
 * Get list of installed commands from manifest
 */
function getInstalledCommands(manifest) {
  const gsd = manifest.gsd || {};
  if (!gsd.commands || !Array.isArray(gsd.commands)) {
    return [];
  }
  return gsd.commands.map(cmd => cmd.name);
}

/**
 * Uninstall a plugin by name
 */
function uninstallPlugin(pluginName) {
  if (!pluginName) {
    console.error(`  ${red}Error:${reset} Plugin name required. Usage: plugin uninstall <name>`);
    process.exit(1);
  }

  const configDir = getConfigDir();
  const pluginDir = path.join(configDir, pluginName);
  const manifestPath = path.join(pluginDir, 'plugin.json');

  // Check if plugin is installed
  if (!fs.existsSync(manifestPath)) {
    console.error(`  ${red}Error:${reset} Plugin ${cyan}${pluginName}${reset} is not installed`);
    process.exit(1);
  }

  // Read manifest
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (parseErr) {
    console.error(`  ${red}Error:${reset} Corrupted plugin.json. Use --force to remove anyway.`);
    if (!force) {
      process.exit(1);
    }
    // With --force, remove directory anyway
    if (dryRun) {
      console.log(`\n  Would force remove: ${pluginName}/`);
      const commandsDir = path.join(configDir, 'commands', pluginName);
      if (fs.existsSync(commandsDir)) {
        console.log(`  Would force remove: commands/${pluginName}/`);
      }
      console.log(`\n  Run without --dry-run to actually uninstall.`);
      return;
    }
    console.log(`  ${yellow}Force removing${reset} plugin directory...`);
    fs.rmSync(pluginDir, { recursive: true, force: true });
    // Also try to remove commands dir
    const commandsDir = path.join(configDir, 'commands', pluginName);
    if (fs.existsSync(commandsDir)) {
      fs.rmSync(commandsDir, { recursive: true, force: true });
    }
    console.log(`\n  ${green}Done!${reset} Plugin ${pluginName} has been removed (forced).`);
    return;
  }

  // Check if this is a linked plugin
  const isLinked = manifest._installed?.linked === true;
  const linkedSource = manifest._installed?.source;

  // Check for services (need compose path before deletion)
  const services = manifest.gsd?.services;
  const hasServices = services && services['docker-compose'];
  const composePath = hasServices ? path.join(pluginDir, services['docker-compose']) : null;

  // Show header
  if (dryRun) {
    console.log(`\n  Would uninstall: ${cyan}${manifest.name}${reset} v${manifest.version}${isLinked ? ` ${dim}(linked)${reset}` : ''}`);
  } else {
    console.log(`\n  Uninstalling plugin: ${cyan}${manifest.name}${reset} v${manifest.version}${isLinked ? ` ${dim}(linked)${reset}` : ''}`);
  }

  // Track what we would remove for reporting
  const toRemove = [];
  const warnings = [];

  // Check commands directory: ~/.claude/commands/{plugin-name}/
  const commandsDir = path.join(configDir, 'commands', pluginName);
  if (fs.existsSync(commandsDir)) {
    toRemove.push({ path: commandsDir, display: `commands/${pluginName}/`, type: 'dir' });
  } else {
    warnings.push(`Expected commands/${pluginName}/ was not found`);
  }

  // Check agent files from ~/.claude/agents/ (only files from this plugin)
  const agents = manifest.gsd?.agents || [];
  for (const agent of agents) {
    const agentFile = path.join(configDir, 'agents', path.basename(agent.file));
    if (fs.existsSync(agentFile)) {
      toRemove.push({ path: agentFile, display: `agents/${path.basename(agent.file)}`, type: 'file' });
    } else {
      warnings.push(`Expected agents/${path.basename(agent.file)} was not found`);
    }
  }

  // Check plugin directory: ~/.claude/{plugin-name}/
  if (fs.existsSync(pluginDir)) {
    toRemove.push({ path: pluginDir, display: `${pluginName}/`, type: 'dir' });
  }

  // Dry run mode - just show what would be removed
  if (dryRun) {
    // Show service cleanup notice if services exist
    if (hasServices) {
      console.log(`  Would stop and remove containers for ${pluginName}`);
    }
    for (const item of toRemove) {
      console.log(`  - ~/.claude/${item.display}`);
    }
    if (isLinked && linkedSource) {
      console.log(`\n  ${dim}Note: Source files at ${linkedSource} would not be modified${reset}`);
    }
    console.log(`\n  Run without --dry-run to actually uninstall.`);
    return;
  }

  // Clean up services before file removal (compose file must exist)
  if (hasServices && composePath) {
    cleanupServices(pluginName, composePath);
  }

  // Actually remove files
  const removed = [];

  for (const item of toRemove) {
    try {
      if (item.type === 'dir') {
        fs.rmSync(item.path, { recursive: true, force: true });
      } else {
        fs.unlinkSync(item.path);
      }
      removed.push(item.display);
    } catch (err) {
      if (err.code === 'EACCES' || err.code === 'EPERM') {
        console.error(`  ${red}Error:${reset} Permission denied removing ${item.path}. Check file permissions.`);
        process.exit(1);
      }
      throw err;
    }
  }

  // Output results
  for (const item of removed) {
    console.log(`  ${green}✓${reset} Removed ${item}`);
  }

  // Show warnings for missing expected files
  for (const warning of warnings) {
    console.log(`  ${yellow}!${reset} ${warning}`);
  }

  // Show note about linked plugin source
  if (isLinked && linkedSource) {
    console.log(`\n  ${dim}Note: Source files at ${linkedSource} were not modified${reset}`);
  }

  console.log(`\n  ${green}Done!${reset} Plugin ${pluginName} has been uninstalled.`);
}

/**
 * Show help message
 */
function showHelp() {
  console.log(`
  ${cyan}GSD Plugin Manager${reset}

  ${yellow}Usage:${reset}
    plugin install <source>   Install a plugin from git URL or local path
    plugin list               List all installed plugins with status
    plugin info <name>        Show detailed plugin information
    plugin enable <name>      Enable a disabled plugin
    plugin disable <name>     Disable a plugin (keeps files)
    plugin commands           List all plugin commands
    plugin uninstall <name>   Remove an installed plugin

  ${yellow}Examples:${reset}
    ${dim}# List all installed plugins${reset}
    plugin list

    ${dim}# Show plugin details${reset}
    plugin info my-plugin

    ${dim}# Install from git repository${reset}
    plugin install https://github.com/user/my-plugin

    ${dim}# Install from local path${reset}
    plugin install ./my-plugin
    plugin install /path/to/my-plugin

    ${dim}# Install with symlinks for development${reset}
    plugin install ./my-plugin --link

    ${dim}# Force reinstall over existing${reset}
    plugin install ./my-plugin --force

    ${dim}# Uninstall a plugin${reset}
    plugin uninstall my-plugin

    ${dim}# Preview what would be removed${reset}
    plugin uninstall my-plugin --dry-run

    ${dim}# Enable a disabled plugin${reset}
    plugin enable my-plugin

    ${dim}# Disable a plugin (keeps files)${reset}
    plugin disable my-plugin

  ${yellow}Options:${reset}
    --help, -h       Show this help message
    --verbose, -v    Show detailed installation progress
    --link, -l       Create symlinks instead of copying (for development)
    --force, -f      Overwrite existing plugin installation / force removal
    --dry-run        Preview what would be removed without removing
`);
}

/**
 * List all installed plugins
 */
function listPlugins() {
  const configDir = getConfigDir();

  // Skip known non-plugin directories
  const skipDirs = ['commands', 'agents', 'get-shit-done'];

  // Check if config directory exists
  if (!fs.existsSync(configDir)) {
    console.log(`\n  No plugins installed.`);
    return;
  }

  // Scan for directories containing plugin.json
  const entries = fs.readdirSync(configDir, { withFileTypes: true });
  const plugins = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (skipDirs.includes(entry.name)) continue;

    const manifestPath = path.join(configDir, entry.name, 'plugin.json');
    if (!fs.existsSync(manifestPath)) continue;

    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      const hasServices = !!manifest.gsd?.services?.['docker-compose'];
      const enabled = manifest._installed?.enabled !== false;

      // Get service status only for enabled plugins with services
      let serviceStatus = null;
      if (hasServices && enabled) {
        serviceStatus = getServiceStatus(manifest.name || entry.name);
      }

      plugins.push({
        name: manifest.name || entry.name,
        version: manifest.version || 'unknown',
        description: manifest.description || '',
        linked: manifest._installed?.linked === true,
        enabled: enabled,
        date: manifest._installed?.date,
        hasServices: hasServices,
        serviceStatus: serviceStatus,
      });
    } catch {
      // Warn about corrupted plugin.json but continue
      console.log(`  ${yellow}Warning:${reset} Corrupted plugin.json in ${entry.name}/`);
    }
  }

  // Display results
  if (plugins.length === 0) {
    console.log(`\n  No plugins installed.`);
    return;
  }

  console.log(`\n  ${cyan}Installed Plugins:${reset}\n`);

  for (const plugin of plugins) {
    const linkedIndicator = plugin.linked ? ` ${yellow}(linked)${reset}` : '';
    const disabledIndicator = !plugin.enabled ? ` ${dim}(disabled)${reset}` : '';

    // Service status indicator
    let serviceIndicator = '';
    if (plugin.hasServices && plugin.enabled) {
      if (plugin.serviceStatus?.reason === 'no-docker') {
        serviceIndicator = ` ${dim}\u25cc${reset}`; // dim hollow dot - Docker unavailable
      } else if (plugin.serviceStatus?.running) {
        serviceIndicator = ` ${green}\u25cf${reset}`; // green dot - running
      } else {
        serviceIndicator = ` ${yellow}\u25cb${reset}`; // yellow hollow dot - not running
      }
    }

    console.log(`  ${cyan}${plugin.name}${reset} v${plugin.version}${linkedIndicator}${disabledIndicator}${serviceIndicator}`);
    if (plugin.description) {
      console.log(`    ${dim}${plugin.description}${reset}`);
    }
  }

  console.log('');
}

/**
 * Show detailed information about a plugin
 */
function showPluginInfo(pluginName) {
  // Validate pluginName is provided
  if (!pluginName) {
    console.error(`  ${red}Error:${reset} Plugin name required. Usage: plugin info <name>`);
    process.exit(1);
  }

  const configDir = getConfigDir();
  const pluginDir = path.join(configDir, pluginName);
  const manifestPath = path.join(pluginDir, 'plugin.json');

  // Check if plugin exists
  if (!fs.existsSync(manifestPath)) {
    console.error(`  ${red}Error:${reset} Plugin ${cyan}${pluginName}${reset} not installed`);
    process.exit(1);
  }

  // Parse manifest
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (parseErr) {
    console.error(`  ${red}Error:${reset} Corrupted plugin.json - ${parseErr.message}`);
    process.exit(1);
  }

  // Display formatted output
  console.log(`\n  ${cyan}Plugin:${reset} ${cyan}${manifest.name}${reset} v${manifest.version}`);
  if (manifest.description) {
    console.log(`  ${dim}${manifest.description}${reset}`);
  }

  // Author and repository
  console.log('');
  if (manifest.author) {
    console.log(`  Author: ${manifest.author}`);
  }
  if (manifest.repository) {
    console.log(`  Repository: ${manifest.repository}`);
  }

  const gsd = manifest.gsd || {};

  // Commands
  if (gsd.commands && Array.isArray(gsd.commands) && gsd.commands.length > 0) {
    console.log(`\n  ${cyan}Commands:${reset}`);
    for (const cmd of gsd.commands) {
      const desc = cmd.description ? ` - ${dim}${cmd.description}${reset}` : '';
      console.log(`    /${cmd.name}${desc}`);
    }
  }

  // Agents
  if (gsd.agents && Array.isArray(gsd.agents) && gsd.agents.length > 0) {
    console.log(`\n  ${cyan}Agents:${reset}`);
    for (const agent of gsd.agents) {
      const desc = agent.description ? ` - ${dim}${agent.description}${reset}` : '';
      console.log(`    ${agent.name}${desc}`);
    }
  }

  // Hooks
  if (gsd.hooks && Array.isArray(gsd.hooks) && gsd.hooks.length > 0) {
    console.log(`\n  ${cyan}Hooks:${reset}`);
    for (const hook of gsd.hooks) {
      const desc = hook.description ? ` - ${dim}${hook.description}${reset}` : '';
      console.log(`    ${hook.event}${desc}`);
    }
  }

  // Installation info
  const installed = manifest._installed || {};
  console.log(`\n  ${cyan}Installation:${reset}`);

  if (installed.date) {
    const dateStr = installed.date.split('T')[0]; // Format as YYYY-MM-DD
    console.log(`    Installed: ${dateStr}`);
  }

  if (installed.linked && installed.source) {
    console.log(`    ${yellow}Linked from:${reset} ${installed.source}`);
  } else {
    console.log(`    Location: ~/.claude/${manifest.name}/`);
  }

  // Services section (only if plugin has services)
  if (gsd.services) {
    console.log(`\n  ${cyan}Services:${reset}`);

    // Show docker-compose file path
    if (gsd.services['docker-compose']) {
      console.log(`    Docker Compose: ${gsd.services['docker-compose']}`);
    }

    // Show health check path if configured
    if (gsd.services.healthCheck) {
      console.log(`    Health Check: ${gsd.services.healthCheck}`);
    }

    // Get and show service status
    const status = getServiceStatus(pluginName);
    if (status.reason === 'no-docker') {
      console.log(`    Status: ${dim}Docker unavailable${reset}`);
    } else if (status.running) {
      console.log(`    Status: ${green}Running${reset} (${status.containers} container${status.containers !== 1 ? 's' : ''})`);

      // If running and healthCheck configured, show health status
      if (gsd.services.healthCheck) {
        const health = checkServiceHealth(pluginName);
        if (health.status === 'healthy') {
          console.log(`    Health: ${green}Healthy${reset}`);
        } else if (health.status === 'unhealthy') {
          console.log(`    Health: ${red}Unhealthy${reset}${health.error ? ` - ${health.error}` : ''}`);
        } else if (health.status === 'missing-script') {
          console.log(`    Health: ${yellow}Script not found${reset}`);
        } else {
          console.log(`    Health: ${dim}Unknown${reset}`);
        }
      }
    } else {
      console.log(`    Status: ${yellow}Stopped${reset}`);
    }
  }

  console.log('');
}

/**
 * Enable a disabled plugin
 */
function enablePlugin(pluginName) {
  if (!pluginName) {
    console.error(`  ${red}Error:${reset} Plugin name required. Usage: plugin enable <name>`);
    process.exit(1);
  }

  const configDir = getConfigDir();
  const pluginDir = path.join(configDir, pluginName);
  const manifestPath = path.join(pluginDir, 'plugin.json');

  // Check if plugin is installed
  if (!fs.existsSync(manifestPath)) {
    console.error(`  ${red}Error:${reset} Plugin ${cyan}${pluginName}${reset} is not installed`);
    process.exit(1);
  }

  // Read manifest
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (parseErr) {
    console.error(`  ${red}Error:${reset} Corrupted plugin.json - ${parseErr.message}`);
    process.exit(1);
  }

  // Check if already enabled (default is true if not set)
  const currentlyEnabled = manifest._installed?.enabled !== false;
  if (currentlyEnabled) {
    console.log(`  ${yellow}Warning:${reset} Plugin ${cyan}${pluginName}${reset} is already enabled`);
    process.exit(0);
  }

  // Enable the plugin
  manifest._installed = manifest._installed || {};
  manifest._installed.enabled = true;

  // Write updated manifest
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  // Start services if plugin has them
  const hasServices = manifest.gsd?.services?.['docker-compose'];
  const servicesStarted = hasServices ? startServices(pluginName) : false;

  const serviceMsg = servicesStarted ? ' (services started)' : '';
  console.log(`  ${green}Done!${reset} Plugin ${cyan}${pluginName}${reset} enabled${serviceMsg}`);
}

/**
 * List all commands from enabled plugins
 */
function listCommands() {
  const configDir = getConfigDir();
  const commandsDir = path.join(configDir, 'commands');

  // Check if commands directory exists
  if (!fs.existsSync(commandsDir)) {
    return [];
  }

  const commands = [];

  // Scan commands directory for plugin subdirectories (skip 'gsd' - core)
  const entries = fs.readdirSync(commandsDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name === 'gsd') continue; // Skip core GSD commands

    const pluginName = entry.name;
    const manifestPath = path.join(configDir, pluginName, 'plugin.json');

    // Check if plugin manifest exists
    if (!fs.existsSync(manifestPath)) continue;

    // Read manifest
    let manifest;
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    } catch {
      continue; // Skip corrupted manifests
    }

    // Check if plugin is enabled (default true if not set)
    const enabled = manifest._installed?.enabled !== false;
    if (!enabled) continue;

    // Extract commands from manifest
    const gsd = manifest.gsd || {};
    if (!gsd.commands || !Array.isArray(gsd.commands)) continue;

    for (const cmd of gsd.commands) {
      commands.push({
        name: cmd.name,
        description: cmd.description || '',
        plugin: pluginName,
        file: cmd.file,
      });
    }
  }

  return commands;
}

/**
 * Display all plugin commands grouped by plugin
 */
function showCommands() {
  const commands = listCommands();

  if (commands.length === 0) {
    console.log(`\n  No plugin commands installed.`);
    return;
  }

  // Group by plugin
  const byPlugin = {};
  for (const cmd of commands) {
    if (!byPlugin[cmd.plugin]) {
      byPlugin[cmd.plugin] = [];
    }
    byPlugin[cmd.plugin].push(cmd);
  }

  console.log(`\n  ${cyan}Plugin Commands:${reset}\n`);

  for (const pluginName of Object.keys(byPlugin).sort()) {
    console.log(`  ${cyan}${pluginName}:${reset}`);
    for (const cmd of byPlugin[pluginName]) {
      const desc = cmd.description ? ` - ${dim}${cmd.description}${reset}` : '';
      console.log(`    /${cmd.name}${desc}`);
    }
    console.log('');
  }
}

/**
 * Disable a plugin (keeps files but marks as inactive)
 */
function disablePlugin(pluginName) {
  if (!pluginName) {
    console.error(`  ${red}Error:${reset} Plugin name required. Usage: plugin disable <name>`);
    process.exit(1);
  }

  const configDir = getConfigDir();
  const pluginDir = path.join(configDir, pluginName);
  const manifestPath = path.join(pluginDir, 'plugin.json');

  // Check if plugin is installed
  if (!fs.existsSync(manifestPath)) {
    console.error(`  ${red}Error:${reset} Plugin ${cyan}${pluginName}${reset} is not installed`);
    process.exit(1);
  }

  // Read manifest
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (parseErr) {
    console.error(`  ${red}Error:${reset} Corrupted plugin.json - ${parseErr.message}`);
    process.exit(1);
  }

  // Check if already disabled
  const currentlyEnabled = manifest._installed?.enabled !== false;
  if (!currentlyEnabled) {
    console.log(`  ${yellow}Warning:${reset} Plugin ${cyan}${pluginName}${reset} is already disabled`);
    process.exit(0);
  }

  // Stop services before disabling if plugin has them
  const hasServices = manifest.gsd?.services?.['docker-compose'];
  const servicesStopped = hasServices ? stopServices(pluginName) : false;

  // Disable the plugin
  manifest._installed = manifest._installed || {};
  manifest._installed.enabled = false;

  // Write updated manifest
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  const serviceMsg = servicesStopped ? ' (services stopped)' : '';
  console.log(`  ${green}Done!${reset} Plugin ${cyan}${pluginName}${reset} disabled${serviceMsg}`);
}

/**
 * Check for existing plugin installation and handle conflicts
 */
function checkExistingInstallation(pluginName, configDir) {
  const existingDir = path.join(configDir, pluginName);
  const existingCommandsDir = path.join(configDir, 'commands', pluginName);

  if (fs.existsSync(existingDir)) {
    const existingManifest = path.join(existingDir, 'plugin.json');
    if (fs.existsSync(existingManifest)) {
      try {
        const existing = JSON.parse(fs.readFileSync(existingManifest, 'utf8'));
        if (!force) {
          console.error(`  ${red}Error:${reset} Plugin ${cyan}${pluginName}${reset} v${existing.version} already installed.`);
          console.error(`  ${dim}Use --force to overwrite or uninstall first.${reset}`);
          process.exit(1);
        }
        console.log(`  ${yellow}Overwriting${reset} existing ${pluginName} v${existing.version}...`);
      } catch {
        // Invalid manifest, proceed with overwrite if --force
        if (!force) {
          console.error(`  ${red}Error:${reset} Directory ${cyan}~/.claude/${pluginName}${reset} already exists.`);
          console.error(`  ${dim}Use --force to overwrite.${reset}`);
          process.exit(1);
        }
      }
      // Remove existing installation
      fs.rmSync(existingDir, { recursive: true, force: true });
    }
  }

  // Also check commands namespace
  if (fs.existsSync(existingCommandsDir)) {
    if (!force) {
      console.error(`  ${red}Error:${reset} Commands directory ${cyan}~/.claude/commands/${pluginName}${reset} already exists.`);
      console.error(`  ${dim}Use --force to overwrite.${reset}`);
      process.exit(1);
    }
    fs.rmSync(existingCommandsDir, { recursive: true, force: true });
  }
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

  // Warn if using --link with git URL
  if (link && isGitUrl(source)) {
    console.error(`  ${red}Error:${reset} --link cannot be used with git URLs (no local source to link)`);
    console.error(`  ${dim}Clone the repository locally first, then install with --link${reset}`);
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
    // Local path - normalize it
    pluginDir = path.normalize(path.resolve(expandTilde(source)));

    if (!fs.existsSync(pluginDir)) {
      console.error(`  ${red}Error:${reset} Path does not exist: ${pluginDir}`);
      process.exit(1);
    }

    if (!fs.statSync(pluginDir).isDirectory()) {
      console.error(`  ${red}Error:${reset} Not a directory: ${pluginDir}`);
      process.exit(1);
    }
  }

  try {
    // Check for plugin.json
    const manifestPath = path.join(pluginDir, 'plugin.json');
    if (!fs.existsSync(manifestPath)) {
      console.error(`  ${red}Error:${reset} Missing plugin.json in ${pluginDir}`);
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

    const linkLabel = link ? ` ${dim}(linked)${reset}` : '';
    console.log(`\n  Installing plugin: ${cyan}${manifest.name}${reset} v${manifest.version}${linkLabel}`);

    // Full validation
    const validationErrors = validateManifest(manifest, pluginDir);
    if (validationErrors.length > 0) {
      console.error(`  ${red}Validation errors:${reset}`);
      for (const err of validationErrors) {
        console.error(`    - ${err}`);
      }
      cleanup(tempDir);
      process.exit(1);
    }
    console.log(`  ${green}✓${reset} Validated plugin.json`);

    // Check for existing installation
    const configDir = getConfigDir();
    checkExistingInstallation(manifest.name, configDir);

    // Install files
    const installedFiles = installPluginFiles(pluginDir, manifest, { verbose, isLink: link });

    // Get installed commands
    const commands = getInstalledCommands(manifest);
    if (commands.length > 0) {
      const verb = link ? 'Linked' : 'Installed';
      console.log(`  ${green}✓${reset} ${verb} commands: ${commands.join(', ')}`);
    }

    const verb = link ? 'Linked' : 'Installed';
    console.log(`  ${green}✓${reset} ${verb} ${installedFiles.length} files to ~/.claude/${manifest.name}/`);

    // Start services if plugin has them (plugins are enabled by default on install)
    const hasServices = manifest.gsd?.services?.['docker-compose'];
    if (hasServices) {
      startServices(manifest.name);
    }

    // Clean up temp directory
    cleanup(tempDir);

    if (link) {
      console.log(`\n  ${green}Done!${reset} Plugin is linked. Changes to source will reflect immediately.`);
    } else {
      console.log(`\n  ${green}Done!${reset} Run ${cyan}/gsd:help${reset} to see new commands.`);
    }

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
    listPlugins();
    break;
  case 'info':
    showPluginInfo(source);
    break;
  case 'uninstall':
    uninstallPlugin(source);
    break;
  case 'enable':
    enablePlugin(source);
    break;
  case 'disable':
    disablePlugin(source);
    break;
  case 'commands':
    showCommands();
    break;
  default:
    console.error(`  ${red}Error:${reset} Unknown command: ${command}`);
    showHelp();
    process.exit(1);
}
