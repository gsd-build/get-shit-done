#!/usr/bin/env node
/**
 * Generator for the Decisions CJS artifact.
 *
 * Reads the compiled ESM output from sdk/dist/query/decisions.js,
 * extracts the relevant function bodies via text transformation,
 * then emits get-shit-done/bin/lib/decisions.generated.cjs.
 *
 * Source-of-truth: sdk/src/query/decisions.ts
 *
 * Run: cd sdk && npm run gen:decisions
 * Freshness check: node sdk/scripts/check-decisions-fresh.mjs
 */

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export const BANNER = `'use strict';

/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Source: sdk/src/query/decisions.ts
 * Regenerate: cd sdk && npm run gen:decisions
 *
 * Shared parser for CONTEXT.md <decisions> blocks.
 * Accepts both numeric (D-42) and alphanumeric (D-INFRA-01) IDs.
 * Returns {id, text, category, tags, trackable} per decision.
 * CJS callers that only use {id, text} safely ignore the extra fields.
 */

`;

export async function buildDecisionsCjs() {
  // Read the compiled ESM source and transform to CJS.
  // We extract only the pure logic (no Node.js imports, no query handler).
  const distPath = fileURLToPath(new URL('../dist/query/decisions.js', import.meta.url));
  const src = await readFile(distPath, 'utf-8');

  // Strip the ESM-specific header lines (import statements, jsdoc at top)
  // and the query handler (which uses Node async fs — not needed in CJS shim).
  // We keep: DISCRETION_HEADINGS, NON_TRACKABLE_TAGS, stripFencedCode,
  // extractDecisionsBlock, parseDecisions.

  // Extract the module body between the imports and the query handler.
  // Strategy: strip the leading imports and the trailing export const decisionsParse block.
  let body = src;

  // Remove leading import statements
  body = body.replace(/^import\s+.*?;[\r\n]*/gm, '');

  // Remove trailing query handler (from the `export const decisionsParse` line to end)
  const handlerStart = body.indexOf('// ─── Query handler');
  if (handlerStart !== -1) {
    body = body.slice(0, handlerStart);
  }

  // Remove ESM export keywords (keep the function/const declarations)
  body = body.replace(/^export (function|const) /gm, '$1 ');

  // Remove source map comment
  body = body.replace(/\/\/# sourceMappingURL=.*$/gm, '');

  // Remove leading file-level jsdoc comment (keep module-level logic only)
  body = body.replace(/^\/\*\*[\s\S]*?\*\/\n/m, '');

  // Trim extra blank lines at start/end
  body = body.trim();

  const parts = [
    BANNER.trimEnd(),
    '',
    body,
    '',
    'module.exports = { parseDecisions };',
    '',
  ];

  return parts.join('\n');
}

async function main() {
  const content = await buildDecisionsCjs();
  const outPath = fileURLToPath(
    new URL('../../get-shit-done/bin/lib/decisions.generated.cjs', import.meta.url),
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
