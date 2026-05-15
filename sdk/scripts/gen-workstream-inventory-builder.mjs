#!/usr/bin/env node
/**
 * Generator for the Workstream Inventory Builder CJS artifact.
 *
 * Reads the compiled ESM output from sdk/dist/workstream-inventory/builder.js,
 * extracts function source via Function.prototype.toString() for exports
 * and via source-text extraction for internal helpers, then emits
 * get-shit-done/bin/lib/workstream-inventory-builder.generated.cjs.
 *
 * Run: cd sdk && npm run gen:workstream-inventory-builder
 * Freshness check: node sdk/scripts/check-workstream-inventory-builder-fresh.mjs
 */

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export const BANNER = `'use strict';

/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Source: sdk/src/workstream-inventory/builder.ts
 * Regenerate: cd sdk && npm run gen:workstream-inventory-builder
 *
 * Workstream Inventory Builder — pure projection from pre-collected
 * filesystem data to typed WorkstreamInventory. No I/O. No async.
 */

`;

/**
 * Extract a top-level function declaration (non-exported) from a JS source
 * string by scanning for `function <name>(` and capturing the entire body
 * including balanced braces.
 */
export function extractFunctionFromSource(source, name) {
  const marker = `function ${name}(`;
  const start = source.indexOf(marker);
  if (start === -1) {
    throw new Error(`Could not find function ${name} in compiled source`);
  }
  // Find the opening brace
  const braceOpen = source.indexOf('{', start);
  if (braceOpen === -1) {
    throw new Error(`Could not find opening brace for function ${name}`);
  }
  // Walk forward counting braces until balanced
  let depth = 0;
  let i = braceOpen;
  for (; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) break;
    }
  }
  if (depth !== 0) {
    throw new Error(`Could not find closing brace for function ${name}`);
  }
  // Return from `function name(` through the closing `}`
  return source.slice(start, i + 1);
}

export async function buildWorkstreamInventoryBuilderCjs() {
  // Load the compiled ESM module to get exports via Function.prototype.toString()
  const distUrl = new URL('../dist/workstream-inventory/builder.js', import.meta.url);
  const {
    buildWorkstreamInventory,
    isCompletedInventory,
  } = await import(distUrl.href);

  // Also read the compiled JS as text to extract non-exported helpers
  const compiledSource = await readFile(fileURLToPath(distUrl), 'utf-8');

  // Extract non-exported helpers from source text
  const toPosixPathBody = extractFunctionFromSource(compiledSource, 'toPosixPath');

  // Get exported function bodies via Function.prototype.toString()
  const isCompletedInventoryBody = isCompletedInventory.toString();
  const buildWorkstreamInventoryBody = buildWorkstreamInventory.toString();

  const parts = [
    BANNER.trimEnd(),
    '',
    "const path = require('path');",
    'const relative = path.relative;',
    '',
    '// Internal helpers',
    toPosixPathBody,
    '',
    isCompletedInventoryBody,
    '',
    buildWorkstreamInventoryBody,
    '',
    'module.exports = { buildWorkstreamInventory, isCompletedInventory };',
    '',
  ];

  return parts.join('\n');
}

async function main() {
  const content = await buildWorkstreamInventoryBuilderCjs();
  const outPath = fileURLToPath(
    new URL('../../get-shit-done/bin/lib/workstream-inventory-builder.generated.cjs', import.meta.url),
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
