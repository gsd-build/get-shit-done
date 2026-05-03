// allow-test-rule: prose-driven workflow files. The .includes() / regex
// hits below build a typed record of (a) presence of slash-command tokens
// in the parsed argument-hint frontmatter, (b) the literal flag tokens
// the workflow's bash parsing block consults, and (c) absence of deleted
// slash-command tokens across user-facing surfaces. These workflow files
// ARE the implementation — there is no "real" code seam to assert against.
// The IR-build hits are not the assertion surface; assertions run on the
// resulting boolean / Set membership.

/**
 * Bug #3042 + #3044: research-only flag for /gsd-plan-phase + scrub of
 * 4 stale slash-command references across user-facing surfaces.
 *
 * #3042 (orphaned research-phase): the slash command /gsd-research-phase
 *   never had a stub registered. Per the maintainer decision, the
 *   capability moves to a flag on /gsd-plan-phase rather than restoring
 *   a separate command. Invocation:
 *
 *       /gsd-plan-phase --research-phase <N>
 *
 *   When --research-phase is present, plan-phase scopes to phase N,
 *   runs only the research step, and exits before spawning the planner /
 *   plan-checker / verifier chain.
 *
 * #3044 (stale slash-command refs in user-facing docs): four commands
 *   appear in workflow / template / doc surfaces without being
 *   registered:
 *
 *     /gsd-check-todos             →  /gsd-capture --list
 *     /gsd-new-workspace           →  /gsd-workspace --new
 *     /gsd-plan-milestone-gaps     →  inline gap planning (#3038 partial scrub)
 *     /gsd-status                  →  /gsd-progress
 *     /gsd-research-phase          →  /gsd-plan-phase --research-phase
 *
 * Tests assert (a) the flag is wired, (b) every deleted/never-registered
 * slash-command token is absent from user-facing surfaces, (c) the
 * orphaned workflows/research-phase.md is removed.
 */

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf-8');
}
function exists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

// ─── Slash-command token extractor (typed-IR helper) ────────────────────────

/**
 * Returns the Set<string> of `/gsd-*` slash-command tokens emitted by a
 * markdown surface. Strips trailing arg tokens so the identity is the
 * command name only.
 */
function extractSlashCommandTokens(content) {
  const re = /\/gsd-[a-z0-9][a-z0-9-]*/g;
  return new Set(content.match(re) || []);
}

// ─── #3042: --research-phase flag wired into /gsd-plan-phase ────────────────

describe('bug #3042: /gsd-plan-phase --research-phase flag absorbs the standalone research command', () => {
  test('commands/gsd/plan-phase.md argument-hint advertises --research-phase', () => {
    const content = read('commands/gsd/plan-phase.md');
    // Frontmatter argument-hint is the structural place users discover
    // the flag. Parse the line that starts with "argument-hint:" and
    // assert the flag token is present.
    const m = content.match(/^argument-hint:\s*"([^"]+)"/m);
    assert.ok(m, 'plan-phase.md must declare an argument-hint frontmatter field');
    assert.ok(
      m[1].includes('--research-phase'),
      `argument-hint must include "--research-phase"; got: ${m[1]}`
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
      `description should still mention planning; got: ${m[1]}`
    );
  });

  test('workflows/plan-phase.md parses --research-phase and sets a research-only mode', () => {
    const content = read('get-shit-done/workflows/plan-phase.md');
    // The arg-parsing section of the workflow must mention the new flag
    // by name. This is the structural seam the LLM follows.
    assert.ok(
      content.includes('--research-phase'),
      'plan-phase.md workflow must reference the --research-phase flag in its argument-parsing section'
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
      `plan-phase workflow must contain explicit early-exit prose for --research-phase mode; ` +
        `none of [research-only, RESEARCH_ONLY, "skip if --research-phase", "exit after research"] matched`
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
      `argument-hint must include --view (research-only view-only mode); got: ${m[1]}`
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
      `plan-phase workflow must explain that --view prints existing RESEARCH.md without spawning; ` +
        `expected one of [view-only, VIEW_ONLY, no-spawn, "print/display RESEARCH.md"]`
    );
  });

  test('workflow uses --research as the force-refresh signal in research-only mode', () => {
    const content = read('get-shit-done/workflows/plan-phase.md');
    // The plan-phase workflow already had a --research flag with
    // "force re-research" semantics. In research-only mode, that flag
    // must short-circuit the "RESEARCH.md exists, what do you want to
    // do?" prompt and unconditionally re-spawn. Assert the workflow
    // documents the combined semantics.
    const forceRefreshPatterns = [
      /--research[^\n]*force[^\n]*refresh/i,
      /--research[^\n]*re[ -]?research/i,
      /force[ -]?refresh[^\n]*--research/i,
    ];
    const hits = forceRefreshPatterns.filter((re) => re.test(content));
    assert.ok(
      hits.length > 0,
      `plan-phase workflow must document that --research forces re-research (skip the "exists" prompt) when used with --research-phase`
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
      `prompt section near "RESEARCH.md already exists" must mention all three choices (update/refresh/re-spawn, view, skip); ` +
        `got update=${hasUpdate} view=${hasView} skip=${hasSkip}`
    );
  });
});

// ─── #3044: every deleted slash-command absent from user-facing surfaces ────

const DELETED_COMMANDS = [
  '/gsd-check-todos', // → /gsd-capture --list
  '/gsd-new-workspace', // → /gsd-workspace --new
  '/gsd-status', // → /gsd-progress
  '/gsd-plan-milestone-gaps', // → inline gap planning
  '/gsd-research-phase', // → /gsd-plan-phase --research-phase
];

// Surfaces a user reads, browses, or follows routing prose from. Each
// must not emit any of the deleted slash-command tokens. Localized doc
// sets are included so the rename actually reaches every reader.
const USER_FACING_SURFACES = [
  // Top-level repo
  'README.md',
  // Primary docs
  'docs/USER-GUIDE.md',
  'docs/FEATURES.md',
  'docs/INVENTORY.md',
  'docs/COMMANDS.md',
  'docs/issue-driven-orchestration.md',
  // Workflow surfaces that emit user-typed slash commands
  'get-shit-done/workflows/check-todos.md',
  'get-shit-done/workflows/add-todo.md',
  'get-shit-done/workflows/resume-project.md',
  'get-shit-done/workflows/progress.md',
  'get-shit-done/workflows/code-review.md',
  'get-shit-done/workflows/new-workspace.md',
  'get-shit-done/workflows/list-workspaces.md',
  'get-shit-done/workflows/transition.md',
  'get-shit-done/workflows/discovery-phase.md',
  // Reference + template surfaces
  'get-shit-done/references/continuation-format.md',
  'get-shit-done/templates/state.md',
  'get-shit-done/templates/discovery.md',
  'get-shit-done/templates/README.md',
];

describe('bug #3044: deleted slash-commands scrubbed from user-facing surfaces', () => {
  for (const rel of USER_FACING_SURFACES) {
    test(`${rel}: parsed slash-command token set excludes every deleted command`, () => {
      if (!exists(rel)) {
        // Some surfaces may not exist in every repo state (e.g. when the
        // workflow file is itself removed in this PR). Skip with a
        // structural note rather than a hard failure — the deletion is
        // verified by extractSlashCommandTokens against the surfaces
        // that DO exist.
        return;
      }
      const tokens = extractSlashCommandTokens(read(rel));
      for (const cmd of DELETED_COMMANDS) {
        assert.equal(
          tokens.has(cmd),
          false,
          `${rel}: parsed slash-command token set still contains deleted "${cmd}"`
        );
      }
    });
  }
});

// ─── Localized doc sets must also be scrubbed ───────────────────────────────

const LOCALES = ['ja-JP', 'ko-KR', 'zh-CN', 'pt-BR'];
const LOCALIZED_DOCS = [
  'README.md',
  'USER-GUIDE.md',
  'FEATURES.md',
  'COMMANDS.md',
];

describe('bug #3044: localized doc sets also scrubbed', () => {
  for (const locale of LOCALES) {
    for (const doc of LOCALIZED_DOCS) {
      const rel = path.posix.join('docs', locale, doc);
      test(`${rel}: parsed slash-command token set excludes every deleted command`, () => {
        if (!exists(rel)) return; // some locales may not have every doc
        const tokens = extractSlashCommandTokens(read(rel));
        for (const cmd of DELETED_COMMANDS) {
          assert.equal(
            tokens.has(cmd),
            false,
            `${rel}: parsed slash-command token set still contains deleted "${cmd}"`
          );
        }
      });
    }
  }
});

// ─── Replacement commands are documented ────────────────────────────────────

describe('replacement commands appear where the deleted ones used to live', () => {
  test('docs/issue-driven-orchestration.md uses /gsd-workspace --new (not /gsd-new-workspace)', () => {
    const content = read('docs/issue-driven-orchestration.md');
    const tokens = extractSlashCommandTokens(content);
    assert.equal(
      tokens.has('/gsd-workspace'),
      true,
      'issue-driven-orchestration.md must reference /gsd-workspace as the workspace command'
    );
    // The "--new" flag must appear within 60 chars of /gsd-workspace —
    // proves the flag belongs to that command rather than appearing
    // somewhere unrelated.
    const proximityRe = /\/gsd-workspace[^\n]{0,60}--new/;
    assert.ok(
      proximityRe.test(content),
      'issue-driven-orchestration.md must document the "/gsd-workspace … --new" form'
    );
  });

  test('workflows/code-review.md error path points at /gsd-progress (not /gsd-status)', () => {
    const content = read('get-shit-done/workflows/code-review.md');
    const tokens = extractSlashCommandTokens(content);
    assert.equal(
      tokens.has('/gsd-progress'),
      true,
      'code-review.md error path must route the user at /gsd-progress'
    );
  });
});
