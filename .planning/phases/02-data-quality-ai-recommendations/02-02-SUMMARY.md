---
phase: 02-data-quality-ai-recommendations
plan: 02
subsystem: api
tags: [glue, stepfunctions, eventbridge, lambda, supabase, bedrock, dqdl, validation, alerting]

# Dependency graph
requires:
  - phase: 02-data-quality-ai-recommendations
    plan: 01
    provides: DQ Recommender agent, approval Lambda, dq_rules schema
provides:
  - Validation workflow with Step Functions orchestration
  - Glue DQ result processing Lambda
  - Alert handler Lambda with EventBridge routing
  - Freshness monitor Lambda with scheduled checks
  - Database schema for validation runs, results, alerts, SLAs
  - API endpoints for validations, rules, alerts, and rule generation
affects: [02-03-PLAN, 02-04-PLAN, 03-frontend-dashboard]

# Tech tracking
tech-stack:
  added:
    - "@aws-sdk/client-bedrock-runtime (backend)"
  patterns:
    - Step Functions validation workflow with Glue DQ integration
    - waitForTaskToken for human approval gate
    - EventBridge event routing for alert types
    - Scheduled Lambda for freshness monitoring
    - Bedrock Converse API for DQDL generation in backend

key-files:
  created:
    - supabase/migrations/003_validation_results.sql
    - lambdas/validator/handler.py
    - lambdas/alert_handler/handler.py
    - lambdas/freshness_monitor/handler.py
    - infra/lib/validator-stack.ts
    - infra/lib/alerting-stack.ts
    - backend/api/validations/route.ts
    - backend/api/validations/[id]/route.ts
    - backend/api/rules/route.ts
    - backend/api/rules/[id]/route.ts
    - backend/api/rules/generate/route.ts
    - backend/api/alerts/route.ts
    - backend/api/alerts/[id]/route.ts
  modified:
    - infra/bin/app.ts
    - backend/package.json

key-decisions:
  - "SQS visibility timeout 12h max (CDK limitation vs 24h approval window)"
  - "Glue DQ polling loop in Step Functions (vs sync integration)"
  - "Quality score threshold 0.8 for alert trigger"
  - "Bedrock Converse API direct call in backend (vs agent invocation)"
  - "Freshness monitor schedule every 15 minutes"
  - "Volume anomaly thresholds: <50% or >200% of 7-run average"

patterns-established:
  - "Validation workflow: CheckRuleStatus -> Approval -> Glue DQ -> ProcessResults -> Alert"
  - "EventBridge routing: source=data-quality.* -> alert_handler Lambda"
  - "Rule generation endpoint: POST /api/rules/generate with Bedrock integration"
  - "Alert status management: open -> acknowledged -> resolved"

# Metrics
duration: 10min
completed: 2026-01-18
---

# Phase 02 Plan 02: Data Validator System Summary

**Step Functions validation workflow with Glue DQ integration, freshness monitoring, EventBridge alerting, and API endpoints including AI rule generation**

## Performance

- **Duration:** 10 min
- **Started:** 2026-01-18T21:26:22Z
- **Completed:** 2026-01-18T21:36:26Z
- **Tasks:** 3
- **Files modified:** 15

## Accomplishments

- Complete validation workflow with approval gate, Glue DQ execution, and result processing
- Alert system routing quality failures, freshness violations, and volume anomalies via EventBridge
- Freshness monitor with scheduled 15-minute checks for SLA enforcement
- API endpoints enabling validation triggers, rule CRUD, alert management, and AI rule generation
- Database schema for validation_runs, rule_results, quality_scores, alerts, and freshness_slas

## Task Commits

Each task was committed atomically:

1. **Task 1: Validation Lambdas and Database Schema** - `22cfd7c` (feat)
2. **Task 2: CDK Infrastructure and Step Functions Workflow** - `0a286d4` (feat)
3. **Task 3: Backend API Endpoints with DQ Recommender Integration** - `a80c472` (feat)

## Files Created/Modified

- `supabase/migrations/003_validation_results.sql` - 5 tables: validation_runs, rule_results, quality_scores, alerts, freshness_slas
- `lambdas/validator/handler.py` - Processes Glue DQ results, calculates dimension scores
- `lambdas/alert_handler/handler.py` - Creates alert records, emits EventBridge notifications
- `lambdas/freshness_monitor/handler.py` - Checks SLAs, detects volume anomalies
- `infra/lib/validator-stack.ts` - Step Functions workflow with Glue DQ integration
- `infra/lib/alerting-stack.ts` - EventBridge rules and scheduled freshness checks
- `infra/bin/app.ts` - Added ValidatorStack and AlertingStack
- `backend/api/validations/route.ts` - List and trigger validation runs
- `backend/api/validations/[id]/route.ts` - Validation details and cancellation
- `backend/api/rules/route.ts` - CRUD for DQ rules with DQDL validation
- `backend/api/rules/[id]/route.ts` - Rule details, approve/reject
- `backend/api/rules/generate/route.ts` - AI rule generation via Bedrock
- `backend/api/alerts/route.ts` - List alerts with filters
- `backend/api/alerts/[id]/route.ts` - Alert details and status management
- `backend/package.json` - Added @aws-sdk/client-bedrock-runtime

## Decisions Made

1. **SQS visibility timeout 12h max** - CDK enforces 43200s (12h) maximum. Approval window still uses Step Functions timeout for 24h, but SQS visibility is 12h.

2. **Glue DQ polling loop** - Step Functions polls Glue status every 30s instead of using sync integration (`.sync`). More flexible for error handling and progress tracking.

3. **Quality score threshold 0.8** - Alerts trigger when overall_score < 0.8. This threshold balances sensitivity with alert fatigue. Can be made configurable.

4. **Bedrock Converse API in backend** - Direct API call instead of invoking the agent Python code. Simpler for TypeScript backend, same underlying model.

5. **15-minute freshness schedule** - Balances responsiveness with cost. Critical datasets can have tighter SLAs checked more frequently if needed.

6. **Volume anomaly thresholds** - <50% or >200% of 7-run average. Catches both data loss and unexpected data surges.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] SQS visibility timeout exceeds CDK limit**
- **Found during:** Task 2 (validator-stack.ts)
- **Issue:** CDK validation error: visibility timeout max is 43200s (12h), not 86400s (24h)
- **Fix:** Changed visibility timeout to 12 hours; Step Functions timeout remains 25h for full approval window
- **Files modified:** infra/lib/validator-stack.ts
- **Verification:** CDK synth passes
- **Committed in:** 0a286d4

---

**Total deviations:** 1 auto-fixed (blocking)
**Impact on plan:** Minor adjustment to SQS config. Approval flow unaffected - Step Functions handles 24h timeout separately.

## Issues Encountered

None - plan executed smoothly after fixing the SQS timeout constraint.

## User Setup Required

None - no external service configuration required for this plan.

## Next Phase Readiness

**Ready for Plan 02-03:**
- Validation workflow infrastructure deployed
- Alert system ready for dashboard integration
- API endpoints available for frontend consumption
- Rule generation endpoint enables AI-assisted rule creation

**Dependencies for future plans:**
- Plan 02-03: Quality dashboard UI can query validation results
- Plan 02-04: Alert acknowledgment/resolution through API
- Phase 03: Full validation and alert management in frontend

---
*Phase: 02-data-quality-ai-recommendations*
*Completed: 2026-01-18*
