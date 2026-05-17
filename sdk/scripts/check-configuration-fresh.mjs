#!/usr/bin/env node
/**
 * Freshness check for get-shit-done/bin/lib/configuration.generated.cjs.
 *
 * Re-runs the generator in-memory, compares to the committed file,
 * exits 0 if equal, 1 if not.
 *
 * Usage: node sdk/scripts/check-configuration-fresh.mjs
 * Or:    cd sdk && npm run check:configuration-fresh
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');

const { buildConfigurationCjs } = await import('./gen-configuration.mjs');

const expected = buildConfigurationCjs();
const committedPath = resolve(repoRoot, 'get-shit-done', 'bin', 'lib', 'configuration.generated.cjs');

let committed;
try {
  committed = readFileSync(committedPath, 'utf-8');
} catch (err) {
  console.error(`configuration.generated.cjs not found at ${committedPath}`);
  console.error('Run: cd sdk && npm run gen:configuration');
  process.exit(1);
}

if (committed === expected) {
  console.log('configuration.generated.cjs is fresh');
  process.exit(0);
} else {
  console.error('configuration.generated.cjs is STALE. Regenerate with:');
  console.error('  cd sdk && npm run gen:configuration');
  process.exit(1);
}
