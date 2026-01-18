---
phase: 02-data-quality-ai-recommendations
plan: 01
subsystem: api
tags: [strands, bedrock, dqdl, glue, lambda, apigateway, supabase, python]

# Dependency graph
requires:
  - phase: 01-foundation-data-profiling
    provides: Profile data schemas (datasets table), Strands agent patterns, CDK structure
provides:
  - DQ Recommender agent with 5 DQDL rule generation tools
  - 13 industry-standard rule templates
  - Database schema for rules with approval workflow
  - Approval Lambda with Step Functions integration
  - HTTP API endpoint for rule approvals
affects: [02-02-PLAN, 02-03-PLAN, 03-validation-execution]

# Tech tracking
tech-stack:
  added:
    - strands-agents>=1.0.0 (reused)
    - boto3>=1.35.0 (reused)
    - pydantic>=2.0.0 (reused)
    - aws-lambda-powertools>=3.0.0
    - aws-apigatewayv2
  patterns:
    - Bedrock Converse API for DQDL generation (temp=0.2)
    - Strands @tool pattern with JSON string returns
    - Template library with escaped regex quantifiers
    - Step Functions waitForTaskToken callback pattern
    - Lambda Powertools for API resolution

key-files:
  created:
    - agents/dq_recommender/agent.py
    - agents/dq_recommender/tools/rule_generator.py
    - agents/dq_recommender/tools/glue_recommender.py
    - agents/dq_recommender/tools/template_library.py
    - agents/dq_recommender/tools/remediation.py
    - agents/dq_recommender/schemas.py
    - agents/dq_recommender/prompts.py
    - supabase/migrations/002_dq_rules.sql
    - lambdas/approval_handler/handler.py
    - infra/lib/dq-recommender-stack.ts
  modified:
    - infra/bin/app.ts

key-decisions:
  - "Bedrock Converse API with temp=0.2 for consistent DQDL generation"
  - "Double braces {{}} for regex quantifiers in template patterns (Python format escaping)"
  - "DQRecommenderAgentProxy for lazy loading (mirrors profiler pattern)"
  - "Approval Lambda uses Lambda Powertools APIGatewayHttpResolver"
  - "No FK to auth.users in dq_rules (environment flexibility)"

patterns-established:
  - "DQDL rule generation: Natural language + profile context -> DQDL syntax"
  - "Template application: Parameterized patterns with {col} placeholder"
  - "Remediation mapping: Issue type -> prioritized suggestions"
  - "Approval webhook: POST with taskToken -> send_task_success/failure"

# Metrics
duration: 8min
completed: 2026-01-18
---

# Phase 02 Plan 01: DQ Recommender Agent Summary

**Strands DQ Recommender agent with Bedrock DQDL generation, 13 industry rule templates, approval Lambda with Step Functions callback, and HTTP API Gateway**

## Performance

- **Duration:** 8 min
- **Started:** 2026-01-18T21:16:15Z
- **Completed:** 2026-01-18T21:23:46Z
- **Tasks:** 2
- **Files modified:** 15

## Accomplishments

- DQ Recommender agent with 5 tools for rule generation, templates, Glue recommendations, and remediation
- 13 industry-standard rule templates covering email, phone, date, SSN, UUID, currency, and more
- Database schema with dq_rules, rule_templates, and rule_approval_requests tables
- Approval Lambda handling Step Functions waitForTaskToken callbacks
- HTTP API Gateway endpoint at /approvals for human approval workflow

## Task Commits

Each task was committed atomically:

1. **Task 1: DQ Recommender Agent with Tools** - `6c90f7e` (feat)
2. **Task 2: Database Schema and Approval Lambda** - `fbed27f` (feat)

## Files Created/Modified

- `agents/dq_recommender/agent.py` - Strands agent with BedrockModel (claude-sonnet-4)
- `agents/dq_recommender/tools/rule_generator.py` - Natural language to DQDL via Bedrock Converse
- `agents/dq_recommender/tools/glue_recommender.py` - AWS Glue ML recommendations API
- `agents/dq_recommender/tools/template_library.py` - 13 parameterized rule templates
- `agents/dq_recommender/tools/remediation.py` - Remediation suggestions for 8 issue types
- `agents/dq_recommender/schemas.py` - Pydantic models for rules and generation
- `agents/dq_recommender/prompts.py` - System prompt with DQDL syntax reference
- `supabase/migrations/002_dq_rules.sql` - 3 tables, 8 indexes, RLS policies, 10 seeded templates
- `lambdas/approval_handler/handler.py` - Step Functions callback handler
- `lambdas/approval_handler/requirements.txt` - Lambda dependencies
- `infra/lib/dq-recommender-stack.ts` - Lambda + API Gateway CDK stack
- `infra/bin/app.ts` - Added DQRecommenderStack

## Decisions Made

1. **Bedrock Converse API with temperature 0.2** - Low temperature ensures consistent, reliable DQDL rule generation. Higher temperatures led to more creative but less syntactically correct rules in testing.

2. **Double braces for regex quantifiers** - Python's `.format()` interprets `{2,}` as a placeholder. Using `{{2,}}` escapes to produce correct regex like `[a-zA-Z]{2,}` in the output.

3. **DQRecommenderAgentProxy pattern** - Mirrors the profiler agent's lazy loading approach. Allows module import without strands-agents installed, failing only when agent is actually invoked.

4. **Lambda Powertools APIGatewayHttpResolver** - Cleaner routing than raw event parsing. Provides automatic JSON body parsing, exception handling, and response formatting.

5. **No FK to auth.users in dq_rules** - auth.users table may not exist in all Supabase environments. Using UUID columns without foreign keys provides flexibility while maintaining data integrity through application logic.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Regex quantifier escaping in templates**
- **Found during:** Task 1 (template_library.py testing)
- **Issue:** Python's `.format()` interpreted `{2,}` as a placeholder, causing KeyError
- **Fix:** Changed all regex quantifiers from `{N}` to `{{N}}` in template patterns
- **Files modified:** agents/dq_recommender/tools/template_library.py
- **Verification:** apply_rule_template('email_validity', 'email') returns correct DQDL
- **Committed in:** 6c90f7e

---

**Total deviations:** 1 auto-fixed (bug)
**Impact on plan:** Minor fix for Python string formatting. No scope creep.

## Issues Encountered

- **Agent import outside package context** - Direct Python execution from CLI fails relative imports. Resolved by using full package path when testing. Works correctly when installed as package or in container.

## User Setup Required

None - no external service configuration required for this plan.

## Next Phase Readiness

**Ready for Plan 02-02:**
- DQ Recommender agent available for validation workflow integration
- Approval Lambda ready for Step Functions orchestration
- Database schema ready for rule storage and approval tracking

**Dependencies for future plans:**
- Plan 02-02: Validation execution using generated rules
- Plan 02-03: Alert system using rule results
- Phase 03: Frontend for rule management and approval UI

---
*Phase: 02-data-quality-ai-recommendations*
*Completed: 2026-01-18*
