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
   - "Claude's Discretion: loading skeleton" → planner can decide approach

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

**When user suggests scope creep:**
```
"[Feature X] would be a new capability — that's its own phase.
Want me to note it for the roadmap backlog?

For now, let's focus on [phase domain]."
```

Capture the idea in a "Deferred Ideas" section. Don't lose it, don't act on it.
</scope_guardrail>

<gray_area_identification>
Gray areas are **implementation decisions the user cares about** — things that could go multiple ways and would change the result.

**How to identify gray areas:**

1. **Read the phase goal** from ROADMAP.md
2. **Understand the domain** — What kind of thing is being built?
   - Something users SEE → visual presentation, interactions, states matter
   - Something users CALL → interface contracts, responses, errors matter
   - Something users RUN → invocation, output, behavior modes matter
   - Something users READ → structure, tone, depth, flow matter
   - Something being ORGANIZED → criteria, grouping, handling exceptions matter
3. **Generate phase-specific gray areas** — Not generic categories, but concrete decisions for THIS phase

**Don't use generic category labels** (UI, UX, Behavior). Generate specific gray areas:

```
Phase: "User authentication"
→ Session handling, Error responses, Multi-device policy, Recovery flow

Phase: "Organize photo library"
→ Grouping criteria, Duplicate handling, Naming convention, Folder structure

Phase: "CLI for database backups"
→ Output format, Flag design, Progress reporting, Error recovery

Phase: "API documentation"
→ Structure/navigation, Code examples depth, Versioning approach, Interactive elements
```

**The key question:** What decisions would change the outcome that the user should weigh in on?

**Claude handles these (don't ask):**
- Technical implementation details
- Architecture patterns
- Performance optimization
- Scope (roadmap defines this)
</gray_area_identification>

<process>

**Express path available:** If you already have a PRD or acceptance criteria document, use `/gsd:plan-phase {phase} --prd path/to/prd.md` to skip this discussion and go straight to planning.

<step name="initialize" priority="first">
Phase number from argument (required).

```bash
INIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init phase-op "${PHASE}")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Parse JSON for: `commit_docs`, `phase_found`, `phase_dir`, `phase_number`, `phase_name`, `phase_slug`, `padded_phase`, `has_research`, `has_context`, `has_plans`, `has_verification`, `plan_count`, `roadmap_exists`, `planning_exists`.

**If `phase_found` is false:**
```
Phase [X] not found in roadmap.

Use /gsd:progress to see available phases.
```
Exit workflow.

**If `phase_found` is true:** Continue to session_resume.
</step>

<step name="session_resume">
### Multi-Session Resume (before check_existing)

Before checking for existing CONTEXT.md, check if a DISCUSS-STATE.md exists in the phase directory:

```bash
ls ${phase_dir}/DISCUSS-STATE.md 2>/dev/null
```

**If DISCUSS-STATE.md exists** (indicates a previous session was interrupted):

1. Read the file and parse the area checklist:
   - `[x]` = COMPLETED areas (decisions already captured)
   - `[~]` = PARTIAL areas (some questions done)
   - `[ ]` = NOT STARTED areas

2. Use AskUserQuestion:
   - header: "Previous session"
   - question: "Found saved discussion state (N of M areas completed). Resume where you left off?"
   - options:
     - "Resume" — Continue with remaining areas, skip completed ones
     - "Start fresh" — Delete saved state and start over
     - "View state" — Show the saved state before deciding

3. If "Resume":
   - Load decisions from completed `[x]` areas into memory
   - Load partial `[~]` area state
   - Set `areas_to_discuss` = only `[ ]` and `[~]` areas
   - Skip `check_existing`, `analyze_phase`, `present_gray_areas`
   - Jump directly to `discuss_areas` with remaining areas
   - Announce: "Resuming discussion. Areas completed: [list]. Continuing with: [list]."

4. If "View state": Display DISCUSS-STATE.md content, then re-offer Resume/Start fresh

5. If "Start fresh": Delete DISCUSS-STATE.md, continue normally

**If DISCUSS-STATE.md does not exist:** Continue normally to `check_existing`.
</step>

<step name="check_existing">
Check if CONTEXT.md already exists using `has_context` from init.

```bash
ls ${phase_dir}/*-CONTEXT.md 2>/dev/null
```

**If exists:**
Use AskUserQuestion:
- header: "Context"
- question: "Phase [X] already has context. What do you want to do?"
- options:
  - "Update it" — Review and revise existing context
  - "View it" — Show me what's there
  - "Skip" — Use existing context as-is

If "Update": Load existing, continue to analyze_phase
If "View": Display CONTEXT.md, then offer update/skip
If "Skip": Exit workflow

**If doesn't exist:**

Check `has_plans` and `plan_count` from init. **If `has_plans` is true:**

Use AskUserQuestion:
- header: "Plans exist"
- question: "Phase [X] already has {plan_count} plan(s) created without user context. Your decisions here won't affect existing plans unless you replan."
- options:
  - "Continue and replan after" — Capture context, then run /gsd:plan-phase {X} to replan
  - "View existing plans" — Show plans before deciding
  - "Cancel" — Skip discuss-phase

If "Continue and replan after": Continue to analyze_phase.
If "View existing plans": Display plan files, then offer "Continue" / "Cancel".
If "Cancel": Exit workflow.

**If `has_plans` is false:** Continue to load_prior_context.
</step>

<step name="load_prior_context">
Read project-level and prior phase context to avoid re-asking decided questions and maintain consistency.

**Step 1: Read project-level files**
```bash
# Core project files
cat .planning/PROJECT.md 2>/dev/null
cat .planning/REQUIREMENTS.md 2>/dev/null
cat .planning/STATE.md 2>/dev/null
```

Extract from these:
- **PROJECT.md** — Vision, principles, non-negotiables, user preferences
- **REQUIREMENTS.md** — Acceptance criteria, constraints, must-haves vs nice-to-haves
- **STATE.md** — Current progress, any flags or session notes

**Step 2: Read all prior CONTEXT.md files**
```bash
# Find all CONTEXT.md files from phases before current
find .planning/phases -name "*-CONTEXT.md" 2>/dev/null | sort
```

For each CONTEXT.md where phase number < current phase:
- Read the `<decisions>` section — these are locked preferences
- Read `<specifics>` — particular references or "I want it like X" moments
- Note any patterns (e.g., "user consistently prefers minimal UI", "user rejected single-key shortcuts")

**Step 3: Build internal `<prior_decisions>` context**

Structure the extracted information:
```
<prior_decisions>
## Project-Level
- [Key principle or constraint from PROJECT.md]
- [Requirement that affects this phase from REQUIREMENTS.md]

## From Prior Phases
### Phase N: [Name]
- [Decision that may be relevant to current phase]
- [Preference that establishes a pattern]

### Phase M: [Name]
- [Another relevant decision]
</prior_decisions>
```

**Usage in subsequent steps:**
- `analyze_phase`: Skip gray areas already decided in prior phases
- `present_gray_areas`: Annotate options with prior decisions ("You chose X in Phase 5")
- `discuss_areas`: Pre-fill answers or flag conflicts ("This contradicts Phase 3 — same here or different?")

**If no prior context exists:** Continue without — this is expected for early phases.
</step>

<step name="scout_codebase">
Lightweight scan of existing code to inform gray area identification and discussion. Uses ~10% context — acceptable for an interactive session.

**Step 1: Check for existing codebase maps**
```bash
ls .planning/codebase/*.md 2>/dev/null
```

**If codebase maps exist:** Read the most relevant ones (CONVENTIONS.md, STRUCTURE.md, STACK.md based on phase type). Extract:
- Reusable components/hooks/utilities
- Established patterns (state management, styling, data fetching)
- Integration points (where new code would connect)

Skip to Step 3 below.

**Step 2: If no codebase maps, do targeted grep**

Extract key terms from the phase goal (e.g., "feed" → "post", "card", "list"; "auth" → "login", "session", "token").

```bash
# Find files related to phase goal terms
grep -rl "{term1}\|{term2}" src/ app/ --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" 2>/dev/null | head -10

# Find existing components/hooks
ls src/components/ 2>/dev/null
ls src/hooks/ 2>/dev/null
ls src/lib/ src/utils/ 2>/dev/null
```

Read the 3-5 most relevant files to understand existing patterns.

**Step 3: Build internal codebase_context**

From the scan, identify:
- **Reusable assets** — existing components, hooks, utilities that could be used in this phase
- **Established patterns** — how the codebase does state management, styling, data fetching
- **Integration points** — where new code would connect (routes, nav, providers)
- **Creative options** — approaches the existing architecture enables or constrains

Store as internal `<codebase_context>` for use in analyze_phase and present_gray_areas. This is NOT written to a file — it's used within this session only.
</step>

<step name="analyze_phase">
Analyze the phase to identify gray areas worth discussing. **Use both `prior_decisions` and `codebase_context` to ground the analysis.**

**Read the phase description from ROADMAP.md and determine:**

1. **Domain boundary** — What capability is this phase delivering? State it clearly.

2. **Check prior decisions** — Before generating gray areas, check if any were already decided:
   - Scan `<prior_decisions>` for relevant choices (e.g., "Ctrl+C only, no single-key shortcuts")
   - These are **pre-answered** — don't re-ask unless this phase has conflicting needs
   - Note applicable prior decisions for use in presentation

3. **Gray areas by category** — For each relevant category (UI, UX, Behavior, Empty States, Content), identify 1-2 specific ambiguities that would change implementation. **Annotate with code context where relevant** (e.g., "You already have a Card component" or "No existing pattern for this").

4. **Skip assessment** — If no meaningful gray areas exist (pure infrastructure, clear-cut implementation, or all already decided in prior phases), the phase may not need discussion.

**Output your analysis internally, then present to user.**

Example analysis for "Post Feed" phase (with code and prior context):
```
Domain: Displaying posts from followed users
Existing: Card component (src/components/ui/Card.tsx), useInfiniteQuery hook, Tailwind CSS
Prior decisions: "Minimal UI preferred" (Phase 2), "No pagination — always infinite scroll" (Phase 4)
Gray areas:
- UI: Layout style (cards vs timeline vs grid) — Card component exists with shadow/rounded variants
- UI: Information density (full posts vs previews) — no existing density patterns
- Behavior: Loading pattern — ALREADY DECIDED: infinite scroll (Phase 4)
- Empty State: What shows when no posts exist — EmptyState component exists in ui/
- Content: What metadata displays (time, author, reactions count)
```
</step>

<step name="present_gray_areas">
Present the domain boundary, prior decisions, and gray areas to user.

**First, state the boundary and any prior decisions that apply:**
```
Phase [X]: [Name]
Domain: [What this phase delivers — from your analysis]

We'll clarify HOW to implement this.
(New capabilities belong in other phases.)

[If prior decisions apply:]
**Carrying forward from earlier phases:**
- [Decision from Phase N that applies here]
- [Decision from Phase M that applies here]
```

**Then use AskUserQuestion (multiSelect: true):**
- header: "Discuss"
- question: "Which areas do you want to discuss for [phase name]?"
- options: Generate 3-4 phase-specific gray areas, each with:
  - "[Specific area]" (label) — concrete, not generic
  - [1-2 questions this covers + code context annotation] (description)
  - **Highlight the recommended choice with brief explanation why**

**Prior decision annotations:** When a gray area was already decided in a prior phase, annotate it:
```
☐ Exit shortcuts — How should users quit?
  (You decided "Ctrl+C only, no single-key shortcuts" in Phase 5 — revisit or keep?)
```

**Code context annotations:** When the scout found relevant existing code, annotate the gray area description:
```
☐ Layout style — Cards vs list vs timeline?
  (You already have a Card component with shadow/rounded variants. Reusing it keeps the app consistent.)
```

**Combining both:** When both prior decisions and code context apply:
```
☐ Loading behavior — Infinite scroll or pagination?
  (You chose infinite scroll in Phase 4. useInfiniteQuery hook already set up.)
```

**Do NOT include a "skip" or "you decide" option.** User ran this command to discuss — give them real choices.

**Examples by domain (with code context):**

For "Post Feed" (visual feature):
```
☐ Layout style — Cards vs list vs timeline? (Card component exists with variants)
☐ Loading behavior — Infinite scroll or pagination? (useInfiniteQuery hook available)
☐ Content ordering — Chronological, algorithmic, or user choice?
☐ Post metadata — What info per post? Timestamps, reactions, author?
```

For "Database backup CLI" (command-line tool):
```
☐ Output format — JSON, table, or plain text? Verbosity levels?
☐ Flag design — Short flags, long flags, or both? Required vs optional?
☐ Progress reporting — Silent, progress bar, or verbose logging?
☐ Error recovery — Fail fast, retry, or prompt for action?
```

For "Organize photo library" (organization task):
```
☐ Grouping criteria — By date, location, faces, or events?
☐ Duplicate handling — Keep best, keep all, or prompt each time?
☐ Naming convention — Original names, dates, or descriptive?
☐ Folder structure — Flat, nested by year, or by category?
```

Continue to discuss_areas with selected areas.
</step>

<step name="discuss_areas">
For each selected area, conduct a focused discussion loop.

**Philosophy: 4 questions, then check.**

Ask 4 questions per area before offering to continue or move on. Each answer often reveals the next question.

**For each area:**

1. **Announce the area:**
   ```
   Let's talk about [Area].
   ```

2. **Ask 4 questions using AskUserQuestion:**
   - header: "[Area]" (max 12 chars — abbreviate if needed)
   - question: Specific decision for this area
   - options: 2-3 concrete choices (AskUserQuestion adds "Other" automatically), with the recommended choice highlighted and brief explanation why
   - **Annotate options with code context** when relevant:
     ```
     "How should posts be displayed?"
     - Cards (reuses existing Card component — consistent with Messages)
     - List (simpler, would be a new pattern)
     - Timeline (needs new Timeline component — none exists yet)
     ```
   - Include "You decide" as an option when reasonable — captures Claude discretion
   - **Context7 for library choices:** When a gray area involves library selection (e.g., "magic links" → query next-auth docs) or API approach decisions, use `mcp__context7__*` tools to fetch current documentation and inform the options. Don't use Context7 for every question — only when library-specific knowledge improves the options.

3. **After 4 questions, check:**
   - header: "[Area]" (max 12 chars)
   - question: "More questions about [area], or move to next?"
   - options: "More questions" / "Next area"

   If "More questions" → ask 4 more, then check again
   If "Next area" → proceed to next selected area
   If "Other" (free text) → interpret intent: continuation phrases ("chat more", "keep going", "yes", "more") map to "More questions"; advancement phrases ("done", "move on", "next", "skip") map to "Next area". If ambiguous, ask: "Continue with more questions about [area], or move to the next area?"

4. **After all initially-selected areas complete:**
   - Summarize what was captured from the discussion so far
   - AskUserQuestion:
     - header: "Done"
     - question: "We've discussed [list areas]. Which gray areas remain unclear?"
     - options: "Explore more gray areas" / "I'm ready for context"
   - If "Explore more gray areas":
     - Identify 2-4 additional gray areas based on what was learned
     - Return to present_gray_areas logic with these new areas
     - Loop: discuss new areas, then prompt again
   - If "I'm ready for context": Proceed to write_context

**Question design:**
- Options should be concrete, not abstract ("Cards" not "Option A")
- Each answer should inform the next question
- If user picks "Other" to provide freeform input (e.g., "let me describe it", "something else", or an open-ended reply), ask your follow-up as plain text — NOT another AskUserQuestion. Wait for them to type at the normal prompt, then reflect their input back and confirm before resuming AskUserQuestion for the next question.

**Scope creep handling:**
If user mentions something outside the phase domain:
```
"[Feature] sounds like a new capability — that belongs in its own phase.
I'll note it as a deferred idea.

Back to [current area]: [return to current question]"
```

Track deferred ideas internally.

### Progress Save Points (during discuss_areas)

After completing all questions for an area and before moving to the next, offer a save point:

Use AskUserQuestion:
- header: "Progress"
- question: "Area '[name]' complete. What next?"
- options:
  - "Continue" — Proceed to next area without saving
  - "Save and continue" — Save progress to disk, then continue
  - "Save and stop" — Save progress, commit, and end session

If "Save and continue" or "Save and stop":
1. Write `${phase_dir}/DISCUSS-STATE.md` with area completion status and captured decisions
2. Commit the state file:
   ```bash
   node ~/.claude/get-shit-done/bin/gsd-tools.cjs commit "docs(${padded_phase}): save discussion state" --files "${phase_dir}/DISCUSS-STATE.md"
   ```
3. If "Save and stop": Inform user "Saved. Resume with `/gsd:discuss-phase ${PHASE}` in a new session." and exit

**Auto-save on context warning:** If a context window warning is received (WARNING or CRITICAL severity), immediately save state, commit, and exit — do NOT attempt further discussion.

**Cleanup:** When all areas are discussed and CONTEXT.md is created successfully, delete DISCUSS-STATE.md (it is transitional).

**DISCUSS-STATE.md format:**

```markdown
# Phase ${phase}: Discussion State (Multi-Session)

**Started:** [date of first session]
**Last Updated:** [current date/time]
**Status:** In Progress — N of M areas completed

## Areas
1. [x] **Area Name** — COMPLETED
2. [~] **Area Name** — PARTIAL (N of M questions answered)
3. [ ] **Area Name** — NOT STARTED

## Completed Areas
### Area 1: [Name]
- [Decisions captured]

## Partial Areas
### Area 2: [Name]
- [Decisions so far]
- Topics remaining: [list]
```
</step>

<step name="write_context">
Create CONTEXT.md capturing decisions made.

**Find or create phase directory:**

Use values from init: `phase_dir`, `phase_slug`, `padded_phase`.

If `phase_dir` is null (phase exists in roadmap but no directory):
```bash
mkdir -p ".planning/phases/${padded_phase}-${phase_slug}"
```

**File location:** `${phase_dir}/${padded_phase}-CONTEXT.md`

**Structure the content by what was discussed:**

```markdown
# Phase [X]: [Name] - Context

**Gathered:** [date]
**Status:** Ready for planning

<domain>
## Phase Boundary

[Clear statement of what this phase delivers — the scope anchor]

</domain>

<decisions>
## Implementation Decisions

### [Category 1 that was discussed]
- [Decision or preference captured]
- [Another decision if applicable]

### [Category 2 that was discussed]
- [Decision or preference captured]

### Claude's Discretion
[Areas where user said "you decide" — note that Claude has flexibility here]

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- [Component/hook/utility]: [How it could be used in this phase]

### Established Patterns
- [Pattern]: [How it constrains/enables this phase]

### Integration Points
- [Where new code connects to existing system]

</code_context>

<specifics>
## Specific Ideas

[Any particular references, examples, or "I want it like X" moments from discussion]

[If none: "No specific requirements — open to standard approaches"]

</specifics>

<deferred>
## Deferred Ideas

[Ideas that came up but belong in other phases. Don't lose them.]

[If none: "None — discussion stayed within phase scope"]

</deferred>

---

*Phase: XX-name*
*Context gathered: [date]*
```

Write file.
</step>

<step name="assumption_verification">
### Assumption Verification (after write_context, before confirm_creation)

After writing CONTEXT.md and before confirming creation, offer automated verification:

Use AskUserQuestion:
- header: "Verify"
- question: "CONTEXT.md created. Run automated assumption verification? (A fresh agent reads CONTEXT.md 'cold' to find gaps and ambiguities.)"
- options:
  - "Yes, verify" — Spawn verification agent
  - "Skip verification" — Proceed directly

**If "Skip verification":** Continue to `confirm_creation`.

**If "Yes, verify":** Spawn an Explore subagent via Task tool to read CONTEXT.md cold (without discussion context) and analyze for:
- **GAP**: A decision that should exist but doesn't
- **AMBIGUITY**: A decision that could be interpreted multiple ways
- **CONTRADICTION**: Two decisions that conflict
- **IMPLICIT_ASSUMPTION**: Something assumed but never stated

The agent returns a severity rating:
- **CLEAN** (0-1 minor): Proceed to `confirm_creation`
- **MINOR** (2-3 findings): Show findings, offer "Auto-refine" or "Accept as-is"
- **NEEDS_REFINEMENT** (4+ or critical): Show findings, offer "Refine all", "Cherry-pick", or "Accept as-is"

If refinement chosen, address each finding interactively with the user, update CONTEXT.md, and re-commit.

**Maximum 2 verification rounds** (hard cap to prevent infinite loops and context exhaustion).

**Why this matters:** The discuss-phase agent has full discussion context, which masks gaps that downstream planners (who only read CONTEXT.md) would struggle with. A fresh agent reading "cold" simulates the downstream experience.
</step>

<step name="confirm_creation">
Present summary and next steps:

```
Created: .planning/phases/${PADDED_PHASE}-${SLUG}/${PADDED_PHASE}-CONTEXT.md

## Decisions Captured

### [Category]
- [Key decision]

### [Category]
- [Key decision]

[If deferred ideas exist:]
## Noted for Later
- [Deferred idea] — future phase

---

## ▶ Next Up

**Phase ${PHASE}: [Name]** — [Goal from ROADMAP.md]

`/gsd:plan-phase ${PHASE}`

<sub>`/clear` first → fresh context window</sub>

---

**Also available:**
- `/gsd:plan-phase ${PHASE} --skip-research` — plan without research
- Review/edit CONTEXT.md before continuing

---
```
</step>

<step name="git_commit">
Commit phase context (uses `commit_docs` from init internally):

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "docs(${padded_phase}): capture phase context" --files "${phase_dir}/${padded_phase}-CONTEXT.md"
```

Confirm: "Committed: docs(${padded_phase}): capture phase context"
</step>

<step name="update_state">
Update STATE.md with session info:

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" state record-session \
  --stopped-at "Phase ${PHASE} context gathered" \
  --resume-file "${phase_dir}/${padded_phase}-CONTEXT.md"
```

Commit STATE.md:

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "docs(state): record phase ${PHASE} context session" --files .planning/STATE.md
```
</step>

<step name="auto_advance">
Check for auto-advance trigger:

1. Parse `--auto` flag from $ARGUMENTS
2. **Sync chain flag with intent** — if user invoked manually (no `--auto`), clear the ephemeral chain flag from any previous interrupted `--auto` chain. This does NOT touch `workflow.auto_advance` (the user's persistent settings preference):
   ```bash
   if [[ ! "$ARGUMENTS" =~ --auto ]]; then
     node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" config-set workflow._auto_chain_active false 2>/dev/null
   fi
   ```
3. Read both the chain flag and user preference:
   ```bash
   AUTO_CHAIN=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" config-get workflow._auto_chain_active 2>/dev/null || echo "false")
   AUTO_CFG=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" config-get workflow.auto_advance 2>/dev/null || echo "false")
   ```

**If `--auto` flag present AND `AUTO_CHAIN` is not true:** Persist chain flag to config (handles direct `--auto` usage without new-project):
```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" config-set workflow._auto_chain_active true
```

**If `--auto` flag present OR `AUTO_CHAIN` is true OR `AUTO_CFG` is true:**

Display banner:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► AUTO-ADVANCING TO PLAN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Context captured. Launching plan-phase...
```

Launch plan-phase using the Skill tool to avoid nested Task sessions (which cause runtime freezes due to deep agent nesting — see #686):
```
Skill(skill="gsd:plan-phase", args="${PHASE} --auto")
```

This keeps the auto-advance chain flat — discuss, plan, and execute all run at the same nesting level rather than spawning increasingly deep Task agents.

**Handle plan-phase return:**
- **PHASE COMPLETE** → Full chain succeeded. Display:
  ```
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   GSD ► PHASE ${PHASE} COMPLETE
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Auto-advance pipeline finished: discuss → plan → execute

  Next: /gsd:discuss-phase ${NEXT_PHASE} --auto
  <sub>/clear first → fresh context window</sub>
  ```
- **PLANNING COMPLETE** → Planning done, execution didn't complete:
  ```
  Auto-advance partial: Planning complete, execution did not finish.
  Continue: /gsd:execute-phase ${PHASE}
  ```
- **PLANNING INCONCLUSIVE / CHECKPOINT** → Stop chain:
  ```
  Auto-advance stopped: Planning needs input.
  Continue: /gsd:plan-phase ${PHASE}
  ```
- **GAPS FOUND** → Stop chain:
  ```
  Auto-advance stopped: Gaps found during execution.
  Continue: /gsd:plan-phase ${PHASE} --gaps
  ```

**If neither `--auto` nor config enabled:**
Route to `confirm_creation` step (existing behavior — show manual next steps).
</step>

</process>

<success_criteria>
- Phase validated against roadmap
- Prior context loaded (PROJECT.md, REQUIREMENTS.md, STATE.md, prior CONTEXT.md files)
- Already-decided questions not re-asked (carried forward from prior phases)
- Codebase scouted for reusable assets, patterns, and integration points
- Gray areas identified through intelligent analysis with code and prior decision annotations
- User selected which areas to discuss
- Each selected area explored until user satisfied (with code-informed and prior-decision-informed options)
- Scope creep redirected to deferred ideas
- CONTEXT.md captures actual decisions, not vague vision
- CONTEXT.md includes code_context section with reusable assets and patterns
- Deferred ideas preserved for future phases
- STATE.md updated with session info
- User knows next steps
- (Multi-session) Interrupted sessions can be resumed from DISCUSS-STATE.md
- (Multi-session) Progress save points prevent context-window data loss
- (Verification) CONTEXT.md gaps caught before downstream consumption
</success_criteria>
