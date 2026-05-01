/**
 * GSD Tools Tests — detect-custom-files misses skills/ directory (#2942)
 *
 * After v1.39.0 skill consolidation (#2790), skills/ became a GSD-managed root.
 * GSD_MANAGED_DIRS was missing 'skills', so user-added skill directories like
 * skills/custom-skill/SKILL.md were never walked and got silently destroyed
 * during /gsd-update.
 */

'use strict';

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { runGsdTools, createTempDir, cleanup } = require('./helpers.cjs');

function sha256(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Write a fake gsd-file-manifest.json into configDir with the given file entries.
 * Each entry is also written to disk so the directory structure exists.
 */
function writeManifest(configDir, files) {
  const manifest = {
    version: '1.39.0',
    timestamp: new Date().toISOString(),
    files: {}
  };
  for (const [relPath, content] of Object.entries(files)) {
    const fullPath = path.join(configDir, relPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content);
    manifest.files[relPath] = sha256(content);
  }
  fs.writeFileSync(
    path.join(configDir, 'gsd-file-manifest.json'),
    JSON.stringify(manifest, null, 2)
  );
}

/**
 * Write a file inside configDir (creating parent dirs), but do NOT add it to the manifest.
 */
function writeCustomFile(configDir, relPath, content) {
  const fullPath = path.join(configDir, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content);
}

describe('detect-custom-files — skills/ directory missing from GSD_MANAGED_DIRS (#2942)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempDir('gsd-2942-skills-');
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  // Test 1: detects custom skill in skills/<name>/SKILL.md
  test('detects custom skill file at skills/<name>/SKILL.md', () => {
    writeManifest(tmpDir, {
      'skills/gsd-planner/SKILL.md': '# GSD Planner Skill\n',
    });

    // User-added custom skill — NOT in manifest
    writeCustomFile(tmpDir, 'skills/test-custom/SKILL.md', '# My Custom Skill\n');

    const result = runGsdTools(
      ['detect-custom-files', '--config-dir', tmpDir],
      tmpDir
    );

    assert.ok(result.success, `Command failed: ${result.error}`);

    const json = JSON.parse(result.output);
    assert.ok(Array.isArray(json.custom_files), 'custom_files should be an array');
    assert.ok(json.custom_count >= 1, `custom_count should be >= 1, got ${json.custom_count}`);
    assert.ok(
      json.custom_files.includes('skills/test-custom/SKILL.md'),
      `skills/test-custom/SKILL.md should be in custom_files; got: ${JSON.stringify(json.custom_files)}`
    );
  });

  // Test 2: does not flag GSD-owned skills as custom (manifest-tracked path NOT in custom_files)
  test('does not flag GSD-owned skill as custom when it is tracked in manifest', () => {
    writeManifest(tmpDir, {
      'skills/gsd-planner/SKILL.md': '# GSD Planner Skill\n',
    });

    // No extra files — only the manifest-tracked skill exists

    const result = runGsdTools(
      ['detect-custom-files', '--config-dir', tmpDir],
      tmpDir
    );

    assert.ok(result.success, `Command failed: ${result.error}`);

    const json = JSON.parse(result.output);
    assert.ok(Array.isArray(json.custom_files), 'custom_files should be an array');
    assert.ok(
      !json.custom_files.includes('skills/gsd-planner/SKILL.md'),
      `GSD-owned skill should NOT be in custom_files; got: ${JSON.stringify(json.custom_files)}`
    );
  });

  // Test 3: regression guard — still detects custom files in get-shit-done/workflows/
  test('regression: still detects custom files in get-shit-done/workflows/', () => {
    writeManifest(tmpDir, {
      'get-shit-done/workflows/plan-phase.md': '# Plan Phase\n',
      'skills/gsd-planner/SKILL.md': '# GSD Planner Skill\n',
    });

    writeCustomFile(tmpDir, 'get-shit-done/workflows/custom-workflow.md', '# My Custom Workflow\n');

    const result = runGsdTools(
      ['detect-custom-files', '--config-dir', tmpDir],
      tmpDir
    );

    assert.ok(result.success, `Command failed: ${result.error}`);

    const json = JSON.parse(result.output);
    assert.ok(
      json.custom_files.includes('get-shit-done/workflows/custom-workflow.md'),
      `custom workflow should still be detected; got: ${JSON.stringify(json.custom_files)}`
    );
  });

  // Test 4: custom_count matches custom_files.length
  test('custom_count matches custom_files.length when multiple custom skills exist', () => {
    writeManifest(tmpDir, {
      'skills/gsd-planner/SKILL.md': '# GSD Planner Skill\n',
    });

    writeCustomFile(tmpDir, 'skills/test-custom/SKILL.md', '# Custom Skill One\n');
    writeCustomFile(tmpDir, 'skills/another-custom/SKILL.md', '# Custom Skill Two\n');

    const result = runGsdTools(
      ['detect-custom-files', '--config-dir', tmpDir],
      tmpDir
    );

    assert.ok(result.success, `Command failed: ${result.error}`);

    const json = JSON.parse(result.output);
    assert.strictEqual(
      json.custom_count,
      json.custom_files.length,
      `custom_count (${json.custom_count}) should equal custom_files.length (${json.custom_files.length})`
    );
    assert.strictEqual(json.custom_count, 2, 'should detect exactly 2 custom skill files');
  });

  // Test 5: manifest_found: true when manifest is present
  test('manifest_found is true when manifest is present', () => {
    writeManifest(tmpDir, {
      'skills/gsd-planner/SKILL.md': '# GSD Planner Skill\n',
    });

    const result = runGsdTools(
      ['detect-custom-files', '--config-dir', tmpDir],
      tmpDir
    );

    assert.ok(result.success, `Command failed: ${result.error}`);

    const json = JSON.parse(result.output);
    assert.strictEqual(json.manifest_found, true, 'manifest_found should be true');
  });
});
