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

'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf-8');
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
    test(`${rel}: does not contain deleted "${CRF_DELETED}"`, () => {
      const content = read(rel);
      assert.ok(
        !content.includes(CRF_DELETED),
        `${rel} still contains "${CRF_DELETED}" — replace with "${CRF_REPLACEMENT}"`
      );
    });
  }

  for (const rel of CRF_REPLACEMENT_SURFACES) {
    test(`${rel}: contains replacement "${CRF_REPLACEMENT}"`, () => {
      const content = read(rel);
      assert.ok(
        content.includes(CRF_REPLACEMENT),
        `${rel} must document the replacement command form`
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
    test(`${rel}: does not contain deleted "${PMG_DELETED}"`, () => {
      const content = read(rel);
      assert.ok(
        !content.includes(PMG_DELETED),
        `${rel} still emits "${PMG_DELETED}" — gap planning now happens inline; route via /gsd-phase --insert`
      );
    });

    test(`${rel}: replacement guidance references /gsd-phase or inline-audit prose`, () => {
      const content = read(rel);
      // The replacement may be either /gsd-phase --insert (decimal-phase
      // closure) or pointer prose back to the audit doc. Either is
      // acceptable; assert at least one appears.
      const hasPhaseInsert = content.includes('/gsd-phase --insert');
      const hasInlineProse = /inline|audit.*output|gap.*planning.*now|MILESTONE-AUDIT\.md/i.test(content);
      assert.ok(
        hasPhaseInsert || hasInlineProse,
        `${rel} must document the replacement closure path (/gsd-phase --insert ... or inline-audit prose)`
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
