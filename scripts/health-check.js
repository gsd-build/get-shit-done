#!/usr/bin/env node
/**
 * GSD Installation Health Check
 *
 * Validates all installation components.
 * Called by install-orchestrator.js as final step.
 *
 * Categories:
 * 1. NPM Dependencies
 * 2. Whisper Models
 * 3. Claude Code Hooks (if installed globally)
 * 4. MCP Configuration (if configured)
 * 5. Environment Template
 * 6. Module Imports
 *
 * Exit codes:
 * - 0: All required checks passed
 * - 1: One or more required checks failed
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Define all health checks
 */
function defineChecks() {
  const projectRoot = path.resolve(__dirname, '..');

  return [
    // Category 1: NPM Dependencies
    {
      category: 'NPM Dependencies',
      name: 'Root node_modules',
      skip: () => false, // Always check
      test: () => {
        const nodeModules = path.join(projectRoot, 'node_modules');
        if (!fs.existsSync(nodeModules)) return false;
        const contents = fs.readdirSync(nodeModules);
        return contents.length > 0;
      }
    },
    {
      category: 'NPM Dependencies',
      name: 'Key dependency: better-sqlite3',
      skip: () => false,
      test: () => {
        try {
          require.resolve('better-sqlite3');
          return true;
        } catch {
          return false;
        }
      }
    },
    {
      category: 'NPM Dependencies',
      name: 'Key dependency: @xenova/transformers',
      skip: () => false,
      test: () => {
        try {
          require.resolve('@xenova/transformers');
          return true;
        } catch {
          return false;
        }
      }
    },
    {
      category: 'NPM Dependencies',
      name: 'Telegram MCP node_modules',
      skip: () => !fs.existsSync(path.join(projectRoot, 'mcp-servers', 'telegram-mcp')),
      test: () => {
        const mcpNodeModules = path.join(projectRoot, 'mcp-servers', 'telegram-mcp', 'node_modules');
        if (!fs.existsSync(mcpNodeModules)) return false;
        const contents = fs.readdirSync(mcpNodeModules);
        return contents.length > 0;
      }
    },

    // Category 2: Whisper Models
    {
      category: 'Whisper Models',
      name: 'Whisper cache directory',
      skip: () => false,
      test: () => {
        const whisperCache = path.join(os.homedir(), '.cache', 'whisper');
        return fs.existsSync(whisperCache);
      }
    },
    {
      category: 'Whisper Models',
      name: 'Whisper base.en model',
      skip: () => {
        const whisperCache = path.join(os.homedir(), '.cache', 'whisper');
        return !fs.existsSync(whisperCache);
      },
      test: () => {
        const modelPath = path.join(os.homedir(), '.cache', 'whisper', 'ggml-base.en.bin');
        if (!fs.existsSync(modelPath)) return false;

        const stats = fs.statSync(modelPath);
        // Model should be >100MB (base.en is ~141MB)
        return stats.size > 100 * 1024 * 1024;
      }
    },

    // Category 3: Claude Code Hooks
    {
      category: 'Claude Code Hooks',
      name: 'gsd-statusline.js hook',
      skip: () => {
        const hooksDir = path.join(os.homedir(), '.claude', 'hooks');
        return !fs.existsSync(hooksDir);
      },
      test: () => {
        const hookPath = path.join(os.homedir(), '.claude', 'hooks', 'gsd-statusline.js');
        return fs.existsSync(hookPath);
      }
    },
    {
      category: 'Claude Code Hooks',
      name: 'gsd-check-update.js hook',
      skip: () => {
        const hooksDir = path.join(os.homedir(), '.claude', 'hooks');
        return !fs.existsSync(hooksDir);
      },
      test: () => {
        const hookPath = path.join(os.homedir(), '.claude', 'hooks', 'gsd-check-update.js');
        return fs.existsSync(hookPath);
      }
    },

    // Category 4: MCP Configuration
    {
      category: 'MCP Configuration',
      name: '~/.claude.json exists',
      skip: () => {
        const mcpConfig = path.join(os.homedir(), '.claude.json');
        return !fs.existsSync(mcpConfig);
      },
      test: () => {
        const mcpConfig = path.join(os.homedir(), '.claude.json');
        if (!fs.existsSync(mcpConfig)) return false;

        try {
          const content = fs.readFileSync(mcpConfig, 'utf8');
          JSON.parse(content); // Valid JSON?
          return true;
        } catch {
          return false;
        }
      }
    },
    {
      category: 'MCP Configuration',
      name: 'Telegram MCP server entry',
      skip: () => {
        const mcpConfig = path.join(os.homedir(), '.claude.json');
        return !fs.existsSync(mcpConfig);
      },
      test: () => {
        const mcpConfig = path.join(os.homedir(), '.claude.json');
        if (!fs.existsSync(mcpConfig)) return false;

        try {
          const content = fs.readFileSync(mcpConfig, 'utf8');
          const config = JSON.parse(content);
          return config.mcpServers && config.mcpServers.telegram !== undefined;
        } catch {
          return false;
        }
      }
    },

    // Category 5: Environment Template
    {
      category: 'Environment Template',
      name: '.env.template exists',
      skip: () => {
        // Skip if .env already exists (user has configured environment)
        const env = path.join(projectRoot, '.env');
        return fs.existsSync(env);
      },
      test: () => {
        const envTemplate = path.join(projectRoot, '.env.template');
        return fs.existsSync(envTemplate);
      }
    },
    {
      category: 'Environment Template',
      name: 'Contains TELEGRAM_BOT_TOKEN',
      skip: () => {
        const envTemplate = path.join(projectRoot, '.env.template');
        return !fs.existsSync(envTemplate);
      },
      test: () => {
        const envTemplate = path.join(projectRoot, '.env.template');
        if (!fs.existsSync(envTemplate)) return false;

        try {
          const content = fs.readFileSync(envTemplate, 'utf8');
          return content.includes('TELEGRAM_BOT_TOKEN');
        } catch {
          return false;
        }
      }
    },

    // Category 6: Module Imports
    {
      category: 'Module Imports',
      name: 'gsd-tools.js exists',
      skip: () => false,
      test: () => {
        try {
          const toolsPath = path.join(projectRoot, 'get-shit-done', 'bin', 'gsd-tools.js');
          if (!fs.existsSync(toolsPath)) return false;

          // Verify it's a valid JavaScript file
          const stats = fs.statSync(toolsPath);
          return stats.size > 0;
        } catch {
          return false;
        }
      }
    },
    {
      category: 'Module Imports',
      name: 'Module stubs: validator',
      skip: () => false,
      test: () => {
        try {
          const modulePath = path.join(projectRoot, 'get-shit-done', 'modules', 'validator', 'index.js');
          return fs.existsSync(modulePath);
        } catch {
          return false;
        }
      }
    },
    {
      category: 'Module Imports',
      name: 'Module stubs: circuit-breaker',
      skip: () => false,
      test: () => {
        try {
          const modulePath = path.join(projectRoot, 'get-shit-done', 'modules', 'circuit-breaker', 'index.js');
          return fs.existsSync(modulePath);
        } catch {
          return false;
        }
      }
    },
    {
      category: 'Module Imports',
      name: 'Module stubs: escalation',
      skip: () => false,
      test: () => {
        try {
          const modulePath = path.join(projectRoot, 'get-shit-done', 'modules', 'escalation', 'index.js');
          return fs.existsSync(modulePath);
        } catch {
          return false;
        }
      }
    },
    {
      category: 'Module Imports',
      name: 'Module stubs: feedback',
      skip: () => false,
      test: () => {
        try {
          const modulePath = path.join(projectRoot, 'get-shit-done', 'modules', 'feedback', 'index.js');
          return fs.existsSync(modulePath);
        } catch {
          return false;
        }
      }
    },
    {
      category: 'Module Imports',
      name: 'Module stubs: learning',
      skip: () => false,
      test: () => {
        try {
          const modulePath = path.join(projectRoot, 'get-shit-done', 'modules', 'learning', 'index.js');
          return fs.existsSync(modulePath);
        } catch {
          return false;
        }
      }
    }
  ];
}

/**
 * Run all health checks
 */
async function healthCheck() {
  const checks = defineChecks();

  // Group checks by category
  const categories = {};
  for (const check of checks) {
    if (!categories[check.category]) {
      categories[check.category] = [];
    }
    categories[check.category].push(check);
  }

  let totalPassed = 0;
  let totalFailed = 0;
  let totalSkipped = 0;

  console.log('');
  console.log('🩺 Running Health Checks...\n');

  // Run checks by category
  for (const [category, categoryChecks] of Object.entries(categories)) {
    console.log(`   ${category}:`);

    for (const check of categoryChecks) {
      const checkName = check.name;

      // Check if should skip
      if (check.skip && check.skip()) {
        console.log(`     - ${checkName} (skipped)`);
        totalSkipped++;
        continue;
      }

      // Run test
      try {
        const result = check.test();
        if (result) {
          console.log(`     + ${checkName}`);
          totalPassed++;
        } else {
          console.log(`     x ${checkName}`);
          totalFailed++;
        }
      } catch (error) {
        console.log(`     x ${checkName} (error: ${error.message})`);
        totalFailed++;
      }
    }

    console.log('');
  }

  // Summary
  console.log(`   Summary: ${totalPassed} passed, ${totalFailed} failed, ${totalSkipped} skipped\n`);

  if (totalFailed > 0) {
    console.error('   ⚠️  Installation incomplete. Re-run: npm run install:gsd\n');
    return false;
  }

  console.log('   ✅ Installation validated successfully\n');
  return true;
}

// Main entry point
if (require.main === module) {
  healthCheck()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('   ❌ Health check error:', error.message);
      process.exit(1);
    });
} else {
  // Called via require() from install-orchestrator
  module.exports = healthCheck;
}
