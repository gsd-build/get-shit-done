# Phase 10: GSD Installation System - Research

**Researched:** 2026-02-17
**Domain:** Node.js installation automation, package management, cross-platform scripts, Whisper model provisioning, Claude Code hook installation, MCP server configuration
**Confidence:** HIGH

## Summary

Phase 10 creates a comprehensive zero-configuration installation system that automates setup for all GSD dependencies, external modules, Whisper models, Claude Code hooks, and MCP servers. The goal is a single command (`npm run install:gsd` or `./scripts/install.sh`) that handles everything from dependency installation across multiple package.json files to Whisper model downloads to hook installation without manual intervention.

The project has an existing sophisticated installer (`bin/install.js`) that handles commands, agents, and hooks for Claude Code/OpenCode/Gemini with interactive prompts, path replacement, cross-platform support, and settings.json management. Phase 10 extends this pattern to include: (1) npm workspace support for monorepo dependency installation, (2) Whisper model download/verification automation, (3) external module consolidation into `get-shit-done/modules/`, (4) .env.template generation with all required variables, (5) comprehensive health check validation, and (6) clean uninstall script.

**Primary recommendation:** Use npm workspaces for unified dependency management, create dedicated installation orchestrator script that extends existing `bin/install.js` pattern, automate Whisper model download with `whisper-node` download command wrapped in verification logic, install hooks using proven path from existing installer, configure MCP servers via .mcp.json merge strategy (preserve user config), consolidate external modules with clear module structure, generate .env.template from code analysis, implement health check validation covering all components, and provide clean uninstall that preserves user data.

---

## Standard Stack

### Core Installation Tools
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| npm workspaces | Built-in (npm 7+) | Monorepo dependency management | Native solution for multiple package.json files, hoists shared dependencies, unified install command |
| whisper-node | 1.1.1 | Whisper model management | Has built-in download command, proven in Phase 8/08.1, supports base.en + base multilingual |
| cross-spawn | Latest | Cross-platform process spawning | Works on Windows/macOS/Linux, handles path differences automatically |
| execa | Latest | Better child process API | Promise-based, better error handling than native child_process |

### Supporting Tools
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| dotenv | 17.3.1 | Environment variable loading | Already in use, standard for .env files |
| chalk | Latest | Terminal colors/formatting | Installation feedback, progress indicators, error highlighting |
| ora | Latest | Terminal spinners | Long-running operations (model downloads, npm install) |
| enquirer | Latest | Interactive prompts | User choices if not fully automated |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| npm workspaces | Lerna, pnpm workspaces, Turborepo | npm workspaces: built-in, zero config. Lerna: deprecated. pnpm: requires separate install. Turborepo: overkill for simple monorepo. **Recommend npm workspaces**. |
| Shell script installer | Pure Node.js installer | Shell: simpler for some tasks. Node.js: already proven in bin/install.js, cross-platform without shell differences. **Recommend Node.js** for consistency. |
| postinstall script | Manual install command | postinstall: automatic on npm install. Manual: explicit user control, avoids security concerns with auto-executing scripts. **Recommend manual** for transparency. |

**Installation Approach:**
```bash
# User runs single command
npm run install:gsd

# Or shell script wrapper
./scripts/install.sh

# Script orchestrates:
# 1. npm workspaces install (all package.json files)
# 2. Whisper model download + verification
# 3. Hook installation (extends bin/install.js logic)
# 4. MCP server configuration (.mcp.json merge)
# 5. .env.template creation
# 6. Health check validation
```

---

## Architecture Patterns

### Recommended Project Structure
```
get-shit-done/
├── package.json                    # Root workspace config
├── .env.template                   # Generated template with all vars
├── scripts/
│   ├── install.sh                  # Main install orchestrator
│   ├── install-modules.js          # Module consolidation + npm install
│   ├── install-whisper.js          # Whisper model download/verify
│   ├── install-hooks.js            # Extends bin/install.js logic
│   ├── install-mcp.js              # MCP server config merge
│   ├── health-check.js             # Validation after install
│   └── uninstall.sh                # Clean removal
├── bin/
│   └── install.js                  # Existing installer (reuse)
├── get-shit-done/
│   ├── modules/                    # Consolidated external modules
│   │   ├── validator/
│   │   │   ├── package.json
│   │   │   └── src/
│   │   ├── circuit-breaker/
│   │   │   ├── package.json
│   │   │   └── src/
│   │   ├── escalation/
│   │   ├── feedback/
│   │   └── learning/
│   ├── bin/
│   └── references/
├── mcp-servers/
│   └── telegram-mcp/
│       └── package.json            # MCP server dependencies
└── .claude/
    ├── .mcp.json                   # Project MCP config
    └── hooks/                      # Installed hooks
```

### Pattern 1: npm Workspaces Configuration
**What:** Configure root package.json to manage multiple nested packages as single monorepo
**When to use:** Multiple package.json files need unified dependency management
**Example:**
```json
// Root package.json
{
  "name": "get-shit-done-cc",
  "workspaces": [
    "get-shit-done/modules/*",
    "mcp-servers/*"
  ],
  "scripts": {
    "install:gsd": "node scripts/install-orchestrator.js",
    "health-check": "node scripts/health-check.js",
    "uninstall:gsd": "bash scripts/uninstall.sh"
  }
}
```
Source: [npm Workspaces Documentation](https://docs.npmjs.com/cli/v8/using-npm/workspaces)

### Pattern 2: Whisper Model Download Automation
**What:** Programmatically download and verify Whisper models during installation
**When to use:** Voice transcription features require local Whisper models
**Example:**
```javascript
// scripts/install-whisper.js
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const MODELS = ['base.en']; // English only initially, add base (multilingual) for Russian

async function installWhisperModels() {
  for (const model of MODELS) {
    const modelPath = path.join(
      os.homedir(),
      '.cache',
      'whisper',
      `ggml-${model}.bin`
    );

    if (fs.existsSync(modelPath)) {
      console.log(`✓ Whisper model ${model} already installed`);
      continue;
    }

    console.log(`Downloading Whisper model: ${model}...`);
    try {
      // Use whisper-node's download command
      execSync(`npx whisper-node download ${model}`, {
        stdio: 'inherit',
        windowsHide: true
      });

      // Verify download
      if (!fs.existsSync(modelPath)) {
        throw new Error(`Model download failed: ${modelPath} not found`);
      }

      console.log(`✓ Whisper model ${model} installed`);
    } catch (error) {
      console.error(`✗ Failed to download ${model}:`, error.message);
      process.exit(1);
    }
  }
}
```
Source: [whisper-node npm package](https://www.npmjs.com/package/whisper-node)

### Pattern 3: MCP Configuration Merge Strategy
**What:** Merge GSD MCP server config into existing .mcp.json without overwriting user servers
**When to use:** Project has MCP servers to register, user may have existing MCP config
**Example:**
```javascript
// scripts/install-mcp.js
const fs = require('fs');
const path = require('path');

function mergeMcpConfig(configPath, gsdServers) {
  let existing = { mcpServers: {} };

  if (fs.existsSync(configPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (e) {
      console.warn('Could not parse existing .mcp.json, backing up...');
      fs.copyFileSync(configPath, `${configPath}.backup`);
    }
  }

  // Merge GSD servers (user servers take precedence)
  const merged = {
    mcpServers: {
      ...gsdServers,
      ...existing.mcpServers // User config overwrites defaults
    }
  };

  fs.writeFileSync(configPath, JSON.stringify(merged, null, 2));
  console.log('✓ MCP configuration updated');
}

// Usage
const gsdMcpServers = {
  telegram: {
    command: 'node',
    args: ['mcp-servers/telegram-mcp/dist/index.js'],
    env: {
      TELEGRAM_BOT_TOKEN: '${TELEGRAM_BOT_TOKEN}',
      TELEGRAM_OWNER_ID: '${TELEGRAM_OWNER_ID}'
    }
  }
};

mergeMcpConfig('.claude/.mcp.json', gsdMcpServers);
```
Source: [MCP Server Configuration Guide](https://modelcontextprotocol.io/docs/develop/build-server)

### Pattern 4: .env.template Generation
**What:** Auto-generate .env.template from code analysis of required environment variables
**When to use:** Application requires environment variables, need to document them for users
**Example:**
```javascript
// scripts/generate-env-template.js
const fs = require('fs');
const path = require('path');

// Scan codebase for process.env references
const envVars = new Map([
  ['TELEGRAM_BOT_TOKEN', 'Telegram bot token from @BotFather'],
  ['TELEGRAM_OWNER_ID', 'Your Telegram user ID (get from /start command)'],
  ['ANTHROPIC_API_KEY', 'Optional: Claude API key (if not using subscription tokens)'],
  ['NODE_ENV', 'Environment (development|production)'],
  ['LOG_LEVEL', 'Logging level (debug|info|warn|error)']
]);

function generateEnvTemplate() {
  const lines = [
    '# GSD Environment Configuration',
    '# Copy this file to .env and fill in your values',
    '# Never commit .env to version control',
    ''
  ];

  for (const [key, description] of envVars) {
    lines.push(`# ${description}`);
    lines.push(`${key}=`);
    lines.push('');
  }

  fs.writeFileSync('.env.template', lines.join('\n'));
  console.log('✓ Generated .env.template');
}
```
Source: [Environment Variable Best Practices](https://www.getfishtank.com/insights/best-practices-for-committing-env-files-to-version-control)

### Pattern 5: Health Check Validation
**What:** Comprehensive validation after installation to verify all components work
**When to use:** After installation completes, ensure everything is properly configured
**Example:**
```javascript
// scripts/health-check.js
const fs = require('fs');
const path = require('path');
const os = require('os');

async function healthCheck() {
  const checks = [];

  // 1. NPM dependencies
  checks.push({
    name: 'NPM Dependencies',
    test: () => fs.existsSync('node_modules') &&
                fs.existsSync('mcp-servers/telegram-mcp/node_modules')
  });

  // 2. Whisper models
  checks.push({
    name: 'Whisper Models',
    test: () => {
      const modelPath = path.join(os.homedir(), '.cache', 'whisper', 'ggml-base.en.bin');
      return fs.existsSync(modelPath);
    }
  });

  // 3. Claude Code hooks
  checks.push({
    name: 'Claude Code Hooks',
    test: () => {
      const hooksDir = path.join(os.homedir(), '.claude', 'hooks');
      return fs.existsSync(path.join(hooksDir, 'gsd-statusline.js')) &&
             fs.existsSync(path.join(hooksDir, 'gsd-check-update.js'));
    }
  });

  // 4. MCP server config
  checks.push({
    name: 'MCP Configuration',
    test: () => {
      const mcpPath = '.claude/.mcp.json';
      if (!fs.existsSync(mcpPath)) return false;
      try {
        const config = JSON.parse(fs.readFileSync(mcpPath, 'utf8'));
        return config.mcpServers && config.mcpServers.telegram;
      } catch {
        return false;
      }
    }
  });

  // 5. Environment template
  checks.push({
    name: '.env Template',
    test: () => fs.existsSync('.env.template')
  });

  // 6. Module imports
  checks.push({
    name: 'Module Imports',
    test: () => {
      try {
        require('./get-shit-done/bin/gsd-tools.js');
        return true;
      } catch (e) {
        console.error('Import error:', e.message);
        return false;
      }
    }
  });

  // Run checks
  let passed = 0;
  let failed = 0;

  for (const check of checks) {
    const result = check.test();
    if (result) {
      console.log(`✓ ${check.name}`);
      passed++;
    } else {
      console.log(`✗ ${check.name}`);
      failed++;
    }
  }

  console.log(`\n${passed}/${checks.length} checks passed`);

  if (failed > 0) {
    console.error('\nInstallation incomplete. Re-run: npm run install:gsd');
    process.exit(1);
  }

  console.log('\n✓ Installation validated successfully');
}
```
Source: [Node.js Health Check Implementation](https://blog.logrocket.com/how-to-implement-a-health-check-in-node-js/)

### Anti-Patterns to Avoid
- **Silent failures:** Always validate each installation step and exit with clear error messages if any step fails
- **Hardcoded paths:** Use os.homedir() and path.join() for cross-platform compatibility, never assume Unix-style paths
- **Overwriting user config:** Merge MCP config and preserve user's existing servers, don't replace their .mcp.json
- **Missing cleanup:** Provide uninstall script that removes GSD files but preserves user data (.planning/, .env)
- **No verification:** Always verify downloads/installs succeeded before marking step complete

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Monorepo dependency management | Custom install script per module | npm workspaces | Handles dependency hoisting, deduplication, version resolution, symlinks automatically. Edge cases: peer dependency conflicts, circular dependencies, platform-specific binaries. |
| Cross-platform process spawning | Manual platform detection + child_process | cross-spawn or execa | Handles Windows .cmd/.bat extensions, PATH resolution, stdio encoding differences. Windows path separator handling is complex. |
| Terminal UI (spinners, progress) | Custom console.log formatting | ora + chalk | Handles TTY detection, cursor hiding, spinner frames, cross-platform ANSI codes. Terminal capability detection is nuanced. |
| Model file download | Custom HTTPS downloader | whisper-node built-in download | Handles redirects, checksums, resume-on-failure, model version management. Hugging Face CDN quirks already handled. |
| JSON merging with comments | Manual parse/merge | Reuse existing install.js parseJsonc | Handles JSONC (JSON with comments), trailing commas, BOM. Edge case: nested comment blocks. |

**Key insight:** Installation scripts fail silently in production. Use battle-tested libraries that handle edge cases (network timeouts, permission errors, partial downloads, platform differences). The existing `bin/install.js` already demonstrates robust patterns — extend rather than rewrite.

---

## Common Pitfalls

### Pitfall 1: npm Workspace Phantom Dependencies
**What goes wrong:** Nested packages can accidentally import dependencies only available in hoisted node_modules, breaking when installed standalone
**Why it happens:** npm workspaces hoist shared dependencies to root node_modules, hiding missing declarations in package.json
**How to avoid:** Declare ALL dependencies explicitly in each module's package.json, even if hoisted. Test each module's standalone `npm install` before integration
**Warning signs:** Module works in workspace but fails when used as external dependency, "Cannot find module" errors in CI/CD

### Pitfall 2: Whisper Model Download Timeouts
**What goes wrong:** Model downloads timeout on slow connections (base.en is 244MB), installation fails without recovery
**Why it happens:** Default HTTP timeout too short for large files, no retry logic, no partial download resume
**How to avoid:** Increase timeout for model downloads (5 min minimum), implement retry with exponential backoff, check if model already exists before downloading, provide manual download instructions as fallback
**Warning signs:** Installation fails on slower networks but succeeds on fast ones, users report "connection reset" errors

### Pitfall 3: Cross-Platform Hook Installation Paths
**What goes wrong:** Hook commands use wrong path separator (Windows backslash vs Unix forward slash), hooks fail to execute
**Why it happens:** Node.js file operations create platform-specific paths, but hook commands need forward slashes for Node.js compatibility
**How to avoid:** Use `.replace(/\\/g, '/')` on all paths before writing to settings.json hook commands (already done in bin/install.js line 173). Always use forward slashes in Node.js command strings
**Warning signs:** Hooks work on macOS/Linux but fail on Windows with "cannot find file" errors

### Pitfall 4: MCP Config Race Conditions
**What goes wrong:** Claude Code reads .mcp.json while installer is writing it, corrupts config or loses user's servers
**Why it happens:** No atomic write, no locking, Claude Code may auto-reload config during write
**How to avoid:** Write to temporary file first, then atomic rename. Always merge with existing config (user servers preserved). Backup existing config before modification
**Warning signs:** Intermittent .mcp.json parse errors, user reports MCP servers disappearing after install

### Pitfall 5: Silent postinstall Failures
**What goes wrong:** If installation uses postinstall script, failures are hidden or ignored by npm, user thinks install succeeded
**Why it happens:** npm continues even if postinstall exits non-zero (depending on npm version/config), errors buried in logs
**How to avoid:** Use explicit manual install command (`npm run install:gsd`), not postinstall hook. Exit with non-zero code on any failure. Show clear success/failure message at end
**Warning signs:** Users report "installed but doesn't work", health checks fail after "successful" install

### Pitfall 6: Module Consolidation Breaking Imports
**What goes wrong:** Moving external modules into repo breaks existing import paths, causes runtime errors
**Why it happens:** Import paths change from `@external/validator` to `./get-shit-done/modules/validator`, need refactor
**How to avoid:** Create package.json in each consolidated module with correct "name" field, use npm workspaces to symlink, update all imports in one atomic commit, add import validation to health check
**Warning signs:** Module not found errors after consolidation, reference errors in previously working code

---

## Code Examples

Verified patterns from existing codebase and official sources:

### Installation Orchestrator Pattern
```javascript
// scripts/install-orchestrator.js
// Source: Extends bin/install.js patterns
const { execSync } = require('child_process');
const path = require('path');

async function installGSD() {
  console.log('\n📦 GSD Installation\n');

  try {
    // Step 1: NPM Workspaces
    console.log('1/6 Installing npm dependencies...');
    execSync('npm install --workspaces', { stdio: 'inherit' });

    // Step 2: Whisper Models
    console.log('\n2/6 Downloading Whisper models...');
    require('./install-whisper.js')();

    // Step 3: Claude Code Hooks
    console.log('\n3/6 Installing Claude Code hooks...');
    require('./install-hooks.js')();

    // Step 4: MCP Server Config
    console.log('\n4/6 Configuring MCP servers...');
    require('./install-mcp.js')();

    // Step 5: .env Template
    console.log('\n5/6 Generating .env.template...');
    require('./generate-env-template.js')();

    // Step 6: Health Check
    console.log('\n6/6 Running health check...');
    await require('./health-check.js')();

    console.log('\n✓ Installation complete!\n');
    console.log('Next steps:');
    console.log('1. Copy .env.template to .env');
    console.log('2. Fill in TELEGRAM_BOT_TOKEN and TELEGRAM_OWNER_ID');
    console.log('3. Run /gsd:help in Claude Code\n');

  } catch (error) {
    console.error('\n✗ Installation failed:', error.message);
    console.error('\nRun with DEBUG=1 for detailed logs');
    process.exit(1);
  }
}

installGSD();
```

### Hook Installation (Reuse Existing Pattern)
```javascript
// scripts/install-hooks.js
// Source: Adapted from bin/install.js lines 1408-1426
const fs = require('fs');
const path = require('path');
const os = require('os');

function installHooks() {
  const hooksSrc = path.join(__dirname, '..', 'hooks');
  const hooksDest = path.join(os.homedir(), '.claude', 'hooks');

  // Create hooks directory
  fs.mkdirSync(hooksDest, { recursive: true });

  // Copy hook files
  const hooks = ['gsd-statusline.js', 'gsd-check-update.js'];
  for (const hook of hooks) {
    const srcFile = path.join(hooksSrc, hook);
    const destFile = path.join(hooksDest, hook);

    if (!fs.existsSync(srcFile)) {
      throw new Error(`Hook not found: ${hook}`);
    }

    fs.copyFileSync(srcFile, destFile);
    console.log(`  ✓ Installed ${hook}`);
  }

  // Update settings.json (merge, don't overwrite)
  const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
  let settings = {};

  if (fs.existsSync(settingsPath)) {
    settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  }

  // Configure SessionStart hook
  if (!settings.hooks) settings.hooks = {};
  if (!settings.hooks.SessionStart) settings.hooks.SessionStart = [];

  const updateCheckCommand = `node "${hooksDest}/gsd-check-update.js"`.replace(/\\/g, '/');

  const hasUpdateHook = settings.hooks.SessionStart.some(entry =>
    entry.hooks && entry.hooks.some(h => h.command && h.command.includes('gsd-check-update'))
  );

  if (!hasUpdateHook) {
    settings.hooks.SessionStart.push({
      hooks: [{ type: 'command', command: updateCheckCommand }]
    });
    console.log('  ✓ Configured update check hook');
  }

  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
}

module.exports = installHooks;
```

### Uninstall Script
```bash
#!/bin/bash
# scripts/uninstall.sh
# Source: Adapted from bin/install.js uninstall() function

echo "🗑️  GSD Uninstall"
echo ""

# Remove hooks
HOOKS_DIR="$HOME/.claude/hooks"
if [ -d "$HOOKS_DIR" ]; then
  rm -f "$HOOKS_DIR/gsd-statusline.js"
  rm -f "$HOOKS_DIR/gsd-check-update.js"
  echo "✓ Removed hooks"
fi

# Clean MCP config (preserve other servers)
MCP_CONFIG=".claude/.mcp.json"
if [ -f "$MCP_CONFIG" ]; then
  # Backup first
  cp "$MCP_CONFIG" "$MCP_CONFIG.backup"

  # Remove telegram server (requires jq or Node.js)
  node -e "
    const fs = require('fs');
    const config = JSON.parse(fs.readFileSync('$MCP_CONFIG', 'utf8'));
    if (config.mcpServers && config.mcpServers.telegram) {
      delete config.mcpServers.telegram;
      fs.writeFileSync('$MCP_CONFIG', JSON.stringify(config, null, 2));
      console.log('✓ Removed MCP config');
    }
  "
fi

# Preserve user data
echo ""
echo "Preserved:"
echo "  - .planning/ (your project data)"
echo "  - .env (your secrets)"
echo "  - Whisper models (reusable)"
echo ""
echo "✓ Uninstall complete"
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual npm install per module | npm workspaces | npm 7+ (2020) | Single `npm install` handles all modules, hoists dependencies, 50% faster installs |
| Custom download scripts | whisper-node built-in download | whisper-node 1.x (2023) | `npx whisper-node download` handles models, checksums, retries automatically |
| Separate hook installers | Unified bin/install.js | GSD v1.9.0 (2024) | One installer handles all runtimes (Claude/OpenCode/Gemini), path replacement, settings merge |
| postinstall auto-execution | Explicit install command | Security best practice (2024+) | Prevents supply chain attacks, explicit user consent for setup |
| Bash-only scripts | Node.js cross-platform | Modern practice (2020+) | Works on Windows without WSL/Git Bash, reuses Node.js ecosystem |

**Deprecated/outdated:**
- **postinstall for setup:** Security concerns (npm/pnpm now disable by default). Use explicit `npm run install:gsd` instead
- **Lerna for monorepos:** Maintenance mode since 2022. Use npm workspaces (built-in, maintained)
- **Manual .env.example:** Auto-generate from code to stay in sync with required variables
- **Whisper model manual download:** Use `whisper-node download` command, handles versioning and CDN changes

---

## Open Questions

1. **Module consolidation timeline**
   - What we know: External modules (validator, circuit-breaker, escalation, feedback, learning) currently outside repo
   - What's unclear: Current state of these modules (do they exist? where? dependencies?)
   - Recommendation: Audit external module status first. If they don't exist yet, create stubs with package.json ready for future implementation. Focus installation on existing components (hooks, MCP, Whisper).

2. **Whisper multilingual model**
   - What we know: Phase 8/08.1 uses base.en (English only), requirements mention base.ru for Russian
   - What's unclear: Does base.en support Russian? Should we download base (multilingual) instead of base.en + base.ru separately?
   - Recommendation: Research base vs base.en+base.ru. Multilingual base model may cover both languages in single download (smaller, simpler). Verify with whisper-node documentation.

3. **MCP server project vs global config**
   - What we know: Current .mcp.json is at project root `.claude/.mcp.json`
   - What's unclear: Should MCP config be project-specific or global (`~/.claude/.mcp.json`)? Affects portability vs convenience
   - Recommendation: Prioritize project-specific (already implemented). Optionally offer global install for users who want Telegram MCP in all projects. Document tradeoffs.

4. **npm package publishing**
   - What we know: GSD is published as `get-shit-done-cc` on npm, has bin/install.js entry point
   - What's unclear: Should Phase 10 installer be part of published package or dev-only?
   - Recommendation: Keep comprehensive installer as dev-only (`npm run install:gsd` in repo). Published package uses existing `bin/install.js` for commands/hooks. Separation of concerns: repo install vs package distribution.

---

## Sources

### Primary (HIGH confidence)
- Existing codebase `bin/install.js` (lines 1-1740) - Proven cross-platform installer with settings merge, path replacement, verification
- Existing codebase `get-shit-done/bin/whisper-transcribe.js` - Whisper integration pattern, model paths, download verification
- Existing codebase `.claude/.mcp.json` - MCP server configuration structure for Telegram integration
- [npm Workspaces Documentation](https://docs.npmjs.com/cli/v8/using-npm/workspaces) - Official npm workspace specification
- [whisper-node npm package](https://www.npmjs.com/package/whisper-node) - Official package documentation, download command usage

### Secondary (MEDIUM confidence)
- [npm Scripts Documentation](https://docs.npmjs.com/misc/scripts) - Lifecycle hooks, postinstall behavior
- [Model Context Protocol Build Server](https://modelcontextprotocol.io/docs/develop/build-server) - MCP server configuration patterns
- [Environment Variable Best Practices](https://www.getfishtank.com/insights/best-practices-for-committing-env-files-to-version-control) - .env.template patterns, gitignore conventions
- [npm Workspaces Monorepo Guide](https://leticia-mirelly.medium.com/a-comprehensive-guide-to-npm-workspaces-and-monorepos-ce0cdfe1c625) - Workspace setup patterns, dependency hoisting
- [Cross-platform Node.js](https://exploringjs.com/nodejs-shell-scripting/ch_creating-shell-scripts.html) - Path handling, process spawning best practices
- [Node.js Health Check Implementation](https://blog.logrocket.com/how-to-implement-a-health-check-in-node-js/) - Validation patterns for installation verification

### Tertiary (LOW confidence - requires verification)
- Web search results on postinstall security (2026) - Claims about pnpm v10 disabling postinstall, needs verification with official pnpm docs
- Web search results on Bun Shell - Mentioned as alternative, but GSD uses Node.js ecosystem exclusively

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - npm workspaces and whisper-node verified in docs, existing installer patterns proven in production
- Architecture: HIGH - Extends existing bin/install.js patterns, npm workspaces well-documented, cross-platform Node.js established practice
- Pitfalls: HIGH - Based on existing codebase learnings (bin/install.js already handles most edge cases), npm workspace phantom dependencies well-known issue
- Module consolidation: MEDIUM - External modules status unknown, need audit before implementation
- Whisper models: MEDIUM - base.en proven, multilingual base vs separate models needs research

**Research date:** 2026-02-17
**Valid until:** 2026-03-17 (30 days - stable domain, npm/Node.js patterns change slowly)

---

## Installation System Design Summary

**Core principle:** Extend existing proven patterns (`bin/install.js`) rather than rebuild from scratch.

**Installation flow:**
1. **Entry point:** `npm run install:gsd` calls orchestrator script
2. **Orchestrator:** Runs sub-installers in sequence, validates each step
3. **Sub-installers:** Modular scripts for dependencies, Whisper, hooks, MCP, env template
4. **Validation:** Health check verifies all components before declaring success
5. **Failure handling:** Exit on first failure with clear error, never silent failures
6. **Uninstall:** Clean removal preserving user data (.planning/, .env, Whisper models)

**Key decisions:**
- npm workspaces for dependency management (built-in, zero config)
- Node.js scripts over shell for cross-platform (proven in bin/install.js)
- Explicit install command over postinstall (security, transparency)
- Merge MCP config over replace (preserve user servers)
- Comprehensive health check over assume success

**Next steps for planning:**
1. Audit external module status (do they exist? create stubs if not)
2. Research base vs base.en+base.ru Whisper models (verify multilingual coverage)
3. Create installation orchestrator extending bin/install.js patterns
4. Implement health check validation covering all components
5. Test on all platforms (macOS, Linux, Windows) before release
