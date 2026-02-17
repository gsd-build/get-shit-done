---
created: 2026-02-17T19:49:35.351Z
title: Incorporate agent swarms into the process
area: workflows
files: []
---

## Problem

GSD currently uses single-agent execution for most workflow steps — one planner, one executor, one verifier at a time. Claude Code's TeamCreate/SendMessage swarm capabilities enable parallel multi-agent coordination, but GSD doesn't leverage this pattern. This limits throughput and misses opportunities for richer agent collaboration (parallel research, concurrent plan validation, multi-perspective verification).

Related but distinct from "Automate full phase lifecycle with agents" which focuses on removing user interaction from the discuss→verify lifecycle. This todo focuses on using swarm parallelism as a core execution strategy.

## Solution

TBD — potential integration points:

- **Parallel research**: Spawn multiple researcher agents exploring different aspects of a phase simultaneously (tech stack, patterns, constraints)
- **Swarm-based planning**: Multiple planner agents draft competing plans, then a synthesis agent merges the best elements
- **Parallel execution**: For phases with independent tasks, spawn executor agents per task working concurrently across the codebase
- **Multi-perspective verification**: Swarm of verifier agents checking different quality dimensions (correctness, performance, security, UX) in parallel
- **Cross-phase coordination**: A lead agent orchestrating swarm workers across the plan→execute→verify pipeline

Key questions:
- How does swarm state coordinate with `.planning/` artifacts?
- What's the right granularity for task decomposition (per-file, per-feature, per-concern)?
- How to handle merge conflicts when multiple agents edit concurrently?
- Should this integrate with worktree support (see related todo) for true isolation?
