'use strict';

const { VALIDATE_SUBCOMMANDS } = require('./command-aliases.generated.cjs');

function routeValidateCommand({ verify, args, cwd, raw, parseNamedArgs, output, error }) {
  const subcommand = args[1];

  if (subcommand === 'consistency') {
    verify.cmdValidateConsistency(cwd, raw);
  } else if (subcommand === 'health') {
    const repairFlag = args.includes('--repair');
    const backfillFlag = args.includes('--backfill');
    verify.cmdValidateHealth(cwd, { repair: repairFlag, backfill: backfillFlag }, raw);
  } else if (subcommand === 'agents') {
    verify.cmdValidateAgents(cwd, raw);
  } else if (subcommand === 'context') {
    const opts = parseNamedArgs(args, ['tokens-used', 'context-window']);
    if (opts['tokens-used'] === null) {
      error('--tokens-used <integer> is required for `validate context`');
      return;
    }
    if (opts['context-window'] === null) {
      error('--context-window <integer> is required for `validate context`');
      return;
    }
    const { classifyContextUtilization, STATES } = require('./context-utilization.cjs');
    const RECOMMENDATIONS = {
      [STATES.HEALTHY]: null,
      [STATES.WARNING]: 'Context is approaching the fracture zone — consider /gsd-thread to continue in a fresh window.',
      [STATES.CRITICAL]: 'Reasoning quality may degrade past 70% utilization (fracture point). Run /gsd-thread now to preserve output quality.',
    };
    let classified;
    try {
      classified = classifyContextUtilization(Number(opts['tokens-used']), Number(opts['context-window']));
    } catch (e) {
      const flag = /tokensUsed/.test(e.message) ? '--tokens-used' : '--context-window';
      error(`${flag} must be a non-negative integer (window > 0), got the values supplied`);
      return;
    }
    const result = { ...classified, recommendation: RECOMMENDATIONS[classified.state] };
    if (args.includes('--json')) {
      output(result, raw);
    } else {
      const lines = [`Context utilization: ${result.percent}% (${result.state})`];
      if (result.recommendation) lines.push(result.recommendation);
      output(result, true, lines.join('\n'));
    }
  } else {
    error(`Unknown validate subcommand. Available: ${VALIDATE_SUBCOMMANDS.join(', ')}`);
  }
}

module.exports = {
  routeValidateCommand,
};
