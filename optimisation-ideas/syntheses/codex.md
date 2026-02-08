# GSD Context Optimization Proposal
Goal: Reduce unnecessary context load while preserving or improving execution quality and speed.

---

## Executive Summary
GSD is already moving toward leaner orchestration and centralized tooling. The next step is to systematically shift logic out of prompts and into deterministic tooling, while loading only the instructions needed for the current step. This proposal delivers that outcome through a phased approach:

1. Immediate context diet with fast ROI and minimal risk.
2. Prompt modularization to reduce baseline agent size.
3. Precompiled execution artifacts to strip unused protocols.
4. Railroad (state machine) architecture for long-term determinism.

This balances speed, quality, and maintainability while protecting GSD's core instructional content.

---

## Problem Statement
GSD's effectiveness depends on rich instructional content, but its current context load includes large, often unused sections. As context usage grows, quality degrades and speed drops. The system needs a precision-loading strategy: only bring into context what's needed for the next step, and let deterministic tooling enforce the process.

---

## Design Principles
- Demand-load over eager-load: Load instructions only when needed.
- Deterministic orchestration: Move branching logic into code.
- Stable core, modular extensions: Keep minimal core prompts and load extensions conditionally.
- Measurable quality: Reductions must not degrade verification pass rates.

---

## Proposed Strategy

### 1) Immediate Context Diet (Quick Wins)
- History digest: Load structured summaries instead of full history.
- State patch ops: Read only the state sections required.
- Summary template variants: Choose minimal or standard templates based on complexity.
- Compound init sweep: Consolidate context loading into a single structured payload.

Impact: Faster startup, lower context load, minimal refactor risk.

---

### 2) Prompt Modularity (High Impact, Moderate Effort)
- Split large agents into core + extensions.
- Load extensions only when triggered by plan characteristics or flags.
- Add a context budget mode (min|std|full) with escalation when needed.

Impact: Large baseline prompt reduction without behavior regression.

---

### 3) Compiled Plans (Performance + Precision)
- Pre-compile plans by resolving references and stripping unused protocols.
- Cache compiled outputs; recompile on source change.

Impact: Significant runtime context reduction and faster execution start.

---

### 4) Railroad Architecture (Long-Term Determinism)
- gsd-tools becomes a state machine, returning the next action step.
- Agents only see current step + immediate context.
- Enables JIT context and prevents step skipping.

Impact: Maximum context efficiency and reliability, higher implementation cost.

---

## Phased Roadmap

### Phase 1: Quick Wins (1-2 days)
1. Add history-digest to gsd-tools.
2. Add state get/patch operations.
3. Add summary template variants.
4. Finish compound init sweep.

### Phase 2: Prompt Modularity (3-5 days)
1. Split gsd-executor into core + conditional references.
2. Split gsd-planner into core + extensions.
3. Add context budget mode.

### Phase 3: Compiled Plans (3-5 days)
1. Implement compile-plan.
2. Strip unused protocols based on plan metadata.
3. Cache compiled outputs with mtime checks.

### Phase 4: Railroad Architecture (5-10 days)
1. Implement next-step state machine.
2. Migrate workflows to deterministic code.
3. Add micro-agent chaining with context flush.

---

## Success Metrics
- Average context usage under 40% at task start.
- Verification pass rate >= 95%.
- No measurable latency increase from dynamic loading.
- Stable or improved deviation rate.
- Reduced user "skip" frequency during checkpoints.

---

## Risks and Mitigations
- Missing edge-case instructions
  Mitigation: fallback to full prompt under --context=full.
- Compiled plan staleness
  Mitigation: mtime checks and auto-recompile.
- Railroad refactor complexity
  Mitigation: incremental rollout with feature flags.

---

## Recommendation
Start with Phase 1 and Phase 2 immediately. These deliver the largest context reductions per unit of risk and pave the way for compiled plans and the Railroad architecture. Once stable, proceed to Phase 3 and Phase 4.

---

## Proposed Next Steps
1. Approve Phase 1 scope and timeline.
2. Decide acceptable tolerance for architectural refactors.
3. Choose quality metrics and thresholds for go/no-go.

If you want, I can turn this into actionable tickets with acceptance criteria and an initial implementation plan for gsd-tools and prompt splits.
