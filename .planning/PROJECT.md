# GSD Adversary Agent

## What This Is

An adversarial review agent for the GSD workflow that challenges assumptions, verifies completeness, and stress-tests feasibility at every major checkpoint. It forces iterative refinement through debate until convergence, catching quality issues before they compound downstream.

## Core Value

Unchallenged assumptions get caught before they cause problems in execution.

## Requirements

### Validated

- ✓ Orchestrator-agent architecture with parallel execution — existing
- ✓ State-driven workflows with `.planning/STATE.md` — existing
- ✓ Plan checker agent for plan verification — existing
- ✓ Verification agents for post-execution checks — existing
- ✓ Agent spawning via Task tool with model profiles — existing

### Active

- [ ] Single `gsd-adversary` agent that handles all checkpoint types
- [ ] Adversary challenges after requirements definition
- [ ] Adversary challenges after roadmap creation
- [ ] Adversary challenges after each plan creation
- [ ] Adversary challenges after verification conclusions
- [ ] Iterative debate loop until adversary signals "no objections"
- [ ] Claude makes final decision after max rounds if no convergence
- [ ] Dynamic challenge style adapting to artifact type
- [ ] Focus areas: feasibility, completeness, assumptions

### Out of Scope

- Adversary during execution — Too disruptive to atomic commit flow
- User-mediated disputes — Claude resolves, adversary is advisory
- Specialized per-checkpoint agents — Single agent adapts to context
- Blocking on adversary objections — Advisory only, Claude decides

## Context

GSD already has verification agents (gsd-verifier, gsd-plan-checker) but these validate structure and completeness — they don't actively challenge assumptions or argue against decisions. The adversary agent is different: it takes an oppositional stance, forcing Claude to defend choices.

The existing architecture supports this well:
- Commands can spawn the adversary as another parallel agent
- Agent receives artifact + type, returns challenges or "no objections"
- Iterative loops already exist (plan-checker iterates up to 3 times)

Integration points are clear:
- `/gsd:new-project` → after REQUIREMENTS.md creation
- `/gsd:new-project` → after ROADMAP.md creation
- `/gsd:plan-phase` → after PLAN.md creation
- `/gsd:execute-phase` → after verification

## Constraints

- **Architecture**: Must fit existing orchestrator-agent pattern — agent spawned via Task tool
- **Context**: Agent must work with fresh context window (no conversation history)
- **Convergence**: Max rounds before Claude decides (prevent infinite loops)
- **Style**: Adversary adapts tone — rigorous on feasibility, constructive on completeness, devil's advocate on assumptions

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Single agent vs specialized | Reduces maintenance, patterns apply universally | — Pending |
| Advisory vs blocking | Prevents workflow deadlock, Claude owns final call | — Pending |
| Dynamic style | Different challenges need different approaches | — Pending |

---
*Last updated: 2026-01-31 after initialization*
