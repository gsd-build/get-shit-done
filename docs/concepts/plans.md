# Plans

A **Plan** is an executable prompt — the actual instruction set Claude executes. Plans contain 2-3 tasks each and include verification criteria for goal-backward validation.

## Overview

| Attribute | Value |
|-----------|-------|
| **Location** | `.planning/phases/{NN}-{name}/{phase}-{plan}-PLAN.md` |
| **Created by** | `gsd-planner` agent during `/gsd:plan-phase` |
| **Executed by** | `gsd-executor` agent during `/gsd:execute-phase` |
| **Output** | `{phase}-{plan}-SUMMARY.md` after execution |

## Key Principle

> **A plan IS the prompt.** It's not a document that gets transformed into instructions — it IS the instruction set Claude executes.

## Plan Structure

### Frontmatter (YAML)

```yaml
---
phase: 02-authentication
plan: 01
type: execute                    # or "tdd" for test-driven
wave: 1                          # Execution order (1, 2, 3...)
depends_on: []                   # Other plans required first
files_modified:                  # Files this plan touches
  - src/auth/login.ts
  - src/auth/middleware.ts
autonomous: true                 # false if has checkpoints

must_haves:
  truths:                        # Observable behaviors
    - "User can log in with email/password"
    - "Invalid credentials show error"
  artifacts:                     # Files that must exist
    - path: "src/auth/login.ts"
      provides: "Login endpoint"
  key_links:                     # Critical connections
    - from: "LoginForm.tsx"
      to: "/api/auth/login"
      via: "form submission"
---
```

### Body Sections

```markdown
<objective>
Implement JWT authentication with refresh token rotation for secure user sessions.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/execute-plan.md
@~/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@.planning/ROADMAP.md
@src/app/api/auth/[...existing files...]
</context>

<tasks>
<task id="1" type="auto">
  <files>src/auth/login.ts, src/auth/types.ts</files>
  <action>
    Create POST /api/auth/login endpoint that:
    - Accepts {email, password} body
    - Validates credentials against database
    - Returns JWT access token (15min) and refresh token (7d)
    - Sets httpOnly cookie for refresh token
  </action>
  <verify>curl -X POST localhost:3000/api/auth/login -d '{"email":"test@test.com","password":"test"}' returns 200 with tokens</verify>
  <done>Login endpoint returns valid JWT tokens</done>
</task>

<task id="2" type="auto">
  <files>src/auth/middleware.ts</files>
  <action>
    Create auth middleware that:
    - Extracts JWT from Authorization header
    - Verifies token signature and expiry
    - Attaches user to request context
    - Returns 401 for invalid/expired tokens
  </action>
  <verify>Protected route returns 401 without token, 200 with valid token</verify>
  <done>Middleware protects routes correctly</done>
</task>

<task id="3" type="auto">
  <files>src/auth/refresh.ts</files>
  <action>
    Create POST /api/auth/refresh endpoint that:
    - Reads refresh token from httpOnly cookie
    - Validates refresh token
    - Issues new access token
    - Rotates refresh token (invalidate old, issue new)
  </action>
  <verify>Refresh endpoint issues new tokens when called with valid refresh cookie</verify>
  <done>Token refresh with rotation works</done>
</task>
</tasks>

<verification>
- [ ] Login returns valid JWT tokens
- [ ] Middleware rejects invalid tokens
- [ ] Refresh rotation works correctly
- [ ] Tokens have correct expiry times
</verification>

<success_criteria>
User can log in, access protected routes, and refresh sessions without re-authenticating.
</success_criteria>

<output>
Write SUMMARY.md to: .planning/phases/02-authentication/02-01-SUMMARY.md
</output>
```

## Task Types

### Auto Tasks
Execute independently without user interaction:
```xml
<task id="1" type="auto">
  <files>...</files>
  <action>...</action>
  <verify>...</verify>
  <done>...</done>
</task>
```

### Checkpoint Tasks
Pause for user input:

```xml
<!-- Human verification checkpoint -->
<task id="2" type="checkpoint:human-verify">
  <what-built>Login form with email/password fields</what-built>
  <how-to-verify>
    1. Open http://localhost:3000/login
    2. Enter test@test.com / password123
    3. Click "Log In"
    4. Verify redirect to dashboard
  </how-to-verify>
  <resume-signal>Type "verified" to continue</resume-signal>
</task>

<!-- Decision checkpoint -->
<task id="3" type="checkpoint:decision">
  <decision-needed>Should we use cookies or localStorage for tokens?</decision-needed>
  <options>
    1. Cookies (more secure, httpOnly)
    2. localStorage (simpler, but XSS vulnerable)
  </options>
  <resume-signal>Reply with your choice (1 or 2)</resume-signal>
</task>

<!-- Human action checkpoint (rare) -->
<task id="4" type="checkpoint:human-action">
  <action-needed>Create Stripe account and add API keys to .env</action-needed>
  <why-human>Requires account creation and billing setup</why-human>
  <resume-signal>Type "done" when API keys are in .env</resume-signal>
</task>
```

## Wave Assignment

Plans are grouped into waves for parallel execution:

```
Wave 1: depends_on: []     → Run in parallel
Wave 2: depends_on: [01]   → Wait for Wave 1
Wave 3: depends_on: [02]   → Wait for Wave 2
```

**Wave calculation:**
```
if depends_on is empty:
  wave = 1
else:
  wave = max(wave of all dependencies) + 1
```

## Naming Convention

```
{phase}-{plan}-PLAN.md

Examples:
01-01-PLAN.md    # Phase 1, Plan 1
02-03-PLAN.md    # Phase 2, Plan 3
02.1-01-PLAN.md  # Phase 2.1 (inserted), Plan 1
```

## Plan vs Phase

| Aspect | PLAN | PHASE |
|--------|------|-------|
| **Scope** | "What exact steps?" | "What outcome?" |
| **Tasks** | 2-3 tasks | 1-3+ plans |
| **Context** | ~50% context budget | N/A |
| **Execution** | Single agent | Multiple agents |
| **Output** | SUMMARY.md | VERIFICATION.md |

## Must-Haves Schema

Goal-backward verification criteria:

```yaml
must_haves:
  truths:              # Observable behaviors (user POV)
    - "User can send message"
    - "Messages persist across refresh"

  artifacts:           # Files that must exist
    - path: "src/components/Chat.tsx"
      provides: "Message list rendering"
      min_lines: 30    # Optional: ensure not a stub

  key_links:           # Critical connections
    - from: "src/components/Chat.tsx"
      to: "/api/messages"
      via: "fetch in useEffect"
```

## Execution Flow

```
gsd-executor receives PLAN.md
    ↓
Parse frontmatter (wave, depends_on, must_haves)
    ↓
For each task:
    ├─ Read <action>
    ├─ Implement code changes
    ├─ Run <verify> command
    ├─ Check <done> criteria
    ├─ Commit atomically
    └─ Handle deviations (auto-fix or checkpoint)
    ↓
Create SUMMARY.md
    ↓
Return to orchestrator
```

## Deviation Rules

`gsd-executor` handles unexpected situations:

| Rule | Situation | Action |
|------|-----------|--------|
| **Rule 1** | Bug discovered | Auto-fix + document |
| **Rule 2** | Missing critical functionality | Auto-add + document |
| **Rule 3** | Blocking issue | Auto-fix to unblock |
| **Rule 4** | Architectural change needed | STOP and checkpoint |

## TDD Plans

For business logic, use `type: tdd`:

```yaml
type: tdd
```

Executes RED-GREEN-REFACTOR:
1. **RED:** Write failing test
2. **GREEN:** Implement to pass
3. **REFACTOR:** Clean up

## Plan Verification (Pre-Execution)

`gsd-plan-checker` validates plans before execution:

1. **Requirement Coverage** — Every requirement has tasks
2. **Task Completeness** — Each task has files/action/verify/done
3. **Dependency Correctness** — Valid, acyclic graph
4. **Key Links Planned** — Artifacts will be wired
5. **Scope Sanity** — Within context budget
6. **Must-Haves Derivation** — Properly derived from goal

## SUMMARY.md Output

After execution, plan creates:

```markdown
# Plan 02-01 Summary

## Completed Tasks
1. ✓ Login endpoint (commit: abc123)
2. ✓ Auth middleware (commit: def456)
3. ✓ Refresh rotation (commit: ghi789)

## Files Modified
- src/auth/login.ts (created)
- src/auth/middleware.ts (created)
- src/auth/refresh.ts (created)

## Decisions Made
- Used jose library for JWT (recommended by research)
- Set access token to 15min, refresh to 7 days

## Issues Encountered
- None

## Deliverables
- JWT authentication system with refresh rotation
- Auth middleware for protecting routes
```

## Best Practices

1. **2-3 tasks per plan** — Keeps context budget (~50%)
2. **Specific actions** — "Create POST /api/auth/login accepting {email, password}" not "Add login"
3. **Testable verification** — Commands that prove it works
4. **Vertical slices** — Complete features over layers
5. **Clear must-haves** — User-observable behaviors

## Related Concepts

- [Phases](phases.md) — Container for plans
- [Milestones](milestones.md) — Container for phases
- [Agents](../reference/agents.md) — gsd-planner and gsd-executor
