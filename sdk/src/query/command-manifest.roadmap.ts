import type { CommandManifestEntry } from './command-manifest.types.js';

/**
 * Canonical roadmap.* command manifest.
 */
export const ROADMAP_COMMAND_MANIFEST: readonly CommandManifestEntry[] = [
  { family: 'roadmap', canonical: 'roadmap.analyze', aliases: ['roadmap analyze'], mutation: false, outputMode: 'json' },
  { family: 'roadmap', canonical: 'roadmap.get-phase', aliases: ['roadmap get-phase'], mutation: false, outputMode: 'json' },
  { family: 'roadmap', canonical: 'roadmap.update-plan-progress', aliases: ['roadmap update-plan-progress'], mutation: true, outputMode: 'json' },
  { family: 'roadmap', canonical: 'roadmap.annotate-dependencies', aliases: ['roadmap annotate-dependencies'], mutation: true, outputMode: 'json' },
] as const;
