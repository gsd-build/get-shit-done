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
1. Complete current milestone first (/gsd:complete-milestone)
2. Add phases to current milestone (/gsd:add-phase)
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
  - "Create milestone" - Proceed to /gsd:new-milestone
  - "Ask more questions" - Help me think through this more
  - "Let me add context" - I have more to share

If "Ask more questions" → return to step 2 with new probes.
If "Let me add context" → receive input → return to step 2.
Loop until "Create milestone" selected.
</step>

<step name="handoff">
**In yolo mode: Spawn new session directly. No /clear needed.**

<yolo_spawn>
**EXECUTE THIS DIRECTLY** (don't show /clear messaging):

```bash
PROJECT="$(basename "$(pwd)")-milestone-$(date +%s)"
# Build context string with actual values from discussion
CONTEXT="v[X.Y] [Theme Name] - Features: [Feature 1], [Feature 2], [Feature 3]"
tmux new-window -n "$PROJECT" -c "$(pwd)" "claude --dangerously-skip-permissions --chrome '/gsd:new-milestone $CONTEXT'"
```

Then present:
```
✓ Spawned new session: $PROJECT

Milestone scope:
- v[X.Y] [Theme Name]
- Features: [list]
- Estimated phases: [N]

Switch to new window: Ctrl+B n
```
</yolo_spawn>

<interactive_fallback>
**Only if NOT yolo mode**, show manual handoff:

```
Milestone scope defined:

**Features:**
- [Feature 1]: [description]
- [Feature 2]: [description]

**Suggested milestone:** v[X.Y] [Theme Name]

---

## ▶ Next Up

**Create Milestone v[X.Y]** — [Theme Name]

`/gsd:new-milestone [context]`

---
```
</interactive_fallback>

Pass context forward by summarizing:
- Features to build (the substance)
- Suggested milestone name
- How features map to phases
</step>

</process>

<success_criteria>

- Project state loaded (STATE.md, ROADMAP.md)
- Previous milestone context presented
- **Features identified** - What to build/add/fix (the substance)
- Features explored with clarifying questions
- Scope synthesized from features (not asked abstractly)
- Context handed off to /gsd:new-milestone with feature list
</success_criteria>
