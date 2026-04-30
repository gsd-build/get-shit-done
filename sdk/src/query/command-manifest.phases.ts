import type { CommandManifestEntry } from './command-manifest.types.js';

/**
 * Canonical phases.* command manifest.
 * Note: `phases.archive` is SDK-only; CJS `gsd-tools phases` currently supports list/clear.
 */
export const PHASES_COMMAND_MANIFEST: readonly CommandManifestEntry[] = [
  { family: 'phases', canonical: 'phases.list', aliases: ['phases list'], mutation: false, outputMode: 'json' },
  { family: 'phases', canonical: 'phases.clear', aliases: ['phases clear'], mutation: true, outputMode: 'json' },
  { family: 'phases', canonical: 'phases.archive', aliases: ['phases archive'], mutation: true, outputMode: 'json' },
] as const;
