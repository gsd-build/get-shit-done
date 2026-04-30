import type { CommandManifestEntry } from './command-manifest.types.js';

/**
 * Canonical init.* command manifest.
 */
export const INIT_COMMAND_MANIFEST: readonly CommandManifestEntry[] = [
  { family: 'init', canonical: 'init.execute-phase', aliases: ['init execute-phase'], mutation: false, outputMode: 'json' },
  { family: 'init', canonical: 'init.plan-phase', aliases: ['init plan-phase'], mutation: false, outputMode: 'json' },
  { family: 'init', canonical: 'init.new-project', aliases: ['init new-project'], mutation: false, outputMode: 'json' },
  { family: 'init', canonical: 'init.new-milestone', aliases: ['init new-milestone'], mutation: false, outputMode: 'json' },
  { family: 'init', canonical: 'init.quick', aliases: ['init quick'], mutation: false, outputMode: 'json' },
  { family: 'init', canonical: 'init.ingest-docs', aliases: ['init ingest-docs'], mutation: false, outputMode: 'json' },
  { family: 'init', canonical: 'init.resume', aliases: ['init resume'], mutation: false, outputMode: 'json' },
  { family: 'init', canonical: 'init.verify-work', aliases: ['init verify-work'], mutation: false, outputMode: 'json' },
  { family: 'init', canonical: 'init.phase-op', aliases: ['init phase-op'], mutation: false, outputMode: 'json' },
  { family: 'init', canonical: 'init.todos', aliases: ['init todos'], mutation: false, outputMode: 'json' },
  { family: 'init', canonical: 'init.milestone-op', aliases: ['init milestone-op'], mutation: false, outputMode: 'json' },
  { family: 'init', canonical: 'init.map-codebase', aliases: ['init map-codebase'], mutation: false, outputMode: 'json' },
  { family: 'init', canonical: 'init.progress', aliases: ['init progress'], mutation: false, outputMode: 'json' },
  { family: 'init', canonical: 'init.manager', aliases: ['init manager'], mutation: false, outputMode: 'json' },
  { family: 'init', canonical: 'init.new-workspace', aliases: ['init new-workspace'], mutation: false, outputMode: 'json' },
  { family: 'init', canonical: 'init.list-workspaces', aliases: ['init list-workspaces'], mutation: false, outputMode: 'json' },
  { family: 'init', canonical: 'init.remove-workspace', aliases: ['init remove-workspace'], mutation: false, outputMode: 'json' },
] as const;
