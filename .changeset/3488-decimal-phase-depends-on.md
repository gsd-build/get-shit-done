---
type: Fixed
pr: 3488
---
**`phase-plan-index` resolves short-form `depends_on: [NN]` for decimal-phase plans** — the DAG resolver only matched full-stem (`03-01-auth-hardening`) and canonical-prefix (`03-01`) forms, so plans in decimal phases (e.g. `99.9-test`, `02.2-cross-repo`) declaring `depends_on: [01]` had their edges silently dropped. Dependents collapsed into wave 1 and the SDK emitted a misleading `declared wave: N but depends_on DAG places it in wave 1` warning that pointed at the wave declaration rather than the broken reference. A tertiary short-form index now maps the trailing `-NN` of every plan ID to its full ID for same-phase short-form lookups, and unresolved `depends_on` references surface a dedicated `Plan X: unresolved depends_on reference 'NN' — no matching plan in phase` warning so the dropped edge can no longer hide behind the wave-mismatch warning. (#3488)
