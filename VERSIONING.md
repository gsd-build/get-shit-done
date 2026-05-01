# Versioning & Release Strategy

GSD follows [Semantic Versioning 2.0.0](https://semver.org/) with three release tiers mapped to npm dist-tags.

## Release Tiers

| Tier | What ships | Version format | npm tag | Branch | Install |
|------|-----------|---------------|---------|--------|---------|
| **Patch** | Bug fixes only | `1.27.1` | `latest` | `hotfix/1.27.1` | `npx get-shit-done-cc@latest` |
| **Minor** | Fixes + enhancements | `1.28.0` | `latest` (after RC) | `release/1.28.0` | `npx get-shit-done-cc@next` (RC) |
| **Major** | Fixes + enhancements + features | `2.0.0` | `latest` (after beta) | `release/2.0.0` | `npx get-shit-done-cc@next` (beta) |

## npm Dist-Tags

Only two tags, following Angular/Next.js convention:

| Tag | Meaning | Installed by |
|-----|---------|-------------|
| `latest` | Stable production release | `npm install get-shit-done-cc` (default) |
| `next` | Pre-release (RC or beta) | `npm install get-shit-done-cc@next` (opt-in) |

The version string (`-rc.1` vs `-beta.1`) communicates stability level. Users never get pre-releases unless they explicitly opt in.

## Semver Rules

| Increment | When | Examples |
|-----------|------|----------|
| **PATCH** (1.27.x) | Bug fixes, typo corrections, test additions | Hook filter fix, config corruption fix |
| **MINOR** (1.x.0) | Non-breaking enhancements, new commands, new runtime support | New workflow command, discuss-mode feature |
| **MAJOR** (x.0.0) | Breaking changes to config format, CLI flags, or runtime API; new features that alter existing behavior | Removing a command, changing config schema |

## Pre-Release Version Progression

Major and minor releases use different pre-release types:

```
Minor: 1.28.0-rc.1  →  1.28.0-rc.2  →  1.28.0
Major: 2.0.0-beta.1 →  2.0.0-beta.2 →  2.0.0
```

- **beta** (major releases only): Feature-complete but not fully tested. API mostly stable. Used for major releases to signal a longer testing cycle.
- **rc** (minor releases only): Production-ready candidate. Only critical fixes expected.
- Each version uses one pre-release type throughout its cycle. The `rc` action in the release workflow automatically selects the correct type based on the version.

## Branch Structure

```
main                              ← stable, always deployable
  │
  ├── hotfix/1.27.1               ← patch: cherry-pick fix from main, publish to latest
  │
  ├── release/1.28.0              ← minor: accumulate fixes + enhancements, RC cycle
  │     ├── v1.28.0-rc.1          ← tag: published to next
  │     └── v1.28.0               ← tag: promoted to latest
  │
  ├── release/2.0.0               ← major: features + breaking changes, beta cycle
  │     ├── v2.0.0-beta.1         ← tag: published to next
  │     ├── v2.0.0-beta.2         ← tag: published to next
  │     └── v2.0.0                ← tag: promoted to latest
  │
  ├── fix/1200-bug-description    ← bug fix branch (merges to main)
  ├── feat/925-feature-name       ← feature branch (merges to main)
  └── chore/1206-maintenance      ← maintenance branch (merges to main)
```

## Release Workflows

### Patch Release (Hotfix)

For fixes that need to ship without waiting for the next minor.

A hotfix `vX.YY.Z` cumulatively includes everything in `vX.YY.{Z-1}` plus every `fix:`/`chore:` commit landed on `main` since that base. The base tag is the anchor — `git cherry $BASE_TAG main` reveals exactly which commits are still unshipped, and the new `vX.YY.Z` tag becomes the next hotfix's base, so the cycle is self-documenting.

#### Two paths

**Path A — `hotfix.yml` (canonical, two-step):**

1. Trigger `hotfix.yml` with `action=create`, `version=1.27.1`, `auto_cherry_pick=true` (default).
   - Workflow detects `BASE_TAG` = highest `v1.27.*` < `v1.27.1` (so `1.27.1` branches from `v1.27.0`; `1.27.2` would branch from `v1.27.1`).
   - Branches `hotfix/1.27.1` from `BASE_TAG`.
   - Auto-cherry-picks every `fix:`/`chore:` commit on `origin/main` not already in the base, oldest-first. Patch-equivalents are skipped via `git cherry`. `feat:`/`refactor:` are **never** auto-included.
   - On conflict the workflow halts with the offending SHA. Resolve manually on the branch, then re-run finalize with `auto_cherry_pick=false`.
   - Bumps `package.json` (and `sdk/package.json`), pushes the branch, and lists every included SHA in the run summary.
2. (Optional) push additional manual commits to `hotfix/1.27.1`.
3. Trigger `hotfix.yml` with `action=finalize`. The workflow:
   - Runs `install-smoke` cross-platform gate.
   - Runs full test suite + coverage.
   - Builds SDK, bundles `sdk-bundle/gsd-sdk.tgz` inside the CC tarball (parity with `release-sdk.yml`).
   - Tags `v1.27.1`, publishes to `@latest`, re-points `@next → v1.27.1`.
   - Opens merge-back PR against `main`.

**Path B — `release-sdk.yml` (stopgap, one-shot):**

Active while the `@gsd-build/sdk` npm token is unavailable; bundles the SDK inside the CC tarball.

1. Trigger `release-sdk.yml` with `action=hotfix`, `version=1.27.1`, `auto_cherry_pick=true`.
   - The `prepare` job creates the branch and cherry-picks (same logic as Path A).
   - `install-smoke` runs against the new branch.
   - The `release` job tags, publishes to `@latest`, re-points `@next`, opens merge-back PR.
   - Idempotent: if `hotfix/1.27.1` already exists (e.g. you ran `hotfix.yml create` first), the prepare job checks it out and re-runs cherry-pick as a no-op.
2. `dry_run=true` exercises the full pipeline without pushing the branch or publishing.

### Minor Release (Standard Cycle)

For accumulated fixes and enhancements.

1. Trigger `release.yml` with action `create` and version (e.g., `1.28.0`)
2. Workflow creates `release/1.28.0` branch from main, bumps package.json
3. Trigger `release.yml` with action `rc` to publish `1.28.0-rc.1` to `next`
4. Test the RC: `npx get-shit-done-cc@next`
5. If issues found: fix on release branch, publish `rc.2`, `rc.3`, etc.
6. Trigger `release.yml` with action `finalize` — publishes `1.28.0` to `latest`
7. Merge release branch to main

### Major Release

Same as minor but uses `-beta.N` instead of `-rc.N`, signaling a longer testing cycle.

1. Trigger `release.yml` with action `create` and version (e.g., `2.0.0`)
2. Trigger `release.yml` with action `rc` to publish `2.0.0-beta.1` to `next`
3. If issues found: fix on release branch, publish `beta.2`, `beta.3`, etc.
4. Trigger `release.yml` with action `finalize` -- publishes `2.0.0` to `latest`
5. Merge release branch to main

## Conventional Commits

Branch names map to commit types:

| Branch prefix | Commit type | Version bump |
|--------------|-------------|-------------|
| `fix/` | `fix:` | PATCH |
| `feat/` | `feat:` | MINOR |
| `hotfix/` | `fix:` | PATCH (immediate) |
| `chore/` | `chore:` | none |
| `docs/` | `docs:` | none |
| `refactor/` | `refactor:` | none |

## Publishing Commands (Reference)

```bash
# Stable release (sets latest tag automatically)
npm publish

# Pre-release (must use --tag to avoid overwriting latest)
npm publish --tag next

# Verify what latest and next point to
npm dist-tag ls get-shit-done-cc
```
