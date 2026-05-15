#!/usr/bin/env node
/**
 * Generator for the Project-Root Resolution Module CJS artifact.
 *
 * Imports the compiled ESM output from sdk/dist/project-root/index.js,
 * captures findProjectRoot via Function.prototype.toString(), then emits
 * get-shit-done/bin/lib/project-root.generated.cjs.
 *
 * Run: cd sdk && npm run gen:project-root
 * Freshness check: node sdk/scripts/check-project-root-fresh.mjs
 */

import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const BANNER = `'use strict';

/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Source: sdk/src/project-root/index.ts
 * Regenerate: cd sdk && npm run gen:project-root
 *
 * Project-Root Resolution Module — resolves a project root from a starting
 * directory by walking the ancestor chain and applying four heuristics:
 *   (0) own .planning/ guard (#1362)
 *   (1) parent .planning/config.json sub_repos
 *   (2) legacy multiRepo: true + ancestor .git
 *   (3) .git heuristic with parent .planning/
 * Bounded by FIND_PROJECT_ROOT_MAX_DEPTH ancestors. Sync I/O.
 */

`;

/**
 * Build the CJS content string. Exported so the freshness-check script can
 * import this function directly (Phase 3's cleaner pattern) instead of
 * duplicating the logic.
 */
export async function buildProjectRootCjs() {
  const distUrl = new URL('../dist/project-root/index.js', import.meta.url);
  const { findProjectRoot, FIND_PROJECT_ROOT_MAX_DEPTH } = await import(distUrl.href);

  const findProjectRootBody = findProjectRoot.toString();

  // The compiled ESM uses destructured named imports:
  //   import { dirname, resolve, sep, relative, parse as parsePath } from 'node:path';
  //   import { existsSync, readFileSync, statSync } from 'node:fs';
  //   import { homedir } from 'node:os';
  //
  // In CJS we provide these as module-level constants so the function body
  // can reference them as closed-over variables (same technique used in
  // Phase 3 gen-workstream-inventory-builder.mjs for relative/sep/etc.).
  const preamble = [
    `const fs = require('fs');`,
    `const path = require('path');`,
    `const os = require('os');`,
    `const { existsSync, readFileSync, statSync } = fs;`,
    `const { dirname, resolve, sep, relative, parse: parsePath } = path;`,
    `const { homedir } = os;`,
    `const FIND_PROJECT_ROOT_MAX_DEPTH = ${FIND_PROJECT_ROOT_MAX_DEPTH};`,
  ].join('\n');

  const parts = [
    BANNER.trimEnd(),
    '',
    preamble,
    '',
    findProjectRootBody,
    '',
    `module.exports = { findProjectRoot };`,
    '',
  ];

  return parts.join('\n');
}

async function main() {
  const content = await buildProjectRootCjs();
  const outPath = fileURLToPath(
    new URL('../../get-shit-done/bin/lib/project-root.generated.cjs', import.meta.url),
  );
  await writeFile(outPath, content, 'utf-8');
  console.log(`Written: ${outPath}`);
}

// Only run main() when this file is the entry point, not when imported.
// process.argv[1] is already an absolute filesystem path on every platform Node
// supports; comparing directly avoids the Windows URL-parsing bug where
// `C:\\…\\gen-*.mjs` is misread as scheme "c:" by `new URL(...)`.
if (fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
