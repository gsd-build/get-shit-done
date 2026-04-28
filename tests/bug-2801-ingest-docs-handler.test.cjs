/**
 * Regression test for bug #2801
 *
 * `/gsd-ingest-docs` was broken because:
 * 1. `workflows/ingest-docs.md` called `gsd-sdk query init.ingest-docs` but the
 *    installed binary is `gsd-tools` (not `gsd-sdk`).
 * 2. `gsd-tools init` had no `ingest-docs` case in its dispatch switch.
 *
 * The fix:
 * - Added `case 'ingest-docs'` to the `init` switch in `gsd-tools.cjs`.
 * - Exported `cmdInitIngestDocs` from `init.cjs`.
 * - Updated `workflows/ingest-docs.md` to call `gsd-tools init ingest-docs`.
 *
 * This test prevents regression of the dispatch omission.
 */

'use strict';

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const childProc = require('node:child_process');
const { createTempProject, cleanup, TOOLS_PATH } = require('./helpers.cjs');

const REPO_ROOT = path.join(__dirname, '..');
const WORKFLOW_FILE = path.join(REPO_ROOT, 'get-shit-done', 'workflows', 'ingest-docs.md');

function spawnGsdTools(args, projectDir) {
  let stdout = '';
  let exitCode = 0;
  try {
    stdout = childProc.execFileSync(
      process.execPath,
      [TOOLS_PATH, ...args, '--cwd', projectDir],
      {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, GSD_SESSION_KEY: '' },
      }
    );
  } catch (err) {
    exitCode = err.status ?? 1;
    stdout = (err.stdout?.toString() ?? '') + (err.stderr?.toString() ?? '');
  }
  return { exitCode, stdout };
}

describe('bug-2801: gsd-tools init ingest-docs handler exists', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject('gsd-test-2801-');
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('init ingest-docs exits 0 (not "Unknown init workflow")', () => {
    const { exitCode, stdout } = spawnGsdTools(['init', 'ingest-docs', '--raw'], tmpDir);
    assert.strictEqual(exitCode, 0, `expected exit 0, got: ${stdout}`);
  });

  test('init ingest-docs returns JSON with project_exists field', () => {
    const { exitCode, stdout } = spawnGsdTools(['init', 'ingest-docs', '--raw'], tmpDir);
    assert.strictEqual(exitCode, 0);
    let json;
    try { json = JSON.parse(stdout.trim()); } catch { assert.fail(`non-JSON output: ${stdout}`); }
    assert.ok(Object.prototype.hasOwnProperty.call(json, 'project_exists'), 'project_exists present');
  });

  test('init ingest-docs returns JSON with planning_exists field', () => {
    const { exitCode, stdout } = spawnGsdTools(['init', 'ingest-docs', '--raw'], tmpDir);
    assert.strictEqual(exitCode, 0);
    const json = JSON.parse(stdout.trim());
    assert.ok(Object.prototype.hasOwnProperty.call(json, 'planning_exists'), 'planning_exists present');
  });

  test('init ingest-docs returns JSON with has_git field', () => {
    const { exitCode, stdout } = spawnGsdTools(['init', 'ingest-docs', '--raw'], tmpDir);
    assert.strictEqual(exitCode, 0);
    const json = JSON.parse(stdout.trim());
    assert.ok(Object.prototype.hasOwnProperty.call(json, 'has_git'), 'has_git present');
  });

  test('init ingest-docs returns JSON with project_path field', () => {
    const { exitCode, stdout } = spawnGsdTools(['init', 'ingest-docs', '--raw'], tmpDir);
    assert.strictEqual(exitCode, 0);
    const json = JSON.parse(stdout.trim());
    assert.ok(Object.prototype.hasOwnProperty.call(json, 'project_path'), 'project_path present');
    assert.ok(Object.prototype.hasOwnProperty.call(json, 'commit_docs'), 'commit_docs present');
  });

  test('planning_exists is true when .planning/ directory exists', () => {
    const { exitCode, stdout } = spawnGsdTools(['init', 'ingest-docs', '--raw'], tmpDir);
    assert.strictEqual(exitCode, 0);
    const json = JSON.parse(stdout.trim());
    assert.strictEqual(json.planning_exists, true, 'planning_exists should be true (.planning/ created by createTempProject)');
  });
});

describe('bug-2801: ingest-docs.md workflow calls gsd-tools not gsd-sdk', () => {
  test('no bash code block in ingest-docs.md calls gsd-sdk', () => {
    const content = fs.readFileSync(WORKFLOW_FILE, 'utf-8');
    // Extract bash fenced code blocks structurally.
    const bashBlocks = [];
    const codeBlockRe = /```bash\n([\s\S]*?)```/g;
    let m;
    while ((m = codeBlockRe.exec(content)) !== null) {
      bashBlocks.push(m[1]);
    }
    assert.ok(bashBlocks.length > 0, 'expected bash code blocks in workflow');

    // Check every line in every bash block — not just lines that start with the token,
    // since gsd-sdk can appear in subshell expansions like $(gsd-sdk query ...).
    const sdkCalls = bashBlocks
      .join('\n')
      .split('\n')
      .filter((line) => /\bgsd-sdk\b/.test(line));

    assert.deepStrictEqual(
      sdkCalls,
      [],
      `workflow bash blocks still reference gsd-sdk (should use gsd-tools): ${sdkCalls.join(', ')}`
    );
  });

  test('ingest-docs.md init step uses gsd-tools init ingest-docs', () => {
    const content = fs.readFileSync(WORKFLOW_FILE, 'utf-8');
    const lines = content.split('\n');
    const initLine = lines.find(l => /gsd-tools\s+init\s+ingest-docs/.test(l));
    assert.ok(initLine, 'workflow must contain "gsd-tools init ingest-docs"');
  });

  test('cmdInitIngestDocs is exported from init.cjs', () => {
    const init = require(path.join(REPO_ROOT, 'get-shit-done', 'bin', 'lib', 'init.cjs'));
    assert.strictEqual(typeof init.cmdInitIngestDocs, 'function', 'cmdInitIngestDocs must be exported');
  });
});
