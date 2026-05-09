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
import { NON_FAMILY_COMMAND_MANIFEST } from '../src/query/command-manifest.non-family.js';

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

  // Non-family entries — sorted by canonical for deterministic output.
  const nonFamilyEntries = [...NON_FAMILY_COMMAND_MANIFEST]
    .sort((a, b) => a.canonical.localeCompare(b.canonical))
    .map((entry) => ({
      canonical: entry.canonical,
      aliases: [...entry.aliases],
      mutation: entry.mutation,
    }));

  // Serialise a FamilyCommandAlias entry as a single-line TS literal.
  function serializeFamily(e: { canonical: string; aliases: string[]; subcommand: string; mutation: boolean }): string {
    const aliases = `[${e.aliases.map((a) => `'${a}'`).join(', ')}]`;
    return `{ canonical: '${e.canonical}', aliases: ${aliases}, subcommand: '${e.subcommand}', mutation: ${e.mutation} }`;
  }

  // Serialise a NonFamilyCommandAlias entry as a single-line TS literal.
  function serializeNonFamily(e: { canonical: string; aliases: string[]; mutation: boolean }): string {
    const aliases = `[${e.aliases.map((a) => `'${a}'`).join(', ')}]`;
    return `{ canonical: '${e.canonical}', aliases: ${aliases}, mutation: ${e.mutation} }`;
  }

  function renderFamilyArray(entries: { canonical: string; aliases: string[]; subcommand: string; mutation: boolean }[]): string {
    return `[\n${entries.map((e) => `  ${serializeFamily(e)},`).join('\n')}\n]`;
  }

  function renderNonFamilyArray(entries: { canonical: string; aliases: string[]; mutation: boolean }[]): string {
    return `[\n${entries.map((e) => `  ${serializeNonFamily(e)},`).join('\n')}\n]`;
  }

  const tsOutPath = fileURLToPath(new URL('../src/query/command-aliases.generated.ts', import.meta.url));
  const tsHeader = `/**\n * GENERATED FILE — command alias expansion for state.*, verify.*, init.*, phase.*, phases.*, validate.*, roadmap.*, and non-family commands.\n * Source: sdk/src/query/command-manifest.{state,verify,init,phase,phases,validate,roadmap,non-family}.ts\n */\n\n`;
  const tsBody = [
    'export interface FamilyCommandAlias {',
    '  canonical: string;',
    '  aliases: string[];',
    '  subcommand: string;',
    '  mutation: boolean;',
    '}',
    '',
    `export const STATE_COMMAND_ALIASES: readonly FamilyCommandAlias[] = ${renderFamilyArray(stateEntries)} as const;`,
    '',
    `export const VERIFY_COMMAND_ALIASES: readonly FamilyCommandAlias[] = ${renderFamilyArray(verifyEntries)} as const;`,
    '',
    `export const INIT_COMMAND_ALIASES: readonly FamilyCommandAlias[] = ${renderFamilyArray(initEntries)} as const;`,
    '',
    `export const PHASE_COMMAND_ALIASES: readonly FamilyCommandAlias[] = ${renderFamilyArray(phaseEntries)} as const;`,
    '',
    `export const PHASES_COMMAND_ALIASES: readonly FamilyCommandAlias[] = ${renderFamilyArray(phasesEntries)} as const;`,
    '',
    `export const VALIDATE_COMMAND_ALIASES: readonly FamilyCommandAlias[] = ${renderFamilyArray(validateEntries)} as const;`,
    '',
    `export const ROADMAP_COMMAND_ALIASES: readonly FamilyCommandAlias[] = ${renderFamilyArray(roadmapEntries)} as const;`,
    '',
    'export interface NonFamilyCommandAlias {',
    '  canonical: string;',
    '  aliases: string[];',
    '  mutation: boolean;',
    '}',
    '',
    `export const NON_FAMILY_COMMAND_ALIASES: readonly NonFamilyCommandAlias[] = ${renderNonFamilyArray(nonFamilyEntries)} as const;`,
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
  await writeFile(tsOutPath, tsHeader + tsBody, 'utf-8');

  // Also generate the CJS mirror used by get-shit-done/bin/lib/ seams.
  // CJS is plain JavaScript — no type annotations.
  const cjsOutPath = fileURLToPath(new URL('../../get-shit-done/bin/lib/command-aliases.generated.cjs', import.meta.url));
  const cjsHeader = `'use strict';\n\n/**\n * GENERATED FILE — state.*, verify.*, init.*, phase.*, phases.*, validate.*, roadmap.*, and non-family alias/subcommand metadata for CJS routing.\n * Source: sdk/src/query/command-manifest.{state,verify,init,phase,phases,validate,roadmap,non-family}.ts\n */\n\n`;
  const cjsBody = [
    `const STATE_COMMAND_ALIASES = ${JSON.stringify(stateEntries, null, 2)};`,
    '',
    `const VERIFY_COMMAND_ALIASES = ${JSON.stringify(verifyEntries, null, 2)};`,
    '',
    `const INIT_COMMAND_ALIASES = ${JSON.stringify(initEntries, null, 2)};`,
    '',
    `const PHASE_COMMAND_ALIASES = ${JSON.stringify(phaseEntries, null, 2)};`,
    '',
    `const PHASES_COMMAND_ALIASES = ${JSON.stringify(phasesEntries, null, 2)};`,
    '',
    `const VALIDATE_COMMAND_ALIASES = ${JSON.stringify(validateEntries, null, 2)};`,
    '',
    `const ROADMAP_COMMAND_ALIASES = ${JSON.stringify(roadmapEntries, null, 2)};`,
    '',
    `const NON_FAMILY_COMMAND_ALIASES = ${JSON.stringify(nonFamilyEntries, null, 2)};`,
    '',
    `const STATE_SUBCOMMANDS = STATE_COMMAND_ALIASES.map((entry) => entry.subcommand);`,
    `const VERIFY_SUBCOMMANDS = VERIFY_COMMAND_ALIASES.map((entry) => entry.subcommand);`,
    `const INIT_SUBCOMMANDS = INIT_COMMAND_ALIASES.map((entry) => entry.subcommand);`,
    `const PHASE_SUBCOMMANDS = PHASE_COMMAND_ALIASES.map((entry) => entry.subcommand);`,
    `const PHASES_SUBCOMMANDS = PHASES_COMMAND_ALIASES.map((entry) => entry.subcommand);`,
    `const VALIDATE_SUBCOMMANDS = VALIDATE_COMMAND_ALIASES.map((entry) => entry.subcommand);`,
    `const ROADMAP_SUBCOMMANDS = ROADMAP_COMMAND_ALIASES.map((entry) => entry.subcommand);`,
    '',
    `module.exports = {`,
    `  STATE_COMMAND_ALIASES,`,
    `  VERIFY_COMMAND_ALIASES,`,
    `  INIT_COMMAND_ALIASES,`,
    `  PHASE_COMMAND_ALIASES,`,
    `  PHASES_COMMAND_ALIASES,`,
    `  VALIDATE_COMMAND_ALIASES,`,
    `  ROADMAP_COMMAND_ALIASES,`,
    `  NON_FAMILY_COMMAND_ALIASES,`,
    `  STATE_SUBCOMMANDS,`,
    `  VERIFY_SUBCOMMANDS,`,
    `  INIT_SUBCOMMANDS,`,
    `  PHASE_SUBCOMMANDS,`,
    `  PHASES_SUBCOMMANDS,`,
    `  VALIDATE_SUBCOMMANDS,`,
    `  ROADMAP_SUBCOMMANDS,`,
    `};`,
  ].join('\n');
  await writeFile(cjsOutPath, cjsHeader + cjsBody, 'utf-8');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
