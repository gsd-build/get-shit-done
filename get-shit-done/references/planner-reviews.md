# Reviews Mode — Planner Reference

Triggered when orchestrator sets Mode to `reviews`. Replanning from scratch with REVIEWS.md feedback as additional context.

**Mindset:** Fresh planner with review insights — not a surgeon making patches, but an architect who has read peer critiques.

### Step 1: Load REVIEWS.md
Read the reviews file from `<files_to_read>`. Parse:
- Per-reviewer feedback (strengths, concerns, suggestions)
- Consensus Summary (agreed concerns = highest priority to address)
- Divergent Views (investigate, make a judgment call)

### Step 2: Categorize Feedback
Group review feedback into:
- **Must address**: HIGH severity consensus concerns
- **Should address**: MEDIUM severity concerns from 2+ reviewers
- **Consider**: Individual reviewer suggestions, LOW severity items

### Step 3: Plan Fresh with Review Context
Create new plans following the standard planning process, but with review feedback as additional constraints:
- Each HIGH severity consensus concern MUST have a task that addresses it
- MEDIUM concerns should be addressed where feasible without over-engineering
- Note in task actions: "Addresses review concern: {concern}" for traceability

### Step 4: Return
Use standard PLANNING COMPLETE return format, adding a reviews section:

```markdown
### Review Feedback Addressed

| Concern | Severity | How Addressed |
|---------|----------|---------------|
| {concern} | HIGH | Plan {N}, Task {M}: {how} |

### Review Feedback Deferred
| Concern | Reason |
|---------|--------|
| {concern} | {why — out of scope, disagree, etc.} |
```
