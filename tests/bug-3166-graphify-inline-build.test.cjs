'use strict';

/**
 * Regression fence for #3166 — `/gsd-graphify build` lost artifacts because the
 * skill spawned a Task sub-agent that backgrounded `graphify update .`. Sub-agent
 * isolation SIGTERM'd the post-extraction phase (graphify v0.7+) before
 * graph.json / graph.html / GRAPH_REPORT.md were written.
 *
 * Fix: skill runs the build inline in a single foreground Bash call. The fence
 * here is *structural* — the YAML frontmatter must not list `Task` in
 * allowed-tools, and the body must not contain `Task(` invocation syntax. If a
 * future edit re-introduces either, this test fails.
 */

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const yaml = require('yaml');

const SKILL_PATH = path.join(__dirname, '..', 'commands', 'gsd', 'graphify.md');

function loadSkill() {
  const content = fs.readFileSync(SKILL_PATH, 'utf8');
  const lines = content.split(/\r?\n/);
  const delims = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].trim() === '---') delims.push(i);
    if (delims.length === 2) break;
  }
  assert.equal(delims.length, 2, 'graphify.md must have a closed frontmatter block');
  const frontmatterText = lines.slice(delims[0] + 1, delims[1]).join('\n');
  const body = lines.slice(delims[1] + 1).join('\n');
  return { frontmatter: yaml.parse(frontmatterText), body };
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

  test('skill body does not invoke Task() — agent spawn syntax', () => {
    const { body } = loadSkill();
    // Anchor on the call expression `Task(` so a passing reference to the
    // string "Task" in prose doesn't false-positive.
    assert.ok(!/\bTask\s*\(/.test(body),
      'graphify.md body must not contain Task( invocation syntax — ' +
      'inline build only (#3166)');
  });

  test('skill body retains the inline graphify update . pipeline', () => {
    const { body } = loadSkill();
    assert.ok(/graphify\s+update\s+\./.test(body),
      'skill must still invoke `graphify update .`');
    assert.ok(/graphify build snapshot/.test(body),
      'skill must still write the diff snapshot via gsd-tools');
  });
});
