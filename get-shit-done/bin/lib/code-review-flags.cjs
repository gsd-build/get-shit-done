'use strict';

/**
 * Typed flag parser for the /gsd:code-review command.
 *
 * This is the canonical IR for code-review argument parsing. The workflow
 * (code-review.md) delegates flag dispatch logic to this module so that:
 *  1. Tests assert on a structured IR rather than on rendered bash text.
 *  2. The dispatch decision is testable without instantiating the workflow.
 *
 * @typedef {Object} CodeReviewFlags
 * @property {boolean} fix   - true when --fix is present in argv
 * @property {boolean} all   - true when --all is present in argv (implies fix)
 * @property {boolean} auto  - true when --auto is present in argv (implies fix)
 * @property {string}  depth - depth override value, or '' if not supplied
 * @property {string}  files - files override value, or '' if not supplied
 */

/**
 * Parse code-review flags from an argv array.
 *
 * The first positional argument (phase number) is ignored by this function —
 * phase validation is handled by `gsd-sdk query init.phase-op`.
 *
 * @param {string[]} argv - Array of argument strings, e.g. ['2', '--fix', '--all']
 * @returns {CodeReviewFlags}
 */
function parseCodeReviewFlags(argv) {
  const flags = {
    fix: false,
    all: false,
    auto: false,
    depth: '',
    files: '',
  };

  for (const arg of argv) {
    if (arg === '--fix') {
      flags.fix = true;
    } else if (arg === '--all') {
      flags.all = true;
    } else if (arg === '--auto') {
      flags.auto = true;
    } else if (arg.startsWith('--depth=')) {
      flags.depth = arg.slice('--depth='.length);
    } else if (arg.startsWith('--files=')) {
      flags.files = arg.slice('--files='.length);
    }
  }

  // --all and --auto imply --fix
  if (flags.all || flags.auto) {
    flags.fix = true;
  }

  return flags;
}

/**
 * Determine which workflow to dispatch based on parsed flags.
 *
 * Returns the workflow filename (relative to workflows/) that the orchestrator
 * should load:
 *  - 'code-review-fix.md'  when fix=true (--fix, --all, or --auto present)
 *  - 'code-review.md'      otherwise (review-only pass)
 *
 * @param {CodeReviewFlags} flags
 * @returns {'code-review.md' | 'code-review-fix.md'}
 */
function resolveCodeReviewWorkflow(flags) {
  return flags.fix ? 'code-review-fix.md' : 'code-review.md';
}

module.exports = { parseCodeReviewFlags, resolveCodeReviewWorkflow };
