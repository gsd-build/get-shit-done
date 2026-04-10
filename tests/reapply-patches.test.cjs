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

describe('reapply-patches workflow contract (#1469)', () => {
  test('workflow file contains critical invariant about never skipping backed-up files', () => {
    const workflowPath = path.join(__dirname, '..', 'commands', 'gsd', 'reapply-patches.md');
    const content = fs.readFileSync(workflowPath, 'utf8');

    // The workflow must explicitly state that "no custom content" is never valid
    assert.ok(
      content.includes('NEVER conclude "no custom content"') ||
      content.includes('never a valid conclusion'),
      'workflow must contain the critical invariant about never skipping backed-up files'
    );
  });

  test('workflow file describes three-way merge strategy', () => {
    const workflowPath = path.join(__dirname, '..', 'commands', 'gsd', 'reapply-patches.md');
    const content = fs.readFileSync(workflowPath, 'utf8');

    assert.ok(content.includes('three-way') || content.includes('Three-way'),
      'workflow must describe three-way merge strategy');
    assert.ok(content.includes('pristine'),
      'workflow must reference pristine baseline for comparison');
  });

  test('workflow file describes git-aware detection path', () => {
    const workflowPath = path.join(__dirname, '..', 'commands', 'gsd', 'reapply-patches.md');
    const content = fs.readFileSync(workflowPath, 'utf8');

    assert.ok(content.includes('git log') || content.includes('git -C'),
      'workflow must describe git-based detection of user changes');
  });
});

describe('reapply-patches gated hunk verification (#1999)', () => {
  let workflowContent;

  before(() => {
    const workflowPath = path.join(__dirname, '..', 'commands', 'gsd', 'reapply-patches.md');
    workflowContent = fs.readFileSync(workflowPath, 'utf8');
  });

  test('Step 4 requires a Hunk Verification Table output format', () => {
    // Step 4 must mandate production of a named table with specific columns
    assert.ok(
      workflowContent.includes('Hunk Verification Table'),
      'Step 4 must require production of a Hunk Verification Table'
    );
  });

  test('Hunk Verification Table includes required columns: file, hunk_id, signature_line, line_count, verified', () => {
    assert.ok(
      workflowContent.includes('hunk_id'),
      'Hunk Verification Table must include hunk_id column'
    );
    assert.ok(
      workflowContent.includes('signature_line'),
      'Hunk Verification Table must include signature_line column'
    );
    assert.ok(
      workflowContent.includes('line_count'),
      'Hunk Verification Table must include line_count column'
    );
    assert.ok(
      workflowContent.includes('verified'),
      'Hunk Verification Table must include verified column'
    );
  });

  test('Step 5 references the Hunk Verification Table before proceeding', () => {
    // Step 5 must consume the table produced by Step 4
    const step5Match = workflowContent.match(/##\s+Step\s+5[^\n]*\n([\s\S]*?)(?=##\s+Step\s+6|<\/process>|$)/);
    assert.ok(step5Match, 'Step 5 must exist in the workflow');

    const step5Content = step5Match[1];
    assert.ok(
      step5Content.includes('Hunk Verification Table'),
      'Step 5 must reference the Hunk Verification Table'
    );
  });

  test('Step 5 includes an explicit gate that stops execution when verification fails', () => {
    const step5Match = workflowContent.match(/##\s+Step\s+5[^\n]*\n([\s\S]*?)(?=##\s+Step\s+6|<\/process>|$)/);
    assert.ok(step5Match, 'Step 5 must exist in the workflow');

    const step5Content = step5Match[1];

    // Must refuse to proceed when any hunk is unverified or the table is absent
    const hasGate = (
      step5Content.includes('verified: no') ||
      step5Content.includes('verified: No') ||
      step5Content.includes('"no"') ||
      step5Content.includes('STOP')
    ) && (
      step5Content.includes('absent') ||
      step5Content.includes('missing') ||
      step5Content.includes('not present')
    );

    assert.ok(
      hasGate,
      'Step 5 must include an explicit gate: STOP if any row shows verified: no or the table is absent'
    );
  });
});
