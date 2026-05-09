'use strict';

const { PHASE_SUBCOMMANDS } = require('./command-aliases.generated.cjs');
const { routeCjsCommandFamily } = require('./cjs-command-router-adapter.cjs');

function routePhaseCommand({ phase, args, cwd, raw, error }) {
  routeCjsCommandFamily({
    args,
    subcommands: PHASE_SUBCOMMANDS,
    unsupported: {
      'list-plans': 'phase list-plans is SDK-only. Use: gsd-sdk query phase.list-plans ...',
      'list-artifacts': 'phase list-artifacts is SDK-only. Use: gsd-sdk query phase.list-artifacts ...',
      scaffold: 'phase scaffold is routed through the top-level scaffold command.',
    },
    error,
    unknownMessage: (_subcommand, available) => `Unknown phase subcommand. Available: ${available.join(', ')}`,
    handlers: {
      'next-decimal': () => phase.cmdPhaseNextDecimal(cwd, args[2], raw),
      add: () => {
        let customId = null;
        const descArgs = [];
        for (let i = 2; i < args.length; i++) {
          if (args[i] === '--id' && i + 1 < args.length) {
            customId = args[i + 1];
            i++;
          } else {
            descArgs.push(args[i]);
          }
        }
        phase.cmdPhaseAdd(cwd, descArgs.join(' '), raw, customId);
      },
      'add-batch': () => {
        const descFlagIdx = args.indexOf('--descriptions');
        let descriptions;
        if (descFlagIdx !== -1 && args[descFlagIdx + 1]) {
          try {
            descriptions = JSON.parse(args[descFlagIdx + 1]);
          } catch {
            error('--descriptions must be a JSON array');
          }
        } else {
          descriptions = args.slice(2).filter(a => a !== '--raw');
        }
        phase.cmdPhaseAddBatch(cwd, descriptions, raw);
      },
      insert: () => {
        if (args.includes('--dry-run')) {
          error('phase insert does not support --dry-run');
        }
        phase.cmdPhaseInsert(cwd, args[2], args.slice(3).join(' '), raw);
      },
      remove: () => phase.cmdPhaseRemove(cwd, args[2], { force: args.includes('--force') }, raw),
      complete: () => phase.cmdPhaseComplete(cwd, args[2], raw),
    },
  });
}

module.exports = {
  routePhaseCommand,
};
