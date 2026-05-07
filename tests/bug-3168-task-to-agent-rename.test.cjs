'use strict';

// allow-test-rule: source-text-is-the-product
// commands/gsd/*.md, get-shit-done/workflows/*.md, and agents/gsd-*.md are
// deployed product files. Checking their text IS checking the runtime contract.

/**
 * #3168 — Incomplete Task→Agent dispatcher rename causes silent inline fallback.
 *
 * The Claude Code subagent-dispatcher tool is named `Agent`. The `Task*` namespace
 * (TaskCreate, TaskList, TaskGet, TaskUpdate, TaskOutput, TaskStop) is the task
 * tracker — a distinct tool set. GSD workflows were partially migrated and still
 * reference `Task(` and `- Task` in allowed-tools/tools frontmatter in most files.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const COMMANDS_DIR = path.join(ROOT, 'commands', 'gsd');
const WORKFLOWS_DIR = path.join(ROOT, 'get-shit-done', 'workflows');
const AGENTS_DIR = path.join(ROOT, 'agents');

// Task tracker names — these must NOT be renamed
const TASK_TRACKER_PATTERN = /\bTask(?:Create|List|Get|Update|Output|Stop)\b/;

function readMdFiles(dir, prefix) {
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.md') && (!prefix || f.startsWith(prefix)))
    .map(f => ({ name: f, path: path.join(dir, f), content: fs.readFileSync(path.join(dir, f), 'utf-8') }));
}

function extractFrontmatterTools(content) {
  const fm = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fm) return [];
  const toolsMatch = fm[1].match(/^allowed-tools:\s*\n((?:[ \t]+-[^\n]*\n?)*)/m) ||
                     fm[1].match(/^tools:\s*(.+)$/m);
  if (!toolsMatch) return [];
  const toolsBlock = toolsMatch[1];
  if (toolsBlock.includes('\n')) {
    return toolsBlock.match(/[-\s]*([A-Za-z_*][A-Za-z0-9_*]*)/g)
      .map(t => t.replace(/^[-\s]+/, '').trim())
      .filter(Boolean);
  }
  return toolsBlock.split(',').map(t => t.trim()).filter(Boolean);
}

describe('#3168 — commands/gsd: allowed-tools must use Agent not Task', () => {
  const commands = readMdFiles(COMMANDS_DIR);

  for (const cmd of commands) {
    test(`${cmd.name}: allowed-tools must not list Task without Agent`, () => {
      const tools = extractFrontmatterTools(cmd.content);
      const hasTask = tools.includes('Task');
      const hasAgent = tools.includes('Agent');
      assert.ok(
        !hasTask || hasAgent,
        `${cmd.name}: allowed-tools lists "Task" but not "Agent" — dispatcher tool is "Agent", not "Task"\n  tools: [${tools.join(', ')}]`,
      );
      assert.ok(
        !hasTask,
        `${cmd.name}: allowed-tools still lists "Task" — remove it (Agent is the dispatcher tool)\n  tools: [${tools.join(', ')}]`,
      );
    });
  }
});

describe('#3168 — workflows: prose must use Agent( not Task( for dispatcher calls', () => {
  const workflows = [];
  function collectMd(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) collectMd(path.join(dir, entry.name));
      else if (entry.name.endsWith('.md')) workflows.push({ name: entry.name, path: path.join(dir, entry.name), content: fs.readFileSync(path.join(dir, entry.name), 'utf-8') });
    }
  }
  collectMd(WORKFLOWS_DIR);

  for (const wf of workflows) {
    test(`${wf.name}: must not contain dispatcher Task( calls`, () => {
      const lines = wf.content.split('\n');
      const violations = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Skip code fences that show old examples
        if (line.trim().startsWith('```') || line.trim().startsWith('#')) continue;
        // Match Task( that is NOT a tracker call (TaskCreate, TaskList, etc.)
        if (/\bTask\(/.test(line) && !TASK_TRACKER_PATTERN.test(line)) {
          violations.push(`  line ${i + 1}: ${line.trim()}`);
        }
      }
      assert.deepStrictEqual(
        violations,
        [],
        `${wf.name}: found dispatcher Task( calls that should be Agent(:\n${violations.join('\n')}`,
      );
    });
  }
});

describe('#3168 — agents: tools frontmatter must use Agent not Task', () => {
  const agents = readMdFiles(AGENTS_DIR, 'gsd-');

  for (const agent of agents) {
    test(`${agent.name}: tools must not list Task`, () => {
      const tools = extractFrontmatterTools(agent.content);
      assert.ok(
        !tools.includes('Task'),
        `${agent.name}: tools frontmatter lists "Task" — should be "Agent"\n  tools: [${tools.join(', ')}]`,
      );
    });
  }
});
