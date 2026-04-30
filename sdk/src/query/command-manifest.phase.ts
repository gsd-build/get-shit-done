import type { CommandManifestEntry } from './command-manifest.types.js';

/**
 * Canonical phase.* command manifest.
 */
export const PHASE_COMMAND_MANIFEST: readonly CommandManifestEntry[] = [
  { family: 'phase', canonical: 'phase.list-plans', aliases: ['phase list-plans'], mutation: false, outputMode: 'json' },
  { family: 'phase', canonical: 'phase.list-artifacts', aliases: ['phase list-artifacts'], mutation: false, outputMode: 'json' },
  { family: 'phase', canonical: 'phase.next-decimal', aliases: ['phase next-decimal'], mutation: false, outputMode: 'json' },
  { family: 'phase', canonical: 'phase.add', aliases: ['phase add'], mutation: true, outputMode: 'json' },
  { family: 'phase', canonical: 'phase.add-batch', aliases: ['phase add-batch'], mutation: true, outputMode: 'json' },
  { family: 'phase', canonical: 'phase.insert', aliases: ['phase insert'], mutation: true, outputMode: 'json' },
  { family: 'phase', canonical: 'phase.remove', aliases: ['phase remove'], mutation: true, outputMode: 'json' },
  { family: 'phase', canonical: 'phase.complete', aliases: ['phase complete'], mutation: true, outputMode: 'json' },
  { family: 'phase', canonical: 'phase.scaffold', aliases: ['phase scaffold'], mutation: true, outputMode: 'json' },
] as const;
