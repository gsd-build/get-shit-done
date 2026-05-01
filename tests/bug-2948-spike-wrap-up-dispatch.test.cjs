/**
 * Regression test for bug #2948
 *
 * `/gsd-spike --wrap-up` was silently no-oping because:
 * 1. `commands/gsd/spike.md` listed `--wrap-up` as a flag but had no dispatch block.
 * 2. `workflows/spike.md` still referenced the deleted `/gsd-spike-wrap-up` entry-point
 *    instead of the correct `/gsd-spike --wrap-up` form.
 *
 * Fix:
 * - `commands/gsd/spike.md` now has a dispatch block that routes `--wrap-up` to
 *   spike-wrap-up.md, and spike-wrap-up.md is listed in execution_context so the
 *   runtime can find it.
 * - `workflows/spike.md` companion references updated from `/gsd-spike-wrap-up` to
 *   `/gsd-spike --wrap-up`.
 */

// allow-test-rule: source-text-is-the-product
// commands/gsd/*.md files ARE what the runtime loads — testing their
// frontmatter and section content tests the deployed system-prompt contract.

'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SPIKE_CMD_PATH = path.join(__dirname, '..', 'commands', 'gsd', 'spike.md');
const SPIKE_WORKFLOW_PATH = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'spike.md');

/**
 * Parse YAML frontmatter + body from a markdown file.
 * Returns a shallow { key: value } map of frontmatter fields plus `_body`.
 * Mirrors the parseFrontmatter utility used in enh-2792-namespace-skills.test.cjs.
 */
function parseFrontmatter(content) {
  const lines = content.split(/\r?\n/);

  // Frontmatter must start at the very first line; a mid-file '---' is a
  // horizontal rule, not a frontmatter delimiter.
  if (lines[0]?.trim() !== '---') {
    return { _body: content };
  }

  let closeIdx = -1;
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i].trim() === '---') {
      closeIdx = i;
      break;
    }
  }
  assert.ok(closeIdx !== -1, 'frontmatter block must be delimited by --- on its own lines');
  const fm = {};
  for (const line of lines.slice(1, closeIdx)) {
    const m = line.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/);
    if (!m) continue;
    const [, key, raw] = m;
    fm[key] = raw.trim().replace(/^["']|["']$/g, '');
  }
  fm._body = lines.slice(closeIdx + 1).join('\n');
  return fm;
}

/**
 * Extract the text content of a named XML-like section from a markdown body.
 * Returns null if the section is absent.
 */
function extractSection(body, tag) {
  const open = `<${tag}>`;
  const close = `</${tag}>`;
  const start = body.indexOf(open);
  const end = body.indexOf(close);
  if (start === -1 || end === -1) return null;
  return body.slice(start + open.length, end);
}

/**
 * Parse the @-prefixed workflow references out of an execution_context section.
 * Returns an array of resolved reference strings (@ stripped).
 */
function parseExecutionContextRefs(section) {
  return section
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.startsWith('@'))
    .map(l => l.slice(1).trim());
}

describe('bug-2948: /gsd-spike --wrap-up dispatch wiring', () => {
  describe('commands/gsd/spike.md — frontmatter and section contract', () => {
    test('spike.md command file exists and has valid frontmatter', () => {
      assert.ok(fs.existsSync(SPIKE_CMD_PATH), 'commands/gsd/spike.md should exist');
      const fm = parseFrontmatter(fs.readFileSync(SPIKE_CMD_PATH, 'utf-8'));
      assert.ok(fm.name, 'frontmatter must have a name field');
    });

    test('argument-hint frontmatter field advertises --wrap-up flag', () => {
      const fm = parseFrontmatter(fs.readFileSync(SPIKE_CMD_PATH, 'utf-8'));
      assert.ok(
        fm['argument-hint'] && fm['argument-hint'].includes('--wrap-up'),
        `argument-hint must advertise --wrap-up; got: "${fm['argument-hint']}"`
      );
    });

    test('execution_context section includes spike-wrap-up workflow reference', () => {
      const fm = parseFrontmatter(fs.readFileSync(SPIKE_CMD_PATH, 'utf-8'));
      const execSection = extractSection(fm._body, 'execution_context');
      assert.ok(execSection !== null, 'spike.md must have an <execution_context> section');
      const refs = parseExecutionContextRefs(execSection);
      assert.ok(
        refs.some(r => r.includes('spike-wrap-up')),
        `execution_context must declare a spike-wrap-up reference so the runtime can load the workflow; ` +
        `declared refs: ${JSON.stringify(refs)}`
      );
    });

    test('process section dispatches first-token --wrap-up to spike-wrap-up workflow', () => {
      const fm = parseFrontmatter(fs.readFileSync(SPIKE_CMD_PATH, 'utf-8'));
      const processSection = extractSection(fm._body, 'process');
      assert.ok(processSection, 'spike.md must have a <process> section');

      const rules = processSection
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean);

      const wrapUpRule = rules.find(line => line.startsWith('- If it is `--wrap-up`:'));
      const fallbackRule = rules.find(line => line.startsWith('- Otherwise:'));

      assert.ok(
        wrapUpRule && wrapUpRule.includes('strip the flag') && wrapUpRule.includes('spike-wrap-up'),
        'process must define a --wrap-up branch that strips the flag and routes to spike-wrap-up'
      );
      assert.ok(
        fallbackRule && fallbackRule.includes('spike workflow'),
        'process must define an Otherwise fallback to the normal spike workflow'
      );
    });
  });

  describe('get-shit-done/workflows/spike.md — companion references', () => {
    test('spike workflow file exists', () => {
      assert.ok(fs.existsSync(SPIKE_WORKFLOW_PATH), 'get-shit-done/workflows/spike.md should exist');
    });

    test('does NOT reference the deleted /gsd-spike-wrap-up entry-point', () => {
      const fm = parseFrontmatter(fs.readFileSync(SPIKE_WORKFLOW_PATH, 'utf-8'));
      assert.ok(
        !fm._body.includes('/gsd-spike-wrap-up'),
        'workflows/spike.md must not reference the deleted /gsd-spike-wrap-up command; use /gsd-spike --wrap-up instead'
      );
    });

    test('references /gsd-spike --wrap-up as the canonical wrap-up invocation', () => {
      const fm = parseFrontmatter(fs.readFileSync(SPIKE_WORKFLOW_PATH, 'utf-8'));
      assert.ok(
        fm._body.includes('/gsd-spike --wrap-up'),
        'workflows/spike.md must reference /gsd-spike --wrap-up as the canonical wrap-up command'
      );
    });
  });
});
