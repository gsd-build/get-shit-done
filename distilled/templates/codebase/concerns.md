# Codebase Concerns

**Analysis Date:** [YYYY-MM-DD]

<guidelines>
- Every concern must include concrete file paths.
- Be specific with measurements (e.g., "p95 500ms") not adjectives ("slow").
- Include reproduction steps for bugs, and "safe change" advice for fragile areas.
- This document is about risk and leverage: what breaks, where, and how to change safely.
</guidelines>

## Tech Debt

Area/component: [Name]
- Issue: [What's the shortcut/workaround]
- Files: `[file paths]`
- Impact: [What breaks or degrades]
- Fix approach: [How to address it]

## Known Bugs

Bug: [Description]
- Symptoms: [What happens]
- Files: `[file paths]`
- Trigger: [How to reproduce]
- Workaround: [If any]

## Security Considerations

Area: [Name]
- Risk: [What could go wrong]
- Files: `[file paths]`
- Current mitigation: [What's in place]
- Recommendations: [What should be added]

## Performance Bottlenecks

Operation: [Name]
- Problem: [What is slow]
- Files: `[file paths]`
- Measurement: [numbers, if known]
- Suspected cause: [why]
- Improvement path: [how]

## Fragile Areas

Component/module: [Name]
- Files: `[file paths]`
- Why fragile: [what makes it break easily]
- Safe modification: [how to change safely]
- Test coverage: [gaps]

## Dependency Risks

Dependency: [Package/service]
- Risk: [what is wrong]
- Impact: [what breaks]
- Mitigation: [what to do]

## Missing Critical Features (If Any)

Feature gap: [Name]
- Problem: [what is missing]
- Blocks: [what can't be done]

## Test Coverage Gaps

Untested area: [Name]
- What's not tested: [specific functionality]
- Files: `[file paths]`
- Risk: [what could break unnoticed]
- Priority: [High/Medium/Low]

<good_examples>
Example (good):
- "Auth refresh tokens are stored unencrypted in `src/auth/tokenStore.ts` and logged in `src/auth/logger.ts` (risk: credential leakage). Fix: remove token logging and encrypt at rest. Repro: enable debug logging and observe tokens in logs."
- "Checkout endpoint p95 is 1.8s in staging due to N+1 queries in `src/db/orders.ts` (see `getOrdersForUser`). Fix: batch query and add integration test asserting query count."
</good_examples>

---

*Concerns audit: [date]*

