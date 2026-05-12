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
          const token = args[i];
          if (token === '--raw') {
            continue;
          }
          if (token === '--id') {
            const id = args[i + 1];
            if (!id || id.startsWith('--')) {
              error('--id requires a value');
            }
            customId = id;
            i++;
          } else if (token.startsWith('--')) {
            error(`phase add does not support ${token}`);
          } else {
            descArgs.push(token);
          }
        }
        phase.cmdPhaseAdd(cwd, descArgs.join(' '), raw, customId);
      },
      'add-batch': () => {
        const descFlagIdx = args.indexOf('--descriptions');
        let descriptions;
        if (descFlagIdx !== -1) {
          const rawDescriptions = args[descFlagIdx + 1];
          if (!rawDescriptions || rawDescriptions.startsWith('--')) {
            error('--descriptions must be a JSON array');
          }
          try {
            descriptions = JSON.parse(rawDescriptions);
          } catch {
            error('--descriptions must be a JSON array');
          }
          if (!Array.isArray(descriptions)) {
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
      remove: () => {
        const removeArgs = args.slice(2).filter(token => token !== '--raw');
        let forceFlag = false;
        const positional = [];
        for (const token of removeArgs) {
          if (token === '--force') {
            forceFlag = true;
            continue;
          }
          if (token.startsWith('--')) {
            error(`phase remove does not support ${token}`);
          }
          positional.push(token);
        }
        if (positional.length > 1) {
          error('phase remove accepts exactly one phase number');
        }
        phase.cmdPhaseRemove(cwd, positional[0], { force: forceFlag }, raw);
      },
      complete: () => phase.cmdPhaseComplete(cwd, args[2], raw),
    },
  });
}

module.exports = {
  routePhaseCommand,
};
