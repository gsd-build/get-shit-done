# STATE.md Mutation Transaction Module owns write transaction policy

- **Status:** Accepted
- **Date:** 2026-05-10

## Context

STATE.md is both a human-readable operating log and a machine-readable state surface. CJS commands and SDK query handlers both mutate it, rebuild YAML frontmatter, preserve curated progress values, normalize status, and protect writes with lockfiles.

Before this decision, those transaction mechanics were duplicated across CJS and SDK paths. The STATE.md Document Module already owned pure text transforms, but the write transaction around those transforms was still spread across command handlers. That made bugs around progress trampling, stale lock handling, frontmatter drift, and sync mismatch hard to localize.

This decision extends the seam map from ADR 0005 and follows the thin Adapter direction from ADR 0007. It does not replace the Planning Workspace Module from ADR 0004 or the Planning Path Projection Module from ADR 0006.

## Decision

Create and treat the **STATE.md Mutation Transaction Module** as the owning seam for STATE.md write transaction policy.

The seam owns:

- acquiring and releasing the STATE.md lock around migrated writes;
- reading the current STATE.md content;
- selecting the mutation surface, either full file or body-only;
- running the caller-supplied mutation;
- rebuilding projected frontmatter from the mutated body;
- preserving configured frontmatter fields such as curated `progress.*` values;
- preserving valid existing status when a body-derived projection would become `unknown`;
- returning projected content for dry-run verification without writing;
- normalizing and atomically writing the final STATE.md content.

CJS and SDK command handlers remain Adapters. They may parse arguments and provide domain-specific mutation functions, but they should not own lock/read/project/write ordering.

## Non-Goals

The STATE.md Mutation Transaction Module does not own pure STATE.md text transforms. Field extraction, field replacement, status normalization, and other content-only transforms remain in the STATE.md Document Module.

The seam does not own planning inventory policy. Phase, plan, summary, roadmap, and workstream counts are produced by inventory/progress projection helpers and consumed during frontmatter projection.

The seam does not make every STATE.md operation identical. Special flows such as milestone switching may provide a custom frontmatter projector when normal disk-derived projection would read stale on-disk state before the write lands.

## Consequences

Race-safety, frontmatter projection, progress preservation, status preservation, and sync dry-run behavior should be tested at the transaction Interface first.

Command-level tests should focus on smoke parity and user-visible behavior, not duplicated source-shape checks for transaction internals.

Future STATE.md mutation work should start by asking whether the desired behavior belongs in:

- the STATE.md Document Module for pure text transforms;
- the STATE.md Mutation Transaction Module for lock/read/mutate/project/write policy;
- an inventory/progress Module for filesystem-derived counts;
- a CJS or SDK Adapter for argument parsing and command response shape.
