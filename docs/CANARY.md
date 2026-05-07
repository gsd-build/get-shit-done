# Canary Stream

The **canary** dist-tag is GSD's earliest preview channel. It exists so contributors and willing early adopters can exercise in-flight features against the long-lived `dev` integration branch before they have any expectation of stability.

## Stream policy

GSD ships through three npm dist-tags, each fed by exactly one git branch. **Streams do not mix.**

| Branch | dist-tag | Audience | Stability |
|---|---|---|---|
| `dev` | `canary` | Contributors, willing early adopters | Best-effort. May regress between cuts. Roll-forward only. |
| `main` | `next` | Maintainers, RC testers | Release-candidate quality. Bug-bar enforced. |
| `main` | `latest` | Everyone else | Production stable. The default `npm install` target. |

`dev` is the integration branch for in-flight feature work (typically multi-PR vertical slices like the MVP/TDD/UAT track in 1.50.0). When the dev work stabilizes, it promotes to `main` as an RC train (`vX.Y.Z-rc.N` published to `next`), and after the RC train bakes, the same train promotes again to `latest`.

A canary build NEVER becomes a `next` build directly, and a `next` build NEVER becomes a `latest` build directly — every promotion goes through a fresh tag and a fresh release.

## Installing canary

```bash
# One-off invocation (npx)
npx get-shit-done-cc@canary

# Pin to the canary dist-tag globally
npm install -g get-shit-done-cc@canary

# Pin to an exact canary version
npm install -g get-shit-done-cc@1.50.0-canary.1
```

The CC installer's defensive purge rewrites stale config blocks left by older GSD versions, so reinstalling on top of an existing project is safe.

## When to install canary

✅ **Do** install canary when you want to:
- Exercise in-flight planning/execution/verification features early and report findings
- Validate a fix you've contributed to `dev` is reachable end-to-end
- Help shake out canary-bake items (rough edges that won't ship to `next` until resolved)

❌ **Do NOT** install canary on:
- Production projects you depend on for delivery
- A machine where rolling back means recreating GSD state (use a profile or a workspace instead)
- A demo or onboarding setup — pin to `@latest` so audiences see the stable surface

## Rolling back from canary

```bash
# Back to the current stable
npm install -g get-shit-done-cc@latest

# Or to the next/RC train
npm install -g get-shit-done-cc@next
```

If you have a local project that interacted with canary-only features (for instance, an MVP-mode phase planned by 1.50.0-canary), the planner artifacts in `.planning/` remain valid — older GSD versions will just ignore the `**Mode:** mvp` field on phases.

## Reporting issues against canary

File against the [issue tracker](https://github.com/gsd-build/get-shit-done/issues) with the `bug` template. Include the exact canary version (`get-shit-done-cc --version` reports it) so triage can route the report back into the `dev` stream rather than the stable stream.

## Where to look next

- Active canary release notes: [`docs/RELEASE-v1.50.0-canary.1.md`](RELEASE-v1.50.0-canary.1.md)
- Stable release notes: [`CHANGELOG.md`](../CHANGELOG.md)
- Stream architecture rationale: discussed across [#2727](https://github.com/gsd-build/get-shit-done/issues/2727), [#2773](https://github.com/gsd-build/get-shit-done/issues/2773) (codex schema-break and the resulting promotion bottleneck that motivated explicit stream isolation)
