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

Two complementary approaches:

### 1. `/gsd:next` — User-driven sequential progression
A "next" command that detects the current phase state and triggers the next step in the user's defined workflow sequence. Users define their preferred flow (e.g., `discuss w/ research -> plan -> execute -> verify w/ auto`) and `/gsd:next` auto-detects where they are and invokes the correct next command.

Key design points:
- Read workflow sequence from config (e.g., `config.json` or a new `workflow` field)
- Determine current position by inspecting phase artifacts (DISCUSSION-GUIDE.md exists? PLAN.md exists? etc.)
- Map each step to its corresponding command with any configured flags (e.g., `verify w/ auto` → `/gsd:verify-work --auto`)
- Handle edge cases: phase complete, no workflow defined, stuck/failed state

### 2. `--auto` mode — Fully autonomous lifecycle
- Create an `--auto` mode that applies across the full phase lifecycle (discuss → plan → execute → verify)
- For the discuss phase specifically, spawn a team of agents to play the role of the user:
  - A "domain expert" agent that answers questions based on codebase analysis
  - A "requirements" agent that infers answers from PROJECT.md, roadmap, and phase goals
  - Possibly a "devil's advocate" agent to ensure discuss doesn't rubber-stamp everything
- The planner, executor, and verifier would also need auto-mode adaptations
- Consider a top-level `/gsd:auto-phase` command or a flag on `/gsd:progress` that triggers the full autonomous flow

These compose naturally: `/gsd:next` could use `--auto` flags from the workflow config to run steps autonomously when configured.
