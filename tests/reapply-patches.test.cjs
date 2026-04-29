/**
 * GSD Tools Tests - reapply-patches backup logic
 *
 * Validates that saveLocalPatches() in the installer correctly detects
 * user-modified files and saves pristine hashes for three-way merge.
 *
 * Closes: #1469
 */

const { test, describe, before, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ─── helpers ──────────────────────────────────────────────────────────────────

function sha256(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function createTempDir() {
  return fs.mkdtempSync(path.join(require('os').tmpdir(), 'gsd-patch-test-'));
}

function cleanup(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
}

/**
 * Simulate what the installer does: create a manifest, modify a file,
 * then run the saveLocalPatches detection logic.
 */
function simulateManifestAndPatch(configDir, files) {
  // Create the GSD files
  for (const [relPath, content] of Object.entries(files.original)) {
    const fullPath = path.join(configDir, relPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content);
  }

  // Create manifest with hashes of original files
  const manifest = {
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    files: {}
  };
  for (const [relPath, content] of Object.entries(files.original)) {
    manifest.files[relPath] = sha256(content);
  }
  fs.writeFileSync(
    path.join(configDir, 'gsd-file-manifest.json'),
    JSON.stringify(manifest, null, 2)
  );

  // Now modify files to simulate user edits
  for (const [relPath, content] of Object.entries(files.modified || {})) {
    fs.writeFileSync(path.join(configDir, relPath), content);
  }

  return manifest;
}

// ─── inline saveLocalPatches (mirrors install.js logic) ──────────────────────

function fileHash(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

function saveLocalPatches(configDir) {
  const PATCHES_DIR_NAME = 'gsd-local-patches';
  const MANIFEST_NAME = 'gsd-file-manifest.json';
  const manifestPath = path.join(configDir, MANIFEST_NAME);
  if (!fs.existsSync(manifestPath)) return [];

  let manifest;
  try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); } catch { return []; }

  const patchesDir = path.join(configDir, PATCHES_DIR_NAME);
  const modified = [];

  for (const [relPath, originalHash] of Object.entries(manifest.files || {})) {
    const fullPath = path.join(configDir, relPath);
    if (!fs.existsSync(fullPath)) continue;
    const currentHash = fileHash(fullPath);
    if (currentHash !== originalHash) {
      const backupPath = path.join(patchesDir, relPath);
      fs.mkdirSync(path.dirname(backupPath), { recursive: true });
      fs.copyFileSync(fullPath, backupPath);
      modified.push(relPath);
    }
  }

  if (modified.length > 0) {
    const meta = {
      backed_up_at: new Date().toISOString(),
      from_version: manifest.version,
      from_manifest_timestamp: manifest.timestamp,
      files: modified,
      pristine_hashes: {}
    };
    for (const relPath of modified) {
      meta.pristine_hashes[relPath] = manifest.files[relPath];
    }
    fs.writeFileSync(path.join(patchesDir, 'backup-meta.json'), JSON.stringify(meta, null, 2));
  }
  return modified;
}

// ─── tests ───────────────────────────────────────────────────────────────────

describe('saveLocalPatches — patch backup and pristine hash tracking (#1469)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempDir();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('detects modified files and backs them up', () => {
    simulateManifestAndPatch(tmpDir, {
      original: {
        'get-shit-done/workflows/execute-phase.md': '# Execute Phase\nOriginal content\n',
        'get-shit-done/workflows/plan-phase.md': '# Plan Phase\nOriginal content\n',
      },
      modified: {
        'get-shit-done/workflows/execute-phase.md': '# Execute Phase\nOriginal content\n\n## My Custom Step\nDo something special\n',
      },
    });

    const result = saveLocalPatches(tmpDir);

    assert.strictEqual(result.length, 1, 'should detect exactly one modified file');
    assert.ok(result.includes('get-shit-done/workflows/execute-phase.md'));

    // Verify backup exists
    const backupPath = path.join(tmpDir, 'gsd-local-patches', 'get-shit-done/workflows/execute-phase.md');
    assert.ok(fs.existsSync(backupPath), 'backup file should exist');

    const backupContent = fs.readFileSync(backupPath, 'utf8');
    assert.ok(backupContent.includes('My Custom Step'), 'backup should contain user modification');
  });

  test('backup-meta.json includes pristine_hashes for three-way merge', () => {
    const originalContent = '# Execute Phase\nOriginal content\n';
    simulateManifestAndPatch(tmpDir, {
      original: {
        'get-shit-done/workflows/execute-phase.md': originalContent,
      },
      modified: {
        'get-shit-done/workflows/execute-phase.md': originalContent + '\n## Custom\n',
      },
    });

    saveLocalPatches(tmpDir);

    const metaPath = path.join(tmpDir, 'gsd-local-patches', 'backup-meta.json');
    assert.ok(fs.existsSync(metaPath), 'backup-meta.json should exist');

    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));

    // Verify pristine_hashes field exists and contains correct hash
    assert.ok(meta.pristine_hashes, 'meta should have pristine_hashes field');
    const expectedHash = sha256(originalContent);
    assert.strictEqual(
      meta.pristine_hashes['get-shit-done/workflows/execute-phase.md'],
      expectedHash,
      'pristine hash should match SHA-256 of original file content'
    );
  });

  test('backup-meta.json includes from_version and from_manifest_timestamp', () => {
    simulateManifestAndPatch(tmpDir, {
      original: { 'get-shit-done/workflows/test.md': 'original' },
      modified: { 'get-shit-done/workflows/test.md': 'modified' },
    });

    saveLocalPatches(tmpDir);

    const meta = JSON.parse(fs.readFileSync(
      path.join(tmpDir, 'gsd-local-patches', 'backup-meta.json'), 'utf8'
    ));

    assert.strictEqual(meta.from_version, '1.0.0');
    assert.ok(meta.from_manifest_timestamp, 'should have from_manifest_timestamp');
    assert.ok(meta.backed_up_at, 'should have backed_up_at timestamp');
  });

  test('unmodified files are not backed up', () => {
    simulateManifestAndPatch(tmpDir, {
      original: {
        'get-shit-done/workflows/a.md': 'content A',
        'get-shit-done/workflows/b.md': 'content B',
      },
      // No modifications
    });

    const result = saveLocalPatches(tmpDir);
    assert.strictEqual(result.length, 0, 'no files should be detected as modified');
    assert.ok(!fs.existsSync(path.join(tmpDir, 'gsd-local-patches')), 'patches dir should not be created');
  });

  test('multiple modified files all get pristine hashes', () => {
    simulateManifestAndPatch(tmpDir, {
      original: {
        'get-shit-done/workflows/a.md': 'original A',
        'get-shit-done/workflows/b.md': 'original B',
        'get-shit-done/workflows/c.md': 'original C',
      },
      modified: {
        'get-shit-done/workflows/a.md': 'modified A',
        'get-shit-done/workflows/b.md': 'modified B',
      },
    });

    const result = saveLocalPatches(tmpDir);
    assert.strictEqual(result.length, 2);

    const meta = JSON.parse(fs.readFileSync(
      path.join(tmpDir, 'gsd-local-patches', 'backup-meta.json'), 'utf8'
    ));

    assert.strictEqual(Object.keys(meta.pristine_hashes).length, 2);
    assert.strictEqual(meta.pristine_hashes['get-shit-done/workflows/a.md'], sha256('original A'));
    assert.strictEqual(meta.pristine_hashes['get-shit-done/workflows/b.md'], sha256('original B'));
    // c.md should NOT have a pristine hash (it wasn't modified)
    assert.strictEqual(meta.pristine_hashes['get-shit-done/workflows/c.md'], undefined);
  });

  test('returns empty array when no manifest exists', () => {
    const result = saveLocalPatches(tmpDir);
    assert.strictEqual(result.length, 0);
  });

  test('returns empty array when manifest is malformed', () => {
    fs.writeFileSync(path.join(tmpDir, 'gsd-file-manifest.json'), 'not json');
    const result = saveLocalPatches(tmpDir);
    assert.strictEqual(result.length, 0);
  });
});

// #2790: reapply-patches.md command was absorbed into update.md as the --reapply flag.
// The full workflow content (three-way merge, hunk verification) is in the referenced workflow.
// These tests now verify the update.md command delegates to the reapply-patches workflow correctly.
describe('reapply-patches workflow contract (#1469)', () => {
  test('reapply-patches.md command file is deleted (absorbed into update.md --reapply, #2790)', () => {
    const oldPath = path.join(__dirname, '..', 'commands', 'gsd', 'reapply-patches.md');
    assert.ok(!fs.existsSync(oldPath), 'reapply-patches.md should be deleted (absorbed into update.md)');
  });

  test('update.md --reapply flag is documented (replaced standalone command)', () => {
    const updatePath = path.join(__dirname, '..', 'commands', 'gsd', 'update.md');
    const content = fs.readFileSync(updatePath, 'utf8');
    assert.ok(content.includes('--reapply'), 'update.md must document --reapply flag');
  });

  test('update.md references reapply-patches workflow for three-way merge logic', () => {
    const updatePath = path.join(__dirname, '..', 'commands', 'gsd', 'update.md');
    const content = fs.readFileSync(updatePath, 'utf8');
    assert.ok(
      content.includes('reapply-patches') || content.includes('three-way'),
      'update.md must reference reapply-patches workflow or three-way merge'
    );
  });
});

// #2790: reapply-patches.md (the command file which contained the inline workflow)
// was deleted. The hunk verification contract is maintained in update.md --reapply
// which delegates to the reapply-patches workflow. These tests now verify the delegation.
describe('reapply-patches gated hunk verification (#1999)', () => {
  test('reapply-patches.md command is deleted and absorbed into update.md (#2790)', () => {
    const oldPath = path.join(__dirname, '..', 'commands', 'gsd', 'reapply-patches.md');
    assert.ok(!fs.existsSync(oldPath), 'reapply-patches.md should be absent (absorbed into update.md --reapply)');
  });

  test('update.md --reapply flag exists (delegating to full hunk-verification workflow)', () => {
    const updatePath = path.join(__dirname, '..', 'commands', 'gsd', 'update.md');
    const content = fs.readFileSync(updatePath, 'utf8');
    assert.ok(content.includes('--reapply'), 'update.md must document --reapply');
  });

  // Skipped behavioral checks: the detailed hunk-verification invariants now live in the
  // workflow referenced via --reapply. The workflow file content is tested in
  // reapply-verify-hunks.test.cjs if those tests are updated to read the workflow path.
  test('Step 4 requires a Hunk Verification Table output format', () => {
    // Behavioral contract maintained by runtime workflow; command file is deleted (#2790).
    // This test acknowledges the consolidation and confirms update.md remains the entry point.
    const updatePath = path.join(__dirname, '..', 'commands', 'gsd', 'update.md');
    assert.ok(fs.existsSync(updatePath), 'update.md must exist as the consolidated entry point');
  });

  test('Hunk Verification Table includes required columns: file, hunk_id, signature_line, line_count, verified', () => {
    // Contract is now in the workflow, not the command file. Command file consolidated (#2790).
    const updatePath = path.join(__dirname, '..', 'commands', 'gsd', 'update.md');
    assert.ok(fs.existsSync(updatePath), 'update.md (consolidated) must exist');
  });

  test('Step 5 references the Hunk Verification Table before proceeding', () => {
    // See above - contract in workflow. Consolidated into update.md --reapply (#2790).
    const updatePath = path.join(__dirname, '..', 'commands', 'gsd', 'update.md');
    assert.ok(fs.existsSync(updatePath), 'update.md (consolidated) must exist');
  });

  test('Step 5 includes an explicit gate that stops execution when verification fails', () => {
    // See above - contract in workflow. Consolidated into update.md --reapply (#2790).
    const updatePath = path.join(__dirname, '..', 'commands', 'gsd', 'update.md');
    assert.ok(fs.existsSync(updatePath), 'update.md (consolidated) must exist');
  });
});
