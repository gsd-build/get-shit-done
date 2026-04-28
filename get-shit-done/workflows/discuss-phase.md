<purpose>
Extract implementation decisions that downstream agents need. Analyze the phase to identify gray areas, let the user choose what to discuss, then deep-dive each selected area until satisfied.

You are a thinking partner, not an interviewer. The user is the visionary — you are the builder. Your job is to capture decisions that will guide research and planning, not to figure out implementation yourself.
</purpose>

<required_reading>
@~/.claude/get-shit-done/references/domain-probes.md
@~/.claude/get-shit-done/references/gate-prompts.md
@~/.claude/get-shit-done/references/universal-anti-patterns.md
</required_reading>

<progressive_disclosure>
**Per-mode bodies, templates, and the advisor flow are lazy-loaded** to keep
this file under the 500-line workflow budget (#2551, mirrors #2361's agent
budget). Read only the files needed for the current invocation:

| When | Read |
|---|---|
| `--power` in $ARGUMENTS | `workflows/discuss-phase/modes/power.md` (then exit standard flow) |
| `--all` in $ARGUMENTS | `workflows/discuss-phase/modes/all.md` overlay |
| `--auto` in $ARGUMENTS | `workflows/discuss-phase/modes/auto.md` + `workflows/discuss-phase/modes/chain.md` (auto-advance) |
| `--chain` in $ARGUMENTS | `workflows/discuss-phase/modes/default.md` + `workflows/discuss-phase/modes/chain.md` |
| `--text` in $ARGUMENTS or `workflow.text_mode: true` | `workflows/discuss-phase/modes/text.md` overlay |
| `--batch` in $ARGUMENTS | `workflows/discuss-phase/modes/batch.md` overlay |
| `--analyze` in $ARGUMENTS | `workflows/discuss-phase/modes/analyze.md` overlay |
| ADVISOR_MODE = true (USER-PROFILE.md exists) | `workflows/discuss-phase/modes/advisor.md` |
| no flags above | `workflows/discuss-phase/modes/default.md` |
| in `write_context` step | `workflows/discuss-phase/templates/context.md` |
| in `git_commit` step | `workflows/discuss-phase/templates/discussion-log.md` |
| writing checkpoints | `workflows/discuss-phase/templates/checkpoint.json` |

Do not Read mode files unless the corresponding flag/condition is set.
</progressive_disclosure>

<downstream_awareness>
**CONTEXT.md feeds into:**

1. **gsd-phase-researcher** — Reads CONTEXT.md to know WHAT to research
2. **gsd-planner** — Reads CONTEXT.md to know WHAT decisions are locked

**Your job:** Capture decisions clearly enough that downstream agents can act on them without asking the user again.
**Not your job:** Figure out HOW to implement. That's what research and planning do with the decisions you capture.
</downstream_awareness>

<philosophy>
**User = founder/visionary. Claude = builder.**

The user knows: how they imagine it working, what it should look/feel like, what's essential vs nice-to-have, specific behaviors or references they have in mind.

The user doesn't know (and shouldn't be asked): codebase patterns (researcher reads the code), technical risks (researcher identifies these), implementation approach (planner figures this out), success metrics (inferred from the work).

Ask about vision and implementation choices. Capture decisions for downstream agents.
</philosophy>

<scope_guardrail>
**CRITICAL: No scope creep.** The phase boundary comes from ROADMAP.md and is FIXED. Discussion clarifies HOW to implement what's scoped, never WHETHER to add new capabilities.

**Allowed (clarifying ambiguity):** "How should posts be displayed?" (layout), "What happens on empty state?" (within the feature), "Pull to refresh or manual?" (behavior choice).

**Not allowed (scope creep):** "Should we also add comments?" / "What about search/filtering?" / "Maybe include bookmarking?" — those are new capabilities and belong in their own phase.

**Heuristic:** Does this clarify how we implement what's already in the phase, or does it add a new capability that could be its own phase?

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

1. Read the phase goal from ROADMAP.md
2. Understand the domain — something users SEE / CALL / RUN / READ / something being ORGANIZED — and let that drive what kinds of decisions matter
3. Generate phase-specific gray areas (not generic categories)

**Don't use generic category labels** (UI, UX, Behavior). Generate specific gray areas. Examples:

```
Phase: "User authentication"     → Session handling, Error responses, Multi-device policy, Recovery flow
Phase: "Organize photo library"  → Grouping criteria, Duplicate handling, Naming convention, Folder structure
Phase: "CLI for database backups"→ Output format, Flag design, Progress reporting, Error recovery
Phase: "API documentation"       → Structure/navigation, Code examples depth, Versioning approach, Interactive elements
```

**Claude handles these (don't ask):** technical implementation details, architecture patterns, performance optimization, scope (roadmap defines this).
</gray_area_identification>

<answer_validation>
**IMPORTANT: Answer validation** — After every AskUserQuestion call, if the response is empty/whitespace-only:

- **"Other" with empty text** (the user wants to type freeform): output `"What would you like to discuss?"`, STOP generating, wait for the user's next message, then reflect it back and continue. Do NOT retry AskUserQuestion or call any tools.
- **Any other empty response:** retry once with the same parameters; if still empty, present options as a plain-text numbered list. Never proceed with empty input.

**Text mode** (`--text` or `workflow.text_mode: true`): follow `workflows/discuss-phase/modes/text.md` — do not use AskUserQuestion at all.
</answer_validation>

<process>

**Express path available:** If you already have a PRD or acceptance criteria document, use `/gsd-plan-phase {phase} --prd path/to/prd.md` to skip this discussion and go straight to planning.

<step name="initialize" priority="first">
Phase number from argument (required).

```bash
INIT=$(gsd-sdk query init.phase-op "${PHASE}")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
AGENT_SKILLS_ADVISOR=$(gsd-sdk query agent-skills gsd-advisor-researcher)
```

Parse JSON for: `commit_docs`, `phase_found`, `phase_dir`, `phase_number`, `phase_name`, `phase_slug`, `padded_phase`, `has_research`, `has_context`, `has_plans`, `has_verification`, `plan_count`, `roadmap_exists`, `planning_exists`, `response_language`.

**If `response_language` is set:** All user-facing questions, prompts, and explanations in this workflow MUST be presented in `{response_language}`. Technical terms, code, file paths, and subagent prompts stay in English — only user-facing output is translated.

**If `phase_found` is false:**
```
Phase [X] not found in roadmap.
Use /gsd-progress ${GSD_WS} to see available phases.
```
Exit workflow.

**Mode dispatch — Read mode files lazily based on flags in $ARGUMENTS:**

```bash
# Detect advisor mode (file-existence guard — no Read until needed)
if [ -f "$HOME/.claude/get-shit-done/USER-PROFILE.md" ]; then
  ADVISOR_MODE=true
else
  ADVISOR_MODE=false
fi
```

- If `--power` in $ARGUMENTS: `Read(workflows/discuss-phase/modes/power.md)` and execute it end-to-end. Do NOT continue with the steps below.
- Otherwise, continue. Per-flag overlay reads happen at their relevant steps:
  - `--all` → Read `workflows/discuss-phase/modes/all.md` before `present_gray_areas`.
  - `--auto` → Read `workflows/discuss-phase/modes/auto.md` before `check_existing` (it overrides several steps).
  - `--chain` → Read `workflows/discuss-phase/modes/chain.md` before `auto_advance`.
  - `--text` (or `workflow.text_mode: true`) → Read `workflows/discuss-phase/modes/text.md` before any AskUserQuestion call.
  - `--batch` → Read `workflows/discuss-phase/modes/batch.md` before `discuss_areas`.
  - `--analyze` → Read `workflows/discuss-phase/modes/analyze.md` before `discuss_areas`.
  - `ADVISOR_MODE = true` → Read `workflows/discuss-phase/modes/advisor.md` before `analyze_phase` (it changes the discussion flow and adds an `advisor_research` substep).
  - No flags → Read `workflows/discuss-phase/modes/default.md` before `discuss_areas`.

**If `phase_found` is true:** Continue to `check_blocking_antipatterns`.
</step>

<step name="check_blocking_antipatterns" priority="first">
**MANDATORY — Check for blocking anti-patterns before any other work.**

Look for a `.continue-here.md` in the current phase directory:

```bash
ls ${phase_dir}/.continue-here.md 2>/dev/null || true
```

If `.continue-here.md` exists, parse its "Critical Anti-Patterns" table for rows with `severity` = `blocking`.

**If one or more `blocking` anti-patterns are found:** the agent must demonstrate understanding of each by answering all three questions for each one:
1. **What is this anti-pattern?** — Describe it in your own words.
2. **How did it manifest?** — Explain the specific failure that caused it to be recorded.
3. **What structural mechanism (not acknowledgment) prevents it?** — Name the concrete step or enforcement mechanism that stops recurrence.

Write these answers inline before continuing. If a blocking anti-pattern cannot be answered from the context in `.continue-here.md`, stop and ask the user for clarification.

**If no `.continue-here.md` exists, or no `blocking` rows are found:** Proceed directly to `check_spec`.
</step>

<step name="check_spec">
Check if a SPEC.md (from `/gsd-spec-phase`) exists for this phase. SPEC.md locks requirements before implementation decisions.

```bash
ls ${phase_dir}/*-SPEC.md 2>/dev/null | grep -v AI-SPEC | head -1 || true
```

**If SPEC.md is found:**
1. Read the SPEC.md file.
2. Count requirements (numbered items in `## Requirements`).
3. Display: `Found SPEC.md — {N} requirements locked. Focusing on implementation decisions.`
4. Set `spec_loaded = true`.
5. Store requirements, boundaries, and acceptance criteria as `<locked_requirements>` — these flow directly into CONTEXT.md without re-asking.

**If no SPEC.md is found:** Continue with `spec_loaded = false`.

**Note:** SPEC.md files named `AI-SPEC.md` (from `/gsd-ai-integration-phase`) are excluded — different purpose.
</step>

<step name="check_existing">
Check if CONTEXT.md already exists using `has_context` from init.

```bash
ls ${phase_dir}/*-CONTEXT.md 2>/dev/null || true
```

**If exists:**

**If `--auto`:** Auto-select "Update it" — load existing context and continue to `analyze_phase`. Log: `[auto] Context exists — updating with auto-selected decisions.`

**Otherwise:** AskUserQuestion (header: "Context"; question: "Phase [X] already has context. What do you want to do?"; options: "Update it" / "View it" / "Skip"). Branch accordingly.

**If doesn't exist:**

Check for an interrupted discussion checkpoint:
```bash
ls ${phase_dir}/*-DISCUSS-CHECKPOINT.json 2>/dev/null || true
```

If a checkpoint file exists:

**If `--auto`:** Auto-select "Resume" — load checkpoint and continue from last completed area.

**Otherwise:** AskUserQuestion (header: "Resume"; question: "Found interrupted discussion checkpoint ({N} areas completed out of {M}). Resume from where you left off?"; options: "Resume" / "Start fresh"). On "Resume", parse the checkpoint JSON, load `decisions` into the internal accumulator, set `areas_completed` to skip those areas, continue to `present_gray_areas` with only the remaining areas. On "Start fresh", delete the checkpoint and continue.

Check `has_plans` and `plan_count` from init. **If `has_plans` is true:**

**If `--auto`:** Auto-select "Continue and replan after". Log: `[auto] Plans exist — continuing with context capture, will replan after.`

**Otherwise:** AskUserQuestion (header: "Plans exist"; question: "Phase [X] already has {plan_count} plan(s) created without user context. Your decisions here won't affect existing plans unless you replan."; options: "Continue and replan after" / "View existing plans" / "Cancel"). Branch accordingly.

**If `has_plans` is false:** Continue to `load_prior_context`.
</step>

<step name="load_prior_context">
Read project-level and prior phase context to avoid re-asking decided questions.

```bash
cat .planning/PROJECT.md 2>/dev/null || true
cat .planning/REQUIREMENTS.md 2>/dev/null || true
cat .planning/STATE.md 2>/dev/null || true
```

Read at most **3** prior CONTEXT.md files (most recent 3 phases before current). If `.planning/DECISIONS-INDEX.md` exists, read that instead — it is a bounded rolling summary that supersedes per-phase reads.

```bash
(find .planning/phases -name "*-CONTEXT.md" 2>/dev/null || true) | sort -r
```

For each CONTEXT.md read: extract `<decisions>` (locked preferences), `<specifics>` (particular references), and patterns (e.g., "user prefers minimal UI", "user rejected single-key shortcuts").

**Spike/sketch findings:** Check for project-local skills:
```bash
SPIKE_FINDINGS=$(ls ./.claude/skills/spike-findings-*/SKILL.md 2>/dev/null | head -1)
SKETCH_FINDINGS=$(ls ./.claude/skills/sketch-findings-*/SKILL.md 2>/dev/null | head -1)
RAW_SPIKES=$(ls .planning/spikes/MANIFEST.md 2>/dev/null)
RAW_SKETCHES=$(ls .planning/sketches/MANIFEST.md 2>/dev/null)
```

If findings skills exist, read SKILL.md and reference files; extract validated patterns, landmines, constraints, design decisions. Add them to `<prior_decisions>`.

If raw spikes/sketches exist but no findings skill, note: `⚠ Unpackaged spikes/sketches detected — run /gsd-spike-wrap-up or /gsd-sketch-wrap-up to make findings available.`

Build internal `<prior_decisions>` with sections for Project-Level (from PROJECT.md / REQUIREMENTS.md), From Prior Phases (per-phase decisions), and From Spike/Sketch Findings (validated patterns, landmines, design decisions).

**Usage downstream:** `analyze_phase` skips already-decided gray areas; `present_gray_areas` annotates options ("You chose X in Phase 5"); `discuss_areas` pre-fills or flags conflicts.

**If no prior context exists:** Continue without — expected for early phases.
</step>

<step name="cross_reference_todos">
Check pending todos for matches with this phase's scope.

```bash
TODO_MATCHES=$(gsd-sdk query todo.match-phase "${PHASE_NUMBER}")
```

Parse JSON for: `todo_count`, `matches[]` (each with `file`, `title`, `area`, `score`, `reasons`).

**If `todo_count` is 0 or `matches` is empty:** Skip silently.

**If matches found:** Present each match (title, area, why it matched). AskUserQuestion (multiSelect) asking which to fold. Folded → `<folded_todos>` for CONTEXT.md `<decisions>`. Reviewed but not folded → `<reviewed_todos>` for CONTEXT.md `<deferred>`.

**Auto mode (`--auto`):** Fold all todos with score >= 0.4 automatically. Log the selection.
</step>

<step name="scout_codebase">
Lightweight scan of existing code to inform gray area identification (~10% context).

Read `@~/.claude/get-shit-done/references/scout-codebase.md` — it contains the phase-type→map selection table, single-read rule, no-maps fallback, and `<codebase_context>` output schema. Then execute:
1. `ls .planning/codebase/*.md` to find existing maps
2. Select 2–3 maps via the reference's table; or grep fallback if none exist
3. Build internal `<codebase_context>` per the reference's output schema
</step>

<step name="analyze_phase">
Analyze the phase to identify gray areas. Use both `prior_decisions` and `codebase_context` to ground the analysis.

1. **Domain boundary** — What capability is this phase delivering? State it clearly.

1b. **Initialize canonical refs accumulator** — Start building `<canonical_refs>` for CONTEXT.md. Sources:
   - **Now:** Copy `Canonical refs:` from ROADMAP.md for this phase. Expand each to a full relative path. Check REQUIREMENTS.md and PROJECT.md for specs/ADRs referenced.
   - **`scout_codebase`:** If existing code references docs (e.g., comments citing ADRs), add those.
   - **`discuss_areas`:** When the user says "read X", "check Y", or references any doc/spec/ADR — add it immediately. These are often the MOST important refs.

   This list is MANDATORY in CONTEXT.md. Every ref must have a full relative path. If no external docs exist, note that explicitly.

2. **Check prior decisions** — Scan `<prior_decisions>` for already-decided gray areas; mark them pre-answered.

2b. **SPEC.md awareness** — If `spec_loaded = true`: `<locked_requirements>` are pre-answered (Goal, Boundaries, Constraints, Acceptance Criteria). Do NOT generate gray areas about WHAT to build or WHY. Only generate gray areas about HOW to implement. When presenting, include: "Requirements are locked by SPEC.md — discussing implementation decisions only."

3. **Gray areas** — For each relevant category, identify 1-2 specific ambiguities that would change implementation. Annotate with code context where relevant.

4. **Skip assessment** — If no meaningful gray areas exist (pure infrastructure, clear-cut implementation, all already decided), the phase may not need discussion.

**Advisor mode hand-off:** If `ADVISOR_MODE` is true, follow `workflows/discuss-phase/modes/advisor.md` for the rest of analyze/discuss flow (it adds an `advisor_research` substep and replaces the standard `discuss_areas` with table-first selection). The detection block (USER-PROFILE.md existence + non-technical-owner signals + calibration tier resolution) lives in that file — read it once when ADVISOR_MODE is true and follow its rules.
</step>

<step name="present_gray_areas">
Present the domain boundary, prior decisions, and gray areas to the user.

```
Phase [X]: [Name]
Domain: [What this phase delivers — from your analysis]

We'll clarify HOW to implement this. (New capabilities belong in other phases.)

[If prior decisions apply:]
**Carrying forward from earlier phases:**
- [Decision from Phase N that applies here]
```

**If `--auto` or `--all`** (per `modes/auto.md` or `modes/all.md`): Auto-select ALL gray areas. Log: `[--auto/--all] Selected all gray areas: [list area names].` Skip the AskUserQuestion below and continue directly to `discuss_areas` with all areas selected.

**Otherwise, use AskUserQuestion (multiSelect: true):**
- header: "Discuss"
- question: "Which areas do you want to discuss for [phase name]?"
- options: 3-4 phase-specific gray areas, each with a concrete label (not generic), 1-2 questions in description, and code-context / prior-decision annotations:
  ```
  ☐ Layout style — Cards vs list vs timeline?
    (You already have a Card component with shadow/rounded variants. Reusing it keeps the app consistent.)

  ☐ Loading behavior — Infinite scroll or pagination?
    (You chose infinite scroll in Phase 4. useInfiniteQuery hook already set up.)
  ```

**Do NOT include a "skip" or "you decide" option.** User ran this command to discuss — give real choices.

Continue to `discuss_areas` with selected areas (or to `advisor_research` per `modes/advisor.md` if `ADVISOR_MODE` is true).
</step>

<step name="discuss_areas">
Discussion behavior is defined by the active mode file(s):

- **Advisor mode (ADVISOR_MODE = true):** follow `workflows/discuss-phase/modes/advisor.md` — research-backed comparison tables, table-first selection.
- **--auto:** follow `workflows/discuss-phase/modes/auto.md` — Claude picks recommended option for every question; no AskUserQuestion. Single-pass cap enforced.
- **Default (no flags):** follow `workflows/discuss-phase/modes/default.md` — 4 single-question turns per area, then check whether to continue.

Overlays (combine with the active mode):
- `--text` → `workflows/discuss-phase/modes/text.md` (replace AskUserQuestion with plain-text numbered lists)
- `--batch` → `workflows/discuss-phase/modes/batch.md` (group 2–5 questions per turn)
- `--analyze` → `workflows/discuss-phase/modes/analyze.md` (trade-off table before each question)

**Overlay stacking:** overlays combine and apply outer→inner in fixed order `--analyze` → `--batch` → `--text` (e.g., `--batch --analyze` = trade-off table per question group; add `--text` for plain-text rendering). Mode-specific precedence (e.g., `--auto --power`) is documented in each overlay file's "Combination rules" section.

All modes preserve the universal rules below.

**Universal rules (apply to every mode):**

- **Canonical ref accumulation** — when the user references a doc/spec/ADR during any answer, immediately Read it (or confirm it exists) and add it to the canonical refs accumulator with full relative path. Use what you learned to inform subsequent questions. These docs are often MORE important than ROADMAP.md refs because the user specifically wants downstream agents to follow them.
- **Scope creep** — if user mentions something outside the phase domain, capture as deferred idea and redirect.
- **Incremental checkpoint** — after each area completes, write `${phase_dir}/${padded_phase}-DISCUSS-CHECKPOINT.json`. Read `workflows/discuss-phase/templates/checkpoint.json` for the schema. The checkpoint is structured state, not the canonical CONTEXT.md (`write_context` produces the canonical output). On session resume, the parent's `check_existing` step detects the checkpoint and offers to resume.
- **Discussion log accumulation** — for each question asked, accumulate area name, options presented, user's selection, follow-up notes. Used by `git_commit` to write DISCUSSION-LOG.md.
</step>

<step name="write_context">
Create CONTEXT.md and DISCUSSION-LOG.md.

DISCUSSION-LOG.md is for human reference only (audits, retrospectives) and is NOT consumed by downstream agents (researcher, planner, executor).

**Find or create phase directory:**

Use values from init: `phase_dir`, `phase_slug`, `padded_phase`. If `phase_dir` is null:
```bash
mkdir -p ".planning/phases/${padded_phase}-${phase_slug}"
```

**File location:** `${phase_dir}/${padded_phase}-CONTEXT.md`

**Read the CONTEXT.md template now (lazy-loaded):**
```
Read(workflows/discuss-phase/templates/context.md)
```

The template documents variable substitutions and conditional sections. Substitute live values for `[X]`, `[Name]`, `[date]`, `${padded_phase}`, `{N}`. Include `<spec_lock>` only when `spec_loaded = true`. Include "Folded Todos" / "Reviewed Todos" subsections only when the `cross_reference_todos` step folded or reviewed todos.

**SPEC.md integration** — If `spec_loaded = true`:
- Add the `<spec_lock>` section immediately after `<domain>`.
- Add the SPEC.md file to `<canonical_refs>` with note "Locked requirements — MUST read before planning".
- Do NOT duplicate requirements text from SPEC.md into `<decisions>` — agents read SPEC.md directly.
- The `<decisions>` section contains only implementation decisions from this discussion.

Write the file.
</step>

<step name="confirm_creation">
Present summary and next steps:

```
Created: .planning/phases/${PADDED_PHASE}-${SLUG}/${PADDED_PHASE}-CONTEXT.md

## Decisions Captured
### [Category]
- [Key decision]

[If deferred ideas exist:]
## Noted for Later
- [Deferred idea] — future phase

---

## ▶ Next Up — [${PROJECT_CODE}] ${PROJECT_TITLE}

**Phase ${PHASE}: [Name]** — [Goal from ROADMAP.md]

`/clear` then:

`/gsd-plan-phase ${PHASE} ${GSD_WS}`

---

**Also available:** `--chain` for auto plan+execute after; `/gsd-plan-phase ${PHASE} --skip-research ${GSD_WS}` to plan without research; `/gsd-ui-phase ${PHASE} ${GSD_WS}` for UI design contracts; review/edit CONTEXT.md before continuing.
```
</step>

<step name="git_commit">
**Write DISCUSSION-LOG.md before committing.**

**File location:** `${phase_dir}/${padded_phase}-DISCUSSION-LOG.md`

**Read the DISCUSSION-LOG.md template now (lazy-loaded):**
```
Read(workflows/discuss-phase/templates/discussion-log.md)
```

Substitute live values from the discussion log accumulator (area names, options presented, user selections, notes, deferred ideas, Claude's discretion items). Write the file.

**Clean up checkpoint file** — CONTEXT.md is now the canonical record:
```bash
rm -f "${phase_dir}/${padded_phase}-DISCUSS-CHECKPOINT.json"
```

Commit phase context and discussion log:
```bash
gsd-sdk query commit "docs(${padded_phase}): capture phase context" --files "${phase_dir}/${padded_phase}-CONTEXT.md" "${phase_dir}/${padded_phase}-DISCUSSION-LOG.md"
```

Confirm: "Committed: docs(${padded_phase}): capture phase context"
</step>

<step name="update_state">
Update STATE.md with session info:

```bash
gsd-sdk query state.record-session \
  --stopped-at "Phase ${PHASE} context gathered" \
  --resume-file "${phase_dir}/${padded_phase}-CONTEXT.md"

gsd-sdk query commit "docs(state): record phase ${PHASE} context session" --files .planning/STATE.md
```
</step>

<step name="auto_advance">
Auto-advance behavior is defined in `workflows/discuss-phase/modes/chain.md`.

If `--auto`, `--chain`, or `workflow.auto_advance` is enabled, Read that file now and execute its `auto_advance` step (which handles flag-syncing, banner display, plan-phase Skill dispatch, and return-status branching).

Otherwise, route to `confirm_creation` (manual next steps).
</step>

</process>

<success_criteria>
- Phase validated against roadmap
- Prior context loaded (PROJECT.md, REQUIREMENTS.md, STATE.md, prior CONTEXT.md files)
- Already-decided questions not re-asked (carried forward from prior phases)
- Codebase scouted for reusable assets, patterns, and integration points
- Gray areas identified with code and prior-decision annotations
- User selected which areas to discuss (or `--all`/`--auto` auto-selected)
- Each selected area explored under the active mode's rules until satisfied
- Scope creep redirected to deferred ideas
- CONTEXT.md captures actual decisions, not vague vision
- CONTEXT.md includes canonical_refs section with full file paths to every spec/ADR/doc downstream agents need (MANDATORY)
- CONTEXT.md includes code_context section with reusable assets and patterns
- Deferred ideas preserved for future phases
- STATE.md updated with session info
- User knows next steps
- Checkpoint file written after each area completes (incremental save)
- Interrupted sessions can be resumed from checkpoint
- Checkpoint file cleaned up after successful CONTEXT.md write
- `--chain` triggers interactive discuss followed by auto plan+execute (no auto-answering)
- `--chain` and `--auto` both persist chain flag and auto-advance to plan-phase
- Per-mode bodies, templates, and advisor flow are lazy-loaded — parent stays under the workflow size budget enforced by `tests/workflow-size-budget.test.cjs`
</success_criteria>
