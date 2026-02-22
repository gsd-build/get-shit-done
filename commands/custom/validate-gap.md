---
name: custom:validate-gap
description: Analyze implementation gap between requirements and existing codebase. Run at milestone boundaries or before major features. Adapted from cc-sdd validate-gap + gap-analysis framework.
argument-hint: "[milestone-name or feature-name]"
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Task, WebSearch, WebFetch
---

# Implementation Gap Validation

> Adapted from [cc-sdd](https://github.com/gotalab/cc-sdd) validate-gap command and gap-analysis framework.
> Integrated with GSD's .planning structure.

## Mission

Analyze the gap between new requirements and existing codebase to inform implementation strategy. Run this BEFORE starting implementation, especially at milestone boundaries.

## When to Run (MANDATORY)

1. After every `/gsd:new-milestone` or `/gsd:complete-milestone`
2. Before major features that touch existing code
3. After 5+ phases completed (drift check)
4. Before major refactoring

## Execution Steps

### 0. Validate Input

If `$ARGUMENTS` is empty:
- Print: "Usage: /custom:validate-gap [milestone-name or feature-name]. Example: /custom:validate-gap v1.0-mvp"
- STOP. Do not proceed.

If `.planning/` directory does not exist:
- Print: "No .planning/ directory found. Run /gsd:new-project first to initialize the project."
- STOP. Do not proceed.

If `.planning/ROADMAP.md` does not exist:
- Print: "No ROADMAP.md found. Run /gsd:new-milestone first."
- STOP. Do not proceed.

### 1. Load Context

```bash
# Find project state
cat .planning/STATE.md 2>/dev/null
cat .planning/PROJECT.md 2>/dev/null
cat .planning/ROADMAP.md 2>/dev/null
cat .planning/REQUIREMENTS.md 2>/dev/null
```

Read the target milestone/feature requirements from ROADMAP.md or $ARGUMENTS context.

**Note:** The GAP-REPORT output is advisory — review it with the user before making ROADMAP changes.

### 2. Current State Investigation

**Scan for domain-related assets:**

```bash
# Project structure
find . -type f -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" | head -50

# Key modules and directory layout
ls -la src/ 2>/dev/null || ls -la app/ 2>/dev/null || ls -la packages/ 2>/dev/null
```

**Document what EXISTS:**
- API endpoints and their parameters
- Database schema (Prisma schema, raw SQL tables)
- Components and their props interfaces
- Utility functions and helpers
- Test coverage (which modules have tests, which don't)
- Configuration and environment variables
- External dependencies and their versions

**Extract conventions:**
- Naming patterns
- Import/export patterns
- Architecture layers and dependency direction
- Testing approach and placement
- Error handling patterns

### 3. Requirements Mapping

From the target milestone/feature, extract technical needs:

| Requirement | Category | Status |
|-------------|----------|--------|
| [requirement 1] | Data model / API / UI / Business logic | EXISTS / PARTIAL / MISSING |
| [requirement 2] | ... | ... |

### 4. Gap Analysis

For each MISSING or PARTIAL requirement, analyze:

```markdown
### [GAP-001] Title
- **Requirement:** What is needed
- **Current state:** What exists (or doesn't)
- **Gap type:** Missing capability / Insufficient capacity / Incompatible pattern
- **Impact:** What breaks or can't be built without this
- **Effort:** S (1-3 days) / M (3-7 days) / L (1-2 weeks) / XL (2+ weeks)
- **Risk:** Low / Medium / High
- **Approach options:**
  - **A) Extend existing:** [description] — Trade-offs: [pros/cons]
  - **B) Create new:** [description] — Trade-offs: [pros/cons]
  - **C) Hybrid:** [description] — Trade-offs: [pros/cons]
- **Recommendation:** [preferred approach with reasoning]
```

### 5. Implementation Approach Evaluation

For each gap, evaluate three approaches:

**Option A: Extend Existing Components**
- Which files/modules to extend
- Impact on existing functionality
- Backward compatibility
- Risk of bloating existing components

**Option B: Create New Components**
- Rationale for new creation
- Integration points with existing system
- Clear responsibility boundaries

**Option C: Hybrid Approach**
- Which parts extend, which parts are new
- Phased implementation strategy
- Migration path if needed

### 6. Complexity & Risk Assessment

| Gap | Effort | Risk | Blocking? | Phase Impact |
|-----|--------|------|-----------|-------------|
| GAP-001 | M | High | Yes | New phase needed |
| GAP-002 | S | Low | No | Add to existing phase |
| GAP-003 | L | Medium | Yes | Architecture decision |

### 7. Generate Gap Report

Create `.planning/GAP-REPORT-{milestone}.md`:

```markdown
# Gap Report: $ARGUMENTS
Generated: [date]

## Summary
- Total requirements analyzed: N
- Fully covered: N (existing code handles this)
- Partially covered: N (needs enhancement)
- Not covered: N (needs new implementation)
- Research needed: N (unknowns)

## Critical Gaps (New phases required)

### [GAP-001] [Title]
- **Requirement:** [what's needed]
- **Gap:** [what's missing]
- **Impact:** [what can't be built without this]
- **Effort:** [S/M/L/XL]
- **Recommendation:** Add phase "[phase name]" to ROADMAP
- **Approach:** [A/B/C with brief rationale]

## Medium Gaps (Add to existing phases)

### [GAP-002] [Title]
- **Requirement:** [what's needed]
- **Gap:** [what's missing]
- **Recommendation:** Add task to phase [N]

## Low Gaps (Notes for awareness)

### [GAP-003] [Title]
- **Note:** [optimization opportunity or nice-to-have]

## Research Needed

### [RESEARCH-001] [Title]
- **Unknown:** [what we don't know]
- **Why it matters:** [impact on implementation]
- **Suggested investigation:** [how to resolve]

## ROADMAP Impact

### Phases to ADD:
1. Phase [N+1]: "[name]" — addresses GAP-001, GAP-003
2. Phase [N+2]: "[name]" — addresses GAP-005

### Phases to MODIFY:
1. Phase [N]: Add tasks for GAP-002, GAP-004

### Architectural Decisions Needed:
1. [AD-XXX]: [decision description] — blocking GAP-006
```

### 8. Update GSD State

```bash
# If gaps require new phases, update ROADMAP
# If gaps require architectural decisions, update STATE.md
```

Present the gap report to the user for review before making ROADMAP changes.

## Principles

- **Information over decisions:** Provide analysis and options, not final choices
- **Multiple viable options:** Present credible alternatives when applicable
- **Explicit gaps and assumptions:** Flag unknowns and constraints clearly
- **Context-aware:** Align with existing patterns and architecture limits
- **Transparent effort and risk:** Justify labels succinctly

## Output

```
Gap Analysis Complete: $ARGUMENTS
===================================
Requirements analyzed: N
Covered: N | Partial: N | Missing: N | Unknown: N
Critical gaps: N (new phases needed)
Medium gaps: N (add to existing phases)
Report: .planning/GAP-REPORT-{milestone}.md

Next steps:
1. Review gap report
2. Approve ROADMAP changes
3. Run /gsd:discuss-phase [next] to start planning
```
