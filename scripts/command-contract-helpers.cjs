'use strict';
/**
 * command-contract-helpers.cjs  (ADR-0002)
 *
 * Single source of truth for the commands/gsd/*.md contract constants and
 * parsers shared by scripts/lint-command-contract.cjs and
 * tests/command-contract.test.cjs.
 *
 * Keeping these in one place ensures the lint script and the test suite
 * always agree on what constitutes a valid tool, a valid @-ref, and a valid
 * frontmatter structure. A new canonical tool added here is automatically
 * enforced by both consumers.
 */

const CANONICAL_TOOLS = new Set([
  'Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep',
  'Task', 'Agent', 'Skill', 'SlashCommand',
  'AskUserQuestion', 'WebFetch', 'WebSearch', 'TodoWrite',
  'mcp__context7__resolve-library-id',
  'mcp__context7__query-docs',
  'mcp__context7__*',
]);

function parseFrontmatter(content) {
  // CRLF-tolerant split: Windows checkouts (autocrlf=true) leave a trailing
  // \r on every line, making lines.indexOf('---', 1) return -1 (the value
  // would be '---\r', not '---') → returns {} → every field appears missing.
  const lines = content.split(/\r?\n/);
  if (lines[0].trim() !== '---') return {};
  const end = lines.indexOf('---', 1);
  if (end === -1) return {};
  const fm = {};
  let key = null;
  for (const line of lines.slice(1, end)) {
    const kv = line.match(/^([a-zA-Z0-9_-]+):\s*(.*)/);
    if (kv) { key = kv[1]; fm[key] = kv[2].trim(); }
    else if (key && line.match(/^\s+-\s+/)) {
      const val = line.replace(/^\s+-\s+/, '').trim();
      fm[key] = fm[key] ? fm[key] + '\n' + val : val;
    }
  }
  return fm;
}

function executionContextRefs(content) {
  const refs = [];
  const re = /<execution_context(?:_extended)?>([\s\S]*?)<\/execution_context(?:_extended)?>/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    for (const rawLine of m[1].split('\n')) {
      const line = rawLine.trim();
      if (!line.startsWith('@')) continue;
      const token = line.split(/\s+/)[0];
      const trailingProse = line.length > token.length;
      const normalized = token
        .replace(/^@(?:~|\$HOME)\//, '')
        .replace(/^(?:\.claude\/)?(?:get-shit-done\/)?/, '');
      refs.push({ token, normalized, trailingProse });
    }
  }
  return refs;
}

module.exports = { CANONICAL_TOOLS, parseFrontmatter, executionContextRefs };
