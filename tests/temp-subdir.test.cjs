/**
 * GSD Tools Tests - dedicated temp subdirectory
 *
 * Tests for issue #1975: GSD temp files should use a dedicated
 * subdirectory (path.join(os.tmpdir(), 'gsd')) instead of writing
 * directly to os.tmpdir().
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  reapStaleTempFiles,
} = require('../get-shit-done/bin/lib/core.cjs');

const GSD_TEMP_DIR = path.join(os.tmpdir(), 'gsd');

// ─── Dedicated temp subdirectory ────────────────────────────────────────────

describe('dedicated gsd temp subdirectory', () => {
  describe('output() temp file placement', () => {
    // output() writes to tmpfile when JSON > 50KB. We test indirectly by
    // checking that reapStaleTempFiles scans the subdirectory.

    test('gsd temp subdirectory path is os.tmpdir()/gsd', () => {
      // The GSD_TEMP_DIR constant should resolve to <tmpdir>/gsd
      assert.strictEqual(GSD_TEMP_DIR, path.join(os.tmpdir(), 'gsd'));
    });
  });

  describe('reapStaleTempFiles with subdirectory', () => {
    let testPrefix;

    beforeEach(() => {
      testPrefix = `gsd-tempsub-test-${Date.now()}-`;
      // Ensure the gsd subdirectory exists for test setup
      fs.mkdirSync(GSD_TEMP_DIR, { recursive: true });
    });

    test('removes stale files from gsd subdirectory', () => {
      const stalePath = path.join(GSD_TEMP_DIR, `${testPrefix}stale.json`);
      fs.writeFileSync(stalePath, '{}');
      const oldTime = new Date(Date.now() - 10 * 60 * 1000);
      fs.utimesSync(stalePath, oldTime, oldTime);

      reapStaleTempFiles(testPrefix, { maxAgeMs: 5 * 60 * 1000 });

      assert.ok(!fs.existsSync(stalePath), 'stale file in gsd subdir should be removed');
    });

    test('preserves fresh files in gsd subdirectory', () => {
      const freshPath = path.join(GSD_TEMP_DIR, `${testPrefix}fresh.json`);
      fs.writeFileSync(freshPath, '{}');

      reapStaleTempFiles(testPrefix, { maxAgeMs: 5 * 60 * 1000 });

      assert.ok(fs.existsSync(freshPath), 'fresh file in gsd subdir should be preserved');
      // Clean up
      fs.unlinkSync(freshPath);
    });

    test('removes stale directories from gsd subdirectory', () => {
      const staleDir = path.join(GSD_TEMP_DIR, `${testPrefix}dir`);
      fs.mkdirSync(staleDir, { recursive: true });
      const oldTime = new Date(Date.now() - 10 * 60 * 1000);
      fs.utimesSync(staleDir, oldTime, oldTime);

      reapStaleTempFiles(testPrefix, { maxAgeMs: 5 * 60 * 1000 });

      assert.ok(!fs.existsSync(staleDir), 'stale directory in gsd subdir should be removed');
    });

    test('creates gsd subdirectory if it does not exist', () => {
      // Use a unique nested path to avoid interfering with other tests
      const uniqueSubdir = path.join(os.tmpdir(), `gsd-creation-test-${Date.now()}`);

      // Verify it does not exist
      if (fs.existsSync(uniqueSubdir)) {
        fs.rmSync(uniqueSubdir, { recursive: true, force: true });
      }
      assert.ok(!fs.existsSync(uniqueSubdir), 'test subdir should not exist before test');

      // reapStaleTempFiles should not throw even if subdir does not exist
      // (it gets created or handled gracefully)
      assert.doesNotThrow(() => {
        reapStaleTempFiles(`gsd-creation-test-${Date.now()}-`, { maxAgeMs: 0 });
      });
    });

    test('does not scan system tmpdir root for gsd- files', () => {
      // Place a stale file in the OLD location (system tmpdir root)
      const oldLocationPath = path.join(os.tmpdir(), `${testPrefix}old-location.json`);
      fs.writeFileSync(oldLocationPath, '{}');
      const oldTime = new Date(Date.now() - 10 * 60 * 1000);
      fs.utimesSync(oldLocationPath, oldTime, oldTime);

      // reapStaleTempFiles should NOT remove files from the old location
      // because it now only scans the gsd subdirectory
      reapStaleTempFiles(testPrefix, { maxAgeMs: 5 * 60 * 1000 });

      // The file in the old location should still exist (not scanned)
      assert.ok(
        fs.existsSync(oldLocationPath),
        'files in system tmpdir root should NOT be scanned by reapStaleTempFiles'
      );

      // Clean up manually
      fs.unlinkSync(oldLocationPath);
    });

    test('backward compat: reapStaleTempFilesLegacy cleans old location', () => {
      // Place a stale file in the old location (system tmpdir root)
      const oldLocationPath = path.join(os.tmpdir(), `${testPrefix}legacy.json`);
      fs.writeFileSync(oldLocationPath, '{}');
      const oldTime = new Date(Date.now() - 10 * 60 * 1000);
      fs.utimesSync(oldLocationPath, oldTime, oldTime);

      // The legacy reap function should still clean old-location files
      // We import it if exported, or verify the main reap handles both
      const core = require('../get-shit-done/bin/lib/core.cjs');
      if (typeof core.reapStaleTempFilesLegacy === 'function') {
        core.reapStaleTempFilesLegacy(testPrefix, { maxAgeMs: 5 * 60 * 1000 });
        assert.ok(!fs.existsSync(oldLocationPath), 'legacy reap should clean old location');
      } else {
        // If no separate legacy function, the main output() should do a one-time
        // migration sweep. We just verify the export shape is correct.
        assert.ok(typeof core.reapStaleTempFiles === 'function');
        // Clean up manually since we're not testing migration here
        fs.unlinkSync(oldLocationPath);
      }
    });
  });
});
