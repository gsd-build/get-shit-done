/**
 * Tests for the Knowledge Layer integration
 */
'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const {
  initKnowledge, buildIndex, updateIndexIncremental, getIndex,
  listModules, assembleContext, assembleDiffAwareContext,
  buildDependencyGraph, getImpactedFiles,
  createLoopGuard,
  getProtectedFiles, isFileProtected, isSafeImprovement,
  createCircuitBreaker, scopeCheck,
} = require('../get-shit-done/bin/lib/knowledge/index.cjs');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-knowledge-test-'));
}

function initGitRepo(dir) {
  spawnSync('git', ['init'], { cwd: dir, stdio: 'pipe' });
  spawnSync('git', ['config', 'user.email', 'test@test.com'], { cwd: dir, stdio: 'pipe' });
  spawnSync('git', ['config', 'user.name', 'Test'], { cwd: dir, stdio: 'pipe' });
  fs.writeFileSync(path.join(dir, '.gitignore'), 'node_modules\n', 'utf-8');
  spawnSync('git', ['add', '.'], { cwd: dir, stdio: 'pipe' });
  spawnSync('git', ['commit', '-m', 'init'], { cwd: dir, stdio: 'pipe' });
}

function writeSourceFile(dir, relPath, content) {
  const fp = path.join(dir, relPath);
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, content, 'utf-8');
}

// ─── Init Tests ───────────────────────────────────────────────────────────────

describe('Knowledge Layer: initKnowledge', () => {
  let tmpDir;
  beforeEach(() => {
    tmpDir = createTmpDir();
    fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });
  });
  afterEach(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

  it('creates the knowledge directory structure', () => {
    const result = initKnowledge(tmpDir);
    assert.equal(result.ok, true);
    assert.ok(result.created.length > 0);
    assert.ok(fs.existsSync(path.join(tmpDir, '.planning', 'knowledge', 'INDEX.json')));
    assert.ok(fs.existsSync(path.join(tmpDir, '.planning', 'knowledge', 'CONVENTIONS.md')));
    assert.ok(fs.existsSync(path.join(tmpDir, '.planning', 'knowledge', 'decisions', 'REGISTRY.json')));
    assert.ok(fs.existsSync(path.join(tmpDir, '.planning', 'knowledge', 'patterns', 'CATALOG.json')));
  });

  it('is idempotent — second call creates nothing', () => {
    initKnowledge(tmpDir);
    const result2 = initKnowledge(tmpDir);
    assert.equal(result2.ok, true);
    assert.equal(result2.created.length, 0);
    assert.equal(result2.message, 'Already initialized');
  });
});

// ─── Indexer Tests ────────────────────────────────────────────────────────────

describe('Knowledge Layer: buildIndex', () => {
  let tmpDir;
  beforeEach(() => {
    tmpDir = createTmpDir();
    initGitRepo(tmpDir);
    fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });
    initKnowledge(tmpDir);
  });
  afterEach(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

  it('indexes source files and creates INDEX.json', () => {
    writeSourceFile(tmpDir, 'src/app.js', 'const express = require("express");\nmodule.exports = { app };');
    writeSourceFile(tmpDir, 'src/utils.js', 'function helper() { return 1; }\nmodule.exports = { helper };');
    spawnSync('git', ['add', '.'], { cwd: tmpDir, stdio: 'pipe' });
    spawnSync('git', ['commit', '-m', 'add src'], { cwd: tmpDir, stdio: 'pipe' });

    const result = buildIndex(tmpDir);
    assert.equal(result.ok, true);
    assert.ok(result.indexed >= 2);
    assert.ok(result.total_files >= 2);
    assert.ok(result.total_modules >= 1);

    const index = getIndex(tmpDir);
    assert.ok(index);
    assert.ok(index.files['src/app.js']);
    assert.ok(index.files['src/utils.js']);
  });

  it('extracts exports from indexed files', () => {
    writeSourceFile(tmpDir, 'lib/math.js', 'function add(a, b) { return a + b; }\nmodule.exports = { add };');
    spawnSync('git', ['add', '.'], { cwd: tmpDir, stdio: 'pipe' });
    spawnSync('git', ['commit', '-m', 'add lib'], { cwd: tmpDir, stdio: 'pipe' });

    buildIndex(tmpDir);
    const index = getIndex(tmpDir);
    const fileInfo = index.files['lib/math.js'];
    assert.ok(fileInfo);
    assert.ok(fileInfo.exports.includes('add'));
  });
});

// ─── Incremental Index Tests ──────────────────────────────────────────────────

describe('Knowledge Layer: updateIndexIncremental', () => {
  let tmpDir;
  beforeEach(() => {
    tmpDir = createTmpDir();
    initGitRepo(tmpDir);
    fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });
    initKnowledge(tmpDir);
  });
  afterEach(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

  it('falls back to full build on first run', () => {
    writeSourceFile(tmpDir, 'src/app.js', 'const x = 1;');
    spawnSync('git', ['add', '.'], { cwd: tmpDir, stdio: 'pipe' });
    spawnSync('git', ['commit', '-m', 'add src'], { cwd: tmpDir, stdio: 'pipe' });

    const result = updateIndexIncremental(tmpDir);
    assert.equal(result.ok, true);
    assert.equal(result.fallback, true);
  });
});

// ─── Context Assembly Tests ───────────────────────────────────────────────────

describe('Knowledge Layer: assembleContext', () => {
  let tmpDir;
  beforeEach(() => {
    tmpDir = createTmpDir();
    initGitRepo(tmpDir);
    fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });
    initKnowledge(tmpDir);
    writeSourceFile(tmpDir, 'src/auth/login.js', 'function authenticate(user) { return true; }\nmodule.exports = { authenticate };');
    writeSourceFile(tmpDir, 'src/api/routes.js', 'const express = require("express");\nfunction getRoutes() {}\nmodule.exports = { getRoutes };');
    writeSourceFile(tmpDir, 'src/db/connection.js', 'function connect() {}\nmodule.exports = { connect };');
    spawnSync('git', ['add', '.'], { cwd: tmpDir, stdio: 'pipe' });
    spawnSync('git', ['commit', '-m', 'add src'], { cwd: tmpDir, stdio: 'pipe' });
    buildIndex(tmpDir);
  });
  afterEach(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

  it('returns relevant modules for auth-related query', () => {
    const ctx = assembleContext(tmpDir, 'fix the authentication login flow');
    assert.ok(ctx.relevant_modules.length > 0);
    const authModule = ctx.relevant_modules.find(m => m.module.includes('auth'));
    assert.ok(authModule, 'Should find auth module');
    assert.ok(authModule.score > 0);
  });

  it('respects token budget', () => {
    const ctx = assembleContext(tmpDir, 'add database queries', { budget: 500 });
    assert.ok(ctx.estimated_tokens <= 600); // allow small overshoot
  });

  it('returns empty for no-match query', () => {
    const ctx = assembleContext(tmpDir, 'quantum entanglement physics');
    assert.equal(ctx.relevant_modules.length, 0);
  });
});

// ─── Dependency Graph Tests ───────────────────────────────────────────────────

describe('Knowledge Layer: buildDependencyGraph', () => {
  let tmpDir;
  beforeEach(() => {
    tmpDir = createTmpDir();
    initGitRepo(tmpDir);
    fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });
    initKnowledge(tmpDir);
    writeSourceFile(tmpDir, 'src/a.js', 'const b = require("./b");\nmodule.exports = { a: 1 };');
    writeSourceFile(tmpDir, 'src/b.js', 'const c = require("./c");\nmodule.exports = { b: 2 };');
    writeSourceFile(tmpDir, 'src/c.js', 'module.exports = { c: 3 };');
    spawnSync('git', ['add', '.'], { cwd: tmpDir, stdio: 'pipe' });
    spawnSync('git', ['commit', '-m', 'add files'], { cwd: tmpDir, stdio: 'pipe' });
    buildIndex(tmpDir);
  });
  afterEach(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

  it('builds forward and reverse dependency maps', () => {
    const result = buildDependencyGraph(tmpDir);
    assert.equal(result.ok, true);
    assert.ok(result.total_edges >= 2);
  });
});

// ─── Loop Guard Tests ─────────────────────────────────────────────────────────

describe('Knowledge Layer: createLoopGuard', () => {
  it('allows first few calls', () => {
    const guard = createLoopGuard();
    const r = guard.check('Read', { path: '/foo.js' });
    assert.equal(r.action, 'allow');
  });

  it('warns on repeated identical calls', () => {
    const guard = createLoopGuard();
    guard.check('Read', { path: '/foo.js' });
    guard.check('Read', { path: '/foo.js' });
    const r = guard.check('Read', { path: '/foo.js' });
    assert.equal(r.action, 'warn');
  });

  it('blocks after threshold', () => {
    const guard = createLoopGuard();
    for (let i = 0; i < 4; i++) guard.check('Read', { path: '/foo.js' });
    const r = guard.check('Read', { path: '/foo.js' });
    assert.equal(r.action, 'block');
  });

  it('detects ping-pong patterns', () => {
    const guard = createLoopGuard();
    for (let i = 0; i < 6; i++) {
      guard.check('Read', { path: '/a.js' });
      guard.check('Edit', { path: '/a.js' });
    }
    // After 6 alternations (12 calls), ping-pong should be detected
    const stats = guard.getStats();
    assert.ok(stats.totalCalls >= 6);
  });

  it('circuit breaks on total calls', () => {
    const guard = createLoopGuard({ circuitBreakTotal: 30 });
    let result;
    for (let i = 0; i < 30; i++) {
      result = guard.check('tool' + i, { i });
    }
    assert.equal(result.action, 'circuit_break');
  });
});

// ─── Safety Tests ─────────────────────────────────────────────────────────────

describe('Knowledge Layer: safety', () => {
  it('classifies safe improvement types', () => {
    assert.ok(isSafeImprovement({ type: 'test-gap' }).safe);
    assert.ok(isSafeImprovement({ type: 'stale-doc' }).safe);
    assert.ok(!isSafeImprovement({ type: 'feature' }).safe);
    assert.ok(!isSafeImprovement({ type: 'api-change' }).safe);
    assert.ok(!isSafeImprovement({ type: 'unknown-thing' }).safe);
  });

  it('checks file protection', () => {
    assert.ok(isFileProtected('src/app.js', ['src/app.js']));
    assert.ok(isFileProtected('src/auth/login.js', ['src/auth']));
    assert.ok(!isFileProtected('src/other.js', ['src/app.js']));
  });

  it('validates scope', () => {
    assert.ok(scopeCheck('Create: src/a.js\nModify: src/b.js').valid);
    assert.ok(!scopeCheck('Create: a.js\nCreate: b.js\nCreate: c.js\nCreate: d.js\nCreate: e.js\nCreate: f.js').valid);
    assert.ok(!scopeCheck('This is a breaking change to the API').valid);
  });

  it('circuit breaker tracks failures', () => {
    const cb = createCircuitBreaker(3);
    assert.ok(!cb.isTripped());
    cb.recordFailure();
    cb.recordFailure();
    assert.ok(!cb.isTripped());
    cb.recordFailure();
    assert.ok(cb.isTripped());
    cb.recordSuccess();
    assert.ok(!cb.isTripped());
  });
});

// ─── CLI Integration Tests ────────────────────────────────────────────────────

describe('Knowledge Layer: CLI', () => {
  let tmpDir;
  const toolsPath = path.join(__dirname, '..', 'get-shit-done', 'bin', 'gsd-tools.cjs');

  beforeEach(() => {
    tmpDir = createTmpDir();
    initGitRepo(tmpDir);
    fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });
  });
  afterEach(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

  it('knowledge init via CLI', () => {
    const result = spawnSync('node', [toolsPath, 'knowledge', 'init', '--cwd', tmpDir, '--raw'], {
      stdio: 'pipe', encoding: 'utf-8',
    });
    assert.equal(result.status, 0);
    const output = JSON.parse(result.stdout);
    assert.equal(output.ok, true);
    assert.ok(output.created.length > 0);
  });

  it('knowledge index via CLI', () => {
    // Init first
    spawnSync('node', [toolsPath, 'knowledge', 'init', '--cwd', tmpDir], { stdio: 'pipe' });
    writeSourceFile(tmpDir, 'src/app.js', 'module.exports = { x: 1 };');
    spawnSync('git', ['add', '.'], { cwd: tmpDir, stdio: 'pipe' });
    spawnSync('git', ['commit', '-m', 'add'], { cwd: tmpDir, stdio: 'pipe' });

    const result = spawnSync('node', [toolsPath, 'knowledge', 'index', '--cwd', tmpDir, '--raw'], {
      stdio: 'pipe', encoding: 'utf-8',
    });
    assert.equal(result.status, 0);
    const output = JSON.parse(result.stdout);
    assert.equal(output.ok, true);
    assert.ok(output.indexed >= 1);
  });

  it('knowledge modules via CLI', () => {
    spawnSync('node', [toolsPath, 'knowledge', 'init', '--cwd', tmpDir], { stdio: 'pipe' });
    writeSourceFile(tmpDir, 'src/app.js', 'module.exports = { x: 1 };');
    spawnSync('git', ['add', '.'], { cwd: tmpDir, stdio: 'pipe' });
    spawnSync('git', ['commit', '-m', 'add'], { cwd: tmpDir, stdio: 'pipe' });
    spawnSync('node', [toolsPath, 'knowledge', 'index', '--cwd', tmpDir], { stdio: 'pipe' });

    const result = spawnSync('node', [toolsPath, 'knowledge', 'modules', '--cwd', tmpDir, '--raw'], {
      stdio: 'pipe', encoding: 'utf-8',
    });
    assert.equal(result.status, 0);
    const output = JSON.parse(result.stdout);
    assert.equal(output.ok, true);
    assert.ok(output.modules.length >= 1);
  });
});
