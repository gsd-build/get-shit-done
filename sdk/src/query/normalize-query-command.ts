/**
 * Normalize `gsd-sdk query <argv...>` command tokens to match `createRegistry()` keys.
 *
 * `gsd-tools` takes a top-level command plus a subcommand (`state json`, `init execute-phase 9`).
 * The SDK CLI originally passed only argv[0] as the registry key, so `query state json` dispatched
 * `state` (unknown) instead of `state.json`. This module merges the same prefixes gsd-tools nests
 * under `runCommand()` so two-token (and longer) invocations resolve to dotted registry names.
 */

const MERGE_FIRST_WITH_SUBCOMMAND = new Set<string>([
  'state',
  'template',
  'frontmatter',
  'verify',
  'phase',
  'phases',
  'roadmap',
  'requirements',
  'validate',
  'init',
  'workstream',
  'intel',
  'learnings',
  'uat',
  'todo',
  'milestone',
  'check',
  'detect',
  'route',
]);

/**
 * @param command - First token after `query` (e.g. `state`, `init`, `config-get`)
 * @param args - Remaining tokens (flags like `--pick` should already be stripped)
 * @returns Registry command string and handler args
 */
export function normalizeQueryCommand(command: string, args: string[]): [string, string[]] {
  if (command === 'scaffold') {
    return ['phase.scaffold', args];
  }

  if (command === 'state' && args.length === 0) {
    return ['state.load', []];
  }

  if (MERGE_FIRST_WITH_SUBCOMMAND.has(command) && args.length > 0) {
    const sub = args[0];
    return [`${command}.${sub}`, args.slice(1)];
  }

  if ((command === 'progress' || command === 'stats') && args.length > 0) {
    return [`${command}.${args[0]}`, args.slice(1)];
  }

  return [command, args];
}
