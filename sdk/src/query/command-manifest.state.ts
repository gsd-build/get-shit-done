import type { CommandManifestEntry } from './command-manifest.types.js';

/**
 * Canonical state.* command manifest.
 *
 * Source of truth for the state family seam. Adapters derive registry aliases,
 * mutation classification, and CJS subcommand routing metadata from this list.
 */
export const STATE_COMMAND_MANIFEST: readonly CommandManifestEntry[] = [
  { family: 'state', canonical: 'state.load', aliases: [], mutation: false, outputMode: 'raw' },
  { family: 'state', canonical: 'state.json', aliases: ['state json'], mutation: false, outputMode: 'json' },
  { family: 'state', canonical: 'state.get', aliases: ['state get'], mutation: false, outputMode: 'json' },
  { family: 'state', canonical: 'state.update', aliases: ['state update'], mutation: true, outputMode: 'json' },
  { family: 'state', canonical: 'state.patch', aliases: ['state patch'], mutation: true, outputMode: 'json' },
  { family: 'state', canonical: 'state.begin-phase', aliases: ['state begin-phase'], mutation: true, outputMode: 'json' },
  { family: 'state', canonical: 'state.advance-plan', aliases: ['state advance-plan'], mutation: true, outputMode: 'json' },
  { family: 'state', canonical: 'state.record-metric', aliases: ['state record-metric'], mutation: true, outputMode: 'json' },
  { family: 'state', canonical: 'state.update-progress', aliases: ['state update-progress'], mutation: true, outputMode: 'json' },
  { family: 'state', canonical: 'state.add-decision', aliases: ['state add-decision'], mutation: true, outputMode: 'json' },
  { family: 'state', canonical: 'state.add-blocker', aliases: ['state add-blocker'], mutation: true, outputMode: 'json' },
  { family: 'state', canonical: 'state.resolve-blocker', aliases: ['state resolve-blocker'], mutation: true, outputMode: 'json' },
  { family: 'state', canonical: 'state.record-session', aliases: ['state record-session'], mutation: true, outputMode: 'json' },
  { family: 'state', canonical: 'state.signal-waiting', aliases: ['state signal-waiting'], mutation: true, outputMode: 'json' },
  { family: 'state', canonical: 'state.signal-resume', aliases: ['state signal-resume'], mutation: true, outputMode: 'json' },
  { family: 'state', canonical: 'state.planned-phase', aliases: ['state planned-phase'], mutation: true, outputMode: 'json' },
  { family: 'state', canonical: 'state.validate', aliases: ['state validate'], mutation: false, outputMode: 'json' },
  { family: 'state', canonical: 'state.sync', aliases: ['state sync'], mutation: true, outputMode: 'json' },
  { family: 'state', canonical: 'state.prune', aliases: ['state prune'], mutation: true, outputMode: 'json' },
  { family: 'state', canonical: 'state.milestone-switch', aliases: ['state milestone-switch'], mutation: true, outputMode: 'json' },
  { family: 'state', canonical: 'state.add-roadmap-evolution', aliases: ['state add-roadmap-evolution'], mutation: true, outputMode: 'json' },
] as const;
