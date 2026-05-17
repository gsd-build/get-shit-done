/**
 * Ship preflight checks (`check.ship-ready`).
 *
 * Consolidates git/gh checks from `ship.md` into a single structured query.
 * All subprocess calls are wrapped in try/catch — never throws on git/gh failures.
 * See `.planning/research/decision-routing-audit.md` §3.9.
 *
 * #3587: every subprocess call uses argv-based execFileSync — never a
 * shell-string execSync. Git branch names are repository-controlled data
 * and can legally contain metacharacters (`;`, `$`, backticks, etc.); a
 * shell-string `git config --get branch.${current_branch}.merge` allowed
 * arbitrary command injection from a malicious branch name. Passing args
 * as argv elements means the shell is never invoked.
 */

import { execFileSync } from 'node:child_process';
import { GSDError, ErrorClassification } from '../errors.js';
import { normalizePhaseName } from './helpers.js';
import { checkVerificationStatus } from './check-verification-status.js';
import type { QueryHandler } from './utils.js';

/**
 * Run a subprocess via argv (NEVER a shell string). Returns trimmed stdout
 * on success or null on any failure (non-zero exit, missing binary, etc.).
 * The pre-#3587 helper used `execSync(cmd, …)` which spawned `/bin/sh -c`
 * and parsed `cmd` as shell syntax — that path is gone.
 */
function runArgvSafe(file: string, args: readonly string[], cwd: string): string | null {
  try {
    return execFileSync(file, args, {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      // #3587: pin no-shell intent explicitly. The default is already
      // false, but spelling it out (a) documents the architectural
      // invariant at the call site and (b) prevents a future options
      // refactor from silently re-enabling shell parsing — e.g. on
      // Windows where `git.cmd` shim resolution can otherwise route
      // through cmd.exe.
      shell: false,
    }).trim();
  } catch {
    return null;
  }
}

function boolArgvSafe(file: string, args: readonly string[], cwd: string): boolean {
  return runArgvSafe(file, args, cwd) !== null;
}

export const checkShipReady: QueryHandler = async (args, projectDir) => {
  const raw = args[0];
  if (!raw) {
    throw new GSDError('phase number required for check ship-ready', ErrorClassification.Validation);
  }

  normalizePhaseName(raw); // validate format

  const blockers: string[] = [];

  // git checks — all wrapped in try/catch via helpers, all argv-based.
  const porcelain = runArgvSafe('git', ['status', '--porcelain'], projectDir);
  const clean_tree = porcelain !== null && porcelain === '';

  const current_branch = runArgvSafe('git', ['rev-parse', '--abbrev-ref', 'HEAD'], projectDir);
  const on_feature_branch =
    current_branch !== null &&
    current_branch !== 'main' &&
    current_branch !== 'master';

  // Determine base branch
  let base_branch: string | null = null;
  if (current_branch) {
    // #3587: branch name passed as a single argv element — git treats it
    // as data, the shell is never invoked, no interpolation possible.
    const mergeRef = runArgvSafe(
      'git',
      ['config', '--get', `branch.${current_branch}.merge`],
      projectDir,
    );
    if (mergeRef) {
      base_branch = mergeRef.replace('refs/heads/', '');
    } else {
      // Fallback: check if 'main' branch exists, else 'master'
      const mainExists = boolArgvSafe('git', ['rev-parse', '--verify', 'main'], projectDir);
      base_branch = mainExists ? 'main' : 'master';
    }
  }

  const remoteOut = runArgvSafe('git', ['remote'], projectDir);
  const remote_configured = remoteOut !== null && remoteOut.trim().length > 0;

  // gh availability — argv as well so a future change that interpolates
  // a user-controlled value into the probe cannot silently introduce a
  // new injection seam.
  const gh_available =
    boolArgvSafe('gh', ['--version'], projectDir) ||
    boolArgvSafe('which', ['gh'], projectDir);

  // gh_authenticated: advisory — skip actual auth check to avoid slow network call
  const gh_authenticated = false;

  // Verification status
  let verification_passed = false;
  try {
    const verRes = await checkVerificationStatus([raw], projectDir);
    const vdata = verRes.data as Record<string, unknown>;
    const status = String(vdata.status ?? '').toLowerCase();
    verification_passed = status === 'pass' || status === 'passed';
  } catch {
    verification_passed = false;
  }

  // Collect blockers
  if (!verification_passed) blockers.push('verification status is not passed');
  if (!clean_tree) blockers.push('working tree is not clean (uncommitted changes)');
  if (!on_feature_branch) blockers.push('not on a feature branch (currently on main/master or unknown)');
  if (!remote_configured) blockers.push('no git remote configured');

  const ready = verification_passed && clean_tree && on_feature_branch && remote_configured;

  return {
    data: {
      ready,
      verification_passed,
      clean_tree,
      on_feature_branch,
      current_branch,
      base_branch,
      remote_configured,
      gh_available,
      gh_authenticated,
      blockers,
    },
  };
};
