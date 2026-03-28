/**
 * GSD Workspace Tests
 *
 * Tests for /gsd:new-workspace, /gsd:list-workspaces, /gsd:remove-workspace
 * init functions and integration with gsd-tools routing.
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const { runGsdTools, createTempDir, cleanup } = require('./helpers.cjs');
const { detectChildRepos } = require('../get-shit-done/bin/lib/init.cjs');

// ─── detectChildRepos ────────────────────────────────────────────────────────

describe('detectChildRepos', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempDir('gsd-ws-test-');
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('detects child git repos', () => {
    // Create two child git repos
    const repo1 = path.join(tmpDir, 'repo-a');
    const repo2 = path.join(tmpDir, 'repo-b');
    fs.mkdirSync(repo1);
    fs.mkdirSync(repo2);
    execSync('git init', { cwd: repo1, stdio: 'pipe' });
    execSync('git init', { cwd: repo2, stdio: 'pipe' });

    const repos = detectChildRepos(tmpDir);
    assert.strictEqual(repos.length, 2);
    const names = repos.map(r => r.name).sort();
    assert.deepStrictEqual(names, ['repo-a', 'repo-b']);
  });

  test('skips non-git directories', () => {
    const gitRepo = path.join(tmpDir, 'real-repo');
    const notRepo = path.join(tmpDir, 'just-a-dir');
    fs.mkdirSync(gitRepo);
    fs.mkdirSync(notRepo);
    execSync('git init', { cwd: gitRepo, stdio: 'pipe' });

    const repos = detectChildRepos(tmpDir);
    assert.strictEqual(repos.length, 1);
    assert.strictEqual(repos[0].name, 'real-repo');
  });

  test('skips hidden directories', () => {
    const hiddenRepo = path.join(tmpDir, '.hidden-repo');
    fs.mkdirSync(hiddenRepo);
    execSync('git init', { cwd: hiddenRepo, stdio: 'pipe' });

    const repos = detectChildRepos(tmpDir);
    assert.strictEqual(repos.length, 0);
  });

  test('skips files', () => {
    fs.writeFileSync(path.join(tmpDir, 'some-file.txt'), 'hello');
    const repos = detectChildRepos(tmpDir);
    assert.strictEqual(repos.length, 0);
  });

  test('returns empty array for non-existent directory', () => {
    const repos = detectChildRepos(path.join(tmpDir, 'does-not-exist'));
    assert.strictEqual(repos.length, 0);
  });
});

// ─── cmdInitNewWorkspace via gsd-tools ──────────────────────────────────────

describe('init new-workspace', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempDir('gsd-ws-test-');
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('returns expected JSON fields', () => {
    const result = runGsdTools('init new-workspace', tmpDir);
    assert.ok(result.success, `init failed: ${result.error}`);
    const data = JSON.parse(result.output);
    assert.ok('default_workspace_base' in data);
    assert.ok('child_repos' in data);
    assert.ok('child_repo_count' in data);
    assert.ok('worktree_available' in data);
    assert.ok('is_git_repo' in data);
    assert.ok('cwd_repo_name' in data);
    assert.ok('project_root' in data);
  });

  test('detects child git repos in cwd', () => {
    const repo = path.join(tmpDir, 'my-repo');
    fs.mkdirSync(repo);
    execSync('git init', { cwd: repo, stdio: 'pipe' });

    const result = runGsdTools('init new-workspace', tmpDir);
    const data = JSON.parse(result.output);
    assert.strictEqual(data.child_repo_count, 1);
    assert.strictEqual(data.child_repos[0].name, 'my-repo');
  });

  test('reports no git repo when cwd is not a git repo', () => {
    const result = runGsdTools('init new-workspace', tmpDir);
    const data = JSON.parse(result.output);
    assert.strictEqual(data.is_git_repo, false);
  });
});

// ─── cmdInitListWorkspaces via gsd-tools ────────────────────────────────────

describe('init list-workspaces', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempDir('gsd-ws-test-');
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('returns empty list when no workspaces exist', () => {
    const result = runGsdTools('init list-workspaces', tmpDir, { HOME: tmpDir });
    assert.ok(result.success, `init failed: ${result.error}`);
    const data = JSON.parse(result.output);
    assert.strictEqual(data.workspace_count, 0);
    assert.deepStrictEqual(data.workspaces, []);
  });

  test('finds workspaces with WORKSPACE.md', () => {
    const wsBase = path.join(tmpDir, 'gsd-workspaces');
    const ws1 = path.join(wsBase, 'feature-a');
    fs.mkdirSync(path.join(ws1, '.planning'), { recursive: true });
    fs.writeFileSync(path.join(ws1, 'WORKSPACE.md'), [
      '# Workspace: feature-a',
      '',
      'Created: 2026-03-20',
      'Strategy: worktree',
      '',
      '## Member Repos',
      '',
      '| Repo | Source | Branch | Strategy |',
      '|------|--------|--------|----------|',
      '| hr-ui | /tmp/hr-ui | workspace/feature-a | worktree |',
    ].join('\n'));

    const result = runGsdTools('init list-workspaces', tmpDir, { HOME: tmpDir });
    const data = JSON.parse(result.output);
    assert.strictEqual(data.workspace_count, 1);
    assert.strictEqual(data.workspaces[0].name, 'feature-a');
    assert.strictEqual(data.workspaces[0].strategy, 'worktree');
    assert.strictEqual(data.workspaces[0].repo_count, 1);
  });
});

// ─── cmdInitRemoveWorkspace via gsd-tools ───────────────────────────────────

describe('init remove-workspace', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempDir('gsd-ws-test-');
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('errors when no name provided', () => {
    const result = runGsdTools('init remove-workspace', tmpDir);
    assert.strictEqual(result.success, false);
    assert.ok(result.error.includes('workspace name required'));
  });

  test('errors when workspace not found', () => {
    const result = runGsdTools('init remove-workspace nonexistent', tmpDir, { HOME: tmpDir });
    assert.strictEqual(result.success, false);
    assert.ok(result.error.includes('Workspace not found'));
  });

  test('returns workspace info for existing workspace', () => {
    const wsBase = path.join(tmpDir, 'gsd-workspaces');
    const ws = path.join(wsBase, 'test-ws');
    fs.mkdirSync(ws, { recursive: true });
    fs.writeFileSync(path.join(ws, 'WORKSPACE.md'), [
      '# Workspace: test-ws',
      '',
      'Created: 2026-03-20',
      'Strategy: clone',
      '',
      '## Member Repos',
      '',
      '| Repo | Source | Branch | Strategy |',
      '|------|--------|--------|----------|',
      '| api | /tmp/api | workspace/test-ws | clone |',
    ].join('\n'));

    const result = runGsdTools('init remove-workspace test-ws', tmpDir, { HOME: tmpDir });
    assert.ok(result.success, `init failed: ${result.error}`);
    const data = JSON.parse(result.output);
    assert.strictEqual(data.workspace_name, 'test-ws');
    assert.strictEqual(data.strategy, 'clone');
    assert.strictEqual(data.has_dirty_repos, false);
  });
});

// ─── Integration: worktree creation and removal ─────────────────────────────

describe('workspace worktree integration', () => {
  let tmpDir;
  let sourceRepo;

  beforeEach(() => {
    tmpDir = createTempDir('gsd-ws-integ-');
    // Create a source git repo with a commit
    sourceRepo = path.join(tmpDir, 'source-repo');
    fs.mkdirSync(sourceRepo);
    execSync('git init', { cwd: sourceRepo, stdio: 'pipe' });
    execSync('git config user.email "test@test.com"', { cwd: sourceRepo, stdio: 'pipe' });
    execSync('git config user.name "Test"', { cwd: sourceRepo, stdio: 'pipe' });
    fs.writeFileSync(path.join(sourceRepo, 'README.md'), '# Test Repo\n');
    execSync('git add -A', { cwd: sourceRepo, stdio: 'pipe' });
    execSync('git commit -m "initial"', { cwd: sourceRepo, stdio: 'pipe' });
  });

  afterEach(() => {
    // Clean up worktrees before removing tmp dir
    try {
      execSync('git worktree prune', { cwd: sourceRepo, stdio: 'pipe' });
    } catch { /* best-effort */ }
    cleanup(tmpDir);
  });

  test('creates workspace with git worktree', () => {
    const wsPath = path.join(tmpDir, 'my-workspace');
    fs.mkdirSync(wsPath);
    fs.mkdirSync(path.join(wsPath, '.planning'));

    // Create worktree
    execSync(`git worktree add "${path.join(wsPath, 'source-repo')}" -b workspace/test`, {
      cwd: sourceRepo,
      stdio: 'pipe',
    });

    // Verify worktree was created
    assert.ok(fs.existsSync(path.join(wsPath, 'source-repo', 'README.md')));

    // Verify it's a worktree (has .git file, not .git directory)
    const gitPath = path.join(wsPath, 'source-repo', '.git');
    assert.ok(fs.existsSync(gitPath));
    const stat = fs.statSync(gitPath);
    assert.ok(stat.isFile(), '.git should be a file (worktree link), not a directory');
  });

  test('creates workspace with git clone', () => {
    const wsPath = path.join(tmpDir, 'cloned-workspace');
    fs.mkdirSync(wsPath);

    // Clone repo
    execSync(`git clone "${sourceRepo}" "${path.join(wsPath, 'source-repo')}"`, {
      stdio: 'pipe',
    });

    // Verify clone
    assert.ok(fs.existsSync(path.join(wsPath, 'source-repo', 'README.md')));

    // Verify it's a full clone (has .git directory)
    const gitPath = path.join(wsPath, 'source-repo', '.git');
    const stat = fs.statSync(gitPath);
    assert.ok(stat.isDirectory(), '.git should be a directory (full clone)');
  });

  test('worktree removal cleans up properly', () => {
    const wsPath = path.join(tmpDir, 'removable-ws');
    fs.mkdirSync(wsPath);

    // Create worktree
    execSync(`git worktree add "${path.join(wsPath, 'source-repo')}" -b workspace/removable`, {
      cwd: sourceRepo,
      stdio: 'pipe',
    });

    assert.ok(fs.existsSync(path.join(wsPath, 'source-repo', 'README.md')));

    // Remove worktree
    execSync(`git worktree remove "${path.join(wsPath, 'source-repo')}"`, {
      cwd: sourceRepo,
      stdio: 'pipe',
    });

    // Verify worktree is gone
    assert.ok(!fs.existsSync(path.join(wsPath, 'source-repo')));

    // Verify worktree list doesn't include it
    const worktrees = execSync('git worktree list', { cwd: sourceRepo, encoding: 'utf8' });
    assert.ok(!worktrees.includes('removable-ws'));
  });
});

// ─── Command and workflow file existence ────────────────────────────────────

describe('workspace command files', () => {
  const baseDir = path.join(__dirname, '..');

  test('new-workspace command exists with correct frontmatter', () => {
    const content = fs.readFileSync(path.join(baseDir, 'commands/gsd/new-workspace.md'), 'utf8');
    assert.ok(content.includes('name: gsd:new-workspace'));
    assert.ok(content.includes('--name'));
    assert.ok(content.includes('--repos'));
    assert.ok(content.includes('--strategy'));
    assert.ok(content.includes('workflows/new-workspace.md'));
  });

  test('list-workspaces command exists with correct frontmatter', () => {
    const content = fs.readFileSync(path.join(baseDir, 'commands/gsd/list-workspaces.md'), 'utf8');
    assert.ok(content.includes('name: gsd:list-workspaces'));
    assert.ok(content.includes('workflows/list-workspaces.md'));
  });

  test('remove-workspace command exists with correct frontmatter', () => {
    const content = fs.readFileSync(path.join(baseDir, 'commands/gsd/remove-workspace.md'), 'utf8');
    assert.ok(content.includes('name: gsd:remove-workspace'));
    assert.ok(content.includes('workflows/remove-workspace.md'));
  });

  test('new-workspace workflow exists', () => {
    const content = fs.readFileSync(path.join(baseDir, 'get-shit-done/workflows/new-workspace.md'), 'utf8');
    assert.ok(content.includes('init new-workspace'));
    assert.ok(content.includes('WORKSPACE.md'));
    assert.ok(content.includes('git worktree add'));
    assert.ok(content.includes('git clone'));
  });

  test('list-workspaces workflow exists', () => {
    const content = fs.readFileSync(path.join(baseDir, 'get-shit-done/workflows/list-workspaces.md'), 'utf8');
    assert.ok(content.includes('init list-workspaces'));
  });

  test('remove-workspace workflow exists', () => {
    const content = fs.readFileSync(path.join(baseDir, 'get-shit-done/workflows/remove-workspace.md'), 'utf8');
    assert.ok(content.includes('init remove-workspace'));
    assert.ok(content.includes('git worktree remove'));
  });
});

// ─── Routing in gsd-tools ───────────────────────────────────────────────────

describe('workspace routing in gsd-tools', () => {
  test('init new-workspace is routed correctly', () => {
    const toolsContent = fs.readFileSync(
      path.join(__dirname, '..', 'get-shit-done', 'bin', 'gsd-tools.cjs'),
      'utf8'
    );
    assert.ok(toolsContent.includes("case 'new-workspace'"));
    assert.ok(toolsContent.includes('cmdInitNewWorkspace'));
  });

  test('init list-workspaces is routed correctly', () => {
    const toolsContent = fs.readFileSync(
      path.join(__dirname, '..', 'get-shit-done', 'bin', 'gsd-tools.cjs'),
      'utf8'
    );
    assert.ok(toolsContent.includes("case 'list-workspaces'"));
    assert.ok(toolsContent.includes('cmdInitListWorkspaces'));
  });

  test('init remove-workspace is routed correctly', () => {
    const toolsContent = fs.readFileSync(
      path.join(__dirname, '..', 'get-shit-done', 'bin', 'gsd-tools.cjs'),
      'utf8'
    );
    assert.ok(toolsContent.includes("case 'remove-workspace'"));
    assert.ok(toolsContent.includes('cmdInitRemoveWorkspace'));
  });
});
