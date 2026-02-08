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

<depth_protocol>
## Adaptive Discussion Depth

The default "4 questions per area" is a MINIMUM, not a target. Adapt depth based on user response richness.

**Depth signals (when to go deeper):**

- **Long response:** User gives 3+ sentences → extract 2-3 threads, ask about each
- **Specific terminology:** User uses a distinctive term (not generic language) → probe: "You said '[term]' — what does that mean for you in this context? What's the opposite of that?"
- **Emotional emphasis:** User says "mega wichtig", "auf keinen Fall", "das Schlimmste" → this is a constraint with high weight. Probe the boundary: "When you say '[extreme phrase]', what would be the first sign that we've crossed that line?"
- **Abstract concept:** User describes something philosophical or abstract → ground it: "Can you give me a concrete example of what that looks like in practice?"
- **Anti-pattern named:** User says "not like X" or "never Y" → probe the spectrum: "Where's the line between acceptable and [anti-pattern]? What's a borderline case?"

**Depth execution:**

After each user response, evaluate:
1. Does this response contain specific terminology I should probe? → Ask about it
2. Does this response name an anti-pattern or constraint? → Probe the boundary
3. Does this response contain 2+ distinct ideas? → Separate and explore each
4. Is the user giving abstract philosophy? → Ground with concrete examples

The 4-question check ("More questions?") still applies, but WITHIN those 4 questions, adaptively follow the depth signals above rather than moving to pre-planned questions.

**The goal:** Every word the user speaks is essential to abstract, go deeper on, and ask more questions about. The discussion should feel like a thinking partner who genuinely understands the depth, not an interviewer checking boxes.
</depth_protocol>

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

<step name="validate_phase" priority="first">
Phase number from argument (required).

Load and validate:
- Read `.planning/ROADMAP.md`
- Find phase entry
- Extract: number, name, description, status

**If phase not found:**
```
Phase [X] not found in roadmap.

Use /gsd:progress to see available phases.
```
Exit workflow.

**If phase found:** Continue to analyze_phase.
</step>

**References loaded by this workflow:**
- `~/.claude/get-shit-done/references/adaptive-depth.md` — Depth protocol for input assessment
- `~/.claude/get-shit-done/references/intent-fidelity.md` — Intent envelope definitions

<step name="check_existing">
Check if CONTEXT.md already exists:

```bash
# Match both zero-padded (05-*) and unpadded (5-*) folders
PADDED_PHASE=$(printf "%02d" ${PHASE})
ls .planning/phases/${PADDED_PHASE}-*/*-CONTEXT.md .planning/phases/${PHASE}-*/*-CONTEXT.md 2>/dev/null
```

**If exists:**
Use AskUserQuestion:
- header: "Existing context"
- question: "Phase [X] already has context. What do you want to do?"
- options:
  - "Update it" — Review and revise existing context
  - "View it" — Show me what's there
  - "Skip" — Use existing context as-is

If "Update": Load existing, continue to analyze_phase
If "View": Display CONTEXT.md, then offer update/skip
If "Skip": Exit workflow

**If doesn't exist:** Continue to analyze_phase.
</step>

<step name="analyze_phase">
Analyze the phase to identify gray areas worth discussing.

**Load prior intent context (before generating gray areas):**

1. Read intent seed from ROADMAP.md for this phase (if exists):
   ```bash
   grep -A 10 "intent:" .planning/ROADMAP.md | head -15
   ```
   → If found, use motivation and success_looks_like to pre-inform gray areas

2. Read previous phase's HANDOFF.md (if exists):
   ```bash
   PREV_PHASE=$((PHASE - 1))
   PADDED_PREV=$(printf "%02d" $PREV_PHASE)
   cat .planning/phases/${PADDED_PREV}-*/*-HANDOFF.md 2>/dev/null
   ```
   → If found, extract "Next Phase Must Know" and "Delta" sections to understand what was built/missed

3. Read current phase's dependency chain from ROADMAP.md

Gray areas now build ON existing context (seed + handoff) instead of starting from scratch.

**Read the phase description from ROADMAP.md and determine:**

1. **Domain boundary** — What capability is this phase delivering? State it clearly.

2. **Gray areas by category** — For each relevant category (UI, UX, Behavior, Empty States, Content), identify 1-2 specific ambiguities that would change implementation.

3. **Skip assessment** — If no meaningful gray areas exist (pure infrastructure, clear-cut implementation), the phase may not need discussion.

**Output your analysis internally, then present to user.**

Example analysis for "Post Feed" phase:
```
Domain: Displaying posts from followed users
Gray areas:
- UI: Layout style (cards vs timeline vs grid)
- UI: Information density (full posts vs previews)
- Behavior: Loading pattern (infinite scroll vs pagination)
- Empty State: What shows when no posts exist
- Content: What metadata displays (time, author, reactions count)
```
</step>

<step name="present_gray_areas">
Present the domain boundary and gray areas to user.

**First, state the boundary:**
```
Phase [X]: [Name]
Domain: [What this phase delivers — from your analysis]

We'll clarify HOW to implement this.
(New capabilities belong in other phases.)
```

**Then use AskUserQuestion (multiSelect: true):**
- header: "Discuss"
- question: "Which areas do you want to discuss for [phase name]?"
- options: Generate 3-4 phase-specific gray areas, each formatted as:
  - "[Specific area]" (label) — concrete, not generic
  - [1-2 questions this covers] (description)

**Do NOT include a "skip" or "you decide" option.** User ran this command to discuss — give them real choices.

**Examples by domain:**

For "Post Feed" (visual feature):
```
☐ Layout style — Cards vs list vs timeline? Information density?
☐ Loading behavior — Infinite scroll or pagination? Pull to refresh?
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
   - header: "[Area]"
   - question: Specific decision for this area
   - options: 2-3 concrete choices (AskUserQuestion adds "Other" automatically)
   - Include "You decide" as an option when reasonable — captures Claude discretion

3. **After 4 questions, check:**
   - header: "[Area]"
   - question: "More questions about [area], or move to next?"
   - options: "More questions" / "Next area"

   If "More questions" → ask 4 more, then check again
   If "Next area" → proceed to next selected area

4. **After all areas complete:**
   - header: "Done"
   - question: "That covers [list areas]. Ready to create context?"
   - options: "Create context" / "Revisit an area"

**Question design:**
- Options should be concrete, not abstract ("Cards" not "Option A")
- Each answer should inform the next question
- If user picks "Other", receive their input, reflect it back, confirm

**Scope creep handling:**
If user mentions something outside the phase domain:
```
"[Feature] sounds like a new capability — that belongs in its own phase.
I'll note it as a deferred idea.

Back to [current area]: [return to current question]"
```

Track deferred ideas internally.
</step>

<step name="verify_depth">
Before writing CONTEXT.md, enumerate all substantive user inputs for the write step AND for the external depth check after writing.

**Process:**

1. **Enumerate all substantive user inputs** from the discussion:
   - Every AskUserQuestion response that is NOT a simple confirmation ("Ja", "Passt")
   - Every "Other" text input where user typed custom response
   - Every verbal input (voice transcription) the user provided
   - Tag each with category: Architecture Decision, Philosophy/Principle, Constraint/Anti-Pattern, Reasoning, Terminology, Reference, Preference

2. **Number each input** (INPUT-1, INPUT-2, ...) with:
   - The input content (user's exact words, abbreviated if long)
   - The category tag
   - The planned CONTEXT.md section (Decisions / Specifics / Deferred / Intent Chain)

3. **Quick self-check for critical gaps:**
   - MISSING: Input that would NOT be captured → flag for write_context
   - SHALLOW: Input where only the decision would be captured, not the reasoning → flag
   - LOST_VOICE: Input where user's exact words would be paraphrased → flag

4. **If critical gaps (MISSING):**
   - Ask 1-2 targeted follow-up questions to fill the gap
   - Then proceed to write_context

5. **If no critical gaps:** Proceed directly to write_context

**Store the numbered input list internally** — it will be passed to the external depth checker after write_context.

**This step should take 10-30 seconds.** Extraction, not audit. The real verification comes after writing.
</step>

<step name="write_context">
Create CONTEXT.md capturing decisions made.

**Find or create phase directory:**

```bash
# Match existing directory (padded or unpadded)
PADDED_PHASE=$(printf "%02d" ${PHASE})
PHASE_DIR=$(ls -d .planning/phases/${PADDED_PHASE}-* .planning/phases/${PHASE}-* 2>/dev/null | head -1)
if [ -z "$PHASE_DIR" ]; then
  # Create from roadmap name (lowercase, hyphens)
  PHASE_NAME=$(grep "Phase ${PHASE}:" .planning/ROADMAP.md | sed 's/.*Phase [0-9]*: //' | tr '[:upper:]' '[:lower:]' | tr ' ' '-')
  mkdir -p ".planning/phases/${PADDED_PHASE}-${PHASE_NAME}"
  PHASE_DIR=".planning/phases/${PADDED_PHASE}-${PHASE_NAME}"
fi
```

**File location:** `${PHASE_DIR}/${PADDED_PHASE}-CONTEXT.md`

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

<intent_chain>
## Intent Chain

- **Seed:** [motivation from ROADMAP intent seed, if exists]
- **Previous Handoff:** [key points from previous phase HANDOFF.md, if exists — "None" if first phase]
- **Discussion depth:** [N substantive inputs captured during this discussion]
- **Richness:** context (upgraded from seed)
</intent_chain>

---

*Phase: XX-name*
*Context gathered: [date]*
```

**Quality criteria for CONTEXT.md (informed by verify_depth step):**

- Every "Core Principle:" statement must carry the user's reasoning in their own words
- Every anti-pattern must include the user's language about WHY it's bad
- The `<specifics>` section must include:
  - "Founder Terminology" subsection if the user used distinctive terms (with definitions)
  - "Guiding Principles" subsection if cross-cutting principles emerged from discussion
  - "Critical Analysis Mandate" subsection if the user requested infrastructure/capability evaluation
- Deferred Ideas must capture enough context that a future phase can pick them up

Write file.
</step>

<step name="external_depth_check">
Spawn a lightweight sub-agent to verify the written CONTEXT.md against the enumerated user inputs.

**Why external:** Self-verification has confirmation bias — the same context window that wrote the document fills in gaps mentally. A separate agent with ONLY the document + input list catches what the writer missed.

**Prepare the payload (inline — @ syntax doesn't work across Task boundaries):**

```bash
CONTEXT_CONTENT=$(cat "${PHASE_DIR}/${PADDED_PHASE}-CONTEXT.md")
```

Build the numbered input list from the verify_depth step as a markdown block:

```markdown
## User Inputs from Discussion

INPUT-1: [content] | Category: [tag]
INPUT-2: [content] | Category: [tag]
...
INPUT-N: [content] | Category: [tag]
```

**Spawn sub-agent:**

```
Task(
  prompt=depth_check_prompt,
  subagent_type="general-purpose",
  model="haiku",
  description="Depth check Phase {phase}"
)
```

The prompt:

```markdown
## Depth Cross-Reference Check

You verify that a CONTEXT.md document captures all user inputs from a discussion.
You have NO access to the original discussion — only the document and the input list below.
This is intentional: you catch what the document writer missed.

### CONTEXT.md Content

{context_content}

### User Inputs to Verify

{numbered_input_list}

### Instructions

For EACH numbered input, check:

1. **Present?** Is this input reflected in CONTEXT.md? (Which section?)
2. **Deep enough?** Is the WHY/reasoning preserved, not just the decision?
3. **Voice preserved?** Are the user's exact terms used, or were they paraphrased into generic language?

### Output Format

Return ONLY this format:

```
## Depth Check: [N] inputs verified

### Gaps Found: [X]

[If gaps found:]
| Input | Gap Type | Detail |
|-------|----------|--------|
| INPUT-3 | MISSING | Not reflected anywhere in document |
| INPUT-7 | SHALLOW | Decision captured but reasoning ("because X") is missing |
| INPUT-11 | LOST_VOICE | User said "Hardening-Fact", document says "validation signal" |

### Suggested Fixes

[For each gap, one line: what to add/change and where in CONTEXT.md]

[If no gaps:]
All inputs verified. No gaps found.
```

Do NOT explain your process. Do NOT list what passed. ONLY gaps.
```

**Handle sub-agent return:**

- **No gaps:** Proceed to confirm_creation
- **Gaps found:** Apply fixes directly to CONTEXT.md (edit the file), then proceed to confirm_creation. Note in the confirmation: "External depth check found {N} gaps — fixed."

**Cost:** ~10-15k tokens with Haiku. ~15-25 seconds. Much cheaper than the full /verify-depth (70k tokens).
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
Commit phase context:

**Check planning config:**

```bash
COMMIT_PLANNING_DOCS=$(cat .planning/config.json 2>/dev/null | grep -o '"commit_docs"[[:space:]]*:[[:space:]]*[^,}]*' | grep -o 'true\|false' || echo "true")
git check-ignore -q .planning 2>/dev/null && COMMIT_PLANNING_DOCS=false
```

**If `COMMIT_PLANNING_DOCS=false`:** Skip git operations

**If `COMMIT_PLANNING_DOCS=true` (default):**

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

Confirm: "Committed: docs(${PADDED_PHASE}): capture phase context"
</step>

</process>

<success_criteria>
- Phase validated against roadmap
- Gray areas identified through intelligent analysis (not generic questions)
- User selected which areas to discuss
- Each selected area explored until user satisfied
- Scope creep redirected to deferred ideas
- CONTEXT.md captures actual decisions, not vague vision
- Deferred ideas preserved for future phases
- User knows next steps
- Depth signals detected and followed (rich responses explored, terminology probed)
- Verify-depth self-extraction completed before writing CONTEXT.md (numbered input list)
- External depth check spawned after writing CONTEXT.md (separate agent, no confirmation bias)
- Gaps from external check applied to CONTEXT.md before commit
- No substantive user input lost or shallow in final CONTEXT.md
</success_criteria>
