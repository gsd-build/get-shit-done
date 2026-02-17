#!/usr/bin/env node
/**
 * Configure MCP servers in ~/.claude.json (global)
 * Merges GSD servers with existing configuration (user servers preserved)
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Install MCP server configuration
 * @param {Object} options - Installation options
 * @param {boolean} options.debug - Enable debug output
 * @returns {Object} Installation result with success and details
 */
function installMcp(options = {}) {
  const projectRoot = path.resolve(__dirname, '..');
  const configDir = path.join(os.homedir(), '.claude');
  const mcpPath = path.join(configDir, '.claude.json');

  if (options.debug) {
    console.log(`       Debug: Project root: ${projectRoot}`);
    console.log(`       Debug: MCP config path: ${mcpPath}`);
  }

  // Create .claude directory if needed
  fs.mkdirSync(configDir, { recursive: true });

  // GSD servers to install (with absolute paths)
  const gsdServers = {
    telegram: {
      command: 'node',
      args: [path.join(projectRoot, 'mcp-servers/telegram-mcp/dist/index.js')],
      env: {
        PROJECT_ROOT: projectRoot,
        TELEGRAM_BOT_TOKEN: '${TELEGRAM_BOT_TOKEN}',
        TELEGRAM_OWNER_ID: '${TELEGRAM_OWNER_ID}'
      }
    }
  };

  // Load existing config
  let existing = { mcpServers: {} };
  let backupCreated = false;

  if (fs.existsSync(mcpPath)) {
    try {
      const content = fs.readFileSync(mcpPath, 'utf8');
      existing = JSON.parse(content);

      // Create backup before modifying
      const backupPath = `${mcpPath}.backup`;
      fs.copyFileSync(mcpPath, backupPath);
      backupCreated = true;

      if (options.debug) {
        console.log(`       Debug: Loaded existing .claude.json`);
        console.log(`       Debug: Backup created at ${backupPath}`);
      }
    } catch (e) {
      console.log(`       Warning: Could not parse existing .claude.json: ${e.message}`);
      console.log(`       Creating new config...`);
    }
  }

  // Merge (GSD defaults, user servers take precedence)
  const merged = {
    ...existing,
    mcpServers: {
      ...gsdServers,
      ...(existing.mcpServers || {})  // User servers take precedence
    }
  };

  // Validate before write
  const jsonString = JSON.stringify(merged, null, 2);
  try {
    JSON.parse(jsonString);  // Validate
    if (options.debug) {
      console.log(`       Debug: Validated merged JSON`);
    }
  } catch (e) {
    throw new Error(`Generated invalid JSON - aborting: ${e.message}`);
  }

  // Atomic write (tmp file + rename)
  const tmpPath = `${mcpPath}.tmp`;
  fs.writeFileSync(tmpPath, jsonString + '\n');
  fs.renameSync(tmpPath, mcpPath);

  // Report what was changed
  const added = Object.keys(gsdServers).filter(k => !existing.mcpServers?.[k]);
  const skipped = Object.keys(gsdServers).filter(k => existing.mcpServers?.[k]);

  if (added.length > 0) {
    console.log(`       Added MCP servers: ${added.join(', ')}`);
  }
  if (skipped.length > 0) {
    console.log(`       Skipped (already configured): ${skipped.join(', ')}`);
  }

  return {
    success: true,
    added,
    skipped,
    backupCreated,
    path: mcpPath
  };
}

// Run if executed directly
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {
    debug: args.includes('--debug')
  };

  console.log('  Step 4: Configuring MCP servers...');

  try {
    const result = installMcp(options);

    if (result.success) {
      console.log(`  ✓ MCP configuration complete`);
      if (result.backupCreated) {
        console.log(`    Backup created: ~/.claude/.claude.json.backup`);
      }
    } else {
      console.error(`  ✗ MCP configuration failed`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`  ✗ MCP configuration error: ${error.message}`);
    if (options.debug) {
      console.error(error.stack);
    }
    process.exit(1);
  }
} else {
  // Called via require() from install-orchestrator
  module.exports = installMcp;
}
