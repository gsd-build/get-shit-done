'use strict';

const { PHASE_SUBCOMMANDS } = require('./command-aliases.generated.cjs');

function routePhaseCommand({ phase, args, cwd, raw, error }) {
  const subcommand = args[1];

  if (subcommand === 'next-decimal') {
    phase.cmdPhaseNextDecimal(cwd, args[2], raw);
  } else if (subcommand === 'add') {
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
  } else if (subcommand === 'add-batch') {
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
  } else if (subcommand === 'insert') {
    phase.cmdPhaseInsert(cwd, args[2], args.slice(3).join(' '), raw);
  } else if (subcommand === 'remove') {
    const forceFlag = args.includes('--force');
    phase.cmdPhaseRemove(cwd, args[2], { force: forceFlag }, raw);
  } else if (subcommand === 'complete') {
    phase.cmdPhaseComplete(cwd, args[2], raw);
  } else {
    error(`Unknown phase subcommand. Available: ${PHASE_SUBCOMMANDS.filter((s) => s !== 'list-plans' && s !== 'list-artifacts' && s !== 'scaffold').join(', ')}`);
  }
}

module.exports = {
  routePhaseCommand,
};
