'use strict';

/**
 * CJS Command Router Adapter Module
 *
 * Compatibility routing for gsd-tools.cjs command families. Uses generated
 * command metadata for availability and small family-local argument shapers for
 * CJS handler calls.
 */

function routeCjsCommandFamily({
  args,
  subcommands,
  handlers,
  defaultSubcommand,
  unsupported = {},
  unknownMessage,
  error,
}) {
  const subcommand = args[1] || defaultSubcommand;

  if (subcommand && unsupported[subcommand]) {
    error(unsupported[subcommand]);
    return;
  }

  const handler = subcommand ? handlers[subcommand] : null;
  if (handler) {
    handler();
    return;
  }

  const available = subcommands.filter(s => !unsupported[s]);
  error(unknownMessage(subcommand, available));
}

module.exports = {
  routeCjsCommandFamily,
};
