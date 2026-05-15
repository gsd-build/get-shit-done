#!/usr/bin/env node
/**
 * Freshness check for workstream-name-policy.generated.cjs.
 *
 * Regenerates the expected CJS content in-memory (without writing to disk) and
 * compares it to the committed file. Exits 0 if they match, 1 if stale.
 *
 * Run: node sdk/scripts/check-workstream-name-policy-fresh.mjs
 * (Requires sdk/dist to be built first — `npm run build` in sdk/.)
 */

import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildWorkstreamNamePolicyCjs } from './gen-workstream-name-policy.mjs';

const here = dirname(fileURLToPath(import.meta.url));

const expected = await buildWorkstreamNamePolicyCjs();

const committedPath = resolve(here, '..', '..', 'get-shit-done', 'bin', 'lib', 'workstream-name-policy.generated.cjs');
const committed = await readFile(committedPath, 'utf-8');

if (expected === committed) {
  console.log('workstream-name-policy.generated.cjs is fresh');
  process.exit(0);
} else {
  console.error('workstream-name-policy.generated.cjs is STALE.');
  console.error('Regenerate: cd sdk && npm run gen:workstream-name-policy');
  process.exit(1);
}
