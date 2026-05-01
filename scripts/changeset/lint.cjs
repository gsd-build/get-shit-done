#!/usr/bin/env node
'use strict';

/**
 * Changeset-fragment lint (#2975).
 *
 * Pure verdict function evaluateLint({ changedFiles, labels }) returns
 * { ok, reason } using the LINT_REASON enum. The CLI wrapper calls it with
 * the PR diff (via `git diff --name-only origin/main...HEAD` or the GitHub
 * Actions event payload) and the labels list (via the GitHub event).
 *
 * Tests assert on the typed verdict, never on free text.
 */

const LINT_REASON = Object.freeze({
  OK_FRAGMENT_PRESENT: 'ok_fragment_present',
  OK_OPT_OUT_LABEL: 'ok_opt_out_label',
  OK_NO_USER_FACING_CHANGES: 'ok_no_user_facing_changes',
  FAIL_MISSING_FRAGMENT: 'fail_missing_fragment',
});

const OPT_OUT_LABEL = 'no-changelog';

// Files counted as "user-facing" — touching any of these requires either a
// fragment or an explicit opt-out label. Test/CI/docs/lock files do not.
const USER_FACING_PREFIXES = [
  'bin/',
  'get-shit-done/',
  'agents/',
  'commands/',
  'hooks/',
  'sdk/src/',
  'sdk/prompts/',
];

// Exact-match user-facing files. Any direct edit to one of these without a
// fragment also fails the lint — closes the bypass where a contributor edits
// CHANGELOG.md directly to sneak past the new workflow.
const USER_FACING_FILES = new Set(['CHANGELOG.md']);

function isUserFacing(file) {
  if (USER_FACING_FILES.has(file)) return true;
  return USER_FACING_PREFIXES.some((p) => file.startsWith(p));
}

function isFragment(file) {
  return /^\.changeset\/[^/]+\.md$/.test(file) && !file.endsWith('/README.md');
}

function evaluateLint({ changedFiles, labels }) {
  if (changedFiles.some(isFragment)) {
    return { ok: true, reason: LINT_REASON.OK_FRAGMENT_PRESENT };
  }
  if (labels.includes(OPT_OUT_LABEL)) {
    return { ok: true, reason: LINT_REASON.OK_OPT_OUT_LABEL };
  }
  if (!changedFiles.some(isUserFacing)) {
    return { ok: true, reason: LINT_REASON.OK_NO_USER_FACING_CHANGES };
  }
  return { ok: false, reason: LINT_REASON.FAIL_MISSING_FRAGMENT };
}

function main() {
  const fs = require('node:fs');
  const cp = require('node:child_process');
  // GitHub Actions event payload path
  const eventPath = process.env.GITHUB_EVENT_PATH;
  let labels = [];
  if (eventPath && fs.existsSync(eventPath)) {
    try {
      const event = JSON.parse(fs.readFileSync(eventPath, 'utf8'));
      labels = (event.pull_request?.labels || []).map((l) => l.name);
    } catch { /* fall through */ }
  }
  const base = process.env.GITHUB_BASE_REF || 'main';
  let changedFiles = [];
  try {
    // Use execFileSync with an argv array — the base ref is interpolated
    // into a refspec argument, but execFileSync does not invoke a shell, so
    // even a malicious GITHUB_BASE_REF cannot inject shell syntax. The
    // refspec-bound metacharacters that git itself rejects (e.g. spaces in
    // ref names) are caught by git's own arg parser.
    const out = cp.execFileSync(
      'git',
      ['diff', '--name-only', `origin/${base}...HEAD`],
      { encoding: 'utf8' },
    );
    changedFiles = out.split('\n').filter(Boolean);
  } catch (e) {
    process.stderr.write(`could not compute diff: ${e.message}\n`);
    process.exit(2);
  }

  const verdict = evaluateLint({ changedFiles, labels });
  if (process.argv.includes('--json')) {
    process.stdout.write(JSON.stringify({ ...verdict, changedFiles, labels }, null, 2) + '\n');
  } else if (verdict.ok) {
    process.stdout.write(`ok changeset-lint: ${verdict.reason}\n`);
  } else {
    process.stderr.write(`\nERROR changeset-lint: ${verdict.reason}\n`);
    process.stderr.write(`PR touches user-facing files but does not include a .changeset/*.md fragment.\n`);
    process.stderr.write(`Run \`npm run changeset\` to create one, or add the \`${OPT_OUT_LABEL}\` label\n`);
    process.stderr.write(`if this PR genuinely has no user-facing impact (test refactor, CI tweak, etc.).\n`);
  }
  process.exit(verdict.ok ? 0 : 1);
}

if (require.main === module) main();

module.exports = { evaluateLint, LINT_REASON, OPT_OUT_LABEL, isUserFacing, isFragment };
