/**
 * GSD Tools Tests - docs-update
 *
 * Integration tests for the docs-init gsd-tools subcommand.
 * Covers: JSON output shape, project type detection, existing doc scanning,
 * GSD marker detection, and doc tooling detection.
 *
 * Requirements: VERF-03
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

// ─── JSON output shape ────────────────────────────────────────────────────────

describe('docs-init command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('returns expected JSON shape', () => {
    const result = runGsdTools(['docs-init'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);

    // Top-level scalar fields
    assert.strictEqual(typeof data.doc_writer_model, 'string');
    assert.strictEqual(typeof data.commit_docs, 'boolean');
    assert.strictEqual(typeof data.planning_exists, 'boolean');
    assert.strictEqual(typeof data.project_root, 'string');
    assert.strictEqual(typeof data.agents_installed, 'boolean');

    // Array fields
    assert.ok(Array.isArray(data.existing_docs), 'existing_docs should be an array');
    assert.ok(Array.isArray(data.monorepo_workspaces), 'monorepo_workspaces should be an array');
    assert.ok(Array.isArray(data.missing_agents), 'missing_agents should be an array');

    // project_type object with 7 boolean fields
    assert.ok(data.project_type && typeof data.project_type === 'object', 'project_type should be an object');
    assert.strictEqual(typeof data.project_type.has_package_json, 'boolean');
    assert.strictEqual(typeof data.project_type.has_api_routes, 'boolean');
    assert.strictEqual(typeof data.project_type.has_cli_bin, 'boolean');
    assert.strictEqual(typeof data.project_type.is_open_source, 'boolean');
    assert.strictEqual(typeof data.project_type.has_deploy_config, 'boolean');
    assert.strictEqual(typeof data.project_type.is_monorepo, 'boolean');
    assert.strictEqual(typeof data.project_type.has_tests, 'boolean');

    // doc_tooling object with 4 boolean fields
    assert.ok(data.doc_tooling && typeof data.doc_tooling === 'object', 'doc_tooling should be an object');
    assert.strictEqual(typeof data.doc_tooling.docusaurus, 'boolean');
    assert.strictEqual(typeof data.doc_tooling.vitepress, 'boolean');
    assert.strictEqual(typeof data.doc_tooling.mkdocs, 'boolean');
    assert.strictEqual(typeof data.doc_tooling.storybook, 'boolean');

    // planning_exists is true since createTempProject creates .planning/
    assert.strictEqual(data.planning_exists, true);
  });

  test('bare project returns all false signals', () => {
    const result = runGsdTools(['docs-init'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);

    // All project_type fields should be false for a bare project
    assert.strictEqual(data.project_type.has_package_json, false);
    assert.strictEqual(data.project_type.has_api_routes, false);
    assert.strictEqual(data.project_type.has_cli_bin, false);
    assert.strictEqual(data.project_type.is_open_source, false);
    assert.strictEqual(data.project_type.has_deploy_config, false);
    assert.strictEqual(data.project_type.is_monorepo, false);
    assert.strictEqual(data.project_type.has_tests, false);

    // No docs, no workspaces, no doc tooling
    assert.deepEqual(data.existing_docs, []);
    assert.deepEqual(data.monorepo_workspaces, []);
    assert.strictEqual(data.doc_tooling.docusaurus, false);
    assert.strictEqual(data.doc_tooling.vitepress, false);
    assert.strictEqual(data.doc_tooling.mkdocs, false);
    assert.strictEqual(data.doc_tooling.storybook, false);
  });
});

// ─── project type detection ───────────────────────────────────────────────────

describe('project type detection', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('detects CLI tool from package.json bin field', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'my-cli', bin: { mycli: 'bin/cli.js' } }),
      'utf-8'
    );

    const result = runGsdTools(['docs-init'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.strictEqual(data.project_type.has_cli_bin, true);
    assert.strictEqual(data.project_type.has_package_json, true);
  });

  test('detects open source from LICENSE file', () => {
    fs.writeFileSync(path.join(tmpDir, 'LICENSE'), 'MIT License', 'utf-8');

    const result = runGsdTools(['docs-init'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.strictEqual(data.project_type.is_open_source, true);
  });

  test('detects monorepo from package.json workspaces', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'mono', workspaces: ['packages/*'] }),
      'utf-8'
    );

    const result = runGsdTools(['docs-init'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.strictEqual(data.project_type.is_monorepo, true);
    assert.ok(data.monorepo_workspaces.includes('packages/*'), 'monorepo_workspaces should contain packages/*');
  });

  test('detects tests from tests directory', () => {
    fs.mkdirSync(path.join(tmpDir, 'tests'), { recursive: true });

    const result = runGsdTools(['docs-init'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.strictEqual(data.project_type.has_tests, true);
  });

  test('detects deploy config from Dockerfile', () => {
    fs.writeFileSync(path.join(tmpDir, 'Dockerfile'), 'FROM node:20', 'utf-8');

    const result = runGsdTools(['docs-init'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.strictEqual(data.project_type.has_deploy_config, true);
  });

  test('detects API routes from src/app/api directory', () => {
    fs.mkdirSync(path.join(tmpDir, 'src', 'app', 'api'), { recursive: true });

    const result = runGsdTools(['docs-init'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.strictEqual(data.project_type.has_api_routes, true);
  });
});

// ─── existing doc scanning ────────────────────────────────────────────────────

describe('existing doc scanning', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('scans .md files in project root', () => {
    fs.writeFileSync(path.join(tmpDir, 'README.md'), '# README\n', 'utf-8');
    fs.writeFileSync(path.join(tmpDir, 'ARCHITECTURE.md'), '# Architecture\n', 'utf-8');

    const result = runGsdTools(['docs-init'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.ok(data.existing_docs.length >= 2, 'existing_docs should contain at least 2 entries');

    const paths = data.existing_docs.map(d => d.path);
    assert.ok(paths.includes('README.md'), 'existing_docs should contain README.md');
    assert.ok(paths.includes('ARCHITECTURE.md'), 'existing_docs should contain ARCHITECTURE.md');
  });

  test('detects GSD marker in existing docs', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'README.md'),
      '<!-- generated-by: gsd-doc-writer -->\n# README\n',
      'utf-8'
    );
    fs.writeFileSync(path.join(tmpDir, 'NOTES.md'), '# Notes\n', 'utf-8');

    const result = runGsdTools(['docs-init'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);

    const readmeEntry = data.existing_docs.find(d => d.path === 'README.md');
    assert.ok(readmeEntry, 'README.md should appear in existing_docs');
    assert.strictEqual(readmeEntry.has_gsd_marker, true, 'README.md should have GSD marker');

    const notesEntry = data.existing_docs.find(d => d.path === 'NOTES.md');
    assert.ok(notesEntry, 'NOTES.md should appear in existing_docs');
    assert.strictEqual(notesEntry.has_gsd_marker, false, 'NOTES.md should not have GSD marker');
  });
});

// ─── doc tooling detection ────────────────────────────────────────────────────

describe('doc tooling detection', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('detects Docusaurus config', () => {
    fs.writeFileSync(path.join(tmpDir, 'docusaurus.config.js'), 'module.exports = {};', 'utf-8');

    const result = runGsdTools(['docs-init'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.strictEqual(data.doc_tooling.docusaurus, true);
  });

  test('detects VitePress config', () => {
    fs.mkdirSync(path.join(tmpDir, '.vitepress'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.vitepress', 'config.ts'), 'export default {};', 'utf-8');

    const result = runGsdTools(['docs-init'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.strictEqual(data.doc_tooling.vitepress, true);
  });

  test('detects MkDocs config', () => {
    fs.writeFileSync(path.join(tmpDir, 'mkdocs.yml'), 'site_name: test', 'utf-8');

    const result = runGsdTools(['docs-init'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.strictEqual(data.doc_tooling.mkdocs, true);
  });
});
