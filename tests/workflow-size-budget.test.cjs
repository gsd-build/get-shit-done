// allow-test-rule: pending-migration-to-typed-ir [#2974]
// Tracked in #2974 for migration to typed-IR assertions per CONTRIBUTING.md
// "Prohibited: Raw Text Matching on Test Outputs". Do not copy this pattern.

/**
 * Workflow size budget.
 *
 * Workflow definitions in `get-shit-done/workflows/*.md` are loaded verbatim
 * into Claude's context every time the corresponding `/gsd:*` command is
 * invoked. Unbounded growth is paid on every invocation across every session.
 *
 * Tiered the same way as agent budgets (#2361):
 *   - XL       : top-level orchestrators (e.g., execute-phase, autonomous)
 *   - LARGE    : multi-step planners
 *   - DEFAULT  : focused single-purpose workflows (target tier)
 *
 * Raising a budget is a deliberate choice — adjust the constant, write a
 * rationale in the PR, and confirm the bloat is not duplicated content
 * that belongs in `get-shit-done/references/` or a per-mode subdirectory
 * (see `workflows/discuss-phase/modes/` for the progressive-disclosure
 * pattern introduced by #2551).
 *
 * See:
 *   - https://github.com/gsd-build/get-shit-done/issues/2551 (this test)
 *   - https://github.com/gsd-build/get-shit-done/issues/2361 (agent budget)
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WORKFLOWS_DIR = path.join(__dirname, '..', 'get-shit-done', 'workflows');

// Bumped from 1700 → 1800 in #3181 to absorb MVP-mode verb-call additions
// in execute-phase.md (1727 → ) and plan-phase.md (1714 → ) from #3178.
// Follow-up #3182 (TBD): extract MVP-mode bodies to `<workflow>/modes/mvp.md`
// per the discuss-phase/modes/ precedent and revert this back to 1700.
const XL_BUDGET = 1800;
const LARGE_BUDGET = 1500;
const DEFAULT_BUDGET = 1000;

// Top-level orchestrators that own end-to-end multi-phase rubrics.
// Grandfathered at current sizes — see PR #2551 for #2551 progressive-disclosure
// pattern that future shrinks should follow.
const XL_WORKFLOWS = new Set([
  'execute-phase',  // 1727 (post-MVP-verb-integration; was 1622)
  'plan-phase',     // 1714 (post-MVP-verb-integration; was 1493)
  'new-project',    // 1391
]);

// Multi-step planners and bigger feature workflows. Grandfathered.
const LARGE_WORKFLOWS = new Set([
  'docs-update',           // 1155
  'autonomous',            // 789
  'complete-milestone',    // 847
  'verify-work',           // 740
  'transition',            // 693
  'help',                  // 667
  'discuss-phase-assumptions', // 670
  'progress',              // 619
  'new-milestone',         // 611
  'update',                // 587
  'quick',                 // 971
  'code-review',           // 515
]);

const ALL_WORKFLOWS = fs.readdirSync(WORKFLOWS_DIR)
  .filter(f => f.endsWith('.md'))
  .map(f => f.replace('.md', ''));

function budgetFor(workflow) {
  if (XL_WORKFLOWS.has(workflow)) return { tier: 'XL', limit: XL_BUDGET };
  if (LARGE_WORKFLOWS.has(workflow)) return { tier: 'LARGE', limit: LARGE_BUDGET };
  return { tier: 'DEFAULT', limit: DEFAULT_BUDGET };
}

function lineCount(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  if (content.length === 0) return 0;
  const trailingNewline = content.endsWith('\n') ? 1 : 0;
  return content.split('\n').length - trailingNewline;
}

describe('SIZE: workflow line-count budget', () => {
  for (const workflow of ALL_WORKFLOWS) {
    const { tier, limit } = budgetFor(workflow);
    test(`${workflow} (${tier}) stays under ${limit} lines`, () => {
      const filePath = path.join(WORKFLOWS_DIR, workflow + '.md');
      const lines = lineCount(filePath);
      assert.ok(
        lines <= limit,
        `${workflow}.md has ${lines} lines — exceeds ${tier} budget of ${limit}. ` +
        `Extract per-mode bodies to a workflows/${workflow}/modes/ subdirectory, ` +
        `templates to workflows/${workflow}/templates/, or shared references ` +
        `to get-shit-done/references/. See workflows/discuss-phase/ for the pattern.`
      );
    });
  }
});

describe('SIZE: discuss-phase progressive disclosure (issue #2551)', () => {
  // Issue #2551 explicitly targets discuss-phase.md at <500 lines, separate from
  // the per-tier grandfathered budgets above. This is the headline metric of the
  // refactor — every other workflow above 500 is grandfathered at its current
  // size and may shrink later by following the same pattern.
  const DISCUSS_PHASE_TARGET = 500;
  test(`discuss-phase.md is under ${DISCUSS_PHASE_TARGET} lines (issue #2551 target)`, () => {
    const filePath = path.join(WORKFLOWS_DIR, 'discuss-phase.md');
    const lines = lineCount(filePath);
    assert.ok(
      lines < DISCUSS_PHASE_TARGET,
      `discuss-phase.md has ${lines} lines — must be under ${DISCUSS_PHASE_TARGET} per #2551. ` +
      `Per-mode logic belongs in workflows/discuss-phase/modes/<mode>.md, ` +
      `templates in workflows/discuss-phase/templates/.`
    );
  });

  const SUBDIR = path.join(WORKFLOWS_DIR, 'discuss-phase');

  test('mode files exist for every documented mode', () => {
    const expected = ['power', 'all', 'auto', 'chain', 'text', 'batch', 'analyze', 'default', 'advisor'];
    for (const mode of expected) {
      const p = path.join(SUBDIR, 'modes', `${mode}.md`);
      assert.ok(
        fs.existsSync(p),
        `Expected mode file ${path.relative(WORKFLOWS_DIR, p)} — missing. ` +
        `Each --flag in commands/gsd/discuss-phase.md must have a matching mode file.`
      );
    }
  });

  test('every mode file is a real, non-empty workflow doc', () => {
    const modesDir = path.join(SUBDIR, 'modes');
    if (!fs.existsSync(modesDir)) {
      assert.fail(`workflows/discuss-phase/modes/ directory does not exist`);
    }
    for (const file of fs.readdirSync(modesDir)) {
      if (!file.endsWith('.md')) continue;
      const p = path.join(modesDir, file);
      const content = fs.readFileSync(p, 'utf-8');
      assert.ok(content.trim().length > 100,
        `${file} is empty or near-empty (${content.length} chars) — extraction must preserve behavior, not stub it out`);
    }
  });

  test('templates extracted to discuss-phase/templates/', () => {
    const expected = ['context.md', 'discussion-log.md', 'checkpoint.json'];
    for (const t of expected) {
      const p = path.join(SUBDIR, 'templates', t);
      assert.ok(fs.existsSync(p),
        `Expected template ${path.relative(WORKFLOWS_DIR, p)} — missing.`);
    }
  });

  test('parent discuss-phase.md dispatches to mode files (power)', () => {
    const parent = fs.readFileSync(path.join(WORKFLOWS_DIR, 'discuss-phase.md'), 'utf-8');
    assert.ok(
      /discuss-phase\/modes\/power\.md/.test(parent) ||
      /discuss-phase-power\.md/.test(parent),
      `Parent discuss-phase.md must reference workflows/discuss-phase/modes/power.md ` +
      `(or the legacy discuss-phase-power.md alias) somewhere in its dispatch logic.`
    );
  });

  test('parent dispatches to all extracted modes (auto, chain, all, advisor)', () => {
    const parent = fs.readFileSync(path.join(WORKFLOWS_DIR, 'discuss-phase.md'), 'utf-8');
    for (const mode of ['auto', 'chain', 'all', 'advisor']) {
      assert.ok(
        new RegExp(`discuss-phase/modes/${mode}\\.md`).test(parent),
        `Parent discuss-phase.md must reference workflows/discuss-phase/modes/${mode}.md`
      );
    }
  });

  test('parent reads CONTEXT.md template at the write step (not at top)', () => {
    const parent = fs.readFileSync(path.join(WORKFLOWS_DIR, 'discuss-phase.md'), 'utf-8');
    // The template reference must appear inside or near the write_context step,
    // not in the top-level <required_reading> block (which would defeat lazy load).
    const requiredReadingMatch = parent.match(/<required_reading>([\s\S]*?)<\/required_reading>/);
    if (requiredReadingMatch) {
      assert.ok(
        !/discuss-phase\/templates\/context\.md/.test(requiredReadingMatch[1]),
        `CONTEXT.md template must NOT be in <required_reading> — that defeats lazy loading. ` +
        `Read it inside the write_context step, just before writing the file.`
      );
    }
    assert.ok(
      /discuss-phase\/templates\/context\.md/.test(parent),
      `Parent must reference workflows/discuss-phase/templates/context.md somewhere ` +
      `(inside write_context step) so the template loads only when CONTEXT.md is being written.`
    );
  });

  test('advisor block is gated behind USER-PROFILE.md existence check', () => {
    const parent = fs.readFileSync(path.join(WORKFLOWS_DIR, 'discuss-phase.md'), 'utf-8');
    // The guard MUST be a file-existence check (test -f or equivalent), not an
    // unconditional Read of the advisor mode file.
    assert.ok(
      /USER-PROFILE\.md/.test(parent),
      'Parent must reference USER-PROFILE.md to detect advisor mode'
    );
    assert.ok(
      /test\s+-[ef]\s+["'$].*USER-PROFILE/.test(parent) ||
      /\[\[\s+-[ef]\s+["'$].*USER-PROFILE/.test(parent) ||
      /\[\s+-[ef]\s+["'$].*USER-PROFILE/.test(parent),
      'Advisor mode detection must use a file-existence guard (test -f / [ -f ]) ' +
      'so the advisor mode file is only Read when USER-PROFILE.md exists.'
    );
    // Confirm advisor.md Read is conditional on ADVISOR_MODE
    const advisorReadGuarded =
      /ADVISOR_MODE[\s\S]{0,200}?modes\/advisor\.md/.test(parent) ||
      /modes\/advisor\.md[\s\S]{0,200}?ADVISOR_MODE/.test(parent) ||
      /if[\s\S]{0,200}?ADVISOR_MODE[\s\S]{0,400}?advisor\.md/.test(parent);
    assert.ok(
      advisorReadGuarded,
      'Read of modes/advisor.md must be guarded by ADVISOR_MODE (which derives from USER-PROFILE.md existence). ' +
      'Skip the Read entirely when no profile is present.'
    );
  });

  test('auto mode file documents skipping interactive questions (regression)', () => {
    const auto = fs.readFileSync(path.join(SUBDIR, 'modes', 'auto.md'), 'utf-8');
    assert.ok(
      /skip[\s\S]{0,80}interactive|without\s+(?:using\s+)?AskUserQuestion|recommended\s+(?:option|default)/i.test(auto),
      `auto.md must preserve the documented behavior: skip interactive questions ` +
      `and pick the recommended option without using AskUserQuestion.`
    );
  });

  test('auto mode preserves the single-pass cap (regression for inline rule)', () => {
    const auto = fs.readFileSync(path.join(SUBDIR, 'modes', 'auto.md'), 'utf-8');
    assert.ok(
      /single\s+pass|max_discuss_passes|MAX_PASSES|pass\s+cap/i.test(auto),
      `auto.md must preserve the auto-mode pass cap rule from the original workflow. ` +
      `Without it, the workflow can self-feed and consume unbounded resources.`
    );
  });

  test('all mode file documents auto-selecting all gray areas (regression)', () => {
    const allMode = fs.readFileSync(path.join(SUBDIR, 'modes', 'all.md'), 'utf-8');
    assert.ok(
      /auto-select(?:ed)?\s+ALL|select\s+ALL|all\s+gray\s+areas/i.test(allMode),
      `all.md must preserve the documented behavior: auto-select ALL gray areas ` +
      `without asking the user.`
    );
  });

  test('chain mode documents auto-advance to plan-phase (regression)', () => {
    const chain = fs.readFileSync(path.join(SUBDIR, 'modes', 'chain.md'), 'utf-8');
    assert.ok(
      /plan-phase/.test(chain) && /(auto-advance|auto\s+plan)/i.test(chain),
      `chain.md must preserve the documented auto-advance to plan-phase behavior.`
    );
  });

  test('text mode documents replacing AskUserQuestion (regression)', () => {
    const textMode = fs.readFileSync(path.join(SUBDIR, 'modes', 'text.md'), 'utf-8');
    assert.ok(
      /AskUserQuestion/.test(textMode) && /(numbered\s+list|plain[-\s]text)/i.test(textMode),
      `text.md must preserve the rule: replace AskUserQuestion with plain-text numbered lists.`
    );
  });

  test('batch mode documents 2-5 question grouping (regression)', () => {
    const batch = fs.readFileSync(path.join(SUBDIR, 'modes', 'batch.md'), 'utf-8');
    assert.ok(
      /2[-\s–]5|2\s+to\s+5|--batch=N|--batch\s+N/.test(batch),
      `batch.md must preserve the 2-5 questions-per-batch rule.`
    );
  });

  test('analyze mode documents trade-off table presentation (regression)', () => {
    const analyze = fs.readFileSync(path.join(SUBDIR, 'modes', 'analyze.md'), 'utf-8');
    assert.ok(
      /trade[-\s]off|tradeoff|pros[\s\S]{0,30}cons/i.test(analyze),
      `analyze.md must preserve the trade-off analysis presentation rule.`
    );
  });

  test('CONTEXT.md template preserves all required sections', () => {
    const tpl = fs.readFileSync(path.join(SUBDIR, 'templates', 'context.md'), 'utf-8');
    for (const section of ['<domain>', '<decisions>', '<canonical_refs>', '<code_context>', '<specifics>', '<deferred>']) {
      assert.ok(tpl.includes(section),
        `CONTEXT.md template missing required section ${section} — extraction dropped content.`);
    }
    // spec_lock is conditional but the template still has to include it as a documented option
    assert.ok(/spec_lock/i.test(tpl),
      `CONTEXT.md template must document the conditional <spec_lock> section for SPEC.md integration.`);
  });

  test('checkpoint template is valid JSON', () => {
    const raw = fs.readFileSync(path.join(SUBDIR, 'templates', 'checkpoint.json'), 'utf-8');
    assert.doesNotThrow(() => JSON.parse(raw),
      `checkpoint.json template must parse as valid JSON — downstream code reads it.`);
    const parsed = JSON.parse(raw);
    for (const key of ['phase', 'phase_name', 'timestamp', 'areas_completed', 'areas_remaining', 'decisions']) {
      assert.ok(key in parsed,
        `checkpoint.json template missing required field "${key}" — schema regression vs original workflow.`);
    }
  });

  test('parent does not leak per-mode bodies inline (would defeat extraction)', () => {
    const parent = fs.readFileSync(path.join(WORKFLOWS_DIR, 'discuss-phase.md'), 'utf-8');
    // Heuristic: the parent should not contain the full DISCUSSION-LOG.md template body
    // (extracted to templates/discussion-log.md) — that's the heaviest single block.
    // Look for unique strings that ONLY appear in the original inline template.
    const inlineDiscussionLogSignal = /\| Option \| Description \| Selected \|/g;
    const occurrences = (parent.match(inlineDiscussionLogSignal) || []).length;
    assert.ok(occurrences === 0,
      `Parent discuss-phase.md still contains the inline DISCUSSION-LOG.md table — ` +
      `that block must move to workflows/discuss-phase/templates/discussion-log.md.`);
  });

  test('negative: invalid mode flag combinations document a clear error path', () => {
    // Sanity check: the parent file should explicitly handle the mode dispatch
    // rather than silently doing nothing on an unknown flag pattern.
    const parent = fs.readFileSync(path.join(WORKFLOWS_DIR, 'discuss-phase.md'), 'utf-8');
    assert.ok(
      /ARGUMENTS|--auto|--chain|--all|--power/.test(parent),
      'Parent must dispatch on $ARGUMENTS — losing the flag-parsing block would silently ' +
      'fall back to default mode and obscure user errors.'
    );
  });
});
