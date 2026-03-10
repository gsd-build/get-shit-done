# Phase 6: Smart Discuss - Research

**Researched:** 2026-03-10
**Domain:** Workflow markdown engineering — replacing interactive grey area Q&A with batch proposal + acceptance UX
**Confidence:** HIGH

## Summary

Phase 6 modifies the existing `autonomous.md` workflow (245 lines) to replace the `Skill(skill="gsd:discuss-phase")` call with inline "smart discuss" logic. This inline logic reuses analysis patterns from `discuss-phase.md` (675 lines) — specifically `load_prior_context`, `scout_codebase`, `analyze_phase`, and `write_context` — but fundamentally changes the user interaction model from "multi-select areas → 4-question loops" to "table of proposals per area → accept/change batch."

The implementation is pure markdown workflow engineering. No new JavaScript tooling, no new commands, no new npm packages. The only file that changes is `get-shit-done/workflows/autonomous.md`. The critical constraint is that the output CONTEXT.md must be format-identical to what `discuss-phase.md` produces (same XML-wrapped sections: `<domain>`, `<decisions>`, `<code_context>`, `<specifics>`, `<deferred>`).

**Primary recommendation:** Add 3-4 new `<step>` sections to autonomous.md that implement smart discuss inline. Replace the step 3a `Skill("gsd:discuss-phase")` call with a reference to the new smart_discuss step. Keep the step structure modular so Phase 7 can later chain plan/execute inline too.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Logic lives inside `get-shit-done/workflows/autonomous.md` — a new step/section within the existing workflow
- Reuses same analysis logic as discuss-phase: `analyze_phase` + `scout_codebase` patterns — analyzes phase goal, codebase, prior decisions, ROADMAP to identify grey areas
- Generates 3-4 grey areas with ~4 questions each, pre-selecting recommended answers with rationale
- Presents proposals in **table format per area** — question, recommended answer (✅), and 1-2 alternatives
- No confidence levels — present ALL proposals equally, user always has control
- Areas presented one at a time for focused review
- **Per-area batch acceptance** — "Accept all answers for this area?" with option to change specific ones
- If user wants to change: AskUserQuestion for the specific question with alternatives, then re-show updated area summary
- If user wants deeper discussion: switch to interactive per-question mode for that area (like regular discuss-phase)
- Show updated table with final answers before moving to next area
- Pattern: present area → accept/change → confirm → next area
- **Identical format to regular discuss-phase** — same sections (domain, decisions, code_context, specifics, deferred)
- Downstream agents (researcher, planner) don't need to know it was autonomous mode
- After CONTEXT.md is written, **seamlessly chain to plan-phase** within the same autonomous loop (not a separate Skill() call from outer loop)
- For phases with **no meaningful grey areas** (pure infrastructure): skip discuss, write minimal CONTEXT.md with "Claude's Discretion: all implementation choices", proceed to plan
- Include **codebase scout** (lightweight grep/codebase-maps) — essential for making good proposals

### Claude's Discretion
- Exact table formatting and markdown presentation of proposals
- How to detect "pure infrastructure" phases vs ones needing discussion
- Codebase scout depth (how many files to scan)
- Wording of acceptance prompts

### Deferred Ideas (OUT OF SCOPE)
- Confidence-level marking for proposals (was considered, decided against for simplicity)
- Automatic answer generation without any user confirmation (fully autonomous — too risky)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DISC-01 | System proposes answers for each grey area instead of open-ended questions, presenting one grey area at a time | Analysis pattern from discuss-phase.md lines 267-297 generates grey areas; new table-based proposal format replaces multi-select + question loops |
| DISC-02 | For each grey area, system presents questions with recommended answers and alternatives | Table format with ✅ marker on recommended answer; 1-2 alternatives per question; rationale in parenthetical |
| DISC-03 | User can accept all proposed answers for a grey area, or change specific ones | AskUserQuestion with "Accept all" + per-question change options; deeper discussion fallback mode |
| DISC-04 | System writes CONTEXT.md with locked decisions (same format as regular discuss-phase) | write_context template from discuss-phase.md lines 439-522; identical XML-wrapped sections |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Markdown workflow | N/A | `autonomous.md` is the only modified file | All GSD workflows are markdown instruction files interpreted by the AI agent |
| gsd-tools.cjs | Existing | `init phase-op`, `roadmap get-phase`, `commit`, `state` commands | Pre-built CLI tooling for phase operations, already used in autonomous.md |
| AskUserQuestion | Built-in | User interaction for accept/change/deeper-discuss per area | Claude Code built-in tool — no installation needed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| gsd-tools.cjs roadmap | Existing | `roadmap analyze`, `roadmap get-phase N` | Phase goal/criteria extraction for grey area analysis |
| gsd-tools.cjs init | Existing | `init phase-op N` | Bootstrap phase paths, check existing CONTEXT.md |
| gsd-tools.cjs commit | Existing | `commit "msg" --files path` | Git commit of CONTEXT.md |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Inline logic in autonomous.md | Keep Skill("gsd:discuss-phase") | Would not satisfy DISC-01/DISC-02 — regular discuss uses open-ended Q&A, not proposals |
| Modifying discuss-phase.md | Separate smart discuss workflow | User decided: logic lives inside autonomous.md, not a separate workflow |

**Installation:** None needed — all tools already exist.

## Architecture Patterns

### How autonomous.md Currently Works

```
autonomous.md (245 lines)
├── <step name="initialize">        — Parse --from, milestone-level init, startup banner
├── <step name="discover_phases">   — roadmap analyze, filter incomplete, sort, display plan
├── <step name="execute_phase">     — Per-phase: discuss (Skill) → plan (Skill) → execute (Skill)
├── <step name="iterate">           — Re-read ROADMAP, check STATE, loop or complete
└── <step name="handle_blocker">    — User choice: retry / skip / stop
```

### Proposed New Structure

```
autonomous.md (~450-500 lines estimated)
├── <step name="initialize">              — (unchanged)
├── <step name="discover_phases">         — (unchanged)
├── <step name="execute_phase">           — Modified: calls smart_discuss inline instead of Skill()
│   ├── 3a. smart_discuss (replaces Skill call)
│   ├── 3b. plan (Skill call — unchanged)
│   ├── 3c. execute (Skill call — unchanged)
│   └── 3d. transition (unchanged)
├── <step name="smart_discuss">           — NEW: orchestrates the 3 sub-steps below
├── <step name="analyze_grey_areas">      — NEW: prior context + codebase scout + grey area generation
├── <step name="present_proposals">       — NEW: per-area table display + accept/change UX
├── <step name="write_smart_context">     — NEW: CONTEXT.md generation from accepted proposals
├── <step name="iterate">                 — (unchanged)
└── <step name="handle_blocker">          — (unchanged)
```

### Pattern 1: Grey Area Analysis (reused from discuss-phase.md)
**What:** Analyze phase goal to identify 3-4 domain-specific grey areas with ~4 questions each
**When to use:** For every phase that needs discussion (non-infrastructure)
**Source logic from discuss-phase.md lines 267-297:**

```markdown
## Analysis Process (adapted for autonomous smart discuss)

1. Read phase goal from ROADMAP.md via `gsd-tools.cjs roadmap get-phase N`
2. Determine domain type:
   - Something users SEE → visual presentation, interactions, states
   - Something users CALL → interface contracts, responses, errors
   - Something users RUN → invocation, output, behavior modes
   - Something users READ → structure, tone, depth, flow
   - Something being ORGANIZED → criteria, grouping, handling exceptions
3. Load prior decisions from PROJECT.md, REQUIREMENTS.md, STATE.md, prior CONTEXT.md files
4. Scout codebase: check .planning/codebase/*.md, targeted grep if none
5. Generate 3-4 grey areas with ~4 questions each
6. For each question: pre-select recommended answer + 1-2 alternatives
7. Annotate with prior decisions and code context
```

### Pattern 2: Table-Based Proposal Format
**What:** Each grey area presented as a focused table with recommended answers highlighted
**When to use:** For every grey area presentation (DISC-01, DISC-02)

```markdown
## Grey Area 1/3: Answer Proposal Mechanism

| # | Question | Recommended (✅) | Alternative(s) |
|---|----------|-----------------|-----------------|
| 1 | How should proposals be grouped? | By grey area (batch of ~4 questions) — focused review | All questions at once — faster but overwhelming |
| 2 | How to show the recommended answer? | ✅ marker in table — clear visual | Bold text — subtle |
| 3 | What if user disagrees with a recommendation? | AskUserQuestion with alternatives — familiar UX | Free text input — flexible but unstructured |
| 4 | How to handle "You decide" responses? | Map to Claude's Discretion — consistent with discuss-phase | Skip the question — loses the decision |

**Accept all answers for this area?**
```

### Pattern 3: Per-Area Acceptance UX
**What:** AskUserQuestion with options for batch accept, change specific, or deeper discussion
**When to use:** After presenting each grey area table (DISC-03)

```markdown
AskUserQuestion:
  header: "Area 1/3"
  question: "Accept these answers for [Area Name]?"
  options:
    - "Accept all" — Lock these 4 answers, move to next area
    - "Change Q1" — Replace recommendation for question 1
    - "Change Q2" — Replace recommendation for question 2
    - "Change Q3" — Replace recommendation for question 3
    - "Change Q4" — Replace recommendation for question 4
    - "Discuss deeper" — Switch to interactive per-question mode for this area
```

If user picks "Change QN":
- AskUserQuestion with the alternatives + "Other" for freeform
- Re-display updated table with new answer highlighted
- Re-ask acceptance

If user picks "Discuss deeper":
- Switch to 4-question loop mode (like regular discuss-phase step `discuss_areas`)
- Return to table display with captured answers when done

### Pattern 4: Infrastructure Phase Detection
**What:** Skip discuss entirely for pure infrastructure phases
**When to use:** Phase analysis step, before generating grey areas

```markdown
## Infrastructure Phase Heuristic

A phase is "pure infrastructure" when ALL of these are true:
- Phase goal contains keywords: "scaffolding", "plumbing", "setup", "configuration", "migration", "refactor"
- Success criteria are technical/structural (file exists, test passes, config valid)
- No user-facing behavior changes
- No interface/UX decisions needed

When detected:
- Skip grey area analysis entirely
- Write minimal CONTEXT.md:
  - domain: [phase boundary from ROADMAP]
  - decisions: "### Claude's Discretion\nAll implementation choices are technical — Claude has full flexibility."
  - code_context: [from codebase scout if relevant]
  - specifics: "No specific requirements — pure infrastructure phase"
  - deferred: "None"
- Display: "Phase {N} is pure infrastructure — no grey areas to discuss. Proceeding with Claude's discretion."
```

### Pattern 5: CONTEXT.md Output Format (must be identical)
**What:** The exact section structure that downstream agents expect
**Source:** discuss-phase.md lines 439-522, template at `get-shit-done/templates/context.md`

```markdown
# Phase [X]: [Name] - Context

**Gathered:** [date]
**Status:** Ready for planning

<domain>
## Phase Boundary
[From ROADMAP.md phase goal — the scope anchor]
</domain>

<decisions>
## Implementation Decisions

### [Grey Area 1 Name]
- [Accepted answer for Q1]
- [Accepted answer for Q2]
- [Accepted answer for Q3]
- [Accepted answer for Q4]

### [Grey Area 2 Name]
- [Accepted answers...]

### Claude's Discretion
[Areas marked "You decide" + any infrastructure-only areas]
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- [From codebase scout]

### Established Patterns
- [From codebase scout]

### Integration Points
- [From codebase scout]
</code_context>

<specifics>
## Specific Ideas
[Any particular references from discussion, or "No specific requirements"]
</specifics>

<deferred>
## Deferred Ideas
[Scope creep captured during discussion, or "None"]
</deferred>
```

### Anti-Patterns to Avoid
- **Reimplementing discuss-phase.md logic from scratch:** Reuse the same analysis heuristics (domain type → grey area categories). Don't invent a new grey area generation approach.
- **Presenting all areas simultaneously:** DISC-01 requires one area at a time. Never show a mega-table with all questions across all areas.
- **Skipping codebase scout:** The scout provides code context annotations that make proposals valuable. Without it, recommendations would be generic.
- **Breaking CONTEXT.md format:** Downstream agents (researcher, planner) parse the XML-wrapped sections. Even a missing `</decisions>` tag would break the chain.
- **Nested Skill calls for discuss:** The whole point is to replace the Skill call with inline logic. Don't call back to discuss-phase as a sub-skill.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Phase path resolution | Custom path building | `gsd-tools.cjs init phase-op N` | Handles padded phase numbers, slug generation, directory creation |
| ROADMAP phase parsing | Regex on ROADMAP.md | `gsd-tools.cjs roadmap get-phase N` | Returns structured JSON with goal, requirements, success criteria |
| Git commits | Manual git commands | `gsd-tools.cjs commit "msg" --files path` | Handles commit_docs config flag, message formatting |
| State recording | Direct STATE.md editing | `gsd-tools.cjs state record-session` | Handles frontmatter, timestamps, proper section updates |
| Grey area categories | New category system | discuss-phase.md domain heuristic | SEE/CALL/RUN/READ/ORGANIZED already maps domains to grey area types |

**Key insight:** The smart discuss is about changing the UX flow (proposals instead of questions), not the analysis engine. The grey area identification logic should be copied/adapted from discuss-phase.md, not invented fresh.

## Common Pitfalls

### Pitfall 1: CONTEXT.md Format Drift
**What goes wrong:** Smart discuss produces CONTEXT.md with slightly different structure (missing XML tags, different section headers, missing "Claude's Discretion" section), and downstream researcher/planner fail silently or produce poor results.
**Why it happens:** Writing the template from scratch instead of copying the exact structure from discuss-phase.md.
**How to avoid:** Copy the write_context template verbatim from discuss-phase.md lines 439-522. Verify by comparing output against the Phase 5 CONTEXT.md (which was produced by discuss-phase) — must have same sections.
**Warning signs:** Researcher doesn't pick up on decisions; planner asks user about things that were already decided.

### Pitfall 2: AskUserQuestion Option Explosion
**What goes wrong:** For areas with 4+ questions, the "Change Q1 / Change Q2 / Change Q3 / Change Q4" options list becomes unwieldy, especially combined with "Accept all" and "Discuss deeper."
**Why it happens:** AskUserQuestion has a practical limit on readability with many options.
**How to avoid:** Cap at 6 options total: "Accept all" + up to 4 "Change Q{N}" + "Discuss deeper". If an area has more than 4 questions, split into sub-areas or batch the less critical questions under "Claude's Discretion" by default.
**Warning signs:** User repeatedly picks "Other" to express frustration with options.

### Pitfall 3: Table Rendering in Terminal
**What goes wrong:** Markdown tables with long recommended-answer text wrap poorly in terminal output, making them hard to read.
**Why it happens:** Terminal width constraints + verbose answer descriptions.
**How to avoid:** Keep recommended answer cells concise (< 40 chars). Put rationale in parenthetical below the table or as a brief note, not inside the cell.
**Warning signs:** Tables look broken when autonomous workflow displays them.

### Pitfall 4: Missing "Discuss Deeper" Escape Hatch
**What goes wrong:** User needs to explore a grey area more thoroughly but only has accept/change options, leading to frustration.
**Why it happens:** Implementing only the fast path (accept/change) without the interactive fallback.
**How to avoid:** Always include "Discuss deeper" option. When selected, switch to the discuss-phase.md `discuss_areas` pattern (4-question loops with AskUserQuestion per question). After the deep dive, return to the table view with captured answers.
**Warning signs:** User picks "Other" and writes "I need to think about this more."

### Pitfall 5: Losing Prior Context in Recommendations
**What goes wrong:** Smart discuss proposes answers that contradict decisions from earlier phases (e.g., proposing pagination when Phase 4 decided infinite scroll).
**Why it happens:** Skipping `load_prior_context` step or not feeding prior decisions into proposal generation.
**How to avoid:** Always load and parse prior CONTEXT.md files. Annotate proposals with prior decisions: "(You chose X in Phase N — keeping consistent)". When a prior decision applies, pre-select the consistent answer.
**Warning signs:** User has to manually override proposals to match their earlier decisions.

### Pitfall 6: Workflow Size Bloat
**What goes wrong:** autonomous.md balloons from 245 to 800+ lines, becoming hard to maintain and consuming excessive context window.
**Why it happens:** Duplicating entire discuss-phase.md logic instead of adapting the essential patterns.
**How to avoid:** Keep smart discuss steps focused on the differential — what's DIFFERENT from discuss-phase (proposal tables, batch acceptance). Reference discuss-phase patterns by description, not by copying 100+ lines of examples. Target ~450-500 total lines for autonomous.md.
**Warning signs:** autonomous.md exceeds 600 lines; steps have redundant examples.

## Code Examples

### Example 1: Modified execute_phase Step 3a (replacing Skill call)

```markdown
**3a. Smart Discuss**

Check if CONTEXT.md already exists for this phase:

\`\`\`bash
PHASE_STATE=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init phase-op ${PHASE_NUM})
\`\`\`

Parse `has_context` from JSON.

**If has_context is true:** Skip discuss — context already gathered. Display:
\`\`\`
Phase ${PHASE_NUM}: Context exists — skipping discuss.
\`\`\`

**If has_context is false:** Run smart_discuss step for this phase.

After smart_discuss completes, verify context was written:
\`\`\`bash
PHASE_STATE=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init phase-op ${PHASE_NUM})
\`\`\`
Check `has_context`. If false → handle_blocker: "Smart discuss for phase ${PHASE_NUM} did not produce CONTEXT.md."
```

### Example 2: Smart Discuss Step Structure

```markdown
<step name="smart_discuss">

## Smart Discuss

For the current phase, resolve grey areas by proposing answers and letting the user accept or override.

**Step 1: Load context**
Read PROJECT.md, REQUIREMENTS.md, STATE.md, and all prior CONTEXT.md files (same as discuss-phase load_prior_context).

**Step 2: Scout codebase**
Check .planning/codebase/*.md for maps. If none, targeted grep for phase-relevant terms (same as discuss-phase scout_codebase).

**Step 3: Analyze phase**
Get phase details:
\`\`\`bash
DETAIL=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" roadmap get-phase ${PHASE_NUM})
\`\`\`
Extract goal, requirements, success criteria.

Determine domain type (SEE/CALL/RUN/READ/ORGANIZED) from the goal.
Generate 3-4 grey areas with ~4 questions each.
For each question, select a recommended answer based on:
- Prior decisions (consistency)
- Codebase patterns (reuse existing)
- Domain conventions (standard approaches)
- ROADMAP success criteria (what must be true)

**Infrastructure check:** If phase is pure infrastructure (scaffolding/plumbing/setup with only technical success criteria), skip to write minimal CONTEXT.md with Claude's Discretion for all choices.

**Step 4: Present proposals per area**
For each grey area (one at a time):

Display table:
\`\`\`
### Grey Area {M}/{N}: {Area Name}

| # | Question | ✅ Recommended | Alternative(s) |
|---|----------|---------------|-----------------|
| 1 | {question} | {answer} ({rationale}) | {alt1}; {alt2} |
| 2 | {question} | {answer} ({rationale}) | {alt1} |
| 3 | {question} | {answer} ({rationale}) | {alt1}; {alt2} |
| 4 | {question} | {answer} ({rationale}) | {alt1} |
\`\`\`

AskUserQuestion:
- header: "Area {M}/{N}"
- question: "Accept these answers for {Area Name}?"
- options: ["Accept all", "Change Q1", "Change Q2", "Change Q3", "Change Q4", "Discuss deeper"]

On "Accept all": Record answers, move to next area.
On "Change QN": AskUserQuestion with alternatives for that question → re-display updated table → re-ask acceptance.
On "Discuss deeper": Enter 4-question loop mode for this area → capture answers → re-display final table → confirm and move on.

**Step 5: Write CONTEXT.md**
After all areas resolved, write CONTEXT.md using identical format as discuss-phase write_context template.

Commit:
\`\`\`bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "docs(${PADDED_PHASE}): smart discuss context" --files "${PHASE_DIR}/${PADDED_PHASE}-CONTEXT.md"
\`\`\`

</step>
```

### Example 3: Infrastructure Phase Detection

```markdown
## Infrastructure Detection Heuristic

Parse the phase goal from ROADMAP.md. A phase is infrastructure-only when:

1. Goal keywords match: "scaffolding", "plumbing", "setup", "configuration", "migration",
   "refactor", "rename", "restructure", "upgrade", "infrastructure"
2. AND success criteria are all technical: "file exists", "test passes", "config valid",
   "command runs", "import works", "no errors"
3. AND no user-facing behavior is described (no "users can", "displays", "shows", "presents")

Example infrastructure phase:
  Goal: "Create command/workflow files and implement ROADMAP.md phase parsing"
  → All technical criteria → Skip discuss

Example non-infrastructure phase:
  Goal: "Users get proposed answers for grey areas instead of open-ended questions"
  → User-facing behavior → Needs discuss
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Multi-select grey areas + 4-question loops | Table proposals + batch acceptance per area | Phase 6 (now) | Faster user throughput — accept 4 answers in one click vs. answering 4 questions individually |
| Skill("gsd:discuss-phase") delegation | Inline smart discuss in autonomous.md | Phase 6 (now) | Tighter integration — autonomous workflow controls the UX directly |
| All areas shown at once for selection | One area at a time | Phase 6 (now) | Reduced cognitive load — user focuses on 4 questions, not 16 |

## Open Questions

1. **How many AskUserQuestion options is practical?**
   - What we know: AskUserQuestion adds "Other" automatically, so 6 explicit options + "Other" = 7 total
   - What's unclear: Whether 7 options is too many for comfortable selection in the terminal
   - Recommendation: Cap at 6 explicit options. For areas with 5+ questions, batch overflow questions under "Claude's Discretion" or add a "See more questions" option

2. **Should the "Change QN" flow loop or be one-shot?**
   - What we know: User decision says "re-show updated area summary" after change
   - What's unclear: If user changes Q1, then wants to also change Q3, does re-showing re-present the full acceptance prompt?
   - Recommendation: Yes — after any change, re-display the full table with the update highlighted, then re-present the acceptance prompt. This lets users make multiple changes before accepting.

3. **How deep should codebase scout go in autonomous mode?**
   - What we know: discuss-phase reads 3-5 most relevant files; CONTEXT.md says "essential for making good proposals"
   - What's unclear: Autonomous mode may run many phases — deep scouting per phase burns context
   - Recommendation: Check codebase maps first (fast). If none exist, targeted grep limited to 5 files max. Keep scout under ~5% context budget per phase.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node.js custom test runner (scripts/run-tests.cjs) |
| Config file | scripts/run-tests.cjs |
| Quick run command | `node scripts/run-tests.cjs` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DISC-01 | System proposes answers per grey area, one at a time | manual-only | N/A — workflow markdown, verified by human review | N/A |
| DISC-02 | Questions with recommended answers and alternatives | manual-only | N/A — output format verified by human review of CONTEXT.md | N/A |
| DISC-03 | User can accept all or change specific answers | manual-only | N/A — AskUserQuestion UX, verified by running workflow | N/A |
| DISC-04 | CONTEXT.md in same format as regular discuss-phase | smoke | Compare CONTEXT.md sections against template structure | ❌ Wave 0 |

**Justification for manual-only:** DISC-01 through DISC-03 are workflow UX behaviors — they describe how an AI agent presents information and handles user choices within a markdown workflow file. These cannot be unit-tested; they are verified by executing `gsd:autonomous` and observing the interactive behavior. DISC-04's format compliance could have a smoke test comparing output structure.

### Sampling Rate
- **Per task commit:** Manual review of autonomous.md diff
- **Per wave merge:** Run `gsd:autonomous --from N` on a test phase, verify CONTEXT.md output
- **Phase gate:** Execute smart discuss on a real phase, verify CONTEXT.md format matches discuss-phase output

### Wave 0 Gaps
- [ ] Optional: `tests/smart-discuss-format.test.cjs` — validate CONTEXT.md template has required sections (domain, decisions, code_context, specifics, deferred). Low priority since this is a workflow file, not library code.

## Sources

### Primary (HIGH confidence)
- `get-shit-done/workflows/discuss-phase.md` (675 lines) — Full source of analysis patterns, grey area identification, write_context template
- `get-shit-done/workflows/autonomous.md` (245 lines) — Current workflow structure, step layout, Skill() call pattern
- `get-shit-done/templates/context.md` — CONTEXT.md template with examples
- `.planning/phases/06-smart-discuss/06-CONTEXT.md` — User decisions for this phase
- `.planning/phases/05-skill-scaffolding-phase-discovery/05-CONTEXT.md` — Real CONTEXT.md output example
- `.planning/REQUIREMENTS.md` — DISC-01 through DISC-04 definitions
- `commands/gsd/autonomous.md` — Command frontmatter and execution_context references

### Secondary (MEDIUM confidence)
- `.planning/ROADMAP.md` — Phase goals and success criteria
- `get-shit-done/references/ui-brand.md` — Banner format patterns

### Tertiary (LOW confidence)
- None — all findings verified from project source files

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no external dependencies, all tools already exist in project
- Architecture: HIGH — workflow structure is well-established, patterns directly visible in discuss-phase.md
- Pitfalls: HIGH — derived from concrete analysis of existing workflow patterns and format requirements

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (stable — markdown workflow engineering, no external dependencies to go stale)
