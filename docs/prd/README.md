# Product Requirements Documents

This directory contains Product Requirements Documents (PRDs) for GSD.

A PRD captures the **what** and **why** of a feature before implementation begins. ADRs (in `docs/adr/`) capture the **how** of architectural decisions. The two complement each other: a PRD makes the case for a feature and defines acceptance criteria; an ADR records the architectural mechanism chosen to deliver it.

## Naming Convention

PRDs use the same issue#-prefix slug naming as ADRs:

```text
docs/prd/<issue#>-<kebab-slug>.md
```

Example: `docs/prd/3491-bar-feature.md` for a feature tracked in issue #3491.

The GitHub-assigned issue number is the prefix. Do not compute a sequential number locally — see [CONTRIBUTING.md — "Proposing an ADR or PRD"](../../CONTRIBUTING.md#proposing-an-adr-or-prd) for the full process.

## Historical note

`docs/adr/0011-review-default-reviewers-prd.md` predates this directory and is preserved as immutable historical record. It is not a pattern to follow. New PRDs live here.

## Index

| PRD | Title | Status |
|-----|-------|--------|
| [3524-cjs-sdk-hard-seam.md](3524-cjs-sdk-hard-seam.md) | CJS↔SDK hard seam — phased migration (#3524) | Reference |
