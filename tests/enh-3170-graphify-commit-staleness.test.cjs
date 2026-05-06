'use strict';

/**
 * Contract for the #3170 commit-staleness signal on graphifyStatus().
 *
 * graphify v0.7+ embeds `built_at_commit` (full git HEAD) into graph.json at
 * write time. GSD's status used to be mtime-only, a poor proxy for "does
 * this graph reflect the current code." This suite fences the four new
 * fields surfaced by graphifyStatus():
 *
 *   built_at_commit  short hash from graph.built_at_commit, or null
 *   current_commit   short hash of HEAD, or null if cwd is not a git repo
 *   commits_behind   git rev-list --count <built>..HEAD, or null
 *   commit_stale     boolean, true if commits_behind > 0; null when unknown
 *
 * Tri-state on commit_stale is load-bearing: null means "we don't know"
 * (pre-v0.7 graph or no git), which is semantically distinct from false
 * ("known fresh"). Agents reading null should fall back to mtime; reading
 * false can confidently skip a rebuild.
 */

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { createTempProject, createTempGitProject, cleanup } = require('./helpers.cjs');
const { graphifyStatus } = require('../get-shit-done/bin/lib/graphify.cjs');

function enableGraphify(planningDir) {
  const cfgPath = path.join(planningDir, 'config.json');
  const cfg = fs.existsSync(cfgPath) ? JSON.parse(fs.readFileSync(cfgPath, 'utf8')) : {};
  cfg.graphify = { enabled: true };
  fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));
}

function writeGraph(planningDir, data) {
  const graphsDir = path.join(planningDir, 'graphs');
  fs.mkdirSync(graphsDir, { recursive: true });
  fs.writeFileSync(path.join(graphsDir, 'graph.json'), JSON.stringify(data, null, 2));
}

function gitHead(cwd) {
  return execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf-8' }).trim();
}

function commitEmpty(cwd, message) {
  execFileSync('git', ['commit', '--allow-empty', '-m', message], { cwd, stdio: 'pipe' });
}

const SAMPLE_NODES = [
  { id: 'n1', label: 'A', description: '', type: 'service' },
  { id: 'n2', label: 'B', description: '', type: 'model' },
];

describe('enh-3170: graphifyStatus surfaces built_at_commit staleness', () => {
  let tmpDir;
  let planningDir;

  // ──────────────────────────────────────────────────────────────────
  // Group 1 — git-aware cases (real git repo via createTempGitProject)
  // ──────────────────────────────────────────────────────────────────

  describe('git-aware', () => {
    beforeEach(() => {
      tmpDir = createTempGitProject();
      planningDir = path.join(tmpDir, '.planning');
      enableGraphify(planningDir);
    });

    afterEach(() => cleanup(tmpDir));

    test('graph rebuilt at HEAD: commits_behind=0, commit_stale=false', () => {
      const head = gitHead(tmpDir);
      writeGraph(planningDir, { nodes: SAMPLE_NODES, edges: [], built_at_commit: head });

      const result = graphifyStatus(tmpDir);

      assert.equal(result.built_at_commit, head.slice(0, 7),
        'short hash from graph.built_at_commit');
      assert.equal(result.current_commit, head.slice(0, 7),
        'short hash of git HEAD');
      assert.equal(result.commits_behind, 0,
        'zero commits between HEAD and itself');
      assert.equal(result.commit_stale, false,
        'commit_stale is explicitly false when commits_behind === 0');
    });

    test('graph 5 commits behind HEAD: commits_behind=5, commit_stale=true', () => {
      const built = gitHead(tmpDir);
      for (let i = 0; i < 5; i += 1) commitEmpty(tmpDir, `c${i}`);
      writeGraph(planningDir, { nodes: SAMPLE_NODES, edges: [], built_at_commit: built });

      const result = graphifyStatus(tmpDir);

      assert.equal(result.commits_behind, 5);
      assert.equal(result.commit_stale, true);
      assert.equal(result.built_at_commit, built.slice(0, 7));
      assert.notEqual(result.current_commit, built.slice(0, 7),
        'current_commit reflects HEAD, not graph build commit');
    });

    test('built_at_commit absent (pre-v0.7 graph): all four new fields null', () => {
      // No built_at_commit on the graph -- GSD must not fabricate one.
      writeGraph(planningDir, { nodes: SAMPLE_NODES, edges: [] });

      const result = graphifyStatus(tmpDir);

      assert.equal(result.built_at_commit, null);
      assert.equal(result.commits_behind, null);
      assert.equal(result.commit_stale, null,
        'tri-state: null means "we do not know", not "fresh"');
      // current_commit may still be non-null since we are in a git repo,
      // but without a baseline it cannot drive staleness.
      assert.notEqual(result.current_commit, undefined,
        'current_commit field is always present even when null');
    });

    test('rebased-away built_at_commit: commits_behind=null, commit_stale=null', () => {
      // built_at_commit references a commit that never existed in this repo.
      const ghostHash = '0000000000000000000000000000000000000001';
      writeGraph(planningDir, { nodes: SAMPLE_NODES, edges: [], built_at_commit: ghostHash });

      const result = graphifyStatus(tmpDir);

      assert.equal(result.built_at_commit, ghostHash.slice(0, 7),
        'echoes the field even if unreachable -- caller can decide what to do');
      assert.equal(result.commits_behind, null,
        'cannot count commits to an unreachable commit');
      assert.equal(result.commit_stale, null,
        'unknown distance means unknown staleness');
    });

    test('malformed built_at_commit (dashed argv): rejected before git invocation', () => {
      // Argument-injection fence: a graph.json with a hostile built_at_commit
      // must never reach `git` as an argv element. The implementation should
      // validate /^[0-9a-f]{4,40}$/i and treat anything else as absent.
      const malicious = '--upload-pack=evil';
      writeGraph(planningDir, { nodes: SAMPLE_NODES, edges: [], built_at_commit: malicious });

      const result = graphifyStatus(tmpDir);

      assert.equal(result.built_at_commit, null,
        'malformed value is rejected, not echoed');
      assert.equal(result.commits_behind, null);
      assert.equal(result.commit_stale, null);
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // Group 2 — non-git cases (createTempProject, no .git/)
  // ──────────────────────────────────────────────────────────────────

  describe('non-git cwd', () => {
    beforeEach(() => {
      tmpDir = createTempProject();
      planningDir = path.join(tmpDir, '.planning');
      enableGraphify(planningDir);
    });

    afterEach(() => cleanup(tmpDir));

    test('cwd has no .git: current_commit=null, derived fields=null', () => {
      const built = 'abcdef1234567890abcdef1234567890abcdef12';
      writeGraph(planningDir, { nodes: SAMPLE_NODES, edges: [], built_at_commit: built });

      const result = graphifyStatus(tmpDir);

      assert.equal(result.built_at_commit, built.slice(0, 7),
        'graph field is echoed even without a local repo');
      assert.equal(result.current_commit, null,
        'no HEAD without git');
      assert.equal(result.commits_behind, null);
      assert.equal(result.commit_stale, null);
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // Group 3 — back-compat fences for existing fields
  // ──────────────────────────────────────────────────────────────────

  describe('back-compat', () => {
    beforeEach(() => {
      tmpDir = createTempGitProject();
      planningDir = path.join(tmpDir, '.planning');
      enableGraphify(planningDir);
      writeGraph(planningDir, {
        nodes: SAMPLE_NODES,
        edges: [{ source: 'n1', target: 'n2', label: 'x', confidence: 'EXTRACTED' }],
        hyperedges: [],
        built_at_commit: gitHead(tmpDir),
      });
    });

    afterEach(() => cleanup(tmpDir));

    test('existing fields are unchanged when commit-staleness fields are added', () => {
      const result = graphifyStatus(tmpDir);

      // Existing contract — must not regress.
      assert.equal(result.exists, true);
      assert.equal(result.node_count, 2);
      assert.equal(result.edge_count, 1);
      assert.equal(result.hyperedge_count, 0);
      assert.equal(typeof result.last_build, 'string');
      assert.equal(typeof result.stale, 'boolean',
        'mtime-based stale flag stays as-is for back-compat');
      assert.equal(typeof result.age_hours, 'number');
    });

    test('disabled response is unchanged (commit-staleness fields not added)', () => {
      const tmp2 = createTempProject();
      try {
        const result = graphifyStatus(tmp2);
        assert.equal(result.disabled, true,
          'disabled path returns the existing shape, no commit fields');
        assert.equal(result.built_at_commit, undefined,
          'commit-staleness fields are only added on the success path');
      } finally {
        cleanup(tmp2);
      }
    });
  });
});
