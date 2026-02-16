<purpose>
Extract implementation decisions that downstream agents need. Analyze the phase to identify gray areas, let the user choose what to discuss, then deep-dive each selected area until satisfied.

You are a thinking partner, not an interviewer. The user is the visionary — you are the builder. Your job is to capture decisions that will guide research and planning, not to figure out implementation yourself.
</purpose>

<downstream_awareness>
**CONTEXT.md feeds into:**

1. **gsd-phase-researcher** — Reads CONTEXT.md to know WHAT to research
   - "User wants card-based layout" → researcher investigates card component patterns
   - "Infinite scroll decided" → researcher looks into virtualization libraries

2. **gsd-planner** — Reads CONTEXT.md to know WHAT decisions are locked
   - "Pull-to-refresh on mobile" → planner includes that in task specs
   - "Loading: skeleton approach" → planner includes that in task specs

**Your job:** Capture decisions clearly enough that downstream agents can act on them without asking the user again.

**Not your job:** Figure out HOW to implement. That's what research and planning do with the decisions you capture.
</downstream_awareness>

<philosophy>
**User = founder/visionary. Claude = builder.**

The user knows:
- How they imagine it working
- What it should look/feel like
- What's essential vs nice-to-have
- Specific behaviors or references they have in mind

The user doesn't know (and shouldn't be asked):
- Codebase patterns (researcher reads the code)
- Technical risks (researcher identifies these)
- Implementation approach (planner figures this out)
- Success metrics (inferred from the work)

Ask about vision and implementation choices. Capture decisions for downstream agents.
</philosophy>

<scope_guardrail>
**CRITICAL: No scope creep.**

The phase boundary comes from ROADMAP.md and is FIXED. Discussion clarifies HOW to implement what's scoped, never WHETHER to add new capabilities.

**Allowed (clarifying ambiguity):**
- "How should posts be displayed?" (layout, density, info shown)
- "What happens on empty state?" (within the feature)
- "Pull to refresh or manual?" (behavior choice)

**Not allowed (scope creep):**
- "Should we also add comments?" (new capability)
- "What about search/filtering?" (new capability)
- "Maybe include bookmarking?" (new capability)

**The heuristic:** Does this clarify how we implement what's already in the phase, or does it add a new capability that could be its own phase?

**Scope creep signals** (detect in user responses):
```
"also add", "we should also", "and maybe", "what about adding", "could we also",
"let's include", "we need to add", "don't forget about", "while we're at it",
"might as well", "why not also", "how about adding", "plus we could",
"additionally", "on top of that", "and also", "throw in", "tack on"
```

**When scope creep detected:**
```
"[Feature X]" sounds like a new capability — that would be its own phase.
► Captured in Deferred Ideas for the roadmap backlog.
Back to [current area]...
```

**Boundary verification** — Only flag as scope creep if:
- NOT about HOW to implement (error handling, validation, tests = fine)
- NOT related to phase boundary keywords
- NOT a clarification within current discussion area
- IS a distinct new capability ("new page", "new endpoint", "separate feature")

When ambiguous, err toward NOT scope creep — better to discuss than wrongly defer.

Capture deferred ideas in a "Deferred Ideas" section. Don't lose them, don't act on them.
</scope_guardrail>

<tracking_model>
**State structure** (maintain internally, write to file at end):
- `phase`: number, name, boundary, domainType (visual/api/cli/docs/organization/data/integration)
- `domainTemplate`: expectedDecisions loaded from domain-decisions.md
- `areas[name]`: questionsAsked, clarity (0-1), decisionsLocked[], decisionsPending[]
- `deferredIdeas[]`: captured scope creep with idea, detected_in, original_text
- `specificIdeas[]`: "I want it like X" moments

**Domain detection:** Match phase description keywords → load template
- visual: display, show, ui, page, component, feed, dashboard
- api: api, endpoint, rest, graphql, request, response
- cli: cli, command, terminal, script, tool
- docs: docs, documentation, guide, readme, tutorial
- organization: organize, structure, migrate, refactor, clean up
- data: import, export, etl, pipeline, transform, process
- integration: integrate, sync, connect, webhook, third-party

**Coverage formula:**
```
coverage = locked / (locked + pending)
if no decisions expected → 1.0
```

**Clarity adjustments after each answer:**
- Predefined option selected → +0.2, move pending → locked
- "Other" with custom text → -0.1, parse and lock if interpretable
- Clamp to [0.0, 1.0]

**Question limits:**
- MIN_QUESTIONS = 3 (always ask at least 3)
- MAX_QUESTIONS = 6 (hard cap)

**Early exit gate:** Offer exit when `questionsAsked >= 3 AND coverage >= 0.7 AND clarity >= 0.6`
</tracking_model>

<recommendation_table>
**At MAX_QUESTIONS or checkpoint, select recommendation:**

| Coverage | Pending? | Clarity | Message | suggest_more |
|----------|----------|---------|---------|--------------|
| ≥70% | none | any | "We've covered {area} well." | false |
| ≥70% | none | <40% | "Covered all decisions, but some answers unclear. Clarify any?" | true |
| ≥70% | some | any | "Good coverage. Clarify: {pending}?" | true |
| 50-70% | any | ≥60% | "Solid so far. Continue, or use defaults for {pending}." | false |
| 50-70% | any | <60% | "Some answers unclear. Recommend covering {pending}." | true |
| <50% | any | any | "Only {coverage}% covered. More questions recommended." | true |

Present recommendation, then ask: "More questions, or move on?"
</recommendation_table>

<gray_area_identification>
Gray areas are **implementation decisions the user cares about** — things that could go multiple ways and would change the result.

**How to identify:**

1. Read the phase goal from ROADMAP.md
2. Understand the domain:
   - Something users SEE → visual presentation, interactions, states matter
   - Something users CALL → interface contracts, responses, errors matter
   - Something users RUN → invocation, output, behavior modes matter
   - Something users READ → structure, tone, depth, flow matter
   - Something being ORGANIZED → criteria, grouping, handling exceptions matter
3. Generate phase-specific gray areas (not generic categories)

**Examples:**
- "User authentication" → Session handling, Error responses, Multi-device policy, Recovery flow
- "Organize photo library" → Grouping criteria, Duplicate handling, Naming convention, Folder structure
- "CLI for database backups" → Output format, Flag design, Progress reporting, Error recovery

**The key question:** What decisions would change the outcome that the user should weigh in on?

**Claude handles (don't ask):** Technical implementation, architecture patterns, performance optimization, scope.
</gray_area_identification>

<process>

<step name="validate_phase" priority="first">
Phase number from argument (required). Check for `--research` flag.

Load and validate:
- Read `.planning/ROADMAP.md`
- Find phase entry
- Extract: number, name, description, status

**If not found:**
```
Phase [X] not found in roadmap.
Use /gsd:progress to see available phases.
```
Exit workflow.

**If found:** Continue to research_domain (if --research) or check_existing.
</step>

<step name="research_domain">
**If `--research` flag NOT passed:** Skip to check_existing.

**If `--research` flag passed:**

1. Check for existing guide: `.planning/phases/${PADDED_PHASE}-*/*-DISCUSSION-GUIDE.md`
2. If exists: Load and continue to check_existing
3. If missing:

Display:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► RESEARCHING DOMAIN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Researching domain to guide discussion...
◆ This identifies key decisions for Phase ${PHASE}: ${PHASE_NAME}
```

Spawn gsd-discuss-researcher:
- Model: from .planning/config.json or default haiku
- Prompt: Research domain, write DISCUSSION-GUIDE.md, return decision_areas and domain_type
- Output: `{phase_dir}/{padded_phase}-DISCUSSION-GUIDE.md`

After researcher returns:
```
✓ Discussion guide ready

Key decision areas identified:
• {area 1}
• {area 2}
• ...

Proceeding to discussion...
```
</step>

<step name="check_existing">
Check if CONTEXT.md exists: `.planning/phases/${PADDED_PHASE}-*/*-CONTEXT.md`

**If exists:** AskUserQuestion
- header: "Existing context"
- question: "Phase [X] already has context. What do you want to do?"
- options: "Update it" / "View it" / "Skip"

If "Update": Load existing, continue to analyze_phase
If "View": Display CONTEXT.md, then offer update/skip
If "Skip": Exit workflow

**If doesn't exist:** Continue to analyze_phase.
</step>

<step name="analyze_phase">
Analyze phase to identify gray areas worth discussing.

**Determine:**
1. **Domain boundary** — What capability is this phase delivering?
2. **Gray areas** — 1-2 specific ambiguities per relevant category that would change implementation
3. **Skip assessment** — If no meaningful gray areas (pure infrastructure), phase may not need discussion

Example for "Post Feed":
```
Domain: Displaying posts from followed users
Gray areas:
- Layout style (cards vs timeline vs grid)
- Information density (full posts vs previews)
- Loading pattern (infinite scroll vs pagination)
- Empty state handling
- Metadata display (time, author, reactions)
```
</step>

<step name="present_gray_areas">
Present domain boundary and gray areas.

**State the boundary:**
```
Phase [X]: [Name]
Domain: [What this phase delivers]

We'll clarify HOW to implement this.
(New capabilities belong in other phases.)
```

**AskUserQuestion (multiSelect: true):**
- header: "Discuss"
- question: "Which areas do you want to discuss for [phase name]?"
- options: 3-4 phase-specific gray areas as:
  - "[Specific area]" (label) — concrete, not generic
  - [1-2 questions this covers] (description)

**Example options:**
```
☐ Layout style — Cards vs list? Information density?
☐ Loading behavior — Infinite scroll or pagination? Pull to refresh?
☐ Content ordering — Chronological, algorithmic, or user choice?
```

Do NOT include skip/you-decide option — user ran this command to discuss.

Continue to discuss_areas with selected areas.
</step>

<step name="discuss_areas">
For each selected area, conduct adaptive discussion using Tracking Model.

**For each area:**

1. **Initialize:** Scope `decisionsPending` to current area only (not full template)

2. **Announce:**
   ```
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    DISCUSSING: [Area]
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ```

3. **Ask questions** via AskUserQuestion:
   - header: "[Area]"
   - question: Specific decision
   - options: 2-3 concrete choices as `{ label, description }` objects:
     - Place recommended option FIRST with "(Recommended)" suffix in label
     - Put the recommendation rationale in the recommended option's `description` (e.g., "Best for this phase because [reason]")
     - Give non-recommended options a brief `description` explaining their tradeoff
   - AskUserQuestion adds "Other" automatically
   - NEVER include "You decide", "Claude decides", "Let Claude choose", or any delegation option
   - Do NOT output recommendation text before the question — rationale must be IN the option descriptions so it remains visible while the user is selecting

4. **After each answer:**
   - Update clarity/coverage per Tracking Model
   - Check for scope creep signals (see `<scope_guardrail>`)
   - If scope creep: capture idea, show scope guard message, return to question

5. **Apply checkpoint logic:**
   - If `pending == 0 AND asked >= MIN`: "No expected decisions remain — move on?"
   - If `asked >= MIN AND coverage >= 0.7 AND clarity >= 0.6`: "Looks clear — continue or move on?"
   - If `asked >= MAX`: Show recommendation (see `<recommendation_table>`), ask "More questions, or move on?"
   - Else: Continue asking

6. **Show area recap:**
   ```
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    [AREA] — Captured Decisions
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

   • [Decision 1]: [User's choice]
   • [Decision 2]: [User's choice]

   Confirm or tweak?
   ```

   AskUserQuestion: "Looks good" / "Tweak something"

7. **After all areas:** "That covers [list areas]. Ready to create context?" → "Create context" / "Revisit an area"

**Question design:**
- Options concrete, not abstract ("Cards" not "Option A")
- Each answer informs next question
- If "Other": reflect back, confirm
- Track "I want it like X" in specificIdeas
</step>

<step name="write_context">
Create CONTEXT.md capturing decisions.

**Find or create phase directory:**
```bash
PADDED_PHASE=$(printf "%02d" ${PHASE})
PHASE_DIR=$(ls -d .planning/phases/${PADDED_PHASE}-* 2>/dev/null | head -1)
if [ -z "$PHASE_DIR" ]; then
  PHASE_NAME=$(grep "Phase ${PHASE}:" .planning/ROADMAP.md | sed 's/.*Phase [0-9]*: //' | tr '[:upper:]' '[:lower:]' | tr ' ' '-')
  mkdir -p ".planning/phases/${PADDED_PHASE}-${PHASE_NAME}"
  PHASE_DIR=".planning/phases/${PADDED_PHASE}-${PHASE_NAME}"
fi
```

**File:** `${PHASE_DIR}/${PADDED_PHASE}-CONTEXT.md`

**Structure:**
```markdown
# Phase [X]: [Name] - Context

**Gathered:** [date]
**Status:** Ready for planning

<domain>
## Phase Boundary

[Clear statement of what this phase delivers]
</domain>

<decisions>
## Implementation Decisions

### [Category 1]
- [Decision or preference]

### [Category 2]
- [Decision or preference]


</decisions>

<specifics>
## Specific Ideas

[References, examples, "I want it like X" moments]
[If none: "No specific requirements — open to standard approaches"]
</specifics>

<deferred>
## Deferred Ideas

[Ideas that came up but belong in other phases]
[If none: "None — discussion stayed within phase scope"]
</deferred>

---

*Phase: XX-name*
*Context gathered: [date]*
```
</step>

<step name="confirm_creation">
Present summary and next steps:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 CONTEXT CREATED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ Created: .planning/phases/${PADDED_PHASE}-${SLUG}/${PADDED_PHASE}-CONTEXT.md

## Decisions Captured

### [Category]
- [Key decision]

[If deferred ideas:]
## Noted for Later
- [Deferred idea] — future phase

---

## Coverage Summary

• Decisions locked: [N]
• Deferred ideas: [N]

---

## ▶ Next Up

**Phase ${PHASE}: [Name]** — [Goal from ROADMAP.md]

`/gsd:plan-phase ${PHASE}`

<sub>`/clear` first → fresh context window</sub>

---

**Also available:**
- `/gsd:plan-phase ${PHASE} --skip-research` — plan without research
- Review/edit CONTEXT.md before continuing
```
</step>

<step name="git_commit">
Commit phase context:

**Check config:**
```bash
COMMIT_PLANNING_DOCS=$(cat .planning/config.json 2>/dev/null | grep -o '"commit_docs"[[:space:]]*:[[:space:]]*[^,}]*' | grep -o 'true\|false' || echo "true")
git check-ignore -q .planning 2>/dev/null && COMMIT_PLANNING_DOCS=false
```

**If false:** Skip git operations

**If true:**
```bash
git add "${PHASE_DIR}/${PADDED_PHASE}-CONTEXT.md"
git commit -m "$(cat <<'EOF'
docs(${PADDED_PHASE}): capture phase context

Phase ${PADDED_PHASE}: ${PHASE_NAME}
- Implementation decisions documented
- Phase boundary established
EOF
)"
```

Confirm: "✓ Committed: docs(${PADDED_PHASE}): capture phase context"
</step>

</process>

<success_criteria>
- Phase validated against roadmap
- Gray areas identified through intelligent analysis (not generic questions)
- User selected which areas to discuss
- **Adaptive questioning** — early exit requires coverage ≥70% AND clarity ≥60% (min 3, max 6 questions)
- **Recap after each area** — user confirms decisions before moving on
- **Real-time scope guard** — scope creep captured immediately, discussion continues uninterrupted
- CONTEXT.md captures actual decisions, not vague vision
- Deferred ideas preserved for future phases
- User knows next steps
</success_criteria>
