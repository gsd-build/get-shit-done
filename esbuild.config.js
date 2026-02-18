#!/usr/bin/env node
/**
 * Bundle src/ into dist/declare-tools.cjs
 * Single-file CJS bundle for zero-install distribution.
 */

const esbuild = require('esbuild');
const path = require('path');

esbuild.buildSync({
  entryPoints: [path.join(__dirname, 'src', 'declare-tools.js')],
  outfile: path.join(__dirname, 'dist', 'declare-tools.cjs'),
  bundle: true,
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  minify: false,
  // Zero runtime dependencies -- bundle everything
  external: [],
});

console.log('Built dist/declare-tools.cjs');
