---
type: Fixed
pr: 3276
---
phase-plan-index no longer collapses wave 0 to wave 1, and now buckets plans using their depends_on DAG so dependents run after their dependencies rather than in the same parallel wave
