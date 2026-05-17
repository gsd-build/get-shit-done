// allow-test-rule: source-text-is-the-product
// Tests A1/A2/B inspect agent / installed `.md` bodies whose deployed text IS
// the runtime contract. Tests C exercises the install.js exported pure helper
// `shouldNormalizeHyphenNamespaceInAgentBody` directly — purely behavioral.

/**
 * Regression for #3677 — installed agent bodies leak `/gsd:<cmd>` colon refs
 * for Claude / Qwen / Hermes (unroutable since #2808).
 *
 * Root cause: `bin/install.js` agent install loop (around line 8350-8447)
 * reads each agent .md, runs runtime-specific transforms via
 * `convertClaudeAgentToXAgent()`, then writes the result. For:
 *   - Self-converting runtimes (Copilot/Codex/Cursor/Windsurf/Augment/Trae/
 *     Codebuddy/Cline/Antigravity/Opencode/Kilo): their converters handle
 *     namespace themselves.
 *   - Gemini: intentionally uses colon namespace.
 *   - Claude-default / Qwen / Hermes: register hyphen-form `name:` (#2808)
 *     but copy bodies verbatim (Qwen/Hermes do branding-only swaps; Claude
 *     does no namespace work). The retired `/gsd:<cmd>` colon refs leak.
 *
 * Sibling fixes #3583 (SKILL.md, via #3629) and #3584 (runtime emissions, via
 * #3606) covered the other two surfaces. This is the agent-body surface.
 *
 * Fix surface:
 *   1. `bin/install.js` exports a pure predicate
 *      `shouldNormalizeHyphenNamespaceInAgentBody(runtime)` plus a helper
 *      `normalizeAgentBodyForRuntime(content, runtime, cmdNames)` that
 *      conditionally applies `transformContentToHyphen` from
 *      scripts/fix-slash-commands.cjs.
 *   2. The agent install loop calls the helper after all runtime-specific
 *      conversions but before writeFileSync.
 *   3. This regression test guards both the predicate and the integration.
 */

'use strict';

process.env.GSD_TEST_MODE = '1';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

// Single `..` traversal matches the existing tests/helpers.cjs convention
// (TOOLS_PATH at tests/helpers.cjs:21). Avoids `..` chains per CLAUDE.md and
// works in the docker mirror at /work/tests (which has no `.git` to anchor on).
const REPO_ROOT = path.resolve(__dirname, '..');

const install = require(path.join(REPO_ROOT, 'bin', 'install.js'));
const { transformContentToHyphen } = require(path.join(REPO_ROOT, 'scripts', 'fix-slash-commands.cjs'));

// Snapshot of all runtime IDs in the layout table at the time of this fix.
// Keep these two sets covering: any runtime listed in
// runtime-artifact-layout.cjs MUST appear in exactly one bucket.
const HYPHEN_NAME_AGENT_RUNTIMES = ['claude', 'qwen', 'hermes'];
const SELF_CONVERTING_OR_COLON_RUNTIMES = [
  'gemini',     // intentionally colon-namespaced
  'codex', 'copilot', 'antigravity', 'cursor', 'windsurf', 'augment',
  'trae', 'codebuddy', 'cline',
  'opencode', 'kilo',
];

describe('bug #3677 — agent body colon-namespace leak (Claude / Qwen / Hermes)', () => {

  describe('A — install.js exports the pure predicate + helper', () => {
    test('A1: shouldNormalizeHyphenNamespaceInAgentBody is an exported function', () => {
      assert.strictEqual(
        typeof install.shouldNormalizeHyphenNamespaceInAgentBody,
        'function',
        'bin/install.js must export shouldNormalizeHyphenNamespaceInAgentBody as the runtime predicate (regression seam for #3677)',
      );
    });

    test('A2: normalizeAgentBodyForRuntime is an exported function', () => {
      assert.strictEqual(
        typeof install.normalizeAgentBodyForRuntime,
        'function',
        'bin/install.js must export normalizeAgentBodyForRuntime as the wired helper called by the agent install loop',
      );
    });
  });

  describe('B — predicate returns true for hyphen-`name:` runtimes and false otherwise', () => {
    const { shouldNormalizeHyphenNamespaceInAgentBody } = install;

    for (const runtime of HYPHEN_NAME_AGENT_RUNTIMES) {
      test(`B+ '${runtime}': normalize hyphen namespace (true)`, () => {
        assert.strictEqual(
          shouldNormalizeHyphenNamespaceInAgentBody(runtime),
          true,
          `${runtime} registers hyphen-form 'name:' (#2808) and copies agent bodies verbatim — must normalize`,
        );
      });
    }

    for (const runtime of SELF_CONVERTING_OR_COLON_RUNTIMES) {
      test(`B- '${runtime}': skip normalization (false)`, () => {
        assert.strictEqual(
          shouldNormalizeHyphenNamespaceInAgentBody(runtime),
          false,
          `${runtime} either self-converts via convertClaudeAgentToXAgent or intentionally uses colon — must NOT re-rewrite`,
        );
      });
    }

    test('B?: unknown runtime defaults to false (conservative)', () => {
      assert.strictEqual(
        shouldNormalizeHyphenNamespaceInAgentBody('bogus-runtime-id'),
        false,
        'unknown runtimes must not be normalized — better to leak than to mangle',
      );
    });
  });

  describe('C — normalizeAgentBodyForRuntime applies transformContentToHyphen iff predicate is true', () => {
    const { normalizeAgentBodyForRuntime } = install;
    // Sample agent body with colon refs that #2808 retired.
    const inputBody = [
      '# Agent prose',
      '',
      'Run `/gsd:execute-phase 1 --tdd` to execute the phase.',
      'Then `/gsd:verify-work 1` to verify.',
      'Reference unchanged: `gsd-sdk query commit` (this is a CLI binary, not a slash command).',
    ].join('\n');
    // Only known commands from commands/gsd/*.md should be rewritten; gsd-sdk
    // (a binary) must stay untouched.
    const cmdNames = ['execute-phase', 'verify-work', 'plan-phase'];

    test('C1: claude — rewrites both colon refs to hyphen', () => {
      const out = normalizeAgentBodyForRuntime(inputBody, 'claude', cmdNames);
      assert.ok(out.includes('/gsd-execute-phase'), 'execute-phase must be rewritten to hyphen form');
      assert.ok(out.includes('/gsd-verify-work'), 'verify-work must be rewritten to hyphen form');
      assert.ok(!out.includes('/gsd:execute-phase'), 'colon form for execute-phase must be gone');
      assert.ok(!out.includes('/gsd:verify-work'), 'colon form for verify-work must be gone');
      assert.ok(out.includes('gsd-sdk query commit'), 'gsd-sdk (CLI binary) must not be touched');
    });

    test('C2: qwen — same transform applies', () => {
      const out = normalizeAgentBodyForRuntime(inputBody, 'qwen', cmdNames);
      assert.ok(out.includes('/gsd-execute-phase'));
      assert.ok(!out.includes('/gsd:execute-phase'));
    });

    test('C3: hermes — same transform applies', () => {
      const out = normalizeAgentBodyForRuntime(inputBody, 'hermes', cmdNames);
      assert.ok(out.includes('/gsd-execute-phase'));
      assert.ok(!out.includes('/gsd:execute-phase'));
    });

    test('C4: gemini — colon refs preserved (intentional namespace)', () => {
      const out = normalizeAgentBodyForRuntime(inputBody, 'gemini', cmdNames);
      assert.ok(out.includes('/gsd:execute-phase'), 'Gemini intentionally uses colon namespace; do not rewrite');
      assert.ok(!out.includes('/gsd-execute-phase'), 'Gemini agents must NOT have hyphen form');
    });

    test('C5: self-converting runtime (copilot) — body returned unchanged at this layer', () => {
      const out = normalizeAgentBodyForRuntime(inputBody, 'copilot', cmdNames);
      // Copilot has its own convertClaudeAgentToCopilotAgent that handles
      // namespace — the normalize layer is a no-op for it.
      assert.strictEqual(out, inputBody);
    });
  });

  describe('D — sanity check: the underlying transform actually works against real cmd names', () => {
    test('D1: transformContentToHyphen rewrites /gsd:<cmd> to /gsd-<cmd> for known cmds only', () => {
      const out = transformContentToHyphen(
        'A /gsd:execute-phase B /gsd:unknown-cmd C /gsd-sdk D',
        ['execute-phase'],
      );
      assert.ok(out.includes('/gsd-execute-phase'), 'known cmd rewritten');
      assert.ok(out.includes('/gsd:unknown-cmd'), 'unknown cmd preserved (longest-first matcher only rewrites registered names)');
      assert.ok(out.includes('/gsd-sdk'), 'gsd-sdk (binary, not slash command) preserved');
    });
  });

  // ---------------------------------------------------------------------------
  // E — Behavioral coverage ported from PR #3681 (johnzilla / John Turner).
  //
  // #3681 proposed the same allow-list fix independently and was closed by its
  // author in favor of this PR. Its test file contributed two coverage angles
  // worth keeping: real-source efficacy against every `agents/gsd-*.md` (the
  // shape of bug that pure-function tests miss) and idempotence-via-fixpoint
  // (guards against double-rewrite on reinstall). Credit: johnzilla.
  // ---------------------------------------------------------------------------
  describe('E — real-source efficacy + idempotence (ported from #3681, credit: johnzilla)', () => {
    const fs = require('node:fs');
    const { readCmdNames } = require(path.join(REPO_ROOT, 'scripts', 'fix-slash-commands.cjs'));
    const cmdNames = readCmdNames();

    // Roster regex matches any registered command in `gsd:<cmd>` form with a
    // negative lookbehind (so `mygsd:foo` is ignored) and a non-word lookahead
    // (so `plan-phase-extra` is not a false match for `plan-phase`).
    const roster = () => new RegExp(
      `(?<![a-zA-Z0-9_-])gsd:(${[...cmdNames].sort((a, b) => b.length - a.length).join('|')})(?=[^a-zA-Z0-9_-]|$)`,
    );

    test('E0: command roster is populated and contains the symptom commands', () => {
      assert.ok(cmdNames.length > 0, 'command roster must be populated');
      assert.ok(cmdNames.includes('execute-phase'));
      assert.ok(cmdNames.includes('plan-phase'));
    });

    test('E1: every agents/gsd-*.md transforms clean — no roster colon refs survive', () => {
      const agentsDir = path.join(REPO_ROOT, 'agents');
      const offenders = [];
      for (const f of fs.readdirSync(agentsDir)) {
        if (!f.startsWith('gsd-') || !f.endsWith('.md')) continue;
        const src = fs.readFileSync(path.join(agentsDir, f), 'utf-8');
        const out = transformContentToHyphen(src, cmdNames);
        if (roster().test(out)) offenders.push(f);
      }
      assert.deepEqual(
        offenders,
        [],
        `agents still carry roster colon refs after transform: ${offenders.join(', ')}`,
      );
    });

    test('E2: idempotent — transform of already-hyphenated input is a no-op', () => {
      const input = 'use /gsd-plan-phase next, then /gsd-execute-phase';
      assert.strictEqual(
        transformContentToHyphen(input, cmdNames),
        input,
        'reinstalls re-run the transform; double application must not mangle the body',
      );
    });

    test('E3: word boundary — /gsd:plan-phase-extra is not a roster match', () => {
      assert.strictEqual(
        transformContentToHyphen('/gsd:plan-phase-extra', cmdNames),
        '/gsd:plan-phase-extra',
      );
    });

    test('E4: rewrites bare `gsd:<cmd>` shorthand (no leading slash)', () => {
      const out = transformContentToHyphen(
        'Spawned by the gsd:execute-phase orchestrator.',
        cmdNames,
      );
      assert.strictEqual(out, 'Spawned by the gsd-execute-phase orchestrator.');
    });
  });
});
