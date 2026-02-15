---
name: gsdf:new-milestone
description: Token-optimized milestone initialization
argument-hint: "[milestone name]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Task
  - AskUserQuestion
---

<objective>
Token-optimized version of `/gsd:new-milestone`. Same outputs, leaner prompts.

Updates/Creates:
- `.planning/PROJECT.md` — updated with milestone goals
- `.planning/research/` — domain research (optional)
- `.planning/REQUIREMENTS.md` — scoped requirements
- `.planning/ROADMAP.md` — continues phase numbering
- `.planning/STATE.md` — reset for new milestone
</objective>

<process>

## Phase 1: Load Context

```bash
cat .planning/PROJECT.md
cat .planning/MILESTONES.md 2>/dev/null
cat .planning/STATE.md
cat .planning/MILESTONE-CONTEXT.md 2>/dev/null
```

Extract: validated requirements, previous milestone info, pending context.

## Phase 2: Gather Milestone Goals

**If MILESTONE-CONTEXT.md exists:**
- Use features from discuss-milestone
- Present for confirmation

**If no context:**
- Present last milestone summary
- Ask: "What do you want to build next?"
- Explore features, priorities, constraints

## Phase 3: Determine Version

Parse last version, suggest next (v1.0 → v1.1 or v2.0).

## Phase 4: Update PROJECT.md

Add/update:
```markdown
## Current Milestone: v[X.Y] [Name]

**Goal:** [One sentence]

**Target features:**
- [Feature 1]
- [Feature 2]
```

## Phase 5: Update STATE.md

```markdown
## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: [today] — Milestone v[X.Y] started
```

Keep Accumulated Context section (decisions, blockers) from previous milestone.

## Phase 6: Cleanup and Commit

**Delete MILESTONE-CONTEXT.md if exists** (consumed).

Check planning config:
```bash
COMMIT_PLANNING_DOCS=$(cat .planning/config.json 2>/dev/null | grep -o '"commit_docs"[[:space:]]*:[[:space:]]*[^,}]*' | grep -o 'true\|false' || echo "true")
git check-ignore -q .planning 2>/dev/null && COMMIT_PLANNING_DOCS=false
```

If `COMMIT_PLANNING_DOCS=false`: Skip git operations.

If `COMMIT_PLANNING_DOCS=true` (default):
```bash
git add .planning/PROJECT.md .planning/STATE.md
git commit -m "docs: start milestone v[X.Y] [Name]"
```

## Phase 6.5: Resolve GSDF Model Profile

```bash
# GSDF uses model_profile_gsdf (falls back to model_profile, then "balanced")
MODEL_PROFILE=$(cat .planning/config.json 2>/dev/null | grep -o '"model_profile_gsdf"[[:space:]]*:[[:space:]]*"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"')
[ -z "$MODEL_PROFILE" ] && MODEL_PROFILE=$(cat .planning/config.json 2>/dev/null | grep -o '"model_profile"[[:space:]]*:[[:space:]]*"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"' || echo "balanced")
```

**Lite model lookup:**

| Agent | quality | balanced | budget |
|-------|---------|----------|--------|
| gsd-project-researcher | opus | sonnet | haiku |
| gsd-research-synthesizer | sonnet | haiku | haiku |
| gsd-roadmapper | opus | sonnet | sonnet |

## Phase 7: Research Decision

Use AskUserQuestion:
- header: "Research"
- question: "Research the domain ecosystem for new features before defining requirements?"
- options:
  - "Research first (Recommended)" — Discover patterns, expected features, architecture for NEW capabilities
  - "Skip research" — I know what I need, go straight to requirements

**If "Research first":**

```bash
mkdir -p .planning/research
```

Spawn 4 parallel researchers with **milestone-aware** context:

```
Task(prompt="Research stack additions for [new features].

SUBSEQUENT MILESTONE — Adding to existing app.
Existing capabilities (DO NOT re-research): [validated list]
Focus ONLY on NEW features.

<downstream_consumer>
Your STACK.md feeds into roadmap creation. Be prescriptive:
- Specific libraries with versions for NEW capabilities
- Integration points with existing stack
- What NOT to add and why
</downstream_consumer>

<quality_gate>
- [ ] Versions are current (verify with Context7/official docs, not training data)
- [ ] Rationale explains WHY, not just WHAT
- [ ] Integration with existing stack considered
</quality_gate>

<research_methodology>
Treat pre-existing knowledge as hypothesis. Verify before asserting.
Tool strategy: Context7 first for libraries, WebFetch for official docs, WebSearch for ecosystem discovery.
Confidence: HIGH = Context7/official docs, MEDIUM = WebSearch + official verify, LOW = WebSearch only.
</research_methodology>

Write to: .planning/research/STACK.md
", subagent_type="gsd-project-researcher", model="{researcher_model}", description="Stack research")
```

Similar compact prompts for Features, Architecture, Pitfalls research — each with `<downstream_consumer>`, `<quality_gate>`, and `<research_methodology>`.

After all 4 complete, spawn synthesizer for SUMMARY.md.

**Commit research:**
Check `COMMIT_PLANNING_DOCS` (same pattern as Phase 6).

**If "Skip research":** Continue to Phase 8.

## Phase 8: Define Requirements

Present features by category, scope each with AskUserQuestion (multiSelect):
- Selected → this milestone's requirements
- Unselected table stakes → future milestone
- Unselected differentiators → out of scope

Continue REQ-ID numbering from existing requirements.

Create `.planning/REQUIREMENTS.md` with REQ-IDs.

**Commit requirements:**
Check `COMMIT_PLANNING_DOCS` (same pattern as Phase 6).

## Phase 9: Create Roadmap

Find starting phase number from MILESTONES.md.

Spawn roadmapper with continuation context:

```
Task(prompt="Create roadmap for milestone v[X.Y].

Start phase numbering from [N].
Read: .planning/PROJECT.md, .planning/REQUIREMENTS.md, .planning/research/SUMMARY.md

Write files immediately, return ROADMAP CREATED.
", subagent_type="gsd-roadmapper", model="{roadmapper_model}", description="Create roadmap")
```

**CRITICAL: Ask for approval before committing:**

Use AskUserQuestion:
- header: "Roadmap"
- question: "Does this roadmap structure work for you?"
- options:
  - "Approve" — Commit and continue
  - "Adjust phases" — Tell me what to change
  - "Review full file" — Show raw ROADMAP.md

**If "Adjust phases":** Get feedback, re-spawn roadmapper with revision context, loop until approved.

**Commit roadmap (after approval):**
Check `COMMIT_PLANNING_DOCS` (same pattern as Phase 6).

## Phase 10: Done

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSDF ► MILESTONE INITIALIZED ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Milestone v[X.Y]: [Name]**

| Artifact       | Location                    |
|----------------|-----------------------------|
| Project        | `.planning/PROJECT.md`      |
| Research       | `.planning/research/`       |
| Requirements   | `.planning/REQUIREMENTS.md` |
| Roadmap        | `.planning/ROADMAP.md`      |

**[N] phases** | **[X] requirements** | Ready to build ✓

───────────────────────────────────────────────────────────────

## ▶ Next Up

**Phase [N]: [Phase Name]** — [Goal from ROADMAP.md]

/gsd:discuss-phase [N] — gather context and clarify approach

<sub>/clear first → fresh context window</sub>

───────────────────────────────────────────────────────────────

**Also available:**
- /gsdf:plan-phase [N] — skip discussion, plan directly

───────────────────────────────────────────────────────────────
```

</process>

<success_criteria>
- [ ] PROJECT.md updated with milestone
- [ ] STATE.md updated with accumulated context preserved
- [ ] MILESTONE-CONTEXT.md consumed and deleted (if existed)
- [ ] Research completed (if selected) → committed (if config allows)
- [ ] REQUIREMENTS.md created → committed (if config allows)
- [ ] Roadmap approved by user, iteration if needed
- [ ] ROADMAP.md continues numbering → committed (if config allows)
- [ ] User knows next step
</success_criteria>
