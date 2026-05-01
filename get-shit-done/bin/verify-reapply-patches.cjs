#!/usr/bin/env node
'use strict';

/**
 * Deterministic verifier for the /gsd-reapply-patches Step 5 "Hunk Verification
 * Gate". For each backed-up patch file, asserts that the user's added lines
 * (computed from a real diff against the pristine baseline, not from the
 * LLM's prose summary) survive into the merged output.
 *
 * Usage:
 *   node scripts/verify-reapply-patches.cjs \
 *     --patches-dir <path>        \  # gsd-local-patches/
 *     --config-dir <path>         \  # ~/.claude (or runtime equivalent)
 *     [--pristine-dir <path>]        # gsd-pristine/; if absent, falls back to
 *                                    # treating every significant backup line as
 *                                    # required (over-broad but safe for #2969:
 *                                    # false-positive halts beat silent successes
 *                                    # on lost content)
 *     [--json]                       # emit JSON report instead of human text
 *
 * Exit codes:
 *   0 — every user-added line is present in the merged file (gate passes)
 *   1 — at least one missing line in at least one file (gate fails)
 *   2 — usage / structural error (e.g. patches dir missing)
 *
 * Bug #2969: the Step 5 gate previously trusted Claude's free-text "verified:
 * yes/no" reporting per hunk. The LLM was filling in `yes` even when content
 * had been silently dropped. Moving the check to a deterministic script is the
 * durability fix.
 */

const fs = require('node:fs');
const path = require('node:path');

const SIGNIFICANT_MIN_CHARS = 12;

function parseArgs(argv) {
  const opts = { patchesDir: null, configDir: null, pristineDir: null, json: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--patches-dir') opts.patchesDir = argv[++i];
    else if (arg === '--config-dir') opts.configDir = argv[++i];
    else if (arg === '--pristine-dir') opts.pristineDir = argv[++i];
    else if (arg === '--json') opts.json = true;
    else if (arg === '--help' || arg === '-h') {
      process.stdout.write(
        'usage: verify-reapply-patches.cjs --patches-dir <path> --config-dir <path> [--pristine-dir <path>] [--json]\n',
      );
      process.exit(0);
    } else {
      process.stderr.write(`unknown argument: ${arg}\n`);
      process.exit(2);
    }
  }
  return opts;
}

function isSignificantLine(line) {
  const trimmed = line.trim();
  if (trimmed.length < SIGNIFICANT_MIN_CHARS) return false;
  // Pure punctuation / closing brackets carry too little structural info to
  // reliably distinguish a survived hunk from incidental similarity.
  if (/^[\s})\];,]+$/.test(trimmed)) return false;
  // Generic decorative comments like `// ----` similarly fail the test.
  if (/^[\s\-=#*/]+$/.test(trimmed)) return false;
  return true;
}

/**
 * Walk a directory, returning every file's path relative to the root.
 */
function walk(rootDir, relPrefix = '') {
  const out = [];
  if (!fs.existsSync(rootDir)) return out;
  for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
    const rel = relPrefix ? path.join(relPrefix, entry.name) : entry.name;
    const abs = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(abs, rel));
    } else if (entry.isFile()) {
      out.push(rel);
    }
  }
  return out;
}

/**
 * Compute the set of "user-added" lines: lines present in the backup but
 * absent from the pristine baseline. If no pristine is provided, falls back
 * to using every significant line in the backup (over-broad but safe — favours
 * false-positive failures over silent successes, which is the right side to
 * err on for #2969).
 */
function computeUserAddedLines(backupContent, pristineContent) {
  const backupLines = backupContent.split(/\r?\n/);
  if (!pristineContent) {
    return backupLines.filter(isSignificantLine);
  }
  const pristineSet = new Set(pristineContent.split(/\r?\n/));
  return backupLines.filter((line) => isSignificantLine(line) && !pristineSet.has(line));
}

/**
 * Stable reason codes for the per-file result. Tests assert via
 * `assert.equal(result.reason, REASON.X)` rather than regex-matching prose,
 * so the diagnostic surface is a typed enum, not free text.
 *
 * Adding a new reason requires updating the REASON map AND the tests'
 * shape assertion that locks the documented set of codes.
 */
const REASON = Object.freeze({
  OK_NO_USER_LINES_VS_PRISTINE: 'ok_no_user_lines_vs_pristine',
  OK_NO_SIGNIFICANT_BACKUP_LINES: 'ok_no_significant_backup_lines',
  FAIL_INSTALLED_MISSING: 'fail_installed_missing',
  FAIL_INSTALLED_NOT_REGULAR_FILE: 'fail_installed_not_regular_file',
  FAIL_READ_ERROR: 'fail_read_error',
  FAIL_USER_LINES_MISSING: 'fail_user_lines_missing',
});

function verifyFile({ relPath, patchesDir, configDir, pristineDir }) {
  const backupPath = path.join(patchesDir, relPath);
  const installedPath = path.join(configDir, relPath);
  const result = { file: relPath, status: 'ok', missing: [], reason: null };

  if (!fs.existsSync(backupPath) || !fs.statSync(backupPath).isFile()) {
    return result; // walked entry no longer exists — non-fatal
  }

  // Installed path checks: must exist, must be a regular file, must be
  // readable. Anything else is a fail-with-diagnostic, not a crash that
  // aborts the whole gate run and drops structured output.
  let installedStat;
  try {
    installedStat = fs.statSync(installedPath);
  } catch {
    result.status = 'fail';
    result.reason = REASON.FAIL_INSTALLED_MISSING;
    return result;
  }
  if (!installedStat.isFile()) {
    result.status = 'fail';
    result.reason = REASON.FAIL_INSTALLED_NOT_REGULAR_FILE;
    return result;
  }

  let backupContent;
  let installedContent;
  try {
    backupContent = fs.readFileSync(backupPath, 'utf8');
    installedContent = fs.readFileSync(installedPath, 'utf8');
  } catch {
    result.status = 'fail';
    result.reason = REASON.FAIL_READ_ERROR;
    return result;
  }

  let pristineContent = null;
  if (pristineDir) {
    const pristinePath = path.join(pristineDir, relPath);
    try {
      const stat = fs.statSync(pristinePath);
      if (stat.isFile()) {
        pristineContent = fs.readFileSync(pristinePath, 'utf8');
      }
    } catch {
      // Pristine missing or unreadable — fall through to over-broad mode.
    }
  }

  const userAdded = computeUserAddedLines(backupContent, pristineContent);
  if (userAdded.length === 0) {
    // Backup and pristine match exactly (or no significant content) — nothing
    // to verify but also nothing to lose. Report as ok with diagnostic code.
    result.reason = pristineContent
      ? REASON.OK_NO_USER_LINES_VS_PRISTINE
      : REASON.OK_NO_SIGNIFICANT_BACKUP_LINES;
    return result;
  }

  for (const line of userAdded) {
    if (!installedContent.includes(line)) {
      result.missing.push(line.trim());
    }
  }
  if (result.missing.length > 0) {
    result.status = 'fail';
    result.reason = REASON.FAIL_USER_LINES_MISSING;
  }
  return result;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.patchesDir || !opts.configDir) {
    process.stderr.write('--patches-dir and --config-dir are required\n');
    process.exit(2);
  }
  if (!fs.existsSync(opts.patchesDir)) {
    process.stderr.write(`patches dir not found: ${opts.patchesDir}\n`);
    process.exit(2);
  }
  if (!fs.existsSync(opts.configDir)) {
    process.stderr.write(`config dir not found: ${opts.configDir}\n`);
    process.exit(2);
  }

  const files = walk(opts.patchesDir).filter((f) => !f.endsWith('backup-meta.json'));
  const results = files.map((relPath) =>
    verifyFile({
      relPath,
      patchesDir: opts.patchesDir,
      configDir: opts.configDir,
      pristineDir: opts.pristineDir,
    }),
  );

  const failures = results.filter((r) => r.status === 'fail');

  if (opts.json) {
    process.stdout.write(JSON.stringify({ checked: results.length, failures: failures.length, results }, null, 2) + '\n');
  } else {
    process.stdout.write(`# Hunk Verification Gate (#2969)\n\n`);
    process.stdout.write(`Checked: ${results.length} file(s)\n`);
    process.stdout.write(`Failures: ${failures.length}\n\n`);
    if (failures.length > 0) {
      process.stdout.write(`## Files with missing user-added content\n\n`);
      for (const r of failures) {
        process.stdout.write(`- ${r.file}\n`);
        if (r.reason) process.stdout.write(`  reason: ${r.reason}\n`);
        for (const line of r.missing.slice(0, 5)) {
          process.stdout.write(`  missing: ${line}\n`);
        }
        if (r.missing.length > 5) {
          process.stdout.write(`  …and ${r.missing.length - 5} more line(s)\n`);
        }
      }
    }
  }

  process.exit(failures.length > 0 ? 1 : 0);
}

if (require.main === module) {
  main();
}

module.exports = { computeUserAddedLines, isSignificantLine, verifyFile, walk, REASON };
