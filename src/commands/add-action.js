// @ts-check
'use strict';

/**
 * add-action command logic.
 *
 * DEPRECATED: Actions now live in PLAN.md files inside milestone folders.
 * Use create-plan instead. This module returns a deprecation error.
 *
 * Zero runtime dependencies. CJS module.
 */

/**
 * Run the add-action command (deprecated).
 *
 * @param {string} _cwd - Working directory (unused)
 * @param {string[]} _args - CLI arguments (unused)
 * @returns {{ error: string }}
 */
function runAddAction(_cwd, _args) {
  return {
    error: 'add-action has been replaced by create-plan. Use: node declare-tools.cjs create-plan --milestone M-XX --actions \'[{"title":"...","produces":"..."}]\''
  };
}

module.exports = { runAddAction };
