// allow-test-rule: source-text-is-the-product
// The commands/gsd/*.md and get-shit-done/workflows/*.md files are the
// installed agent stubs — their frontmatter and workflow body IS the
// deployed contract. These assertions check structural fields (argument-hint,
// description, early-exit prose) that govern runtime routing.

/**
 * Skill frontmatter contract tests
 *
 * Moved here from bug-3042-3044-research-flag-and-stale-refs.test.cjs
 * during the docs-parity polarity refactor (#3049). The original file
 * mixed two concerns:
 *   (a) docs-parity deny-list checks    → replaced by docs-parity-live-registry.test.cjs
 *   (b) frontmatter-structural checks   → this file
 *
 * These tests assert structural invariants in command-stub frontmatter and
 * workflow prose — they are NOT docs-parity checks. They verify that flags
 * are wired, descriptions are correct, and early-exit prose is present in
 * the right sections. These tests need to remain even after the deny-list
 * tests are removed.
 */

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

function read(rel) {
  let content;
  try {
    content = fs.readFileSync(path.join(ROOT, rel), 'utf-8');
  } catch (err) {
    throw new Error('[skill-frontmatter-contract] failed to read ' + rel + ': ' + err.message);
  }
  return content;
}

function exists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

// ─── #3042: --research-phase flag wired into /gsd-plan-phase ────────────────
// (Moved from bug-3042-3044-research-flag-and-stale-refs.test.cjs)

describe('skill frontmatter: /gsd-plan-phase --research-phase flag absorbs the standalone research command', () => {
  test('commands/gsd/plan-phase.md argument-hint advertises --research-phase', () => {
    const content = read('commands/gsd/plan-phase.md');
    // Frontmatter argument-hint is the structural place users discover
    // the flag. Parse the line that starts with "argument-hint:" and
    // assert the flag token is present.
    const m = content.match(/^argument-hint:\s*"([^"]+)"/m);
    assert.ok(m, 'plan-phase.md must declare an argument-hint frontmatter field');
    assert.ok(
      m[1].includes('--research-phase'),
      'argument-hint must include "--research-phase"; got: ' + m[1]
    );
  });

  test('plan-phase.md frontmatter description still advertises plan capability (no semantics drift)', () => {
    const content = read('commands/gsd/plan-phase.md');
    const m = content.match(/^description:\s*(.+)$/m);
    assert.ok(m, 'plan-phase.md must have a description field');
    // The description should still describe planning — the flag is
    // additive, not a renamed command.
    assert.ok(
      /plan/i.test(m[1]),
      'description should still mention planning; got: ' + m[1]
    );
  });

  test('workflows/plan-phase.md parses --research-phase and sets a research-only mode', () => {
    const content = read('get-shit-done/workflows/plan-phase.md');
    // The arg-parsing section of the workflow must mention the new flag
    // by name. This is the structural seam the LLM follows.
    // Anchored to the argument/flags section to avoid false positives from prose.
    const argsIdx = content.search(/(?:argument|args?|flags?)\b/i);
    assert.ok(argsIdx >= 0, 'plan-phase workflow must contain an argument/flags section');
    const argsWindow = content.slice(argsIdx, argsIdx + 1200);
    assert.ok(
      /--research-phase/.test(argsWindow),
      'plan-phase.md workflow must reference --research-phase in the argument-parsing section (within 1200 chars of the args/flags header)'
    );
  });

  test('workflows/plan-phase.md skips planner/verifier when in research-only mode', () => {
    const content = read('get-shit-done/workflows/plan-phase.md');
    // Look for explicit early-exit prose so the LLM knows to stop after
    // research. We accept any of: "research-only", "research only mode",
    // "skip if --research-phase", "RESEARCH_ONLY", "exit after research".
    const patterns = [
      /research[ -]only/i,
      /RESEARCH_ONLY/,
      /skip if[^\n]*--research-phase/i,
      /exit (?:after|when)[^\n]*research/i,
    ];
    const hits = patterns.filter((re) => re.test(content));
    assert.ok(
      hits.length > 0,
      'plan-phase workflow must contain explicit early-exit prose for --research-phase mode; ' +
        'none of [research-only, RESEARCH_ONLY, "skip if --research-phase", "exit after research"] matched'
    );
  });

  test('orphaned workflows/research-phase.md is removed', () => {
    assert.equal(
      exists('get-shit-done/workflows/research-phase.md'),
      false,
      'workflows/research-phase.md must be removed; the capability now lives on /gsd-plan-phase --research-phase'
    );
  });

  test('argument-hint advertises --view as a research-only modifier', () => {
    const content = read('commands/gsd/plan-phase.md');
    const m = content.match(/^argument-hint:\s*"([^"]+)"/m);
    assert.ok(m, 'plan-phase.md must declare an argument-hint frontmatter field');
    assert.ok(
      m[1].includes('--view'),
      'argument-hint must include --view (research-only view-only mode); got: ' + m[1]
    );
  });

  test('workflow handles --view by printing existing RESEARCH.md without spawning', () => {
    const content = read('get-shit-done/workflows/plan-phase.md');
    // The workflow must reference the --view flag as a no-spawn mode
    // for research-only invocations. We accept any of: "view-only",
    // "VIEW_ONLY", "skip if --view", "no spawn" alongside --view.
    assert.ok(
      /--view/.test(content),
      'plan-phase workflow must reference the --view flag'
    );
    const viewModePatterns = [
      /view[ -]only/i,
      /VIEW_ONLY/,
      /no[ -]spawn/i,
      /print[^\n]*RESEARCH\.md/i,
      /display[^\n]*RESEARCH\.md/i,
    ];
    const hits = viewModePatterns.filter((re) => re.test(content));
    assert.ok(
      hits.length > 0,
      'plan-phase workflow must explain that --view prints existing RESEARCH.md without spawning; ' +
        'expected one of [view-only, VIEW_ONLY, no-spawn, "print/display RESEARCH.md"]'
    );
  });

  test('workflow uses --research as the force-refresh signal in research-only mode', () => {
    const content = read('get-shit-done/workflows/plan-phase.md');
    // The plan-phase workflow already had a --research flag with
    // "force re-research" semantics. In research-only mode, that flag
    // must short-circuit the "RESEARCH.md exists, what do you want to
    // do?" prompt and unconditionally re-spawn. Assert the workflow
    // documents the combined semantics.
    // Find the --research-phase description section (headed by the ** marker),
    // then assert that --research and force/refresh semantics are documented
    // within the same section — verifying the COMBINATION is documented.
    // The section header starts at "**`--research-phase <N>`" and runs ~1200
    // chars to cover the modifiers sub-list (--research and --view bullets).
    const sectionIdx = content.indexOf('**`--research-phase');
    assert.ok(sectionIdx >= 0, 'plan-phase workflow must contain a --research-phase description section');
    const sectionWindow = content.slice(sectionIdx, sectionIdx + 1200);
    const hasResearch = /--research\b/.test(sectionWindow);
    const hasForceRefresh = /(?:force[ -]?refresh|re-research|re-spawn|overwrites)/i.test(sectionWindow);
    assert.ok(
      hasResearch && hasForceRefresh,
      'plan-phase workflow must document that --research forces re-research when used with --research-phase ' +
        '(expected --research and force/refresh prose in the --research-phase section; got hasResearch=' +
        hasResearch + ' hasForceRefresh=' + hasForceRefresh + ')'
    );
  });

  test('workflow has an existing-RESEARCH.md prompt path (update/view/skip) within proximity', () => {
    const content = read('get-shit-done/workflows/plan-phase.md');
    // CR #3045 finding: the previous version of this test asserted
    // `update`, `view`, `skip` appeared anywhere in the file, which was
    // tautological — those words occur all over the workflow for
    // unrelated reasons (--skip-research, --view flag declarations,
    // etc.). Tighten to a proximity check: all three choice tokens
    // must occur in a window of ~400 chars surrounding "RESEARCH.md
    // already exists" / "Update — re-spawn" / equivalent prompt prose,
    // proving the prompt section is genuinely present.
    const idx = content.indexOf('RESEARCH.md already exists');
    assert.ok(
      idx >= 0,
      'plan-phase workflow must contain the literal "RESEARCH.md already exists" prompt header in the research-only existing-artifact section'
    );
    const window = content.slice(idx, idx + 600);
    const hasUpdate = /\b(?:update|refresh|re-spawn)\b/i.test(window);
    const hasView = /\bview\b/i.test(window);
    const hasSkip = /\bskip\b/i.test(window);
    assert.ok(
      hasUpdate && hasView && hasSkip,
      'prompt section near "RESEARCH.md already exists" must mention all three choices (update/refresh/re-spawn, view, skip); ' +
        'got update=' + hasUpdate + ' view=' + hasView + ' skip=' + hasSkip
    );
  });
});
