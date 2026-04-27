/**
 * Bug #2767: Workflows pass paths positionally to `gsd-sdk query commit`.
 *
 * Runtime behavior under the buggy form (paths positional, no `--files`):
 *   1. positional path tokens are joined into the commit subject (commit.ts:110); and
 *   2. `filePaths` is empty, so the handler falls back to staging `.planning/`
 *      wholesale (commit.ts:136), silently swapping the user's intent.
 *
 * Under the well-formed form (`--files <path...>`):
 *   - subject is the message arg only;
 *   - exactly the listed files are staged;
 *   - `commit-to-subrepo` rejects when `--files` is absent (commit.ts:258).
 *
 * Note: the supplementary doc-lint's `isWellFormed` accepts any invocation that
 * has no positional path args after the message — i.e. message-only commits pass
 * regardless of any trailing comment. There is no required marker (`# message-only`
 * or otherwise); the absence of positional path tokens is the sole signal.
 *
 * Primary test: invoke the actual `gsd-sdk query commit[-to-subrepo]` binary
 * against a real tmp git project and assert the runtime behavior. Supplementary
 * test: a doc-lint that scans every shipped .md file to catch regressions of
 * the 50-file invocation cleanup landed in this PR. The behavioral tests are
 * the contract; the lint is a defense-in-depth guard.
 */

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { createTempGitProject, cleanup } = require('./helpers.cjs');

const REPO_ROOT = path.join(__dirname, '..');
const SDK_CLI = path.join(REPO_ROOT, 'sdk', 'dist', 'cli.js');

/**
 * Run a git command with hardcoded argv (no shell). Returns trimmed stdout.
 */
function git(projectDir, args) {
  return execFileSync('git', args, { cwd: projectDir, encoding: 'utf-8' }).trim();
}

/**
 * Invoke `gsd-sdk query <subcommand> <...args>` against a project dir.
 * Returns { exitCode, stdout, stderr, json } where json is the parsed handler
 * payload (the SDK prints a single JSON object to stdout for query handlers).
 */
function runSdkQuery(subcommand, args, projectDir) {
  const argv = ['query', subcommand, ...args, '--project-dir', projectDir];
  let stdout = '';
  let stderr = '';
  let exitCode = 0;
  try {
    stdout = execFileSync(process.execPath, [SDK_CLI, ...argv], {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, GSD_SESSION_KEY: '' },
    });
  } catch (err) {
    exitCode = err.status ?? 1;
    stdout = err.stdout?.toString() ?? '';
    stderr = err.stderr?.toString() ?? '';
  }
  // Extract the trailing JSON object — the CLI prints status lines before it.
  let json = null;
  const lastBrace = stdout.lastIndexOf('{');
  if (lastBrace >= 0) {
    try { json = JSON.parse(stdout.slice(lastBrace).trim()); } catch { /* leave null */ }
    if (!json) {
      try { json = JSON.parse(stdout.trim()); } catch { /* leave null */ }
    }
  }
  return { exitCode, stdout, stderr, json };
}

function gitSubject(projectDir) {
  return git(projectDir, ['log', '-1', '--pretty=%s']);
}

function gitFilesAt(projectDir) {
  return git(projectDir, ['show', '--pretty=', '--name-only', 'HEAD'])
    .split('\n').filter(Boolean).sort();
}

// ─── Behavioral SDK tests ────────────────────────────────────────────────────

describe('bug #2767 (behavioral): gsd-sdk query commit --files', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempGitProject('gsd-2767-');
    fs.writeFileSync(path.join(tmpDir, 'foo.md'), 'foo body\n');
    fs.writeFileSync(path.join(tmpDir, 'bar.md'), 'bar body\n');
    // .planning/ change that MUST NOT leak into the commit when --files is used.
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'state\n');
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('well-formed: --files <paths> stages exactly those files with clean subject', () => {
    const message = 'test(#2767): well-formed commit';
    const result = runSdkQuery('commit', [message, '--files', 'foo.md', 'bar.md'], tmpDir);

    assert.equal(result.exitCode, 0, `cli failed: ${result.stderr}`);
    assert.ok(result.json, `expected JSON body in stdout, got:\n${result.stdout}`);
    assert.equal(result.json.committed, true, `commit failed: ${JSON.stringify(result.json)}`);
    assert.equal(result.json.message, message, 'subject must be message-only — no path leakage');
    assert.deepEqual(result.json.files.slice().sort(), ['bar.md', 'foo.md']);

    // Cross-check via git itself.
    assert.equal(gitSubject(tmpDir), message);
    assert.deepEqual(gitFilesAt(tmpDir), ['bar.md', 'foo.md']);
    // The .planning/STATE.md change must remain unstaged/unrelated.
    const stillDirty = git(tmpDir, ['status', '--porcelain']);
    assert.ok(stillDirty.includes('.planning/STATE.md'),
      `.planning/STATE.md should remain unstaged, got status:\n${stillDirty}`);
  });

  test('buggy form (positional, no --files): paths leak into subject AND .planning/ fallback fires', () => {
    // Documents the misbehavior #2767 prevents at every workflow call site.
    // Any future change that makes the buggy form silently "do the right thing"
    // trips this test and must justify the change.
    const message = 'test(#2767): positional buggy';
    const result = runSdkQuery('commit', [message, 'foo.md', 'bar.md'], tmpDir);

    assert.equal(result.exitCode, 0);
    assert.ok(result.json, `expected JSON body, got:\n${result.stdout}`);
    assert.equal(result.json.committed, true);

    // Subject got polluted with the path tokens.
    assert.equal(result.json.message, `${message} foo.md bar.md`,
      'paths leak into the commit subject under the buggy form (commit.ts:110)');
    assert.equal(gitSubject(tmpDir), `${message} foo.md bar.md`);

    // Fallback staged .planning/STATE.md, NOT foo.md/bar.md.
    assert.deepEqual(gitFilesAt(tmpDir), ['.planning/STATE.md'],
      'positional form triggers the .planning/ wholesale fallback (commit.ts:136)');
    const dirty = git(tmpDir, ['status', '--porcelain']);
    assert.ok(dirty.includes('foo.md') && dirty.includes('bar.md'),
      `foo.md/bar.md should remain unstaged under the buggy form, got:\n${dirty}`);
  });

  test('positional form with no .planning/ change: returns "nothing staged"', () => {
    // Reset the .planning/STATE.md change so the fallback has nothing to stage.
    fs.rmSync(path.join(tmpDir, '.planning', 'STATE.md'), { force: true });

    const result = runSdkQuery('commit', ['msg', 'foo.md'], tmpDir);
    assert.equal(result.exitCode, 0);
    assert.ok(result.json, `expected JSON body, got:\n${result.stdout}`);
    assert.equal(result.json.committed, false);
    assert.equal(result.json.reason, 'nothing staged',
      'positional form ignores foo.md and finds nothing under .planning/ to fall back to');
  });
});

describe('bug #2767 (behavioral): commit-to-subrepo requires --files', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempGitProject('gsd-2767-sub-');
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ sub_repos: ['vendor/lib'] }, null, 2),
    );
    fs.mkdirSync(path.join(tmpDir, 'vendor', 'lib'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'vendor', 'lib', 'README.md'), 'sub\n');
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('rejects with explicit error when --files is omitted', () => {
    const result = runSdkQuery('commit-to-subrepo', ['only message, no files'], tmpDir);
    assert.equal(result.exitCode, 0);
    assert.ok(result.json, `expected JSON body, got:\n${result.stdout}`);
    assert.equal(result.json.committed, false);
    assert.equal(result.json.reason, '--files required for commit-to-subrepo',
      'commit-to-subrepo enforces --files at runtime (commit.ts:258)');
  });
});

// ─── Supplementary doc-lint (defense-in-depth) ───────────────────────────────
//
// The behavioral tests above prove the SDK semantics. This lint scans every
// shipped .md invocation to catch regressions in the 50-file workflow cleanup
// landed by this PR — without it, a future contributor adding a new workflow
// could reintroduce the positional form silently. allow-test-rule: doc-text
// invocations cannot be exercised end-to-end (they are agent-prompt strings
// rendered into chat, not invoked by gsd-tools.cjs), so a textual guard is
// the only available enforcement layer.

const SCAN_DIRS = ['agents', 'commands', 'get-shit-done', 'docs', 'scripts'];
const KNOWN_FLAGS = new Set(['--force', '--amend', '--no-verify', '--files']);

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      walk(full, out);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      out.push(full);
    }
  }
  return out;
}

function extractInvocations(filePath) {
  const text = fs.readFileSync(filePath, 'utf-8');
  const lines = text.split(/\r?\n/);
  const invocations = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/(gsd-sdk\s+query\s+commit(?:-to-subrepo)?\b.*)$/);
    if (!m) continue;
    const tail = m[1].match(/^gsd-sdk\s+query\s+commit(?:-to-subrepo)?(.?)/);
    if (tail && tail[1] === '`') continue;
    let cmd = m[1];
    let j = i;
    while (cmd.endsWith('\\') && j + 1 < lines.length) {
      cmd = cmd.slice(0, -1).trimEnd() + ' ' + lines[j + 1].trim();
      j++;
    }
    invocations.push({ line: i + 1, cmd, file: filePath });
  }
  return invocations;
}

function stripTail(cmd) {
  let inSingle = false, inDouble = false;
  for (let i = 0; i < cmd.length; i++) {
    const c = cmd[i];
    if (c === "'" && !inDouble) inSingle = !inSingle;
    else if (c === '"' && !inSingle) inDouble = !inDouble;
    else if (!inSingle && !inDouble) {
      if (c === '#' && (i === 0 || /\s/.test(cmd[i - 1]))) return cmd.slice(0, i);
      if (c === '|' || c === ';' || c === '>' || c === '<') return cmd.slice(0, i);
      if (c === '&' && cmd[i + 1] === '&') return cmd.slice(0, i);
    }
  }
  return cmd;
}

function tokenize(cmd) {
  const out = [];
  let cur = '', inSingle = false, inDouble = false;
  for (let i = 0; i < cmd.length; i++) {
    const c = cmd[i];
    if (c === "'" && !inDouble) { inSingle = !inSingle; cur += c; continue; }
    if (c === '"' && !inSingle) { inDouble = !inDouble; cur += c; continue; }
    if (/\s/.test(c) && !inSingle && !inDouble) {
      if (cur) { out.push(cur); cur = ''; }
      continue;
    }
    cur += c;
  }
  if (cur) out.push(cur);
  return out;
}

function isWellFormed(cmd) {
  const truncated = stripTail(cmd);
  const parts = tokenize(truncated);
  if (parts.length < 3) return true;
  const args = parts.slice(3);
  if (args.length === 0) return true;
  if (args.includes('--files')) return true;
  let sawMessage = false;
  for (const tok of args) {
    if (KNOWN_FLAGS.has(tok)) continue;
    if (!sawMessage) { sawMessage = true; continue; }
    return false;
  }
  return true;
}

describe('bug #2767 (supplementary doc-lint): no positional invocations in shipped .md', () => {
  const allFiles = SCAN_DIRS.flatMap(d => walk(path.join(REPO_ROOT, d)));
  const allInvocations = allFiles.flatMap(extractInvocations);

  test('lint scanned at least one invocation (sanity)', () => {
    assert.ok(allInvocations.length > 0, 'lint scanned 0 invocations — globs are wrong');
  });

  test('every gsd-sdk query commit invocation either uses --files or has no path args', () => {
    const broken = allInvocations.filter(({ cmd }) => !isWellFormed(cmd));
    if (broken.length > 0) {
      const detail = broken.map(({ file, line, cmd }) => {
        const rel = path.relative(REPO_ROOT, file);
        return `  ${rel}:${line}\n    ${cmd}`;
      }).join('\n');
      assert.fail(
        `${broken.length} \`gsd-sdk query commit\` invocation(s) pass paths positionally.\n` +
        `The behavioral test above proves what goes wrong at runtime; this lint catches\n` +
        `regressions in shipped workflow markdown.\n${detail}`
      );
    }
  });
});
