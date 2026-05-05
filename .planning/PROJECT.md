# SME Agent Framework

## What This Is

A Subject Matter Expert (SME) agent framework for Get Shit Done that captures domain-specific process knowledge and enforces it during planning and execution. When a project has multiple processes with different conventions, patterns, and edge cases, SMEs ensure GSD respects each process's unique requirements instead of applying a one-size-fits-all approach.

## Core Value

The plan-phase gate: SMEs must catch domain-specific risks and pattern mismatches before code gets written, not after.

## Requirements

### Validated

- [x] SDK query handlers for SME data access (smeList, smeDetectProcesses, smeContextBlock) — Validated in Phase 2: SDK Query Handlers
- [x] SME creator agent that analyzes codepaths and generates structured SME documents — Validated in Phase 3: SME Creator Agent
- [x] /gsd-create-sme command for manual SME creation and refresh — Validated in Phase 4: Creation Command & Workflow
- [x] SME context injection following existing skill pattern (loaded via agent-skills query) — Validated in Phase 4: Creation Command & Workflow
- [x] SME creation uses all available context: code, git history, comments, docs, PR descriptions — Validated in Phase 3: SME Creator Agent
- [x] gsd-sme-auditor agent that audits plans for process-specific risks and domain concerns — Validated in Phase 5: SME Auditor Agent
- [x] SME documents in .planning/smes/{PROCESS_NAME}-SME.md with structured severity-labeled findings — Validated in Phase 5: SME Auditor Agent
- [x] Plan-phase gate where SME reviews generated plans against known risks and flags concerns — Validated in Phase 6: Plan-Phase Gate
- [x] Configurable blocking: soft warning by default, strict mode per-process — Validated in Phase 6: Plan-Phase Gate
- [x] SME integration in discuss-phase that injects domain-specific probing questions — Validated in Phase 7: Discuss-Phase Integration
- [x] Process detection during new-milestone that identifies which processes the milestone touches — Validated in Phase 8: New-Milestone Process Detection
- [x] Post-execution SME refresh that updates process knowledge based on code changes — Validated in Phase 9: Post-Execution Refresh
- [x] Opt-in via config flag workflow.use_sme_agents (default: false) — Validated in Phase 1: Schema & Config
- [x] Backward compatible — all SME steps skipped when disabled, existing workflows unchanged — Validated in Phase 1: Schema & Config

### Active

(All v1 requirements validated — no active requirements remain)

### Out of Scope

- Real-time SME monitoring during execution (SME reviews plans before and updates after, not during)
- Cross-project SME sharing (SMEs are per-project, not global)
- SME conflict resolution when multiple SMEs disagree (handle manually for v1)
- UI/dashboard for SME findings (CLI output is sufficient)

## Context

GSD currently writes code that works but doesn't match existing process-specific conventions. In applications with multiple process types (e.g., contributions vs claims vs enrollment in an HSA engine), each process may have different validation patterns, edge case handling, and domain rules. GSD's planner and executor lack this process-level awareness, leading to wrong patterns applied and domain edge cases missed.

The SME framework addresses this by capturing process knowledge in structured documents that get injected into planning and execution agents — similar to how security auditing works but focused on domain/process correctness.

SMEs follow the existing skill injection pattern (.claude/skills/ SKILL.md mechanism via agent-skills query), keeping integration consistent with GSD's current architecture.

## Constraints

- **Compatibility**: Must work with existing GSD installations without breaking changes — all SME features opt-in
- **Architecture**: SME documents follow existing patterns (like gsd-security-auditor) and use the skill injection mechanism
- **Token budget**: SME creation analyzes entire process codepaths, which is token-intensive — must be clearly communicated to users
- **Validation target**: Must successfully identify known issues in the HSA engine codebase (contribution fraud logic, member-ID character limit fragility, COVID-era logic)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Opt-in by default (workflow.use_sme_agents: false) | Backward compatibility, token cost awareness | — Pending |
| Configurable blocking (soft default, strict per-process) | Different processes have different risk tolerance | — Pending |
| Follow existing skill injection pattern | Consistency with GSD architecture, no new injection mechanism | — Pending |
| SMEs use all available context (code + git + docs + PRs) | Maximize domain understanding, especially the "why" behind patterns | — Pending |
| Plan-phase gate is the core value | Highest leverage — catch issues before code is written | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? -> Move to Out of Scope with reason
2. Requirements validated? -> Move to Validated with phase reference
3. New requirements emerged? -> Add to Active
4. Decisions to log? -> Add to Key Decisions
5. "What This Is" still accurate? -> Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-05 after Phase 11 completion (all v1 milestone phases complete)*
