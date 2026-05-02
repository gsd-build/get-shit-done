/**
 * Regression tests for #2838: SUMMARY rescue silently fails when .planning/
 * is gitignored.
 *
 * The pre-fix rescue used `git ls-files --modified --others --exclude-standard`
 * to detect uncommitted SUMMARY.md files. When projects gitignore .planning/
 * (a common policy), --exclude-standard filters out the very files the rescue
 * was meant to save, producing an empty result and skipping the rescue branch.
 * The next line `git worktree remove --force` then permanently deleted the
 * SUMMARY.
 *
 * The fix replaces git ls-files with a filesystem-level `find` + `cp` rescue
 * that bypasses gitignore entirely.
 *
 * This test file:
 *   1. Extracts the rescue block from each workflow file (parsed structurally
 *      by locating the labeled comment + closing fence — not free-form regex
 *      over file contents).
 *   2. Runs the extracted block against a real temp repo whose .planning/
 *      directory is gitignored.
 *   3. Asserts the SUMMARY is rescued into the main repo before worktree
 *      removal.
 */

'use strict';

// Migrated to typed-IR (#2974):
//   - The "rescued: yes" text contract is now parsed into a typed
//     { rescued: 'yes' | 'no' | null } record by parseRescueFooter().
//     Tests assert on the parsed key, not on regex against raw content.
//   - The idempotent-rescue test no longer greps stdout/stderr for
//     "Rescued ..." prose. Instead it asserts the filesystem-level
//     invariant: the pre-existing file's mtime is unchanged after the
//     rescue runs (a true no-op on disk).

/**
 * Parse a SUMMARY.md's footer-style key:value lines into a typed record.
 * The rescue script appends `rescued: yes` and similar metadata; tests
 * assert on the parsed values rather than regex-matching the raw content.
 *
 * Returns: { [key: string]: string }. Unknown lines are ignored.
 */
function parseRescueFooter(content) {
  const out = {};
  for (const line of content.split('\n')) {
    const m = line.match(/^([a-z_][\w-]*):\s*(.+?)\s*$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync, spawnSync } = require('child_process');

const REPO_ROOT = path.join(__dirname, '..');
const EXECUTE_PHASE_PATH = path.join(REPO_ROOT, 'get-shit-done', 'workflows', 'execute-phase.md');
const QUICK_PATH = path.join(REPO_ROOT, 'get-shit-done', 'workflows', 'quick.md');

/**
 * Extract the rescue block (the bash lines that detect+rescue the
 * uncommitted SUMMARY.md). We locate it by:
 *   - Finding the line that contains "Safety net" AND "SUMMARY"
 *   - Reading forward until the indent drops back to the surrounding level
 *     OR we hit a blank line followed by a non-comment, non-rescue line.
 *
 * To keep this robust, we scan from the safety-net comment forward until we
 * either reach `done` (new fix) or `fi` (old fix) followed by a blank line.
 */
function extractRescueBlock(filePath) {
  const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
  let startIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/Safety net/.test(lines[i]) && /SUMMARY/.test(lines[i])) {
      startIdx = i;
      break;
    }
  }
  assert.notStrictEqual(startIdx, -1, `Could not find Safety net SUMMARY rescue block in ${filePath}`);

  // Capture from comment through the terminator. The new fix ends with
  // `done < <(find ... )`. The old fix ended with `fi` followed by a blank
  // line. We accumulate until we find one of those terminators; if we see
  // `done < <(find` we always stop there (it can only appear after `fi`).
  const collected = [];
  let sawFi = false;
  for (let i = startIdx; i < lines.length; i++) {
    collected.push(lines[i]);
    const trimmed = lines[i].trim();
    if (/^done\s*<\s*<\(find/.test(trimmed)) return collected.join('\n');
    if (/^fi\s*$/.test(trimmed) && i > startIdx + 3) {
      sawFi = true;
      // Peek next line — if it's blank and the line after is not part of
      // the new-fix `done`, treat fi as terminator (old block).
      const next = (lines[i + 1] || '').trim();
      const next2 = (lines[i + 2] || '').trim();
      const newFixContinues = /^done\s*<\s*<\(find/.test(next) || /^done\s*<\s*<\(find/.test(next2);
      if (!newFixContinues) {
        return collected.join('\n');
      }
    }
  }
  assert.fail(`No terminator found in rescue block of ${filePath}`);
  return collected.join('\n');
}

function sh(cwd, cmd) {
  const r = spawnSync('bash', ['-c', cmd], { cwd, encoding: 'utf-8' });
  if (r.status !== 0) {
    throw new Error(`Command failed (${r.status}): ${cmd}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`);
  }
  return r.stdout;
}

/**
 * Build a temp repo that mirrors the bug repro from issue #2838 and run
 * the rescue block against it. Returns { tmp, wt, summaryFinalPath }.
 */
function runRescueScenario(rescueBlock) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-2838-'));
  const wt = path.join(tmp, 'wt');

  sh(tmp, 'git init -q -b main');
  sh(tmp, 'git config user.email test@example.com && git config user.name test');
  fs.writeFileSync(path.join(tmp, '.gitignore'), '.planning/\n');
  fs.writeFileSync(path.join(tmp, 'README.md'), 'init\n');
  sh(tmp, 'git add .gitignore README.md && git commit -q -m init');

  // Create worktree on a feature branch
  sh(tmp, `git worktree add -q -b sim-executor "${wt}"`);

  // Simulate the executor: untracked SUMMARY.md under gitignored .planning/
  const summaryDir = path.join(wt, '.planning', 'quick', '260429-repro');
  fs.mkdirSync(summaryDir, { recursive: true });
  const summarySrc = path.join(summaryDir, '260429-repro-SUMMARY.md');
  fs.writeFileSync(summarySrc, 'status: complete\nrescued: yes\n');

  // Confirm precondition: --exclude-standard misses the file (this is the bug)
  const ls = sh(tmp, `git -C "${wt}" ls-files --modified --others --exclude-standard -- "*SUMMARY.md" || true`);
  assert.strictEqual(ls.trim(), '', 'Precondition: --exclude-standard must hide gitignored SUMMARY');

  // Run the rescue block. It expects WT, WT_BRANCH to be set, and to be run
  // from the main repo root.
  const script = `
set -u
WT="${wt}"
WT_BRANCH="sim-executor"
cd "${tmp}"
${rescueBlock}
`;
  const r = spawnSync('bash', ['-c', script], { cwd: tmp, encoding: 'utf-8' });
  // Don't fail on non-zero — original block has || true everywhere; we
  // judge by outcome.

  // Now do the worktree removal that would have lost the file
  sh(tmp, `git worktree remove "${wt}" --force`);

  const summaryFinalPath = path.join(tmp, '.planning', 'quick', '260429-repro', '260429-repro-SUMMARY.md');
  return { tmp, summaryFinalPath, rescueOut: r.stdout + r.stderr };
}

function cleanup(tmp) {
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {}
}

describe('bug-2838: SUMMARY rescue handles gitignored .planning/', () => {
  test('execute-phase.md rescue block recovers SUMMARY when .planning/ is gitignored', () => {
    const block = extractRescueBlock(EXECUTE_PHASE_PATH);
    const { tmp, summaryFinalPath, rescueOut } = runRescueScenario(block);
    try {
      assert.ok(
        fs.existsSync(summaryFinalPath),
        `SUMMARY was lost — rescue did not surface the file into main repo.\nRescue output:\n${rescueOut}`
      );
      const content = fs.readFileSync(summaryFinalPath, 'utf-8');
      const footer = parseRescueFooter(content);
      assert.equal(footer.rescued, 'yes',
        `expected typed footer.rescued === 'yes', got ${JSON.stringify(footer)}`);
    } finally {
      cleanup(tmp);
    }
  });

  test('quick.md rescue block recovers SUMMARY when .planning/ is gitignored', () => {
    const block = extractRescueBlock(QUICK_PATH);
    const { tmp, summaryFinalPath, rescueOut } = runRescueScenario(block);
    try {
      assert.ok(
        fs.existsSync(summaryFinalPath),
        `SUMMARY was lost — rescue did not surface the file into main repo.\nRescue output:\n${rescueOut}`
      );
      const content = fs.readFileSync(summaryFinalPath, 'utf-8');
      const footer = parseRescueFooter(content);
      assert.equal(footer.rescued, 'yes',
        `expected typed footer.rescued === 'yes', got ${JSON.stringify(footer)}`);
    } finally {
      cleanup(tmp);
    }
  });

  test('rescue is idempotent when SUMMARY already present in main repo', () => {
    const block = extractRescueBlock(EXECUTE_PHASE_PATH);
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-2838-idem-'));
    const wt = path.join(tmp, 'wt');
    try {
      sh(tmp, 'git init -q -b main');
      sh(tmp, 'git config user.email test@example.com && git config user.name test');
      fs.writeFileSync(path.join(tmp, '.gitignore'), '.planning/\n');
      fs.writeFileSync(path.join(tmp, 'README.md'), 'init\n');
      sh(tmp, 'git add .gitignore README.md && git commit -q -m init');
      sh(tmp, `git worktree add -q -b sim-executor "${wt}"`);

      const dir = path.join(wt, '.planning', 'quick', 'x');
      fs.mkdirSync(dir, { recursive: true });
      const body = 'identical\n';
      fs.writeFileSync(path.join(dir, 'x-SUMMARY.md'), body);

      // Pre-place the same content in main repo
      const mainDir = path.join(tmp, '.planning', 'quick', 'x');
      fs.mkdirSync(mainDir, { recursive: true });
      const mainSummary = path.join(mainDir, 'x-SUMMARY.md');
      fs.writeFileSync(mainSummary, body);
      // Capture a full filesystem snapshot BEFORE the rescue runs.
      // Idempotent contract: when content already matches, the rescue must
      // not touch the file. Migrated from a console-output grep
      // (`stdout+stderr` did not contain "Rescued") to a typed on-disk
      // check. mtimeMs alone is insufficient on coarse-grained filesystems
      // (HFS+, FAT) where two rewrites within ~1s share an mtime — CR
      // outside-diff finding (#3016). Snapshot includes mtime, ctime,
      // size, ino, and a sha256 of contents so a rewrite is detectable
      // even when the timestamp aliases.
      const crypto = require('crypto');
      const snapshotFile = (p) => {
        const st = fs.statSync(p);
        const hash = crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
        return { mtimeMs: st.mtimeMs, ctimeMs: st.ctimeMs, size: st.size, ino: st.ino, hash };
      };
      const snapBefore = snapshotFile(mainSummary);

      const script = `
set -u
WT="${wt}"
WT_BRANCH="sim-executor"
cd "${tmp}"
${block}
`;
      const r = spawnSync('bash', ['-c', script], { cwd: tmp, encoding: 'utf-8' });
      assert.strictEqual(
        r.status,
        0,
        `Rescue block failed unexpectedly.\nstdout: ${r.stdout}\nstderr: ${r.stderr}`
      );
      // Typed-IR idempotency check (#2974): full snapshot unchanged. The
      // sha256 hash catches rewrites that mtimeMs would miss on
      // coarse-grained filesystems.
      const snapAfter = snapshotFile(mainSummary);
      assert.deepStrictEqual(snapAfter, snapBefore,
        'rescue must not touch the file when content already matches (idempotent)');
      assert.strictEqual(fs.readFileSync(mainSummary, 'utf-8'), body);
    } finally {
      try { sh(tmp, `git worktree remove "${wt}" --force`); } catch (_) {}
      cleanup(tmp);
    }
  });
});
