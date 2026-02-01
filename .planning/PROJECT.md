# Get Shit Done Together

## What This Is

A meta-prompting, context engineering, and spec-driven development system for Claude Code, OpenCode, and Gemini CLI. GSD solves "context rot" — quality degradation as Claude fills its context window — through structured planning, multi-agent orchestration, and atomic execution.

## Core Value

Quality doesn't degrade as context grows. Every session starts fresh with full project context.

## Current Milestone: v2.1 Adversary Agent

**Goal:** Add adversarial review agent that challenges assumptions and stress-tests feasibility at key workflow checkpoints.

**Target features:**
- Constructive adversary challenges at requirements, roadmap, plan, and verification checkpoints
- Iterative debate loop until convergence or max rounds
- Configurable per-checkpoint toggles
- Advisory-only (Claude makes final decisions)

## Requirements

### Validated

*v2.0 MVP — shipped 2026-01-31*

- ✓ Multi-runtime support (Claude Code, OpenCode, Gemini CLI) — installer handles frontmatter conversion
- ✓ 27 slash commands covering full project lifecycle — new-project → plan-phase → execute-phase → verify-work
- ✓ 11 specialized subagents — research, planning, execution, verification, debugging
- ✓ State-driven workflows with `.planning/` artifacts — PROJECT.md, ROADMAP.md, STATE.md, REQUIREMENTS.md
- ✓ Hooks for status display and update checks — gsd-statusline.js, gsd-check-update.js
- ✓ Frontmatter conversion between runtimes — YAML ↔ TOML, permission mapping
- ✓ Path replacement for global/local installs — `~/.claude/` → actual paths
- ✓ Model profiles for agent spawning — quality, balanced, budget
- ✓ Orchestrator-agent architecture with parallel execution
- ✓ Plan checker agent for plan verification
- ✓ Verification agents for post-execution checks

### Active

*v2.1 Adversary Agent*

- [ ] Single `gsd-adversary` agent that handles all checkpoint types
- [ ] Adversary challenges after requirements definition
- [ ] Adversary challenges after roadmap creation
- [ ] Adversary challenges after each plan creation
- [ ] Adversary challenges after verification conclusions
- [ ] Iterative debate loop until adversary signals "no objections"
- [ ] Claude makes final decision after max rounds if no convergence
- [ ] Dynamic challenge style adapting to artifact type
- [ ] Global toggle enables/disables adversary in config.json
- [ ] Max rounds configurable in config.json
- [ ] Individual checkpoints can be toggled on/off

### Out of Scope

- Adversary during execution — Too disruptive to atomic commit flow
- User-mediated disputes — Claude resolves, adversary is advisory
- Specialized per-checkpoint agents — Single agent adapts to context
- Blocking on adversary objections — Advisory only, Claude decides
- Different model for adversary — Adds complexity; advisory-only design mitigates same-model collusion risk

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
- `/gsd:verify-work` → after verification

## Constraints

- **Architecture**: Must fit existing orchestrator-agent pattern — agent spawned via Task tool
- **Context**: Agent must work with fresh context window (no conversation history)
- **Convergence**: Max rounds before Claude decides (prevent infinite loops)
- **Style**: Adversary adapts tone — rigorous on feasibility, constructive on completeness, devil's advocate on assumptions
- **Runtime**: Must work across Claude Code, OpenCode, and Gemini CLI

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Single agent vs specialized | Reduces maintenance, patterns apply universally | — Pending |
| Advisory vs blocking | Prevents workflow deadlock, Claude owns final call | — Pending |
| Dynamic style | Different challenges need different approaches | — Pending |
| zpyoung community fork | Original TÂCHES project evolved to community-maintained | ✓ Good |

---
*Last updated: 2026-01-31 after v2.1 milestone initialization*
