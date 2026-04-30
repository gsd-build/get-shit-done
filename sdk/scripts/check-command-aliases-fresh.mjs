#!/usr/bin/env node
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));

const {
  STATE_COMMAND_MANIFEST,
} = await import('../dist/query/command-manifest.state.js');
const {
  VERIFY_COMMAND_MANIFEST,
} = await import('../dist/query/command-manifest.verify.js');
const {
  INIT_COMMAND_MANIFEST,
} = await import('../dist/query/command-manifest.init.js');
const {
  PHASE_COMMAND_MANIFEST,
} = await import('../dist/query/command-manifest.phase.js');
const {
  PHASES_COMMAND_MANIFEST,
} = await import('../dist/query/command-manifest.phases.js');
const {
  VALIDATE_COMMAND_MANIFEST,
} = await import('../dist/query/command-manifest.validate.js');
const {
  ROADMAP_COMMAND_MANIFEST,
} = await import('../dist/query/command-manifest.roadmap.js');

const {
  STATE_COMMAND_ALIASES,
  VERIFY_COMMAND_ALIASES,
  INIT_COMMAND_ALIASES,
  PHASE_COMMAND_ALIASES,
  PHASES_COMMAND_ALIASES,
  VALIDATE_COMMAND_ALIASES,
  ROADMAP_COMMAND_ALIASES,
} = await import('../dist/query/command-aliases.generated.js');

const cjsAliases = require(resolve(here, '..', '..', 'get-shit-done', 'bin', 'lib', 'command-aliases.generated.cjs'));

function toAliasEntries(manifest, family) {
  const prefix = `${family}.`;
  return manifest.map((entry) => ({
    canonical: entry.canonical,
    aliases: [...entry.aliases],
    subcommand: entry.canonical.slice(prefix.length),
    mutation: entry.mutation,
  }));
}

function assertEqual(label, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error(
      `${label} drift detected. Regenerate command alias artifacts and commit them.`,
    );
  }
}

const expectedState = toAliasEntries(STATE_COMMAND_MANIFEST, 'state');
const expectedVerify = toAliasEntries(VERIFY_COMMAND_MANIFEST, 'verify');
const expectedInit = toAliasEntries(INIT_COMMAND_MANIFEST, 'init');
const expectedPhase = toAliasEntries(PHASE_COMMAND_MANIFEST, 'phase');
const expectedPhases = toAliasEntries(PHASES_COMMAND_MANIFEST, 'phases');
const expectedValidate = toAliasEntries(VALIDATE_COMMAND_MANIFEST, 'validate');
const expectedRoadmap = toAliasEntries(ROADMAP_COMMAND_MANIFEST, 'roadmap');

assertEqual('TS STATE_COMMAND_ALIASES', STATE_COMMAND_ALIASES, expectedState);
assertEqual('TS VERIFY_COMMAND_ALIASES', VERIFY_COMMAND_ALIASES, expectedVerify);
assertEqual('TS INIT_COMMAND_ALIASES', INIT_COMMAND_ALIASES, expectedInit);
assertEqual('TS PHASE_COMMAND_ALIASES', PHASE_COMMAND_ALIASES, expectedPhase);
assertEqual('TS PHASES_COMMAND_ALIASES', PHASES_COMMAND_ALIASES, expectedPhases);
assertEqual('TS VALIDATE_COMMAND_ALIASES', VALIDATE_COMMAND_ALIASES, expectedValidate);
assertEqual('TS ROADMAP_COMMAND_ALIASES', ROADMAP_COMMAND_ALIASES, expectedRoadmap);

assertEqual('CJS STATE_COMMAND_ALIASES', cjsAliases.STATE_COMMAND_ALIASES, expectedState);
assertEqual('CJS VERIFY_COMMAND_ALIASES', cjsAliases.VERIFY_COMMAND_ALIASES, expectedVerify);
assertEqual('CJS INIT_COMMAND_ALIASES', cjsAliases.INIT_COMMAND_ALIASES, expectedInit);
assertEqual('CJS PHASE_COMMAND_ALIASES', cjsAliases.PHASE_COMMAND_ALIASES, expectedPhase);
assertEqual('CJS PHASES_COMMAND_ALIASES', cjsAliases.PHASES_COMMAND_ALIASES, expectedPhases);
assertEqual('CJS VALIDATE_COMMAND_ALIASES', cjsAliases.VALIDATE_COMMAND_ALIASES, expectedValidate);
assertEqual('CJS ROADMAP_COMMAND_ALIASES', cjsAliases.ROADMAP_COMMAND_ALIASES, expectedRoadmap);

console.log('command alias artifacts are fresh');
