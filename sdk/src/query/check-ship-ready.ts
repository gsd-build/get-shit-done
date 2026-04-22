/**
 * Ship preflight checks (`check.ship-ready`).
 *
 * Consolidates git/gh checks from `ship.md` into a single structured query.
 * All subprocess calls are wrapped in try/catch — never throws on git/gh failures.
 * See `.planning/research/decision-routing-audit.md` §3.9.
 */

import { execSync } from 'node:child_process';
import { GSDError, ErrorClassification } from '../errors.js';
import { normalizePhaseName } from './helpers.js';
import { checkVerificationStatus } from './check-verification-status.js';
import type { QueryHandler } from './utils.js';

function runSyncSafe(cmd: string, cwd: string): string | null {
  try {
    return execSync(cmd, { cwd, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return null;
  }
}

function boolSyncSafe(cmd: string, cwd: string): boolean {
  return runSyncSafe(cmd, cwd) !== null;
}

export const checkShipReady: QueryHandler = async (args, projectDir) => {
  const raw = args[0];
  if (!raw) {
    throw new GSDError('phase number required for check ship-ready', ErrorClassification.Validation);
  }

  normalizePhaseName(raw); // validate format

  const blockers: string[] = [];

  // git checks — all wrapped in try/catch via helpers
  const porcelain = runSyncSafe('git status --porcelain', projectDir);
  const clean_tree = porcelain !== null && porcelain === '';

  const current_branch = runSyncSafe('git rev-parse --abbrev-ref HEAD', projectDir);
  const on_feature_branch =
    current_branch !== null &&
    current_branch !== 'main' &&
    current_branch !== 'master';

  // Determine base branch
  let base_branch: string | null = null;
  if (current_branch) {
    const mergeRef = runSyncSafe(`git config --get branch.${current_branch}.merge`, projectDir);
    if (mergeRef) {
      base_branch = mergeRef.replace('refs/heads/', '');
    } else {
      // Fallback: check if 'main' branch exists, else 'master'
      const mainExists = boolSyncSafe('git rev-parse --verify main', projectDir);
      base_branch = mainExists ? 'main' : 'master';
    }
  }

  const remoteOut = runSyncSafe('git remote', projectDir);
  const remote_configured = remoteOut !== null && remoteOut.trim().length > 0;

  // gh availability
  const gh_available =
    boolSyncSafe('gh --version', projectDir) ||
    boolSyncSafe('which gh', projectDir);

  // gh_authenticated: advisory — skip actual auth check to avoid slow network call
  const gh_authenticated = false;

  // Verification status
  let verification_passed = false;
  try {
    const verRes = await checkVerificationStatus([raw], projectDir);
    const vdata = verRes.data as Record<string, unknown>;
    verification_passed = vdata.status !== 'fail';
  } catch {
    verification_passed = false;
  }

  // Collect blockers
  if (!verification_passed) blockers.push('verification status is fail or missing');
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
