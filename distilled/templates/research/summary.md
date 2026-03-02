# Research Summary

**Date:** [YYYY-MM-DD]
**Topic:** [Domain/feature area]
**Milestone context:** [greenfield | subsequent]

## Executive Summary (5-10 bullets)
- [What we learned, in actionable terms — one concrete insight per bullet]

## Confidence Assessment

| Area | Confidence | Rationale |
|------|-----------|-----------|
| Stack choices | ✅ verified / ⚠️ likely / ❓ uncertain | [why] |
| Feature set | ✅ verified / ⚠️ likely / ❓ uncertain | [why] |
| Architecture pattern | ✅ verified / ⚠️ likely / ❓ uncertain | [why] |
| Key pitfalls | ✅ verified / ⚠️ likely / ❓ uncertain | [why] |

## Recommendations (Prescriptive)

For each recommendation, include confidence and the evidence.

1. Recommendation: [Use X / Avoid Y]
   - Confidence: [verified | likely | uncertain]
   - Why: [short rationale]
   - Evidence: [URL(s)]
   - Counterpoints / tradeoffs: [what would change the decision]

## Non-Goals / Anti-Features
- [What we explicitly will not do in v1, and why — grounded in research findings]

## Pitfalls To Avoid
- [Concrete mistakes teams make in this domain — phase-mapped where possible]

## Open Questions (Blockers)
- [What must be decided before planning can proceed]

## Implications for Roadmap

This section is the critical handoff from research to ROADMAP.md. The roadmapper reads this.

### Suggested Phase Structure
Derived from architecture build order + pitfall avoidance priorities:

| Phase | Focus | Rationale |
|-------|-------|-----------|
| Phase 1 | [Foundation: e.g., data model + auth] | [why this must come first — dependency or risk] |
| Phase 2 | [Core: e.g., primary user workflow] | [what unblocks after Phase 1] |
| Phase 3 | [Integration: e.g., external services] | [why deferred — complexity or dependency] |
| Phase N | [Polish / edge cases] | [why last] |

### Research Flags (Phase-Level)
These are signals for the planner — which phases need deeper domain research vs standard patterns:

| Phase | Flag | Reason |
|-------|------|--------|
| Phase 1 | ⚠️ Needs deeper research | [e.g., "auth pattern depends on regulatory context"] |
| Phase 2 | ✅ Standard pattern | [e.g., "CRUD with established library — no surprises"] |
| Phase N | ❓ Uncertain | [e.g., "real-time sync has multiple viable approaches"] |

## Sources

| Claim | URL | Accessed |
|-------|-----|---------|
| [Stack recommendation] | [URL] | [YYYY-MM-DD] |
| [Architecture pattern] | [URL] | [YYYY-MM-DD] |
| [Pitfall] | [URL] | [YYYY-MM-DD] |
