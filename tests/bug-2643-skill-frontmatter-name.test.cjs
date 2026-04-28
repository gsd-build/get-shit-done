'use strict';

process.env.GSD_TEST_MODE = '1';

/**
 * Bug #2643 / #2808: skill frontmatter name parity.
 *
 * Original (#2643): workflows emitted Skill(skill="gsd:<cmd>") and the
 * installer registered colon form in SKILL.md name: to match.
 *
 * Updated (#2808): workflows now use Skill(skill="gsd-<cmd>") (hyphen),
 * and the installer emits name: gsd-<cmd> (hyphen). Claude Code autocomplete
 * now shows the canonical hyphen form instead of the deprecated colon form.
 * The directory name (gsd-<cmd>) is unchanged.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const {
  convertClaudeCommandToClaudeSkill,
  skillFrontmatterName,
} = require(path.join(ROOT, 'bin', 'install.js'));

const WORKFLOWS_DIR = path.join(ROOT, 'get-shit-done', 'workflows');
const COMMANDS_DIR = path.join(ROOT, 'commands', 'gsd');

function collectFiles(dir, results) {
  if (!results) results = [];
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return results; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) collectFiles(full, results);
    else if (e.name.endsWith('.md')) results.push(full);
  }
  return results;
}

function extractSkillNamesHyphen(content) {
  const names = new Set();
  const rx = /Skill\(skill=['"]gsd-([a-z0-9-]+)['"]/gi;
  let m;
  while ((m = rx.exec(content)) !== null) names.add('gsd-' + m[1]);
  return names;
}

function extractSkillNamesColon(content) {
  const names = new Set();
  const rx = /Skill\(skill=['"]gsd:([a-z0-9-]+)['"]/gi;
  let m;
  while ((m = rx.exec(content)) !== null) names.add('gsd:' + m[1]);
  return names;
}

describe('skill frontmatter name parity (#2643 / #2808)', () => {
  test('skillFrontmatterName helper emits hyphen form (#2808)', () => {
    assert.strictEqual(typeof skillFrontmatterName, 'function');
    assert.strictEqual(skillFrontmatterName('gsd-execute-phase'), 'gsd-execute-phase');
    assert.strictEqual(skillFrontmatterName('gsd-plan-phase'), 'gsd-plan-phase');
    assert.strictEqual(skillFrontmatterName('gsd-next'), 'gsd-next');
  });

  test('convertClaudeCommandToClaudeSkill emits name: gsd-<cmd> (hyphen)', () => {
    const input = '---\nname: old\ndescription: test\n---\n\nBody.';
    const result = convertClaudeCommandToClaudeSkill(input, 'gsd-execute-phase');
    // Parse the frontmatter block structurally: extract the name: field value.
    const frontmatterMatch = result.match(/^---\n([\s\S]*?)\n---/);
    assert.ok(frontmatterMatch, 'output must have a frontmatter block delimited by ---');
    const frontmatterLines = frontmatterMatch[1].split('\n');
    const nameEntry = frontmatterLines.find((l) => l.startsWith('name:'));
    assert.ok(nameEntry, 'frontmatter must contain a name: field');
    const nameValue = nameEntry.replace(/^name:\s*/, '').trim();
    assert.strictEqual(
      nameValue,
      'gsd-execute-phase',
      `frontmatter name: must be 'gsd-execute-phase' (hyphen form), got '${nameValue}'`
    );
  });

  test('no workflow uses deprecated Skill(skill="gsd:<cmd>") colon form', () => {
    const workflowFiles = collectFiles(WORKFLOWS_DIR);
    const colonRefs = [];
    for (const f of workflowFiles) {
      const src = fs.readFileSync(f, 'utf-8');
      for (const n of extractSkillNamesColon(src)) {
        colonRefs.push(path.basename(f) + ': ' + n);
      }
    }
    assert.deepStrictEqual(
      colonRefs,
      [],
      'deprecated colon-form Skill() calls found (update to hyphen): ' + colonRefs.join(', ')
    );
  });

  test('every workflow Skill(skill="gsd-<cmd>") resolves to an emitted skill name', () => {
    const workflowFiles = collectFiles(WORKFLOWS_DIR);
    const referenced = new Set();
    for (const f of workflowFiles) {
      const src = fs.readFileSync(f, 'utf-8');
      for (const n of extractSkillNamesHyphen(src)) referenced.add(n);
    }
    assert.ok(
      referenced.size > 0,
      `expected at least one Skill(skill="gsd-<cmd>") reference in workflows under ${WORKFLOWS_DIR}`
    );

    const emitted = new Set();
    const cmdFiles = fs.readdirSync(COMMANDS_DIR).filter(f => f.endsWith('.md'));
    for (const cmd of cmdFiles) {
      const base = cmd.replace(/\.md$/, '');
      const skillDirName = 'gsd-' + base;
      const src = fs.readFileSync(path.join(COMMANDS_DIR, cmd), 'utf-8');
      const out = convertClaudeCommandToClaudeSkill(src, skillDirName);
      const m = out.match(/^---\nname:\s*(.+)$/m);
      if (m) emitted.add(m[1].trim());
    }

    const missing = [];
    for (const r of referenced) if (!emitted.has(r)) missing.push(r);
    assert.deepStrictEqual(
      missing,
      [],
      'workflow refs not emitted as skill names: ' + missing.join(', '),
    );
  });
});
