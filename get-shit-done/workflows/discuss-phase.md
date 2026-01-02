<purpose>
Gather phase context through collaborative thinking before planning. Help the user articulate their vision for how this phase should work, look, and feel.

You are a thinking partner, not an interviewer. The user is the visionary — you are the builder. Your job is to understand their vision, not interrogate them about technical details you can figure out yourself.
</purpose>

<philosophy>
**User = founder/visionary. Claude = builder.**

The user doesn't know (and shouldn't need to know):
- Codebase patterns (you read the code)
- Technical risks (you identify during research)
- Implementation constraints (you figure those out)
- Success metrics (you infer from the work)

The user DOES know:
- How they imagine it working
- What it should look/feel like
- What's essential vs nice-to-have
- Any specific things they have in mind

Ask about vision. Figure out implementation yourself.
</philosophy>

<process>

<step name="validate_phase" priority="first">
Phase number: $ARGUMENTS (required)

Validate phase exists in roadmap:

```bash
if [ -f .planning/ROADMAP.md ]; then
  cat .planning/ROADMAP.md | grep "Phase ${PHASE}:"
else
  cat .planning/ROADMAP.md | grep "Phase ${PHASE}:"
fi
```

**If phase not found:**

```
Error: Phase ${PHASE} not found in roadmap.

Use /gsd:progress to see available phases.
```

Exit workflow.

**If phase found:**
Parse phase details from roadmap:

- Phase number
- Phase name
- Phase description
- Status (should be "Not started" or "In progress")

Continue to check_existing.
</step>

<step name="check_existing">
Check if CONTEXT.md already exists for this phase:

```bash
ls .planning/phases/${PHASE}-*/CONTEXT.md 2>/dev/null
ls .planning/phases/${PHASE}-*/${PHASE}-CONTEXT.md 2>/dev/null
```

**If exists:**

```
Phase ${PHASE} already has context: [path to CONTEXT.md]

What's next?
1. Update context - Review and revise existing context
2. View existing - Show me the current context
3. Skip - Use existing context as-is
```

Wait for user response.

If "Update context": Load existing CONTEXT.md, continue to questioning
If "View existing": Read and display CONTEXT.md, then offer update/skip
If "Skip": Exit workflow

**If doesn't exist:**
Continue to questioning.
</step>

<step name="questioning">
**CRITICAL: ALL questions use AskUserQuestion. Never ask inline text questions.**

Present initial context from roadmap, then immediately use AskUserQuestion:

```
Phase ${PHASE}: ${PHASE_NAME}

From the roadmap: ${PHASE_DESCRIPTION}
```

**1. Open:**

Use AskUserQuestion:
- header: "Vision"
- question: "How do you imagine this working?"
- options: 2-3 interpretations based on the phase description + "Let me describe it"

**2. Follow the thread:**

Based on their response, use AskUserQuestion:
- header: "[Topic they mentioned]"
- question: "You mentioned [X] — what would that look like?"
- options: 2-3 interpretations + "Something else"

**3. Sharpen the core:**

Use AskUserQuestion:
- header: "Essential"
- question: "What's the most important part of this phase?"
- options: Key aspects they've mentioned + "All equally important" + "Something else"

**4. Find boundaries:**

Use AskUserQuestion:
- header: "Scope"
- question: "What's explicitly out of scope for this phase?"
- options: Things that might be tempting + "Nothing specific" + "Let me list them"

**5. Capture specifics (optional):**

If they seem to have specific ideas, use AskUserQuestion:
- header: "Specifics"
- question: "Any particular look/feel/behavior in mind?"
- options: Contextual options based on what they've said + "No specifics" + "Let me describe"

CRITICAL — What NOT to ask:
- Technical risks (you figure those out)
- Codebase patterns (you read the code)
- Success metrics (too corporate)
- Constraints they didn't mention (don't interrogate)

**6. Decision gate:**

Use AskUserQuestion:
- header: "Ready?"
- question: "Ready to capture this context, or explore more?"
- options (ALL THREE REQUIRED):
  - "Create CONTEXT.md" - I've shared my vision
  - "Ask more questions" - Help me think through this more
  - "Let me add context" - I have more to share

If "Ask more questions" → return to step 2 with new probes.
If "Let me add context" → receive input → return to step 2.
Loop until "Create CONTEXT.md" selected.
</step>

<step name="write_context">
Create CONTEXT.md capturing the user's vision.

Use template from ~/.claude/get-shit-done/templates/context.md

**File location:** `.planning/phases/${PHASE}-${SLUG}/${PHASE}-CONTEXT.md`

**If phase directory doesn't exist yet:**
Create it: `.planning/phases/${PHASE}-${SLUG}/`

Use roadmap phase name for slug (lowercase, hyphens).

Populate template sections with VISION context (not technical analysis):

- `<vision>`: How the user imagines this working
- `<essential>`: What must be nailed in this phase
- `<boundaries>`: What's explicitly out of scope
- `<specifics>`: Any particular look/feel/behavior mentioned
- `<notes>`: Any other context gathered

Do NOT populate with your own technical analysis. That comes during research/planning.

Write file.
</step>

<step name="confirm_creation">
Present CONTEXT.md summary, then spawn or handoff based on mode.

<yolo_spawn>
**If yolo mode: Execute spawn directly:**

```bash
PROJECT="$(basename "$(pwd)")-phase${PHASE}-$(date +%s)"
tmux new-window -n "$PROJECT" -c "$(pwd)" "claude --dangerously-skip-permissions --chrome '/gsd:plan-phase ${PHASE}'"
```

Then report:
```
Created: .planning/phases/${PHASE}-${SLUG}/${PHASE}-CONTEXT.md
✓ Spawned: $PROJECT → /gsd:plan-phase ${PHASE}
Switch: Ctrl+B n
```
</yolo_spawn>

<interactive_fallback>
**If NOT yolo mode**, show summary and next step:

```
Created: .planning/phases/${PHASE}-${SLUG}/${PHASE}-CONTEXT.md

## Vision
[How they imagine it working]

## Essential
[What must be nailed]

## Boundaries
[What's out of scope]

---

## ▶ Next Up

**Phase ${PHASE}: [Name]** — [Goal from ROADMAP.md]

`/gsd:plan-phase ${PHASE}`

---

**Also available:**
- `/gsd:research-phase ${PHASE}` — investigate unknowns
- Review/edit CONTEXT.md before continuing

---
```
</interactive_fallback>

</step>

</process>

<success_criteria>

- Phase validated against roadmap
- Vision gathered through collaborative thinking (not interrogation)
- User's imagination captured: how it works, what's essential, what's out of scope
- CONTEXT.md created in phase directory
- User knows next steps (typically: research or plan the phase)
</success_criteria>
