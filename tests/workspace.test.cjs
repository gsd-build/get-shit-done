/**
 * GSD Workspace Tests
 *
 * Tests for /gsd-new-workspace, /gsd-list-workspaces, /gsd-remove-workspace
 * init functions and integration with gsd-tools routing.
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const { runGsdTools, createTempProject, createTempDir, cleanup } = require('./helpers.cjs');
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
// #2790: new-workspace.md, list-workspaces.md, remove-workspace.md were
// consolidated into a single workspace.md command with --new/--list/--remove flags.

// allow-test-rule: source-text-is-the-product
// workspace.md routing text and workflow content IS the deployed behavioral contract for the agent.

describe('workspace command files', () => {
  const baseDir = path.join(__dirname, '..');

  /**
   * Split frontmatter / body and parse simple YAML-ish key:value pairs.
   * Returns { fm: { name, argument-hint, ... }, body }. Avoids raw
   * substring matching on the file as a whole.
   */
  function parseCommandFile(filePath) {
    const raw = fs.readFileSync(filePath, 'utf8');
    const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
    assert.ok(fmMatch, `${path.basename(filePath)} must start with a YAML frontmatter block`);
    const fm = {};
    for (const line of fmMatch[1].split('\n')) {
      const kv = line.match(/^([a-zA-Z_-]+):\s*(.*)$/);
      if (!kv) continue;
      const key = kv[1];
      let val = kv[2].trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      fm[key] = val;
    }
    return { fm, body: fmMatch[2] };
  }

  /**
   * Extract `@`-include targets from any of the <execution_context*> blocks.
   * Each line of the form `@~/.claude/get-shit-done/workflows/foo.md` becomes
   * a relative target like `workflows/foo.md`. Used to assert workflow
   * routing structurally instead of substring-matching prose.
   */
  function executionContextIncludes(body) {
    const blocks = [...body.matchAll(/<execution_context(?:_extended)?>([\s\S]*?)<\/execution_context(?:_extended)?>/g)]
      .map((m) => m[1]);
    const targets = [];
    for (const blk of blocks) {
      for (const line of blk.split('\n')) {
        const t = line.trim();
        if (!t.startsWith('@')) continue;
        // Normalize away the home-prefix and the `.claude/get-shit-done/` root
        // so the test only cares about the workflow path tail.
        const rel = t.replace(/^@~?\/?(?:\.claude\/)?(?:get-shit-done\/)?/, '');
        targets.push(rel);
      }
    }
    return targets;
  }

  test('consolidated workspace.md command declares correct frontmatter contract (#2790)', () => {
    // Structural: parse frontmatter, then split argument-hint into the
    // tokenized flag list. Each consolidated flag must appear there.
    const { fm } = parseCommandFile(path.join(baseDir, 'commands/gsd/workspace.md'));
    assert.equal(fm.name, 'gsd:workspace', `workspace.md frontmatter name must be "gsd:workspace"; got "${fm.name}"`);
    assert.ok(fm['argument-hint'], 'workspace.md frontmatter must declare argument-hint');
    // argument-hint can include multiple bracketed segments and free tokens,
    // e.g. "[--new | --list | --remove] [name]". Pull every `--flag` token
    // out of any bracketed segment so the test asserts on a parsed flag set,
    // not the punctuation around it.
    const bracketed = [...fm['argument-hint'].matchAll(/\[([^\]]*)\]/g)].map((m) => m[1]);
    const flagList = bracketed
      .flatMap((seg) => seg.split('|').map((s) => s.trim().split(/\s+/)[0]))
      .filter((tok) => tok.startsWith('--'));
    for (const flag of ['--new', '--list', '--remove']) {
      assert.ok(
        flagList.includes(flag),
        `workspace.md argument-hint must declare ${flag}; got: ${JSON.stringify(flagList)}`
      );
    }
  });

  test('workspace.md @-includes the new-workspace workflow', () => {
    const { body } = parseCommandFile(path.join(baseDir, 'commands/gsd/workspace.md'));
    const targets = executionContextIncludes(body);
    assert.ok(
      targets.some((t) => /(^|\/)workflows\/new-workspace\.md$/.test(t)),
      `workspace.md execution_context must @-include workflows/new-workspace.md; got: ${JSON.stringify(targets)}`
    );
  });

  test('workspace.md @-includes the list-workspaces workflow', () => {
    const { body } = parseCommandFile(path.join(baseDir, 'commands/gsd/workspace.md'));
    const targets = executionContextIncludes(body);
    assert.ok(
      targets.some((t) => /(^|\/)workflows\/list-workspaces\.md$/.test(t)),
      `workspace.md execution_context must @-include workflows/list-workspaces.md; got: ${JSON.stringify(targets)}`
    );
  });

  test('workspace.md @-includes the remove-workspace workflow', () => {
    const { body } = parseCommandFile(path.join(baseDir, 'commands/gsd/workspace.md'));
    const targets = executionContextIncludes(body);
    assert.ok(
      targets.some((t) => /(^|\/)workflows\/remove-workspace\.md$/.test(t)),
      `workspace.md execution_context must @-include workflows/remove-workspace.md; got: ${JSON.stringify(targets)}`
    );
  });

  test('new-workspace workflow exists', () => {
    const content = fs.readFileSync(path.join(baseDir, 'get-shit-done/workflows/new-workspace.md'), 'utf8');
    assert.ok(
      content.includes('init new-workspace') || content.includes('init.new-workspace'),
      'expected init new-workspace (CJS) or gsd-sdk query init.new-workspace'
    );
    assert.ok(content.includes('WORKSPACE.md'));
    assert.ok(content.includes('git worktree add'));
    assert.ok(content.includes('git clone'));
  });

  test('list-workspaces workflow exists', () => {
    const content = fs.readFileSync(path.join(baseDir, 'get-shit-done/workflows/list-workspaces.md'), 'utf8');
    assert.ok(
      content.includes('init list-workspaces') || content.includes('init.list-workspaces'),
      'expected init list-workspaces or gsd-sdk query init.list-workspaces'
    );
  });

  test('remove-workspace workflow exists', () => {
    const content = fs.readFileSync(path.join(baseDir, 'get-shit-done/workflows/remove-workspace.md'), 'utf8');
    assert.ok(
      content.includes('init remove-workspace') || content.includes('init.remove-workspace'),
      'expected init remove-workspace or gsd-sdk query init.remove-workspace'
    );
    assert.ok(content.includes('git worktree remove'));
  });
});

// ─── Routing in gsd-tools ───────────────────────────────────────────────────

describe('workspace routing in gsd-tools', () => {
  let tmpDir;

  beforeEach(() => { tmpDir = createTempProject(); });
  afterEach(() => { cleanup(tmpDir); });

  // Behavioral routing tests: verify each command is recognized by the router
  // (does not return "Unknown init workflow: ..."). The exact command output is
  // covered by the functional tests above; these guard against routing deletions.

  test('init new-workspace is routed correctly', () => {
    const result = runGsdTools('init new-workspace test-ws', tmpDir);
    const stderr = result.error || '';
    assert.ok(
      !stderr.includes('Unknown init workflow'),
      `init new-workspace must be a recognized command; got: ${stderr}`
    );
  });

  test('init list-workspaces is routed correctly', () => {
    const result = runGsdTools('init list-workspaces', tmpDir);
    assert.ok(result.success, `init list-workspaces should succeed: ${result.error}`);
    const parsed = JSON.parse(result.output);
    assert.ok(Array.isArray(parsed.workspaces), 'list-workspaces must return a workspaces array');
  });

  test('init remove-workspace is routed correctly', () => {
    const result = runGsdTools('init remove-workspace nonexistent-ws', tmpDir);
    const stderr = result.error || '';
    assert.ok(
      !stderr.includes('Unknown init workflow'),
      `init remove-workspace must be a recognized command; got: ${stderr}`
    );
  });
});
