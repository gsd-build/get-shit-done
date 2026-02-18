// @ts-check
'use strict';

/**
 * /declare:help command logic.
 *
 * Returns structured help information about available Declare commands.
 *
 * Zero runtime dependencies. CJS module.
 */

/**
 * Run the help command.
 *
 * @returns {{ commands: Array<{name: string, description: string, usage: string}>, version: string }}
 */
function runHelp() {
  return {
    commands: [
      {
        name: '/declare:init',
        description: 'Initialize a Declare project with future declarations and graph structure',
        usage: '/declare:init [project-name]',
      },
      {
        name: '/declare:status',
        description: 'Show graph state, coverage, staleness indicators, and last activity',
        usage: '/declare:status',
      },
      {
        name: 'add-declaration',
        description: 'Add a new declaration to FUTURE.md with auto-incremented ID',
        usage: 'add-declaration --title "..." --statement "..."',
      },
      {
        name: 'add-milestone',
        description: 'Add a new milestone to MILESTONES.md linked to declarations',
        usage: 'add-milestone --title "..." --realizes D-01[,D-02]',
      },
      {
        name: 'create-plan',
        description: 'Write action plan (PLAN.md) to milestone folder',
        usage: 'create-plan --milestone M-XX --actions \'[{"title":"...","produces":"..."}]\'',
      },
      {
        name: 'load-graph',
        description: 'Load full graph state as JSON with stats and validation',
        usage: 'load-graph',
      },
      {
        name: '/declare:milestones',
        description: 'Derive milestones backward from declared futures with checkbox confirmation',
        usage: '/declare:milestones [D-XX]',
      },
      {
        name: '/declare:actions',
        description: 'Derive action plans per milestone and write PLAN.md to milestone folders',
        usage: '/declare:actions [M-XX]',
      },
      {
        name: '/declare:help',
        description: 'Show available Declare commands',
        usage: '/declare:help',
      },
    ],
    version: '0.1.0',
  };
}

module.exports = { runHelp };
