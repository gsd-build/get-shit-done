# Milestone Context Template

Template for `.planning/MILESTONE-CONTEXT.md` - temporary handoff file from discuss-milestone to create-milestone.

**Purpose:** Persist milestone discussion context so `/clear` can be used between commands. This file is consumed by `/gsd/new-milestone` and deleted after the milestone is created.

---

## File Template

```markdown
# Milestone Context

**Generated:** [date]
**Status:** Ready for /gsd/new-milestone

<features>
## Features to Build

[Features identified during discussion - the substance of this milestone]

- **[Feature 1]**: [description]
- **[Feature 2]**: [description]
- **[Feature 3]**: [description]

</features>

<scope>
## Scope

**Suggested name:** v[X.Y] [Theme Name]
**Estimated phases:** [N]
**Focus:** [One sentence theme/focus]

</scope>

<phase_mapping>
## Phase Mapping

[How features map to phases - rough breakdown]

- Phase [N]: [Feature/goal]
- Phase [N+1]: [Feature/goal]
- Phase [N+2]: [Feature/goal]

</phase_mapping>

<constraints>
## Constraints

[Any constraints or boundaries mentioned during discussion]

- [Constraint 1]
- [Constraint 2]

</constraints>

<notes>
## Additional Context

[Anything else captured during discussion that informs the milestone]

</notes>

---

*This file is temporary. It will be deleted after /gsd/new-milestone creates the milestone.*
```

<guidelines>
**This is a handoff artifact, not permanent documentation.**

The file exists only to pass context from `discuss-milestone` to `create-milestone` across a `/clear` boundary.

**Lifecycle:**
1. `/gsd/discuss-milestone` creates this file at end of discussion
2. User runs `/clear` (safe now - context is persisted)
3. `/gsd/new-milestone` reads this file
4. `/gsd/new-milestone` uses context to populate milestone
5. `/gsd/new-milestone` deletes this file after successful creation

**Content should include:**
- Features identified (the core of what to build)
- Suggested milestone name/theme
- Rough phase mapping
- Any constraints or scope boundaries
- Notes from discussion

**Content should NOT include:**
- Technical analysis (that comes during phase research)
- Detailed phase specifications (create-milestone handles that)
- Implementation details
</guidelines>
