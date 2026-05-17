/**
 * Classify the free-text return body from a dispatched executor subagent into
 * an actionable failure class for the orchestrator's recovery router.
 *
 * Context (#3095): the orchestrator currently treats every non-success agent
 * return as a generic "real failure" except for the Claude Code
 * `classifyHandoffIfNeeded is not defined` runtime bug. Quota / rate-limit
 * terminations look identical to a crashed agent — but the right user
 * response is "wait for reset and resume", not "retry now or abort".
 *
 * Sentinel coverage spans the runtimes GSD supports as executor targets:
 *   - Anthropic / Claude Code  — "usage limit", "rate limit", "quota", "429", "retry-after"
 *   - GitHub Copilot CLI       — "rate limit", "rate_limited", "user_weekly_rate_limited"
 *   - OpenAI Codex CLI         — "429", "usage_limit_reached", "too many requests"
 *   - Google Gemini CLI        — "RESOURCE_EXHAUSTED", "exceeded your", "quota"
 *
 * See docs/research/provider-rate-limit-signals.md for the proactive (header
 * / SDK event) signals the orchestrator could use once the host runtime
 * (Claude Code, Copilot, Codex) exposes them to hooks.
 */

export type AgentFailureClass =
  | 'quota-exceeded'
  | 'classify-handoff-bug'
  | 'unknown-failure';

export interface AgentFailureClassification {
  class: AgentFailureClass;
  /** Lower-cased substring that matched, if any. Useful for log lines. */
  sentinel?: string;
  /** Seconds the runtime asked us to wait, parsed from "retry-after: N". */
  retryAfterSeconds?: number;
}

// Order matters: the first match wins, so list the most specific / most
// actionable sentinels first. "429" beats "too many requests"; "quota" beats
// "RESOURCE_EXHAUSTED" because "quota" is the universal token. All matches
// are case-insensitive (sentinel value below is the lower-cased form).
const QUOTA_SENTINELS: ReadonlyArray<string> = [
  '429',
  'usage_limit_reached',
  'usage limit',
  'rate limit',
  'rate-limited',
  // `rate_limit` (stem) covers `rate_limited`, `rate_limit_error`,
  // `rate_limit_exceeded`, and Copilot's `user_weekly_rate_limited`.
  'rate_limit',
  'resource_exhausted',
  'quota',
  'too many requests',
  'exceeded your',
];

const CLASSIFY_HANDOFF_SENTINEL = 'classifyhandoffifneeded is not defined';

function parseRetryAfter(body: string): number | undefined {
  // Match "retry-after: N" or "Retry-After: N" with optional surrounding
  // punctuation. Captures integer seconds only — HTTP-date form is rare in
  // agent return bodies and not worth the surface area.
  const match = body.match(/\bretry[-_ ]after[:\s]+(\d+)\b/i);
  if (!match) return undefined;
  const seconds = Number.parseInt(match[1]!, 10);
  return Number.isFinite(seconds) ? seconds : undefined;
}

/**
 * Query-handler wrapper for `agent.classify-failure`. Reads the body to
 * classify from the joined positional args (typed via `--`) so workflow
 * shell snippets can pass it as `gsd-sdk query agent.classify-failure -- "$BODY"`.
 */
export async function agentClassifyFailure(
  args: string[],
): Promise<{ data: AgentFailureClassification }> {
  const body = args.join(' ');
  return { data: classifyAgentFailure(body) };
}

export function classifyAgentFailure(body: string): AgentFailureClassification {
  const normalized = body.toLowerCase();

  if (normalized.trim() === '') {
    return { class: 'unknown-failure' };
  }

  // Quota sentinels take precedence over the classifyHandoff runtime bug:
  // a quota-kill that *also* crashed the completion handler is still a quota
  // event, and the recovery path differs (wait vs. spot-check-and-treat-as-OK).
  for (const sentinel of QUOTA_SENTINELS) {
    if (normalized.includes(sentinel)) {
      const retryAfterSeconds = parseRetryAfter(body);
      return retryAfterSeconds === undefined
        ? { class: 'quota-exceeded', sentinel }
        : { class: 'quota-exceeded', sentinel, retryAfterSeconds };
    }
  }

  if (normalized.includes(CLASSIFY_HANDOFF_SENTINEL)) {
    return {
      class: 'classify-handoff-bug',
      sentinel: CLASSIFY_HANDOFF_SENTINEL,
    };
  }

  return { class: 'unknown-failure' };
}
