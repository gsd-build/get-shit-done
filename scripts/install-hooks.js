#!/usr/bin/env node
/**
 * Install Claude Code hooks to ~/.claude/hooks/
 * Configures settings.json with statusLine and SessionStart hook
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Install hooks to Claude Code configuration
 * @param {Object} options - Installation options
 * @param {boolean} options.forceStatusline - Replace existing statusline config
 * @param {boolean} options.debug - Enable debug output
 * @returns {Object} Installation result with success and details
 */
function installHooks(options = {}) {
  const configDir = path.join(os.homedir(), '.claude');
  const hooksDir = path.join(configDir, 'hooks');

  if (options.debug) {
    console.log(`       Debug: Config dir: ${configDir}`);
    console.log(`       Debug: Hooks dir: ${hooksDir}`);
  }

  // Find source hooks (prefer dist if exists, fall back to source)
  const distDir = path.join(__dirname, '..', 'hooks', 'dist');
  const srcDir = path.join(__dirname, '..', 'hooks');
  const hooksSrc = fs.existsSync(distDir) ? distDir : srcDir;

  if (options.debug) {
    console.log(`       Debug: Using hooks from: ${hooksSrc}`);
  }

  // Create destination directory
  fs.mkdirSync(hooksDir, { recursive: true });

  // Copy hooks
  const hooks = ['gsd-statusline.js', 'gsd-check-update.js'];
  const installed = [];
  const missing = [];

  for (const hook of hooks) {
    const src = path.join(hooksSrc, hook);
    if (!fs.existsSync(src)) {
      console.log(`       Warning: ${hook} not found in source`);
      missing.push(hook);
      continue;
    }
    const dest = path.join(hooksDir, hook);
    fs.copyFileSync(src, dest);
    console.log(`       Installed ${hook}`);
    installed.push(hook);
  }

  // Configure settings.json
  const settingsResult = configureSettings(configDir, hooksDir, options);

  return {
    success: installed.length > 0,
    installed,
    missing,
    settings: settingsResult
  };
}

/**
 * Configure settings.json with statusLine and SessionStart hooks
 * Merges with existing configuration, preserves user's settings
 * @param {string} configDir - Path to .claude directory
 * @param {string} hooksDir - Path to hooks directory
 * @param {Object} options - Configuration options
 * @returns {Object} Configuration result
 */
function configureSettings(configDir, hooksDir, options) {
  const settingsPath = path.join(configDir, 'settings.json');
  let settings = {};

  // Read existing settings
  if (fs.existsSync(settingsPath)) {
    try {
      settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      if (options.debug) {
        console.log(`       Debug: Loaded existing settings.json`);
      }
    } catch (e) {
      console.log(`       Warning: Could not parse settings.json: ${e.message}`);
      console.log(`       Creating new settings...`);
    }
  }

  const changes = [];

  // Configure statusLine (skip if exists unless force)
  // Use forward slashes for cross-platform compatibility
  const statuslineCommand = `node "${hooksDir.replace(/\\/g, '/')}/gsd-statusline.js"`;
  if (!settings.statusLine || options.forceStatusline) {
    settings.statusLine = { type: 'command', command: statuslineCommand };
    console.log(`       Configured statusline`);
    changes.push('statusline');
  } else {
    console.log(`       Skipped statusline (already configured)`);
  }

  // Configure SessionStart hook for update check
  if (!settings.hooks) settings.hooks = {};
  if (!settings.hooks.SessionStart) settings.hooks.SessionStart = [];

  const updateCommand = `node "${hooksDir.replace(/\\/g, '/')}/gsd-check-update.js"`;
  const hasUpdateHook = settings.hooks.SessionStart.some(entry =>
    entry.hooks?.some(h => h.command?.includes('gsd-check-update'))
  );

  if (!hasUpdateHook) {
    settings.hooks.SessionStart.push({
      hooks: [{ type: 'command', command: updateCommand }]
    });
    console.log(`       Configured update check hook`);
    changes.push('session-start');
  } else {
    console.log(`       Skipped update check (already configured)`);
  }

  // Write settings.json
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');

  return {
    success: true,
    changes,
    path: settingsPath
  };
}

// Run if executed directly
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {
    forceStatusline: args.includes('--force-statusline'),
    debug: args.includes('--debug')
  };

  console.log('  Step 3: Installing Claude Code hooks...');

  try {
    const result = installHooks(options);

    if (result.success) {
      console.log(`  ✓ Hooks installed successfully`);
      if (result.missing.length > 0) {
        console.log(`    Warning: ${result.missing.length} hook(s) missing from source`);
      }
    } else {
      console.error(`  ✗ Hook installation failed`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`  ✗ Hook installation error: ${error.message}`);
    if (options.debug) {
      console.error(error.stack);
    }
    process.exit(1);
  }
} else {
  // Called via require() from install-orchestrator
  module.exports = installHooks;
}
