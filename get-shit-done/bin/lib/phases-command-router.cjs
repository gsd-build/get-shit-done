'use strict';

/**
 * Manifest-backed phases subcommand router.
 * Keeps gsd-tools.cjs thin while preserving current CJS semantics:
 * - list
 * - clear
 */
function routePhasesCommand({ phase, milestone, args, cwd, raw, error }) {
  const subcommand = args[1];

  if (subcommand === 'list') {
    const typeIndex = args.indexOf('--type');
    const phaseIndex = args.indexOf('--phase');
    const options = {
      type: typeIndex !== -1 ? args[typeIndex + 1] : null,
      phase: phaseIndex !== -1 ? args[phaseIndex + 1] : null,
      includeArchived: args.includes('--include-archived'),
    };
    phase.cmdPhasesList(cwd, options, raw);
  } else if (subcommand === 'clear') {
    milestone.cmdPhasesClear(cwd, raw, args.slice(2));
  } else {
    error('Unknown phases subcommand. Available: list, clear');
  }
}

module.exports = {
  routePhasesCommand,
};
