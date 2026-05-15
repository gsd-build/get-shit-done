#!/usr/bin/env node
/**
 * Generator for the STATE.md Document Module CJS artifact.
 *
 * Reads the compiled ESM output from sdk/dist/query/state-document.js,
 * extracts function source via Function.prototype.toString() for exports
 * and via source-text extraction for internal helpers, then emits
 * get-shit-done/bin/lib/state-document.generated.cjs.
 *
 * Run: cd sdk && npx tsx scripts/gen-state-document.ts
 * Freshness check: node sdk/scripts/check-state-document-fresh.mjs
 */

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const BANNER = `'use strict';

/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Source: sdk/src/query/state-document.ts
 * Regenerate: cd sdk && npm run gen:state-document
 *
 * STATE.md Document Module — pure transforms for STATE.md text.
 * This module does not read the filesystem and does not own persistence or locking.
 */

`;

/**
 * Extract a top-level function declaration (non-exported) from a JS source
 * string by scanning for `function <name>(` and capturing the entire body
 * including balanced braces.
 */
function extractFunctionFromSource(source: string, name: string): string {
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

export async function buildStateDocumentCjs(): Promise<string> {
  // Load the compiled ESM module to get exports via Function.prototype.toString()
  const distUrl = new URL('../dist/query/state-document.js', import.meta.url);
  const {
    stateExtractField,
    stateReplaceField,
    stateReplaceFieldWithFallback,
    normalizeStateStatus,
    computeProgressPercent,
    shouldPreserveExistingProgress,
    normalizeProgressNumbers,
  } = await import(distUrl.href);

  // Also read the compiled JS as text to extract non-exported helpers
  const compiledSource = await readFile(fileURLToPath(distUrl), 'utf-8');

  // Extract non-exported helpers from source text
  const escapeRegexBody = extractFunctionFromSource(compiledSource, 'escapeRegex');
  const toFiniteNumberBody = extractFunctionFromSource(compiledSource, 'toFiniteNumber');
  const existingProgressExceedsDerivedBody = extractFunctionFromSource(compiledSource, 'existingProgressExceedsDerived');

  // Get exported function bodies via Function.prototype.toString()
  const stateExtractFieldBody = stateExtractField.toString();
  const stateReplaceFieldBody = stateReplaceField.toString();
  const stateReplaceFieldWithFallbackBody = stateReplaceFieldWithFallback.toString();
  const normalizeStateStatusBody = normalizeStateStatus.toString();
  const computeProgressPercentBody = computeProgressPercent.toString();
  const shouldPreserveExistingProgressBody = shouldPreserveExistingProgress.toString();
  const normalizeProgressNumbersBody = normalizeProgressNumbers.toString();

  const parts: string[] = [
    BANNER.trimEnd(),
    '',
    '// Internal helpers',
    escapeRegexBody,
    '',
    toFiniteNumberBody,
    '',
    existingProgressExceedsDerivedBody,
    '',
    stateExtractFieldBody,
    '',
    stateReplaceFieldBody,
    '',
    stateReplaceFieldWithFallbackBody,
    '',
    normalizeStateStatusBody,
    '',
    computeProgressPercentBody,
    '',
    shouldPreserveExistingProgressBody,
    '',
    normalizeProgressNumbersBody,
    '',
    'module.exports = { stateExtractField, stateReplaceField, stateReplaceFieldWithFallback, normalizeStateStatus, computeProgressPercent, shouldPreserveExistingProgress, normalizeProgressNumbers };',
    '',
  ];

  return parts.join('\n');
}

async function main(): Promise<void> {
  const content = await buildStateDocumentCjs();
  const outPath = fileURLToPath(
    new URL('../../get-shit-done/bin/lib/state-document.generated.cjs', import.meta.url),
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
