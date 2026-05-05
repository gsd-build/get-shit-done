# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — SME Agent Framework

**Shipped:** 2026-05-05
**Phases:** 11 | **Plans:** 17

### What Was Built
- SME document schema, config flags, and template CLI command
- SDK query handlers (sme.list, sme.detect-processes, sme.context-block) with full test coverage
- Creator agent with parallel sub-agent decomposition for code/git/PR analysis
- `/gsd-create-sme` command with interactive workflow and fuzzy overlap detection
- Adversarial auditor agent with structured return markers and read-only enforcement
- Plan-phase gate (step 12.6) — the core product value — with soft/strict blocking
- Full lifecycle loop: discuss probing → plan gate → post-execution refresh → new-milestone detection

### What Worked
- TDD discipline (RED → GREEN commit pattern) caught structural issues early and provided confidence during integration
- Phase dependency graph was well-designed — each phase shipped independently testable artifacts
- Milestone audit after Phase 9 caught 3 real integration bugs (CONFIG-03, DETECT-04, DETECT-05) that would have been silent failures in production
- Gap closure phases (10, 11) were scoped tightly and completed in a single session each

### What Was Inefficient
- SUMMARY.md one-liner fields were not consistently populated across early phases, causing noisy MILESTONES.md auto-generation
- Some phases had incomplete SUMMARY.md `requirements-completed` frontmatter, requiring a dedicated Phase 11 to backfill — could have been caught incrementally
- Phase 8 (new-milestone detection) shipped with unresolved template placeholders and missing completion marker checks — integration testing within the phase would have caught this

### Patterns Established
- Lazy-loaded sme-step.md pattern for injecting optional workflow steps without bloating the parent workflow
- `frontmatter.merge` for STATE.md writes (avoids custom field loss from state.update/state.patch)
- Structural tests (.test.cjs) for markdown agent/workflow definitions — verifies content presence without requiring agent execution
- Config guard pattern: every SME integration point checks `use_sme_agents` as first step and returns early

### Key Lessons
1. Milestone audits should run after every 3-4 phases, not just at the end — the Phase 9 audit found integration bugs that would compound over time
2. SUMMARY.md frontmatter should be validated as a verification gate, not backfilled in a doc-sync phase
3. Template placeholder resolution (`{CREATOR_MODEL}`, `{AGENT_SKILLS_CREATOR}`) should be tested structurally in the phase that introduces the template, not discovered by cross-phase integration checks
4. MODEL_PROFILES registration for new agents should be part of the agent creation phase, not deferred as tech debt

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v1.0 | 11 | 17 | TDD structural tests for markdown agent definitions; milestone audit gap closure |

### Top Lessons (Verified Across Milestones)

1. Integration testing across phases catches bugs that per-phase verification misses
2. Metadata tracking (frontmatter, checkboxes, traceability) should be enforced incrementally, not batch-synced
