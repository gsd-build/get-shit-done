'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const GSD_TOOLS = path.join(__dirname, '..', 'get-shit-done', 'bin', 'gsd-tools.cjs');

describe('gsd-tools memory optimizer guards', () => {
  test('stdout capture avoids chunk arrays + join for pick/non-pick paths', () => {
    const src = fs.readFileSync(GSD_TOOLS, 'utf8');

    assert.equal(src.includes('const chunks = [];'), false, 'pick path should not use chunk arrays');
    assert.equal(src.includes('chunks.join('), false, 'pick path should not join chunk arrays');
    assert.equal(src.includes('const outChunks = [];'), false, 'normal path should not use chunk arrays');
    assert.equal(src.includes('outChunks.join('), false, 'normal path should not join chunk arrays');
  });

  test('detect-custom-files traversal does not materialize a full path list', () => {
    const src = fs.readFileSync(GSD_TOOLS, 'utf8');

    assert.equal(src.includes('const results = [];'), false, 'walker should not build full results array');
    assert.equal(src.includes('results.push(...walkDir('), false, 'walker should not materialize child arrays');
    assert.equal(src.includes('for (const relPath of walkDir('), false, 'caller should not iterate over materialized list');
    assert.equal(
      src.includes("manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));"),
      false,
      'detect-custom-files should avoid sync manifest read'
    );
  });
});
