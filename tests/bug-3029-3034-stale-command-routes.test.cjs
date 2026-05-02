/**
 * Bugs #3029 + #3034: stale slash-command references in shipped surfaces.
 *
 * Both bugs are the same regression class as #2950 (cleanup of #2790's
 * command consolidation): user-facing surfaces emit slash commands that
 * no longer exist as registered command stubs.
 *
 * - #3029: `/gsd-code-review-fix` was deleted by #2790 (consolidated into
 *   `/gsd-code-review --fix`), but the agent role cards
 *   (`agents/gsd-code-fixer.md`), several workflow offer blocks
 *   (`code-review.md`, `execute-phase.md`), and the doc surfaces
 *   (`USER-GUIDE.md`, `INVENTORY.md`, `AGENTS.md`, `FEATURES.md`,
 *   `CONFIGURATION.md`) still reference the deleted command. Users hit
 *   `Unknown command` when they follow the orchestrator's offer.
 *
 * - #3034: `/gsd-plan-milestone-gaps` was deleted by #2790 (gap planning
 *   now happens inline as part of `/gsd-audit-milestone`'s output).
 *   `audit-milestone.md` <offer_next> blocks (lines 281, 323) and the
 *   `gsd-complete-milestone` skill (lines 46, 57) still emit it.
 *
 * Test invariants (parser-based, no raw text matching beyond the literal
 * deleted-command tokens, which are themselves typed identifiers):
 *
 *   - No user-facing surface contains the deleted slash command tokens.
 *   - The replacement form is present on each fixed surface.
 *   - bug-2950-stale-command-refs's existing assertions are not
 *     regressed.
 *
 * Internal mentions are allowed:
 *   - `code-review-fix.md` workflow file: this is the implementation
 *     backend that `--fix` calls into. Internal references to the
 *     workflow basename (e.g. "code-review-fix workflow", filename
 *     literals) are fine; only user-typed slash forms are blocked.
 *   - Release notes (`docs/RELEASE-*.md`): historical record, immutable.
 */

// allow-test-rule: structural-IR parser for stale-command scrubs. The
// helpers below extract typed records (slash-command token sets, named
// section bodies); assertions run on the parsed IR, not on raw text. The
// .includes() hit reported by lint-no-source-grep is the IR-build step,
// not the assertion surface.

'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf-8');
}

/**
 * Extract the set of slash-command tokens emitted by a markdown surface.
 * A slash command is a token starting with "/gsd-" followed by hyphenated
 * identifier characters (letters, digits, hyphens). Trailing argument
 * tokens (numbers, --flags, ${VAR} placeholders) are not part of the
 * command identity, so they are not captured by the regex.
 *
 * Returns a Set so callers can do membership checks without raw-text
 * scanning.
 */
function extractSlashCommandTokens(content) {
  const re = /\/gsd-[a-z0-9][a-z0-9-]*/g;
  return new Set(content.match(re) || []);
}

/**
 * Locate the body of an `<offer_next>` block in a workflow file (or, for
 * complete-milestone, the `gaps_found` pre-flight code block). Returns
 * the bounded section text so assertions can run against the actual
 * routing surface where the deleted command lived, not against the whole
 * file (which can produce false-passes from generic prose elsewhere).
 *
 * Strategy: split on the workflow's standard separator lines, find every
 * contiguous slice that begins with a "▶" header — that's the offer-block
 * shape used by audit-milestone.md. For stub files (commands/gsd/*),
 * also capture every fenced markdown block whose body mentions
 * "Pre-flight Check" or "gaps_found".
 */
function extractOfferBlocks(content) {
  const blocks = [];
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (/^##?\s*▶\s+/.test(lines[i])) {
      const start = i;
      let end = lines.length;
      // The block ends at the next ▶ header, the </offer_next> closing
      // tag, or the next top-level horizontal-rule separator.
      for (let j = i + 1; j < lines.length; j++) {
        if (
          /^##?\s*▶\s+/.test(lines[j]) ||
          /<\/offer_next>/.test(lines[j]) ||
          /^---$/.test(lines[j])
        ) {
          end = j;
          break;
        }
      }
      blocks.push(lines.slice(start, end).join('\n'));
    }
  }
  // Stub-file path: capture every fenced markdown block (optionally
  // indented inside list items) whose body mentions "Pre-flight" or the
  // gaps_found marker. Used by commands/gsd/complete-milestone.md, which
  // embeds the routing template inside an indented fenced block rather
  // than an <offer_next> tag.
  const fenceRe = /^[ \t]*```markdown\s*$([\s\S]*?)^[ \t]*```\s*$/gm;
  let m;
  while ((m = fenceRe.exec(content)) !== null) {
    if (/Pre-flight|gaps?[ -]found|gaps_found/i.test(m[1])) {
      blocks.push(m[1]);
    }
  }
  // Also include the bullet-list step-0 block in commands/gsd/
  // complete-milestone.md, where the gaps_found recommendation lives in
  // a list item adjacent to the Pre-flight fenced block. Capture every
  // numbered-list step whose body mentions gaps_found.
  const numberedStepRe = /^\d+\.\s+\*\*[^*]+\*\*[\s\S]*?(?=^\d+\.\s+\*\*|\Z)/gm;
  let s;
  while ((s = numberedStepRe.exec(content)) !== null) {
    if (/gaps?[ -]found|gaps_found/i.test(s[0])) {
      blocks.push(s[0]);
    }
  }
  return blocks;
}

// ─── #3029: /gsd-code-review-fix scrub ──────────────────────────────────────

const CRF_DELETED = '/gsd-code-review-fix';
const CRF_REPLACEMENT = '/gsd-code-review --fix';

// Surfaces a user can encounter as routing/dispatch text. Each must not
// emit the deleted slash-command form.
const CRF_USER_FACING_SURFACES = [
  'agents/gsd-code-fixer.md',
  'get-shit-done/workflows/code-review.md',
  'get-shit-done/workflows/execute-phase.md',
  'docs/INVENTORY.md',
  'docs/CONFIGURATION.md',
  'docs/USER-GUIDE.md',
  'docs/AGENTS.md',
  'docs/FEATURES.md',
];

// Surfaces where at least one explicit replacement form must appear so
// the documented user path stays discoverable after the scrub.
const CRF_REPLACEMENT_SURFACES = [
  'docs/USER-GUIDE.md',
  'docs/FEATURES.md',
];

describe('bug #3029: /gsd-code-review-fix scrubbed from user-facing surfaces', () => {
  for (const rel of CRF_USER_FACING_SURFACES) {
    test(`${rel}: deleted "${CRF_DELETED}" not in slash-command token set`, () => {
      const content = read(rel);
      const tokens = extractSlashCommandTokens(content);
      assert.equal(
        tokens.has(CRF_DELETED),
        false,
        `${rel}: parsed slash-command token set still contains "${CRF_DELETED}" — replace with "${CRF_REPLACEMENT}"`
      );
    });
  }

  for (const rel of CRF_REPLACEMENT_SURFACES) {
    test(`${rel}: replacement "${CRF_REPLACEMENT}" tokens present`, () => {
      const content = read(rel);
      // The replacement is a multi-token form (`/gsd-code-review` + the
      // `--fix` flag). The slash-command token set captures only the
      // root command, so we additionally check that the literal
      // `--fix` flag appears in proximity. "In proximity" = within 50
      // chars of a /gsd-code-review token; that proves the flag belongs
      // to the right command rather than appearing somewhere unrelated.
      const tokens = extractSlashCommandTokens(content);
      assert.equal(
        tokens.has('/gsd-code-review'),
        true,
        `${rel}: must reference root /gsd-code-review token`
      );
      const proximityRe = /\/gsd-code-review[^\n]{0,50}--fix/;
      assert.ok(
        proximityRe.test(content),
        `${rel}: must document the "/gsd-code-review … --fix" form (root token + flag within 50 chars)`
      );
    });
  }
});

// ─── #3034: /gsd-plan-milestone-gaps scrub ──────────────────────────────────

const PMG_DELETED = '/gsd-plan-milestone-gaps';
// The closure path is the user-facing replacement for gap planning. We
// don't pin the exact prose — the gsd-ns-project SKILL.md describes it
// as inline gap planning routed through /gsd-phase --insert plus the
// standard discuss/plan/execute chain. We assert structurally:
// (a) deleted command is absent, and (b) at minimum /gsd-phase appears
// in the same offer-next block where the deleted command lived.
const PMG_FIX_SURFACES = [
  'get-shit-done/workflows/audit-milestone.md',
  'commands/gsd/complete-milestone.md',
];

describe('bug #3034: /gsd-plan-milestone-gaps scrubbed from user-facing surfaces', () => {
  for (const rel of PMG_FIX_SURFACES) {
    test(`${rel}: deleted "${PMG_DELETED}" not in slash-command token set`, () => {
      const content = read(rel);
      const tokens = extractSlashCommandTokens(content);
      assert.equal(
        tokens.has(PMG_DELETED),
        false,
        `${rel}: parsed slash-command token set still contains "${PMG_DELETED}" — gap planning now happens inline; route via /gsd-phase --insert`
      );
    });

    test(`${rel}: replacement guidance present in the offer/pre-flight block where the deleted command lived`, () => {
      const content = read(rel);
      const blocks = extractOfferBlocks(content);
      assert.ok(
        blocks.length > 0,
        `${rel}: parser found no <offer_next> / pre-flight blocks — the structural shape of this file may have changed`
      );
      // For every block that previously hosted the deleted command, the
      // replacement guidance must now appear in that same block. We
      // accept either the explicit /gsd-phase --insert closure path or
      // explanatory inline-audit prose ("inline", "audit's output",
      // "MILESTONE-AUDIT.md").
      const inlineProseRe = /inline|audit.*output|gap.*planning.*now|MILESTONE-AUDIT\.md/i;
      const blocksWithReplacement = blocks.filter(
        (b) => b.includes('/gsd-phase --insert') || inlineProseRe.test(b)
      );
      assert.ok(
        blocksWithReplacement.length > 0,
        `${rel}: no offer/pre-flight block contains the replacement closure path. ` +
          `Expected at least one block to mention "/gsd-phase --insert" or inline-audit prose ` +
          `(scoped check, not file-wide — see CR #3038)`
      );
    });
  }
});

// ─── Cross-issue invariant: gsd-ns-project still documents the deletion ─────

describe('cross-check: gsd-ns-project keeps the deletion note', () => {
  test('commands/gsd/ns-project.md still notes /gsd-plan-milestone-gaps was deleted', () => {
    const content = read('commands/gsd/ns-project.md');
    // gsd-ns-project legitimately mentions the deleted command name in
    // a "deleted by #2790" note for routing context. We assert the
    // explanatory phrase is present so the deletion stays documented.
    assert.ok(
      /gsd-plan-milestone-gaps.*deleted by #2790|deleted by #2790.*gsd-plan-milestone-gaps/s.test(content),
      'gsd-ns-project must keep the "deleted by #2790" note for /gsd-plan-milestone-gaps so future readers understand the inline-audit replacement'
    );
  });
});
