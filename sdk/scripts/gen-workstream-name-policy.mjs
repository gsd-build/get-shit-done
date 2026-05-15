#!/usr/bin/env node
/**
 * Generator for the Workstream Name Policy CJS artifact.
 *
 * Reads the compiled ESM output from sdk/dist/workstream-name-policy.js,
 * extracts function source via text transformation,
 * then emits get-shit-done/bin/lib/workstream-name-policy.generated.cjs.
 *
 * Source-of-truth: sdk/src/workstream-name-policy.ts
 *
 * Run: cd sdk && npm run gen:workstream-name-policy
 * Freshness check: node sdk/scripts/check-workstream-name-policy-fresh.mjs
 */

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export const BANNER = `'use strict';

/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Source: sdk/src/workstream-name-policy.ts
 * Regenerate: cd sdk && npm run gen:workstream-name-policy
 *
 * Canonical workstream name validation and slug normalization.
 * Used by active-workstream-store.cjs, planning-workspace.cjs, workstream.cjs.
 */

`;

export async function buildWorkstreamNamePolicyCjs() {
  // Read the compiled ESM source and transform to CJS.
  const distPath = fileURLToPath(new URL('../dist/workstream-name-policy.js', import.meta.url));
  const src = await readFile(distPath, 'utf-8');

  // Transform ESM to CJS:
  // 1. Remove import statements (none expected in this file)
  // 2. Remove ESM export keywords
  // 3. Remove source map comment
  // 4. Remove leading jsdoc comment
  // 5. Add module.exports at end

  let body = src;

  // Remove leading import statements (if any)
  body = body.replace(/^import\s+.*?;[\r\n]*/gm, '');

  // Remove ESM export keywords (keep function/const declarations)
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
    'module.exports = {',
    '  validateWorkstreamName,',
    '  toWorkstreamSlug,',
    '  hasInvalidPathSegment,',
    '  isValidActiveWorkstreamName,',
    '};',
    '',
  ];

  return parts.join('\n');
}

async function main() {
  const content = await buildWorkstreamNamePolicyCjs();
  const outPath = fileURLToPath(
    new URL('../../get-shit-done/bin/lib/workstream-name-policy.generated.cjs', import.meta.url),
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
