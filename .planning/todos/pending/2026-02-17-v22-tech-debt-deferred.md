# v2.2 Tech Debt — Deferred

**Created:** 2026-02-17
**Source:** v2.2 Milestone Audit (tech_debt status)
**Area:** testing, docs, config
**Priority:** should/nice (non-blocking)

## Items

### Should

1. **Stale docs/reference/commands.md** — `/gsd:settings` entry lists 5 of 15 actual settings. Update to document all co-planner settings.
2. **No unit tests for co-planner infrastructure** — `checkKillSwitch`, `getAgentsForCheckpoint`, `filterValidAgents` have no unit tests. `classifyError` is fully tested (27 tests).

### Nice

3. **Truth #3 no dynamic test** (Phase 7) — "enabled but no agents configured" warning path is code-verified but no functional test exercises it. Simple conditional, low risk.
4. **Parallel execution timing untested at runtime** (Phase 9) — Static analysis confirms async `exec`. True concurrency only observable at runtime. Node.js event loop guarantees.
5. **Partial failure E2E untested** (Phase 9) — Each segment individually verified but full path not run with real missing CLI. Low risk.
6. **Config template vs. defaults mismatch** — Template includes `agents[]` and `checkpoints{}`, init code writes only `enabled` + `timeout_ms`. Handled defensively, non-breaking.

## Context

All 11 v2.2 requirements satisfied. All 6 phases passed. All 12 integrations wired. All 7 E2E flows complete. These items are polish for a future milestone.
