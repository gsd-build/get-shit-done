'use strict';

// ──────────────────────────────────────────────────────
// GitHub Copilot Conversion  — fork-owned, upstream-safe
// ──────────────────────────────────────────────────────
// All Copilot-specific conversion logic lives here so that bin/install.js
// only needs minimal integration lines (require + if/else branches) that
// are trivial to re-apply after upstream merges.

const fs   = require('fs');
const os   = require('os');
const path = require('path');

const PS1_UPDATE_URL =
  'https://raw.githubusercontent.com/darrylwisner/get-shit-done-github-copilot/main/gsd-copilot-installer/gsd-copilot-install.ps1';

// ── Internal helper ───────────────────────────────────────────────────────────

/** Convert an absolute path prefix to a $HOME-relative form, if possible. */
function toHomePrefix(pathPrefix) {
  const home = os.homedir().replace(/\\/g, '/');
  const normalized = pathPrefix.replace(/\\/g, '/');
  if (normalized.startsWith(home)) {
    return '$HOME' + normalized.slice(home.length);
  }
  return normalized;
}

// ── Exported functions ────────────────────────────────────────────────────────

/**
 * Load the Claude→VS Code tool name mapping from scripts/tools.json.
 */
function loadCopilotToolMap() {
  const p = path.join(__dirname, '..', 'scripts', 'tools.json');
  if (!fs.existsSync(p)) {
    console.warn('  Warning: scripts/tools.json not found — Copilot tool mapping unavailable');
    return {};
  }
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    console.warn(`  Warning: could not parse scripts/tools.json: ${e.message}`);
    return {};
  }
}

/**
 * Parse YAML frontmatter from a markdown string.
 * Returns { data: {key: value}, body: string }.
 */
function parseCopilotFrontmatter(md) {
  if (!md.startsWith('---')) return { data: {}, body: md };
  const match = md.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { data: {}, body: md };
  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    data[m[1]] = v;
  }
  return { data, body: match[2].trimStart() };
}

/**
 * Extract the allowed-tools list from a GSD command's frontmatter.
 * Returns original-cased tool name array.
 */
function parseCopilotUpstreamTools(source) {
  const normalized = source.replace(/\r\n/g, '\n');
  const fmMatch = normalized.match(/^---[ \t]*\n([\s\S]*?)\n---[ \t]*(?:\n|$)/);
  if (!fmMatch) return [];
  const fmText = fmMatch[1];
  const KEY_LINE = /^allowed-tools\s*:\s*(.*)$/;
  const LIST_ITEM = /^\s+-\s+(.+)\s*$/;
  const NEW_KEY = /^[A-Za-z0-9_-]+\s*:/;
  let state = 'SCANNING';
  const items = [];
  for (const line of fmText.split('\n')) {
    if (state === 'SCANNING') {
      const m = line.match(KEY_LINE);
      if (!m) continue;
      const inline = m[1].trim();
      if (inline) {
        const stripped = inline.replace(/^\[/, '').replace(/\]$/, '');
        return stripped.split(/\s*,\s*/).map(s => s.trim()).filter(Boolean);
      }
      state = 'COLLECTING';
      continue;
    }
    if (state === 'COLLECTING') {
      if (line.trim() === '' || NEW_KEY.test(line)) break;
      const itemMatch = line.match(LIST_ITEM);
      if (itemMatch) items.push(itemMatch[1].trim());
    }
  }
  return items;
}

/**
 * Map an array of Claude tool names to VS Code Copilot tool names.
 * Returns deduplicated sorted array.
 */
function mapCopilotTools(upstreamTools, toolMap) {
  if (!upstreamTools.length) return [];
  const result = new Set();
  for (const tool of upstreamTools) {
    if (tool.startsWith('mcp__')) { result.add(tool); continue; }
    const originalKey = Object.keys(toolMap).find(k => k.toLowerCase() === tool.toLowerCase());
    if (!originalKey) continue;
    const mapped = toolMap[originalKey];
    if (!mapped || mapped === 'UNMAPPED') continue;
    result.add(mapped);
  }
  return [...result].sort();
}

/**
 * Convert a Claude Code GSD command .md to a VS Code Copilot .prompt.md file.
 * Maps tools, rewrites paths, injects adapter shim.
 *
 * @param {string} source      Raw source file content
 * @param {string} cmdFile     Absolute path to source file (for banner comment)
 * @param {Object} toolMap     Claude→VS Code tool map from tools.json
 * @param {string} pathPrefix  Workspace-relative path prefix, e.g. './.github/'
 */
function convertClaudeCommandToCopilotPrompt(source, cmdFile, toolMap, pathPrefix) {
  const { data: fm, body } = parseCopilotFrontmatter(source);
  const upstreamTools = parseCopilotUpstreamTools(source);
  const mappedTools = mapCopilotTools(upstreamTools, toolMap);

  // Normalize command name: gsd:new-project → gsd.new-project
  const rawName = fm['name'] || path.basename(cmdFile, '.md');
  const name = rawName.replace(/^gsd:/, 'gsd.').replace(/:/g, '.');

  const hasAgent = mappedTools.includes('agent');

  const desc = (fm['description'] || '').replace(/\/gsd:/g, '/gsd.').replace(/"/g, '\\"');
  const fmLines = [
    `name: ${name}`,
    `description: "${desc}"`,
  ];
  if (fm['argument-hint']) fmLines.push(`argument-hint: "${fm['argument-hint']}"`);
  if (mappedTools.length) fmLines.push(`tools: [${mappedTools.map(t => `'${t}'`).join(', ')}]`);
  if (hasAgent) fmLines.push('agent: agent');

  // Generated banner
  const sourceRel = path.relative(path.join(__dirname, '..'), cmdFile).replace(/\\/g, '/');
  const banner = `<!-- GENERATED — DO NOT EDIT.\nSource: ${sourceRel}\nRegenerate: node bin/install.js --copilot --local\n-->`;

  const upstreamToolsComment = upstreamTools.length
    ? `<!-- upstream-tools: ${JSON.stringify(upstreamTools)} -->`
    : '';

  // Only inject the adapter shim when the command actually maps AskUserQuestion
  const needsAdapter = mappedTools.includes('vscode/askQuestions');
  const adapterBlock = needsAdapter ? [
    '## Copilot Runtime Adapter (important)',
    '',
    'Upstream GSD command sources may reference an `AskUserQuestion` tool (Claude/OpenCode runtime concept).',
    '',
    'In VS Code Copilot, **do not attempt to call a tool named `AskUserQuestion`**.',
    'Instead, whenever the upstream instructions say "Use AskUserQuestion", use **#tool:vscode/askQuestions** with:',
    '',
    '- Combine the **Header** and **Question** into a single clear question string.',
    '- If the upstream instruction specifies **Options**, present them as numbered choices.',
    '- If no options are specified, ask as a freeform question.',
    '',
    '**Rules:**',
    '1. If the options include "Other", "Something else", or "Let me explain", and the user selects it, follow up with a freeform question via #tool:vscode/askQuestions.',
    '2. Follow the upstream branching and loop rules exactly as written (e.g., "if X selected, do Y; otherwise continue").',
    '3. If the upstream flow says to **exit/stop** and run another command, tell the user to run that slash command next, then stop.',
    '4. Use #tool:vscode/askQuestions freely — do not guess or assume user intent.',
    '',
    '---',
  ].join('\n') : '';

  // Process body
  let processedBody = body;
  // Convert @include → "- Read file at:"
  processedBody = processedBody.replace(/^\s*@(?:include\s+)?(.+?)\s*$/gm, (_, p1) => `- Read file at: ${p1.trim()}`);
  // Rewrite runtime paths to workspace-relative pathPrefix
  processedBody = processedBody
    .replace(/~\/\.claude\//g, pathPrefix)
    .replace(/\$HOME\/\.claude\//g, toHomePrefix(pathPrefix))
    .replace(/\.\/\.claude\//g, pathPrefix);
  // Rewrite command references: /gsd:cmd → /gsd.cmd (Copilot uses dot namespace)
  processedBody = processedBody.replace(/\/gsd:/g, '/gsd.');

  const blocks = [banner, upstreamToolsComment, adapterBlock, processedBody.trimEnd()]
    .filter(b => b && b.trim().length > 0)
    .join('\n\n');

  return `---\n${fmLines.join('\n')}\n---\n\n${blocks}\n`;
}

/**
 * Convert a Claude Code GSD agent .md to VS Code Copilot .agent.md format.
 * Maps tool names and rebuilds frontmatter.
 *
 * @param {string} source   File content
 * @param {Object} toolMap  Claude→VS Code tool map from tools.json
 */
function convertClaudeAgentToCopilotAgent(source, toolMap) {
  const { data: fm, body } = parseCopilotFrontmatter(source.replace(/\r\n/g, '\n'));
  const rawToolsStr = fm['tools'] || '';
  const rawTools = rawToolsStr.split(/\s*,\s*/).map(s => s.trim()).filter(Boolean);
  const mappedTools = mapCopilotTools(rawTools, toolMap);

  const fmLines = [
    `name: ${fm['name'] || 'unknown'}`,
    `description: "${(fm['description'] || '').replace(/"/g, '\\"')}"`,
  ];
  if (mappedTools.length) {
    fmLines.push(`tools: [${mappedTools.map(t => `'${t}'`).join(', ')}]`);
  }

  return `---\n${fmLines.join('\n')}\n---\n${body}`;
}

/**
 * Apply Copilot-specific patches to workflow/reference file content.
 * Fixes runtime detection loops, install commands, and UI text that reference
 * other runtimes but are not covered by the generic path replacement.
 */
function patchContentForCopilot(content) {
  // Add .github to runtime detection for-loops (update.md version detection & cache clear)
  content = content.replace(
    /for dir in \.claude \.config\/opencode \.opencode \.gemini; do/g,
    'for dir in .github .claude .config/opencode .opencode .gemini; do'
  );
  // Replace npx update commands with the PS1 one-liner.
  // The upstream npm package (get-shit-done-cc) has no --copilot flag, so
  // Copilot users must update via the fork's PS1 installer script.
  const ps1OneLiner = `irm "${PS1_UPDATE_URL}" | iex`;
  content = content.replace(/npx -y get-shit-done-cc@latest --local/g, ps1OneLiner);
  content = content.replace(/npx -y get-shit-done-cc@latest --global/g, ps1OneLiner);
  // Fix restart message (Claude Code → VS Code)
  content = content.replace(/Restart Claude Code/g, 'Restart VS Code');
  // Rewrite command references: /gsd:cmd → /gsd.cmd (Copilot uses dot namespace)
  content = content.replace(/\/gsd:/g, '/gsd.');
  return content;
}

module.exports = {
  loadCopilotToolMap,
  convertClaudeCommandToCopilotPrompt,
  convertClaudeAgentToCopilotAgent,
  patchContentForCopilot,
};
