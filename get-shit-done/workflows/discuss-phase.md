<purpose>
Extract implementation decisions that downstream agents need. Analyze the phase to identify gray areas, let the user choose what to discuss, then deep-dive each selected area until satisfied.

You are a thinking partner, not an interviewer. The user is the visionary — you are the builder. Your job is to capture decisions that will guide research and planning, not to figure out implementation yourself.
</purpose>

<required_reading>
@~/.claude/get-shit-done/references/domain-probes.md
@~/.claude/get-shit-done/references/gate-prompts.md
@~/.claude/get-shit-done/references/universal-anti-patterns.md
</required_reading>

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

<answer_validation>
**IMPORTANT: Answer validation** — After every AskUserQuestion call, check if the response is empty or whitespace-only. If so:
1. Retry the question once with the same parameters
2. If still empty, present the options as a plain-text numbered list and ask the user to type their choice number
Never proceed with an empty answer.

**Text mode (`workflow.text_mode: true` in config or `--text` flag):**
When text mode is active, **do not use AskUserQuestion at all**. Instead, present every
question as a plain-text numbered list and ask the user to type their choice number.
This is required for Claude Code remote sessions (`/rc` mode) where the Claude App
cannot forward TUI menu selections back to the host.

Enable text mode:
- Per-session: pass `--text` flag to any command (e.g., `/gsd-discuss-phase --text`)
- Per-project: `gsd-tools config-set workflow.text_mode true`

Text mode applies to ALL workflows in the session, not just discuss-phase.
</answer_validation>

<process>

**Express path available:** If you already have a PRD or acceptance criteria document, use `/gsd-plan-phase {phase} --prd path/to/prd.md` to skip this discussion and go straight to planning.

<step name="initialize" priority="first">
Phase number from argument (required).

```bash
INIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init phase-op "${PHASE}")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
AGENT_SKILLS_ADVISOR=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" agent-skills gsd-advisor 2>/dev/null)
```

Parse JSON for: `commit_docs`, `phase_found`, `phase_dir`, `phase_number`, `phase_name`, `phase_slug`, `padded_phase`, `has_research`, `has_context`, `has_plans`, `has_verification`, `plan_count`, `roadmap_exists`, `planning_exists`, `response_language`.

**If `response_language` is set:** All user-facing questions, prompts, and explanations in this workflow MUST be presented in `{response_language}`. This includes AskUserQuestion labels, option text, gray area descriptions, and discussion summaries. Technical terms, code, and file paths remain in English. Subagent prompts stay in English — only user-facing output is translated.

**If `phase_found` is false:**
```
Phase [X] not found in roadmap.

Use /gsd-progress ${GSD_WS} to see available phases.
```
Exit workflow.

**If `phase_found` is true:** Continue to check_existing.

**Power mode** — If `--power` is present in ARGUMENTS:
- Skip interactive questioning entirely
- Read and execute @~/.claude/get-shit-done/workflows/discuss-phase-power.md end-to-end
- Do not continue with the steps below

**Auto mode** — If `--auto` is present in ARGUMENTS:
- In `check_existing`: auto-select "Skip" (if context exists) or continue without prompting (if no context/plans)
- In `present_gray_areas`: auto-select ALL gray areas without asking the user
- In `discuss_areas`: for each discussion question, choose the recommended option (first option, or the one marked "recommended") without using AskUserQuestion
- Log each auto-selected choice inline so the user can review decisions in the context file
- After discussion completes, auto-advance to plan-phase (existing behavior)

**Chain mode** — If `--chain` is present in ARGUMENTS:
- Discussion is fully interactive (questions, gray area selection — same as default mode)
- After discussion completes, auto-advance to plan-phase → execute-phase (same as `--auto`)
- This is the middle ground: user controls the discuss decisions, then plan+execute run autonomously
</step>

<step name="check_blocking_antipatterns" priority="first">
**MANDATORY — Check for blocking anti-patterns before any other work.**

Look for a `.continue-here.md` in the current phase directory:

```bash
ls ${phase_dir}/.continue-here.md 2>/dev/null || true
```

If `.continue-here.md` exists, parse its "Critical Anti-Patterns" table for rows with `severity` = `blocking`.

**If one or more `blocking` anti-patterns are found:**

This step cannot be skipped. Before proceeding to `check_existing` or any other step, the agent must demonstrate understanding of each blocking anti-pattern by answering all three questions for each one:

1. **What is this anti-pattern?** — Describe it in your own words, not by quoting the handoff.
2. **How did it manifest?** — Explain the specific failure that caused it to be recorded.
3. **What structural mechanism (not acknowledgment) prevents it?** — Name the concrete step, checklist item, or enforcement mechanism that stops recurrence.

Write these answers inline before continuing. If a blocking anti-pattern cannot be answered from the context in `.continue-here.md`, stop and ask the user for clarification.

**If no `.continue-here.md` exists, or no `blocking` rows are found:** Proceed directly to `check_existing`.
</step>

<step name="check_existing">
Check if CONTEXT.md already exists using `has_context` from init.

```bash
ls ${phase_dir}/*-CONTEXT.md 2>/dev/null || true
```

**If exists:**

**If `--auto`:** Auto-select "Update it" — load existing context and continue to analyze_phase. Log: `[auto] Context exists — updating with auto-selected decisions.`

**Otherwise:** Use AskUserQuestion:
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

**Check for interrupted discussion checkpoint:**

```bash
ls ${phase_dir}/*-DISCUSS-CHECKPOINT.json 2>/dev/null || true
```

If a checkpoint file exists (previous session was interrupted before CONTEXT.md was written):

**If `--auto`:** Auto-select "Resume" — load checkpoint and continue from last completed area.

**Otherwise:** Use AskUserQuestion:
- header: "Resume"
- question: "Found interrupted discussion checkpoint ({N} areas completed out of {M}). Resume from where you left off?"
- options:
  - "Resume" — Load checkpoint, skip completed areas, continue discussion
  - "Start fresh" — Delete checkpoint, start discussion from scratch

If "Resume": Parse the checkpoint JSON. Load `decisions` into the internal accumulator. Set `areas_completed` to skip those areas. Continue to `present_gray_areas` with only the remaining areas.
If "Start fresh": Delete the checkpoint file. Continue as if no checkpoint existed.

Check `has_plans` and `plan_count` from init. **If `has_plans` is true:**

**If `--auto`:** Auto-select "Continue and replan after". Log: `[auto] Plans exist — continuing with context capture, will replan after.`

**Otherwise:** Use AskUserQuestion:
- header: "Plans exist"
- question: "Phase [X] already has {plan_count} plan(s) created without user context. Your decisions here won't affect existing plans unless you replan."
- options:
  - "Continue and replan after" — Capture context, then run /gsd-plan-phase {X} ${GSD_WS} to replan
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
cat .planning/PROJECT.md 2>/dev/null || true
cat .planning/REQUIREMENTS.md 2>/dev/null || true
cat .planning/STATE.md 2>/dev/null || true
```

Extract from these:
- **PROJECT.md** — Vision, principles, non-negotiables, user preferences
- **REQUIREMENTS.md** — Acceptance criteria, constraints, must-haves vs nice-to-haves
- **STATE.md** — Current progress, any flags or session notes

**Step 2: Read all prior CONTEXT.md files**
```bash
# Find all CONTEXT.md files from phases before current
(find .planning/phases -name "*-CONTEXT.md" 2>/dev/null || true) | sort
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

<step name="cross_reference_todos">
Check if any pending todos are relevant to this phase's scope. Surfaces backlog items that might otherwise be missed.

**Load and match todos:**
```bash
TODO_MATCHES=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" todo match-phase "${PHASE_NUMBER}")
```

Parse JSON for: `todo_count`, `matches[]` (each with `file`, `title`, `area`, `score`, `reasons`).

**If `todo_count` is 0 or `matches` is empty:** Skip silently — no workflow slowdown.

**If matches found:**

Present matched todos to the user. Show each match with its title, area, and why it matched:

```
📋 Found {N} pending todo(s) that may be relevant to Phase {X}:

{For each match:}
- **{title}** (area: {area}, relevance: {score}) — matched on {reasons}
```

Use AskUserQuestion (multiSelect) asking which todos to fold into this phase's scope:

```
Which of these todos should be folded into Phase {X} scope?
(Select any that apply, or none to skip)
```

**For selected (folded) todos:**
- Store internally as `<folded_todos>` for inclusion in CONTEXT.md `<decisions>` section
- These become additional scope items that downstream agents (researcher, planner) will see

**For unselected (reviewed but not folded) todos:**
- Store internally as `<reviewed_todos>` for inclusion in CONTEXT.md `<deferred>` section
- This prevents future phases from re-surfacing the same todos as "missed"

**Auto mode (`--auto`):** Fold all todos with score >= 0.4 automatically. Log the selection.
</step>

<step name="scout_codebase">
Lightweight scan of existing code to inform gray area identification and discussion. Uses ~10% context — acceptable for an interactive session.

**Step 1: Check for existing codebase maps**
```bash
ls .planning/codebase/*.md 2>/dev/null || true
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
grep -rl "{term1}\|{term2}" src/ app/ --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" 2>/dev/null | head -10 || true

# Find existing components/hooks
ls src/components/ 2>/dev/null || true
ls src/hooks/ 2>/dev/null || true
ls src/lib/ src/utils/ 2>/dev/null || true
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

1b. **Initialize canonical refs accumulator** — Start building the `<canonical_refs>` list for CONTEXT.md. This accumulates throughout the entire discussion, not just this step.

   **Source 1 (now):** Copy `Canonical refs:` from ROADMAP.md for this phase. Expand each to a full relative path.
   **Source 2 (now):** Check REQUIREMENTS.md and PROJECT.md for any specs/ADRs referenced for this phase.
   **Source 3 (scout_codebase):** If existing code references docs (e.g., comments citing ADRs), add those.
   **Source 4 (discuss_areas):** When the user says "read X", "check Y", or references any doc/spec/ADR during discussion — add it immediately. These are often the MOST important refs because they represent docs the user specifically wants followed.

   This list is MANDATORY in CONTEXT.md. Every ref must have a full relative path so downstream agents can read it directly. If no external docs exist, note that explicitly.

2. **Check prior decisions** — Before generating gray areas, check if any were already decided:
   - Scan `<prior_decisions>` for relevant choices (e.g., "Ctrl+C only, no single-key shortcuts")
   - These are **pre-answered** — don't re-ask unless this phase has conflicting needs
   - Note applicable prior decisions for use in presentation

3. **Gray areas by category** — For each relevant category (UI, UX, Behavior, Empty States, Content), identify 1-2 specific ambiguities that would change implementation. **Annotate with code context where relevant** (e.g., "You already have a Card component" or "No existing pattern for this").

4. **Skip assessment** — If no meaningful gray areas exist (pure infrastructure, clear-cut implementation, or all already decided in prior phases), the phase may not need discussion.

**Advisor Mode Detection:**

Check if advisor mode should activate:

1. Check for USER-PROFILE.md:
   ```bash
   PROFILE_PATH="$HOME/.claude/get-shit-done/USER-PROFILE.md"
   ```
   ADVISOR_MODE = file exists at PROFILE_PATH → true, otherwise → false

2. If ADVISOR_MODE is true, resolve vendor_philosophy calibration tier:
   - Priority 1: Read config.json > preferences.vendor_philosophy (project-level override)
   - Priority 2: Read USER-PROFILE.md Vendor Choices/Philosophy rating (global)
   - Priority 3: Default to "standard" if neither has a value or value is UNSCORED

   Map to calibration tier:
   - conservative OR thorough-evaluator → full_maturity
   - opinionated → minimal_decisive
   - pragmatic-fast OR any other value OR empty → standard

3. Resolve model for advisor agents:
   ```bash
   ADVISOR_MODEL=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" resolve-model gsd-advisor-researcher --raw)
   ```

If ADVISOR_MODE is false, skip all advisor-specific steps — workflow proceeds with existing conversational flow unchanged.

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

**If `--auto`:** Auto-select ALL gray areas. Log: `[auto] Selected all gray areas: [list area names].` Skip the AskUserQuestion below and continue directly to discuss_areas with all areas selected.

**Otherwise, use AskUserQuestion (multiSelect: true):**
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

Continue to discuss_areas with selected areas (or advisor_research if ADVISOR_MODE is true).
</step>

<step name="advisor_research">
**Advisor Research** (only when ADVISOR_MODE is true)

After user selects gray areas in present_gray_areas, spawn parallel research agents.

1. Display brief status: "Researching {N} areas..."

2. For EACH user-selected gray area, spawn a Task() in parallel:

   Task(
     prompt="First, read @~/.claude/agents/gsd-advisor-researcher.md for your role and instructions.

     <gray_area>{area_name}: {area_description from gray area identification}</gray_area>
     <phase_context>{phase_goal and description from ROADMAP.md}</phase_context>
     <project_context>{project name and brief description from PROJECT.md}</project_context>
     <calibration_tier>{resolved calibration tier: full_maturity | standard | minimal_decisive}</calibration_tier>

     Research this gray area and return a structured comparison table with rationale.
     ${AGENT_SKILLS_ADVISOR}",
     subagent_type="general-purpose",
     model="{ADVISOR_MODEL}",
     description="Research: {area_name}"
   )

   All Task() calls spawn simultaneously — do NOT wait for one before starting the next.

3. After ALL agents return, SYNTHESIZE results before presenting:
   For each agent's return:
   a. Parse the markdown comparison table and rationale paragraph
   b. Verify all 5 columns present (Option | Pros | Cons | Complexity | Recommendation) — fill any missing columns rather than showing broken table
   c. Verify option count matches calibration tier:
      - full_maturity: 3-5 options acceptable
      - standard: 2-4 options acceptable
      - minimal_decisive: 1-2 options acceptable
      If agent returned too many, trim least viable. If too few, accept as-is.
   d. Rewrite rationale paragraph to weave in project context and ongoing discussion context that the agent did not have access to
   e. If agent returned only 1 option, convert from table format to direct recommendation: "Standard approach for {area}: {option}. {rationale}"

4. Store synthesized tables for use in discuss_areas.

**If ADVISOR_MODE is false:** Skip this step entirely — proceed directly from present_gray_areas to discuss_areas.
</step>

<step name="discuss_areas">
Discuss each selected area with the user. Flow depends on advisor mode.

**If ADVISOR_MODE is true:**

Table-first discussion flow — present research-backed comparison tables, then capture user picks.

**For each selected area:**

1. **Present the synthesized comparison table + rationale paragraph** (from advisor_research step)

2. **Use AskUserQuestion:**
   - header: "{area_name}"
   - question: "Which approach for {area_name}?"
   - options: Extract from the table's Option column (AskUserQuestion adds "Other" automatically)

3. **Record the user's selection:**
   - If user picks from table options → record as locked decision for that area
   - If user picks "Other" → receive their input, reflect it back for confirmation, record

   **Thinking partner (conditional):**
   If `features.thinking_partner` is enabled in config, check the user's answer for tradeoff signals
   (see `references/thinking-partner.md` for signal list). If tradeoff detected:

   ```
   I notice competing priorities here — {option_A} optimizes for {goal_A} while {option_B} optimizes for {goal_B}.

   Want me to think through the tradeoffs before we lock this in?
   [Yes, analyze] / [No, decision made]
   ```

   If yes: provide 3-5 bullet analysis (what each optimizes/sacrifices, alignment with PROJECT.md goals, recommendation). Then return to normal flow.
   If no or thinking_partner disabled: continue to next area.

4. **After recording pick, Claude decides whether follow-up questions are needed:**
   - If the pick has ambiguity that would affect downstream planning → ask 1-2 targeted follow-up questions using AskUserQuestion
   - If the pick is clear and self-contained → move to next area
   - Do NOT ask the standard 4 questions — the table already provided the context

5. **After all areas processed:**
   - header: "Done"
   - question: "That covers [list areas]. Ready to create context?"
   - options: "Create context" / "Revisit an area"

**Scope creep handling (advisor mode):**
If user mentions something outside the phase domain:
```
"[Feature] sounds like a new capability — that belongs in its own phase.
I'll note it as a deferred idea.

Back to [current area]: [return to current question]"
```

Track deferred ideas internally.

---

**If ADVISOR_MODE is false:**

For each selected area, conduct a focused discussion loop.

**Research-before-questions mode:** Check if `workflow.research_before_questions` is enabled in config (from init context or `.planning/config.json`). When enabled, before presenting questions for each area:
1. Do a brief web search for best practices related to the area topic
2. Summarize the top findings in 2-3 bullet points
3. Present the research alongside the question so the user can make a more informed decision

Example with research enabled:
```
Let's talk about [Authentication Strategy].

📊 Best practices research:
• OAuth 2.0 + PKCE is the current standard for SPAs (replaces implicit flow)
• Session tokens with httpOnly cookies preferred over localStorage for XSS protection
• Consider passkey/WebAuthn support — adoption is accelerating in 2025-2026

With that context: How should users authenticate?
```

When disabled (default), skip the research and present questions directly as before.

**Text mode support:** Parse optional `--text` from `$ARGUMENTS`.
- Accept `--text` flag OR read `workflow.text_mode` from config (from init context)
- When active, replace ALL `AskUserQuestion` calls with plain-text numbered lists
- User types a number to select, or types free text for "Other"
- This is required for Claude Code remote sessions (`/rc` mode) where TUI menus
  don't work through the Claude App

**Batch mode support:** Parse optional `--batch` from `$ARGUMENTS`.
- Accept `--batch`, `--batch=N`, or `--batch N`

**Analyze mode support:** Parse optional `--analyze` from `$ARGUMENTS`.
When `--analyze` is active, before presenting each question (or question group in batch mode), provide a brief **trade-off analysis** for the decision:
- 2-3 options with pros/cons based on codebase context and common patterns
- A recommended approach with reasoning
- Known pitfalls or constraints from prior phases

Example with `--analyze`:
```
**Trade-off analysis: Authentication strategy**

| Approach | Pros | Cons |
|----------|------|------|
| Session cookies | Simple, httpOnly prevents XSS | Requires CSRF protection, sticky sessions |
| JWT (stateless) | Scalable, no server state | Token size, revocation complexity |
| OAuth 2.0 + PKCE | Industry standard for SPAs | More setup, redirect flow UX |

💡 Recommended: OAuth 2.0 + PKCE — your app has social login in requirements (REQ-04) and this aligns with the existing NextAuth setup in `src/lib/auth.ts`.

How should users authenticate?
```

This gives the user context to make informed decisions without extra prompting. When `--analyze` is absent, present questions directly as before.
- Accept `--batch`, `--batch=N`, or `--batch N`
- Default to 4 questions per batch when no number is provided
- Clamp explicit sizes to 2-5 so a batch stays answerable
- If `--batch` is absent, keep the existing one-question-at-a-time flow

**Philosophy:** stay adaptive, but let the user choose the pacing.
- Default mode: 4 single-question turns, then check whether to continue
- `--batch` mode: 1 grouped turn with 2-5 numbered questions, then check whether to continue

Each answer (or answer set, in batch mode) should reveal the next question or next batch.

**Auto mode (`--auto`):** For each area, Claude selects the recommended option (first option, or the one explicitly marked "recommended") for every question without using AskUserQuestion. Log each auto-selected choice:
```
[auto] [Area] — Q: "[question text]" → Selected: "[chosen option]" (recommended default)
```
After all areas are auto-resolved, skip the "Explore more gray areas" prompt and proceed directly to write_context.

**CRITICAL — Auto-mode pass cap:**
In `--auto` mode, the discuss step MUST complete in a **single pass**. After writing CONTEXT.md once, you are DONE — proceed immediately to write_context and then auto_advance. Do NOT re-read your own CONTEXT.md to find "gaps", "undefined types", or "missing decisions" and run additional passes. This creates a self-feeding loop where each pass generates references that the next pass treats as gaps, consuming unbounded time and resources.

Check the pass cap from config:
```bash
MAX_PASSES=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" config-get workflow.max_discuss_passes 2>/dev/null || echo "3")
```

If you have already written and committed CONTEXT.md, the discuss step is complete. Move on.

**Interactive mode (no `--auto`):**

**For each area:**

1. **Announce the area:**
   ```
   Let's talk about [Area].
   ```

2. **Ask questions using the selected pacing:**

   **Default (no `--batch`): Ask 4 questions using AskUserQuestion**
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

   **Batch mode (`--batch`): Ask 2-5 numbered questions in one plain-text turn**
   - Group closely related questions for the current area into a single message
   - Keep each question concrete and answerable in one reply
   - When options are helpful, include short inline choices per question rather than a separate AskUserQuestion for every item
   - After the user replies, reflect back the captured decisions, note any unanswered items, and ask only the minimum follow-up needed before moving on
   - Preserve adaptiveness between batches: use the full set of answers to decide the next batch or whether the area is sufficiently clear

3. **After the current set of questions, check:**
   - header: "[Area]" (max 12 chars)
   - question: "More questions about [area], or move to next? (Remaining: [list other unvisited areas])"
   - options: "More questions" / "Next area"

   When building the question text, list the remaining unvisited areas so the user knows what's ahead. For example: "More questions about Layout, or move to next? (Remaining: Loading behavior, Content ordering)"

   If "More questions" → ask another 4 single questions, or another 2-5 question batch when `--batch` is active, then check again
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

**Canonical ref accumulation during discussion:**
When the user references a doc, spec, or ADR during any answer — e.g., "read adr-014", "check the MCP spec", "per browse-spec.md" — immediately:
1. Read the referenced doc (or confirm it exists)
2. Add it to the canonical refs accumulator with full relative path
3. Use what you learned from the doc to inform subsequent questions

These user-referenced docs are often MORE important than ROADMAP.md refs because they represent docs the user specifically wants downstream agents to follow. Never drop them.

**Question design:**
- Options should be concrete, not abstract ("Cards" not "Option A")
- Each answer should inform the next question or next batch
- If user picks "Other" to provide freeform input (e.g., "let me describe it", "something else", or an open-ended reply), ask your follow-up as plain text — NOT another AskUserQuestion. Wait for them to type at the normal prompt, then reflect their input back and confirm before resuming AskUserQuestion or the next numbered batch.

**Scope creep handling:**
If user mentions something outside the phase domain:
```
"[Feature] sounds like a new capability — that belongs in its own phase.
I'll note it as a deferred idea.

Back to [current area]: [return to current question]"
```

Track deferred ideas internally.

**Incremental checkpoint — save after each area completes:**

After each area is resolved (user says "Next area" or area auto-resolves in `--auto` mode), immediately write a checkpoint file with all decisions captured so far. This prevents data loss if the session is interrupted mid-discussion.

**Checkpoint file:** `${phase_dir}/${padded_phase}-DISCUSS-CHECKPOINT.json`

Write after each area:
```json
{
  "phase": "{PHASE_NUM}",
  "phase_name": "{phase_name}",
  "timestamp": "{ISO timestamp}",
  "areas_completed": ["Area 1", "Area 2"],
  "areas_remaining": ["Area 3", "Area 4"],
  "decisions": {
    "Area 1": [
      {"question": "...", "answer": "...", "options_presented": ["..."]},
      {"question": "...", "answer": "...", "options_presented": ["..."]}
    ],
    "Area 2": [
      {"question": "...", "answer": "...", "options_presented": ["..."]}
    ]
  },
  "deferred_ideas": ["..."],
  "canonical_refs": ["..."]
}
```

This is a structured checkpoint, not the final CONTEXT.md — the `write_context` step still produces the canonical output. But if the session dies, the next `/gsd-discuss-phase` invocation can detect this checkpoint and offer to resume from it instead of starting from scratch.

**On session resume:** In the `check_existing` step, also check for `*-DISCUSS-CHECKPOINT.json`. If found and no CONTEXT.md exists:
- Display: "Found interrupted discussion checkpoint ({N} areas completed). Resume from checkpoint?"
- Options: "Resume" / "Start fresh"
- On "Resume": Load the checkpoint, skip completed areas, continue from where it left off
- On "Start fresh": Delete the checkpoint, proceed as normal

**After write_context completes successfully:** Delete the checkpoint file — the canonical CONTEXT.md now has all decisions.

**Track discussion log data internally:**
For each question asked, accumulate:
- Area name
- All options presented (label + description)
- Which option the user selected (or their free-text response)
- Any follow-up notes or clarifications the user provided
This data is used to generate DISCUSSION-LOG.md in the `write_context` step.
</step>

<step name="write_context">
Create CONTEXT.md capturing decisions made.

**Also generate DISCUSSION-LOG.md** — a full audit trail of the discuss-phase Q&A.
This file is for human reference only (software audits, compliance reviews). It is NOT
consumed by downstream agents (researcher, planner, executor).

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
- **D-01:** [Decision or preference captured]
- **D-02:** [Another decision if applicable]

### [Category 2 that was discussed]
- **D-03:** [Decision or preference captured]

### Claude's Discretion
[Areas where user said "you decide" — note that Claude has flexibility here]

### Folded Todos
[If any todos were folded into scope from the cross_reference_todos step, list them here.
Each entry should include the todo title, original problem, and how it fits this phase's scope.
If no todos were folded: omit this subsection entirely.]

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

[MANDATORY section. Write the FULL accumulated canonical refs list here.
Sources: ROADMAP.md refs + REQUIREMENTS.md refs + user-referenced docs during
discussion + any docs discovered during codebase scout. Group by topic area.
Every entry needs a full relative path — not just a name.]

### [Topic area 1]
- `path/to/adr-or-spec.md` — [What it decides/defines that's relevant]
- `path/to/doc.md` §N — [Specific section reference]

### [Topic area 2]
- `path/to/feature-doc.md` — [What this doc defines]

[If no external specs: "No external specs — requirements fully captured in decisions above"]

</canonical_refs>

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

### Reviewed Todos (not folded)
[If any todos were reviewed in cross_reference_todos but not folded into scope,
list them here so future phases know they were considered.
Each entry: todo title + reason it was deferred (out of scope, belongs in Phase Y, etc.)
If no reviewed-but-deferred todos: omit this subsection entirely.]

[If none: "None — discussion stayed within phase scope"]

</deferred>

---

*Phase: XX-name*
*Context gathered: [date]*
```

Write file.
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

`/clear` then:

`/gsd-plan-phase ${PHASE} ${GSD_WS}`

---

**Also available:**
- `/gsd-discuss-phase ${PHASE} --chain ${GSD_WS}` — re-run with auto plan+execute after
- `/gsd-plan-phase ${PHASE} --skip-research ${GSD_WS}` — plan without research
- `/gsd-ui-phase ${PHASE} ${GSD_WS}` — generate UI design contract before planning (if phase has frontend work)
- Review/edit CONTEXT.md before continuing

---
```
</step>

<step name="git_commit">
**Write DISCUSSION-LOG.md before committing:**

**File location:** `${phase_dir}/${padded_phase}-DISCUSSION-LOG.md`

```markdown
# Phase [X]: [Name] - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** [ISO date]
**Phase:** [phase number]-[phase name]
**Areas discussed:** [comma-separated list]

---

[For each gray area discussed:]

## [Area Name]

| Option | Description | Selected |
|--------|-------------|----------|
| [Option 1] | [Description from AskUserQuestion] | |
| [Option 2] | [Description] | ✓ |
| [Option 3] | [Description] | |

**User's choice:** [Selected option or free-text response]
**Notes:** [Any clarifications, follow-up context, or rationale the user provided]

---

[Repeat for each area]

## Claude's Discretion

[List areas where user said "you decide" or deferred to Claude]

## Deferred Ideas

[Ideas mentioned during discussion that were noted for future phases]
```

Write file.

**Clean up checkpoint file** — CONTEXT.md is now the canonical record:

```bash
rm -f "${phase_dir}/${padded_phase}-DISCUSS-CHECKPOINT.json"
```

Commit phase context and discussion log:

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "docs(${padded_phase}): capture phase context" --files "${phase_dir}/${padded_phase}-CONTEXT.md" "${phase_dir}/${padded_phase}-DISCUSSION-LOG.md"
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

1. Parse `--auto` and `--chain` flags from $ARGUMENTS
2. **Sync chain flag with intent** — if user invoked manually (no `--auto` and no `--chain`), clear the ephemeral chain flag from any previous interrupted `--auto` chain. This does NOT touch `workflow.auto_advance` (the user's persistent settings preference):
   ```bash
   if [[ ! "$ARGUMENTS" =~ --auto ]] && [[ ! "$ARGUMENTS" =~ --chain ]]; then
     node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" config-set workflow._auto_chain_active false 2>/dev/null
   fi
   ```
3. Read both the chain flag and user preference:
   ```bash
   AUTO_CHAIN=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" config-get workflow._auto_chain_active 2>/dev/null || echo "false")
   AUTO_CFG=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" config-get workflow.auto_advance 2>/dev/null || echo "false")
   ```

**If `--auto` or `--chain` flag present AND `AUTO_CHAIN` is not true:** Persist chain flag to config (handles direct usage without new-project):
```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" config-set workflow._auto_chain_active true
```

**If `--auto` flag present OR `--chain` flag present OR `AUTO_CHAIN` is true OR `AUTO_CFG` is true:**

Display banner:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► AUTO-ADVANCING TO PLAN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Context captured. Launching plan-phase...
```

Launch plan-phase using the Skill tool to avoid nested Task sessions (which cause runtime freezes due to deep agent nesting — see #686):
```
Skill(skill="gsd-plan-phase", args="${PHASE} --auto ${GSD_WS}")
```

This keeps the auto-advance chain flat — discuss, plan, and execute all run at the same nesting level rather than spawning increasingly deep Task agents.

**Handle plan-phase return:**
- **PHASE COMPLETE** → Full chain succeeded. Display:
  ```
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   GSD ► PHASE ${PHASE} COMPLETE
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Auto-advance pipeline finished: discuss → plan → execute

  /clear then:

  Next: /gsd-discuss-phase ${NEXT_PHASE} ${WAS_CHAIN ? "--chain" : "--auto"} ${GSD_WS}
  ```
- **PLANNING COMPLETE** → Planning done, execution didn't complete:
  ```
  Auto-advance partial: Planning complete, execution did not finish.
  Continue: /gsd-execute-phase ${PHASE} ${GSD_WS}
  ```
- **PLANNING INCONCLUSIVE / CHECKPOINT** → Stop chain:
  ```
  Auto-advance stopped: Planning needs input.
  Continue: /gsd-plan-phase ${PHASE} ${GSD_WS}
  ```
- **GAPS FOUND** → Stop chain:
  ```
  Auto-advance stopped: Gaps found during execution.
  Continue: /gsd-plan-phase ${PHASE} --gaps ${GSD_WS}
  ```

**If none of `--auto`, `--chain`, nor config enabled:**
Route to `confirm_creation` step (existing behavior — show manual next steps).
</step>

</process>

<power_user_mode>
When `--power` flag is present in ARGUMENTS, skip interactive questioning and execute the power user workflow.

The power user mode generates ALL questions upfront into machine-readable and human-friendly files, then waits for the user to answer at their own pace before processing all answers in a single pass.

**Full step-by-step instructions:** @~/.claude/get-shit-done/workflows/discuss-phase-power.md

**Summary of flow:**
1. Run the same phase analysis (gray area identification) as standard mode
2. Write all questions to `{phase_dir}/{padded_phase}-QUESTIONS.json` and `{phase_dir}/{padded_phase}-QUESTIONS.html`
3. Notify user with file paths and wait for a "refresh" or "finalize" command
4. On "refresh": read the JSON, process answered questions, update stats and HTML
5. On "finalize": read all answers from JSON, generate CONTEXT.md in the standard format
</power_user_mode>

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
- CONTEXT.md includes canonical_refs section with full file paths to every spec/ADR/doc downstream agents need (MANDATORY — never omit)
- CONTEXT.md includes code_context section with reusable assets and patterns
- Deferred ideas preserved for future phases
- STATE.md updated with session info
- User knows next steps
- Checkpoint file written after each area completes (incremental save)
- Interrupted sessions can be resumed from checkpoint (no re-answering completed areas)
- Checkpoint file cleaned up after successful CONTEXT.md write
- `--chain` triggers interactive discuss followed by auto plan+execute (no auto-answering)
- `--chain` and `--auto` both persist chain flag and auto-advance to plan-phase
</success_criteria>
