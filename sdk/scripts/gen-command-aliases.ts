#!/usr/bin/env node
/**
 * Build-time alias generator skeleton for command-manifest-driven routing.
 *
 * This pilot commits generated artifacts directly; this script documents and
 * preserves the generation seam so future command families can be migrated
 * without hand-maintained alias duplication.
 */

import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { STATE_COMMAND_MANIFEST } from '../src/query/command-manifest.state.js';
import { VERIFY_COMMAND_MANIFEST } from '../src/query/command-manifest.verify.js';
import { INIT_COMMAND_MANIFEST } from '../src/query/command-manifest.init.js';
import { PHASE_COMMAND_MANIFEST } from '../src/query/command-manifest.phase.js';
import { PHASES_COMMAND_MANIFEST } from '../src/query/command-manifest.phases.js';
import { VALIDATE_COMMAND_MANIFEST } from '../src/query/command-manifest.validate.js';
import { ROADMAP_COMMAND_MANIFEST } from '../src/query/command-manifest.roadmap.js';

function toSubcommand(canonical: string, family: 'state' | 'verify' | 'init' | 'phase' | 'phases' | 'validate' | 'roadmap'): string {
  const prefix = `${family}.`;
  return canonical.startsWith(prefix) ? canonical.slice(prefix.length) : canonical;
}

async function main(): Promise<void> {
  const stateEntries = STATE_COMMAND_MANIFEST.map((entry) => ({
    canonical: entry.canonical,
    aliases: entry.aliases,
    subcommand: toSubcommand(entry.canonical, 'state'),
    mutation: entry.mutation,
  }));

  const verifyEntries = VERIFY_COMMAND_MANIFEST.map((entry) => ({
    canonical: entry.canonical,
    aliases: entry.aliases,
    subcommand: toSubcommand(entry.canonical, 'verify'),
    mutation: entry.mutation,
  }));

  const initEntries = INIT_COMMAND_MANIFEST.map((entry) => ({
    canonical: entry.canonical,
    aliases: entry.aliases,
    subcommand: toSubcommand(entry.canonical, 'init'),
    mutation: entry.mutation,
  }));

  const phaseEntries = PHASE_COMMAND_MANIFEST.map((entry) => ({
    canonical: entry.canonical,
    aliases: entry.aliases,
    subcommand: toSubcommand(entry.canonical, 'phase'),
    mutation: entry.mutation,
  }));

  const phasesEntries = PHASES_COMMAND_MANIFEST.map((entry) => ({
    canonical: entry.canonical,
    aliases: entry.aliases,
    subcommand: toSubcommand(entry.canonical, 'phases'),
    mutation: entry.mutation,
  }));

  const validateEntries = VALIDATE_COMMAND_MANIFEST.map((entry) => ({
    canonical: entry.canonical,
    aliases: entry.aliases,
    subcommand: toSubcommand(entry.canonical, 'validate'),
    mutation: entry.mutation,
  }));

  const roadmapEntries = ROADMAP_COMMAND_MANIFEST.map((entry) => ({
    canonical: entry.canonical,
    aliases: entry.aliases,
    subcommand: toSubcommand(entry.canonical, 'roadmap'),
    mutation: entry.mutation,
  }));

  const outPath = fileURLToPath(new URL('../src/query/command-aliases.generated.ts', import.meta.url));
  const header = `/**\n * GENERATED FILE — command alias expansion for state.*, verify.*, init.*, phase.*, phases.*, validate.*, and roadmap.* pilots.\n * Source: sdk/src/query/command-manifest.{state,verify,init,phase,phases,validate,roadmap}.ts\n */\n\n`;
  const body = [
    `export const STATE_COMMAND_ALIASES = ${JSON.stringify(stateEntries, null, 2)} as const;`,
    '',
    `export const VERIFY_COMMAND_ALIASES = ${JSON.stringify(verifyEntries, null, 2)} as const;`,
    '',
    `export const INIT_COMMAND_ALIASES = ${JSON.stringify(initEntries, null, 2)} as const;`,
    '',
    `export const PHASE_COMMAND_ALIASES = ${JSON.stringify(phaseEntries, null, 2)} as const;`,
    '',
    `export const PHASES_COMMAND_ALIASES = ${JSON.stringify(phasesEntries, null, 2)} as const;`,
    '',
    `export const VALIDATE_COMMAND_ALIASES = ${JSON.stringify(validateEntries, null, 2)} as const;`,
    '',
    `export const ROADMAP_COMMAND_ALIASES = ${JSON.stringify(roadmapEntries, null, 2)} as const;`,
    '',
    'export const STATE_SUBCOMMANDS = new Set<string>(STATE_COMMAND_ALIASES.map((entry) => entry.subcommand));',
    'export const VERIFY_SUBCOMMANDS = new Set<string>(VERIFY_COMMAND_ALIASES.map((entry) => entry.subcommand));',
    'export const INIT_SUBCOMMANDS = new Set<string>(INIT_COMMAND_ALIASES.map((entry) => entry.subcommand));',
    'export const PHASE_SUBCOMMANDS = new Set<string>(PHASE_COMMAND_ALIASES.map((entry) => entry.subcommand));',
    'export const PHASES_SUBCOMMANDS = new Set<string>(PHASES_COMMAND_ALIASES.map((entry) => entry.subcommand));',
    'export const VALIDATE_SUBCOMMANDS = new Set<string>(VALIDATE_COMMAND_ALIASES.map((entry) => entry.subcommand));',
    'export const ROADMAP_SUBCOMMANDS = new Set<string>(ROADMAP_COMMAND_ALIASES.map((entry) => entry.subcommand));',
    '',
    'export const STATE_MUTATION_COMMANDS: readonly string[] = STATE_COMMAND_ALIASES',
    '  .filter((entry) => entry.mutation)',
    '  .flatMap((entry) => [entry.canonical, ...entry.aliases]);',
    '',
    'export const PHASE_MUTATION_COMMANDS: readonly string[] = PHASE_COMMAND_ALIASES',
    '  .filter((entry) => entry.mutation)',
    '  .flatMap((entry) => [entry.canonical, ...entry.aliases]);',
    '',
    'export const PHASES_MUTATION_COMMANDS: readonly string[] = PHASES_COMMAND_ALIASES',
    '  .filter((entry) => entry.mutation)',
    '  .flatMap((entry) => [entry.canonical, ...entry.aliases]);',
    '',
    'export const ROADMAP_MUTATION_COMMANDS: readonly string[] = ROADMAP_COMMAND_ALIASES',
    '  .filter((entry) => entry.mutation)',
    '  .flatMap((entry) => [entry.canonical, ...entry.aliases]);',
    '',
  ].join('\n');
  await writeFile(outPath, header + body, 'utf-8');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
