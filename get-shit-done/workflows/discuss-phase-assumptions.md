<purpose>
Extract implementation decisions that downstream agents need — using codebase-first analysis
and assumption surfacing instead of interview-style questioning.

You are a thinking partner, not an interviewer. Analyze the codebase deeply, surface what you
believe based on evidence, and ask the user only to correct what's wrong.
</purpose>

<available_agent_types>
Valid GSD subagent types (use exact names — do not fall back to 'general-purpose'):
- gsd-assumptions-analyzer — Analyzes codebase to surface implementation assumptions
</available_agent_types>

<downstream_awareness>
**CONTEXT.md feeds into:**

1. **gsd-phase-researcher** — Reads CONTEXT.md to know WHAT to research
2. **gsd-planner** — Reads CONTEXT.md to know WHAT decisions are locked

**Your job:** Capture decisions clearly enough that downstream agents can act on them
without asking the user again. Output is identical to discuss mode — same CONTEXT.md format.
</downstream_awareness>

<philosophy>
**Assumptions mode philosophy:**

The user is a visionary, not a codebase archaeologist. They need enough context to evaluate
whether your assumptions match their intent — not to answer questions you could figure out
by reading the code.

- Read the codebase FIRST, form opinions SECOND, ask ONLY about what's genuinely unclear
- Every assumption must cite evidence (file paths, patterns found)
- Every assumption must state consequences if wrong
- Minimize user interactions: ~2-4 corrections vs ~15-20 questions
</philosophy>

<scope_guardrail>
**CRITICAL: No scope creep.**

The phase boundary comes from ROADMAP.md and is FIXED. Discussion clarifies HOW to implement
what's scoped, never WHETHER to add new capabilities.

When user suggests scope creep:
"[Feature X] would be a new capability — that's its own phase.
Want me to note it for the roadmap backlog? For now, let's focus on [phase domain]."

Capture the idea in "Deferred Ideas". Don't lose it, don't act on it.
</scope_guardrail>

<answer_validation>
**IMPORTANT: Answer validation** — After every AskUserQuestion call, check if the response
is empty or whitespace-only. If so:
1. Retry the question once with the same parameters
2. If still empty, present the options as a plain-text numbered list

**Text mode (`workflow.text_mode: true` in config or `--text` flag):**
When text mode is active, do not use AskUserQuestion at all. Present every question as a
plain-text numbered list and ask the user to type their choice number.
</answer_validation>

<process>

<step name="initialize" priority="first">
Phase number from argument (required).

```bash
INIT=$(gsd-sdk query init.phase-op "${PHASE}")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
AGENT_SKILLS_ANALYZER=$(gsd-sdk query agent-skills gsd-assumptions-analyzer 2>/dev/null)
```

Parse JSON for: `commit_docs`, `phase_found`, `phase_dir`, `phase_number`, `phase_name`,
`phase_slug`, `padded_phase`, `has_research`, `has_context`, `has_plans`, `has_verification`,
`plan_count`, `roadmap_exists`, `planning_exists`.

**If `phase_found` is false:**
```
Phase [X] not found in roadmap.

Use /gsd:progress to see available phases.
```
Exit workflow.

**If `phase_found` is true:** Continue to check_existing.

**Auto mode** — If `--auto` is present in ARGUMENTS:
- In `check_existing`: auto-select "Update it" (if context exists) or continue without prompting
- In `present_assumptions`: skip confirmation gate, proceed directly to write CONTEXT.md
- In `correct_assumptions`: auto-select recommended option for each correction
- Log each auto-selected choice inline
- After completion, auto-advance to plan-phase
</step>

<step name="check_existing">
Check if CONTEXT.md already exists using `has_context` from init.

```bash
ls ${phase_dir}/*-CONTEXT.md 2>/dev/null || true
```

**If exists:**

**If `--auto`:** Auto-select "Update it". Log: `[auto] Context exists — updating with assumption-based analysis.`

**Otherwise:** Use AskUserQuestion:
- header: "Context"
- question: "Phase [X] already has context. What do you want to do?"
- options:
  - "Update it" — Re-analyze codebase and refresh assumptions
  - "View it" — Show me what's there
  - "Skip" — Use existing context as-is

If "Update": Load existing, continue to load_prior_context
If "View": Display CONTEXT.md, then offer update/skip
If "Skip": Exit workflow

**If doesn't exist:**

Check `has_plans` and `plan_count` from init. **If `has_plans` is true:**

**If `--auto`:** Auto-select "Continue and replan after". Log: `[auto] Plans exist — continuing with assumption analysis, will replan after.`

**Otherwise:** Use AskUserQuestion:
- header: "Plans exist"
- question: "Phase [X] already has {plan_count} plan(s) created without user context. Your decisions here won't affect existing plans unless you replan."
- options:
  - "Continue and replan after"
  - "View existing plans"
  - "Cancel"

If "Continue and replan after": Continue to load_prior_context.
If "View existing plans": Display plan files, then offer "Continue" / "Cancel".
If "Cancel": Exit workflow.

**If `has_plans` is false:** Continue to load_prior_context.
</step>

<step name="load_prior_context">
Read project-level and prior phase context to avoid re-asking decided questions.

**Step 1: Read project-level files**
```bash
cat .planning/PROJECT.md 2>/dev/null || true
cat .planning/REQUIREMENTS.md 2>/dev/null || true
cat .planning/STATE.md 2>/dev/null || true
```

Extract from these:
- **PROJECT.md** — Vision, principles, non-negotiables, user preferences
- **REQUIREMENTS.md** — Acceptance criteria, constraints
- **STATE.md** — Current progress, any flags

**Step 2: Read all prior CONTEXT.md files**
```bash
(find .planning/phases -name "*-CONTEXT.md" 2>/dev/null || true) | sort
```

For each CONTEXT.md where phase number < current phase:
- Read the `<decisions>` section — these are locked preferences
- Read `<specifics>` — particular references or "I want it like X" moments
- Note patterns (e.g., "user consistently prefers minimal UI")

**Step 3: Build internal `<prior_decisions>` context**

Structure the extracted information for use in assumption generation.

**If no prior context exists:** Continue without — expected for early phases.
</step>

<step name="cross_reference_todos">
Check if any pending todos are relevant to this phase's scope.

```bash
TODO_MATCHES=$(gsd-sdk query todo.match-phase "${PHASE_NUMBER}")
```

Parse JSON for: `todo_count`, `matches[]`.

**If `todo_count` is 0:** Skip silently.

**If matches found:** Present matched todos, use AskUserQuestion (multiSelect) to fold relevant ones into scope.

**For selected (folded) todos:** Store as `<folded_todos>` for CONTEXT.md `<decisions>` section.
**For unselected:** Store as `<reviewed_todos>` for CONTEXT.md `<deferred>` section.

**Auto mode (`--auto`):** Fold all todos with score >= 0.4 automatically. Log the selection.
</step>

<step name="load_methodology">
Read the project-level methodology file if it exists. This must happen before assumption analysis
so that active lenses shape how assumptions are generated and evaluated.

```bash
cat .planning/METHODOLOGY.md 2>/dev/null || true
```

**If METHODOLOGY.md exists:**
- Parse each named lens: its diagnoses, recommendations, and triggering conditions
- Store as internal `<active_lenses>` for use in deep_codebase_analysis and present_assumptions
- When spawning the gsd-assumptions-analyzer, pass the lens list so it can flag which lenses apply
- When presenting assumptions, append a "Methodology" section showing which lenses were applied
  and what they flagged (if anything)

**If METHODOLOGY.md does not exist:** Skip silently. This artifact is optional.
</step>

<step name="scout_codebase">
Lightweight scan of existing code to inform assumption generation.

**Step 1: Check for existing codebase maps**
```bash
ls .planning/codebase/*.md 2>/dev/null || true
```

**If codebase maps exist:** Read relevant ones (CONVENTIONS.md, STRUCTURE.md, STACK.md). Extract reusable components, patterns, integration points. Skip to Step 3.

**Step 2: If no codebase maps, do targeted grep**

Extract key terms from phase goal, search for related files.

```bash
grep -rl "{term1}\|{term2}" src/ app/ --include="*.ts" --include="*.tsx" 2>/dev/null | head -10
```

Read the 3-5 most relevant files.

**Step 3: Build internal `<codebase_context>`**

Identify reusable assets, established patterns, integration points, and creative options. Store internally for use in deep_codebase_analysis.
</step>

<step name="deep_codebase_analysis">
Spawn a `gsd-assumptions-analyzer` agent to deeply analyze the codebase for this phase. This
keeps raw file contents out of the main context window, protecting token budget.

**Resolve calibration tier (if USER-PROFILE.md exists):**

```bash
PROFILE_PATH="$HOME/.claude/get-shit-done/USER-PROFILE.md"
```

If file exists at PROFILE_PATH:
- Priority 1: Read config.json > preferences.vendor_philosophy (project-level override)
- Priority 2: Read USER-PROFILE.md Vendor Choices/Philosophy rating (global)
- Priority 3: Default to "standard"

Map to calibration tier:
- conservative OR thorough-evaluator → full_maturity (more alternatives, detailed evidence)
- opinionated → minimal_decisive (fewer alternatives, decisive recommendations)
- pragmatic-fast OR any other value → standard

If no USER-PROFILE.md: calibration_tier = "standard"

**Spawn Explore subagent:**

```
Task(subagent_type="gsd-assumptions-analyzer", prompt="""
Analyze the codebase for Phase {PHASE}: {phase_name}.

Phase goal: {roadmap_description}
Prior decisions: {prior_decisions_summary}
Codebase scout hints: {codebase_context_summary}
Calibration: {calibration_tier}

Your job:
1. Read ROADMAP.md phase {PHASE} description
2. Read any prior CONTEXT.md files from earlier phases
3. Glob/Grep for files related to: {phase_relevant_terms}
4. Read 5-15 most relevant source files
5. Return structured assumptions

## Output Format

Return EXACTLY this structure:

## Assumptions

### [Area Name] (e.g., "Technical Approach")
- **Assumption:** [Decision statement]
  - **Why this way:** [Evidence from codebase — cite file paths]
  - **If wrong:** [Concrete consequence of this being wrong]
  - **Confidence:** Confident | Likely | Unclear

(3-5 areas, calibrated by tier:
- full_maturity: 3-5 areas, 2-3 alternatives per Likely/Unclear item
- standard: 3-4 areas, 2 alternatives per Likely/Unclear item
- minimal_decisive: 2-3 areas, decisive single recommendation per item)

## Needs External Research
[Topics where codebase alone is insufficient — library version compatibility,
ecosystem best practices, etc. Leave empty if codebase provides enough evidence.]

${AGENT_SKILLS_ANALYZER}
""")
```

Parse the subagent's response. Extract:
- `assumptions[]` — each with area, statement, evidence, consequence, confidence
- `needs_research[]` — topics requiring external research (may be empty)

**Initialize canonical refs accumulator:**
- Source 1: Copy `Canonical refs:` from ROADMAP.md for this phase, expand to full paths
- Source 2: Check REQUIREMENTS.md and PROJECT.md for specs/ADRs referenced
- Source 3: Add any docs referenced in codebase scout results
</step>

<step name="external_research">
**Skip if:** `needs_research` from deep_codebase_analysis is empty.

If research topics were flagged, spawn a general-purpose research agent:

```
Task(subagent_type="general-purpose", prompt="""
Research the following topics for Phase {PHASE}: {phase_name}.

Topics needing research:
{needs_research_content}

For each topic, return:
- **Finding:** [What you learned]
- **Source:** [URL or library docs reference]
- **Confidence impact:** [Which assumption this resolves and to what confidence level]

Use Context7 (resolve-library-id then query-docs) for library-specific questions.
Use WebSearch for ecosystem/best-practice questions.
""")
```

Merge findings back into assumptions:
- Update confidence levels where research resolves ambiguity
- Add source attribution to affected assumptions
- Store research findings for DISCUSSION-LOG.md

**If no gaps flagged:** Skip entirely. Most phases will skip this step.
</step>

<step name="present_assumptions">
Display all assumptions grouped by area with confidence badges.

**Format for display:**

```
## Phase {PHASE}: {phase_name} — Assumptions

Based on codebase analysis, here's what I'd go with:

### {Area Name}
{Confidence badge} **{Assumption statement}**
↳ Evidence: {file paths cited}
↳ If wrong: {consequence}

### {Area Name 2}
...

[If external research was done:]
### External Research Applied
- {Topic}: {Finding} (Source: {URL})
```

**If `--auto`:**
- If all assumptions are Confident or Likely: log assumptions, skip to write_context.
  Log: `[auto] All assumptions Confident/Likely — proceeding to context capture.`
- If any assumptions are Unclear: log a warning, auto-select recommended alternative for
  each Unclear item. Log: `[auto] {N} Unclear assumptions auto-resolved with recommended defaults.`
  Proceed to write_context.

**Otherwise:** Use AskUserQuestion:
- header: "Assumptions"
- question: "These all look right?"
- options:
  - "Yes, proceed" — Write CONTEXT.md with these assumptions as decisions
  - "Let me correct some" — Select which assumptions to change

**If "Yes, proceed":** Skip to write_context.
**If "Let me correct some":** Continue to correct_assumptions.
</step>

<step name="correct_assumptions">
The assumptions are already displayed above from present_assumptions.

Present a multiSelect where each option's label is the assumption statement and description
is the "If wrong" consequence:

Use AskUserQuestion (multiSelect):
- header: "Corrections"
- question: "Which assumptions need correcting?"
- options: [one per assumption, label = assumption statement, description = "If wrong: {consequence}"]

For each selected correction, ask ONE focused question:

Use AskUserQuestion:
- header: "{Area Name}"
- question: "What should we do instead for: {assumption statement}?"
- options: [2-3 concrete alternatives describing user-visible outcomes, recommended option first]

Record each correction:
- Original assumption
- User's chosen alternative
- Reason (if provided via "Other" free text)

After all corrections processed, continue to write_context with updated assumptions.

**Auto mode:** Should not reach this step (--auto skips from present_assumptions).
</step>

<step name="write_context">
Create phase directory if needed. Write CONTEXT.md using the standard 6-section format.

**File:** `${phase_dir}/${padded_phase}-CONTEXT.md`

Map assumptions to CONTEXT.md sections:
- Assumptions → `<decisions>` (each assumption becomes a locked decision: D-01, D-02, etc.)
- Corrections → override the original assumption in `<decisions>`
- Areas where all assumptions were Confident → marked as locked decisions
- Areas with corrections → include user's chosen alternative as the decision
- Folded todos → included in `<decisions>` under "### Folded Todos"

```markdown
# Phase {PHASE}: {phase_name} - Context

**Gathered:** {date} (assumptions mode)
**Status:** Ready for planning

<domain>
## Phase Boundary

{Domain boundary from ROADMAP.md — clear statement of scope anchor}
</domain>

<decisions>
## Implementation Decisions

### {Area Name 1}
- **D-01:** {Decision — from assumption or correction}
- **D-02:** {Decision}

### {Area Name 2}
- **D-03:** {Decision}

### Claude's Discretion
{Any assumptions where the user confirmed "you decide" or left as-is with Likely confidence}

### Folded Todos
{If any todos were folded into scope}
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

{Accumulated canonical refs from analyze step — full relative paths}

[If no external specs: "No external specs — requirements fully captured in decisions above"]
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
{From codebase scout + Explore subagent findings}

### Established Patterns
{Patterns that constrain/enable this phase}

### Integration Points
{Where new code connects to existing system}
</code_context>

<specifics>
## Specific Ideas

{Any particular references from corrections or user input}

[If none: "No specific requirements — open to standard approaches"]
</specifics>

<deferred>
## Deferred Ideas

{Ideas mentioned during corrections that are out of scope}

### Reviewed Todos (not folded)
{Todos reviewed but not folded — with reason}

[If none: "None — analysis stayed within phase scope"]
</deferred>
```

Write file.
</step>

<step name="write_discussion_log">
Write audit trail of assumptions and corrections.

**File:** `${phase_dir}/${padded_phase}-DISCUSSION-LOG.md`

```markdown
# Phase {PHASE}: {phase_name} - Discussion Log (Assumptions Mode)

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in CONTEXT.md — this log preserves the analysis.

**Date:** {ISO date}
**Phase:** {padded_phase}-{phase_name}
**Mode:** assumptions
**Areas analyzed:** {comma-separated area names}

## Assumptions Presented

### {Area Name}
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| {Statement} | {Confident/Likely/Unclear} | {file paths} |

{Repeat for each area}

## Corrections Made

{If corrections were made:}

### {Area Name}
- **Original assumption:** {what Claude assumed}
- **User correction:** {what the user chose instead}
- **Reason:** {user's rationale, if provided}

{If no corrections: "No corrections — all assumptions confirmed."}

## Auto-Resolved

{If --auto and Unclear items existed:}
- {Assumption}: auto-selected {recommended option}

{If not applicable: omit this section}

## External Research

{If research was performed:}
- {Topic}: {Finding} (Source: {URL})

{If no research: omit this section}
```

Write file.
</step>

<step name="git_commit">
Commit phase context and discussion log:

```bash
gsd-sdk query commit "docs(${padded_phase}): capture phase context (assumptions mode)" "${phase_dir}/${padded_phase}-CONTEXT.md" "${phase_dir}/${padded_phase}-DISCUSSION-LOG.md"
```

Confirm: "Committed: docs(${padded_phase}): capture phase context (assumptions mode)"
</step>

<step name="update_state">
Update STATE.md with session info:

```bash
gsd-sdk query state.record-session \
  --stopped-at "Phase ${PHASE} context gathered (assumptions mode)" \
  --resume-file "${phase_dir}/${padded_phase}-CONTEXT.md"
```

Commit STATE.md:

```bash
gsd-sdk query commit "docs(state): record phase ${PHASE} context session" .planning/STATE.md
```
</step>

<step name="confirm_creation">
Present summary and next steps:

```
Created: .planning/phases/${PADDED_PHASE}-${SLUG}/${PADDED_PHASE}-CONTEXT.md

## Decisions Captured (Assumptions Mode)

### {Area Name}
- {Key decision} (from assumption / corrected)

{Repeat per area}

[If corrections were made:]
## Corrections Applied
- {Area}: {original} → {corrected}

[If deferred ideas exist:]
## Noted for Later
- {Deferred idea} — future phase

---

## ▶ Next Up — [${PROJECT_CODE}] ${PROJECT_TITLE}

**Phase ${PHASE}: {phase_name}** — {Goal from ROADMAP.md}

`/clear` then:

`/gsd:plan-phase ${PHASE}`

---

**Also available:**
- `/gsd:plan-phase ${PHASE} --skip-research` — plan without research
- `/gsd:ui-phase ${PHASE}` — generate UI design contract (if frontend work)
- Review/edit CONTEXT.md before continuing

---
```
</step>

<step name="auto_advance">
Check for auto-advance trigger:

1. Parse `--auto` flag from $ARGUMENTS
2. Sync chain flag:
   ```bash
   if [[ ! "$ARGUMENTS" =~ --auto ]]; then
     gsd-sdk query config-set workflow._auto_chain_active false 2>/dev/null
   fi
   ```
3. Read consolidated auto-mode (`active` = chain flag OR user preference):
   ```bash
   AUTO_MODE=$(gsd-sdk query check auto-mode --pick active 2>/dev/null || echo "false")
   ```

**If `--auto` flag present AND `AUTO_MODE` is not true:**
```bash
gsd-sdk query config-set workflow._auto_chain_active true
```

**If `--auto` flag present OR `AUTO_MODE` is true:**

Display banner:
```text
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► AUTO-ADVANCING TO PLAN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Context captured (assumptions mode). Launching plan-phase...
```

Launch: `Skill(skill="gsd-plan-phase", args="${PHASE} --auto")`

Handle return: PHASE COMPLETE / PLANNING COMPLETE / INCONCLUSIVE / GAPS FOUND
(identical handling to discuss-phase.md auto_advance step)

**If neither `--auto` nor config enabled:**
Route to confirm_creation step.
</step>

</process>

<success_criteria>
- Phase validated against roadmap
- Prior context loaded (no re-asking decided questions)
- Codebase deeply analyzed via Explore subagent (5-15 files read)
- Assumptions surfaced with evidence and confidence levels
- User confirmed or corrected assumptions (~2-4 interactions max)
- Scope creep redirected to deferred ideas
- CONTEXT.md captures actual decisions (identical format to discuss mode)
- CONTEXT.md includes canonical_refs with full file paths (MANDATORY)
- CONTEXT.md includes code_context from codebase analysis
- DISCUSSION-LOG.md records assumptions and corrections as audit trail
- STATE.md updated with session info
- User knows next steps
</success_criteria>
