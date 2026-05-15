#!/usr/bin/env node
/**
 * Freshness check for schema-detect.generated.cjs.
 *
 * Regenerates the expected CJS content in-memory (without writing to disk) and
 * compares it to the committed file. Exits 0 if they match, 1 if stale.
 *
 * Run: node sdk/scripts/check-schema-detect-fresh.mjs
 * (Requires sdk/dist to be built first — `npm run build` in sdk/.)
 */

import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSchemaDetectCjs } from './gen-schema-detect.mjs';

const here = dirname(fileURLToPath(import.meta.url));

const expected = await buildSchemaDetectCjs();

const committedPath = resolve(here, '..', '..', 'get-shit-done', 'bin', 'lib', 'schema-detect.generated.cjs');
const committed = await readFile(committedPath, 'utf-8');

if (expected === committed) {
  console.log('schema-detect.generated.cjs is fresh');
  process.exit(0);
} else {
  console.error('schema-detect.generated.cjs is STALE.');
  console.error('Regenerate: cd sdk && npm run gen:schema-detect');
  process.exit(1);
}
