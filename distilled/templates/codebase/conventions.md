# Codebase Conventions

**Analysis Date:** [YYYY-MM-DD]

<guidelines>
- This document is durable intent (rules/patterns), not a directory dump.
- Be prescriptive. If 80%+ of the codebase follows a pattern, document it as a rule ("Use X"), not as a survey ("Sometimes X").
- Every non-trivial claim must include at least one concrete file path example.
- Prefer "how to do it here" over general best practices.
- Capture testing and mocking boundaries explicitly ("what NOT to mock"). Missing boundaries cause broken tests and slow CI.
- Capture external integration patterns (webhook verification, auth session management). Missing these causes security vulnerabilities.
</guidelines>

## Naming Patterns

Files:
- [Pattern observed]

Functions:
- [Pattern observed]

Variables:
- [Pattern observed]

Types:
- [Pattern observed]

## Code Style

Formatting:
- Tool: [Tool used]
- Key settings: [Key settings]

Linting:
- Tool: [Tool used]
- Key rules: [Key rules]

## Import Organization

Order:
1. [First group]
2. [Second group]
3. [Third group]

Path aliases:
- [Aliases used]

## Error Handling

Patterns:
- [How errors are handled]
- Examples: `[file paths]`

## Logging

Framework:
- [Tool or "console"]

Patterns:
- [When/how to log]
- Examples: `[file paths]`

## Module / Function Design

Function size:
- [Guidelines]

Parameters:
- [Pattern]

Return values:
- [Pattern]

Exports:
- [Pattern]

## Testing And Mocking (High-Leverage)

Test types used:
- Unit: [yes/no] (runner: [tool]) - examples: `[file paths]`
- Integration: [yes/no] - examples: `[file paths]`
- E2E: [yes/no] - examples: `[file paths]`

Where tests live:
- Unit tests: `[path pattern]`
- Integration tests: `[path pattern]`
- E2E tests: `[path pattern]`

Fixtures and factories:
- Where fixtures live: `[path pattern]`
- Preferred factory pattern: [pattern]

Mocking boundaries (explicit):
- Do mock: [what is safe to mock here]
- Do NOT mock: [what must remain real]
- Why: [rationale grounded in this codebase]
- Examples: `[file paths]`

External calls:
- Network calls in tests: [allowed/blocked]
- How HTTP is stubbed: [pattern] - examples: `[file paths]`
- DB usage in tests: [pattern] - examples: `[file paths]`

CI reliability rules:
- Timeouts: [standard value if any]
- Flake policy: [rerun policy or "none"]
- Test parallelism constraints: [if any]

<good_examples>
Example (good):
- "All HTTP clients must be injected via `src/lib/http/client.ts` and mocked via `test/utils/mockHttp.ts` (do NOT mock `fetch` directly). See `src/services/billing.ts` and `test/services/billing.test.ts`."
- "Integration tests use a real Postgres via Docker Compose. Do NOT mock DB queries; instead use `test/fixtures/dbSeed.ts`. See `test/integration/users.test.ts`."

Example (bad):
- "We use Jest and sometimes integration tests." (no paths, no boundaries, no rules)
</good_examples>

## External Integration Patterns (Security-Critical)

Capture these only if external integrations exist. Missing these causes subtle security bugs.

### Webhook Verification
- Webhook endpoints: `[paths]`
- Signature verification method: [HMAC-SHA256 / provider-specific / none]
- Where verification happens: `[file path]` (middleware? route handler?)
- Verified before or after parsing payload: [before — always verify raw body]
- Do NOT: parse JSON before verifying signature (timing attacks)
- Examples: `[file paths for webhook handlers]`

### Authentication and Session Management
- Auth provider: [JWT / session cookie / OAuth / API key / none]
- Token storage (client): [httpOnly cookie / localStorage / memory]
- Token storage (server): [Redis / DB / stateless]
- Refresh logic: [how tokens are refreshed, where that code lives]
- Where auth is enforced: [middleware path / per-route / both]
- Protected vs public routes: [pattern or file]
- Do NOT: store tokens in localStorage for sensitive apps (XSS risk)
- Examples: `[file paths for auth middleware]`

### Environment Configuration
- Config loading: `[file path]` (e.g., `src/config/index.ts`)
- Environment-specific overrides: [dev/staging/prod distinction]
- Secrets access pattern: [env var / secrets manager / vault]
- Do NOT: hardcode secrets; do NOT commit `.env` files
- Examples: `[file paths]`

### Observability Hooks
- Request logging: [tool + where it's configured]
- Error tracking: [tool + integration file path]
- Performance monitoring: [tool + integration point]
- Health check endpoint: `[path]` (e.g., `/health`)
- Examples: `[file paths]`

<good_examples>
Example (good):
- "Stripe webhooks are verified via `src/webhooks/stripe.ts:verifyStripeSignature()` using the raw request body before JSON parsing. Do NOT route Stripe events through the JSON body parser middleware. See `src/middleware/webhooks.ts`."
- "Auth tokens are httpOnly cookies (not localStorage). Refresh happens via `src/auth/refresh.ts` called by the global axios interceptor. Token expiry = 15min access, 7-day refresh. See `src/lib/http.ts`."
- "All secrets come from env vars loaded via `src/config/env.ts`. Never read `process.env` directly outside that file. Dev/staging/prod configs are in `.env.example`, `.env.staging`, `.env.production` (secrets redacted, committed)."

Example (bad):
- "We use JWT and have some webhooks." (no paths, no security rules, no boundaries)
</good_examples>

---

*Convention analysis: [date]*

