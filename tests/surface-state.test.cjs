'use strict';
/**
 * Tests for readSurface / writeSurface — state IO round-trips.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { readSurface, writeSurface } = require('../get-shit-done/bin/lib/surface.cjs');

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-surface-state-'));
}

describe('readSurface / writeSurface', () => {
  test('round-trips a complete surface state', () => {
    const dir = tmpDir();
    try {
      const state = {
        baseProfile: 'standard',
        disabledClusters: ['utility'],
        explicitAdds: ['sketch'],
        explicitRemoves: [],
      };
      writeSurface(dir, state);
      const read = readSurface(dir);
      assert.deepStrictEqual(read, state);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('round-trips empty arrays', () => {
    const dir = tmpDir();
    try {
      const state = {
        baseProfile: 'core',
        disabledClusters: [],
        explicitAdds: [],
        explicitRemoves: [],
      };
      writeSurface(dir, state);
      assert.deepStrictEqual(readSurface(dir), state);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('round-trips composed base profile', () => {
    const dir = tmpDir();
    try {
      const state = {
        baseProfile: 'core,audit',
        disabledClusters: [],
        explicitAdds: [],
        explicitRemoves: ['health'],
      };
      writeSurface(dir, state);
      assert.deepStrictEqual(readSurface(dir), state);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('missing file returns null', () => {
    const dir = tmpDir();
    try {
      const result = readSurface(dir);
      assert.strictEqual(result, null);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('non-existent directory returns null', () => {
    const ghost = path.join(os.tmpdir(), 'gsd-surface-no-exist-' + Date.now());
    const result = readSurface(ghost);
    assert.strictEqual(result, null);
  });

  test('corrupt JSON returns null', () => {
    const dir = tmpDir();
    try {
      fs.writeFileSync(path.join(dir, '.gsd-surface.json'), '{not valid json', 'utf8');
      const result = readSurface(dir);
      assert.strictEqual(result, null);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('JSON missing baseProfile field returns null', () => {
    const dir = tmpDir();
    try {
      fs.writeFileSync(
        path.join(dir, '.gsd-surface.json'),
        JSON.stringify({ disabledClusters: [], explicitAdds: [], explicitRemoves: [] }),
        'utf8'
      );
      const result = readSurface(dir);
      assert.strictEqual(result, null);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('JSON with non-array disabledClusters returns null', () => {
    const dir = tmpDir();
    try {
      fs.writeFileSync(
        path.join(dir, '.gsd-surface.json'),
        JSON.stringify({ baseProfile: 'standard', disabledClusters: 'utility', explicitAdds: [], explicitRemoves: [] }),
        'utf8'
      );
      const result = readSurface(dir);
      assert.strictEqual(result, null);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('atomic write: result file is never a partial tmp file', () => {
    const dir = tmpDir();
    try {
      const state = { baseProfile: 'full', disabledClusters: [], explicitAdds: [], explicitRemoves: [] };
      writeSurface(dir, state);
      // No .tmp.* files should remain
      const files = fs.readdirSync(dir);
      const tmpFiles = files.filter(f => f.includes('.tmp.'));
      assert.deepStrictEqual(tmpFiles, [], 'no tmp files should remain after write');
      // The canonical file exists
      assert.ok(files.includes('.gsd-surface.json'));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('second write overwrites first', () => {
    const dir = tmpDir();
    try {
      writeSurface(dir, { baseProfile: 'core', disabledClusters: [], explicitAdds: [], explicitRemoves: [] });
      writeSurface(dir, { baseProfile: 'standard', disabledClusters: ['utility'], explicitAdds: [], explicitRemoves: [] });
      const read = readSurface(dir);
      assert.strictEqual(read.baseProfile, 'standard');
      assert.deepStrictEqual(read.disabledClusters, ['utility']);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('writeSurface creates directory if it does not exist', () => {
    const base = tmpDir();
    const nested = path.join(base, 'skills', 'subdir');
    try {
      writeSurface(nested, { baseProfile: 'full', disabledClusters: [], explicitAdds: [], explicitRemoves: [] });
      assert.ok(fs.existsSync(nested));
      assert.ok(readSurface(nested) !== null);
    } finally {
      fs.rmSync(base, { recursive: true, force: true });
    }
  });
});
