// @ts-check
'use strict';

/**
 * Shared argument parsing utilities for command modules.
 *
 * Generic flag extraction from argv arrays.
 * Zero runtime dependencies. CJS module.
 */

/**
 * Extract the value after a given --flag from an args array.
 * Returns null if flag not found or no value follows.
 *
 * @param {string[]} args - CLI arguments array
 * @param {string} flag - Flag name without dashes (e.g., 'title' for --title)
 * @returns {string | null}
 */
function parseFlag(args, flag) {
  const flagStr = `--${flag}`;
  const idx = args.indexOf(flagStr);
  if (idx === -1 || idx + 1 >= args.length) return null;
  return args[idx + 1];
}

module.exports = { parseFlag };
