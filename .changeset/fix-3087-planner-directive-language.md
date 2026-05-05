---
type: Fixed
pr: 3138
---
**`gsd-planner.md` directive language restored** — 10 instances of `CRITICAL`/`MANDATORY`/`ALWAYS`/`MUST` emphasis were silently removed in v1.38.4 (PR #2489) without documentation, conflicting with that release's stated sycophancy-hardening intent. Downstream effect: planner output in v1.38.4–v1.40.x exhibited weaker adherence to user decisions and requirement coverage, as observed in #3087. Restored: `CRITICAL: User Decision Fidelity`, `CRITICAL: Never Simplify User Decisions`, `Multi-Source Coverage Audit (MANDATORY in every plan set)`, `Audit ALL four source types`, `Discovery is MANDATORY`, `ALWAYS split if:`, `requirements MUST list`, `CRITICAL: Every requirement ID MUST appear`, `ALWAYS use the Write tool`, and `CRITICAL — File naming convention`. Closes #3087.
