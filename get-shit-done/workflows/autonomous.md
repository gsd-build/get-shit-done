<purpose>

Drive all remaining milestone phases autonomously. For each incomplete phase: discuss → plan → execute using Skill() flat invocations. Pauses only for explicit user decisions (grey area acceptance, blockers, validation requests). Re-reads ROADMAP.md after each phase to catch dynamically inserted phases.

</purpose>

<required_reading>

Read all files referenced by the invoking prompt's execution_context before starting.

</required_reading>

<process>

<step name="initialize" priority="first">

## 1. Initialize

Parse `$ARGUMENTS` for `--from N` flag:

```bash
FROM_PHASE=""
if echo "$ARGUMENTS" | grep -qE '\-\-from\s+[0-9]'; then
  FROM_PHASE=$(echo "$ARGUMENTS" | grep -oE '\-\-from\s+[0-9]+\.?[0-9]*' | awk '{print $2}')
fi
```

Bootstrap via milestone-level init:

```bash
INIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init milestone-op)
```

Parse JSON for: `milestone_version`, `milestone_name`, `phase_count`, `completed_phases`, `roadmap_exists`, `state_exists`, `commit_docs`.

**If `roadmap_exists` is false:** Error — "No ROADMAP.md found. Run `/gsd:new-milestone` first."
**If `state_exists` is false:** Error — "No STATE.md found. Run `/gsd:new-milestone` first."

Display startup banner:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► AUTONOMOUS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 Milestone: {milestone_version} — {milestone_name}
 Phases: {phase_count} total, {completed_phases} complete
```

If `FROM_PHASE` is set, display: `Starting from phase ${FROM_PHASE}`

</step>

<step name="discover_phases">

## 2. Discover Phases

Run phase discovery:

```bash
ROADMAP=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" roadmap analyze)
```

Parse the JSON `phases` array.

**Filter to incomplete phases:** Keep only phases where `disk_status !== "complete"` OR `roadmap_complete === false`.

**Apply `--from N` filter:** If `FROM_PHASE` was provided, additionally filter out phases where `number < FROM_PHASE` (use numeric comparison — handles decimal phases like "5.1").

**Sort by `number`** in numeric ascending order.

**If no incomplete phases remain:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► AUTONOMOUS ▸ COMPLETE 🎉
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 All phases complete! Nothing left to do.
```

Exit cleanly.

**Display phase plan:**

```
## Phase Plan

| # | Phase | Status |
|---|-------|--------|
| 5 | Skill Scaffolding & Phase Discovery | In Progress |
| 6 | Smart Discuss | Not Started |
| 7 | Auto-Chain Refinements | Not Started |
| 8 | Lifecycle Orchestration | Not Started |
```

**Fetch details for each phase:**

```bash
DETAIL=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" roadmap get-phase ${PHASE_NUM})
```

Extract `phase_name`, `goal`, `success_criteria` from each. Store for use in execute_phase and transition messages.

</step>

<step name="execute_phase">

## 3. Execute Phase

For the current phase, display the progress banner:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► AUTONOMOUS ▸ Phase {N}/{T}: {Name} [████░░░░] {P}%
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Where N = current phase position (1-based among incomplete), T = total phases, P = percentage complete. Use █ for filled and ░ for empty segments in the progress bar (8 characters wide).

**3a. Smart Discuss**

Check if CONTEXT.md already exists for this phase:

```bash
PHASE_STATE=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init phase-op ${PHASE_NUM})
```

Parse `has_context` from JSON.

**If has_context is true:** Skip discuss — context already gathered. Display:

```
Phase ${PHASE_NUM}: Context exists — skipping discuss.
```

Proceed to 3b.

**If has_context is false:** Execute the smart_discuss step for this phase.

After smart_discuss completes, verify context was written:

```bash
PHASE_STATE=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init phase-op ${PHASE_NUM})
```

Check `has_context`. If false → go to handle_blocker: "Smart discuss for phase ${PHASE_NUM} did not produce CONTEXT.md."

**3b. Plan**

```
Skill(skill="gsd:plan-phase", args="${PHASE_NUM}")
```

Verify plan produced output — re-run `init phase-op` and check `has_plans`. If false → go to handle_blocker: "Plan phase ${PHASE_NUM} did not produce any plans."

**3c. Execute**

```
Skill(skill="gsd:execute-phase", args="${PHASE_NUM}")
```

**3d. Transition**

Display transition message:

```
Phase {N} ✅ {Name}
→ Phase {N+1}: {Next Name} — {1-line goal}
```

Proceed to iterate step.

</step>

<step name="smart_discuss">

## Smart Discuss

Run smart discuss for the current phase. Proposes grey area answers in batch tables — the user accepts or overrides per area. Produces identical CONTEXT.md output to regular discuss-phase.

**Inputs:** `PHASE_NUM` from execute_phase. Run init to get phase paths:

```bash
PHASE_STATE=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init phase-op ${PHASE_NUM})
```

Parse from JSON: `phase_dir`, `phase_slug`, `padded_phase`, `phase_name`.

---

### Sub-step 1: Load prior context

Read project-level and prior phase context to avoid re-asking decided questions.

**Read project files:**

```bash
cat .planning/PROJECT.md 2>/dev/null
cat .planning/REQUIREMENTS.md 2>/dev/null
cat .planning/STATE.md 2>/dev/null
```

Extract from these:
- **PROJECT.md** — Vision, principles, non-negotiables, user preferences
- **REQUIREMENTS.md** — Acceptance criteria, constraints, must-haves vs nice-to-haves
- **STATE.md** — Current progress, decisions logged so far

**Read all prior CONTEXT.md files:**

```bash
find .planning/phases -name "*-CONTEXT.md" 2>/dev/null | sort
```

For each CONTEXT.md where phase number < current phase:
- Read the `<decisions>` section — these are locked preferences
- Read `<specifics>` — particular references or "I want it like X" moments
- Note patterns (e.g., "user consistently prefers minimal UI", "user rejected verbose output")

**Build internal prior_decisions context** (do not write to file):

```
<prior_decisions>
## Project-Level
- [Key principle or constraint from PROJECT.md]
- [Requirement affecting this phase from REQUIREMENTS.md]

## From Prior Phases
### Phase N: [Name]
- [Decision relevant to current phase]
- [Preference that establishes a pattern]
</prior_decisions>
```

If no prior context exists, continue without — expected for early phases.

---

### Sub-step 2: Scout Codebase

Lightweight codebase scan to inform grey area identification and proposals. Keep under ~5% context.

**Check for existing codebase maps:**

```bash
ls .planning/codebase/*.md 2>/dev/null
```

**If codebase maps exist:** Read the most relevant ones (CONVENTIONS.md, STRUCTURE.md, STACK.md based on phase type). Extract reusable components, established patterns, integration points. Skip to building context below.

**If no codebase maps, do targeted grep:**

Extract key terms from the phase goal. Search for related files:

```bash
grep -rl "{term1}\|{term2}" src/ app/ --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" 2>/dev/null | head -10
ls src/components/ src/hooks/ src/lib/ src/utils/ 2>/dev/null
```

Read the 3-5 most relevant files to understand existing patterns.

**Build internal codebase_context** (do not write to file):
- **Reusable assets** — existing components, hooks, utilities usable in this phase
- **Established patterns** — how the codebase does state management, styling, data fetching
- **Integration points** — where new code connects (routes, nav, providers)

---

### Sub-step 3: Analyze Phase and Generate Proposals

**Get phase details:**

```bash
DETAIL=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" roadmap get-phase ${PHASE_NUM})
```

Extract `goal`, `requirements`, `success_criteria` from the JSON response.

**Infrastructure detection — check FIRST before generating grey areas:**

A phase is pure infrastructure when ALL of these are true:
1. Goal keywords match: "scaffolding", "plumbing", "setup", "configuration", "migration", "refactor", "rename", "restructure", "upgrade", "infrastructure"
2. AND success criteria are all technical: "file exists", "test passes", "config valid", "command runs"
3. AND no user-facing behavior is described (no "users can", "displays", "shows", "presents")

**If infrastructure-only:** Skip Sub-step 4. Jump directly to Sub-step 5 with minimal CONTEXT.md. Display:

```
Phase ${PHASE_NUM}: Infrastructure phase — skipping discuss, writing minimal context.
```

Use these defaults for the CONTEXT.md:
- `<domain>`: Phase boundary from ROADMAP goal
- `<decisions>`: Single "### Claude's Discretion" subsection — "All implementation choices are at Claude's discretion — pure infrastructure phase"
- `<code_context>`: Whatever the codebase scout found
- `<specifics>`: "No specific requirements — infrastructure phase"
- `<deferred>`: "None"

**If NOT infrastructure — generate grey area proposals:**

Determine domain type from the phase goal:
- Something users **SEE** → visual: layout, interactions, states, density
- Something users **CALL** → interface: contracts, responses, errors, auth
- Something users **RUN** → execution: invocation, output, behavior modes, flags
- Something users **READ** → content: structure, tone, depth, flow
- Something being **ORGANIZED** → organization: criteria, grouping, exceptions, naming

Check prior_decisions — skip grey areas already decided in prior phases.

Generate **3-4 grey areas** with **~4 questions each**. For each question:
- **Pre-select a recommended answer** based on: prior decisions (consistency), codebase patterns (reuse), domain conventions (standard approaches), ROADMAP success criteria
- Generate **1-2 alternatives** per question
- **Annotate** with prior decision context ("You decided X in Phase N") and code context ("Component Y exists with Z variants") where relevant

---

### Sub-step 4: Present Proposals Per Area

Present grey areas **one at a time**. For each area (M of N):

Display a table:

```
### Grey Area {M}/{N}: {Area Name}

| # | Question | ✅ Recommended | Alternative(s) |
|---|----------|---------------|-----------------|
| 1 | {question} | {answer} — {rationale} | {alt1}; {alt2} |
| 2 | {question} | {answer} — {rationale} | {alt1} |
| 3 | {question} | {answer} — {rationale} | {alt1}; {alt2} |
| 4 | {question} | {answer} — {rationale} | {alt1} |
```

Then prompt the user via **AskUserQuestion**:
- **header:** "Area {M}/{N}"
- **question:** "Accept these answers for {Area Name}?"
- **options:** Build dynamically — always "Accept all" first, then "Change Q1" through "Change QN" for each question (up to 4), then "Discuss deeper" last. Cap at 6 explicit options max (AskUserQuestion adds "Other" automatically).

**On "Accept all":** Record all recommended answers for this area. Move to next area.

**On "Change QN":** Use AskUserQuestion with the alternatives for that specific question:
- **header:** "{Area Name}"
- **question:** "Q{N}: {question text}"
- **options:** List the 1-2 alternatives plus "You decide" (maps to Claude's Discretion)

Record the user's choice. Re-display the updated table with the change reflected. Re-present the full acceptance prompt so the user can make additional changes or accept.

**On "Discuss deeper":** Switch to interactive mode for this area only — ask questions one at a time using AskUserQuestion with 2-3 concrete options per question plus "You decide". After 4 questions, prompt:
- **header:** "{Area Name}"
- **question:** "More questions about {area name}, or move to next?"
- **options:** "More questions" / "Next area"

If "More questions", ask 4 more. If "Next area", display final summary table of captured answers for this area and move on.

**On "Other" (free text):** Interpret as either a specific change request or general feedback. Incorporate into the area's decisions, re-display updated table, re-present acceptance prompt.

**Scope creep handling:** If user mentions something outside the phase domain:

```
"{Feature} sounds like a new capability — that belongs in its own phase.
I'll note it as a deferred idea.

Back to {current area}: {return to current question}"
```

Track deferred ideas internally for inclusion in CONTEXT.md.

---

### Sub-step 5: Write CONTEXT.md

After all areas are resolved (or infrastructure skip), write the CONTEXT.md file.

**File path:** `${phase_dir}/${padded_phase}-CONTEXT.md`

Use **exactly** this structure (identical to discuss-phase output):

```markdown
# Phase {PHASE_NUM}: {Phase Name} - Context

**Gathered:** {date}
**Status:** Ready for planning

<domain>
## Phase Boundary

{Domain boundary statement from analysis — what this phase delivers}

</domain>

<decisions>
## Implementation Decisions

### {Area 1 Name}
- {Accepted/chosen answer for Q1}
- {Accepted/chosen answer for Q2}
- {Accepted/chosen answer for Q3}
- {Accepted/chosen answer for Q4}

### {Area 2 Name}
- {Accepted/chosen answer for Q1}
- {Accepted/chosen answer for Q2}
...

### Claude's Discretion
{Any "You decide" answers collected — note Claude has flexibility here}

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- {From codebase scout — components, hooks, utilities}

### Established Patterns
- {From codebase scout — state management, styling, data fetching}

### Integration Points
- {From codebase scout — where new code connects}

</code_context>

<specifics>
## Specific Ideas

{Any specific references or "I want it like X" from discussion}
{If none: "No specific requirements — open to standard approaches"}

</specifics>

<deferred>
## Deferred Ideas

{Ideas captured but out of scope for this phase}
{If none: "None — discussion stayed within phase scope"}

</deferred>
```

Write the file.

**Commit:**

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "docs(${PADDED_PHASE}): smart discuss context" --files "${phase_dir}/${padded_phase}-CONTEXT.md"
```

Display confirmation:

```
Created: {path}
Decisions captured: {count} across {area_count} areas
```

</step>

<step name="iterate">

## 4. Iterate

After each phase completes, re-read ROADMAP.md to catch phases inserted mid-execution (decimal phases like 5.1):

```bash
ROADMAP=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" roadmap analyze)
```

Re-filter incomplete phases using the same logic as discover_phases:
- Keep phases where `disk_status !== "complete"` OR `roadmap_complete === false`
- Apply `--from N` filter if originally provided
- Sort by number ascending

Read STATE.md fresh:

```bash
cat .planning/STATE.md
```

Check for blockers in the Blockers/Concerns section. If blockers are found, go to handle_blocker with the blocker description.

If incomplete phases remain: proceed to next phase, loop back to execute_phase.

If all phases complete, display completion banner:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► AUTONOMOUS ▸ COMPLETE ✅
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 Milestone {milestone_version}: {milestone_name}
 Phases completed: {total}
 Status: All phases executed successfully

 Next: /gsd:complete-milestone to finalize
```

</step>

<step name="handle_blocker">

## 5. Handle Blocker

When any phase operation fails or a blocker is detected, present 3 options via AskUserQuestion:

**Prompt:** "Phase {N} ({Name}) encountered an issue: {description}"

**Options:**
1. **"Fix and retry"** — Re-run the failed step (discuss, plan, or execute) for this phase
2. **"Skip this phase"** — Mark phase as skipped, continue to the next incomplete phase
3. **"Stop autonomous mode"** — Display summary of progress so far and exit cleanly

**On "Fix and retry":** Loop back to the failed step within execute_phase. If the same step fails again after retry, re-present these options.

**On "Skip this phase":** Log `Phase {N} ⏭ {Name} — Skipped by user` and proceed to iterate.

**On "Stop autonomous mode":** Display progress summary:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► AUTONOMOUS ▸ STOPPED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 Completed: {list of completed phases}
 Skipped: {list of skipped phases}
 Remaining: {list of remaining phases}

 Resume with: /gsd:autonomous --from {next_phase}
```

</step>

</process>

<success_criteria>
- [ ] All incomplete phases executed in order (smart discuss → plan → execute each)
- [ ] Smart discuss proposes grey area answers in tables, user accepts or overrides per area
- [ ] Progress banners displayed between phases
- [ ] ROADMAP.md re-read after each phase (catches inserted phases)
- [ ] STATE.md checked for blockers before each phase
- [ ] Blockers handled via user choice (retry / skip / stop)
- [ ] Final completion or stop summary displayed
</success_criteria>
