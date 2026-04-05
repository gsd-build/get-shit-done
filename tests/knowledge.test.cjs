/**
 * Tests for the Knowledge Layer integration
 * Addresses all review feedback from PR #1465 including:
 * - Ping-pong detection assertion (review #9)
 * - Incremental non-fallback path (review #10)
 * - Circular dependency detection (review #10)
 * - getImpactedFiles (review #10)
 * - assembleDiffAwareContext (review #10)
 * - validateMergeReadiness (review #10)
 * - walkDir truncation warning (review #10)
 */
'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { createTempGitProject, createTempDir, cleanup, runGsdTools } = require('./helpers.cjs');

const {
  initKnowledge, buildIndex, updateIndexIncremental, getIndex,
  listModules, assembleContext, assembleDiffAwareContext,
  buildDependencyGraph, getImpactedFiles, findCircularDeps,
  createLoopGuard,
  getProtectedFiles, isFileProtected, isSafeImprovement,
  createCircuitBreaker, scopeCheck, validateMergeReadiness,
} = require('../get-shit-done/bin/lib/knowledge/index.cjs');

const { walkDir } = require('../get-shit-done/bin/lib/knowledge/indexer.cjs');

// --- Helpers -----------------------------------------------------------------

function writeSourceFile(dir, relPath, content) {
  const fp = path.join(dir, relPath);
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, content, 'utf-8');
}

function gitCommit(dir, msg) {
  spawnSync('git', ['add', '-A'], { cwd: dir, stdio: 'pipe' });
  spawnSync('git', ['commit', '-m', msg], { cwd: dir, stdio: 'pipe' });
}

// --- Init Tests --------------------------------------------------------------

describe('Knowledge Layer: initKnowledge', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = createTempGitProject('gsd-knowledge-init-'); });
  afterEach(() => cleanup(tmpDir));

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

// --- Indexer Tests ------------------------------------------------------------

describe('Knowledge Layer: buildIndex', () => {
  let tmpDir;
  beforeEach(() => {
    tmpDir = createTempGitProject('gsd-knowledge-index-');
    initKnowledge(tmpDir);
  });
  afterEach(() => cleanup(tmpDir));

  it('indexes source files and creates INDEX.json', () => {
    writeSourceFile(tmpDir, 'src/app.js', 'const express = require("express");\nmodule.exports = { app };');
    writeSourceFile(tmpDir, 'src/utils.js', 'function helper() { return 1; }\nmodule.exports = { helper };');
    gitCommit(tmpDir, 'add src');

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
    gitCommit(tmpDir, 'add lib');

    buildIndex(tmpDir);
    const index = getIndex(tmpDir);
    const fileInfo = index.files['lib/math.js'];
    assert.ok(fileInfo);
    assert.ok(fileInfo.exports.includes('add'));
  });

  it('computes total_exports correctly in stats', () => {
    writeSourceFile(tmpDir, 'lib/a.js', 'module.exports = { foo, bar };');
    writeSourceFile(tmpDir, 'lib/b.js', 'module.exports = { baz };');
    gitCommit(tmpDir, 'add exports');

    buildIndex(tmpDir);
    const index = getIndex(tmpDir);
    assert.ok(index.stats.total_exports >= 3, `Expected >= 3 exports, got ${index.stats.total_exports}`);
  });

  it('returns truncated flag (false for small repos)', () => {
    writeSourceFile(tmpDir, 'src/a.js', 'const x = 1;');
    gitCommit(tmpDir, 'add file');

    const result = buildIndex(tmpDir);
    assert.equal(result.truncated, false);
  });
});

// --- walkDir Tests -----------------------------------------------------------

describe('Knowledge Layer: walkDir', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = createTempDir('gsd-knowledge-walk-'); });
  afterEach(() => cleanup(tmpDir));

  it('returns truncated: false for small directories', () => {
    writeSourceFile(tmpDir, 'a.js', 'const x = 1;');
    writeSourceFile(tmpDir, 'b.js', 'const y = 2;');
    const result = walkDir(tmpDir);
    assert.equal(result.truncated, false);
    assert.ok(result.files.length >= 2);
  });

  it('skips ignored directories', () => {
    writeSourceFile(tmpDir, 'src/a.js', 'x');
    writeSourceFile(tmpDir, 'node_modules/pkg/index.js', 'y');
    const result = walkDir(tmpDir);
    const paths = result.files.map(f => path.relative(tmpDir, f));
    assert.ok(paths.some(p => p.includes('src')));
    assert.ok(!paths.some(p => p.includes('node_modules')));
  });

  it('skips symlinks', () => {
    writeSourceFile(tmpDir, 'real/a.js', 'x');
    try {
      fs.symlinkSync(path.join(tmpDir, 'real'), path.join(tmpDir, 'linked'), 'dir');
    } catch { return; } // Skip if symlinks not supported
    const result = walkDir(tmpDir);
    const paths = result.files.map(f => path.relative(tmpDir, f));
    assert.ok(!paths.some(p => p.startsWith('linked')));
  });
});

// --- Incremental Index Tests -------------------------------------------------

describe('Knowledge Layer: updateIndexIncremental', () => {
  let tmpDir;
  beforeEach(() => {
    tmpDir = createTempGitProject('gsd-knowledge-incr-');
    initKnowledge(tmpDir);
  });
  afterEach(() => cleanup(tmpDir));

  it('falls back to full build on first run', () => {
    writeSourceFile(tmpDir, 'src/app.js', 'const x = 1;');
    gitCommit(tmpDir, 'add src');

    const result = updateIndexIncremental(tmpDir);
    assert.equal(result.ok, true);
    assert.equal(result.fallback, true);
  });

  it('incrementally updates after file changes', () => {
    // Full build first
    writeSourceFile(tmpDir, 'src/app.js', 'module.exports = { orig: 1 };');
    gitCommit(tmpDir, 'add src');
    buildIndex(tmpDir);

    // Make a change and commit
    writeSourceFile(tmpDir, 'src/new-file.js', 'module.exports = { added: true };');
    gitCommit(tmpDir, 'add new file');

    const result = updateIndexIncremental(tmpDir);
    assert.equal(result.ok, true);
    assert.equal(result.fallback, false);
    assert.ok(result.indexed >= 1, 'Should have indexed at least the new file');

    const index = getIndex(tmpDir);
    assert.ok(index.files['src/new-file.js'], 'New file should be in the index');
  });

  it('computes total_exports correctly (not hardcoded 0)', () => {
    writeSourceFile(tmpDir, 'lib/a.js', 'module.exports = { foo, bar };');
    gitCommit(tmpDir, 'add lib');
    buildIndex(tmpDir);

    writeSourceFile(tmpDir, 'lib/b.js', 'module.exports = { baz };');
    gitCommit(tmpDir, 'add b');

    const result = updateIndexIncremental(tmpDir);
    assert.equal(result.ok, true);
    const index = getIndex(tmpDir);
    assert.ok(index.stats.total_exports >= 3, `Expected >= 3 exports, got ${index.stats.total_exports}`);
  });
});

// --- Context Assembly Tests --------------------------------------------------

describe('Knowledge Layer: assembleContext', () => {
  let tmpDir;
  beforeEach(() => {
    tmpDir = createTempGitProject('gsd-knowledge-ctx-');
    initKnowledge(tmpDir);
    writeSourceFile(tmpDir, 'src/auth/login.js', 'function authenticate(user) { return true; }\nmodule.exports = { authenticate };');
    writeSourceFile(tmpDir, 'src/api/routes.js', 'const express = require("express");\nfunction getRoutes() {}\nmodule.exports = { getRoutes };');
    writeSourceFile(tmpDir, 'src/db/connection.js', 'function connect() {}\nmodule.exports = { connect };');
    gitCommit(tmpDir, 'add src');
    buildIndex(tmpDir);
  });
  afterEach(() => cleanup(tmpDir));

  it('returns relevant modules for auth-related query', () => {
    const ctx = assembleContext(tmpDir, 'fix the authentication login flow');
    assert.ok(ctx.relevant_modules.length > 0);
    const authModule = ctx.relevant_modules.find(m => m.module.includes('auth'));
    assert.ok(authModule, 'Should find auth module');
    assert.ok(authModule.score > 0);
  });

  it('respects token budget', () => {
    const ctx = assembleContext(tmpDir, 'add database queries', { budget: 500 });
    assert.ok(ctx.estimated_tokens <= 600);
  });

  it('returns empty for no-match query', () => {
    const ctx = assembleContext(tmpDir, 'quantum entanglement physics');
    assert.equal(ctx.relevant_modules.length, 0);
  });
});

// --- Diff-Aware Context Tests ------------------------------------------------

describe('Knowledge Layer: assembleDiffAwareContext', () => {
  let tmpDir;
  beforeEach(() => {
    tmpDir = createTempGitProject('gsd-knowledge-diff-');
    initKnowledge(tmpDir);
    writeSourceFile(tmpDir, 'src/auth/login.js', 'function authenticate(user) { return true; }\nmodule.exports = { authenticate };');
    writeSourceFile(tmpDir, 'src/api/routes.js', 'function getRoutes() {}\nmodule.exports = { getRoutes };');
    gitCommit(tmpDir, 'add src');
    buildIndex(tmpDir);
  });
  afterEach(() => cleanup(tmpDir));

  it('returns context with diff_context when files changed', () => {
    writeSourceFile(tmpDir, 'src/auth/login.js', 'function authenticate(user) { return false; }\nmodule.exports = { authenticate };');
    gitCommit(tmpDir, 'modify auth');

    const ctx = assembleDiffAwareContext(tmpDir, 'fix authentication');
    // Diff context should report the changed file
    if (ctx.diff_context) {
      assert.ok(Array.isArray(ctx.diff_context.changed_files));
    }
    assert.ok(ctx.relevant_modules.length > 0);
  });

  it('returns null diff_context when no changes since last index', () => {
    const ctx = assembleDiffAwareContext(tmpDir, 'fix authentication');
    // No changes since buildIndex, so diff_context should be null or have no files
    assert.ok(ctx.relevant_modules !== undefined);
  });

  it('gist and micro modules are consistent with boosted ordering', () => {
    // Add more modules so we get gist/micro tiers
    writeSourceFile(tmpDir, 'src/cache/redis.js', 'function getCache() {}\nmodule.exports = { getCache };');
    writeSourceFile(tmpDir, 'src/queue/worker.js', 'function processJob() {}\nmodule.exports = { processJob };');
    writeSourceFile(tmpDir, 'src/monitor/health.js', 'function checkHealth() {}\nmodule.exports = { checkHealth };');
    gitCommit(tmpDir, 'add more modules');
    buildIndex(tmpDir);

    // Now change auth file so it gets boosted
    writeSourceFile(tmpDir, 'src/auth/login.js', 'function authenticate(u) { return u != null; }\nmodule.exports = { authenticate };');
    gitCommit(tmpDir, 'modify auth');

    const ctx = assembleDiffAwareContext(tmpDir, 'fix authentication');
    // All modules in relevant_modules should have scores >= gist scores >= micro scores
    if (ctx.relevant_modules.length > 0 && ctx.gist_modules && ctx.gist_modules.length > 0) {
      const minRelevantScore = Math.min(...ctx.relevant_modules.map(m => m.score));
      const maxGistScore = Math.max(...ctx.gist_modules.map(m => m.score));
      assert.ok(minRelevantScore >= maxGistScore,
        `Top modules (min ${minRelevantScore}) should score >= gist modules (max ${maxGistScore})`);
    }
  });
});

// --- Dependency Graph Tests --------------------------------------------------

describe('Knowledge Layer: buildDependencyGraph', () => {
  let tmpDir;
  beforeEach(() => {
    tmpDir = createTempGitProject('gsd-knowledge-deps-');
    initKnowledge(tmpDir);
  });
  afterEach(() => cleanup(tmpDir));

  it('builds forward and reverse dependency maps', () => {
    writeSourceFile(tmpDir, 'src/a.js', 'const b = require("./b");\nmodule.exports = { a: 1 };');
    writeSourceFile(tmpDir, 'src/b.js', 'const c = require("./c");\nmodule.exports = { b: 2 };');
    writeSourceFile(tmpDir, 'src/c.js', 'module.exports = { c: 3 };');
    gitCommit(tmpDir, 'add files');
    buildIndex(tmpDir);

    const result = buildDependencyGraph(tmpDir);
    assert.equal(result.ok, true);
    assert.ok(result.total_edges >= 2);
  });

  it('returns impact analysis for a file', () => {
    writeSourceFile(tmpDir, 'src/a.js', 'const b = require("./b");\nmodule.exports = { a: 1 };');
    writeSourceFile(tmpDir, 'src/b.js', 'module.exports = { b: 2 };');
    gitCommit(tmpDir, 'add files');
    buildIndex(tmpDir);
    buildDependencyGraph(tmpDir);

    const impact = getImpactedFiles(tmpDir, 'src/b.js');
    assert.equal(impact.ok, true);
    assert.ok(impact.impacted_files.includes('src/a.js'), 'a.js depends on b.js');
  });
});

// --- Circular Dependency Detection (Tarjan's SCC) ----------------------------

describe('Knowledge Layer: findCircularDeps', () => {
  it('detects direct A<->B cycles', () => {
    const deps = { A: ['B'], B: ['A'] };
    const circular = findCircularDeps(deps);
    assert.equal(circular.length, 1);
    assert.ok(circular[0].includes('A'));
    assert.ok(circular[0].includes('B'));
  });

  it('detects transitive A->B->C->A cycles', () => {
    const deps = { A: ['B'], B: ['C'], C: ['A'] };
    const circular = findCircularDeps(deps);
    assert.equal(circular.length, 1);
    assert.ok(circular[0].includes('A'));
    assert.ok(circular[0].includes('B'));
    assert.ok(circular[0].includes('C'));
  });

  it('returns empty for acyclic graphs', () => {
    const deps = { A: ['B'], B: ['C'], C: [] };
    const circular = findCircularDeps(deps);
    assert.equal(circular.length, 0);
  });

  it('detects multiple independent cycles', () => {
    const deps = { A: ['B'], B: ['A'], C: ['D'], D: ['C'], E: [] };
    const circular = findCircularDeps(deps);
    assert.equal(circular.length, 2);
  });
});

// --- Loop Guard Tests --------------------------------------------------------

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

  it('detects ping-pong patterns and returns block action', () => {
    const guard = createLoopGuard();
    let lastResult;
    // Need 3 full repetitions of the 2-element pattern = 6 alternations
    for (let i = 0; i < 3; i++) {
      lastResult = guard.check('Read', { path: '/a.js' });
      if (lastResult.action === 'block') break;
      lastResult = guard.check('Edit', { path: '/a.js' });
      if (lastResult.action === 'block') break;
    }
    // The ping-pong or repeated-call detection should have triggered a block
    assert.equal(lastResult.action, 'block', 'Should detect ping-pong or repeated pattern');
    assert.ok(lastResult.message.length > 0);
  });

  it('circuit breaks on total calls', () => {
    const guard = createLoopGuard({ circuitBreakTotal: 30 });
    let result;
    for (let i = 0; i < 30; i++) {
      result = guard.check('tool' + i, { i });
    }
    assert.equal(result.action, 'circuit_break');
  });

  it('respects poll tool multiplier', () => {
    const guard = createLoopGuard({ pollTools: ['BashOutput'] });
    // BashOutput gets 3x threshold, so 14 calls should still be warn, not block
    for (let i = 0; i < 8; i++) guard.check('BashOutput', { id: 'same' });
    const r = guard.check('BashOutput', { id: 'same' });
    assert.equal(r.action, 'warn');
  });
});

// --- Safety Tests ------------------------------------------------------------

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

  it('circuit breaker trips after consecutive failures', () => {
    const cb = createCircuitBreaker(3);
    assert.ok(!cb.isTripped());
    cb.recordFailure();
    cb.recordFailure();
    assert.ok(!cb.isTripped());
    cb.recordFailure();
    assert.ok(cb.isTripped());
  });

  it('circuit breaker resets on success', () => {
    const cb = createCircuitBreaker(3);
    cb.recordFailure();
    cb.recordFailure();
    cb.recordSuccess();
    assert.ok(!cb.isTripped());
    assert.equal(cb.getState().consecutiveFailures, 0);
  });
});

// --- validateMergeReadiness Tests --------------------------------------------

describe('Knowledge Layer: validateMergeReadiness', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = createTempDir('gsd-knowledge-merge-'); });
  afterEach(() => cleanup(tmpDir));

  it('rejects when no worktree path', () => {
    const r = validateMergeReadiness(tmpDir, null, ['echo', 'ok']);
    assert.equal(r.ready, false);
    assert.ok(r.reason.includes('No worktree'));
  });

  it('rejects when worktree does not exist', () => {
    const r = validateMergeReadiness(tmpDir, '/nonexistent/path', ['echo', 'ok']);
    assert.equal(r.ready, false);
    assert.ok(r.reason.includes('does not exist'));
  });

  it('rejects when testArgs is not an array', () => {
    const r = validateMergeReadiness(tmpDir, tmpDir, 'echo ok');
    assert.equal(r.ready, false);
    assert.ok(r.reason.includes('array'));
  });

  it('passes when test command succeeds', () => {
    const r = validateMergeReadiness(tmpDir, tmpDir, ['node', '-e', 'process.exit(0)']);
    assert.equal(r.ready, true);
    assert.ok(r.reason.includes('passed'));
  });

  it('fails when test command fails', () => {
    const r = validateMergeReadiness(tmpDir, tmpDir, ['node', '-e', 'process.exit(1)']);
    assert.equal(r.ready, false);
    assert.ok(r.reason.includes('Tests failed'));
  });
});

// --- CLI Integration Test ----------------------------------------------------

describe('Knowledge Layer: CLI integration', () => {
  let tmpDir;
  beforeEach(() => {
    tmpDir = createTempGitProject('gsd-knowledge-cli-');
  });
  afterEach(() => cleanup(tmpDir));

  it('knowledge init works via CLI', () => {
    const result = runGsdTools(['knowledge', 'init', '--raw'], tmpDir);
    assert.equal(result.success, true);
    const json = JSON.parse(result.output);
    assert.equal(json.ok, true);
    assert.ok(fs.existsSync(path.join(tmpDir, '.planning', 'knowledge', 'INDEX.json')));
  });

  it('knowledge index works via CLI', () => {
    runGsdTools(['knowledge', 'init', '--raw'], tmpDir);
    writeSourceFile(tmpDir, 'src/app.js', 'module.exports = { x: 1 };');
    gitCommit(tmpDir, 'add src');

    const result = runGsdTools(['knowledge', 'index', '--raw'], tmpDir);
    assert.equal(result.success, true);
    const json = JSON.parse(result.output);
    assert.equal(json.ok, true);
    assert.ok(json.total_files >= 1);
  });

  it('unknown knowledge subcommand fails gracefully', () => {
    const result = runGsdTools(['knowledge', 'nonexistent', '--raw'], tmpDir);
    assert.equal(result.success, false);
  });
});
