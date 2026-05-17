'use strict';
/**
 * CJS parity test — project-root module
 *
 * For every fixture from sdk/src/project-root/index.test.ts, asserts that
 * both the SDK (ESM, via dynamic import) and the generated CJS artifact
 * return identical paths. This confirms that the generator correctly
 * captures the function body and that all dependencies (sep, dirname,
 * relative, etc.) are properly shimmed in the CJS preamble.
 */

const { describe, it, before, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// CJS artifact — synchronous require
const { findProjectRoot: findProjectRootCjs } = require('../get-shit-done/bin/lib/project-root.generated.cjs');

// SDK ESM — loaded once before all tests via dynamic import
let findProjectRootSdk;
before(async () => {
  const mod = await import('../sdk/dist/project-root/index.js');
  findProjectRootSdk = mod.findProjectRoot;
});

// ── Fixture helpers ─────────────────────────────────────────────────────────

const { createTempDir } = require('./helpers.cjs');
const makeTmp = () => createTempDir('gsd-parity-');

function writeConfig(dir, content) {
  fs.mkdirSync(path.join(dir, '.planning'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.planning', 'config.json'), JSON.stringify(content));
}

function assertParity(startDir) {
  const sdkResult = findProjectRootSdk(startDir);
  const cjsResult = findProjectRootCjs(startDir);
  assert.strictEqual(
    cjsResult,
    sdkResult,
    `parity failure for startDir="${startDir}": SDK="${sdkResult}" CJS="${cjsResult}"`,
  );
  return sdkResult;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('project-root CJS/SDK parity', () => {
  let workspace;

  before(() => {
    workspace = makeTmp();
  });

  afterEach(() => {
    // Clean the workspace tree and recreate fresh for next test
    try { fs.rmSync(workspace, { recursive: true, force: true }); } catch {}
    workspace = makeTmp();
  });

  it('heuristic 0: startDir has own .planning/ — returns startDir', () => {
    fs.mkdirSync(path.join(workspace, '.planning'), { recursive: true });
    assertParity(workspace);
  });

  it('no ancestor .planning/ — returns startDir', () => {
    assertParity(workspace);
  });

  it('heuristic 1: parent .planning/config.json lists child in sub_repos', () => {
    writeConfig(workspace, { sub_repos: ['child'] });
    const child = path.join(workspace, 'child');
    fs.mkdirSync(path.join(child, '.git'), { recursive: true });
    const result = assertParity(child);
    assert.strictEqual(result, workspace);
  });

  it('heuristic 1 nested: deeply nested dir inside sub_repo', () => {
    writeConfig(workspace, { sub_repos: ['child'] });
    const nested = path.join(workspace, 'child', 'src', 'utils');
    fs.mkdirSync(path.join(workspace, 'child', '.git'), { recursive: true });
    fs.mkdirSync(nested, { recursive: true });
    const result = assertParity(nested);
    assert.strictEqual(result, workspace);
  });

  it('heuristic 1 nested key: planning.sub_repos config shape', () => {
    writeConfig(workspace, { planning: { sub_repos: ['child'] } });
    const child = path.join(workspace, 'child');
    fs.mkdirSync(path.join(child, '.git'), { recursive: true });
    const result = assertParity(child);
    assert.strictEqual(result, workspace);
  });

  it('heuristic 2: multiRepo: true with .git in ancestor chain', () => {
    writeConfig(workspace, { multiRepo: true });
    const child = path.join(workspace, 'child');
    fs.mkdirSync(path.join(child, '.git'), { recursive: true });
    const result = assertParity(child);
    assert.strictEqual(result, workspace);
  });

  it('heuristic 3: parent has .planning/ and child has .git, no config', () => {
    fs.mkdirSync(path.join(workspace, '.planning'), { recursive: true });
    const child = path.join(workspace, 'child');
    fs.mkdirSync(path.join(child, '.git'), { recursive: true });
    const result = assertParity(child);
    assert.strictEqual(result, workspace);
  });

  it('malformed config.json falls back to heuristic 3', () => {
    fs.mkdirSync(path.join(workspace, '.planning'), { recursive: true });
    fs.writeFileSync(path.join(workspace, '.planning', 'config.json'), '{ not json');
    const child = path.join(workspace, 'child');
    fs.mkdirSync(path.join(child, '.git'), { recursive: true });
    const result = assertParity(child);
    assert.strictEqual(result, workspace);
  });

  it('empty sub_repos with no .git — returns startDir', () => {
    writeConfig(workspace, { sub_repos: [] });
    const child = path.join(workspace, 'child');
    fs.mkdirSync(child, { recursive: true });
    const result = assertParity(child);
    assert.strictEqual(result, child);
  });

  it('#1362: child has own .planning/ — returns child not workspace', () => {
    writeConfig(workspace, { sub_repos: ['child'] });
    const child = path.join(workspace, 'child');
    fs.mkdirSync(path.join(child, '.planning'), { recursive: true });
    const result = assertParity(child);
    assert.strictEqual(result, child);
  });

  it('depth limit: .planning/ is 12 levels up — returns startDir (depth=10 cap)', () => {
    // CANONICALIZATION NOTE: SDK has FIND_PROJECT_ROOT_MAX_DEPTH=10; CJS now
    // also uses 10 (was unbounded before). At 12 levels the walk stops before
    // reaching workspace, so startDir is returned.
    fs.mkdirSync(path.join(workspace, '.planning'), { recursive: true });
    let dir = workspace;
    for (let i = 1; i <= 12; i++) {
      dir = path.join(dir, `l${i}`);
    }
    fs.mkdirSync(dir, { recursive: true });
    const result = assertParity(dir);
    assert.strictEqual(result, dir);
  });
});
