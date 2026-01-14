<purpose>
Help the user figure out what they want to build in the next milestone through collaborative thinking.

You're a thinking partner helping them crystallize their vision for what's next. Features first — everything else (scope, phases) derives from what they want to build.
</purpose>

<process>

<step name="check_state" priority="first">
Load project state:

```bash
cat .planning/STATE.md
cat .planning/ROADMAP.md
```

**If no active milestone (expected state after completing previous):**
Continue to milestone_context.

**If active milestone exists:**

```
Current milestone in progress: v[X.Y] [Name]
Phases [N]-[M], [P]% complete

Did you want to:
1. Complete current milestone first (/gsd/complete-milestone)
2. Add phases to current milestone (/gsd/add-phase)
3. Continue anyway - discuss next milestone scope

```

Wait for user response. If "Continue anyway", proceed to milestone_context.
</step>

<step name="milestone_context">
Present context from previous milestone:

```
Last completed: v[X.Y] [Name] (shipped [DATE])
Key accomplishments:
- [From MILESTONES.md or STATE.md]

Total phases delivered: [N]
Next phase number: [N+1]
```

Continue to intake_gate.
</step>

<step name="intake_gate">
**CRITICAL: ALL questions use AskUserQuestion. Never ask inline text questions.**

The primary question is: **What do you want to build/add/fix?**

Everything else (scope, priority, constraints) is secondary and derived from features.

Check for inputs:
- Deferred issues from STATE.md (potential features)
- Known gaps or pain points from usage
- User's ideas for what's next

**1. Open:**

Use AskUserQuestion:
- header: "Next"
- question: "What do you want to add, improve, or fix in this milestone?"
- options: [Deferred issues from STATE.md if any] + ["New features", "Improvements to existing", "Bug fixes", "Let me describe"]

**2. Explore features:**

Based on their response, use AskUserQuestion:

If they named specific features:
- header: "Feature Details"
- question: "Tell me more about [feature] - what should it do?"
- options: [Contextual options based on feature type + "Let me describe it"]

If they described a general direction:
- header: "Breaking It Down"
- question: "That could involve [A], [B], [C] - which matter most?"
- options: [Specific sub-features + "All of them" + "Something else"]

If they're not sure:
- header: "Starting Points"
- question: "What's been frustrating or missing?"
- options: [Deferred issues from STATE.md + pain point categories + "Let me think about it"]

**3. Prioritize:**

Use AskUserQuestion:
- header: "Priority"
- question: "Which of these matters most?"
- options: [Features they mentioned + "All equally important" + "Let me prioritize"]

After gathering features, synthesize:

```
Based on what you described:

**Features:**
- [Feature 1]: [brief description]
- [Feature 2]: [brief description]
- [Feature 3]: [brief description]

**Estimated scope:** [N] phases
**Theme suggestion:** v[X.Y] [Name]
```

**4. Decision gate:**

Use AskUserQuestion:
- header: "Ready?"
- question: "Ready to create the milestone, or explore more?"
- options (ALL THREE REQUIRED):
  - "Create milestone" - Proceed to /gsd/new-milestone
  - "Ask more questions" - Help me think through this more
  - "Let me add context" - I have more to share

If "Ask more questions" → return to step 2 with new probes.
If "Let me add context" → receive input → return to step 2.
Loop until "Create milestone" selected.
</step>

<step name="write_context">
Write milestone context to file for handoff.

**File:** `.planning/MILESTONE-CONTEXT.md`

Use template from ~/.config/opencode/gsd/templates/milestone-context.md

Populate with:
- Features identified during discussion
- Suggested milestone name and theme
- Estimated phase count
- How features map to phases
- Any constraints or scope boundaries mentioned

```bash
# Write the context file
cat > .planning/MILESTONE-CONTEXT.md << 'EOF'
# Milestone Context

**Generated:** [today's date]
**Status:** Ready for /gsd/new-milestone

<features>
## Features to Build

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

- Phase [N]: [Feature/goal]
- Phase [N+1]: [Feature/goal]
- Phase [N+2]: [Feature/goal]

</phase_mapping>

<constraints>
## Constraints

- [Any constraints mentioned]

</constraints>

<notes>
## Additional Context

[Anything else from discussion]

</notes>

---

*This file is temporary. It will be deleted after /gsd/new-milestone creates the milestone.*
EOF
```
</step>

<step name="handoff">
Present summary and hand off to create-milestone:

```
Milestone scope defined:

**Features:**
- [Feature 1]: [description]
- [Feature 2]: [description]
- [Feature 3]: [description]

**Suggested milestone:** v[X.Y] [Theme Name]
**Estimated phases:** [N]

Context saved to `.planning/MILESTONE-CONTEXT.md`

---

## ▶ Next Up

**Create Milestone v[X.Y]** — [Theme Name]

`/gsd/new-milestone`

<sub>`/clear` first → fresh context window</sub>

---
```
</step>

</process>

<success_criteria>

- Project state loaded (STATE.md, ROADMAP.md)
- Previous milestone context presented
- **Features identified** - What to build/add/fix (the substance)
- Features explored with clarifying questions
- Scope synthesized from features (not asked abstractly)
- **MILESTONE-CONTEXT.md created** with features, scope, and phase mapping
- Context handed off to /gsd/new-milestone
</success_criteria>
