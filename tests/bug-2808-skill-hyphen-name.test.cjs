// allow-test-rule: source-text-is-the-product
// Reads .md/.json/.yml product files whose deployed text IS what the
// runtime loads — testing text content tests the deployed contract.

/**
 * Regression test for bug #2808
 *
 * All 85 GSD SKILL.md files declared `name: gsd:<cmd>` (colon), the deprecated
 * form. Claude Code surfaces the `name:` frontmatter field in autocomplete, so
 * users saw `/gsd:add-phase` suggestions instead of the canonical `/gsd-add-phase`.
 *
 * Root cause: skillFrontmatterName() in bin/install.js converted hyphenated
 * skill dir names to colon form (gsd-add-phase → gsd:add-phase) because
 * workflows called Skill(skill="gsd:<cmd>"). That was the original fix for
 * #2643. Since then, workflows have been updated to use hyphen form (#2808).
 *
 * Fix: skillFrontmatterName() now returns the hyphen form unchanged.
 * Workflow Skill() colon calls are updated to hyphen.
 *
 * This test verifies:
 * 1. skillFrontmatterName returns hyphen form (not colon).
 * 2. Installed SKILL.md would emit name: gsd-<cmd> (not gsd:<cmd>).
 * 3. No workflow contains a Skill(skill="gsd:<cmd>") colon call.
 */

'use strict';

process.env.GSD_TEST_MODE = '1';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { cleanup, createTempDir } = require('./helpers.cjs');

const ROOT = path.join(__dirname, '..');
const { convertClaudeCommandToClaudeSkill, copyCommandsAsClaudeSkills, skillFrontmatterName } =
  require(path.join(ROOT, 'bin', 'install.js'));

const WORKFLOWS_DIR = path.join(ROOT, 'get-shit-done', 'workflows');
const COMMANDS_DIR = path.join(ROOT, 'commands', 'gsd');

function walkMd(dir) {
  const files = [];
  try {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) files.push(...walkMd(full));
      else if (e.name.endsWith('.md')) files.push(full);
    }
  } catch (err) {
    assert.fail(`failed to read markdown files from ${dir}: ${err.message}`);
  }
  return files;
}

describe('bug-2808: SKILL.md name: uses hyphen form', () => {
  test('skillFrontmatterName returns hyphen form (not colon)', () => {
    assert.strictEqual(skillFrontmatterName('gsd-add-phase'), 'gsd-add-phase');
    assert.strictEqual(skillFrontmatterName('gsd-plan-phase'), 'gsd-plan-phase');
    assert.strictEqual(skillFrontmatterName('gsd-autonomous'), 'gsd-autonomous');
  });

  test('generated SKILL.md contains name: gsd-<cmd> (not gsd:<cmd>)', () => {
    const cmdFiles = fs.readdirSync(COMMANDS_DIR).filter(f => f.endsWith('.md'));
    assert.ok(cmdFiles.length > 0, 'expected GSD command files');

    for (const cmd of cmdFiles) {
      const base = cmd.replace(/\.md$/, '');
      const skillDirName = 'gsd-' + base;
      const src = fs.readFileSync(path.join(COMMANDS_DIR, cmd), 'utf-8');
      const skillContent = convertClaudeCommandToClaudeSkill(src, skillDirName);

      // Parse frontmatter structurally: extract name: line from the --- block.
      const fmMatch = skillContent.match(/^---\n([\s\S]*?)\n---/);
      assert.ok(fmMatch, `${cmd}: generated skill content must have a frontmatter block`);
      const fmLines = fmMatch[1].split('\n');
      const nameEntry = fmLines.find((l) => l.startsWith('name:'));
      assert.ok(nameEntry, `${cmd}: generated SKILL.md is missing required name: field`);

      const name = nameEntry.replace(/^name:\s*/, '').trim();
      assert.ok(
        !name.includes(':'),
        `${cmd}: SKILL.md name should be hyphen form, got "${name}"`
      );
      assert.ok(
        name.startsWith('gsd-'),
        `${cmd}: SKILL.md name should start with gsd-, got "${name}"`
      );

      // #3583 regression guard: the *body* must not leak retired colon-form
      // command references (e.g. /gsd:plan-phase or gsd:review). The converter
      // now uses transformContentToHyphen from the shared transformer.
      //
      // We explicitly scope to the body (after stripping the leading frontmatter
      // block) so that descriptions or other frontmatter fields containing example
      // gsd: references do not cause spurious failures.
      //
      // gsd:sdk and gsd:tools are intentionally excluded: they are not slash commands
      // (no commands/gsd/sdk.md or tools.md exist), so the transformer correctly leaves
      // them alone. They are benign and should not trigger this assertion.
      const bodyContent = skillContent.replace(/^---\n[\s\S]*?\n---\n?/, '');
      const colonRefs = (bodyContent.match(/\bgsd:[a-z][a-z0-9-]*\b/g) || [])
        .filter(r => !/gsd:(sdk|tools)/.test(r));
      assert.strictEqual(
        colonRefs.length, 0,
        `${cmd}: generated SKILL.md body must not contain gsd: command references (found: ${colonRefs.join(', ')})`
      );
    }
  });

  test('no workflow contains Skill(skill="gsd:<cmd>") colon form', () => {
    const workflowFiles = walkMd(WORKFLOWS_DIR);
    assert.ok(
      workflowFiles.length > 0,
      `expected workflow markdown files under ${WORKFLOWS_DIR}`
    );
    const colonCalls = [];
    for (const f of workflowFiles) {
      const src = fs.readFileSync(f, 'utf-8');
      // Strip HTML comments to avoid matching commented-out examples.
      const stripped = src.replace(/<!--[\s\S]*?-->/g, '');
      // Scan each line for Skill() calls using the colon form.
      // Parsing line-by-line is more precise than a multi-line regex
      // and avoids false positives from incidental matches in prose.
      for (const line of stripped.split('\n')) {
        // Tolerate whitespace around the parenthesis, the `skill` keyword,
        // and the `=` so variants like `Skill( skill = "gsd:foo" )` are still
        // flagged. Without the `\s*` allowances, drift slips through this guard.
        //
        // The local-name capture must be permissive (`[^'"\s)]+`, not
        // `[a-z0-9-]+`) — the whole purpose of this guard is to surface
        // *malformed* drift, including legacy underscore-form names like
        // `gsd:extract_learnings`. A character-class that excludes the very
        // characters we need to flag would silently let drift through.
        const colonCallRe = /Skill\(\s*skill\s*=\s*\\?['"]gsd:([^'"\s)]+)\\?['"]/gi;
        let m;
        while ((m = colonCallRe.exec(line)) !== null) {
          colonCalls.push(`${path.basename(f)}: Skill(skill="gsd:${m[1]}")`);
        }
      }
    }
    assert.deepStrictEqual(
      colonCalls,
      [],
      'deprecated colon-form Skill() calls found — update to gsd-<cmd>: ' + colonCalls.join(', ')
    );
  });

  test('generated autocomplete skill surface uses hyphen names without underscores', (t) => {
    const tmp = createTempDir('gsd-autocomplete-surface-');
    t.after(() => cleanup(tmp));
    const skillsDir = path.join(tmp, 'skills');
    copyCommandsAsClaudeSkills(COMMANDS_DIR, skillsDir, 'gsd', '$HOME/.claude/', 'claude', true);

    // Don't filter the directory listing by `startsWith('gsd-')` — that
    // would silently hide exactly the kind of drift this test exists to
    // catch (a `gsd:extract-learnings` colon variant or a bare
    // `extract-learnings` without the namespace prefix would never be
    // collected, and the loop below would never see them). Capture every
    // generated directory and assert the namespace invariants explicitly.
    const skillDirs = fs.readdirSync(skillsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();

    assert.ok(skillDirs.length > 0, 'expected generated skill directories under skillsDir');
    for (const dir of skillDirs) {
      assert.ok(
        dir.startsWith('gsd-'),
        `${dir}: generated skill directory must start with the canonical 'gsd-' namespace`,
      );
      assert.ok(
        !dir.includes(':'),
        `${dir}: generated skill directory must not contain the retired colon namespace separator`,
      );
      assert.ok(
        !dir.includes('_'),
        `${dir}: generated skill directory must use hyphens, not underscores`,
      );
    }

    assert.ok(skillDirs.includes('gsd-extract-learnings'), 'autocomplete surface must include gsd-extract-learnings');
    assert.ok(!skillDirs.includes('gsd-extract_learnings'), 'autocomplete surface must not include gsd-extract_learnings');

    for (const skillDir of skillDirs) {
      const skillContent = fs.readFileSync(path.join(skillsDir, skillDir, 'SKILL.md'), 'utf-8');
      // Scope the name: lookup to the YAML frontmatter block so a stray
      // `name:` line in the body cannot satisfy the assertion.
      const fmMatch = skillContent.match(/^---\n([\s\S]*?)\n---/);
      assert.ok(fmMatch, `${skillDir}: generated SKILL.md must include frontmatter`);
      const nameLine = fmMatch[1].split('\n').find((l) => /^name:\s*/.test(l));
      assert.ok(nameLine, `${skillDir}: generated SKILL.md is missing name: frontmatter`);
      const name = nameLine.replace(/^name:\s*/, '').trim();
      assert.ok(name.startsWith('gsd-'), `${skillDir}: autocomplete name must start with gsd-, got ${name}`);
      assert.ok(!name.includes(':'), `${skillDir}: autocomplete name must not contain colon, got ${name}`);
      assert.ok(!name.includes('_'), `${skillDir}: autocomplete name must not contain underscore, got ${name}`);
    }
  });

  test('transformContentToHyphen (from fix-slash-commands.cjs) rewrites colon to hyphen for known commands', () => {
    const transformer = require(path.join(ROOT, 'scripts', 'fix-slash-commands.cjs'));
    const { transformContentToHyphen, readCmdNames } = transformer;
    const liveCmdNames = readCmdNames();

    const input = 'Run /gsd:plan-phase then gsd:execute-phase. Also see /gsd:review and gsd-sdk query.';
    const out = transformContentToHyphen(input, liveCmdNames);

    assert.ok(out.includes('/gsd-plan-phase'), 'leading-/ colon form must become hyphen');
    assert.ok(out.includes('gsd-execute-phase'), 'bare colon form must become hyphen');
    assert.ok(out.includes('/gsd-review'), 'another command reference must be rewritten');
    assert.ok(out.includes('gsd-sdk'), 'non-command gsd-sdk must be left untouched');
    assert.ok(!out.match(/\bgsd:[a-z]/), 'no colon-form command reference may survive');
  });

  test('respects word boundary — does not rewrite gsd:plan-phase-extra (partial match guard)', () => {
    const transformer = require(path.join(ROOT, 'scripts', 'fix-slash-commands.cjs'));
    const { transformContentToHyphen, readCmdNames } = transformer;
    const liveCmdNames = readCmdNames();

    const out = transformContentToHyphen('gsd:plan-phase-extra and /gsd:execute-phase-extra', liveCmdNames);
    assert.strictEqual(out, 'gsd:plan-phase-extra and /gsd:execute-phase-extra',
      'word-boundary lookahead must prevent partial matches on the reverse transform');
  });

  test('respects left word boundary — does not rewrite inside larger tokens (e.g. mygsd:cmd)', () => {
    const transformer = require(path.join(ROOT, 'scripts', 'fix-slash-commands.cjs'));
    const { transformContentToHyphen, readCmdNames } = transformer;
    const liveCmdNames = readCmdNames();

    const input = 'See mygsd:plan-phase or prefix-gsd:execute in the docs.';
    const out = transformContentToHyphen(input, liveCmdNames);
    assert.strictEqual(out, input, 'negative lookbehind must prevent left-side in-word matches');
  });

  test('leaves already-hyphen-form references untouched (idempotent on output)', () => {
    const transformer = require(path.join(ROOT, 'scripts', 'fix-slash-commands.cjs'));
    const { transformContentToHyphen, readCmdNames } = transformer;
    const liveCmdNames = readCmdNames();

    const input = 'Run gsd-plan-phase and /gsd-execute-phase then gsd:review.'; // mixed, only colon should change
    const out = transformContentToHyphen(input, liveCmdNames);
    assert.ok(out.includes('gsd-plan-phase'), 'pre-existing hyphen stays');
    assert.ok(out.includes('/gsd-execute-phase'), 'pre-existing hyphen stays');
    assert.ok(out.includes('gsd-review'), 'colon form was normalized');
    assert.ok(!out.includes('gsd:review'), 'no colon form remains');
  });
});
