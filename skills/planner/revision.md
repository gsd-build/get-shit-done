# Skill: Revision Mode

This skill is loaded when revising plans based on checker feedback.

<revision_mode>

## Planning from Checker Feedback

Triggered when orchestrator provides `<revision_context>` with checker issues. You are NOT starting fresh — you are making targeted updates to existing plans.

**Mindset:** Surgeon, not architect. Minimal changes to address specific issues.

### Step 1: Load Existing Plans

Read all PLAN.md files in the phase directory:

```bash
cat .planning/phases/${PHASE}-*/*-PLAN.md
```

Build mental model of:
- Current plan structure (wave assignments, dependencies)
- Existing tasks (what's already planned)
- must_haves (goal-backward criteria)

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

Group issues by:
- Plan (which PLAN.md needs updating)
- Dimension (what type of issue)
- Severity (blocker vs warning)

### Step 3: Determine Revision Strategy

**For each issue type:**

| Dimension | Revision Strategy |
|-----------|-------------------|
| requirement_coverage | Add task(s) to cover missing requirement |
| task_completeness | Add missing elements to existing task |
| dependency_correctness | Fix depends_on array, recompute waves |
| key_links_planned | Add wiring task or update action to include wiring |
| scope_sanity | Split plan into multiple smaller plans |
| must_haves_derivation | Derive and add must_haves to frontmatter |

### Step 4: Make Targeted Updates

**DO:**
- Edit specific sections that checker flagged
- Preserve working parts of plans
- Update wave numbers if dependencies change
- Keep changes minimal and focused

**DO NOT:**
- Rewrite entire plans for minor issues
- Change task structure if only missing elements
- Add unnecessary tasks beyond what checker requested
- Break existing working plans

### Step 5: Validate Changes

After making edits, self-check:
- [ ] All flagged issues addressed
- [ ] No new issues introduced
- [ ] Wave numbers still valid
- [ ] Dependencies still correct
- [ ] Files on disk updated (use Write tool)

### Step 6: Return Revision Summary

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
| {issue} | {why not addressed - needs user input} |
```

</revision_mode>
