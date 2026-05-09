'use strict';

const { PHASES_SUBCOMMANDS } = require('./command-aliases.generated.cjs');
const { routeCjsCommandFamily } = require('./cjs-command-router-adapter.cjs');

/**
 * Manifest-backed phases subcommand router.
 * Keeps gsd-tools.cjs thin while preserving current CJS semantics:
 * - list
 * - clear
 *
 * Note: `archive` is currently SDK-only (`phases.archive` handler in SDK query
 * registry). CJS `gsd-tools phases` intentionally supports list/clear only.
 */
function routePhasesCommand({ phase, milestone, args, cwd, raw, error }) {
  routeCjsCommandFamily({
    args,
    subcommands: PHASES_SUBCOMMANDS.filter((s) => s !== 'archive'),
    error,
    unknownMessage: (_subcommand, available) => `Unknown phases subcommand. Available: ${available.join(', ')}`,
    handlers: {
      list: () => {
        const typeIndex = args.indexOf('--type');
        const phaseIndex = args.indexOf('--phase');
        const options = {
          type: typeIndex !== -1 ? args[typeIndex + 1] : null,
          phase: phaseIndex !== -1 ? args[phaseIndex + 1] : null,
          includeArchived: args.includes('--include-archived'),
        };
        phase.cmdPhasesList(cwd, options, raw);
      },
      clear: () => milestone.cmdPhasesClear(cwd, raw, args.slice(2)),
    },
  });
}

module.exports = {
  routePhasesCommand,
};
