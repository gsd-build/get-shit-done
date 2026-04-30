'use strict';

const { INIT_SUBCOMMANDS } = require('./command-aliases.generated.cjs');

function routeInitCommand({ init, args, cwd, raw, parseNamedArgs, error }) {
  const workflow = args[1];
  switch (workflow) {
    case 'execute-phase': {
      const { validate: epValidate, tdd: epTdd } = parseNamedArgs(args, [], ['validate', 'tdd']);
      init.cmdInitExecutePhase(cwd, args[2], raw, { validate: epValidate, tdd: epTdd });
      break;
    }
    case 'plan-phase': {
      const { validate: ppValidate, tdd: ppTdd } = parseNamedArgs(args, [], ['validate', 'tdd']);
      init.cmdInitPlanPhase(cwd, args[2], raw, { validate: ppValidate, tdd: ppTdd });
      break;
    }
    case 'new-project':
      init.cmdInitNewProject(cwd, raw);
      break;
    case 'new-milestone':
      init.cmdInitNewMilestone(cwd, raw);
      break;
    case 'quick':
      init.cmdInitQuick(cwd, args.slice(2).join(' '), raw);
      break;
    case 'ingest-docs':
      init.cmdInitIngestDocs(cwd, raw);
      break;
    case 'resume':
      init.cmdInitResume(cwd, raw);
      break;
    case 'verify-work':
      init.cmdInitVerifyWork(cwd, args[2], raw);
      break;
    case 'phase-op':
      init.cmdInitPhaseOp(cwd, args[2], raw);
      break;
    case 'todos':
      init.cmdInitTodos(cwd, args[2], raw);
      break;
    case 'milestone-op':
      init.cmdInitMilestoneOp(cwd, raw);
      break;
    case 'map-codebase':
      init.cmdInitMapCodebase(cwd, raw);
      break;
    case 'progress':
      init.cmdInitProgress(cwd, raw);
      break;
    case 'manager':
      init.cmdInitManager(cwd, raw);
      break;
    case 'new-workspace':
      init.cmdInitNewWorkspace(cwd, raw);
      break;
    case 'list-workspaces':
      init.cmdInitListWorkspaces(cwd, raw);
      break;
    case 'remove-workspace':
      init.cmdInitRemoveWorkspace(cwd, args[2], raw);
      break;
    default:
      error(`Unknown init workflow: ${workflow}\nAvailable: ${INIT_SUBCOMMANDS.join(', ')}`);
  }
}

module.exports = {
  routeInitCommand,
};
