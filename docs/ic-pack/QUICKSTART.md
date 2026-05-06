<!-- CLASSIFICATION: UNCLASSIFIED -->
# Quickstart: 30 Minutes from `npx` to First Agent Invocation

> **Status:** Stub. Fleshed out in Plan 1 (Phase 0 Foundations) once the first agent (`gsd-customer-context-mapper`) ships.

## Prerequisites

- A program repo that already has GSD installed (`npx get-shit-done-cc@latest`).
- Node 22+, npm.

## Install

```bash
cd /path/to/your/program
npx @adelphi/gsd-ic@latest install --customer=nga
```

(Replace `nga` with your actual customer; valid values: `nga`, `nsa`, `nro`, `cia`, `dia`.)

## Verify

After install, `.claude/agents/` contains both stock GSD and IC-pack agents (the IC ones are prefixed `gsd-`). Run any IC agent to verify wiring.

(More detail to come.)
