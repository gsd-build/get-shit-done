/**
 * Regression test for #2772: worktree isolation is unconditionally disabled
 * when `.gitmodules` exists in the repo, even when the work doesn't touch
 * any submodule path.
 *
 * The original guard in execute-phase.md and quick.md was a blunt
 * `if [ -f .gitmodules ]; then USE_WORKTREES=false; fi`. That penalises
 * every plan in a submodule project, regardless of whether the plan
 * actually touches a submodule path.
 *
 * Fix (per-plan granularity in execute-phase.md): parse submodule paths
 * from `.gitmodules` and intersect with each plan's `files_modified`
 * frontmatter. Disable worktree isolation only for plans whose paths
 * intersect submodule paths. If `files_modified` is missing/unparseable
 * for a plan, fall back to the safe behavior (disable for that plan)
 * and log why.
 *
 * Fix (quick.md): same path-intersection idea, but using the freeform
 * `$DESCRIPTION` paths or a fail-loud commit-time guard. We only assert
 * that the unconditional disable is gone and that submodule path parsing
 * is present.
 */

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const EXECUTE_PHASE_PATH = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'execute-phase.md');
const QUICK_PATH = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'quick.md');

const UNCONDITIONAL_DISABLE_RE =
  /if\s+\[\s+-f\s+\.gitmodules\s+\]\s*;\s*then\s*\n[^}]*?USE_WORKTREES=false[^}]*?\n\s*fi/;

describe('Submodule worktree-isolation guard intersects planned paths (#2772)', () => {

  test('execute-phase.md does NOT unconditionally disable worktrees on .gitmodules presence', () => {
    const content = fs.readFileSync(EXECUTE_PHASE_PATH, 'utf-8');

    // The old pattern set USE_WORKTREES=false inside an `if [ -f .gitmodules ]`
    // block with no further conditions. The new logic must not contain a
    // raw assignment of USE_WORKTREES=false guarded only by the file-exists
    // check.
    const blanketBlock = content.match(
      /if\s+\[\s+-f\s+\.gitmodules\s+\][\s\S]{0,200}?USE_WORKTREES=false/
    );

    if (blanketBlock) {
      // Allow it ONLY if it sits inside a per-plan or intersection context.
      // Heuristic: the surrounding 400 chars must mention `intersect`,
      // `files_modified`, `SUBMODULE_PATHS`, or `per-plan`.
      const idx = content.indexOf(blanketBlock[0]);
      const window = content.slice(Math.max(0, idx - 400), idx + 400);
      const guarded = /intersect|files_modified|SUBMODULE_PATHS|per-plan/i.test(window);
      assert.ok(
        guarded,
        'execute-phase.md still contains an unconditional USE_WORKTREES=false guarded only by .gitmodules existence. Replace with path intersection against submodule paths from .gitmodules.'
      );
    }
  });

  test('execute-phase.md parses submodule paths from .gitmodules', () => {
    const content = fs.readFileSync(EXECUTE_PHASE_PATH, 'utf-8');
    assert.ok(
      /git\s+config\s+--file\s+\.gitmodules/.test(content) ||
        /SUBMODULE_PATHS/.test(content),
      'execute-phase.md must parse submodule paths (e.g., `git config --file .gitmodules --get-regexp ...`) and store them in a SUBMODULE_PATHS variable so they can be intersected with planned paths.'
    );
  });

  test('execute-phase.md intersects submodule paths with plan files_modified', () => {
    const content = fs.readFileSync(EXECUTE_PHASE_PATH, 'utf-8');
    assert.ok(
      /files_modified/i.test(content) && /intersect/i.test(content),
      'execute-phase.md must intersect SUBMODULE_PATHS with each plan\'s files_modified frontmatter to decide per-plan whether worktree isolation is safe.'
    );
  });

  test('execute-phase.md falls back to safe disable when planned paths are unknown', () => {
    const content = fs.readFileSync(EXECUTE_PHASE_PATH, 'utf-8');
    // Look for a fallback note explaining what happens if files_modified is
    // missing/empty/unparseable.
    assert.ok(
      /fallback|fall back|missing|unparseable|unknown/i.test(content) &&
        /USE_WORKTREES=false|disable/i.test(content),
      'execute-phase.md must explicitly document the fallback: when files_modified is missing/unparseable, disable worktree isolation for that plan and log why.'
    );
  });

  test('quick.md does NOT unconditionally disable worktrees on .gitmodules presence', () => {
    const content = fs.readFileSync(QUICK_PATH, 'utf-8');
    const blanketBlock = content.match(
      /if\s+\[\s+-f\s+\.gitmodules\s+\][\s\S]{0,200}?USE_WORKTREES=false/
    );

    if (blanketBlock) {
      const idx = content.indexOf(blanketBlock[0]);
      const window = content.slice(Math.max(0, idx - 400), idx + 400);
      const guarded = /intersect|SUBMODULE_PATHS|guard|fail/i.test(window);
      assert.ok(
        guarded,
        'quick.md still contains an unconditional USE_WORKTREES=false guarded only by .gitmodules existence. Replace with path intersection or a fail-loud commit-time guard.'
      );
    }
  });

  test('quick.md parses submodule paths from .gitmodules', () => {
    const content = fs.readFileSync(QUICK_PATH, 'utf-8');
    assert.ok(
      /git\s+config\s+--file\s+\.gitmodules/.test(content) ||
        /SUBMODULE_PATHS/.test(content),
      'quick.md must parse submodule paths so the guard can act on actual submodule paths rather than the mere existence of .gitmodules.'
    );
  });
});
