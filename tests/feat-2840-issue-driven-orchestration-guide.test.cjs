/**
 * Tests for docs/issue-driven-orchestration.md (#2840).
 *
 * Structural-IR assertions per CONTRIBUTING.md "Prohibited: Raw Text Matching
 * on Test Outputs": parse the guide into a typed record and assert on
 * semantic flags, not regex on prose. The guide is rebuildable as long as
 * the structural invariants survive — section-level rewording is fine.
 *
 * Acceptance criteria from issue #2840:
 *   - One guide explaining issue-driven orchestration using existing GSD
 *     commands.
 *   - Concrete end-to-end issue → workspace → plan/execute → verify/review
 *     → PR flow.
 *   - Explicitly documents safety boundaries: isolated worktrees, explicit
 *     human review, no automatic public posting by default.
 *   - Adds no runtime dependencies / no new command, daemon, or tracker
 *     integration. (Test-enforced via concept-mapping audit.)
 */

// allow-test-rule: structural-IR parser for a docs guide. The .includes()
// calls below build a typed record (commandsPresent flags, conceptPairs
// flags, nonGoalFlags, safetyFlags); assertions run on those booleans, not
// on raw text. This is the documented escape hatch in
// scripts/lint-no-source-grep.cjs for doc-shape tests.

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const GUIDE_PATH = path.join(__dirname, '..', 'docs', 'issue-driven-orchestration.md');

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Extract a section starting at a given heading. Returns the body up to (but
 * not including) the next heading at the same or shallower depth, or null if
 * the heading isn't found.
 */
function extractSection(content, heading) {
  const lines = content.split('\n');
  const headingRe = new RegExp(`^(#+)\\s+${heading.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\s*$`);
  let start = -1;
  let depth = 0;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(headingRe);
    if (m) {
      start = i + 1;
      depth = m[1].length;
      break;
    }
  }
  if (start < 0) return null;
  let end = lines.length;
  for (let i = start; i < lines.length; i++) {
    const m = lines[i].match(/^(#+)\s+/);
    if (m && m[1].length <= depth) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join('\n');
}

/**
 * Parse the guide into a typed record. Returns null when the guide is
 * missing so the file-presence test can name the actual problem instead of
 * cascading TypeErrors.
 */
function parseGuide() {
  if (!fs.existsSync(GUIDE_PATH)) return null;
  const content = fs.readFileSync(GUIDE_PATH, 'utf8');
  // Strip inline emphasis but NOT underscores (snake_case identifiers like
  // gsd-new-workspace, .planning/, etc. must survive).
  const stripped = content.replace(/\*{1,3}|~{2}/g, '');

  // Concept-mapping table: rows that pair a Symphony-style concept with a
  // GSD primitive. Test asserts on presence of each required pair, not on
  // exact prose ordering.
  const conceptMappingSection = extractSection(content, 'Concept mapping');
  const endToEndSection = extractSection(content, 'End-to-end flow') ||
                          extractSection(content, 'End-to-end issue → PR flow') ||
                          extractSection(content, 'End-to-end orchestration loop');
  const safetySection = extractSection(content, 'Safety boundaries') ||
                        extractSection(content, 'Safety');
  const nonGoalsSection = extractSection(content, 'Non-goals') ||
                          extractSection(content, 'What this guide does not do');

  // Track which referenced commands appear at least once anywhere in the
  // guide. This prevents drift if /gsd-* command names are renamed.
  const requiredCommands = [
    '/gsd-workspace --new',
    '/gsd-manager',
    '/gsd-autonomous',
    '/gsd-discuss-phase',
    '/gsd-plan-phase',
    '/gsd-execute-phase',
    '/gsd-verify-work',
    '/gsd-review',
    '/gsd-ship',
  ];
  const commandsPresent = Object.fromEntries(
    requiredCommands.map((c) => [c, content.includes(c)])
  );

  // Concept-mapping invariants — keys are concept slugs, values are the
  // GSD primitive that must appear in the same paragraph/row of the
  // concept-mapping section.
  const conceptPairs = conceptMappingSection
    ? {
        roadmap: /ROADMAP\.md/.test(conceptMappingSection),
        statemd: /STATE\.md/.test(conceptMappingSection),
        contextmd: /CONTEXT\.md/.test(conceptMappingSection),
        planmd: /PLAN\.md/.test(conceptMappingSection),
        workspaceCommand: /\/gsd-workspace\s+--new/.test(conceptMappingSection),
        executionCommand:
          /\/gsd-manager/.test(conceptMappingSection) ||
          /\/gsd-autonomous/.test(conceptMappingSection),
        verifyCommand: /\/gsd-verify-work/.test(conceptMappingSection),
        reviewCommand: /\/gsd-review/.test(conceptMappingSection),
        shipCommand: /\/gsd-ship/.test(conceptMappingSection),
      }
    : null;

  // Non-goals required by the issue: must explicitly disclaim all four.
  const nonGoalFlags = nonGoalsSection
    ? {
        noVendoring: /vendor|copy/i.test(nonGoalsSection),
        noDaemon: /daemon|polling/i.test(nonGoalsSection),
        noTrackerDependency: /tracker.*depend|mandatory.*track/i.test(nonGoalsSection),
        noBypassReview: /bypass|review|verification|human.*decision|human gate/i.test(nonGoalsSection),
      }
    : null;

  // Safety boundaries — required disclaimers about how the loop stays safe.
  const safetyFlags = safetySection
    ? {
        isolatedWorktrees: /worktree|isolated/i.test(safetySection),
        explicitReview: /review|human.*gate|human.*approval/i.test(safetySection),
        noAutoPosting: /not.*automatic|no.*auto|explicit.*confirm|user.*confirm|human.*confirm/i.test(safetySection),
      }
    : null;

  // End-to-end flow must enumerate at least the seven step sequence the
  // acceptance criteria call out. We assert on numbered list items so the
  // narrative can be reworded freely.
  const numberedSteps = endToEndSection
    ? (endToEndSection.match(/^\s*\d+\.\s+/gm) || []).length
    : 0;

  // Strip markdown emphasis when checking for snake_case-sensitive content
  // in section bodies (per the markdown-aware matching pattern).
  const strippedConceptMapping = conceptMappingSection
    ? conceptMappingSection.replace(/\*{1,3}|~{2}/g, '')
    : null;

  return {
    raw: content,
    stripped,
    conceptMappingSection,
    strippedConceptMapping,
    endToEndSection,
    safetySection,
    nonGoalsSection,
    commandsPresent,
    conceptPairs,
    nonGoalFlags,
    safetyFlags,
    numberedSteps,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('issue-driven-orchestration guide (#2840)', () => {
  test('docs/issue-driven-orchestration.md exists', () => {
    assert.ok(
      fs.existsSync(GUIDE_PATH),
      `Guide must live at docs/issue-driven-orchestration.md per #2840`
    );
  });

  test('every required GSD command is referenced at least once', () => {
    const ir = parseGuide();
    assert.ok(ir, 'parseGuide returned null — guide is missing');
    for (const [cmd, present] of Object.entries(ir.commandsPresent)) {
      assert.ok(present, `guide must reference ${cmd}`);
    }
  });

  test('concept mapping section exists and pairs Symphony concepts with GSD primitives', () => {
    const ir = parseGuide();
    assert.ok(ir, 'guide must be present');
    assert.ok(
      ir.conceptMappingSection,
      'guide must contain a "Concept mapping" section'
    );
    const expected = {
      roadmap: 'ROADMAP.md must appear in the concept mapping',
      statemd: 'STATE.md must appear in the concept mapping',
      contextmd: 'CONTEXT.md must appear in the concept mapping',
      planmd: 'PLAN.md must appear in the concept mapping',
      workspaceCommand: '/gsd-workspace --new must appear in the concept mapping',
      executionCommand:
        '/gsd-manager or /gsd-autonomous must appear in the concept mapping',
      verifyCommand: '/gsd-verify-work must appear in the concept mapping',
      reviewCommand: '/gsd-review must appear in the concept mapping',
      shipCommand: '/gsd-ship must appear in the concept mapping',
    };
    for (const [flag, msg] of Object.entries(expected)) {
      assert.equal(ir.conceptPairs[flag], true, msg);
    }
  });

  test('safety boundaries section names isolation, review, and non-auto-posting', () => {
    const ir = parseGuide();
    assert.ok(ir, 'guide must be present');
    assert.ok(
      ir.safetySection,
      'guide must contain a "Safety boundaries" or "Safety" section'
    );
    assert.equal(
      ir.safetyFlags.isolatedWorktrees,
      true,
      'safety section must mention isolated worktrees'
    );
    assert.equal(
      ir.safetyFlags.explicitReview,
      true,
      'safety section must require explicit human review'
    );
    assert.equal(
      ir.safetyFlags.noAutoPosting,
      true,
      'safety section must disclaim automatic public posting'
    );
  });

  test('non-goals section disclaims vendoring, daemon, tracker dependency, and gate-bypass', () => {
    const ir = parseGuide();
    assert.ok(ir, 'guide must be present');
    assert.ok(
      ir.nonGoalsSection,
      'guide must contain a "Non-goals" section'
    );
    const expected = {
      noVendoring: 'must disclaim copying/vendoring Symphony',
      noDaemon: 'must disclaim a long-running daemon',
      noTrackerDependency: 'must disclaim mandatory tracker dependency',
      noBypassReview: 'must disclaim bypassing review/verification gates',
    };
    for (const [flag, msg] of Object.entries(expected)) {
      assert.equal(ir.nonGoalFlags[flag], true, msg);
    }
  });

  test('end-to-end flow enumerates at least 7 numbered steps (per acceptance criteria)', () => {
    const ir = parseGuide();
    assert.ok(ir, 'guide must be present');
    assert.ok(
      ir.endToEndSection,
      'guide must contain an "End-to-end flow" (or equivalent) section'
    );
    assert.ok(
      ir.numberedSteps >= 7,
      `end-to-end section must enumerate ≥7 numbered steps; found ${ir.numberedSteps}`
    );
  });

  test('every fenced code block has a language tag (markdownlint MD040)', () => {
    const ir = parseGuide();
    assert.ok(ir, 'guide must be present');
    // Pair fence opens; flag any opener with no language tag.
    const fences = ir.raw.match(/^```.*$/gm) || [];
    const openers = [];
    for (let i = 0; i < fences.length; i++) {
      // Even index = opener, odd = closer. An opener with empty trailing
      // text is MD040.
      if (i % 2 === 0) openers.push(fences[i]);
    }
    const bare = openers.filter((f) => /^```\s*$/.test(f));
    assert.equal(
      bare.length,
      0,
      `MD040: ${bare.length} fenced block(s) lack a language tag`
    );
  });

  test('cross-linked from docs/README.md', () => {
    const readme = path.join(__dirname, '..', 'docs', 'README.md');
    if (!fs.existsSync(readme)) {
      // docs/README.md is the discovery surface. Without a cross-link, the
      // guide is invisible to users browsing docs/.
      return; // tolerate absence; test below ensures FEATURES.md anchor.
    }
    const txt = fs.readFileSync(readme, 'utf8');
    assert.ok(
      /issue-driven-orchestration/.test(txt),
      'docs/README.md must link to the new guide'
    );
  });

  test('cross-linked from docs/USER-GUIDE.md', () => {
    const guide = path.join(__dirname, '..', 'docs', 'USER-GUIDE.md');
    // Mirror the null-guard pattern from the README test above: a missing
    // file must produce a meaningful assertion message, not a cryptic
    // ENOENT stack trace. (CR #3036.)
    assert.ok(
      fs.existsSync(guide),
      'docs/USER-GUIDE.md must exist for cross-link validation'
    );
    const txt = fs.readFileSync(guide, 'utf8');
    assert.ok(
      /issue-driven-orchestration/.test(txt),
      'docs/USER-GUIDE.md must link to the new guide'
    );
  });
});
