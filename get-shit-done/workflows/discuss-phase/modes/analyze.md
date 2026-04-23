# --analyze mode — trade-off tables before each question

> **Lazy-loaded overlay.** Read this file from `workflows/discuss-phase.md`
> when `--analyze` is present in `$ARGUMENTS`. Combinable with default,
> `--all`, `--chain`, `--text`, `--batch`.

## Effect

Before presenting each question (or question group, in batch mode), provide
a brief **trade-off analysis** for the decision:
- 2-3 options with pros/cons based on codebase context and common patterns
- A recommended approach with reasoning
- Known pitfalls or constraints from prior phases

## Example

```markdown
**Trade-off analysis: Authentication strategy**

| Approach | Pros | Cons |
|----------|------|------|
| Session cookies | Simple, httpOnly prevents XSS | Requires CSRF protection, sticky sessions |
| JWT (stateless) | Scalable, no server state | Token size, revocation complexity |
| OAuth 2.0 + PKCE | Industry standard for SPAs | More setup, redirect flow UX |

💡 Recommended: OAuth 2.0 + PKCE — your app has social login in requirements (REQ-04) and this aligns with the existing NextAuth setup in `src/lib/auth.ts`.

How should users authenticate?
```

This gives the user context to make informed decisions without extra
prompting.

When `--analyze` is absent, present questions directly as before (no
trade-off table).

## Sourcing the analysis

- Pros/cons should reflect the codebase context loaded in `scout_codebase`
  and any prior decisions surfaced in `load_prior_context`.
- The recommendation must explicitly tie to project context (e.g.,
  existing libraries, prior phase decisions, documented requirements).
- If a related ADR or spec is referenced in CONTEXT.md `<canonical_refs>`,
  cite it in the recommendation.
