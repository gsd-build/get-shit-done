/**
 * Unit tests for `classifyAgentFailure` (#3095 — execute-phase quota-kill classification).
 *
 * The orchestrator dispatches executor subagents and receives a free-text return body
 * when an agent finishes or fails. Today the body is parsed only for the
 * `classifyHandoffIfNeeded is not defined` Claude Code runtime bug (treated as
 * possible-success), and everything else falls through to a generic
 * "real failure" branch. Quota / rate-limit terminations look identical to a
 * crashed agent to the orchestrator, so the recovery prompt is wrong
 * (offers "retry now" when the right action is "wait and resume").
 *
 * This classifier returns a structured class plus the matched sentinel so the
 * workflow can route to a quota-distinct recovery prompt.
 */

import { describe, it, expect } from 'vitest';
import { classifyAgentFailure } from './agent-failure-classifier.js';

describe('classifyAgentFailure', () => {
  describe('quota-exceeded class', () => {
    it('matches the exact org-monthly-limit message from the #3095 report', () => {
      const body = "You've hit your org's monthly usage limit";
      const result = classifyAgentFailure(body);
      expect(result.class).toBe('quota-exceeded');
      expect(result.sentinel).toBe('usage limit');
    });

    it('matches "rate limit" sentinel', () => {
      const result = classifyAgentFailure('Anthropic API rate limit hit; retry later.');
      expect(result.class).toBe('quota-exceeded');
      expect(result.sentinel).toBe('rate limit');
    });

    it('matches "quota" sentinel', () => {
      const result = classifyAgentFailure('Your monthly quota has been exhausted.');
      expect(result.class).toBe('quota-exceeded');
      expect(result.sentinel).toBe('quota');
    });

    it('matches HTTP 429 sentinel', () => {
      const result = classifyAgentFailure('Request failed: HTTP 429 Too Many Requests');
      expect(result.class).toBe('quota-exceeded');
      // 429 wins over the secondary "too many requests" tag (more specific).
      expect(result.sentinel).toBe('429');
    });

    it('matches "too many requests" when 429 not present (Codex/OpenAI variant)', () => {
      const result = classifyAgentFailure('Too Many Requests — please retry later');
      expect(result.class).toBe('quota-exceeded');
      expect(result.sentinel).toBe('too many requests');
    });

    it('matches "usage_limit_reached" (Codex CLI sentinel)', () => {
      const result = classifyAgentFailure('agent failed: usage_limit_reached');
      expect(result.class).toBe('quota-exceeded');
      expect(result.sentinel).toBe('usage_limit_reached');
    });

    it('matches "RESOURCE_EXHAUSTED" (Gemini CLI sentinel)', () => {
      const result = classifyAgentFailure(
        'Error: RESOURCE_EXHAUSTED — You exceeded your current quota',
      );
      expect(result.class).toBe('quota-exceeded');
      // First-match precedence per SENTINEL_ORDER — quota wins here.
      expect(['quota', 'resource_exhausted']).toContain(result.sentinel);
    });

    it('matches "user_weekly_rate_limited" (Copilot CLI sentinel)', () => {
      const result = classifyAgentFailure('Server Error: user_weekly_rate_limited');
      expect(result.class).toBe('quota-exceeded');
      // The high-priority "rate limit" tag also appears as a substring here;
      // either is acceptable as long as classification is quota-exceeded.
      expect(result.sentinel).toBeDefined();
    });

    it('matches "exceeded your" generic quota phrasing (OpenAI / Gemini)', () => {
      const result = classifyAgentFailure(
        "You exceeded your current quota, please check your plan and billing details.",
      );
      expect(result.class).toBe('quota-exceeded');
    });

    it('matches case-insensitively', () => {
      const result = classifyAgentFailure('USAGE LIMIT REACHED');
      expect(result.class).toBe('quota-exceeded');
      expect(result.sentinel).toBe('usage limit');
    });

    it('extracts retry-after seconds when present in the body', () => {
      const body = 'rate_limit_error: retry-after: 3600';
      const result = classifyAgentFailure(body);
      expect(result.class).toBe('quota-exceeded');
      expect(result.retryAfterSeconds).toBe(3600);
    });

    it('extracts retry-after seconds from header-style header value', () => {
      // Some runtimes echo the raw Retry-After header value.
      const body = 'Failed: 429 Too Many Requests (Retry-After: 60)';
      const result = classifyAgentFailure(body);
      expect(result.class).toBe('quota-exceeded');
      expect(result.retryAfterSeconds).toBe(60);
    });

    it('does not parse retry-after when token is embedded in another word', () => {
      const body = 'noretry-after: 3600 quota exceeded';
      const result = classifyAgentFailure(body);
      expect(result.class).toBe('quota-exceeded');
      expect(result.retryAfterSeconds).toBeUndefined();
    });

    it('returns undefined retryAfterSeconds when no hint present', () => {
      const result = classifyAgentFailure("You've hit your org's monthly usage limit");
      expect(result.class).toBe('quota-exceeded');
      expect(result.retryAfterSeconds).toBeUndefined();
    });
  });

  describe('classify-handoff-bug class', () => {
    it('preserves the existing classifyHandoffIfNeeded pass-through', () => {
      // Keep the existing Claude Code runtime bug path callable through the
      // same classifier so step 7 has a single dispatch point.
      const body = 'ReferenceError: classifyHandoffIfNeeded is not defined';
      const result = classifyAgentFailure(body);
      expect(result.class).toBe('classify-handoff-bug');
      expect(result.sentinel).toBe('classifyhandoffifneeded is not defined');
    });
  });

  describe('unknown-failure class (fallback)', () => {
    it('returns unknown-failure for a generic crash', () => {
      const result = classifyAgentFailure('Error: something blew up');
      expect(result.class).toBe('unknown-failure');
      expect(result.sentinel).toBeUndefined();
    });

    it('returns unknown-failure for empty input', () => {
      const result = classifyAgentFailure('');
      expect(result.class).toBe('unknown-failure');
    });

    it('returns unknown-failure for whitespace-only input', () => {
      const result = classifyAgentFailure('   \n\t  ');
      expect(result.class).toBe('unknown-failure');
    });
  });

  describe('precedence', () => {
    it('quota sentinel wins over classify-handoff sentinel when both present', () => {
      // The runtime bug is a post-completion handler crash; if the underlying
      // cause was quota, that is the actionable signal — surface it.
      const body =
        "You've hit your org's monthly usage limit\nReferenceError: classifyHandoffIfNeeded is not defined";
      const result = classifyAgentFailure(body);
      expect(result.class).toBe('quota-exceeded');
    });
  });
});
