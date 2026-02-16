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
        description: 'Show graph state, layer counts, health indicators, and last activity',
        usage: '/declare:status',
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
