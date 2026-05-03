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

import { COMMAND_DEFINITIONS_BY_FAMILY } from '../src/query/command-definition.js';

function toSubcommand(canonical: string, family: 'state' | 'verify' | 'init' | 'phase' | 'phases' | 'validate' | 'roadmap'): string {
  const prefix = `${family}.`;
  return canonical.startsWith(prefix) ? canonical.slice(prefix.length) : canonical;
}

async function main(): Promise<void> {
  const stateEntries = COMMAND_DEFINITIONS_BY_FAMILY.state.map((entry) => ({
    canonical: entry.canonical,
    aliases: entry.aliases,
    subcommand: toSubcommand(entry.canonical, 'state'),
    mutation: entry.mutation,
  }));

  const verifyEntries = COMMAND_DEFINITIONS_BY_FAMILY.verify.map((entry) => ({
    canonical: entry.canonical,
    aliases: entry.aliases,
    subcommand: toSubcommand(entry.canonical, 'verify'),
    mutation: entry.mutation,
  }));

  const initEntries = COMMAND_DEFINITIONS_BY_FAMILY.init.map((entry) => ({
    canonical: entry.canonical,
    aliases: entry.aliases,
    subcommand: toSubcommand(entry.canonical, 'init'),
    mutation: entry.mutation,
  }));

  const phaseEntries = COMMAND_DEFINITIONS_BY_FAMILY.phase.map((entry) => ({
    canonical: entry.canonical,
    aliases: entry.aliases,
    subcommand: toSubcommand(entry.canonical, 'phase'),
    mutation: entry.mutation,
  }));

  const phasesEntries = COMMAND_DEFINITIONS_BY_FAMILY.phases.map((entry) => ({
    canonical: entry.canonical,
    aliases: entry.aliases,
    subcommand: toSubcommand(entry.canonical, 'phases'),
    mutation: entry.mutation,
  }));

  const validateEntries = COMMAND_DEFINITIONS_BY_FAMILY.validate.map((entry) => ({
    canonical: entry.canonical,
    aliases: entry.aliases,
    subcommand: toSubcommand(entry.canonical, 'validate'),
    mutation: entry.mutation,
  }));

  const roadmapEntries = COMMAND_DEFINITIONS_BY_FAMILY.roadmap.map((entry) => ({
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

  ].join('\n');
  await writeFile(outPath, header + body, 'utf-8');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
