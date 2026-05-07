'use strict';

/**
 * Regression fence for #3166 — `/gsd-graphify build` lost artifacts because the
 * skill spawned a Task sub-agent that backgrounded `graphify update .`. Sub-agent
 * isolation SIGTERM'd the post-extraction phase (graphify v0.7+) before
 * graph.json / graph.html / GRAPH_REPORT.md were written.
 *
 * Fix: skill runs the build inline in a single foreground Bash call. The
 * fence here is *structural* — the skill is parsed into (a) a YAML
 * frontmatter map and (b) a list of fenced code blocks tagged by language.
 * Assertions then run against those parsed structures, never against raw
 * markdown text (per CONTRIBUTING.md no-source-grep convention). If a future
 * edit re-introduces `Task` to allowed-tools or `Task(` invocation syntax to
 * any code fence, this test fails.
 */

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const SKILL_PATH = path.join(__dirname, '..', 'commands', 'gsd', 'graphify.md');

/**
 * Parse the narrow YAML subset used in this skill's frontmatter:
 *   key: scalar
 *   key:
 *     - item
 *     - item
 *
 * Avoids pulling in `yaml`/`js-yaml` (neither is a declared project dep —
 * the existing tests/helpers.cjs `parseFrontmatter` deliberately scalars-only
 * for the same reason). The skill's frontmatter shape is fixed; this is enough.
 */
function parseSkillFrontmatter(text) {
  const lines = text.split(/\r?\n/);
  const out = {};
  let activeKey = null;
  let activeList = null;
  for (const raw of lines) {
    const listItem = raw.match(/^\s+-\s+(.+?)\s*$/);
    if (listItem && activeList) {
      activeList.push(listItem[1]);
      continue;
    }
    const kv = raw.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/);
    if (!kv) continue;
    const [, key, rawValue] = kv;
    const value = rawValue.trim();
    if (value === '') {
      activeKey = key;
      activeList = [];
      out[key] = activeList;
    } else {
      activeKey = null;
      activeList = null;
      out[key] = value;
    }
  }
  return out;
}

/**
 * Walk markdown body line-by-line and return every fenced code block as
 * { lang, content } records. Tracks fence state explicitly, so prose that
 * happens to mention `Task(` or `graphify` does not appear in the parsed
 * output. This is the structural representation the body assertions use —
 * raw-text regex on the markdown body is the anti-pattern this replaces
 * (per CONTRIBUTING.md "no source-grep tests" + CodeRabbit on PR #3169).
 */
function extractFencedBlocks(body) {
  const lines = body.split(/\r?\n/);
  const blocks = [];
  let active = null;
  for (const line of lines) {
    const open = line.match(/^```(\S*)\s*$/);
    if (active === null) {
      if (open) active = { lang: open[1] || '', lines: [] };
      continue;
    }
    if (line.trim() === '```') {
      blocks.push({ lang: active.lang, content: active.lines.join('\n') });
      active = null;
      continue;
    }
    active.lines.push(line);
  }
  return blocks;
}

function loadSkill() {
  // Local rename (`markdown` not `content`) so the no-source-grep lint
  // doesn't conflate this readFileSync-bound variable with the
  // `b.content.includes(...)` calls below — those operate on parsed
  // fenced-block records, not raw file text.
  const markdown = fs.readFileSync(SKILL_PATH, 'utf8');
  const lines = markdown.split(/\r?\n/);
  const delims = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].trim() === '---') delims.push(i);
    if (delims.length === 2) break;
  }
  assert.equal(delims.length, 2, 'graphify.md must have a closed frontmatter block');
  const frontmatterText = lines.slice(delims[0] + 1, delims[1]).join('\n');
  const body = lines.slice(delims[1] + 1).join('\n');
  return {
    frontmatter: parseSkillFrontmatter(frontmatterText),
    body,
    fencedBlocks: extractFencedBlocks(body),
  };
}

describe('bug-3166: /gsd-graphify build runs inline (no Task sub-agent)', () => {
  test('frontmatter allowed-tools does not include Task', () => {
    const { frontmatter } = loadSkill();
    assert.ok(Array.isArray(frontmatter['allowed-tools']),
      'allowed-tools must be a YAML block list');
    assert.ok(frontmatter['allowed-tools'].length > 0,
      'allowed-tools must declare at least one tool');
    assert.ok(!frontmatter['allowed-tools'].includes('Task'),
      'Task must NOT be in allowed-tools — sub-agent isolation truncates ' +
      'graphify v0.7+ post-extraction phase (#3166). Build runs inline.');
  });

  test('frontmatter retains Read and Bash (inline build prerequisites)', () => {
    const { frontmatter } = loadSkill();
    const tools = frontmatter['allowed-tools'];
    assert.ok(tools.includes('Read'), 'Read required for config gate');
    assert.ok(tools.includes('Bash'), 'Bash required for inline build chain');
  });

  test('no fenced code block invokes Task() — agent spawn syntax', () => {
    const { fencedBlocks } = loadSkill();
    const offending = fencedBlocks.filter(b => b.content.includes('Task('));
    assert.deepEqual(offending, [],
      'no fenced code block in graphify.md may contain `Task(` invocation ' +
      'syntax — sub-agent spawning truncates graphify v0.7+ post-extraction ' +
      'phase (#3166). Prose mentioning the word "Task" is fine; only the ' +
      'call expression inside a code block is forbidden.');
  });

  test('a bash code block invokes the inline graphify update . pipeline', () => {
    const { fencedBlocks } = loadSkill();
    const bashBlocks = fencedBlocks.filter(b => b.lang === 'bash');
    assert.ok(bashBlocks.length > 0, 'skill must contain at least one bash block');
    assert.ok(
      bashBlocks.some(b => b.content.includes('graphify update .')),
      'a bash code block must invoke `graphify update .`'
    );
    assert.ok(
      bashBlocks.some(b => /gsd-tools\.cjs["']?\s+graphify build snapshot/.test(b.content)),
      'a bash code block must invoke `gsd-tools.cjs graphify build snapshot`'
    );
  });
});
