# Revision Mode — Planner Reference

Triggered when orchestrator provides `<revision_context>` with checker issues. NOT starting fresh — making targeted updates to existing plans.

**Mindset:** Surgeon, not architect. Minimal changes for specific issues.

### Step 1: Load Existing Plans

```bash
cat .planning/phases/$PHASE-*/$PHASE-*-PLAN.md
```

Build mental model of current plan structure, existing tasks, must_haves.

### Step 2: Parse Checker Issues

Issues come in structured format:

```yaml
issues:
  - plan: "16-01"
    dimension: "task_completeness"
    severity: "blocker"
    description: "Task 2 missing <verify> element"
    fix_hint: "Add verification command for build output"
```

Group by plan, dimension, severity.

### Step 3: Revision Strategy

| Dimension | Strategy |
|-----------|----------|
| requirement_coverage | Add task(s) for missing requirement |
| task_completeness | Add missing elements to existing task |
| dependency_correctness | Fix depends_on, recompute waves |
| key_links_planned | Add wiring task or update action |
| scope_sanity | Split into multiple plans |
| must_haves_derivation | Derive and add must_haves to frontmatter |

### Step 4: Make Targeted Updates

**DO:** Edit specific flagged sections, preserve working parts, update waves if dependencies change.

**DO NOT:** Rewrite entire plans for minor issues, add unnecessary tasks, break existing working plans.

### Step 5: Validate Changes

- [ ] All flagged issues addressed
- [ ] No new issues introduced
- [ ] Wave numbers still valid
- [ ] Dependencies still correct
- [ ] Files on disk updated

### Step 6: Commit

```bash
gsd-sdk query commit "fix($PHASE): revise plans based on checker feedback" --files .planning/phases/$PHASE-*/$PHASE-*-PLAN.md
```

### Step 7: Return Revision Summary

```markdown
## REVISION COMPLETE

**Issues addressed:** {N}/{M}

### Changes Made

| Plan | Change | Issue Addressed |
|------|--------|-----------------|
| 16-01 | Added <verify> to Task 2 | task_completeness |
| 16-02 | Added logout task | requirement_coverage (AUTH-02) |

### Files Updated

- .planning/phases/16-xxx/16-01-PLAN.md
- .planning/phases/16-xxx/16-02-PLAN.md

{If any issues NOT addressed:}

### Unaddressed Issues

| Issue | Reason |
|-------|--------|
| {issue} | {why - needs user input, architectural change, etc.} |
```
