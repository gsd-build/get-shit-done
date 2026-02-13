---
created: 2026-02-13T15:20
title: Add --auto flag to verify phase
area: commands
files:
  - commands/gsd/verify-work.md
---

## Problem

The verify phase (`/gsd:verify-work`) currently requires manual intervention — the user must interact with the agent to guide verification. For CI/CD pipelines, automated workflows, or users who want hands-off execution, there's no way to run verification automatically without user prompts.

An `--auto` flag would let the agent attempt to run the full verification phase autonomously, making decisions on its own rather than pausing for user input.

## Solution

TBD — likely involves:
- Adding `--auto` as a recognized argument in the verify-work command frontmatter
- Modifying the verification flow to skip interactive questions when `--auto` is set
- Auto-accepting defaults or using heuristics where user input would normally be required
- Ensuring output/reporting is still comprehensive even without interaction
