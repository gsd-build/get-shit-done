# Installer Migration Module owns install-time upgrade safety

- **Status:** Accepted
- **Date:** 2026-05-11

We decided to introduce an explicit Installer Migration Module for install-time file moves, removals, config rewrites, and user-data preservation. Installer upgrade behavior must be represented as versioned migration records that produce a dry-run plan before applying changes.

## Decision

- Add an Installer Migration Module as the owner for upgrade migrations.
- Keep the existing installer materialization pipeline, but move cleanup and feature-retirement behavior into migration records over time.
- Track applied migrations in an install-state file next to the existing file manifest.
- Treat the existing file manifest as the managed-file ownership baseline.
- Treat user-owned artifacts as a single shared policy consumed by preservation and manifest writing.
- Require migrations to plan first, then apply through a shared executor that owns backup, rollback, and reporting.
- Default ambiguous or unknown files to preserve; destructive changes need managed-file evidence or explicit user choice.
- Support dry-run output using the same planner used by apply mode.
- Include a first-time baseline scanner for legacy installs that need classification before destructive migrations can be trusted.
- Treat the runtime configuration contract registry in `docs/installer-migrations.md` as the source of truth for migrations that touch host runtime config.

## Runtime Contract Decision

Every migration that rewrites runtime config, moves an invocation surface, or
retires a generated runtime artifact must cite the registry row in
`docs/installer-migrations.md`. If the migration changes where a runtime loads
commands, skills, agents, hooks, or rules, the PR must update both the registry
and `docs/ARCHITECTURE.md`.

The registry records what GSD installs, where it installs it, when migrations
may touch it, who owns the surrounding config, and why the shape matches the
host runtime. When upstream docs do not publish an API or docs version, the
checked date is the drift sentinel. A later upstream docs or CLI release that
changes command, skill, agent, hook, or rule loading requires a new registry
snapshot before migration work proceeds.

## Consequences

- Retiring features requires an explicit migration instead of a hidden cleanup block.
- The installer can remove stale GSD-owned artifacts without guessing about user files.
- Locally modified managed files get a consistent backup path before removal or replacement.
- Future rollback work can become runtime-neutral instead of Codex-specific.
- Migration authors must define ownership evidence, conflict behavior, runtime scope, and non-interactive behavior.
- Migration authors must also define which runtime contract they are relying on and whether the upstream documentation is versioned.
- The installer gains another state file, so tests must cover missing, legacy, and checksum-mismatch state.

## Scope

The first implementation should extract manifest/user-owned helpers, add install-state persistence, add migration planning, and port one existing orphan cleanup into the migration runner. It should not rewrite every runtime installer branch in the first pass.

The detailed module contract lives in `docs/installer-migrations.md`.

## Amendment (2026-05-11): Authoring guard enforcement

The Installer Migration Authoring Guard Module validates migration records and
planned actions before planning can proceed. Records must declare title,
description, introduction version, explicit install scopes, destructive status,
and a plan function. Destructive or config-rewrite actions must include
ownership evidence, and runtime config rewrites must cite the runtime
configuration contract registry.
