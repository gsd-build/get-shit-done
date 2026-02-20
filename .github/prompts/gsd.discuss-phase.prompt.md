---
name: gsd.discuss-phase
description: "Gather phase context through adaptive questioning before planning"
argument-hint: "<phase> [--auto]"
tools: ['agent', 'edit', 'execute', 'read', 'search', 'vscode/askQuestions']
agent: agent
---

<!-- GENERATED FILE — DO NOT EDIT.
Source: commands/gsd/discuss-phase.md
Regenerate: node scripts/generate-prompts.mjs
-->

<!-- upstream-tools: ["Read","Write","Bash","Glob","Grep","AskUserQuestion","Task"] -->

## Preflight (required)

If the local GSD install does not exist in this workspace, do this **once**:

1. Check for: `./.claude/get-shit-done/`
2. If missing, run:

```bash
npx get-shit-done-cc --claude --local
```

3. Then re-run the slash command: `/gsd.discuss-phase`

---

## Copilot Runtime Adapter (important)

Upstream GSD command sources may reference an `AskUserQuestion` tool (Claude/OpenCode runtime concept).

In VS Code Copilot, **do not attempt to call a tool named `AskUserQuestion`**.
Instead, whenever the upstream instructions say "Use AskUserQuestion", use **#tool:vscode/askQuestions** with:

- Combine the **Header** and **Question** into a single clear question string.
- If the upstream instruction specifies **Options**, present them as numbered choices.
- If no options are specified, ask as a freeform question.

**Rules:**
1. If the options include "Other", "Something else", or "Let me explain", and the user selects it, follow up with a freeform question via #tool:vscode/askQuestions.
2. Follow the upstream branching and loop rules exactly as written (e.g., "if X selected, do Y; otherwise continue").
3. If the upstream flow says to **exit/stop** and run another command, tell the user to run that slash command next, then stop.
4. Use #tool:vscode/askQuestions freely — do not guess or assume user intent.

---

<objective>
Extract implementation decisions that downstream agents need — researcher and planner will use CONTEXT.md to know what to investigate and what choices are locked.

**How it works:**
1. Analyze the phase to identify gray areas (UI, UX, behavior, etc.)
2. Present gray areas — user selects which to discuss
3. Deep-dive each selected area until satisfied
4. Create CONTEXT.md with decisions that guide research and planning

**Output:** `{phase_num}-CONTEXT.md` — decisions clear enough that downstream agents can act without asking the user again
</objective>

<execution_context>
- Read file at: ../.claude/get-shit-done/workflows/discuss-phase.md
- Read file at: ../.claude/get-shit-done/templates/context.md
</execution_context>

<context>
Phase number: $ARGUMENTS (required)

**Load project state:**
- Read file at: .planning/STATE.md
**Load roadmap:**
- Read file at: .planning/ROADMAP.md
</context>

<process>
1. Validate phase number (error if missing or not in roadmap)
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

**Probing depth:**
- Ask 4 questions per area before checking
- "More questions about [area], or move to next?"
- If more → ask 4 more, check again
- After all areas → "Ready to create context?"

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
</success_criteria>
