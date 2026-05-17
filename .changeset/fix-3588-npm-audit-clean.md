---
type: Security
pr: 3588
---
**`npm audit --omit=dev` is clean** — bumped lockfile-pinned transitive versions of `fast-uri`, `@anthropic-ai/sdk`, `hono`, `ip-address`, and `express-rate-limit` (pulled in through `@anthropic-ai/claude-agent-sdk` and `@modelcontextprotocol/sdk`) to patched releases. Same pass applied to `sdk/package-lock.json` (was clean for production already; the test now locks it in). Resolves #3588.
