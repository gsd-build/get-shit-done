'use strict';

// allow-test-rule: structural-regression-guard

/**
 * Slash-command namespace invariant (#2543, updated by #2697).
 *
 * History:
 *   #2543 switched user-facing references from /gsd-<cmd> (dash) to /gsd:<cmd> (colon)
 *   because Claude Code's skill frontmatter used `name: gsd:<cmd>`.
 *   #2697 reversed this: Claude Code slash commands are invoked by skill *directory*
 *   name (gsd-<cmd>), not frontmatter name. The colon form (/gsd:<cmd>) does not work
 *   as a user-typed slash command. Other environment installers (OpenCode, Copilot,
 *   Antigravity) already transform gsd: → gsd- at install time, so changing the source
 *   to use gsd- makes all environments consistent.
 *
 * Invariant enforced here:
 *   No `/gsd:<cmd>` pattern in user-facing source text.
 *   `Skill(skill="gsd:<cmd>")` calls are checked by the skill frontmatter
 *   parity tests and should use `Skill(skill="gsd-<cmd>")`.
 *
 * Exceptions:
 *   - CHANGELOG.md: historical entries document commands under their original names.
 *   - gsd-sdk / gsd-tools identifiers: never rewritten (not slash commands).
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const COMMANDS_DIR = path.join(ROOT, 'commands', 'gsd');

const SEARCH_DIRS = [
  path.join(ROOT, 'get-shit-done', 'bin', 'lib'),
  path.join(ROOT, 'get-shit-done', 'workflows'),
  path.join(ROOT, 'get-shit-done', 'references'),
  path.join(ROOT, 'get-shit-done', 'templates'),
  path.join(ROOT, 'get-shit-done', 'contexts'),
  COMMANDS_DIR,
  path.join(ROOT, 'agents'),
  path.join(ROOT, 'sdk', 'src'),
];

const TOP_LEVEL_FILES = [
  path.join(ROOT, '.clinerules'),
];

// Re-use SKIP_DIRS from the production script so the test's directory walker
// stays in lockstep with the fixer's. EXTENSIONS legitimately diverges (the
// guard scans only `.md`/`.cjs`/`.js` per the no-source-grep standard, while
// the fixer also rewrites `.ts`/`.tsx`), so it is not shared.
const { SKIP_DIRS } = require(path.join(ROOT, 'scripts', 'fix-slash-commands.cjs'));

// Discover user-facing markdown surfaces dynamically so a freshly added
// doc (a new RELEASE-*.md, a new top-level guide) is automatically scanned
// for namespace drift. A hand-curated list silently weakens drift detection
// over time — every time a doc is added, someone has to remember to extend
// the list, and the failure mode is invisible: the test passes but doesn't
// actually inspect the new file. We scan every .md under docs/ plus
// README.md at the repo root.
function discoverDocSearchFiles(root) {
  const out = [];
  const readme = path.join(root, 'README.md');
  if (fs.existsSync(readme)) out.push(readme);
  // Walk docs/ recursively. Localized translation trees (docs/ja-JP/,
  // docs/zh-CN/, docs/ko-KR/, docs/pt-BR/) and nested doc collections
  // (docs/skills/, docs/superpowers/) all carry user-facing markdown that
  // can drift; a top-level-only scan would silently exclude them. Iterative
  // stack walk avoids recursion limits on deep trees.
  const stack = [path.join(root, 'docs')];
  while (stack.length > 0) {
    const dir = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        out.push(full);
      }
    }
  }
  return out.sort();
}

const DOC_SEARCH_FILES = discoverDocSearchFiles(ROOT);

// Limited to .md (and pre-existing .cjs/.js) by the no-source-grep standard:
// markdown text IS the deployed product, but .ts/.tsx source must be guarded
// via runtime behavior. The fixer (scripts/fix-slash-commands.cjs) covers
// .ts/.tsx auto-rewrites at build time; idempotency (a no-op second run) is
// the runtime guard for those extensions.
const EXTENSIONS = new Set(['.md', '.cjs', '.js']);

function collectFiles(dir, results = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return results; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      collectFiles(full, results);
    }
    else if (EXTENSIONS.has(path.extname(e.name))) results.push(full);
  }
  return results;
}

const cmdNames = fs.readdirSync(COMMANDS_DIR)
  .filter(f => f.endsWith('.md'))
  .map(f => f.replace(/\.md$/, ''))
  .sort((a, b) => b.length - a.length);

// Matches /gsd:<cmd> — the retired user-facing format.
// Does NOT match Skill(skill="gsd:<cmd>") because those have no leading slash.
const retiredPattern = new RegExp(`/gsd:(${cmdNames.join('|')})(?=[^a-zA-Z0-9_-]|$)`);

const allFiles = SEARCH_DIRS.flatMap(d => collectFiles(d));
const topLevelFiles = TOP_LEVEL_FILES.filter((file) => fs.existsSync(file));
const allUserFacingFiles = allFiles
  .concat(topLevelFiles)
  .concat(DOC_SEARCH_FILES.filter((file) => fs.existsSync(file)));

describe('slash-command namespace invariant (#2697)', () => {
  test('commands/gsd/ directory contains known command files', () => {
    assert.ok(cmdNames.length > 0, 'commands/gsd/ must contain .md files');
    assert.ok(cmdNames.includes('plan-phase'), 'plan-phase must be a known command');
    assert.ok(cmdNames.includes('execute-phase'), 'execute-phase must be a known command');
  });

  test('no /gsd:<cmd> retired syntax in user-facing source files', () => {
    const violations = [];
    for (const file of allUserFacingFiles) {
      const src = fs.readFileSync(file, 'utf-8');
      const lines = src.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (retiredPattern.test(lines[i])) {
          violations.push(`${path.relative(ROOT, file)}:${i + 1}: ${lines[i].trim().slice(0, 80)}`);
        }
      }
    }
    assert.strictEqual(
      violations.length,
      0,
      `Found ${violations.length} retired /gsd:<cmd> reference(s) — use /gsd-<cmd> instead:\n${violations.slice(0, 10).join('\n')}`,
    );
  });

  test('command filenames use canonical hyphenated command slugs', () => {
    const underscoreFiles = fs.readdirSync(COMMANDS_DIR)
      .filter((f) => f.endsWith('.md') && f.includes('_'));
    assert.deepStrictEqual(
      underscoreFiles,
      [],
      'command filenames feed generated skill/autocomplete names and must not contain underscores',
    );
  });

  describe('fix-slash-commands transformer behavior', () => {
    const { transformContent } = require(path.join(ROOT, 'scripts', 'fix-slash-commands.cjs'));
    // Use the live command names so the transformer matches the same surface
    // the production CLI rewrites.
    const liveCmdNames = cmdNames;

    test('rewrites /gsd:<cmd> to /gsd-<cmd>', () => {
      const out = transformContent('See /gsd:plan-phase for details.', liveCmdNames);
      assert.ok(out.includes('/gsd-plan-phase'), `expected /gsd-plan-phase, got: ${out}`);
      assert.ok(!out.includes('/gsd:plan-phase'), `colon form must not survive, got: ${out}`);
    });

    test('rewrites multiple occurrences in one pass', () => {
      const out = transformContent('Run /gsd:plan-phase then /gsd:execute-phase.', liveCmdNames);
      assert.ok(out.includes('/gsd-plan-phase'));
      assert.ok(out.includes('/gsd-execute-phase'));
      assert.ok(!out.match(/\/gsd:[a-z]/), `no colon form may remain, got: ${out}`);
    });

    test('does not rewrite canonical hyphen form (idempotent)', () => {
      const input = '/gsd-plan-phase is the canonical name.';
      assert.strictEqual(transformContent(input, liveCmdNames), input,
        'transformer must be a no-op when input is already canonical');
    });

    test('does not rewrite gsd-sdk or gsd-tools (not slash commands)', () => {
      // Edge case: even though sdk/tools aren't in cmdNames, defensively check
      // that strings like "/gsd:sdk" pass through untouched.
      const input = 'Run /gsd:sdk query and /gsd:tools init.';
      assert.strictEqual(transformContent(input, liveCmdNames), input,
        'transformer must leave non-command identifiers alone');
    });

    test('respects word boundary — does not rewrite /gsd:plan-phase-extra', () => {
      // The trailing -extra means this is NOT the plan-phase command.
      // The negative lookahead `[^a-zA-Z0-9_-]|$` should prevent the match.
      const out = transformContent('/gsd:plan-phase-extra', liveCmdNames);
      assert.strictEqual(out, '/gsd:plan-phase-extra',
        'word-boundary lookahead must prevent partial matches');
    });
  });

  test('gsd-sdk and gsd-tools identifiers are not rewritten', () => {
    for (const file of allUserFacingFiles) {
      const src = fs.readFileSync(file, 'utf-8');
      assert.ok(
        !src.includes('/gsd:sdk'),
        `${path.relative(ROOT, file)} must not contain /gsd:sdk (gsd-sdk is not a slash command)`,
      );
      assert.ok(
        !src.includes('/gsd:tools'),
        `${path.relative(ROOT, file)} must not contain /gsd:tools (gsd-tools is not a slash command)`,
      );
    }
  });
});
