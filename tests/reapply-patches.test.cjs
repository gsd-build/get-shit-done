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

// allow-test-rule: source-text-is-the-product
// update.md routing and reapply-patches.md workflow text IS the deployed behavioral contract.

/**
 * Parse a field from YAML frontmatter between --- markers.
 * Returns null if the frontmatter or field is absent.
 */
function parseFrontmatterField(content, field) {
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fmMatch) return null;
  const fm = fmMatch[1];
  const quoted = fm.match(new RegExp(`^${field}:\\s+"((?:[^"\\\\]|\\\\.)*)"\\s*$`, 'm'));
  if (quoted) return quoted[1];
  const plain = fm.match(new RegExp(`^${field}:\\s+(.+)$`, 'm'));
  if (plain) return plain[1].trim();
  return null;
}

// #2790: reapply-patches.md command was absorbed into update.md as the --reapply flag.
// The full workflow content (three-way merge, hunk verification) is in the referenced workflow.
// These tests now verify the update.md command delegates to the reapply-patches workflow correctly.

/**
 * Parse a markdown pipe-table into header + rows. Returns null if no table
 * with the expected header tokens is found. Used to assert structurally
 * against the Hunk Verification Table without raw substring matching.
 */
function parsePipeTable(content, expectedHeaderTokens) {
  const lines = content.split('\n');
  for (let i = 0; i < lines.length - 1; i++) {
    const headerLine = lines[i].trim();
    const sepLine = (lines[i + 1] || '').trim();
    if (!headerLine.startsWith('|') || !sepLine.startsWith('|')) continue;
    if (!/^\|\s*[:\- |]+\|\s*$/.test(sepLine)) continue;
    const header = headerLine.slice(1, -1).split('|').map((s) => s.trim());
    const headerLower = header.map((h) => h.toLowerCase());
    const allFound = expectedHeaderTokens.every((tok) => headerLower.includes(tok.toLowerCase()));
    if (!allFound) continue;
    const rows = [];
    for (let j = i + 2; j < lines.length; j++) {
      const rowLine = lines[j].trim();
      if (!rowLine.startsWith('|')) break;
      const cells = rowLine.slice(1, -1).split('|').map((s) => s.trim());
      const row = {};
      header.forEach((col, idx) => { row[col] = cells[idx] !== undefined ? cells[idx] : ''; });
      rows.push(row);
    }
    return { header, rows };
  }
  return null;
}

describe('reapply-patches workflow contract (#1469)', () => {
  test('reapply-patches.md command file is deleted (absorbed into update.md --reapply, #2790)', () => {
    const oldPath = path.join(__dirname, '..', 'commands', 'gsd', 'reapply-patches.md');
    assert.ok(!fs.existsSync(oldPath), 'reapply-patches.md should be deleted (absorbed into update.md)');
  });

  test('update.md argument-hint declares --reapply as consolidated entry point', () => {
    // Structural: parse frontmatter, then tokenize the argument-hint pipes
    // and assert --reapply is one of the documented flags (no raw substring
    // matching on prose, per the no-source-grep contract).
    const updatePath = path.join(__dirname, '..', 'commands', 'gsd', 'update.md');
    const content = fs.readFileSync(updatePath, 'utf8');
    const argHint = parseFrontmatterField(content, 'argument-hint');
    assert.ok(argHint, 'update.md frontmatter must declare argument-hint');
    // argument-hint may include multiple bracketed segments; pull every
    // `--flag` token out of any bracketed section to assert on a parsed
    // flag set rather than the surrounding punctuation.
    const bracketed = [...argHint.matchAll(/\[([^\]]*)\]/g)].map((m) => m[1]);
    const flagList = bracketed
      .flatMap((seg) => seg.split('|').map((s) => s.trim().split(/\s+/)[0]))
      .filter((tok) => tok.startsWith('--'));
    assert.ok(
      flagList.includes('--reapply'),
      `update.md argument-hint flag list must include --reapply; got: ${JSON.stringify(flagList)}`
    );
  });

  test('update.md @-include declares the reapply-patches workflow as a dependency', () => {
    // Structural: scan ALL <execution_context> and <execution_context_extended>
    // blocks for an `@~/.../workflows/reapply-patches.md` include. The earlier
    // substring check tolerated incidental mentions in prose; matching only the
    // first context block missed the _extended block where the delegate lives.
    const updatePath = path.join(__dirname, '..', 'commands', 'gsd', 'update.md');
    const content = fs.readFileSync(updatePath, 'utf8');
    const blocks = [
      ...content.matchAll(/<execution_context(?:_extended)?>([\s\S]*?)<\/execution_context(?:_extended)?>/g),
    ].map((m) => m[1]);
    assert.ok(blocks.length > 0, 'update.md must define at least one <execution_context> block');
    const includes = blocks
      .flatMap((blk) => blk.split('\n'))
      .map((l) => l.trim())
      .filter((l) => l.startsWith('@'))
      .map((l) => l.replace(/^@/, ''));
    const declaresReapply = includes.some((p) => /(^|\/)workflows\/reapply-patches\.md$/.test(p));
    assert.ok(
      declaresReapply,
      `update.md execution_context blocks must @-include workflows/reapply-patches.md; got: ${JSON.stringify(includes)}`
    );
  });
});

// #2790: reapply-patches.md (the command file which contained the inline workflow)
// was deleted. The hunk verification contract now lives in the workflow file
// get-shit-done/workflows/reapply-patches.md, referenced via execution_context_extended.
describe('reapply-patches gated hunk verification (#1999)', () => {
  const workflowPath = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'reapply-patches.md');

  test('reapply-patches.md command is deleted and absorbed into update.md (#2790)', () => {
    const oldPath = path.join(__dirname, '..', 'commands', 'gsd', 'reapply-patches.md');
    assert.ok(!fs.existsSync(oldPath), 'reapply-patches.md should be absent (absorbed into update.md --reapply)');
  });

  test('reapply-patches workflow file exists (behavioral contract for --reapply)', () => {
    assert.ok(fs.existsSync(workflowPath), 'get-shit-done/workflows/reapply-patches.md must exist');
  });

  test('Step 4 declares a Hunk Verification Table with all required columns', () => {
    // Structural: parse the markdown pipe-table out of the workflow and
    // assert its header columns directly. Substring checks let row text
    // collide with prose mentions and fail under harmless rewording.
    const content = fs.readFileSync(workflowPath, 'utf8');
    const required = ['file', 'hunk_id', 'signature_line', 'line_count', 'verified'];
    const table = parsePipeTable(content, required);
    assert.ok(
      table,
      `reapply-patches workflow must declare a pipe-table with header columns ${JSON.stringify(required)} (Hunk Verification Table)`
    );
    const headerLower = table.header.map((h) => h.toLowerCase());
    for (const col of required) {
      assert.ok(headerLower.includes(col.toLowerCase()), `Hunk Verification Table is missing required column "${col}"; got header ${JSON.stringify(table.header)}`);
    }
  });

  test('Step 5 gates progression on the Hunk Verification Table', () => {
    // Locate the Step 5 section structurally via heading parsing, then
    // assert it both names the table and defines an explicit gate
    // condition tied to the `verified` column.
    const content = fs.readFileSync(workflowPath, 'utf8');
    const step5Match = content.match(/^##\s+Step 5[^\n]*\n([\s\S]*?)(?=^##\s|\Z)/m);
    assert.ok(step5Match, 'reapply-patches workflow must contain a "## Step 5" section');
    const step5 = step5Match[1];
    assert.ok(
      /Hunk Verification Table/.test(step5),
      'Step 5 body must explicitly reference the Hunk Verification Table'
    );
    // Gate condition: must mention verified=no (or "verified: no") AND a stop
    // directive (STOP / halt / abort), so missing-table or any-no-row halts.
    const referencesVerifiedNo = /verified:\s*no/i.test(step5) || /verified\s*=\s*no/i.test(step5);
    const referencesStop = /\bSTOP\b/.test(step5) || /\bhalt\b/i.test(step5) || /\babort\b/i.test(step5);
    assert.ok(
      referencesVerifiedNo,
      'Step 5 gate must reference the `verified: no` failure condition (no row may slip past)'
    );
    assert.ok(
      referencesStop,
      'Step 5 gate must explicitly STOP/halt/abort when verification fails'
    );
  });

  test('Step 5 also halts when the Hunk Verification Table is absent (Step 4 produced nothing)', () => {
    // Independent gate: missing-table is a separate halt path from any-no-row.
    const content = fs.readFileSync(workflowPath, 'utf8');
    const step5Match = content.match(/^##\s+Step 5[^\n]*\n([\s\S]*?)(?=^##\s|\Z)/m);
    assert.ok(step5Match, 'Step 5 section must exist');
    const step5 = step5Match[1];
    const handlesAbsent = /(table is absent|table is missing|missing.*table|absent.*table)/i.test(step5);
    assert.ok(
      handlesAbsent,
      'Step 5 must include an explicit "table absent / missing" halt path so Step 4 silently producing nothing cannot bypass the gate'
    );
  });
});
