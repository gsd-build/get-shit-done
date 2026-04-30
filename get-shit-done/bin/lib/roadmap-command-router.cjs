'use strict';

const { ROADMAP_SUBCOMMANDS } = require('./command-aliases.generated.cjs');

function routeRoadmapCommand({ roadmap, args, cwd, raw, error }) {
  const subcommand = args[1];

  if (subcommand === 'get-phase') {
    roadmap.cmdRoadmapGetPhase(cwd, args[2], raw);
  } else if (subcommand === 'analyze') {
    roadmap.cmdRoadmapAnalyze(cwd, raw);
  } else if (subcommand === 'update-plan-progress') {
    roadmap.cmdRoadmapUpdatePlanProgress(cwd, args[2], raw);
  } else if (subcommand === 'annotate-dependencies') {
    roadmap.cmdRoadmapAnnotateDependencies(cwd, args[2], raw);
  } else {
    error(`Unknown roadmap subcommand. Available: ${ROADMAP_SUBCOMMANDS.join(', ')}`);
  }
}

module.exports = {
  routeRoadmapCommand,
};
