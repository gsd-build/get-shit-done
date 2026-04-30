'use strict';

const { VERIFY_SUBCOMMANDS } = require('./command-aliases.generated.cjs');

function routeVerifyCommand({ verify, args, cwd, raw, error }) {
  const subcommand = args[1];

  if (subcommand === 'plan-structure') {
    verify.cmdVerifyPlanStructure(cwd, args[2], raw);
  } else if (subcommand === 'phase-completeness') {
    verify.cmdVerifyPhaseCompleteness(cwd, args[2], raw);
  } else if (subcommand === 'references') {
    verify.cmdVerifyReferences(cwd, args[2], raw);
  } else if (subcommand === 'commits') {
    verify.cmdVerifyCommits(cwd, args.slice(2), raw);
  } else if (subcommand === 'artifacts') {
    verify.cmdVerifyArtifacts(cwd, args[2], raw);
  } else if (subcommand === 'key-links') {
    verify.cmdVerifyKeyLinks(cwd, args[2], raw);
  } else if (subcommand === 'schema-drift') {
    const rest = args.slice(2);
    const skipFlag = rest.includes('--skip');
    const phaseArg = rest.find((arg) => !arg.startsWith('-'));
    verify.cmdVerifySchemaDrift(cwd, phaseArg, skipFlag, raw);
  } else if (subcommand === 'codebase-drift') {
    verify.cmdVerifyCodebaseDrift(cwd, raw);
  } else {
    error(`Unknown verify subcommand. Available: ${VERIFY_SUBCOMMANDS.join(', ')}`);
  }
}

module.exports = {
  routeVerifyCommand,
};
