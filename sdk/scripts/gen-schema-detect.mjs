#!/usr/bin/env node
/**
 * Generator for the Schema Detect CJS artifact.
 *
 * Reads the compiled ESM output from sdk/dist/query/schema-detect.js,
 * extracts function source via Function.prototype.toString() for exports
 * and via source-text extraction for internal constants, then emits
 * get-shit-done/bin/lib/schema-detect.generated.cjs.
 *
 * Run: cd sdk && npm run gen:schema-detect
 * Freshness check: node sdk/scripts/check-schema-detect-fresh.mjs
 */

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export const BANNER = `'use strict';

/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Source: sdk/src/query/schema-detect.ts
 * Regenerate: cd sdk && npm run gen:schema-detect
 *
 * Schema Drift Detection — detects schema-relevant file changes and verifies
 * that the appropriate database push command was executed during a phase.
 * This module does not read the filesystem directly.
 */

`;

/**
 * Extract a top-level const declaration block (array or object literal)
 * from a JS source string. Scans for `const <name> = [` or `const <name> = {`
 * and captures through the balanced closing brace/bracket.
 */
function extractConstFromSource(source, name) {
  // Try array form: const NAME = [
  let arrayMarker = `const ${name} = [`;
  let start = source.indexOf(arrayMarker);
  let openChar = '[';
  let closeChar = ']';

  if (start === -1) {
    // Try object form: const NAME = {
    const objectMarker = `const ${name} = {`;
    start = source.indexOf(objectMarker);
    openChar = '{';
    closeChar = '}';
    if (start === -1) {
      throw new Error(`Could not find const ${name} in compiled source`);
    }
  }

  const braceOpen = source.indexOf(openChar, start);
  if (braceOpen === -1) throw new Error(`Could not find opening ${openChar} for const ${name}`);

  let depth = 0;
  let i = braceOpen;
  for (; i < source.length; i++) {
    if (source[i] === openChar) depth++;
    else if (source[i] === closeChar) {
      depth--;
      if (depth === 0) break;
    }
  }
  if (depth !== 0) throw new Error(`Could not find closing ${closeChar} for const ${name}`);

  // Return the full `const NAME = [...];` or `const NAME = {...};`
  // Find the semicolon after the closing bracket
  const afterClose = source.indexOf(';', i);
  const end = afterClose !== -1 ? afterClose + 1 : i + 1;
  return source.slice(start, end);
}

export async function buildSchemaDetectCjs() {
  const distUrl = new URL('../dist/query/schema-detect.js', import.meta.url);
  const {
    detectSchemaFiles,
    checkSchemaDrift,
  } = await import(distUrl.href);

  const compiledSource = await readFile(fileURLToPath(distUrl), 'utf-8');

  // Extract non-exported constants from source text
  const schemaPatternsDecl = extractConstFromSource(compiledSource, 'SCHEMA_PATTERNS');
  const ormInfoDecl = extractConstFromSource(compiledSource, 'ORM_INFO');

  // Get exported function bodies via Function.prototype.toString()
  const detectSchemaFilesBody = detectSchemaFiles.toString();
  const checkSchemaDriftBody = checkSchemaDrift.toString();

  // detectSchemaOrm is not in the SDK but CJS callers may use it.
  // Reconstruct it as a simple ORM_INFO lookup (same as original secrets.cjs).
  const detectSchemaOrmBody = `function detectSchemaOrm(ormName) {
  return ORM_INFO[ormName] || null;
}`;

  const parts = [
    BANNER.trimEnd(),
    '',
    '// ─── ORM Patterns ───────────────────────────────────────────────────────────',
    schemaPatternsDecl,
    '',
    '// ─── Push Commands & Evidence Patterns ──────────────────────────────────────',
    ormInfoDecl,
    '',
    '// ─── Public API ──────────────────────────────────────────────────────────────',
    detectSchemaFilesBody,
    '',
    detectSchemaOrmBody,
    '',
    checkSchemaDriftBody,
    '',
    'module.exports = {',
    '  SCHEMA_PATTERNS,',
    '  ORM_INFO,',
    '  detectSchemaFiles,',
    '  detectSchemaOrm,',
    '  checkSchemaDrift,',
    '};',
    '',
  ];

  return parts.join('\n');
}

async function main() {
  const content = await buildSchemaDetectCjs();
  const outPath = fileURLToPath(
    new URL('../../get-shit-done/bin/lib/schema-detect.generated.cjs', import.meta.url),
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
