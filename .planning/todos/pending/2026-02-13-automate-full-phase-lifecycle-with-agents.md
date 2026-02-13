---
created: 2026-02-13T15:22
title: Automate full phase lifecycle with agents
area: commands
files:
  - commands/gsd/discuss-phase.md
  - commands/gsd/plan-phase.md
  - commands/gsd/execute-phase.md
  - commands/gsd/verify-work.md
---

## Problem

Currently, the GSD phase lifecycle requires user involvement at multiple stages — most notably the discuss phase (`/gsd:discuss-phase`) which is an interactive Q&A session between Claude and the user to gather context before planning. This makes fully autonomous phase execution impossible.

For users who want hands-off workflows (e.g., "run this entire phase end-to-end without me"), there's no mechanism to replace user-interactive steps with agent-based alternatives. The discuss phase is the primary bottleneck since it's inherently conversational.

## Solution

TBD — high-level ideas:
- Create an `--auto` mode that applies across the full phase lifecycle (discuss → plan → execute → verify)
- For the discuss phase specifically, spawn a team of agents to play the role of the user:
  - A "domain expert" agent that answers questions based on codebase analysis
  - A "requirements" agent that infers answers from PROJECT.md, roadmap, and phase goals
  - Possibly a "devil's advocate" agent to ensure discuss doesn't rubber-stamp everything
- The planner, executor, and verifier would also need auto-mode adaptations (related to existing `--auto` verify todo)
- Consider a top-level `/gsd:auto-phase` command or a flag on `/gsd:progress` that triggers the full autonomous flow
