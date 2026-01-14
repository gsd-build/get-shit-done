<purpose>
Create a new milestone for an existing project. Defines phases, updates roadmap, and resets state tracking for the new milestone.

This is used after completing a milestone when ready to define the next chunk of work.
</purpose>

<required_reading>
**Read these files NOW:**

1. ~/.config/opencode/gsd/templates/roadmap.md (milestone-grouped format)
2. `.planning/ROADMAP.md`
3. `.planning/STATE.md`
4. `.planning/MILESTONES.md` (if exists)
   </required_reading>

<process>

<step name="load_context">
Load project context:

```bash
cat .planning/ROADMAP.md
cat .planning/STATE.md
cat .planning/MILESTONES.md 2>/dev/null || echo "No milestones file yet"
cat .planning/MILESTONE-CONTEXT.md 2>/dev/null || echo "No milestone context file"
```

Extract:

- Previous milestone version (e.g., v1.0)
- Last phase number used
- Deferred issues from STATE.md
- Project context from PROJECT.md (What This Is, Core Value)

**Check for milestone context from discuss-milestone:**

If `.planning/MILESTONE-CONTEXT.md` exists:
- This contains context from `/gsd/discuss-milestone`
- Extract: features, suggested name, phase mapping, constraints
- Use this to pre-populate milestone details (skip prompting for info already gathered)

**Calculate next milestone version:**

- If previous was v1.0 → suggest v1.1 (minor) or v2.0 (major)
- If previous was v1.3 → suggest v1.4 or v2.0
- Parse from ROADMAP.md "Completed Milestones" section
  </step>

<step name="get_milestone_info">
**If MILESTONE-CONTEXT.md exists (from /gsd/discuss-milestone):**
Use the features, scope, and constraints from the context file.
Use the suggested milestone name from `<scope>` section.
Use the phase mapping from `<phase_mapping>` section.

**If called directly (no MILESTONE-CONTEXT.md):**
Ask for milestone details:

header: "Milestone Name"
question: "What should we call this milestone?"
options:

- "v[X.Y] Features" - Adding new functionality
- "v[X.Y] Improvements" - Enhancing existing features
- "v[X.Y] Fixes" - Bug fixes and stability
- "v[X.Y] Refactor" - Code quality and architecture
- "v[X.Y+1].0 [Major]" - Major version bump
- "Other" - Custom name

Get milestone name in format: "v[X.Y] [Name]"
</step>

<step name="identify_phases">
**Calculate starting phase number:**

```bash
# Find highest phase number from roadmap
grep -E "^### Phase [0-9]+" .planning/ROADMAP.md | tail -1
# Extract number, add 1
```

Next phase starts at: [last_phase + 1]

**Check depth setting and gather phases accordingly:**

```bash
cat .planning/config.json 2>/dev/null | grep depth
```

| Depth | Phases/Milestone |
|-------|------------------|
| Quick | 3-5 |
| Standard | 5-8 |
| Comprehensive | 8-12 |

If context from discuss-milestone provided, use that scope.

Otherwise, ask:

```
What phases should this milestone include?

Starting at Phase [N]:
- Phase [N]: [name] - [one-line goal]
- Phase [N+1]: [name] - [one-line goal]
...

Describe the phases, or say "help me break this down" for guidance.
```

For each phase, capture:

- Phase number (continuing sequence)
- Phase name (kebab-case for directory)
- One-line goal
- Research flag (Likely/Unlikely based on triggers)
  </step>

<step name="detect_research_needs">
**For each phase, determine if research is likely needed.**

Apply research triggers from create-roadmap.md:

<research_triggers>
**Likely (flag the phase):**

| Trigger Pattern                                       | Why Research Needed                     |
| ----------------------------------------------------- | --------------------------------------- |
| "integrate [service]", "connect to [API]"             | External API - need current docs        |
| "authentication", "auth", "login", "JWT"              | Architectural decision + library choice |
| "payment", "billing", "Stripe", "subscription"        | External API + compliance patterns      |
| "email", "SMS", "notifications", "SendGrid", "Twilio" | External service integration            |
| "database", "Postgres", "MongoDB", "Supabase"         | If new to project - setup patterns      |
| "real-time", "websocket", "sync", "live updates"      | Architectural decision                  |
| "deploy", "Vercel", "Railway", "hosting"              | If first deployment - config patterns   |
| "choose between", "select", "evaluate", "which"       | Explicit decision needed                |
| "AI", "OpenAI", "Claude", "LLM", "embeddings"         | Fast-moving APIs - need current docs    |
| Any technology not already in codebase                | New integration                         |

**Unlikely (no flag needed):**

| Pattern                                     | Why No Research         |
| ------------------------------------------- | ----------------------- |
| "add button", "create form", "update UI"    | Internal patterns       |
| "CRUD operations", "list/detail views"      | Standard patterns       |
| "refactor", "reorganize", "clean up"        | Internal work           |
| "following existing patterns"               | Conventions established |
| Technology already in package.json/codebase | Patterns exist          |

</research_triggers>

Present research assessment:

```
Research needs detected:

Phase [N]: [Name]
  Research: Unlikely (internal patterns)

Phase [N+1]: [Name]
  Research: Likely (new API integration)
  Topics: [What to investigate]

Does this look right? (yes / adjust)
```

</step>

<step name="confirm_phases">
<config-check>
```bash
cat .planning/config.json 2>/dev/null
```
</config-check>

<if mode="yolo">
```
⚡ Auto-approved: Milestone phases ([N] phases)

1. Phase [X]: [Name] - [goal]
2. Phase [X+1]: [Name] - [goal]
...

Proceeding to create milestone structure...
```

Proceed directly to update_roadmap step.
</if>

<if mode="interactive" OR="missing OR custom with gates.confirm_phases true">
Present the phase breakdown:

```
Milestone: v[X.Y] [Name]

Phases:
1. Phase [X]: [Name] - [goal]
2. Phase [X+1]: [Name] - [goal]
3. Phase [X+2]: [Name] - [goal]

Does this feel right? (yes / adjust)
```

If "adjust": Ask what to change, revise, present again.
</step>

<step name="update_roadmap">
Write new milestone details to `.planning/ROADMAP.md`.

**File to update:** `.planning/ROADMAP.md`

The main ROADMAP.md file holds full phase details for the active milestone. Archive files in `milestones/` are created only when a milestone ships (via `/gsd/complete-milestone`).

**Process:**

**1. Update Milestones section:**

Add the new milestone to the milestones list. Completed milestones show as links to their archive files, new milestone shows as in-progress.

```markdown
## Milestones

- ✅ **v1.0 [Previous]** - [link to milestones/v1.0-ROADMAP.md] (Phases 1-9, shipped YYYY-MM-DD)
- 🚧 **v[X.Y] [Name]** - Phases [N]-[M] (in progress)
```

**2. Add full phase details:**

Write complete phase sections for all phases in this milestone. Each phase gets full details including goal, dependencies, research assessment, and plan placeholders.

```markdown
### 🚧 v[X.Y] [Name] (In Progress)

**Milestone Goal:** [One sentence describing what this milestone delivers]

#### Phase [N]: [Name]

**Goal**: [What this phase delivers]
**Depends on**: Phase [N-1] (or "Previous milestone complete")
**Research**: [Likely/Unlikely] ([reason])
**Research topics**: [If Likely, what to investigate]
**Plans**: TBD

Plans:
- [ ] [N]-01: TBD (run /gsd/plan-phase [N] to break down)

#### Phase [N+1]: [Name]

**Goal**: [What this phase delivers]
**Depends on**: Phase [N]
**Research**: [Likely/Unlikely] ([reason])
**Plans**: TBD

Plans:
- [ ] [N+1]-01: TBD

[... continue for all phases in this milestone ...]
```

**3. Update Progress table:**

Add rows for all new phases with milestone attribution.

```markdown
| Phase         | Milestone | Plans | Status      | Completed |
| ------------- | --------- | ----- | ----------- | --------- |
| [N]. [Name]   | v[X.Y]    | 0/?   | Not started | -         |
| [N+1]. [Name] | v[X.Y]    | 0/?   | Not started | -         |
```

</step>

<step name="create_phase_directories">
Create directories for new phases:

```bash
mkdir -p .planning/phases/[NN]-[slug]
mkdir -p .planning/phases/[NN+1]-[slug]
# ... for each phase
```

Use two-digit padding: `10-name`, `11-name`, etc.
</step>

<step name="update_state">
Update `.planning/STATE.md` for new milestone:

**Update Current Position:**

```markdown
## Current Position

Phase: [N] of [M] ([First phase name])
Plan: Not started
Status: Ready to plan
Last activity: [today's date] - Milestone v[X.Y] created

Progress: ░░░░░░░░░░ 0%
```

**Update Accumulated Context:**

Keep decisions from previous milestone (they're historical record).
Clear "Blockers/Concerns Carried Forward" section.

**Add to Roadmap Evolution:**

```markdown
### Roadmap Evolution

- Milestone v[X.Y] created: [theme/focus], [N] phases (Phase [start]-[end])
```

**Update Session Continuity:**

```markdown
## Session Continuity

Last session: [today's date and time]
Stopped at: Milestone v[X.Y] initialization
Resume file: None
```

</step>

<step name="git_commit">
Commit milestone creation:

```bash
git add .planning/ROADMAP.md .planning/STATE.md
git add .planning/phases/
git commit -m "$(cat <<'EOF'
docs: create milestone v[X.Y] [Name] ([N] phases)

Phases:
- [N]. [name]: [goal]
- [N+1]. [name]: [goal]
- [N+2]. [name]: [goal]
EOF
)"
```

Confirm: "Committed: docs: create milestone v[X.Y] [Name]"
</step>

<step name="cleanup_context">
Delete the temporary milestone context file if it exists:

```bash
rm -f .planning/MILESTONE-CONTEXT.md
```

This file was a handoff artifact from `/gsd/discuss-milestone`. Now that the milestone is created, the context is persisted in ROADMAP.md and the temporary file is no longer needed.
</step>

<step name="offer_next">
```
Milestone v[X.Y] [Name] created:
- Phases: [N]-[M] ([count] phases)
- Directories created
- ROADMAP.md updated
- STATE.md reset for new milestone

---

## ▶ Next Up

**Phase [N]: [Name]** — [Goal from ROADMAP.md]

`/gsd/plan-phase [N]`

<sub>`/clear` first → fresh context window</sub>

---

**Also available:**
- `/gsd/discuss-phase [N]` — gather context first
- `/gsd/research-phase [N]` — investigate unknowns
- Review roadmap

---
```
</step>

</process>

<phase_naming>
Use `XX-kebab-case-name` format with continuous numbering:
- `10-user-profiles`
- `11-notifications`
- `12-analytics`

Numbers continue from previous milestone. Names describe content.
</phase_naming>

<anti_patterns>
- Don't restart phase numbering at 01 (continue sequence)
- Don't add time estimates
- Don't create Gantt charts
- Respect depth setting for phase count (quick: 3-5, standard: 5-8, comprehensive: 8-12)
- Don't modify completed milestone sections

Milestones are coherent chunks of work, not project management artifacts.
</anti_patterns>

<success_criteria>
Milestone creation is complete when:
- [ ] Next phase number calculated correctly (continues from previous)
- [ ] Phases defined per depth setting (quick: 3-5, standard: 5-8, comprehensive: 8-12)
- [ ] Research flags assigned for each phase
- [ ] ROADMAP.md updated with new milestone section
- [ ] Phase directories created
- [ ] STATE.md reset for new milestone
- [ ] Git commit made
- [ ] User knows next steps
</success_criteria>
```
