/**
 * `dispatch.commit-since` query handler — read-only progress probe used by
 * orchestrators to detect stalls during subagent dispatch.
 *
 * Background (issue #3212): the `/gsd-execute-phase` orchestrator awaits
 * `Agent()` returns synchronously and has no progress-during-dispatch
 * monitor. The hard `workflow.subagent_timeout` is a wall-clock kill switch
 * that fires AFTER the timeout window — it does not detect *stalls within
 * the window*. Surveillance complements timeout: it answers "have any new
 * commits landed since timestamp T?" so workflows can poll on a cadence
 * and surface a warning before reaching the hard timeout.
 *
 * The handler is deliberately **stateless and additive**:
 * - No config key reads (orchestrators pass the threshold inline as argv).
 * - No file writes.
 * - No git mutations — only `git log` reads.
 * - Returns `{ count: 0, ... }` on any failure mode (no git repo,
 *   timestamp parse error, git not on PATH) so polling loops never raise.
 *
 * @example
 * ```bash
 * # In an orchestrator polling loop:
 * SINCE=$(date +%s)
 * # ... dispatch agent ...
 * # ... after wait interval ...
 * gsd-sdk query dispatch.commit-since --since $SINCE
 * # → { count: 2, latest_hash: "abc1234", latest_timestamp_unix: 1714942839, ... }
 * ```
 */

import { execFileSync } from 'node:child_process';
import { GSDError, ErrorClassification } from '../errors.js';
import type { QueryHandler } from './utils.js';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface DispatchCommitSinceResult {
  /** Count of commits with `committer date >= since` on any ref. */
  count: number;
  /** Short hash of the most recent commit, or null if none. */
  latest_hash: string | null;
  /** Subject of the most recent commit, or null. */
  latest_subject: string | null;
  /** Committer Unix epoch of the most recent commit, or null. */
  latest_timestamp_unix: number | null;
  /** Echoed `--since` value (Unix epoch seconds). */
  since_unix: number;
  /** Optional plan id filter that was applied. */
  plan_filter: string | null;
}

// ─── argv parsing ───────────────────────────────────────────────────────────

interface ParsedArgs {
  sinceUnix: number;
  planFilter: string | null;
}

function parseFlagArgs(args: string[]): ParsedArgs {
  const sinceIdx = args.indexOf('--since');
  if (sinceIdx === -1) {
    throw new GSDError(
      'dispatch.commit-since requires --since <unix-epoch-seconds>',
      ErrorClassification.Validation,
    );
  }
  const raw = args[sinceIdx + 1];
  if (!raw || raw.startsWith('--')) {
    throw new GSDError(
      'dispatch.commit-since: --since requires a numeric value',
      ErrorClassification.Validation,
    );
  }
  const sinceUnix = Number(raw);
  if (!Number.isFinite(sinceUnix) || sinceUnix < 0) {
    throw new GSDError(
      `dispatch.commit-since: --since must be a non-negative Unix epoch (got ${raw})`,
      ErrorClassification.Validation,
    );
  }
  // Optional `--plan <id>` filter — when set, only commits whose subject
  // contains `(<id>)` are counted. Useful for "did THIS plan stall?"
  // queries during a multi-plan wave.
  const planIdx = args.indexOf('--plan');
  let planFilter: string | null = null;
  if (planIdx !== -1) {
    const v = args[planIdx + 1];
    if (!v || v.startsWith('--')) {
      throw new GSDError(
        'dispatch.commit-since: --plan requires a value',
        ErrorClassification.Validation,
      );
    }
    planFilter = v;
  }
  return { sinceUnix, planFilter };
}

// ─── handler ────────────────────────────────────────────────────────────────

/**
 * Best-effort git probe. Returns empty/null on any failure so callers can
 * treat "no commits" and "no git" identically.
 */
function probeGit(cwd: string, sinceUnix: number, planFilter: string | null): {
  commits: string[]; latestSubject: string | null; latestUnix: number | null
} {
  // Format: `<short-hash> <unix-timestamp> <subject>` per commit. Using `%ct`
  // (committer date) so it matches what wall-clock-based stall detection
  // expects. Author date is intentionally NOT used (it can be far in the
  // past for cherry-picked / rebased commits).
  const args = [
    'log', '--all',
    `--max-age=${sinceUnix}`,  // Unix epoch lower-bound; --since=@N is unreliable across git versions on Windows
    '--pretty=format:%h %ct %s',
  ];
  if (planFilter) {
    args.push('-F', `--grep=(${planFilter})`);
  }
  let stdout: string;
  try {
    stdout = execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 5000,
    });
  } catch {
    return { commits: [], latestSubject: null, latestUnix: null };
  }
  const lines = stdout.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length === 0) {
    return { commits: [], latestSubject: null, latestUnix: null };
  }
  // git log returns newest-first; the first line is the latest commit.
  const latest = lines[0];
  const firstSpace = latest.indexOf(' ');
  const secondSpace = firstSpace === -1 ? -1 : latest.indexOf(' ', firstSpace + 1);
  let latestSubject: string | null = null;
  let latestUnix: number | null = null;
  if (firstSpace !== -1 && secondSpace !== -1) {
    const tsStr = latest.slice(firstSpace + 1, secondSpace);
    const n = Number(tsStr);
    latestUnix = Number.isFinite(n) ? n : null;
    latestSubject = latest.slice(secondSpace + 1);
  }
  return { commits: lines, latestSubject, latestUnix };
}

/**
 * Query handler implementing `dispatch.commit-since`.
 *
 * @param args argv tail. Must contain `--since <unix-epoch-seconds>`. May
 *             contain `--plan <id>` to filter to commits matching a single
 *             plan's subject scope.
 * @param projectDir Project root resolved by the dispatcher. The git probe
 *                   runs in this directory.
 * @returns `{ data: DispatchCommitSinceResult }` — never throws for git
 *          failures; only throws `GSDError(Validation)` for malformed argv.
 */
export const dispatchCommitSince: QueryHandler<DispatchCommitSinceResult> = async (args, projectDir) => {
  const { sinceUnix, planFilter } = parseFlagArgs(args);

  const probe = probeGit(projectDir, sinceUnix, planFilter);
  const latest = probe.commits[0] ?? null;
  let latest_hash: string | null = null;
  if (latest) {
    const sp = latest.indexOf(' ');
    if (sp > 0) latest_hash = latest.slice(0, sp);
  }

  return {
    data: {
      count: probe.commits.length,
      latest_hash,
      latest_subject: probe.latestSubject,
      latest_timestamp_unix: probe.latestUnix,
      since_unix: sinceUnix,
      plan_filter: planFilter,
    },
  };
};
