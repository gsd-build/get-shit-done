#!/usr/bin/env node
/**
 * Bundle GSD hooks with dependencies for zero-config installation.
 *
 * sql.js includes a WASM binary that must be inlined for portability.
 * This script bundles hooks into self-contained files that work from any cwd.
 */

const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const HOOKS_DIR = path.join(__dirname, '..', 'hooks');
const DIST_DIR = path.join(HOOKS_DIR, 'dist');

// Hooks that need bundling (have npm dependencies)
const HOOKS_TO_BUNDLE = [
  'gsd-intel-index.js'
];

// Hooks that are pure Node.js (just copy)
const HOOKS_TO_COPY = [
  'gsd-intel-session.js',
  'gsd-intel-prune.js',
  'gsd-check-update.js',
  'gsd-statusline.js',
  'gsd-team-plan-check.js',
  'gsd-statusline-enhanced.js',
  'gsd-usage-session.js',
  'gsd-usage-log.js'
];

async function build() {
  // Ensure dist directory exists
  if (!fs.existsSync(DIST_DIR)) {
    fs.mkdirSync(DIST_DIR, { recursive: true });
  }

  // Bundle hooks with dependencies
  for (const hook of HOOKS_TO_BUNDLE) {
    const entryPoint = path.join(HOOKS_DIR, hook);
    const outfile = path.join(DIST_DIR, hook);

    if (!fs.existsSync(entryPoint)) {
      console.warn(`Warning: ${hook} not found, skipping`);
      continue;
    }

    console.log(`Bundling ${hook}...`);

    await esbuild.build({
      entryPoints: [entryPoint],
      bundle: true,
      platform: 'node',
      target: 'node18',
      outfile,
      format: 'cjs',
      // Inline WASM as base64 for sql.js
      loader: {
        '.wasm': 'binary'
      },
      // Don't externalize anything - bundle it all
      external: [],
      // Minify for smaller package size
      minify: true,
      // Keep function names for debugging
      keepNames: true,
      // Handle sql.js WASM loading
      define: {
        'process.env.NODE_ENV': '"production"'
      }
      // Note: shebang preserved from source file by esbuild
    });

    console.log(`  → ${outfile}`);
  }

  // Copy pure Node.js hooks (no bundling needed)
  for (const hook of HOOKS_TO_COPY) {
    const src = path.join(HOOKS_DIR, hook);
    const dest = path.join(DIST_DIR, hook);

    if (!fs.existsSync(src)) {
      console.warn(`Warning: ${hook} not found, skipping`);
      continue;
    }

    console.log(`Copying ${hook}...`);
    fs.copyFileSync(src, dest);
    console.log(`  → ${dest}`);
  }

  console.log('\nBuild complete.');
}

build().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});
