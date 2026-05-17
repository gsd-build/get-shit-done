#!/usr/bin/env node
/**
 * Freshness check for workstream-inventory-builder.generated.cjs.
 *
 * Regenerates the expected CJS content in-memory (without writing to disk) and
 * compares it to the committed file. Exits 0 if they match, 1 if stale.
 *
 * Run: node sdk/scripts/check-workstream-inventory-builder-fresh.mjs
 * (Requires sdk/dist to be built first — `npm run build` in sdk/.)
 */

import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildWorkstreamInventoryBuilderCjs } from './gen-workstream-inventory-builder.mjs';

const here = dirname(fileURLToPath(import.meta.url));

const expected = await buildWorkstreamInventoryBuilderCjs();

const committedPath = resolve(here, '..', '..', 'get-shit-done', 'bin', 'lib', 'workstream-inventory-builder.generated.cjs');
const committed = await readFile(committedPath, 'utf-8');

if (expected === committed) {
  console.log('workstream-inventory-builder.generated.cjs is fresh');
  process.exit(0);
} else {
  console.error('workstream-inventory-builder.generated.cjs is STALE.');
  console.error('Regenerate: cd sdk && npm run gen:workstream-inventory-builder');
  process.exit(1);
}
