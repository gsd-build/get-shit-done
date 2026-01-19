---
name: gsd:discuss-phase
description: Gather phase context through adaptive questioning before planning
argument-hint: "<phase>"
allowed-tools: [Read, Write, Bash, Glob, Grep, AskUserQuestion]
---

<objective>
Extract implementation decisions that downstream agents need — researcher and planner will use CONTEXT.md to know what to investigate and what choices are locked.

**How it works:**
1. Analyze the phase to identify gray areas (UI, UX, behavior, etc.)
2. Present gray areas — user selects which to discuss
3. Deep-dive each selected area until satisfied
4. Create CONTEXT.md with decisions that guide research and planning

**Output:** `{phase}-CONTEXT.md` — decisions clear enough that downstream agents can act without asking the user again
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/discuss-phase.md
@~/.claude/get-shit-done/templates/context.md
</execution_context>

<context>
Phase number: $ARGUMENTS (required)

**Load project state:**
@.planning/STATE.md

**Load roadmap:**
@.planning/ROADMAP.md
</context>

<user_documentation>
## User-Provided Documentation

**Location:** `.planning/codebase/USER-CONTEXT.md`

**Loading:** At discussion start, check for and load relevant user documentation.

```bash
if [ -f ".planning/codebase/USER-CONTEXT.md" ]; then
  cat .planning/codebase/USER-CONTEXT.md
fi
```

**If exists:**
- Extract sections relevant to current phase (via keyword matching on phase name + goal)
- Use as background context when analyzing gray areas
- Reference when asking questions ("Your docs mention X - does that still apply?")
- Note potential conflicts if user answers contradict their docs

**If missing:**
- Silent continue (no error, no suggestion to run map-codebase)
- Proceed with discussion normally

**Relevance selection by phase type:**

| Phase Keywords | Load Categories |
|----------------|-----------------|
| UI, frontend | reference, general |
| API, backend | api, architecture |
| database, schema | architecture |
| testing | reference, setup |
| setup, config | setup, reference |
| integration | api, architecture, setup |

**Conflict handling:**
When user answer contradicts their documentation:
- Note the discrepancy naturally: "Your docs describe X, but you mentioned Y - should the docs be updated, or has this changed?"
- User's current answer takes precedence (docs may be stale)
- No blocking or error - just gentle surfacing
</user_documentation>

<process>
1. Validate phase number (error if missing or not in roadmap)

1.5. **Load user documentation (if available)**

   Check for USER-CONTEXT.md:
   ```bash
   if [ -f ".planning/codebase/USER-CONTEXT.md" ]; then
     echo "User docs found - loading relevant sections"
   fi
   ```

   **If exists:** Load sections relevant to phase. Use as background context.
   **If missing:** Silent continue - proceed without user docs.

2. Check if CONTEXT.md exists (offer update/view/skip if yes)
3. **Analyze phase** — Identify domain and generate phase-specific gray areas
4. **Present gray areas** — Multi-select: which to discuss? (NO skip option)
5. **Deep-dive each area** — 4 questions per area, then offer more/next
6. **Write CONTEXT.md** — Sections match areas discussed
7. Offer next steps (research or plan)

**CRITICAL: Scope guardrail**
- Phase boundary from ROADMAP.md is FIXED
- Discussion clarifies HOW to implement, not WHETHER to add more
- If user suggests new capabilities: "That's its own phase. I'll note it for later."
- Capture deferred ideas — don't lose them, don't act on them

**Domain-aware gray areas:**
Gray areas depend on what's being built. Analyze the phase goal:
- Something users SEE → layout, density, interactions, states
- Something users CALL → responses, errors, auth, versioning
- Something users RUN → output format, flags, modes, error handling
- Something users READ → structure, tone, depth, flow
- Something being ORGANIZED → criteria, grouping, naming, exceptions

Generate 3-4 **phase-specific** gray areas, not generic categories.

**User docs integration in gray area analysis:**

If USER-CONTEXT.md was loaded:
- Check if user docs already answer some gray areas (reduce question count)
- Identify areas where user docs are unclear or potentially stale (prioritize these)
- Reference specific doc content when framing questions

Example adjustments:
- User docs specify "REST API with JSON" - don't ask about API format
- User docs unclear on auth approach - prioritize auth in gray areas
- User docs mention "Phase 1 uses X" - verify if still current

**Probing depth:**
- Ask 4 questions per area before checking
- "More questions about [area], or move to next?"
- If more → ask 4 more, check again
- After all areas → "Ready to create context?"
- Reference user docs when relevant ("Your architecture doc mentions...")
- Note if user answer differs from their docs (gentle conflict surfacing)

**Do NOT ask about (Claude handles these):**
- Technical implementation
- Architecture choices
- Performance concerns
- Scope expansion
</process>

<success_criteria>
- Gray areas identified through intelligent analysis
- User chose which areas to discuss
- Each selected area explored until satisfied
- Scope creep redirected to deferred ideas
- CONTEXT.md captures decisions, not vague vision
- User knows next steps
- User docs considered when identifying gray areas (if available)
</success_criteria>
