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
const dim = '\x1b[2m';
const reset = '\x1b[0m';

// Codex config.toml constants
const GSD_CODEX_MARKER = '# GSD Agent Configuration \u2014 managed by get-shit-done installer';

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

// Get version from package.json
const pkg = require('../package.json');

// Parse args
const args = process.argv.slice(2);
const hasGlobal = args.includes('--global') || args.includes('-g');
const hasLocal = args.includes('--local') || args.includes('-l');
const hasOpencode = args.includes('--opencode');
const hasClaude = args.includes('--claude');
const hasGemini = args.includes('--gemini');
const hasCodex = args.includes('--codex');
const hasRoo = args.includes('--roo');
const hasBoth = args.includes('--both'); // Legacy flag, keeps working
const hasAll = args.includes('--all');
const hasUninstall = args.includes('--uninstall') || args.includes('-u');

// Runtime selection - can be set by flags or interactive prompt
let selectedRuntimes = [];
if (hasAll) {
  selectedRuntimes = ['claude', 'opencode', 'gemini', 'codex', 'roo'];
} else if (hasBoth) {
  selectedRuntimes = ['claude', 'opencode'];
} else {
  if (hasOpencode) selectedRuntimes.push('opencode');
  if (hasClaude) selectedRuntimes.push('claude');
  if (hasGemini) selectedRuntimes.push('gemini');
  if (hasCodex) selectedRuntimes.push('codex');
  if (hasRoo) selectedRuntimes.push('roo');
}

// Helper to get directory name for a runtime (used for local/project installs)
function getDirName(runtime) {
  if (runtime === 'opencode') return '.opencode';
  if (runtime === 'gemini') return '.gemini';
  if (runtime === 'codex') return '.codex';
  if (runtime === 'roo') return '.roo';
  return '.claude';
}

/**
 * Get the config directory path relative to home directory for a runtime
 * Used for templating hooks that use path.join(homeDir, '<configDir>', ...)
 * @param {string} runtime - 'claude', 'opencode', 'gemini', 'codex', or 'roo'
 * @param {boolean} isGlobal - Whether this is a global install
 */
function getConfigDirFromHome(runtime, isGlobal) {
  if (!isGlobal) {
    // Local installs use the same dir name pattern
    return `'${getDirName(runtime)}'`;
  }
  // Global installs - OpenCode uses XDG path structure
  if (runtime === 'opencode') {
    // OpenCode: ~/.config/opencode -> '.config', 'opencode'
    // Return as comma-separated for path.join() replacement
    return "'.config', 'opencode'";
  }
  if (runtime === 'gemini') return "'.gemini'";
  if (runtime === 'codex') return "'.codex'";
  if (runtime === 'roo') return "'.roo'";
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
 * Get the global config directory for a runtime
 * @param {string} runtime - 'claude', 'opencode', 'gemini', or 'codex'
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

  if (runtime === 'roo') {
    // Roo: --config-dir > ROO_CONFIG_DIR > ~/.roo
    if (explicitDir) {
      return expandTilde(explicitDir);
    }
    if (process.env.ROO_CONFIG_DIR) {
      return expandTilde(process.env.ROO_CONFIG_DIR);
    }
    return path.join(os.homedir(), '.roo');
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
  '  development system for Claude Code, OpenCode, Gemini, Codex, and Roo Code by TÂCHES.\n';

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
  console.log(`  ${yellow}Usage:${reset} npx get-shit-done-cc [options]\n\n  ${yellow}Options:${reset}\n    ${cyan}-g, --global${reset}              Install globally (to config directory)\n    ${cyan}-l, --local${reset}               Install locally (to current directory)\n    ${cyan}--claude${reset}                  Install for Claude Code only\n    ${cyan}--opencode${reset}                Install for OpenCode only\n    ${cyan}--gemini${reset}                  Install for Gemini only\n    ${cyan}--codex${reset}                   Install for Codex only\n    ${cyan}--roo${reset}                     Install for Roo Code only\n    ${cyan}--all${reset}                     Install for all runtimes\n    ${cyan}-u, --uninstall${reset}           Uninstall GSD (remove all GSD files)\n    ${cyan}-c, --config-dir <path>${reset}   Specify custom config directory\n    ${cyan}-h, --help${reset}                Show this help message\n    ${cyan}--force-statusline${reset}        Replace existing statusline config\n\n  ${yellow}Examples:${reset}\n    ${dim}# Interactive install (prompts for runtime and location)${reset}\n    npx get-shit-done-cc\n\n    ${dim}# Install for Claude Code globally${reset}\n    npx get-shit-done-cc --claude --global\n\n    ${dim}# Install for Gemini globally${reset}\n    npx get-shit-done-cc --gemini --global\n\n    ${dim}# Install for Codex globally${reset}\n    npx get-shit-done-cc --codex --global\n\n    ${dim}# Install for Roo Code globally${reset}\n    npx get-shit-done-cc --roo --global\n\n    ${dim}# Install for all runtimes globally${reset}\n    npx get-shit-done-cc --all --global\n\n    ${dim}# Install to custom config directory${reset}\n    npx get-shit-done-cc --roo --global --config-dir ~/.roo-work\n\n    ${dim}# Install to current project only${reset}\n    npx get-shit-done-cc --claude --local\n\n    ${dim}# Uninstall GSD from Roo globally${reset}\n    npx get-shit-done-cc --roo --global --uninstall\n\n  ${yellow}Notes:${reset}\n    The --config-dir option is useful when you have multiple configurations.\n    It takes priority over CLAUDE_CONFIG_DIR / GEMINI_CONFIG_DIR / CODEX_HOME / ROO_CONFIG_DIR environment variables.\n`);
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
 * Build a hook command path using forward slashes for cross-platform compatibility.
 * On Windows, $HOME is not expanded by cmd.exe/PowerShell, so we use the actual path.
 */
function buildHookCommand(configDir, hookName) {
  // Use forward slashes for Node.js compatibility on all platforms
  const hooksPath = configDir.replace(/\\/g, '/') + '/hooks/' + hookName;
  return `node "${hooksPath}"`;
}

/**
 * Read and parse settings.json, returning empty object if it doesn't exist
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

// Cache for attribution settings (populated once per runtime during install)
const attributionCache = new Map();

/**
 * Get commit attribution setting for a runtime
 * @param {string} runtime - 'claude', 'opencode', 'gemini', or 'codex'
 * @returns {null|undefined|string} null = remove, undefined = keep default, string = custom
 */
function getCommitAttribution(runtime) {
  // Return cached value if available
  if (attributionCache.has(runtime)) {
    return attributionCache.get(runtime);
  }

  let result;

  if (runtime === 'opencode') {
    const config = readSettings(path.join(getGlobalDir('opencode', null), 'opencode.json'));
    result = config.disable_ai_attribution === true ? null : undefined;
  } else if (runtime === 'gemini') {
    // Gemini: check gemini settings.json for attribution config
    const settings = readSettings(path.join(getGlobalDir('gemini', explicitConfigDir), 'settings.json'));
    if (!settings.attribution || settings.attribution.commit === undefined) {
      result = undefined;
    } else if (settings.attribution.commit === '') {
      result = null;
    } else {
      result = settings.attribution.commit;
    }
  } else if (runtime === 'claude') {
    // Claude Code
    const settings = readSettings(path.join(getGlobalDir('claude', explicitConfigDir), 'settings.json'));
    if (!settings.attribution || settings.attribution.commit === undefined) {
      result = undefined;
    } else if (settings.attribution.commit === '') {
      result = null;
    } else {
      result = settings.attribution.commit;
    }
  } else {
    // Codex currently has no attribution setting equivalent
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

function toSingleLine(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function yamlQuote(value) {
  return JSON.stringify(value);
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

function convertSlashCommandsToCodexSkillMentions(content) {
  let converted = content.replace(/\/gsd:([a-z0-9-]+)/gi, (_, commandName) => {
    return `$gsd-${String(commandName).toLowerCase()}`;
  });
  converted = converted.replace(/\/gsd-help\b/g, '$gsd-help');
  return converted;
}

function convertClaudeToCodexMarkdown(content) {
  let converted = convertSlashCommandsToCodexSkillMentions(content);
  converted = converted.replace(/\$ARGUMENTS\b/g, '{{GSD_ARGS}}');
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
- When \`request_user_input\` is rejected (Execute mode), present a plain-text numbered list and pick a reasonable default.

## C. Task() → spawn_agent Mapping
GSD workflows use \`Task(...)\` (Claude Code syntax). Translate to Codex collaboration tools:

Direct mapping:
- \`Task(subagent_type="X", prompt="Y")\` → \`spawn_agent(agent_type="X", message="Y")\`
- \`Task(model="...")\` → omit (Codex uses per-role config, not inline model selection)
- \`fork_context: false\` by default — GSD agents load their own context via \`<files_to_read>\` blocks

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
 * Sets sandbox_mode and developer_instructions from the agent markdown body.
 */
function generateCodexAgentToml(agentName, agentContent) {
  const sandboxMode = CODEX_AGENT_SANDBOX[agentName] || 'read-only';
  const { body } = extractFrontmatterAndBody(agentContent);
  const instructions = body.trim();

  const lines = [
    `sandbox_mode = "${sandboxMode}"`,
    `developer_instructions = """`,
    instructions,
    `"""`,
  ];
  return lines.join('\n') + '\n';
}

/**
 * Generate the GSD config block for Codex config.toml.
 * @param {Array<{name: string, description: string}>} agents
 */
function generateCodexConfigBlock(agents) {
  const lines = [
    GSD_CODEX_MARKER,
    '[features]',
    'multi_agent = true',
    'default_mode_request_user_input = true',
    '',
    '[agents]',
    'max_threads = 4',
    'max_depth = 2',
    '',
  ];

  for (const { name, description } of agents) {
    lines.push(`[agents.${name}]`);
    lines.push(`description = ${JSON.stringify(description)}`);
    lines.push(`config_file = "agents/${name}.toml"`);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Strip GSD sections from Codex config.toml content.
 * Returns cleaned content, or null if file would be empty.
 */
function stripGsdFromCodexConfig(content) {
  const markerIndex = content.indexOf(GSD_CODEX_MARKER);

  if (markerIndex !== -1) {
    // Has GSD marker — remove everything from marker to EOF
    let before = content.substring(0, markerIndex).trimEnd();
    // Also strip GSD-injected feature keys above the marker (Case 3 inject)
    before = before.replace(/^multi_agent\s*=\s*true\s*\n?/m, '');
    before = before.replace(/^default_mode_request_user_input\s*=\s*true\s*\n?/m, '');
    before = before.replace(/^\[features\]\s*\n(?=\[|$)/m, '');
    before = before.replace(/\n{3,}/g, '\n\n').trim();
    if (!before) return null;
    return before + '\n';
  }

  // No marker but may have GSD-injected feature keys
  let cleaned = content;
  cleaned = cleaned.replace(/^multi_agent\s*=\s*true\s*\n?/m, '');
  cleaned = cleaned.replace(/^default_mode_request_user_input\s*=\s*true\s*\n?/m, '');

  // Remove [agents.gsd-*] sections (from header to next section or EOF)
  cleaned = cleaned.replace(/^\[agents\.gsd-[^\]]+\]\n(?:(?!\[)[^\n]*\n?)*/gm, '');

  // Remove [features] section if now empty (only header, no keys before next section)
  cleaned = cleaned.replace(/^\[features\]\s*\n(?=\[|$)/m, '');

  // Remove [agents] section if now empty
  cleaned = cleaned.replace(/^\[agents\]\s*\n(?=\[|$)/m, '');

  // Clean up excessive blank lines
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();

  if (!cleaned) return null;
  return cleaned + '\n';
}

/**
 * Merge GSD config block into an existing or new config.toml.
 * Three cases: new file, existing with GSD marker, existing without marker.
 */
function mergeCodexConfig(configPath, gsdBlock) {
  // Case 1: No config.toml — create fresh
  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, gsdBlock + '\n');
    return;
  }

  const existing = fs.readFileSync(configPath, 'utf8');
  const markerIndex = existing.indexOf(GSD_CODEX_MARKER);

  // Case 2: Has GSD marker — truncate and re-append
  if (markerIndex !== -1) {
    const before = existing.substring(0, markerIndex).trimEnd();
    const newContent = before ? before + '\n\n' + gsdBlock + '\n' : gsdBlock + '\n';
    fs.writeFileSync(configPath, newContent);
    return;
  }

  // Case 3: No marker — inject features if needed, append agents
  let content = existing;
  const featuresRegex = /^\[features\]\s*$/m;
  const hasFeatures = featuresRegex.test(content);

  if (hasFeatures) {
    if (!content.includes('multi_agent')) {
      content = content.replace(featuresRegex, '[features]\nmulti_agent = true');
    }
    if (!content.includes('default_mode_request_user_input')) {
      content = content.replace(/^\[features\].*$/m, '$&\ndefault_mode_request_user_input = true');
    }
    // Append agents block (skip the [features] section from gsdBlock)
    const agentsBlock = gsdBlock.substring(gsdBlock.indexOf('[agents]'));
    content = content.trimEnd() + '\n\n' + GSD_CODEX_MARKER + '\n' + agentsBlock + '\n';
  } else {
    content = content.trimEnd() + '\n\n' + gsdBlock + '\n';
  }

  fs.writeFileSync(configPath, content);
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

  for (const file of agentEntries) {
    const content = fs.readFileSync(path.join(agentsSrc, file), 'utf8');
    const { frontmatter } = extractFrontmatterAndBody(content);
    const name = extractFrontmatterField(frontmatter, 'name') || file.replace('.md', '');
    const description = extractFrontmatterField(frontmatter, 'description') || '';

    agents.push({ name, description: toSingleLine(description) });

    const tomlContent = generateCodexAgentToml(name, content);
    fs.writeFileSync(path.join(agentsTomlDir, `${name}.toml`), tomlContent);
  }

  const gsdBlock = generateCodexConfigBlock(agents);
  mergeCodexConfig(configPath, gsdBlock);

  return agents.length;
}

/**
 * Install Roo custom modes from GSD agents
 * @param {string} targetDir - Target configuration directory
 * @param {string} agentsSrc - Source directory for GSD agents
 * @param {boolean} isGlobal - Whether this is a global install
 */
function installRooModes(targetDir, agentsSrc, isGlobal) {
  if (!fs.existsSync(agentsSrc)) return;

  const agentFiles = fs.readdirSync(agentsSrc).filter(f => f.startsWith('gsd-') && f.endsWith('.md'));
  if (agentFiles.length === 0) return;

  console.log(`  ${green}✓${reset} Preparing ${agentFiles.length} Roo custom modes`);

  const agentModeMap = {
    'gsd-executor.md':             { slug: 'gsd-executor',            name: 'GSD Executor',            groups: ['read','edit','command','mcp'], whenToUse: 'Executes GSD PLAN.md files atomically with per-task commits. Spawned by /gsd-execute-phase.' },
    'gsd-planner.md':              { slug: 'gsd-planner',             name: 'GSD Planner',             groups: ['read','edit','command','mcp'], whenToUse: 'Creates PLAN.md files for GSD phases. Spawned by /gsd-plan-phase.' },
    'gsd-phase-researcher.md':     { slug: 'gsd-phase-researcher',    name: 'GSD Phase Researcher',    groups: ['read','edit','command','mcp'], whenToUse: 'Researches domain knowledge before phase planning. Spawned by /gsd-plan-phase.' },
    'gsd-project-researcher.md':   { slug: 'gsd-project-researcher',  name: 'GSD Project Researcher',  groups: ['read','edit','command','mcp'], whenToUse: 'Researches project domain during new project initialization. Spawned by /gsd-new-project.' },
    'gsd-research-synthesizer.md': { slug: 'gsd-research-synthesizer',name: 'GSD Research Synthesizer',groups: ['read','edit'],               whenToUse: 'Synthesizes parallel research findings into a single RESEARCH.md. Spawned by /gsd-plan-phase.' },
    'gsd-codebase-mapper.md':      { slug: 'gsd-codebase-mapper',     name: 'GSD Codebase Mapper',     groups: ['read','edit','command'],      whenToUse: 'Maps an existing codebase into structured .planning/codebase/ documents. Spawned by /gsd-map-codebase.' },
    'gsd-roadmapper.md':           { slug: 'gsd-roadmapper',          name: 'GSD Roadmapper',          groups: ['read','edit'],               whenToUse: 'Generates ROADMAP.md from project requirements. Spawned by /gsd-new-project.' },
    'gsd-debugger.md':             { slug: 'gsd-debugger',            name: 'GSD Debugger',            groups: ['read','edit','command'],      whenToUse: 'Performs systematic debugging using scientific method. Spawned by /gsd-debug.' },
    'gsd-verifier.md':             { slug: 'gsd-verifier',            name: 'GSD Verifier',            groups: ['read','command'],            whenToUse: 'Verifies that a phase achieved its goal after execution. Spawned by /gsd-execute-phase and /gsd-verify-work.' },
    'gsd-plan-checker.md':         { slug: 'gsd-plan-checker',        name: 'GSD Plan Checker',        groups: ['read'],                      whenToUse: 'Verifies PLAN.md quality and completeness before execution. Spawned by /gsd-plan-phase.' },
    'gsd-integration-checker.md':  { slug: 'gsd-integration-checker', name: 'GSD Integration Checker', groups: ['read','command'],            whenToUse: 'Validates integration completeness across milestone phases. Spawned by /gsd-audit-milestone.' },
  };

  const modesEntries = [];

  for (const file of agentFiles) {
    const meta = agentModeMap[file] || {
      slug: file.replace('.md', ''),
      name: file.replace('.md', '').split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      groups: ['read', 'edit', 'command', 'mcp'],
      whenToUse: 'GSD autonomous agent'
    };

    let roleDefinition = fs.readFileSync(path.join(agentsSrc, file), 'utf8');
    const { body } = extractFrontmatterAndBody(roleDefinition);
    roleDefinition = body.trim();
    
    // Apply path conversion
    roleDefinition = replacePathsForRoo(roleDefinition, isGlobal ? `${targetDir.replace(/\\/g, '/')}/` : `./.roo/`);

    // Apply /gsd:xxx → /gsd-xxx conversion for prose references
    roleDefinition = roleDefinition.replace(/\/gsd:([a-z][a-z0-9-]*)/g, '/gsd-$1');

    // Apply CLAUDE.md → .roo/rules reference update
    roleDefinition = updateProjectInstructionsForRoo(roleDefinition);

    // Update tool names in prose instructions
    roleDefinition = roleDefinition.replace(/`Read` tool/g, '`read_file` tool');
    roleDefinition = roleDefinition.replace(/`Write` tool/g, '`write_to_file` tool');
    roleDefinition = roleDefinition.replace(/`Edit` tool/g, '`apply_diff` tool');
    roleDefinition = roleDefinition.replace(/`Bash` tool/g, '`execute_command` tool');

    modesEntries.push({
      slug:           meta.slug,
      name:           meta.name,
      roleDefinition: roleDefinition,
      whenToUse:      meta.whenToUse,
      groups:         meta.groups,
      source:         isGlobal ? 'global' : 'project'
    });
  }

  // Determine custom_modes.yaml path
  // Global: Roo Code stores modes in VS Code's extension globalStorage, not in ~/.roo
  // Local:  Roo Code reads project-level modes from .roomodes at the workspace root
  let configPath;
  if (isGlobal) {
    if (process.platform === 'win32') {
      configPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Code', 'User', 'globalStorage', 'rooveterinaryinc.roo-cline', 'settings', 'custom_modes.yaml');
    } else if (process.platform === 'darwin') {
      configPath = path.join(os.homedir(), 'Library', 'Application Support', 'Code', 'User', 'globalStorage', 'rooveterinaryinc.roo-cline', 'settings', 'custom_modes.yaml');
    } else {
      // Linux / other Unix
      configPath = path.join(os.homedir(), '.config', 'Code', 'User', 'globalStorage', 'rooveterinaryinc.roo-cline', 'settings', 'custom_modes.yaml');
    }
  } else {
    // Project-level modes: .roomodes at workspace root (YAML format supported)
    configPath = path.join(process.cwd(), '.roomodes');
  }

  // Serialise a scalar to YAML — quote only when needed
  function yamlScalar(s) {
    if (s === null || s === undefined || s === '') return '""';
    const str = String(s);
    if (
      /[:#\[\]{},|>&*!'"\\%@`]/.test(str) ||
      /^\s|\s$/.test(str) ||
      /^(true|false|null|yes|no|on|off)$/i.test(str)
    ) {
      return '"' + str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n') + '"';
    }
    return str;
  }

  // Serialise a single mode entry to YAML lines (indented 2 spaces under "customModes:")
  // Correct format:
  //   customModes:
  //     - slug: my-mode
  //       name: My Mode
  //       roleDefinition: |
  //         ...
  function modeToYamlLines(mode) {
    const lines = [];
    lines.push(`  - slug: ${yamlScalar(mode.slug)}`);
    lines.push(`    name: ${yamlScalar(mode.name)}`);
    // roleDefinition is multi-line — use a YAML literal block scalar
    lines.push('    roleDefinition: |');
    for (const line of mode.roleDefinition.split('\n')) {
      lines.push(line.length > 0 ? '      ' + line : '');
    }
    if (mode.whenToUse) {
      lines.push(`    whenToUse: ${yamlScalar(mode.whenToUse)}`);
    }
    lines.push('    groups:');
    for (const g of mode.groups) {
      lines.push(`    - ${yamlScalar(g)}`);
    }
    if (mode.source) {
      lines.push(`    source: ${yamlScalar(mode.source)}`);
    }
    return lines;
  }

  // Merge GSD modes into an existing custom_modes.yaml, preserving non-GSD entries.
  // Strategy: split on "  - slug:" boundaries (2-space indent under customModes:),
  // discard old gsd-* blocks, append new ones.
  function mergeRooCustomModes(existingContent, newEntries) {
    // Split into blocks; each starts with "  - slug:" (2-space indent)
    const parts = existingContent.split(/(?=^  - slug:)/m);
    const header = parts[0]; // "customModes:\n" or similar leading content
    const existingBlocks = parts.slice(1);

    // Keep only non-GSD entries
    const kept = existingBlocks.filter(block => {
      const m = block.match(/^  - slug:\s*(\S+)/);
      return !m || !m[1].startsWith('gsd-');
    });

    const gsdYamlLines = [];
    for (const entry of newEntries) {
      gsdYamlLines.push(...modeToYamlLines(entry));
    }

    return header + kept.join('') + gsdYamlLines.join('\n') + '\n';
  }

  // Build the YAML to write / display
  const freshYamlLines = ['customModes:'];
  for (const mode of modesEntries) {
    freshYamlLines.push(...modeToYamlLines(mode));
  }
  const freshYaml = freshYamlLines.join('\n') + '\n';

  fs.mkdirSync(path.dirname(configPath), { recursive: true });

  if (isGlobal) {
    // For global installs, auto-merge into the existing file when possible
    if (fs.existsSync(configPath)) {
      const existing = fs.readFileSync(configPath, 'utf8');
      const merged = mergeRooCustomModes(existing, modesEntries);
      fs.writeFileSync(configPath, merged);
      console.log(`  ${green}✓${reset} Merged GSD modes into ${cyan}${configPath.replace(os.homedir(), '~')}${reset}`);
    } else {
      fs.writeFileSync(configPath, freshYaml);
      console.log(`  ${green}✓${reset} Wrote Roo modes to ${cyan}${configPath.replace(os.homedir(), '~')}${reset}`);
    }
  } else {
    // Local install — merge or create .roomodes at the project root
    if (fs.existsSync(configPath)) {
      const existing = fs.readFileSync(configPath, 'utf8');
      const merged = mergeRooCustomModes(existing, modesEntries);
      fs.writeFileSync(configPath, merged);
      console.log(`  ${green}✓${reset} Merged GSD modes into ${cyan}.roomodes${reset}`);
    } else {
      fs.writeFileSync(configPath, freshYaml);
      console.log(`  ${green}✓${reset} Wrote local Roo modes to ${cyan}.roomodes${reset}`);
    }
  }
}

/**
 * Strip HTML <sub> tags for Gemini CLI output
 * Terminals don't support subscript — Gemini renders these as raw HTML.
 * Converts <sub>text</sub> to italic *(text)* for readable terminal output.
 */
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
 * - mcp__* tools: must be excluded (auto-discovered at runtime)
 */
function convertClaudeToGeminiAgent(content) {
  if (!content.startsWith('---')) return content;

  const endIndex = content.indexOf('---', 3);
  if (endIndex === -1) return content;

  const frontmatter = content.substring(3, endIndex).trim();
  const body = content.substring(endIndex + 3);

  const lines = frontmatter.split('\n');
  const newLines = [];
  let inAllowedTools = false;
  const tools = [];

  for (const line of lines) {
    const trimmed = line.trim();

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

  return `---\n${newFrontmatter}\n---${stripSubTags(escapedBody)}`;
}

function convertClaudeToOpencodeFrontmatter(content) {
  // Replace tool name references in content (applies to all files)
  let convertedContent = content;
  convertedContent = convertedContent.replace(/\bAskUserQuestion\b/g, 'question');
  convertedContent = convertedContent.replace(/\bSlashCommand\b/g, 'skill');
  convertedContent = convertedContent.replace(/\bTodoWrite\b/g, 'todowrite');
  // Replace /gsd:command with /gsd-command for opencode (flat command structure)
  convertedContent = convertedContent.replace(/\/gsd:/g, '/gsd-');
  // Replace ~/.claude with ~/.config/opencode (OpenCode's correct config location)
  convertedContent = convertedContent.replace(/~\/\.claude\b/g, '~/.config/opencode');
  // Replace general-purpose subagent type with OpenCode's equivalent "general"
  convertedContent = convertedContent.replace(/subagent_type="general-purpose"/g, 'subagent_type="general"');

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
  const allowedTools = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Detect start of allowed-tools array
    if (trimmed.startsWith('allowed-tools:')) {
      inAllowedTools = true;
      continue;
    }

    // Detect inline tools: field (comma-separated string)
    if (trimmed.startsWith('tools:')) {
      const toolsValue = trimmed.substring(6).trim();
      if (toolsValue) {
        // Parse comma-separated tools
        const tools = toolsValue.split(',').map(t => t.trim()).filter(t => t);
        allowedTools.push(...tools);
      }
      continue;
    }

    // Remove name: field - opencode uses filename for command name
    if (trimmed.startsWith('name:')) {
      continue;
    }

    // Convert color names to hex for opencode
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

    // Keep other fields (including name: which opencode ignores)
    if (!inAllowedTools) {
      newLines.push(line);
    }
  }

  // Add tools object if we had allowed-tools or tools
  if (allowedTools.length > 0) {
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
 * Convert a Claude Code command to a Roo Code slash command
 * - Replaces Claude tools with Roo equivalents
 * - Replaces @ references with context remarks
 * - Replaces .claude path references
 * @param {string} content - Original markdown content
 * @param {string} pathPrefix - Global path prefix for references
 */
function convertCommandForRoo(content, pathPrefix) {
  // --- Step 1: Parse and rebuild frontmatter (handles both LF and CRLF source files) ---
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (fmMatch) {
    const fmRaw = fmMatch[1];

    // Extract only the description value
    const descMatch = fmRaw.match(/^description:\s*["']?(.*?)["']?\s*$/m);
    let description = descMatch ? descMatch[1].trim() : 'GSD slash command';

    // Reconstruct frontmatter with only description (always LF in output)
    const newFrontmatter = `---\ndescription: "${description}"\n---\n`;
    content = content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, newFrontmatter);
    // Normalise remaining CRLF to LF so output files are consistent
    content = content.replace(/\r\n/g, '\n');
  }

  // --- Step 2: Convert tool names in body (existing logic) ---
  const toolMap = {
    'Read':              'read_file',
    'Write':             'write_to_file',
    'Edit':              'apply_diff',
    'Bash':              'execute_command',
    'Glob':              'list_files',
    'Grep':              'search_files',
    'Task':              'new_task',
    'AskUserQuestion':   'ask_followup_question',
    'TodoWrite':         'update_todo_list',
  };
  for (const [claude, roo] of Object.entries(toolMap)) {
    const regex = new RegExp(`(?<=- )${claude}\\b`, 'g');
    content = content.replace(regex, roo);
  }

  // --- Step 3: Convert /gsd:xxx → /gsd-xxx in body text ---
  content = content.replace(/\/gsd:([a-z][a-z0-9-]*)/g, '/gsd-$1');

  // --- Step 4: Path replacement ---
  content = replacePathsForRoo(content, pathPrefix);

  // --- Step 5: Project instructions update ---
  content = updateProjectInstructionsForRoo(content);

  return content;
}

/**
 * Helper to replace .claude paths with Roo-specific paths
 */
function replacePathsForRoo(content, pathPrefix) {
  const globalClaudeRegex = /~\/\.claude\//g;
  const dollarHomeClaudeRegex = /\$HOME\/\.claude\//g;
  const localClaudeRegex = /\.\/\.claude\//g;
  
  // Replace global ~/.claude/ with Roo's global path
  content = content.replace(globalClaudeRegex, pathPrefix);
  
  // Replace global $HOME/.claude/ with Roo's global path
  content = content.replace(dollarHomeClaudeRegex, pathPrefix);
  
  // Replace local ./.claude/ with ./.roo/
  content = content.replace(localClaudeRegex, `./.roo/`);
  
  return content;
}

/**
 * Update project instructions to mention Roo Code and its mechanics
 */
function updateProjectInstructionsForRoo(content) {
  // Replace mentions of Claude Code with Roo Code
  content = content.replace(/Claude Code/g, 'Roo Code');
  
  // Replace mentions of .claude.json with .clinerules or similar if applicable
  // For now, GSD uses its own config files, but we should mention Roo's mode system
  if (content.includes('gsd-executor')) {
    const note = '\n\nNote: This task will be executed by the `gsd-executor` mode. Once spawned, the executor will follow the plan until completion. You should use the `new_task` tool to initiate it.';
    if (!content.includes(note)) {
      content += note;
    }
  }
  
  // Add a reminder about sequential tool execution if relevant
  if (content.includes('sequential') || content.includes('step-by-step')) {
    const rNote = '\n\nIMPORTANT: Execute each step sequentially. Wait for the result of each tool use before proceeding to the next step.';
    if (!content.includes(rNote)) {
      content += rNote;
    }
  }
  
  return content;
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
 * @param {string} runtime - Target runtime ('claude' or 'opencode')
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
      const dollarHomeClaudeRegex = /\$HOME\/\.claude\//g;
      const localClaudeRegex = /\.\/\.claude\//g;
      const opencodeDirRegex = /~\/\.opencode\//g;
      content = content.replace(globalClaudeRegex, pathPrefix);
      content = content.replace(dollarHomeClaudeRegex, pathPrefix);
      content = content.replace(localClaudeRegex, `./${getDirName(runtime)}/`);
      content = content.replace(opencodeDirRegex, pathPrefix);
      content = processAttribution(content, getCommitAttribution(runtime));
      
      if (runtime === 'opencode') {
        content = convertClaudeToOpencodeFrontmatter(content);
      } else if (runtime === 'roo') {
        content = convertCommandForRoo(content, pathPrefix);
      }

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
      const dollarHomeClaudeRegex = /\$HOME\/\.claude\//g;
      const localClaudeRegex = /\.\/\.claude\//g;
      const codexDirRegex = /~\/\.codex\//g;
      content = content.replace(globalClaudeRegex, pathPrefix);
      content = content.replace(dollarHomeClaudeRegex, pathPrefix);
      content = content.replace(localClaudeRegex, `./${getDirName(runtime)}/`);
      content = content.replace(codexDirRegex, pathPrefix);
      content = processAttribution(content, getCommitAttribution(runtime));
      content = convertClaudeCommandToCodexSkill(content, skillName);

      fs.writeFileSync(path.join(skillDir, 'SKILL.md'), content);
    }
  }

  recurse(srcDir, prefix);
}

/**
 * Recursively copy directory, replacing paths in .md files
 * Deletes existing destDir first to remove orphaned files from previous versions
 * @param {string} srcDir - Source directory
 * @param {string} destDir - Destination directory
 * @param {string} pathPrefix - Path prefix for file references
 * @param {string} runtime - Target runtime ('claude', 'opencode', 'gemini', 'codex')
 */
function copyWithPathReplacement(srcDir, destDir, pathPrefix, runtime, isCommand = false) {
  const isOpencode = runtime === 'opencode';
  const isCodex = runtime === 'codex';
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
      copyWithPathReplacement(srcPath, destPath, pathPrefix, runtime, isCommand);
    } else if (entry.name.endsWith('.md')) {
      // Replace ~/.claude/ and ./.claude/ with runtime-appropriate paths
      let content = fs.readFileSync(srcPath, 'utf8');
      const globalClaudeRegex = /~\/\.claude\//g;
      const dollarHomeClaudeRegex = /\$HOME\/\.claude\//g;
      const localClaudeRegex = /\.\/\.claude\//g;
      content = content.replace(globalClaudeRegex, pathPrefix);
      content = content.replace(dollarHomeClaudeRegex, pathPrefix);
      content = content.replace(localClaudeRegex, `./${dirName}/`);
      content = processAttribution(content, getCommitAttribution(runtime));

      // Convert frontmatter for opencode compatibility
      if (isOpencode) {
        content = convertClaudeToOpencodeFrontmatter(content);
        fs.writeFileSync(destPath, content);
      } else if (runtime === 'gemini') {
        if (isCommand) {
          // Convert to TOML for Gemini (strip <sub> tags — terminals can't render subscript)
          content = stripSubTags(content);
          const tomlContent = convertClaudeToGeminiToml(content);
          // Replace extension with .toml
          const tomlPath = destPath.replace(/\.md$/, '.toml');
          fs.writeFileSync(tomlPath, tomlContent);
        } else {
          fs.writeFileSync(destPath, content);
        }
      } else if (runtime === 'roo') {
        if (isCommand) {
          content = convertCommandForRoo(content, pathPrefix);
        } else {
          // Apply /gsd:xxx → /gsd-xxx for workflow/template/reference prose
          content = content.replace(/\/gsd:([a-z][a-z0-9-]*)/g, '/gsd-$1');
        }
        fs.writeFileSync(destPath, content);
      } else if (isCodex) {
        content = convertClaudeToCodexMarkdown(content);
        fs.writeFileSync(destPath, content);
      } else {
        fs.writeFileSync(destPath, content);
      }
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
 * Uninstall GSD from the specified directory for a specific runtime
 * Removes only GSD-specific files/directories, preserves user content
 * @param {boolean} isGlobal - Whether to uninstall from global or local
 * @param {string} runtime - Target runtime ('claude', 'opencode', 'gemini', 'codex')
 */
function uninstall(isGlobal, runtime = 'claude') {
  const isOpencode = runtime === 'opencode';
  const isCodex = runtime === 'codex';
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
  if (runtime === 'codex') runtimeLabel = 'Codex';
  if (runtime === 'roo') runtimeLabel = 'Roo Code';

  console.log(`  Uninstalling GSD from ${cyan}${runtimeLabel}${reset} at ${cyan}${locationLabel}${reset}\n`);

  // Check if target directory exists
  if (!fs.existsSync(targetDir)) {
    console.log(`  ${yellow}⚠${reset} Directory does not exist: ${locationLabel}`);
    console.log(`  Nothing to uninstall.\n`);
    return;
  }

  let removedCount = 0;

  // 1. Remove GSD commands/skills
  if (runtime === 'opencode') {
    // OpenCode: remove command/gsd-*.md files
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
  } else if (runtime === 'roo') {
    // Roo: remove commands/gsd-*.md files
    const commandDir = path.join(targetDir, 'commands');
    if (fs.existsSync(commandDir)) {
      const files = fs.readdirSync(commandDir);
      for (const file of files) {
        if (file.startsWith('gsd-') && file.endsWith('.md')) {
          fs.unlinkSync(path.join(commandDir, file));
          removedCount++;
        }
      }
      console.log(`  ${green}✓${reset} Removed GSD commands from commands/`);
    }

    // Roo: strip GSD modes from the appropriate modes config file
    let customModesPath;
    if (isGlobal) {
      if (process.platform === 'win32') {
        customModesPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Code', 'User', 'globalStorage', 'rooveterinaryinc.roo-cline', 'settings', 'custom_modes.yaml');
      } else if (process.platform === 'darwin') {
        customModesPath = path.join(os.homedir(), 'Library', 'Application Support', 'Code', 'User', 'globalStorage', 'rooveterinaryinc.roo-cline', 'settings', 'custom_modes.yaml');
      } else {
        // Linux / other Unix
        customModesPath = path.join(os.homedir(), '.config', 'Code', 'User', 'globalStorage', 'rooveterinaryinc.roo-cline', 'settings', 'custom_modes.yaml');
      }
    } else {
      // Project-level modes live in .roomodes at the workspace root
      customModesPath = path.join(process.cwd(), '.roomodes');
    }
    if (fs.existsSync(customModesPath)) {
      const existing = fs.readFileSync(customModesPath, 'utf8');
      // Split on "- slug:" boundaries, discard gsd-* blocks
      const parts = existing.split(/(?=^- slug:)/m);
      const header = parts[0];
      const kept = parts.slice(1).filter(block => {
        const m = block.match(/^- slug:\s*(\S+)/);
        return !m || !m[1].startsWith('gsd-');
      });
      const cleaned = header + kept.join('');
      const modesFileName = isGlobal ? 'custom_modes.yaml' : '.roomodes';
      if (kept.length < parts.length - 1) {
        // If only the header remains and it's just "customModes:\n" with nothing else, remove the file
        if (cleaned.trim() === 'customModes:' || cleaned.trim() === '') {
          fs.unlinkSync(customModesPath);
          console.log(`  ${green}✓${reset} Removed ${modesFileName} (was GSD-only)`);
        } else {
          fs.writeFileSync(customModesPath, cleaned);
          console.log(`  ${green}✓${reset} Stripped GSD modes from ${modesFileName}`);
        }
        removedCount++;
      }
    }
  } else if (isCodex) {
    // Codex: remove skills/gsd-*/SKILL.md skill directories
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
        console.log(`  ${green}✓${reset} Removed ${skillCount} Codex skills`);
      }
    }

    // Codex: remove GSD agent .toml config files
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
  } else {
    // Claude Code & Gemini: remove commands/gsd/ directory
    const gsdCommandsDir = path.join(targetDir, 'commands', 'gsd');
    if (fs.existsSync(gsdCommandsDir)) {
      fs.rmSync(gsdCommandsDir, { recursive: true });
      removedCount++;
      console.log(`  ${green}✓${reset} Removed commands/gsd/`);
    }
  }

  // 2. Remove get-shit-done directory
  const gsdDir = path.join(targetDir, 'get-shit-done');
  if (fs.existsSync(gsdDir)) {
    fs.rmSync(gsdDir, { recursive: true });
    removedCount++;
    console.log(`  ${green}✓${reset} Removed get-shit-done/`);
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
    const gsdHooks = ['gsd-statusline.js', 'gsd-check-update.js', 'gsd-check-update.sh', 'gsd-context-monitor.js'];
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
    let settingsModified = false;

    // Remove GSD statusline if it references our hook
    if (settings.statusLine && settings.statusLine.command &&
        settings.statusLine.command.includes('gsd-statusline')) {
      delete settings.statusLine;
      settingsModified = true;
      console.log(`  ${green}✓${reset} Removed GSD statusline from settings`);
    }

    // Remove GSD hooks from SessionStart
    if (settings.hooks && settings.hooks.SessionStart) {
      const before = settings.hooks.SessionStart.length;
      settings.hooks.SessionStart = settings.hooks.SessionStart.filter(entry => {
        if (entry.hooks && Array.isArray(entry.hooks)) {
          // Filter out GSD hooks
          const hasGsdHook = entry.hooks.some(h =>
            h.command && (h.command.includes('gsd-check-update') || h.command.includes('gsd-statusline'))
          );
          return !hasGsdHook;
        }
        return true;
      });
      if (settings.hooks.SessionStart.length < before) {
        settingsModified = true;
        console.log(`  ${green}✓${reset} Removed GSD hooks from settings`);
      }
      // Clean up empty array
      if (settings.hooks.SessionStart.length === 0) {
        delete settings.hooks.SessionStart;
      }
    }

    // Remove GSD hooks from PostToolUse
    if (settings.hooks && settings.hooks.PostToolUse) {
      const before = settings.hooks.PostToolUse.length;
      settings.hooks.PostToolUse = settings.hooks.PostToolUse.filter(entry => {
        if (entry.hooks && Array.isArray(entry.hooks)) {
          const hasGsdHook = entry.hooks.some(h =>
            h.command && h.command.includes('gsd-context-monitor')
          );
          return !hasGsdHook;
        }
        return true;
      });
      if (settings.hooks.PostToolUse.length < before) {
        settingsModified = true;
        console.log(`  ${green}✓${reset} Removed context monitor hook from settings`);
      }
      if (settings.hooks.PostToolUse.length === 0) {
        delete settings.hooks.PostToolUse;
      }
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

  // 6. For OpenCode, clean up permissions from opencode.json
  if (isOpencode) {
    // For local uninstalls, clean up ./.opencode/opencode.json
    // For global uninstalls, clean up ~/.config/opencode/opencode.json
    const opencodeConfigDir = isGlobal
      ? getOpencodeGlobalDir()
      : path.join(process.cwd(), '.opencode');
    const configPath = path.join(opencodeConfigDir, 'opencode.json');
    if (fs.existsSync(configPath)) {
      try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
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
          console.log(`  ${green}✓${reset} Removed GSD permissions from opencode.json`);
        }
      } catch (e) {
        // Ignore JSON parse errors
      }
    }
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
 */
function configureOpencodePermissions(isGlobal = true) {
  // For local installs, use ./.opencode/opencode.json
  // For global installs, use ~/.config/opencode/opencode.json
  const opencodeConfigDir = isGlobal
    ? getOpencodeGlobalDir()
    : path.join(process.cwd(), '.opencode');
  const configPath = path.join(opencodeConfigDir, 'opencode.json');

  // Ensure config directory exists
  fs.mkdirSync(opencodeConfigDir, { recursive: true });

  // Read existing config or create empty object
  let config = {};
  if (fs.existsSync(configPath)) {
    try {
      const content = fs.readFileSync(configPath, 'utf8');
      config = parseJsonc(content);
    } catch (e) {
      // Cannot parse - DO NOT overwrite user's config
      console.log(`  ${yellow}⚠${reset} Could not parse opencode.json - skipping permission config`);
      console.log(`    ${dim}Reason: ${e.message}${reset}`);
      console.log(`    ${dim}Your config was NOT modified. Fix the syntax manually if needed.${reset}`);
      return;
    }
  }

  // Ensure permission structure exists
  if (!config.permission) {
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
function writeManifest(configDir, runtime = 'claude') {
  const isOpencode = runtime === 'opencode';
  const isCodex = runtime === 'codex';
  const gsdDir = path.join(configDir, 'get-shit-done');
  const commandsDir = path.join(configDir, 'commands', 'gsd');
  const opencodeCommandDir = path.join(configDir, 'command');
  const codexSkillsDir = path.join(configDir, 'skills');
  const agentsDir = path.join(configDir, 'agents');
  const manifest = { version: pkg.version, timestamp: new Date().toISOString(), files: {} };

  const gsdHashes = generateManifest(gsdDir);
  for (const [rel, hash] of Object.entries(gsdHashes)) {
    manifest.files['get-shit-done/' + rel] = hash;
  }
  if (!isOpencode && !isCodex && fs.existsSync(commandsDir)) {
    const cmdHashes = generateManifest(commandsDir);
    for (const [rel, hash] of Object.entries(cmdHashes)) {
      manifest.files['commands/gsd/' + rel] = hash;
    }
  }
  if (isOpencode && fs.existsSync(opencodeCommandDir)) {
    for (const file of fs.readdirSync(opencodeCommandDir)) {
      if (file.startsWith('gsd-') && file.endsWith('.md')) {
        manifest.files['command/' + file] = fileHash(path.join(opencodeCommandDir, file));
      }
    }
  }
  if (isCodex && fs.existsSync(codexSkillsDir)) {
    for (const skillName of listCodexSkillNames(codexSkillsDir)) {
      const skillRoot = path.join(codexSkillsDir, skillName);
      const skillHashes = generateManifest(skillRoot);
      for (const [rel, hash] of Object.entries(skillHashes)) {
        manifest.files[`skills/${skillName}/${rel}`] = hash;
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

  fs.writeFileSync(path.join(configDir, MANIFEST_NAME), JSON.stringify(manifest, null, 2));
  return manifest;
}

/**
 * Detect user-modified GSD files by comparing against install manifest.
 * Backs up modified files to gsd-local-patches/ for reapply after update.
 */
function saveLocalPatches(configDir) {
  const manifestPath = path.join(configDir, MANIFEST_NAME);
  if (!fs.existsSync(manifestPath)) return [];

  let manifest;
  try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); } catch { return []; }

  const patchesDir = path.join(configDir, PATCHES_DIR_NAME);
  const modified = [];

  for (const [relPath, originalHash] of Object.entries(manifest.files || {})) {
    const fullPath = path.join(configDir, relPath);
    if (!fs.existsSync(fullPath)) continue;
    const currentHash = fileHash(fullPath);
    if (currentHash !== originalHash) {
      const backupPath = path.join(patchesDir, relPath);
      fs.mkdirSync(path.dirname(backupPath), { recursive: true });
      fs.copyFileSync(fullPath, backupPath);
      modified.push(relPath);
    }
  }

  if (modified.length > 0) {
    const meta = {
      backed_up_at: new Date().toISOString(),
      from_version: manifest.version,
      files: modified
    };
    fs.writeFileSync(path.join(patchesDir, 'backup-meta.json'), JSON.stringify(meta, null, 2));
    console.log('  ' + yellow + 'i' + reset + '  Found ' + modified.length + ' locally modified GSD file(s) — backed up to ' + PATCHES_DIR_NAME + '/');
    for (const f of modified) {
      console.log('     ' + dim + f + reset);
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
    const reapplyCommand = runtime === 'opencode' || runtime === 'roo'
      ? '/gsd-reapply-patches'
      : runtime === 'codex'
        ? '$gsd-reapply-patches'
        : '/gsd:reapply-patches';
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
  const isCodex = runtime === 'codex';
  const isRoo = runtime === 'roo';
  const dirName = getDirName(runtime);
  const src = path.join(__dirname, '..');

  // Get the target directory based on runtime and install type
  const targetDir = isGlobal
    ? getGlobalDir(runtime, explicitConfigDir)
    : path.join(process.cwd(), dirName);

  const locationLabel = isGlobal
    ? targetDir.replace(os.homedir(), '~')
    : targetDir.replace(process.cwd(), '.');

  // Path prefix for file references in markdown content
  // For global installs: use full path
  // For local installs: use relative
  const pathPrefix = isGlobal
    ? `${targetDir.replace(/\\/g, '/')}/`
    : `./${dirName}/`;

  let runtimeLabel = 'Claude Code';
  if (isOpencode) runtimeLabel = 'OpenCode';
  if (isGemini) runtimeLabel = 'Gemini';
  if (isCodex) runtimeLabel = 'Codex';
  if (isRoo) runtimeLabel = 'Roo Code';

  console.log(`  Installing for ${cyan}${runtimeLabel}${reset} to ${cyan}${locationLabel}${reset}\n`);

  // Track installation failures
  const failures = [];

  // Save any locally modified GSD files before they get wiped
  saveLocalPatches(targetDir);

  // Clean up orphaned files from previous versions
  cleanupOrphanedFiles(targetDir);

  // OpenCode uses command/ (flat), Codex uses skills/, Claude/Gemini use commands/gsd/, Roo uses commands/ (flat with gsd- prefix)
  if (isOpencode) {
    // OpenCode: flat structure in command/ directory
    const commandDir = path.join(targetDir, 'command');
    fs.mkdirSync(commandDir, { recursive: true });
    
    // Copy commands/gsd/*.md as command/gsd-*.md (flatten structure)
    const gsdSrc = path.join(src, 'commands', 'gsd');
    copyFlattenedCommands(gsdSrc, commandDir, 'gsd', pathPrefix, runtime);
    if (verifyInstalled(commandDir, 'command/gsd-*')) {
      const count = fs.readdirSync(commandDir).filter(f => f.startsWith('gsd-')).length;
      console.log(`  ${green}✓${reset} Installed ${count} commands to command/`);
    } else {
      failures.push('command/gsd-*');
    }
  } else if (isRoo) {
    // Roo: flat structure in commands/ directory
    const commandDir = path.join(targetDir, 'commands');
    fs.mkdirSync(commandDir, { recursive: true });
    
    // Copy commands/gsd/*.md as commands/gsd-*.md (flatten structure)
    const gsdSrc = path.join(src, 'commands', 'gsd');
    copyFlattenedCommands(gsdSrc, commandDir, 'gsd', pathPrefix, runtime);
    if (verifyInstalled(commandDir, 'commands/gsd-*')) {
      const count = fs.readdirSync(commandDir).filter(f => f.startsWith('gsd-')).length;
      console.log(`  ${green}✓${reset} Installed ${count} commands to commands/`);
    } else {
      failures.push('commands/gsd-*');
    }
  } else if (isCodex) {
    const skillsDir = path.join(targetDir, 'skills');
    const gsdSrc = path.join(src, 'commands', 'gsd');
    copyCommandsAsCodexSkills(gsdSrc, skillsDir, 'gsd', pathPrefix, runtime);
    const installedSkillNames = listCodexSkillNames(skillsDir);
    if (installedSkillNames.length > 0) {
      console.log(`  ${green}✓${reset} Installed ${installedSkillNames.length} skills to skills/`);
    } else {
      failures.push('skills/gsd-*');
    }
  } else {
    // Claude Code & Gemini: nested structure in commands/ directory
    const commandsDir = path.join(targetDir, 'commands');
    fs.mkdirSync(commandsDir, { recursive: true });
    
    const gsdSrc = path.join(src, 'commands', 'gsd');
    const gsdDest = path.join(commandsDir, 'gsd');
    copyWithPathReplacement(gsdSrc, gsdDest, pathPrefix, runtime, true);
    if (verifyInstalled(gsdDest, 'commands/gsd')) {
      console.log(`  ${green}✓${reset} Installed commands/gsd`);
    } else {
      failures.push('commands/gsd');
    }
  }

  // Copy get-shit-done skill with path replacement
  const skillSrc = path.join(src, 'get-shit-done');
  const skillDest = path.join(targetDir, 'get-shit-done');
  copyWithPathReplacement(skillSrc, skillDest, pathPrefix, runtime);
  if (verifyInstalled(skillDest, 'get-shit-done')) {
    console.log(`  ${green}✓${reset} Installed get-shit-done`);
  } else {
    failures.push('get-shit-done');
  }

  // Copy agents to agents directory
  const agentsSrc = path.join(src, 'agents');
  if (fs.existsSync(agentsSrc)) {
    const agentsDest = path.join(targetDir, 'agents');
    fs.mkdirSync(agentsDest, { recursive: true });

    // Remove old GSD agents (gsd-*.md) before copying new ones
    if (fs.existsSync(agentsDest)) {
      for (const file of fs.readdirSync(agentsDest)) {
        if (file.startsWith('gsd-') && file.endsWith('.md')) {
          fs.unlinkSync(path.join(agentsDest, file));
        }
      }
    }

    // Copy new agents
    const agentEntries = fs.readdirSync(agentsSrc, { withFileTypes: true });
    for (const entry of agentEntries) {
      if (entry.isFile() && entry.name.endsWith('.md')) {
        let content = fs.readFileSync(path.join(agentsSrc, entry.name), 'utf8');
        // Always replace ~/.claude/ as it is the source of truth in the repo
        const dirRegex = /~\/\.claude\//g;
        content = content.replace(dirRegex, pathPrefix);
        content = processAttribution(content, getCommitAttribution(runtime));
        // Convert frontmatter for runtime compatibility
        if (isOpencode) {
          content = convertClaudeToOpencodeFrontmatter(content);
        } else if (isGemini) {
          content = convertClaudeToGeminiAgent(content);
        } else if (isCodex) {
          content = convertClaudeAgentToCodexAgent(content);
        }
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

  if (!isCodex) {
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
          if (entry.endsWith('.js')) {
            let content = fs.readFileSync(srcFile, 'utf8');
            content = content.replace(/'\.claude'/g, configDirReplacement);
            fs.writeFileSync(destFile, content);
          } else {
            fs.copyFileSync(srcFile, destFile);
          }
        }
      }
      if (verifyInstalled(hooksDest, 'hooks')) {
        console.log(`  ${green}✓${reset} Installed hooks (bundled)`);
      } else {
        failures.push('hooks');
      }
    }
  }

  if (failures.length > 0) {
    console.error(`\n  ${yellow}Installation incomplete!${reset} Failed: ${failures.join(', ')}`);
    process.exit(1);
  }

  // Write file manifest for future modification detection
  writeManifest(targetDir, runtime);
  console.log(`  ${green}✓${reset} Wrote file manifest (${MANIFEST_NAME})`);

  // Report any backed-up local patches
  reportLocalPatches(targetDir, runtime);

  if (isCodex) {
    // Generate Codex config.toml and per-agent .toml files
    const agentCount = installCodexConfig(targetDir, agentsSrc);
    console.log(`  ${green}✓${reset} Generated config.toml with ${agentCount} agent roles`);
    console.log(`  ${green}✓${reset} Generated ${agentCount} agent .toml config files`);
    return { settingsPath: null, settings: null, statuslineCommand: null, runtime };
  }

  if (isRoo) {
    // Roo: Generate custom_modes.yaml or instructions
    installRooModes(targetDir, agentsSrc, isGlobal);
    return { settingsPath: null, settings: null, statuslineCommand: null, runtime };
  }

  // Configure statusline and hooks in settings.json
  // Gemini shares same hook system as Claude Code for now
  const settingsPath = path.join(targetDir, 'settings.json');
  const settings = cleanupOrphanedHooks(readSettings(settingsPath));
  const statuslineCommand = isGlobal
    ? buildHookCommand(targetDir, 'gsd-statusline.js')
    : 'node ' + dirName + '/hooks/gsd-statusline.js';
  const updateCheckCommand = isGlobal
    ? buildHookCommand(targetDir, 'gsd-check-update.js')
    : 'node ' + dirName + '/hooks/gsd-check-update.js';
  const contextMonitorCommand = isGlobal
    ? buildHookCommand(targetDir, 'gsd-context-monitor.js')
    : 'node ' + dirName + '/hooks/gsd-context-monitor.js';

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
  if (!isOpencode) {
    if (!settings.hooks) {
      settings.hooks = {};
    }
    if (!settings.hooks.SessionStart) {
      settings.hooks.SessionStart = [];
    }

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

    // Configure PostToolUse hook for context window monitoring
    if (!settings.hooks.PostToolUse) {
      settings.hooks.PostToolUse = [];
    }

    const hasContextMonitorHook = settings.hooks.PostToolUse.some(entry =>
      entry.hooks && entry.hooks.some(h => h.command && h.command.includes('gsd-context-monitor'))
    );

    if (!hasContextMonitorHook) {
      settings.hooks.PostToolUse.push({
        hooks: [
          {
            type: 'command',
            command: contextMonitorCommand
          }
        ]
      });
      console.log(`  ${green}✓${reset} Configured context window monitor hook`);
    }
  }

  return { settingsPath, settings, statuslineCommand, runtime };
}

/**
 * Apply statusline config, then print completion message
 */
function finishInstall(settingsPath, settings, statuslineCommand, shouldInstallStatusline, runtime = 'claude', isGlobal = true) {
  const isOpencode = runtime === 'opencode';
  const isCodex = runtime === 'codex';
  const isRoo = runtime === 'roo';

  if (shouldInstallStatusline && !isOpencode && !isCodex && !isRoo) {
    settings.statusLine = {
      type: 'command',
      command: statuslineCommand
    };
    console.log(`  ${green}✓${reset} Configured statusline`);
  }

  // Write settings when runtime supports settings.json
  if (!isCodex && !isRoo) {
    writeSettings(settingsPath, settings);
  }

  // Configure OpenCode permissions
  if (isOpencode) {
    configureOpencodePermissions(isGlobal);
  }

  let program = 'Claude Code';
  if (runtime === 'opencode') program = 'OpenCode';
  if (runtime === 'gemini') program = 'Gemini';
  if (runtime === 'codex') program = 'Codex';
  if (runtime === 'roo') program = 'Roo Code';

  let command = '/gsd:new-project';
  if (runtime === 'opencode') command = '/gsd-new-project';
  if (runtime === 'roo') command = '/gsd-new-project';
  if (runtime === 'codex') command = '$gsd-new-project';
  console.log(`
  ${green}Done!${reset} Open a blank directory in ${program} and run ${cyan}${command}${reset}.

  ${cyan}Join the community:${reset} https://discord.gg/gsd
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

  console.log(`  ${yellow}Which runtime(s) would you like to install for?${reset}\n\n  ${cyan}1${reset}) Claude Code ${dim}(~/.claude)${reset}
  ${cyan}2${reset}) OpenCode    ${dim}(~/.config/opencode)${reset} - open source, free models
  ${cyan}3${reset}) Gemini      ${dim}(~/.gemini)${reset}
  ${cyan}4${reset}) Codex       ${dim}(~/.codex)${reset}
  ${cyan}5${reset}) Roo Code    ${dim}(~/.roo)${reset}
  ${cyan}6${reset}) All
`);

  rl.question(`  Choice ${dim}[1]${reset}: `, (answer) => {
    answered = true;
    rl.close();
    const choice = answer.trim() || '1';
    if (choice === '6') {
      callback(['claude', 'opencode', 'gemini', 'codex', 'roo']);
    } else if (choice === '5') {
      callback(['roo']);
    } else if (choice === '4') {
      callback(['codex']);
    } else if (choice === '3') {
      callback(['gemini']);
    } else if (choice === '2') {
      callback(['opencode']);
    } else {
      callback(['claude']);
    }
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

  const finalize = (shouldInstallStatusline) => {
    for (const result of results) {
      const useStatusline = statuslineRuntimes.includes(result.runtime) && shouldInstallStatusline;
      finishInstall(
        result.settingsPath,
        result.settings,
        result.statuslineCommand,
        useStatusline,
        result.runtime,
        isGlobal
      );
    }
  };

  if (primaryStatuslineResult) {
    handleStatusline(primaryStatuslineResult.settings, isInteractive, finalize);
  } else {
    finalize(false);
  }
}

// Test-only exports — skip main logic when loaded as a module for testing
if (process.env.GSD_TEST_MODE) {
  module.exports = {
    getCodexSkillAdapterHeader,
    convertClaudeAgentToCodexAgent,
    generateCodexAgentToml,
    generateCodexConfigBlock,
    stripGsdFromCodexConfig,
    mergeCodexConfig,
    installCodexConfig,
    convertClaudeCommandToCodexSkill,    
    replacePathsForRoo,
    convertCommandForRoo,
    installRooModes,
    copyFlattenedCommands,
    GSD_CODEX_MARKER,
    CODEX_AGENT_SANDBOX,
  };
} else {

// Main logic
if (hasGlobal && hasLocal) {
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
