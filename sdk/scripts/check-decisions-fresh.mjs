#!/usr/bin/env node
/**
 * Freshness check for decisions.generated.cjs.
 *
 * Regenerates the expected CJS content in-memory (without writing to disk) and
 * compares it to the committed file. Exits 0 if they match, 1 if stale.
 *
 * Run: node sdk/scripts/check-decisions-fresh.mjs
 * (Requires sdk/dist to be built first — `npm run build` in sdk/.)
 */

import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDecisionsCjs } from './gen-decisions.mjs';

const here = dirname(fileURLToPath(import.meta.url));

const expected = await buildDecisionsCjs();

const committedPath = resolve(here, '..', '..', 'get-shit-done', 'bin', 'lib', 'decisions.generated.cjs');
const committed = await readFile(committedPath, 'utf-8');

if (expected === committed) {
  console.log('decisions.generated.cjs is fresh');
  process.exit(0);
} else {
  console.error('decisions.generated.cjs is STALE.');
  console.error('Regenerate: cd sdk && npm run gen:decisions');
  process.exit(1);
}
