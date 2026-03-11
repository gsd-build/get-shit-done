# PRD Template

Template for `.planning/prds/pending/{slug}.md` — product-oriented PRD format (WHAT/WHY only, no HOW).

**Sections:**
1. Problem Statement — what problem this solves and for whom
2. Goals — measurable success outcomes (user-centric)
3. User Stories — in "As a [user], I want [action] so that [outcome]" format
4. Acceptance Criteria — testable conditions for each user story
5. MVP Boundary — explicit MVP vs Phase 2 line
6. Tech Candidates — technology names + rationale (NO schemas, routes, or code)
7. Open Questions — unresolved gaps from Q&A rounds
8. Assumptions — things assumed but not confirmed (PRD-06 requirement)

---

<template>

```markdown
<!-- stage: initialized -->

# PRD: {slug}

**Created:** {date}
**Status:** pending
**Concept:** {concept_summary}

---

## Problem Statement

{problem_statement}

---

## Goals

{goals_list}

---

## User Stories

{user_stories}

---

## Acceptance Criteria

{acceptance_criteria}

---

## MVP Boundary

**MVP (Phase 1):**
{mvp_items}

**Phase 2 (deferred):**
{phase2_items}

---

## Tech Candidates

> Note: This section lists WHAT technologies to consider and WHY — not HOW to implement them.
> No schemas, API routes, database DDL, or code snippets belong here.

{tech_candidates}

---

## Open Questions

{open_questions}

---

## Assumptions

{assumptions}

---

*PRD Status: pending*
*Stored: .planning/prds/pending/{slug}.md*
*Ready for: /gsd:new-milestone --prd .planning/prds/pending/{slug}.md*
```

</template>

<guidelines>

**Content Rules:**
- Problem Statement: user-centric, describes the pain — NOT the solution
- Goals: outcomes the user achieves — NOT features to build
- User Stories: "As a [user], I want [action] so that [outcome]" — one per line
- Acceptance Criteria: testable behaviors — start with "[ ]" checkbox format
- MVP Boundary: explicit list — "MVP includes: X, Y. Phase 2 defers: A, B."
- Tech Candidates: technology NAMES + WHY — no code, no schemas, no routes
- Open Questions: things still unclear after Q&A — phrase as questions
- Assumptions: things taken as given — phrase as statements, note the risk if wrong

**What belongs vs what doesn't:**

| Belongs in PRD | Does NOT belong in PRD |
|---------------|----------------------|
| "Users need real-time updates" | "Use WebSockets at /ws/events" |
| "PostgreSQL — relational data with complex queries" | "CREATE TABLE users (id UUID...)" |
| "Target user: small business owner" | "Dashboard with React components" |
| "Success: user completes onboarding in < 5 min" | "API endpoint: POST /api/onboarding" |

**Stage markers (written by workflow, not by human):**
- `<!-- stage: initialized -->` — PRD draft created
- `<!-- stage: pm -->` — PM Discovery complete
- `<!-- stage: po -->` — PO/BA Scoping complete
- `<!-- stage: complete -->` — All stages complete, ready for milestone planning

</guidelines>
