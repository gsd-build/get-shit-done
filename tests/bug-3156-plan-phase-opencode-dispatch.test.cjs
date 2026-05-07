'use strict';

// allow-test-rule: source-text-is-the-product
// commands/gsd/*.md files are the deployed skill surface. Their frontmatter
// IS the runtime contract. Checking frontmatter fields checks deployed behaviour.

/**
 * #3156 — plan-phase auto-dispatches to gsd-planner subagent on OpenCode,
 * losing Task tool access.
 *
 * Root cause: commands/gsd/plan-phase.md had `agent: gsd-planner` in its
 * frontmatter. Per OpenCode docs, `agent: <name>` in a command causes
 * auto-dispatch to a subagent context where the Agent (Task spawner) tool is
 * unavailable. Orchestrator commands that need to spawn subagents via the
 * Agent tool must NOT carry an `agent:` frontmatter directive.
 *
 * This test parses the YAML frontmatter of every commands/gsd/*.md file and
 * asserts:
 *   1. No command file has an `agent:` frontmatter directive at all.
 *      (The directive causes OpenCode to auto-dispatch, breaking any command
 *      that relies on the Agent tool to spawn subagents.)
 *   2. Any command whose allowed-tools includes `Agent` (an orchestrator) must
 *      not have `agent:` in its frontmatter.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const COMMANDS_DIR = path.join(ROOT, 'commands', 'gsd');

/** Parse the YAML frontmatter block between the first two `---` delimiters. */
function parseFrontmatter(content) {
  const lines = content.split(/\r?\n/);
  if (lines[0].trim() !== '---') return {};
  const end = lines.findIndex((line, idx) => idx > 0 && line.trim() === '---');
  if (end === -1) return {};
  const fm = {};
  let currentKey = null;
  for (const line of lines.slice(1, end)) {
    const kv = line.match(/^([a-zA-Z0-9_-]+):\s*(.*)/);
    if (kv) {
      currentKey = kv[1];
      fm[currentKey] = kv[2].trim();
    } else if (currentKey && line.match(/^\s+-\s+/)) {
      const val = line.replace(/^\s+-\s+/, '').trim();
      fm[currentKey] = fm[currentKey] ? fm[currentKey] + '\n' + val : val;
    }
  }
  return fm;
}

/** Return the list of tools from the allowed-tools frontmatter block. */
function allowedTools(fm) {
  const raw = fm['allowed-tools'];
  if (!raw) return [];
  // Multi-line YAML list: each entry on its own line
  if (raw.includes('\n')) {
    return raw.split('\n').map(t => t.trim()).filter(Boolean);
  }
  return raw.split(',').map(t => t.trim()).filter(Boolean);
}

const commandFiles = fs
  .readdirSync(COMMANDS_DIR)
  .filter(f => f.endsWith('.md'))
  .map(f => ({
    name: f,
    full: path.join(COMMANDS_DIR, f),
    content: fs.readFileSync(path.join(COMMANDS_DIR, f), 'utf-8'),
  }));

// ─── No command may carry `agent:` ────────────────────────────────────────────
//
// OpenCode interprets `agent: <name>` as "auto-dispatch to this subagent",
// which removes the Agent (subagent-spawner) tool from the command's context.
// Any orchestrator command is immediately broken. Commands that need to run in
// the main agent context (i.e., all GSD commands) must omit this directive.

describe('#3156 — no command file may have an `agent:` frontmatter directive', () => {
  for (const { name, content } of commandFiles) {
    test(`${name}: no agent: directive in frontmatter`, () => {
      const fm = parseFrontmatter(content);
      assert.ok(
        !Object.prototype.hasOwnProperty.call(fm, 'agent'),
        `${name}: has \`agent: ${fm['agent']}\` in frontmatter — ` +
        'this causes OpenCode to auto-dispatch to a subagent context where the ' +
        'Agent tool is unavailable, breaking orchestrator workflows. ' +
        'Remove the `agent:` directive so the command runs in the main agent context.',
      );
    });
  }
});

// ─── Orchestrator commands must not have `agent:` ────────────────────────────
//
// Redundant with the above (belt-and-suspenders), but captures the precise
// failure mode from #3156: a command whose allowed-tools includes `Agent`
// relies on spawning subagents. Pairing that with `agent:` is self-defeating.

describe('#3156 — orchestrator commands (allowed-tools: Agent) must not have agent:', () => {
  const orchestrators = commandFiles.filter(({ content }) => {
    const fm = parseFrontmatter(content);
    const tools = allowedTools(fm);
    return tools.includes('Agent');
  });

  for (const { name, content } of orchestrators) {
    test(`${name}: orchestrator must not carry agent: directive`, () => {
      const fm = parseFrontmatter(content);
      assert.ok(
        !Object.prototype.hasOwnProperty.call(fm, 'agent'),
        `${name}: allowed-tools includes Agent (orchestrator) but also has ` +
        `\`agent: ${fm['agent']}\` — OpenCode will auto-dispatch to a subagent ` +
        'where Agent is unavailable, making the orchestrator unable to spawn ' +
        'researcher/planner/checker subagents. Remove the `agent:` directive.',
      );
    });
  }
});
