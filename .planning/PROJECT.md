# Get Shit Done Together

## What This Is

A meta-prompting, context engineering, and spec-driven development system for Claude Code, OpenCode, and Gemini CLI. GSD solves "context rot" — quality degradation as Claude fills its context window — through structured planning, multi-agent orchestration, and atomic execution. Includes adversarial review at key workflow checkpoints to catch unchallenged assumptions before they reach execution.

## Core Value

Quality doesn't degrade as context grows. Every session starts fresh with full project context.

## Current Milestone

Planning next milestone. Run `/gsd:new-milestone` to begin.

## Requirements

### Validated

*v2.0 MVP — shipped 2026-01-31*

- ✓ Multi-runtime support (Claude Code, OpenCode, Gemini CLI) — installer handles frontmatter conversion
- ✓ 27 slash commands covering full project lifecycle — new-project → plan-phase → execute-phase → verify-work
- ✓ 11 specialized subagents — research, planning, execution, verification, debugging
- ✓ State-driven workflows with `.planning/` artifacts — PROJECT.md, ROADMAP.md, STATE.md, REQUIREMENTS.md
- ✓ Hooks for status display and update checks — gsd-statusline.js, gsd-check-update.js
- ✓ Frontmatter conversion between runtimes — YAML <-> TOML, permission mapping
- ✓ Path replacement for global/local installs — `~/.claude/` → actual paths
- ✓ Model profiles for agent spawning — quality, balanced, budget
- ✓ Orchestrator-agent architecture with parallel execution
- ✓ Plan checker agent for plan verification
- ✓ Verification agents for post-execution checks

*v2.1 Adversary Agent — shipped 2026-02-13*

- ✓ Single gsd-adversary agent with checkpoint adaptation — v2.1
- ✓ Adversary challenges after requirements definition — v2.1
- ✓ Adversary challenges after roadmap creation — v2.1
- ✓ Adversary challenges after each plan creation — v2.1
- ✓ Adversary challenges after verification conclusions — v2.1
- ✓ Iterative debate loop until adversary signals "no objections" — v2.1
- ✓ Claude makes final decision after max rounds if no convergence — v2.1
- ✓ Dynamic challenge style adapting to artifact type — v2.1
- ✓ Global toggle enables/disables adversary in config.json — v2.1
- ✓ Max rounds configurable in config.json — v2.1
- ✓ Individual checkpoints can be toggled on/off — v2.1

### Active

*Next milestone — TBD*

(Run `/gsd:new-milestone` to define requirements for next milestone)

### Out of Scope

- Adversary during execution — Too disruptive to atomic commit flow
- User-mediated disputes — Claude resolves, adversary is advisory
- Specialized per-checkpoint agents — Single agent adapts to context
- Blocking on adversary objections — Advisory only, Claude decides
- Different model for adversary — Adds complexity; advisory-only design mitigates same-model collusion risk

## Context

GSD v2.1 ships with 12 specialized subagents including gsd-adversary, 27+ slash commands, and adversarial review at four workflow checkpoints. The adversary integration uses consistent patterns across commands: config reading via node -e, debate loops with CONV-01 hard cap, and agent-as-defender revision for complex artifacts.

Tech stack: Node.js installer, Markdown prompts with YAML frontmatter, JSON configuration, bash hooks.

## Constraints

- **Architecture**: Must fit existing orchestrator-agent pattern — agent spawned via Task tool
- **Context**: Agent must work with fresh context window (no conversation history)
- **Convergence**: Max 3 rounds before Claude decides (prevent infinite loops)
- **Style**: Adversary adapts tone — rigorous on feasibility, constructive on completeness, devil's advocate on assumptions
- **Runtime**: Must work across Claude Code, OpenCode, and Gemini CLI

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Single agent vs specialized | Reduces maintenance, patterns apply universally | ✓ Good |
| Advisory vs blocking | Prevents workflow deadlock, Claude owns final call | ✓ Good |
| Dynamic style | Different challenges need different approaches | ✓ Good |
| zpyoung community fork | Original TACHES project evolved to community-maintained | ✓ Good |
| Stateless rounds | Simpler implementation, forces context to be self-contained | ✓ Good |
| Planner-as-defender | Re-spawn planner for revisions with plan-level knowledge | ✓ Good |
| Verifier-as-defender | Re-spawn verifier for targeted re-examination | ✓ Good |
| Node-e config parsing | Polymorphic values need real JSON parser, not grep | ✓ Good |
| Post-adversary status re-read | Catches status downgrades from verifier re-examination | ✓ Good |
| Adversary opt-out | Enabled by default, missing config = system defaults | ✓ Good |

---
*Last updated: 2026-02-13 after v2.1 milestone completion*
