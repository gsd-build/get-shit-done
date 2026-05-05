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

**Shipped v1.0** on 2026-05-05 with 11 phases, 17 plans, 82 commits, ~12K lines across 79 files.

The SME framework captures process knowledge in structured documents (`.planning/smes/{PROCESS}-SME.md`) that get injected into planning and execution agents. The core loop: discuss-phase probing questions surface domain risks → plan-phase gate (step 12.6) audits plans against SME findings → post-execution refresh keeps SMEs current → new-milestone detection queues relevant SMEs.

**Tech stack:** TypeScript SDK query handlers + markdown agent definitions + CJS CLI tooling. Three SDK handlers (`sme.list`, `sme.detect-processes`, `sme.context-block`), three agents (`gsd-sme-creator`, `gsd-sme-creator-analyzer`, `gsd-sme-auditor`), one command (`/gsd-create-sme`), and integration points in plan-phase, discuss-phase, execute-phase, and new-milestone workflows.

**Known tech debt:** SME agents not in MODEL_PROFILES (silent sonnet fallback), SDK/CJS config default asymmetry for `sme.blocking`, discuss-phase gating contract mismatch.

## Constraints

- **Compatibility**: Must work with existing GSD installations without breaking changes — all SME features opt-in
- **Architecture**: SME documents follow existing patterns (like gsd-security-auditor) and use the skill injection mechanism
- **Token budget**: SME creation analyzes entire process codepaths, which is token-intensive — must be clearly communicated to users
- **Validation target**: Must successfully identify known issues in the HSA engine codebase (contribution fraud logic, member-ID character limit fragility, COVID-era logic)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Opt-in by default (workflow.use_sme_agents: false) | Backward compatibility, token cost awareness | ✓ Good — zero impact on existing projects |
| Configurable blocking (soft default, strict per-process) | Different processes have different risk tolerance | ✓ Good — sme.blocking config + per-process block_mode frontmatter |
| Follow existing skill injection pattern | Consistency with GSD architecture, no new injection mechanism | ✓ Good — agent-skills, subagent_type spawning, lazy-loaded sme-step.md |
| SMEs use all available context (code + git + docs + PRs) | Maximize domain understanding, especially the "why" behind patterns | ✓ Good — git log --follow, PR grep, parallel sub-agent analysis |
| Plan-phase gate is the core value | Highest leverage — catch issues before code is written | ✓ Good — step 12.6 with soft/strict routing, staleness warnings |
| SME document schema: 6 flat H2 sections, severity-labeled findings | Consistent structure for machine parsing and auditor consumption | ✓ Good — round-trips through frontmatter.cjs, all sections validated |
| Step 12.6 (not 12.5) for gate position | Existing step 12.5 Plan Bounce conflict | ✓ Good — positional requirement satisfied without disrupting existing flow |
| frontmatter.merge for STATE.md writes | Avoids state.update/state.patch which lose custom fields | ✓ Good — active_smes preserved across state operations |

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
*Last updated: 2026-05-05 after v1.0 milestone completion*
