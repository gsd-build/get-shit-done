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
const { createTempDir, cleanup } = require('./helpers.cjs');

function tmpDir() {
  return createTempDir('gsd-surface-state-');
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
      cleanup(dir);
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
      cleanup(dir);
    }
  });

  test('round-trips composed base profile', () => {
    const dir = tmpDir();
    try {
      const state = {
        baseProfile: 'core,standard',
        disabledClusters: [],
        explicitAdds: [],
        explicitRemoves: ['health'],
      };
      writeSurface(dir, state);
      assert.deepStrictEqual(readSurface(dir), state);
    } finally {
      cleanup(dir);
    }
  });

  test('missing file returns null', () => {
    const dir = tmpDir();
    try {
      const result = readSurface(dir);
      assert.strictEqual(result, null);
    } finally {
      cleanup(dir);
    }
  });

  test('non-existent directory returns null', () => {
    const ghost = path.join(os.tmpdir(), 'gsd-surface-no-exist-' + Date.now());
    const result = readSurface(ghost);
    assert.strictEqual(result, null);
  });

  // chmod-000 unreadable file — Linux-only because Windows and root accounts
  // ignore mode bits. Covers the EACCES branch in readSurface (#3662 Gemini).
  test('unreadable file (EACCES) returns null and warns', { skip: process.platform === 'win32' || process.getuid?.() === 0 }, () => {
    const dir = tmpDir();
    try {
      const filePath = path.join(dir, '.gsd-surface.json');
      fs.writeFileSync(filePath, '{"baseProfile":"standard"}', 'utf8');
      fs.chmodSync(filePath, 0o000);
      const { result, warnings } = captureWarn(() => readSurface(dir));
      assert.strictEqual(result, null);
      assert.strictEqual(warnings.length, 1);
      assert.match(warnings[0], /unreadable/);
      fs.chmodSync(filePath, 0o644); // restore so cleanup can rm
    } finally {
      cleanup(dir);
    }
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
      cleanup(dir);
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
      cleanup(dir);
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
      cleanup(dir);
    }
  });

  test('typo in baseProfile warns about unknown mode but still returns state (#3662 Codex)', () => {
    const dir = tmpDir();
    try {
      fs.writeFileSync(
        path.join(dir, '.gsd-surface.json'),
        JSON.stringify({ baseProfile: 'standrad', disabledClusters: [], explicitAdds: [], explicitRemoves: [] }),
        'utf8'
      );
      const { result, warnings } = captureWarn(() => readSurface(dir));
      assert.deepStrictEqual(result, {
        baseProfile: 'standrad',
        disabledClusters: [],
        explicitAdds: [],
        explicitRemoves: [],
      });
      assert.strictEqual(warnings.length, 1);
      assert.match(warnings[0], /unknown profile mode/);
      assert.match(warnings[0], /standrad/);
    } finally {
      cleanup(dir);
    }
  });

  test('composed baseProfile warns only about unknown member (#3662 Codex)', () => {
    const dir = tmpDir();
    try {
      fs.writeFileSync(
        path.join(dir, '.gsd-surface.json'),
        JSON.stringify({ baseProfile: 'core,bogus', disabledClusters: [], explicitAdds: [], explicitRemoves: [] }),
        'utf8'
      );
      const { result, warnings } = captureWarn(() => readSurface(dir));
      assert.strictEqual(result.baseProfile, 'core,bogus');
      assert.strictEqual(warnings.length, 1);
      // Warning must call out 'bogus' as unknown, but not list 'core' as unknown
      // (it does appear once in the "(valid: core, standard, full)" hint — that's fine).
      const unknownPart = warnings[0].split('(valid:')[0];
      assert.match(unknownPart, /bogus/);
      assert.doesNotMatch(unknownPart, /\bcore\b/);
    } finally {
      cleanup(dir);
    }
  });

  test('known composed baseProfile does not warn (#3662 Codex)', () => {
    const dir = tmpDir();
    try {
      fs.writeFileSync(
        path.join(dir, '.gsd-surface.json'),
        JSON.stringify({ baseProfile: 'core,standard', disabledClusters: [], explicitAdds: [], explicitRemoves: [] }),
        'utf8'
      );
      const { warnings } = captureWarn(() => readSurface(dir));
      assert.deepStrictEqual(warnings, [], 'all-known modes should not warn');
    } finally {
      cleanup(dir);
    }
  });

  test('writeSurface warns on unknown profile mode but still writes (#3662 Codex)', () => {
    const dir = tmpDir();
    try {
      const { warnings } = captureWarn(() => writeSurface(dir, { baseProfile: 'standrad' }));
      const onDisk = JSON.parse(fs.readFileSync(path.join(dir, '.gsd-surface.json'), 'utf8'));
      assert.strictEqual(onDisk.baseProfile, 'standrad');
      assert.strictEqual(warnings.length, 1);
      assert.match(warnings[0], /unknown profile mode/);
      assert.match(warnings[0], /standrad/);
    } finally {
      cleanup(dir);
    }
  });

  test('JSON with whitespace-only baseProfile returns null and warns (#3662 CodeRabbit)', () => {
    const dir = tmpDir();
    try {
      fs.writeFileSync(
        path.join(dir, '.gsd-surface.json'),
        JSON.stringify({ baseProfile: '   ', disabledClusters: [], explicitAdds: [], explicitRemoves: [] }),
        'utf8'
      );
      const { result, warnings } = captureWarn(() => readSurface(dir));
      assert.strictEqual(result, null);
      assert.match(warnings[0], /baseProfile/);
    } finally {
      cleanup(dir);
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
      cleanup(dir);
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
      cleanup(dir);
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
      cleanup(dir);
    }
  });

  test('non-array optional field is coerced to [] and warns (#3662 Gemini)', () => {
    const dir = tmpDir();
    try {
      fs.writeFileSync(
        path.join(dir, '.gsd-surface.json'),
        JSON.stringify({ baseProfile: 'standard', disabledClusters: 'utility', explicitAdds: 42, explicitRemoves: [] }),
        'utf8'
      );
      const { result, warnings } = captureWarn(() => readSurface(dir));
      assert.deepStrictEqual(result, {
        baseProfile: 'standard',
        disabledClusters: [],
        explicitAdds: [],
        explicitRemoves: [],
      });
      assert.strictEqual(warnings.length, 1);
      assert.match(warnings[0], /wrong type/);
      assert.match(warnings[0], /disabledClusters/);
      assert.match(warnings[0], /explicitAdds/);
    } finally {
      cleanup(dir);
    }
  });

  test('comma-only baseProfile is rejected (#3662 Gemini)', () => {
    const dir = tmpDir();
    try {
      fs.writeFileSync(
        path.join(dir, '.gsd-surface.json'),
        JSON.stringify({ baseProfile: ', ,', disabledClusters: [], explicitAdds: [], explicitRemoves: [] }),
        'utf8'
      );
      const { result, warnings } = captureWarn(() => readSurface(dir));
      assert.strictEqual(result, null);
      assert.match(warnings[0], /comma-only/);
    } finally {
      cleanup(dir);
    }
  });

  test('writeSurface rejects comma-only baseProfile (#3662 Gemini)', () => {
    const dir = tmpDir();
    try {
      assert.throws(() => writeSurface(dir, { baseProfile: ', ,' }), /baseProfile/);
      assert.throws(() => writeSurface(dir, { baseProfile: ',' }), /baseProfile/);
    } finally {
      cleanup(dir);
    }
  });

  test('writeSurface warns on wrong-typed optional field but still writes (#3662 Gemini)', () => {
    const dir = tmpDir();
    try {
      const { warnings } = captureWarn(() => writeSurface(dir, {
        baseProfile: 'standard',
        disabledClusters: 'utility',
      }));
      const onDisk = JSON.parse(fs.readFileSync(path.join(dir, '.gsd-surface.json'), 'utf8'));
      assert.deepStrictEqual(onDisk, {
        baseProfile: 'standard',
        disabledClusters: [],
        explicitAdds: [],
        explicitRemoves: [],
      });
      assert.strictEqual(warnings.length, 1);
      assert.match(warnings[0], /wrong type/);
      assert.match(warnings[0], /disabledClusters/);
    } finally {
      cleanup(dir);
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
      cleanup(dir);
    }
  });

  test('writeSurface rejects missing, empty, or blank baseProfile (#3662 writer guard)', () => {
    const dir = tmpDir();
    try {
      assert.throws(
        () => writeSurface(dir, { disabledClusters: [], explicitAdds: [], explicitRemoves: [] }),
        /baseProfile/
      );
      assert.throws(() => writeSurface(dir, { baseProfile: '' }), /baseProfile/);
      assert.throws(() => writeSurface(dir, { baseProfile: '   ' }), /baseProfile/);
      assert.throws(() => writeSurface(dir, { baseProfile: 42 }), /baseProfile/);
      assert.throws(() => writeSurface(dir, null), /baseProfile/);
    } finally {
      cleanup(dir);
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
      cleanup(dir);
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
      cleanup(dir);
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
      cleanup(base);
    }
  });
});
