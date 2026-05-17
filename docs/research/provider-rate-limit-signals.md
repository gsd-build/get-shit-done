# Provider rate-limit signals across executor runtimes

**Status:** research note — informs #3095 reactive classification and points at the proactive path forward.

GSD dispatches executor subagents into one of four host runtimes today: Claude Code, GitHub Copilot CLI, OpenAI Codex CLI, and Google Gemini CLI. Each provider exposes rate-limit information at three different layers — pre-warning, post-mortem error body, and underlying HTTP transport — but the *host runtime* (the CLI that wraps the provider for us) gates how much of that surfaces to GSD's orchestrator.

The reactive classifier shipped with #3095 (`agent.classify-failure`) parses post-mortem error bodies. This note records the proactive signals that exist at the provider layer but are not yet surfaced to orchestrators by the host runtimes — i.e. the forward path once host runtimes expose them to hooks.

## Anthropic / Claude Code

| Layer        | Signal                                                                                            | Available to GSD today?                                  |
|--------------|---------------------------------------------------------------------------------------------------|----------------------------------------------------------|
| HTTP headers | `anthropic-ratelimit-requests-remaining`, `anthropic-ratelimit-tokens-remaining`, `retry-after` on 429 | No — Claude Code does not forward these to hooks ([#33820](https://github.com/anthropics/claude-code/issues/33820), [#22407](https://github.com/anthropics/claude-code/issues/22407)) |
| Agent SDK    | `RateLimitEvent` with `status` transitions: `allowed` → `allowed_warning` → `rejected`            | Only when callers use the Agent SDK directly             |
| Plan usage   | Max plan session / weekly usage                                                                   | No — Claude Code SDK does not expose Max-plan limits ([#32796](https://github.com/anthropics/claude-code/issues/32796)) |
| Error body   | `"You've hit your org's monthly usage limit"`, `429`, `rate_limit_error`                          | Yes — parsed by `agent.classify-failure`                 |

## GitHub Copilot CLI

| Layer        | Signal                                                                                                  | Available to GSD today? |
|--------------|---------------------------------------------------------------------------------------------------------|-------------------------|
| Pre-warning  | CLI displays a warning when approaching a limit (per [GitHub Copilot usage-limits docs](https://docs.github.com/en/copilot/concepts/usage-limits)) | Visible in subprocess stdout, not as a structured signal |
| Error body   | `"hit a rate limit"`, `"exceeded your Copilot token usage"`, `rate_limited`, `user_weekly_rate_limited` | Yes — parsed by `agent.classify-failure`                 |

## OpenAI Codex CLI

| Layer        | Signal                                                                | Available to GSD today? |
|--------------|-----------------------------------------------------------------------|-------------------------|
| HTTP headers | `x-ratelimit-remaining-requests`, `x-ratelimit-remaining-tokens`      | No — Codex CLI does not forward these to hooks |
| Error body   | `429`, `usage_limit_reached`, `"exceeded your current quota"`, `Too Many Requests` ([openai/codex#9135](https://github.com/openai/codex/issues/9135)) | Yes — parsed by `agent.classify-failure` |

## Google Gemini CLI

| Layer        | Signal                                                                    | Available to GSD today? |
|--------------|---------------------------------------------------------------------------|-------------------------|
| Error body   | `RESOURCE_EXHAUSTED`, `"exceeded your current quota"`, `429`              | Yes — parsed by `agent.classify-failure` |
| Pre-warning  | None documented at the CLI layer                                          | n/a                     |

## Forward path

When the host runtimes (Claude Code, Copilot CLI, Codex CLI) start exposing rate-limit headers and SDK events to hooks — which is the active ask in [anthropics/claude-code#33820](https://github.com/anthropics/claude-code/issues/33820), [#22407](https://github.com/anthropics/claude-code/issues/22407), and [#32796](https://github.com/anthropics/claude-code/issues/32796) — GSD should:

1. Read `requests-remaining` / `tokens-remaining` in a PreToolUse / SessionStart hook and surface a soft warning to the user before dispatching a new wave when the values fall below a configurable threshold.
2. Treat `RateLimitEvent.status == "allowed_warning"` (Anthropic Agent SDK) as a checkpoint signal in long-running executors — emit a partial SUMMARY and let the orchestrator pick up after reset.
3. Combine the proactive headers with `executor.stall_threshold_minutes` (#3329) so the orchestrator does not wait the full stall interval when the runtime has already signalled `rejected`.

Until then, `agent.classify-failure` is the actionable boundary: post-mortem error-body sentinels, with a quota-distinct recovery prompt in `execute-phase` step 7.

## Sources

- [Anthropic Claude API — Rate limits](https://platform.claude.com/docs/en/api/rate-limits)
- [anthropics/claude-code#33820 — Expose API rate-limit response headers to hooks and status line scripts](https://github.com/anthropics/claude-code/issues/33820)
- [anthropics/claude-code#22407 — Feature Request: Include rate limit info in statusline data](https://github.com/anthropics/claude-code/issues/22407)
- [anthropics/claude-code#32796 — Expose Max plan usage limits via Claude Code API/SDK](https://github.com/anthropics/claude-code/issues/32796)
- [anthropics/anthropic-sdk-typescript#450 — API calls missing Rate Limit Response Headers](https://github.com/anthropics/anthropic-sdk-typescript/issues/450)
- [GitHub Copilot — Rate limits documentation](https://docs.github.com/en/copilot/concepts/usage-limits)
- [github/copilot-cli#2742 — Persistent Global 429 Rate Limit on Paid Pro+ Account](https://github.com/github/copilot-cli/issues/2742)
- [OpenAI — Error codes](https://developers.openai.com/api/docs/guides/error-codes)
- [openai/codex#9135 — improper 429 error near the end of a 5-hour window](https://github.com/openai/codex/issues/9135)
- [Gemini API — Rate limits](https://ai.google.dev/gemini-api/docs/rate-limits)
- [google-gemini/gemini-cli#6986 — stuck in resource exhausted loop](https://github.com/google-gemini/gemini-cli/issues/6986)
