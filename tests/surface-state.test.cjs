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

function captureWarn(fn) {
  const original = console.warn;
  const warnings = [];
  console.warn = (...args) => warnings.push(args.join(' '));
  try {
    return { result: fn(), warnings };
  } finally {
    console.warn = original;
  }
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

  test('corrupt JSON returns null and warns', () => {
    const dir = tmpDir();
    try {
      fs.writeFileSync(path.join(dir, '.gsd-surface.json'), '{not valid json', 'utf8');
      const { result, warnings } = captureWarn(() => readSurface(dir));
      assert.strictEqual(result, null);
      assert.strictEqual(warnings.length, 1);
      assert.match(warnings[0], /malformed JSON/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('JSON missing baseProfile field returns null and warns (#3662)', () => {
    const dir = tmpDir();
    try {
      fs.writeFileSync(
        path.join(dir, '.gsd-surface.json'),
        JSON.stringify({ disabledClusters: [], explicitAdds: [], explicitRemoves: [] }),
        'utf8'
      );
      const { result, warnings } = captureWarn(() => readSurface(dir));
      assert.strictEqual(result, null);
      assert.strictEqual(warnings.length, 1);
      assert.match(warnings[0], /baseProfile/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('JSON with non-string baseProfile returns null and warns', () => {
    const dir = tmpDir();
    try {
      fs.writeFileSync(
        path.join(dir, '.gsd-surface.json'),
        JSON.stringify({ baseProfile: 42, disabledClusters: [], explicitAdds: [], explicitRemoves: [] }),
        'utf8'
      );
      const { result, warnings } = captureWarn(() => readSurface(dir));
      assert.strictEqual(result, null);
      assert.match(warnings[0], /baseProfile/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('JSON with non-object root returns null and warns', () => {
    const dir = tmpDir();
    try {
      fs.writeFileSync(path.join(dir, '.gsd-surface.json'), JSON.stringify(['not', 'an', 'object']), 'utf8');
      const { result, warnings } = captureWarn(() => readSurface(dir));
      assert.strictEqual(result, null);
      assert.match(warnings[0], /object root/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('missing optional array field defaults to [] (#3662)', () => {
    const dir = tmpDir();
    try {
      fs.writeFileSync(
        path.join(dir, '.gsd-surface.json'),
        JSON.stringify({ baseProfile: 'standard', disabledClusters: [], explicitAdds: [] }),
        'utf8'
      );
      const { result, warnings } = captureWarn(() => readSurface(dir));
      assert.deepStrictEqual(result, {
        baseProfile: 'standard',
        disabledClusters: [],
        explicitAdds: [],
        explicitRemoves: [],
      });
      assert.deepStrictEqual(warnings, [], 'defaulting an optional field should not warn');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('all optional arrays missing default to [] (#3662)', () => {
    const dir = tmpDir();
    try {
      fs.writeFileSync(
        path.join(dir, '.gsd-surface.json'),
        JSON.stringify({ baseProfile: 'standard' }),
        'utf8'
      );
      const { result, warnings } = captureWarn(() => readSurface(dir));
      assert.deepStrictEqual(result, {
        baseProfile: 'standard',
        disabledClusters: [],
        explicitAdds: [],
        explicitRemoves: [],
      });
      assert.deepStrictEqual(warnings, []);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('non-array optional field is coerced to [] (#3662)', () => {
    const dir = tmpDir();
    try {
      fs.writeFileSync(
        path.join(dir, '.gsd-surface.json'),
        JSON.stringify({ baseProfile: 'standard', disabledClusters: 'utility', explicitAdds: [], explicitRemoves: [] }),
        'utf8'
      );
      const { result } = captureWarn(() => readSurface(dir));
      assert.deepStrictEqual(result, {
        baseProfile: 'standard',
        disabledClusters: [],
        explicitAdds: [],
        explicitRemoves: [],
      });
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('writeSurface normalizes partial input — all four fields land on disk (#3662)', () => {
    const dir = tmpDir();
    try {
      writeSurface(dir, { baseProfile: 'standard' });
      const onDisk = JSON.parse(fs.readFileSync(path.join(dir, '.gsd-surface.json'), 'utf8'));
      assert.deepStrictEqual(onDisk, {
        baseProfile: 'standard',
        disabledClusters: [],
        explicitAdds: [],
        explicitRemoves: [],
      });
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('writeSurface rejects missing baseProfile (#3662 writer guard)', () => {
    const dir = tmpDir();
    try {
      assert.throws(
        () => writeSurface(dir, { disabledClusters: [], explicitAdds: [], explicitRemoves: [] }),
        /baseProfile/
      );
      assert.throws(() => writeSurface(dir, { baseProfile: '' }), /baseProfile/);
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
