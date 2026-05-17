#!/usr/bin/env node
/**
 * Freshness check for project-root.generated.cjs.
 *
 * Regenerates the expected CJS content in-memory (without writing to disk) and
 * compares it to the committed file. Exits 0 if they match, 1 if stale.
 *
 * Uses Phase 3's cleaner pattern: imports buildProjectRootCjs() from the
 * generator directly rather than duplicating the build logic.
 *
 * Run: node sdk/scripts/check-project-root-fresh.mjs
 * (Requires sdk/dist to be built first — `npm run build` in sdk/.)
 */

import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

// Import the generator function directly (avoids duplicating logic).
const { buildProjectRootCjs } = await import('./gen-project-root.mjs');

const expected = await buildProjectRootCjs();

const committedPath = resolve(here, '..', '..', 'get-shit-done', 'bin', 'lib', 'project-root.generated.cjs');
const committed = await readFile(committedPath, 'utf-8');

if (expected === committed) {
  console.log('project-root.generated.cjs is fresh');
  process.exit(0);
} else {
  console.error('project-root.generated.cjs is STALE.');
  console.error('Regenerate: cd sdk && npm run gen:project-root');
  process.exit(1);
}
