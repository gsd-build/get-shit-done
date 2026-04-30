import type { CommandManifestEntry } from './command-manifest.types.js';

/**
 * Canonical verify.* command manifest.
 */
export const VERIFY_COMMAND_MANIFEST: readonly CommandManifestEntry[] = [
  { family: 'verify', canonical: 'verify.plan-structure', aliases: ['verify plan-structure'], mutation: false, outputMode: 'json' },
  { family: 'verify', canonical: 'verify.phase-completeness', aliases: ['verify phase-completeness'], mutation: false, outputMode: 'json' },
  { family: 'verify', canonical: 'verify.references', aliases: ['verify references'], mutation: false, outputMode: 'json' },
  { family: 'verify', canonical: 'verify.commits', aliases: ['verify commits'], mutation: false, outputMode: 'json' },
  { family: 'verify', canonical: 'verify.artifacts', aliases: ['verify artifacts'], mutation: false, outputMode: 'json' },
  { family: 'verify', canonical: 'verify.key-links', aliases: ['verify key-links'], mutation: false, outputMode: 'json' },
  { family: 'verify', canonical: 'verify.schema-drift', aliases: ['verify schema-drift'], mutation: false, outputMode: 'json' },
  { family: 'verify', canonical: 'verify.codebase-drift', aliases: ['verify codebase-drift'], mutation: false, outputMode: 'json' },
] as const;
