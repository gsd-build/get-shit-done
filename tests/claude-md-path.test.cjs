/**
 * Tests for configurable claude_md_path setting (#2010)
 */

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

describe('claude_md_path config key', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('claude_md_path is in VALID_CONFIG_KEYS', () => {
    const { VALID_CONFIG_KEYS } = require('../get-shit-done/bin/lib/config.cjs');
    assert.ok(VALID_CONFIG_KEYS.has('claude_md_path'));
  });

  test('config template includes claude_md_path', () => {
    const templatePath = path.join(__dirname, '..', 'get-shit-done', 'templates', 'config.json');
    const template = JSON.parse(fs.readFileSync(templatePath, 'utf-8'));
    assert.strictEqual(template.claude_md_path, './CLAUDE.md');
  });

  test('config-get claude_md_path returns default value when not set', () => {
    // Create a config.json without claude_md_path
    const configPath = path.join(tmpDir, '.planning', 'config.json');
    fs.writeFileSync(configPath, JSON.stringify({ mode: 'interactive' }), 'utf-8');

    const result = runGsdTools('config-get claude_md_path --default ./CLAUDE.md', tmpDir, { HOME: tmpDir });
    assert.ok(result.success, `Expected success but got error: ${result.error}`);
    assert.strictEqual(JSON.parse(result.output), './CLAUDE.md');
  });

  test('config-set claude_md_path works', () => {
    const configPath = path.join(tmpDir, '.planning', 'config.json');
    fs.writeFileSync(configPath, JSON.stringify({ mode: 'interactive' }), 'utf-8');

    const setResult = runGsdTools('config-set claude_md_path .claude/CLAUDE.md', tmpDir, { HOME: tmpDir });
    assert.ok(setResult.success, `Expected success but got error: ${setResult.error}`);

    const getResult = runGsdTools('config-get claude_md_path', tmpDir, { HOME: tmpDir });
    assert.ok(getResult.success, `Expected success but got error: ${getResult.error}`);
    assert.strictEqual(JSON.parse(getResult.output), '.claude/CLAUDE.md');
  });

  test('buildNewProjectConfig includes claude_md_path default', () => {
    // Use config-new-project which calls buildNewProjectConfig
    const result = runGsdTools('config-new-project', tmpDir, { HOME: tmpDir });
    assert.ok(result.success, `Expected success but got error: ${result.error}`);

    const configPath = path.join(tmpDir, '.planning', 'config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    assert.strictEqual(config.claude_md_path, './CLAUDE.md');
  });
});

describe('cmdGenerateClaudeProfile reads claude_md_path from config', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('uses claude_md_path from config when no --output or --global', () => {
    // Set up config with custom claude_md_path
    const configPath = path.join(tmpDir, '.planning', 'config.json');
    const customPath = '.claude/CLAUDE.md';
    fs.writeFileSync(configPath, JSON.stringify({ claude_md_path: customPath }), 'utf-8');

    // Create the target directory
    fs.mkdirSync(path.join(tmpDir, '.claude'), { recursive: true });

    // Create a minimal analysis file
    const analysisPath = path.join(tmpDir, '.planning', 'analysis.json');
    const analysis = {
      dimensions: {
        communication_style: { rating: 'terse-direct', confidence: 'HIGH' },
      },
      data_source: 'test',
    };
    fs.writeFileSync(analysisPath, JSON.stringify(analysis), 'utf-8');

    const result = runGsdTools(
      ['generate-claude-profile', '--analysis', analysisPath],
      tmpDir,
      { HOME: tmpDir }
    );
    assert.ok(result.success, `Expected success but got error: ${result.error}`);

    const parsed = JSON.parse(result.output);
    const realTmpDir = fs.realpathSync(tmpDir);
    const expectedPath = path.join(realTmpDir, customPath);
    assert.strictEqual(parsed.claude_md_path, expectedPath);
    assert.ok(fs.existsSync(expectedPath), `Expected file at ${expectedPath}`);
  });

  test('--output flag overrides claude_md_path from config', () => {
    // Set up config with custom claude_md_path
    const configPath = path.join(tmpDir, '.planning', 'config.json');
    fs.writeFileSync(configPath, JSON.stringify({ claude_md_path: '.claude/CLAUDE.md' }), 'utf-8');

    // Create analysis file
    const analysisPath = path.join(tmpDir, '.planning', 'analysis.json');
    const analysis = {
      dimensions: {
        communication_style: { rating: 'terse-direct', confidence: 'HIGH' },
      },
      data_source: 'test',
    };
    fs.writeFileSync(analysisPath, JSON.stringify(analysis), 'utf-8');

    const outputFile = 'custom-output.md';
    const result = runGsdTools(
      ['generate-claude-profile', '--analysis', analysisPath, '--output', outputFile],
      tmpDir,
      { HOME: tmpDir }
    );
    assert.ok(result.success, `Expected success but got error: ${result.error}`);

    const parsed = JSON.parse(result.output);
    const realTmpDir = fs.realpathSync(tmpDir);
    assert.strictEqual(parsed.claude_md_path, path.join(realTmpDir, outputFile));
  });
});

describe('cmdGenerateClaudeMd reads claude_md_path from config', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    // Create minimal project files so generate-claude-md has something to read
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'PROJECT.md'),
      ['# Test Project', '', 'A test project.'].join('\n'),
      'utf-8'
    );
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('uses claude_md_path from config when no --output', () => {
    // Set up config with custom claude_md_path
    const configPath = path.join(tmpDir, '.planning', 'config.json');
    const customPath = '.claude/CLAUDE.md';
    fs.writeFileSync(configPath, JSON.stringify({ claude_md_path: customPath }), 'utf-8');

    // Create the target directory
    fs.mkdirSync(path.join(tmpDir, '.claude'), { recursive: true });

    const result = runGsdTools('generate-claude-md', tmpDir, { HOME: tmpDir });
    assert.ok(result.success, `Expected success but got error: ${result.error}`);

    const parsed = JSON.parse(result.output);
    const realTmpDir = fs.realpathSync(tmpDir);
    const expectedPath = path.join(realTmpDir, customPath);
    assert.strictEqual(parsed.claude_md_path, expectedPath);
    assert.ok(fs.existsSync(expectedPath), `Expected file at ${expectedPath}`);
  });

  test('--output flag overrides claude_md_path from config', () => {
    // Set up config with custom claude_md_path
    const configPath = path.join(tmpDir, '.planning', 'config.json');
    fs.writeFileSync(configPath, JSON.stringify({ claude_md_path: '.claude/CLAUDE.md' }), 'utf-8');

    const outputFile = 'my-custom.md';
    const result = runGsdTools(['generate-claude-md', '--output', outputFile], tmpDir, { HOME: tmpDir });
    assert.ok(result.success, `Expected success but got error: ${result.error}`);

    const parsed = JSON.parse(result.output);
    const realTmpDir = fs.realpathSync(tmpDir);
    assert.strictEqual(parsed.claude_md_path, path.join(realTmpDir, outputFile));
  });

  test('defaults to ./CLAUDE.md when config has no claude_md_path', () => {
    // Set up config without claude_md_path
    const configPath = path.join(tmpDir, '.planning', 'config.json');
    fs.writeFileSync(configPath, JSON.stringify({ mode: 'interactive' }), 'utf-8');

    const result = runGsdTools('generate-claude-md', tmpDir, { HOME: tmpDir });
    assert.ok(result.success, `Expected success but got error: ${result.error}`);

    const parsed = JSON.parse(result.output);
    const realTmpDir = fs.realpathSync(tmpDir);
    assert.strictEqual(parsed.claude_md_path, path.join(realTmpDir, 'CLAUDE.md'));
  });
});
