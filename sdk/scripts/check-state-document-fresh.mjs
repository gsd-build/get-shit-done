#!/usr/bin/env node
/**
 * Freshness check for state-document.generated.cjs.
 *
 * Regenerates the expected CJS content in-memory (without writing to disk) and
 * compares it to the committed file. Exits 0 if they match, 1 if stale.
 *
 * Run: node sdk/scripts/check-state-document-fresh.mjs
 * (Requires sdk/dist to be built first — `npm run build` in sdk/.)
 */

import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

const BANNER = `'use strict';

/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Source: sdk/src/query/state-document.ts
 * Regenerate: cd sdk && npm run gen:state-document
 *
 * STATE.md Document Module — pure transforms for STATE.md text.
 * This module does not read the filesystem and does not own persistence or locking.
 */`;

/**
 * Extract a top-level function declaration (non-exported) from a JS source
 * string by scanning for `function <name>(` and capturing the entire body
 * including balanced braces.
 */
function extractFunctionFromSource(source, name) {
  const marker = `function ${name}(`;
  const start = source.indexOf(marker);
  if (start === -1) throw new Error(`Could not find function ${name} in compiled source`);
  const braceOpen = source.indexOf('{', start);
  if (braceOpen === -1) throw new Error(`Could not find opening brace for function ${name}`);
  let depth = 0;
  let i = braceOpen;
  for (; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') { depth--; if (depth === 0) break; }
  }
  if (depth !== 0) {
    throw new Error(`Could not find closing brace for function ${name}`);
  }
  return source.slice(start, i + 1);
}

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
const compiledSource = await readFile(fileURLToPath(distUrl), 'utf-8');

const escapeRegexBody = extractFunctionFromSource(compiledSource, 'escapeRegex');
const toFiniteNumberBody = extractFunctionFromSource(compiledSource, 'toFiniteNumber');
const existingProgressExceedsDerivedBody = extractFunctionFromSource(compiledSource, 'existingProgressExceedsDerived');
const stateExtractFieldBody = stateExtractField.toString();
const stateReplaceFieldBody = stateReplaceField.toString();
const stateReplaceFieldWithFallbackBody = stateReplaceFieldWithFallback.toString();
const normalizeStateStatusBody = normalizeStateStatus.toString();
const computeProgressPercentBody = computeProgressPercent.toString();
const shouldPreserveExistingProgressBody = shouldPreserveExistingProgress.toString();
const normalizeProgressNumbersBody = normalizeProgressNumbers.toString();

const expected = [
  BANNER,
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
].join('\n');

const committedPath = resolve(here, '..', '..', 'get-shit-done', 'bin', 'lib', 'state-document.generated.cjs');
const committed = await readFile(committedPath, 'utf-8');

if (expected === committed) {
  console.log('state-document.generated.cjs is fresh');
  process.exit(0);
} else {
  console.error('state-document.generated.cjs is STALE.');
  console.error('Regenerate: cd sdk && npm run gen:state-document');
  process.exit(1);
}
