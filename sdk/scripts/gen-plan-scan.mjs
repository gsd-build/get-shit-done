#!/usr/bin/env node
/**
 * Generator for the Plan Scan CJS artifact.
 *
 * Reads the compiled ESM output from sdk/dist/query/plan-scan.js,
 * extracts function source via Function.prototype.toString() for exports,
 * then emits get-shit-done/bin/lib/plan-scan.generated.cjs.
 *
 * Run: cd sdk && npm run gen:plan-scan
 * Freshness check: node sdk/scripts/check-plan-scan-fresh.mjs
 */

import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export const BANNER = `'use strict';

/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Source: sdk/src/query/plan-scan.ts
 * Regenerate: cd sdk && npm run gen:plan-scan
 *
 * Plan Scan Module — detects plan and summary files in a phase directory.
 * Supports both flat (pre-#3139) and nested (post-#3139) layouts.
 */

`;

export async function buildPlanScanCjs() {
  // Load the compiled ESM module to get exports via Function.prototype.toString()
  const distUrl = new URL('../dist/query/plan-scan.js', import.meta.url);
  const {
    isRootPlanFile,
    isNestedPlanFile,
    isRootSummaryFile,
    isNestedSummaryFile,
    scanPhasePlans,
  } = await import(distUrl.href);

  // Get exported function bodies via Function.prototype.toString()
  const isRootPlanFileBody = isRootPlanFile.toString();
  const isNestedPlanFileBody = isNestedPlanFile.toString();
  const isRootSummaryFileBody = isRootSummaryFile.toString();
  const isNestedSummaryFileBody = isNestedSummaryFile.toString();
  const scanPhasePlansBody = scanPhasePlans.toString();

  const parts = [
    BANNER.trimEnd(),
    '',
    "const { existsSync, readdirSync } = require('node:fs');",
    "const { join } = require('node:path');",
    '',
    '// Excluded derivative files',
    'const PLAN_OUTLINE_RE = /-OUTLINE\\.md$/i;',
    'const PLAN_PRE_BOUNCE_RE = /\\.pre-bounce\\.md$/i;',
    '',
    isRootPlanFileBody,
    '',
    isNestedPlanFileBody,
    '',
    isRootSummaryFileBody,
    '',
    isNestedSummaryFileBody,
    '',
    scanPhasePlansBody,
    '',
    '// CJS callers do: const scanPhasePlans = require(\'./plan-scan.cjs\')',
    '// and also destructure named exports — support both call styles.',
    'module.exports = scanPhasePlans;',
    'module.exports.scanPhasePlans = scanPhasePlans;',
    'module.exports.isRootPlanFile = isRootPlanFile;',
    'module.exports.isNestedPlanFile = isNestedPlanFile;',
    'module.exports.isRootSummaryFile = isRootSummaryFile;',
    'module.exports.isNestedSummaryFile = isNestedSummaryFile;',
    '',
  ];

  return parts.join('\n');
}

async function main() {
  const content = await buildPlanScanCjs();
  const outPath = fileURLToPath(
    new URL('../../get-shit-done/bin/lib/plan-scan.generated.cjs', import.meta.url),
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
