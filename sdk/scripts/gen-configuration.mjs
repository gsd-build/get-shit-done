#!/usr/bin/env node
/**
 * Generator for get-shit-done/bin/lib/configuration.generated.cjs.
 *
 * Reads the compiled Configuration Module from sdk/dist/configuration/index.js
 * and emits a CJS file that:
 *   1. Requires the two JSON manifests from sdk/shared/
 *   2. Exports loadConfig, normalizeLegacyKeys, mergeDefaults, migrateOnDisk,
 *      CONFIG_DEFAULTS, VALID_CONFIG_KEYS, RUNTIME_STATE_KEYS, DYNAMIC_KEY_PATTERNS
 *
 * Run via: cd sdk && npm run gen:configuration
 * Or from repo root: node sdk/scripts/gen-configuration.mjs
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');

// ─── Read the compiled dist file for function extraction ─────────────────────

const distPath = resolve(here, '..', 'dist', 'configuration', 'index.js');
if (!existsSync(distPath)) {
  throw new Error(
    `Missing compiled configuration module at ${distPath}. Run "cd sdk && npm run build" first.`,
  );
}
const distSrc = readFileSync(distPath, 'utf-8');

/**
 * Extract a named function from the compiled dist source by scanning for
 * `function <name>(` (or `async function <name>(`) and capturing the balanced
 * braces body. Returns the full `[async] function name(...) { ... }` string,
 * preserving the async keyword when present.
 */
function extractFunction(src, name) {
  // Try async first, then plain function
  let start = src.indexOf(`async function ${name}(`);
  if (start === -1) start = src.indexOf(`function ${name}(`);
  if (start === -1) throw new Error(`Function "${name}" not found in dist source`);

  // Find opening brace
  const braceStart = src.indexOf('{', start);
  if (braceStart === -1) throw new Error(`No opening brace for "${name}"`);

  // Balance braces
  let depth = 0;
  let i = braceStart;
  while (i < src.length) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) {
        return src.slice(start, i + 1);
      }
    }
    i++;
  }
  throw new Error(`Unbalanced braces for "${name}"`);
}

const fnPlanningDir = extractFunction(distSrc, 'planningDir');
const fnDetectSubRepos = extractFunction(distSrc, 'detectSubRepos');
const fnDeepMergeConfig = extractFunction(distSrc, 'deepMergeConfig');
const fnNormalizeLegacyKeys = extractFunction(distSrc, 'normalizeLegacyKeys');
const fnMergeDefaults = extractFunction(distSrc, 'mergeDefaults');
const fnLoadConfig = extractFunction(distSrc, 'loadConfig');
const fnMigrateOnDisk = extractFunction(distSrc, 'migrateOnDisk');

// Capture DEPTH_TO_GRANULARITY constant
const dtgMatch = distSrc.match(/const DEPTH_TO_GRANULARITY = \{[^}]+\};/);
if (!dtgMatch) throw new Error('DEPTH_TO_GRANULARITY not found in dist source');
const dtgConst = dtgMatch[0];

// ─── Build CJS output ─────────────────────────────────────────────────────────

/**
 * Build the CJS output string.
 * Exported so check-configuration-fresh.mjs can call it without re-running the generator.
 */
export function buildConfigurationCjs() {
  return [
    `'use strict';`,
    ``,
    `/**`,
    ` * GENERATED FILE — DO NOT EDIT.`,
    ` *`,
    ` * Source: sdk/src/configuration/index.ts`,
    ` * Regenerate: cd sdk && npm run gen:configuration`,
    ` *`,
    ` * Configuration Module — single source of truth for config loading,`,
    ` * legacy-key normalization, defaults merge, and explicit on-disk migration.`,
    ` */`,
    ``,
    `const { readFileSync, writeFileSync, existsSync, readdirSync } = require('node:fs');`,
    `const { join } = require('node:path');`,
    ``,
    `// ─── Manifest requires ───────────────────────────────────────────────────────`,
    `function loadConfigurationManifest(fileName) {`,
    `  const candidates = [`,
    `    // Installed runtime layout: get-shit-done/bin/shared/*.manifest.json`,
    `    join(__dirname, '..', 'shared', fileName),`,
    `    // Source-repo dev layout: sdk/shared/*.manifest.json`,
    `    join(__dirname, '..', '..', '..', 'sdk', 'shared', fileName),`,
    `  ];`,
    `  let lastErr = null;`,
    `  for (const candidate of candidates) {`,
    `    try {`,
    `      return require(candidate);`,
    `    } catch (err) {`,
    `      const isMissingCandidate =`,
    `        err && err.code === 'MODULE_NOT_FOUND' && String(err.message || '').includes(candidate);`,
    `      if (!isMissingCandidate) throw err;`,
    `      lastErr = err;`,
    `    }`,
    `  }`,
    `  throw new Error(`,
    `    \`\${fileName} not found. Tried:\\n\${candidates.map((p) => \`  \${p}\`).join('\\n')}\\nLast error: \${lastErr?.message}\``,
    `  );`,
    `}`,
    ``,
    `const CONFIG_DEFAULTS = loadConfigurationManifest('config-defaults.manifest.json');`,
    `const SCHEMA_MANIFEST = loadConfigurationManifest('config-schema.manifest.json');`,
    `const VALID_CONFIG_KEYS = new Set(SCHEMA_MANIFEST.validKeys);`,
    `const RUNTIME_STATE_KEYS = new Set(SCHEMA_MANIFEST.runtimeStateKeys);`,
    `const DYNAMIC_KEY_PATTERNS = SCHEMA_MANIFEST.dynamicKeyPatterns.map((p) => {`,
    `  const pattern = new RegExp(p.source);`,
    `  return {`,
    `    ...p,`,
    `    test: (key) => {`,
    `      pattern.lastIndex = 0;`,
    `      return pattern.test(key);`,
    `    },`,
    `  };`,
    `});`,
    ``,
    `// ─── Depth → Granularity mapping ─────────────────────────────────────────────`,
    dtgConst,
    ``,
    `// ─── Internal helpers ─────────────────────────────────────────────────────────`,
    fnPlanningDir,
    ``,
    fnDetectSubRepos,
    ``,
    fnDeepMergeConfig,
    ``,
    `// ─── Exported functions ───────────────────────────────────────────────────────`,
    fnNormalizeLegacyKeys,
    ``,
    fnMergeDefaults,
    ``,
    fnLoadConfig,
    ``,
    fnMigrateOnDisk,
    ``,
    `module.exports = {`,
    `  loadConfig,`,
    `  normalizeLegacyKeys,`,
    `  mergeDefaults,`,
    `  migrateOnDisk,`,
    `  CONFIG_DEFAULTS,`,
    `  VALID_CONFIG_KEYS,`,
    `  RUNTIME_STATE_KEYS,`,
    `  DYNAMIC_KEY_PATTERNS,`,
    `};`,
    ``,
  ].join('\n');
}

// ─── Main: write output file (only when run directly) ────────────────────────

// Guard: don't write the file when imported by check-configuration-fresh.mjs.
// `process.argv[1]` is the absolute path of the entry-point script.
const _thisFile = fileURLToPath(import.meta.url);
if (process.argv[1] === _thisFile) {
  const cjsOut = buildConfigurationCjs();
  const outPath = resolve(repoRoot, 'get-shit-done', 'bin', 'lib', 'configuration.generated.cjs');
  writeFileSync(outPath, cjsOut, 'utf-8');
  console.log(`Generated: ${outPath}`);
}
