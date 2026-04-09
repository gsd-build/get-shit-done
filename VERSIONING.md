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

For critical bugs that can't wait for the next minor release.

1. Trigger `hotfix.yml` with version (e.g., `1.27.1`)
2. Workflow creates `hotfix/1.27.1` branch from the latest patch tag for that minor version (e.g., `v1.27.0` or `v1.27.1`)
3. Cherry-pick or apply fix on the hotfix branch
4. Push — CI runs tests automatically
5. Trigger `hotfix.yml` finalize action
6. Workflow runs full test suite, bumps version, tags, publishes to `latest`
7. Merge hotfix branch back to main

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
