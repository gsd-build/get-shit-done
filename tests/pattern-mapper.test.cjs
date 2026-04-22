/**
 * Tests for Pattern Mapper feature (#1861, #2312)
 *
 * Covers:
 * - Config key workflow.pattern_mapper in VALID_CONFIG_KEYS
 * - Default value is true
 * - Config round-trip (set/get)
 * - init plan-phase output includes patterns_path (null when missing, path when present)
 * - Agent prompt contains no-re-read and early-stop constraints (#2312)
 */

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

describe('pattern-mapper config key', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('workflow.pattern_mapper is a valid config key', () => {
    // Setting an invalid key produces an error; a valid key succeeds
    const result = runGsdTools('config-set workflow.pattern_mapper true', tmpDir, { HOME: tmpDir });
    assert.ok(result.success, `Expected success but got error: ${result.error}`);
  });

  test('default value is true in CONFIG_DEFAULTS', () => {
    // Create a new project config and verify the default
    const result = runGsdTools('config-new-project', tmpDir, { HOME: tmpDir });
    assert.ok(result.success, `config-new-project failed: ${result.error}`);

    const configPath = path.join(tmpDir, '.planning', 'config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    assert.strictEqual(config.workflow.pattern_mapper, true);
  });

  test('config round-trip set/get', () => {
    // Ensure config exists first
    runGsdTools('config-new-project', tmpDir, { HOME: tmpDir });

    // Set to false
    const setResult = runGsdTools('config-set workflow.pattern_mapper false', tmpDir, { HOME: tmpDir });
    assert.ok(setResult.success, `config-set failed: ${setResult.error}`);

    // Get should return false
    const getResult = runGsdTools('config-get workflow.pattern_mapper', tmpDir, { HOME: tmpDir });
    assert.ok(getResult.success, `config-get failed: ${getResult.error}`);
    assert.strictEqual(getResult.output, 'false');
  });
});

describe('init plan-phase patterns_path', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    // Create minimal planning structure for init plan-phase
    const planningDir = path.join(tmpDir, '.planning');
    fs.writeFileSync(path.join(planningDir, 'STATE.md'), [
      '# State',
      '',
      '## Current Phase',
      'Phase 1 — Foundation',
    ].join('\n'));
    fs.writeFileSync(path.join(planningDir, 'ROADMAP.md'), [
      '# Roadmap',
      '',
      '## Phase 1: Foundation',
      'Build the foundation.',
      '**Status:** Planning',
      '**Requirements:** [FOUND-01]',
    ].join('\n'));

    // Create phase directory
    const phaseDir = path.join(planningDir, 'phases', '01-foundation');
    fs.mkdirSync(phaseDir, { recursive: true });
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('patterns_path is null when no PATTERNS.md exists', () => {
    const result = runGsdTools('init plan-phase 1', tmpDir, { HOME: tmpDir });
    assert.ok(result.success, `init plan-phase failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.strictEqual(data.patterns_path, null);
  });

  test('patterns_path contains correct path when PATTERNS.md exists', () => {
    // Create a PATTERNS.md in the phase directory
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    fs.writeFileSync(path.join(phaseDir, '01-PATTERNS.md'), '# Patterns\n');

    const result = runGsdTools('init plan-phase 1', tmpDir, { HOME: tmpDir });
    assert.ok(result.success, `init plan-phase failed: ${result.error}`);

    const data = JSON.parse(result.output);
    assert.ok(data.patterns_path, 'patterns_path should not be null');
    assert.ok(data.patterns_path.includes('PATTERNS.md'), `Expected path to contain PATTERNS.md, got: ${data.patterns_path}`);
    assert.ok(data.patterns_path.includes('01-foundation'), `Expected path to include phase dir, got: ${data.patterns_path}`);
  });
});

describe('gsd-pattern-mapper agent prompt efficiency constraints (#2312)', () => {
  const agentPath = path.join(__dirname, '..', 'agents', 'gsd-pattern-mapper.md');
  let agentContent;

  beforeEach(() => {
    agentContent = fs.readFileSync(agentPath, 'utf-8');
  });

  test('READS-01: prompt contains no-re-read constraint', () => {
    assert.ok(
      /read each.*file.*once/i.test(agentContent) || /never re-read/i.test(agentContent),
      'Agent prompt must instruct the model to read each analog file only once'
    );
  });

  test('READS-02: prompt contains early-stop instruction', () => {
    assert.ok(
      /stop.*analog|3.?5.*analog|early.stop/i.test(agentContent),
      'Agent prompt must instruct the model to stop after finding 3-5 analogs'
    );
  });

  test('READS-03: prompt contains large-file strategy', () => {
    assert.ok(
      /2[,.]?000.*line|offset.*limit|large file/i.test(agentContent),
      'Agent prompt must include guidance for reading large files with offset/limit'
    );
  });
});
