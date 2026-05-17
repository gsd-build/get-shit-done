#!/usr/bin/env node
/**
 * Copy GSD hooks to dist for installation.
 * Validates JavaScript syntax before copying to prevent shipping broken hooks.
 * See #1107, #1109, #1125, #1161 — a duplicate const declaration shipped
 * in dist and caused PostToolUse hook errors for all users.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HOOKS_DIR = path.join(__dirname, '..', 'hooks');
const DIST_DIR = path.join(HOOKS_DIR, 'dist');
// Per-process staging directory for atomic writes. Using process.pid in the
// name eliminates all contention between concurrent builders: each process
// owns its own staging dir and never races with another builder's cleanup.
// Lives under hooks/ so it shares a filesystem with DIST_DIR (POSIX
// rename(2) is only atomic within the same filesystem) but is NOT inside
// DIST_DIR — so readers that readdirSync(DIST_DIR) (e.g. bin/install.js,
// install-hooks-copy tests) never observe a transient ".tmp" sibling.
// The parent pattern hooks/.dist-staging-*/ is gitignored.
const STAGE_DIR = path.join(HOOKS_DIR, `.dist-staging-${process.pid}`);

// Hooks to copy (pure Node.js, no bundling needed)
const HOOKS_TO_COPY = [
  'gsd-check-update-worker.js',
  'gsd-check-update.js',
  'gsd-context-monitor.js',
  'gsd-prompt-guard.js',
  'gsd-read-guard.js',
  'gsd-read-injection-scanner.js',
  'gsd-statusline.js',
  'gsd-update-banner.js',
  'gsd-workflow-guard.js',
  // Community hooks (bash, opt-in via .planning/config.json hooks.community)
  'gsd-session-state.sh',
  'gsd-validate-commit.sh',
  'gsd-phase-boundary.sh',
  // Graphify auto-update hook (#3347 / PR #3557 / #3579). Opt-in via
  // .planning/config.json graphify.auto_update; off by default.
  'gsd-graphify-update.sh'
];

// Subdirectories under hooks/ whose contents must also ship to dist. Each
// entry is copied as `hooks/<dir>/*` → `hooks/dist/<dir>/*` so detached
// helpers (e.g. hooks/lib/gsd-graphify-rebuild.sh) resolve from the hook's
// installed runtime path. See #3579.
const HOOKS_SUBDIRS_TO_COPY = ['lib'];

// Sync millisecond sleep using Atomics.wait on a throwaway SharedArrayBuffer.
// Used between Windows rename retries; this script is sync end-to-end so
// setTimeout would not work. Total worst-case backoff across MAX_ATTEMPTS
// is bounded (~400ms) — acceptable for a one-shot build script.
function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * Atomic-replace via fs.renameSync, with Windows-only retry and fallback.
 *
 * POSIX rename(2) atomically replaces dest even when readers hold open
 * handles on it. Windows MoveFileEx (which fs.renameSync uses with
 * MOVEFILE_REPLACE_EXISTING) cannot — it throws EPERM/EBUSY when another
 * process has the destination open. Concurrent install.js readers and
 * antivirus scanners are the realistic triggers; both release handles
 * within milliseconds, so a short backoff resolves the race. After
 * retries are exhausted, fall back to copy-then-unlink (re-introduces
 * the truncate-then-write race for this single file but keeps the build
 * moving rather than crashing). If even copy fails because dest is hard-
 * locked, log a non-fatal warning and leave the prior dest in place — a
 * subsequent build invocation will retry from a fresh state.
 */
function renameAtomicWithRetry(stagedDest, dest, hook) {
  if (process.platform !== 'win32') {
    fs.renameSync(stagedDest, dest);
    return;
  }
  const BACKOFFS_MS = [10, 30, 90, 270];
  for (let attempt = 0; attempt <= BACKOFFS_MS.length; attempt++) {
    try {
      fs.renameSync(stagedDest, dest);
      return;
    } catch (e) {
      const transient = e && (e.code === 'EPERM' || e.code === 'EBUSY');
      if (!transient) throw e;
      if (attempt < BACKOFFS_MS.length) {
        sleepSync(BACKOFFS_MS[attempt]);
        continue;
      }
      // Retries exhausted; fall back to copy-then-unlink.
      try {
        fs.copyFileSync(stagedDest, dest);
        try { fs.unlinkSync(stagedDest); } catch (_) { /* tolerate */ }
        console.warn(`\x1b[33m! ${hook}: rename failed (${e.code}) after ${BACKOFFS_MS.length} retries; used copy-fallback\x1b[0m`);
        return;
      } catch (fallbackErr) {
        try { fs.unlinkSync(stagedDest); } catch (_) { /* tolerate */ }
        console.warn(`\x1b[33m! ${hook}: rename + copy fallback both failed (${e.code} → ${fallbackErr.code || fallbackErr.message}); leaving prior dest in place\x1b[0m`);
        return;
      }
    }
  }
}

/**
 * Validate JavaScript syntax without executing the file.
 * Catches SyntaxError (duplicate const, missing brackets, etc.)
 * before the hook gets shipped to users.
 */
function validateSyntax(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  try {
    // Use vm.compileFunction to check syntax without executing
    new vm.Script(content, { filename: path.basename(filePath) });
    return null; // No error
  } catch (e) {
    if (e instanceof SyntaxError) {
      return e.message;
    }
    throw e;
  }
}

function build() {
  // Ensure dist and staging directories exist (staging is a sibling of dist
  // used to make writes atomic — see STAGE_DIR comment above).
  if (!fs.existsSync(DIST_DIR)) {
    fs.mkdirSync(DIST_DIR, { recursive: true });
  }
  if (!fs.existsSync(STAGE_DIR)) {
    fs.mkdirSync(STAGE_DIR, { recursive: true });
  }

  let hasErrors = false;

  // Copy hooks to dist with syntax validation
  for (const hook of HOOKS_TO_COPY) {
    const src = path.join(HOOKS_DIR, hook);
    const dest = path.join(DIST_DIR, hook);

    if (!fs.existsSync(src)) {
      console.warn(`Warning: ${hook} not found, skipping`);
      continue;
    }

    // Validate JS syntax before copying (.sh files skip — not Node.js)
    if (hook.endsWith('.js')) {
      const syntaxError = validateSyntax(src);
      if (syntaxError) {
        console.error(`\x1b[31m✗ ${hook}: SyntaxError — ${syntaxError}\x1b[0m`);
        hasErrors = true;
        continue;
      }
    }

    console.log(`\x1b[32m✓\x1b[0m Copying ${hook}...`);
    // Atomic write: copy to a per-process staging file in the per-PID sibling
    // STAGE_DIR (same filesystem as DIST_DIR so rename(2) is atomic), then
    // rename into place. Multiple test files invoke this script concurrently
    // from their before() hooks; fs.copyFileSync truncates then writes the
    // destination — readers (install.js subprocesses spawned by parallel
    // install tests) can observe the dest empty or partial mid-write,
    // producing flaky failures such as bug-2136 part 4 where installed .sh
    // hooks lacked their "# gsd-hook-version:" header. POSIX rename(2)
    // makes the swap atomic so readers see either the old file or the new
    // file. The staging file lives outside DIST_DIR so readdirSync(DIST_DIR)
    // (in install.js and tests) never observes a transient ".tmp" sibling.
    // Each process uses its own STAGE_DIR (keyed by PID) so concurrent
    // builders never race on staging-dir creation or cleanup.
    const stagedDest = path.join(STAGE_DIR, `${hook}.${Date.now()}`);
    fs.copyFileSync(src, stagedDest);
    // Preserve executable bit for shell scripts before rename so the
    // installed file is executable from the very first observation.
    if (hook.endsWith('.sh')) {
      try { fs.chmodSync(stagedDest, 0o755); } catch (e) { /* Windows */ }
    }
    renameAtomicWithRetry(stagedDest, dest, hook);
  }

  // Copy whitelisted hook subdirectories (e.g. hooks/lib/) into dist so the
  // installer's readdir-and-isFile loop in bin/install.js sees them and
  // detached hook helpers resolve from the installed runtime path (#3579).
  for (const subdir of HOOKS_SUBDIRS_TO_COPY) {
    const srcDir = path.join(HOOKS_DIR, subdir);
    if (!fs.existsSync(srcDir)) continue;
    const destDir = path.join(DIST_DIR, subdir);
    fs.mkdirSync(destDir, { recursive: true });
    const entries = fs.readdirSync(srcDir, { withFileTypes: true });
    for (const ent of entries) {
      if (!ent.isFile()) continue;
      const srcFile = path.join(srcDir, ent.name);
      const destFile = path.join(destDir, ent.name);
      if (ent.name.endsWith('.js')) {
        const syntaxError = validateSyntax(srcFile);
        if (syntaxError) {
          console.error(`\x1b[31m✗ ${subdir}/${ent.name}: SyntaxError — ${syntaxError}\x1b[0m`);
          hasErrors = true;
          continue;
        }
      }
      console.log(`\x1b[32m✓\x1b[0m Copying ${subdir}/${ent.name}...`);
      const stagedDest = path.join(STAGE_DIR, `${subdir}__${ent.name}.${Date.now()}`);
      fs.copyFileSync(srcFile, stagedDest);
      if (ent.name.endsWith('.sh')) {
        try { fs.chmodSync(stagedDest, 0o755); } catch (e) { /* Windows */ }
      }
      renameAtomicWithRetry(stagedDest, destFile, `${subdir}/${ent.name}`);
    }
  }

  // Best-effort cleanup of this process's own staging dir. Since STAGE_DIR
  // is per-PID (`.dist-staging-<pid>/`), no other builder touches it — so
  // rmSync with recursive:true is safe and leaves no race window.
  try {
    fs.rmSync(STAGE_DIR, { recursive: true, force: true });
  } catch (e) { /* tolerate ENOENT if the dir was never created (e.g. all hooks skipped) */ }

  if (hasErrors) {
    console.error('\n\x1b[31mBuild failed: fix syntax errors above before publishing.\x1b[0m');
    process.exit(1);
  }

  console.log('\nBuild complete.');
}

build();
