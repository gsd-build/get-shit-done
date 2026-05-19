/**
 * Bug #3727: `/gsd-code-review N --fix` silently no-ops.
 *
 * The #2790 skill consolidation merged the deleted `/gsd-code-review-fix`
 * entry point into `--fix` on the unified `/gsd:code-review` skill, but the
 * workflow body (`get-shit-done/workflows/code-review.md`) was never updated
 * to parse the flag or dispatch to `code-review-fix.md`. PR #2947 claimed to
 * land the dispatch but the merged diff touched only `phase.cjs` + a phase
 * test — the workflow change was never shipped.
 *
 * Effects:
 *   - `autonomous.md` invokes `Skill(skill="gsd-code-review", args="...--fix --auto")`
 *     which silently no-ops the autofix half of the autonomous loop.
 *   - `execute-phase.md` suggests `/gsd:code-review N --fix` which also no-ops.
 *   - `gsd-code-fixer` agent is never spawned by any user-facing path.
 *
 * Fix:
 *   1. Parse `--fix`, `--all`, `--auto` in `code-review.md`'s `initialize` step.
 *   2. Add `<step name="dispatch_fix">` after `present_results` that forwards to
 *      `code-review-fix.md` with `${PHASE_ARG} [--all] [--auto]` when
 *      `FIX_FLAG=true` and STATUS is not "clean".
 *   3. Preload `code-review-fix.md` in `commands/gsd/code-review.md`'s
 *      `<execution_context>` so the dispatch is in-context.
 */

'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const WORKFLOWS_DIR = path.join(__dirname, '..', 'get-shit-done', 'workflows');
const COMMANDS_DIR = path.join(__dirname, '..', 'commands', 'gsd');

function read(p) {
  return fs.readFileSync(p, 'utf-8');
}

// Extract a single <step name="X">...</step> block from a workflow body. The
// blocks are non-overlapping and the workflow grammar guarantees `</step>` is
// not used inside step bodies, so a non-greedy match on the literal markers
// is sufficient here (no full XML parser needed).
function extractStep(workflowBody, stepName) {
  const escaped = stepName.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  const re = new RegExp(
    `<step\\s+name="${escaped}"\\s*>([\\s\\S]*?)</step>`,
    'm'
  );
  const m = workflowBody.match(re);
  return m ? m[1] : null;
}

describe('bug-3727: code-review.md parses --fix / --all / --auto in initialize step', () => {
  const workflow = read(path.join(WORKFLOWS_DIR, 'code-review.md'));
  const initialize = extractStep(workflow, 'initialize');

  test('initialize step exists', () => {
    assert.ok(initialize, 'initialize step must exist in code-review.md');
  });

  test('initialize step assigns FIX_FLAG variable', () => {
    assert.match(
      initialize,
      /FIX_FLAG\s*=/,
      'initialize step must assign FIX_FLAG (parsed from --fix)'
    );
  });

  test('initialize step assigns FIX_ALL variable', () => {
    assert.match(
      initialize,
      /FIX_ALL\s*=/,
      'initialize step must assign FIX_ALL (parsed from --all)'
    );
  });

  test('initialize step assigns AUTO_MODE variable', () => {
    assert.match(
      initialize,
      /AUTO_MODE\s*=/,
      'initialize step must assign AUTO_MODE (parsed from --auto)'
    );
  });

  test('initialize step handles --fix in arg scan', () => {
    assert.match(
      initialize,
      /--fix/,
      'initialize step must reference --fix when parsing args'
    );
  });
});

describe('bug-3727: code-review.md has a dispatch_fix step that forwards to code-review-fix.md', () => {
  const workflow = read(path.join(WORKFLOWS_DIR, 'code-review.md'));
  const dispatchFix = extractStep(workflow, 'dispatch_fix');

  test('dispatch_fix step exists', () => {
    assert.ok(
      dispatchFix,
      'code-review.md must have <step name="dispatch_fix"> after present_results'
    );
  });

  test('dispatch_fix step references code-review-fix.md', () => {
    assert.match(
      dispatchFix,
      /code-review-fix\.md/,
      'dispatch_fix step must reference the code-review-fix.md workflow it dispatches to'
    );
  });

  test('dispatch_fix step is conditional on FIX_FLAG', () => {
    assert.match(
      dispatchFix,
      /FIX_FLAG/,
      'dispatch_fix step must branch on FIX_FLAG to avoid running when --fix was not passed'
    );
  });

  test('dispatch_fix step forwards --all and --auto sub-flags', () => {
    assert.match(
      dispatchFix,
      /--all/,
      'dispatch_fix must forward --all to the fix workflow when FIX_ALL is set'
    );
    assert.match(
      dispatchFix,
      /--auto/,
      'dispatch_fix must forward --auto to the fix workflow when AUTO_MODE is set'
    );
  });

  test('dispatch_fix step appears after present_results in workflow order', () => {
    const presentResultsIdx = workflow.indexOf('<step name="present_results">');
    const dispatchFixIdx = workflow.indexOf('<step name="dispatch_fix">');
    assert.ok(presentResultsIdx > -1, 'present_results step must exist');
    assert.ok(dispatchFixIdx > -1, 'dispatch_fix step must exist');
    assert.ok(
      dispatchFixIdx > presentResultsIdx,
      'dispatch_fix must come after present_results — review must run before fix'
    );
  });
});

describe('bug-3727: commands/gsd/code-review.md preloads code-review-fix.md in execution_context', () => {
  const command = read(path.join(COMMANDS_DIR, 'code-review.md'));

  test('execution_context includes code-review.md', () => {
    // Sanity check — the original execution_context line must still be there.
    assert.match(
      command,
      /@~\/\.claude\/get-shit-done\/workflows\/code-review\.md/,
      'commands/gsd/code-review.md must still preload code-review.md'
    );
  });

  test('execution_context also includes code-review-fix.md (new)', () => {
    assert.match(
      command,
      /@~\/\.claude\/get-shit-done\/workflows\/code-review-fix\.md/,
      'commands/gsd/code-review.md must preload code-review-fix.md so dispatch_fix can hand off in-context'
    );
  });
});
