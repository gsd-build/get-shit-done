#!/usr/bin/env node
/**
 * Generator for the Secrets CJS artifact.
 *
 * Reads the compiled ESM output from sdk/dist/query/secrets.js,
 * extracts function source via Function.prototype.toString() for exports,
 * then emits get-shit-done/bin/lib/secrets.generated.cjs.
 *
 * Run: cd sdk && npm run gen:secrets
 * Freshness check: node sdk/scripts/check-secrets-fresh.mjs
 */

import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export const BANNER = `'use strict';

/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Source: sdk/src/query/secrets.ts
 * Regenerate: cd sdk && npm run gen:secrets
 *
 * Secrets handling — masking convention for API keys and other
 * credentials managed via /gsd-settings-integrations.
 * This module does not read the filesystem.
 */

`;

export async function buildSecretsCjs() {
  // Load the compiled ESM module to get exports via Function.prototype.toString()
  const distUrl = new URL('../dist/query/secrets.js', import.meta.url);
  const {
    SECRET_CONFIG_KEYS,
    isSecretKey,
    maskSecret,
    maskIfSecret,
  } = await import(distUrl.href);

  // Get exported function bodies via Function.prototype.toString()
  const isSecretKeyBody = isSecretKey.toString();
  const maskSecretBody = maskSecret.toString();
  const maskIfSecretBody = maskIfSecret.toString();

  // SECRET_CONFIG_KEYS is a Set — reconstruct it as a constant declaration
  const secretKeys = [...SECRET_CONFIG_KEYS];
  const secretKeysLiteral = secretKeys.map(k => `  '${k}',`).join('\n');

  const parts = [
    BANNER.trimEnd(),
    '',
    'const SECRET_CONFIG_KEYS = new Set([',
    secretKeysLiteral,
    ']);',
    '',
    isSecretKeyBody,
    '',
    maskSecretBody,
    '',
    maskIfSecretBody,
    '',
    'module.exports = { SECRET_CONFIG_KEYS, isSecretKey, maskSecret, maskIfSecret };',
    '',
  ];

  return parts.join('\n');
}

async function main() {
  const content = await buildSecretsCjs();
  const outPath = fileURLToPath(
    new URL('../../get-shit-done/bin/lib/secrets.generated.cjs', import.meta.url),
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
