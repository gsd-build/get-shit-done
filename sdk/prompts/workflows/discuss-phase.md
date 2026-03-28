<purpose>
Extract implementation decisions that downstream agents need. Analyze the phase to identify gray areas and capture decisions that guide research and planning.
Headless SDK variant — in autonomous mode, AI self-discusses by analyzing available context and making decisions based on project artifacts and codebase patterns.
</purpose>

<downstream_awareness>
**CONTEXT.md feeds into:**

1. **Researcher** — Reads CONTEXT.md to know WHAT to research
   - Locked decisions guide research focus
   - Discretion areas get options explored

2. **Planner** — Reads CONTEXT.md to know WHAT decisions are locked
   - Locked decisions become non-negotiable plan constraints
   - Discretion areas allow planner flexibility
</downstream_awareness>

<philosophy>
In headless mode, the AI acts as both visionary and builder. It:
- Analyzes the phase goal and available context
- Identifies gray areas that need decisions
- Makes autonomous decisions based on codebase patterns, requirements, and best practices
- Documents decisions clearly for downstream agents
</philosophy>

<scope_guardrail>
The phase boundary comes from the roadmap and is FIXED. Discussion clarifies HOW to implement what's scoped, never WHETHER to add new capabilities.

When analysis suggests scope creep: note it in "Deferred Ideas" section, do not act on it.
</scope_guardrail>

<process>

<step name="initialize" priority="first">
Load phase context from injected context files. Extract: phase directory, phase number, phase name, has_research, has_context, has_plans.

If phase not found: report error via event stream.
</step>

<step name="check_existing">
If CONTEXT.md already exists: load it and use as-is (in headless mode, existing context is not re-discussed).
If no CONTEXT.md: proceed to analysis.
</step>

<step name="load_prior_context">
Read project-level and prior phase context:
- PROJECT.md — vision, principles, non-negotiables
- REQUIREMENTS.md — acceptance criteria, constraints
- STATE.md — current progress, decisions
- Prior CONTEXT.md files — locked preferences from earlier phases
</step>

<step name="analyze_phase">
Analyze the phase to identify gray areas:

1. **Domain boundary** — What capability is this phase delivering?
2. **Check prior decisions** — What's already decided from earlier phases?
3. **Gray areas by category** — For each relevant category, identify 1-2 specific ambiguities
4. **Auto-resolve each gray area** — Make decisions based on:
   - Codebase patterns (existing conventions)
   - Prior phase decisions (consistency)
   - Requirements (constraints)
   - Best practices (industry standard)
5. **Log each decision** with rationale
</step>

<step name="write_context">
Create CONTEXT.md capturing decisions made:

```markdown
# Phase [X]: [Name] - Context

**Gathered:** [date]
**Status:** Ready for planning
**Source:** AI self-discuss (headless mode)

## Phase Boundary
[Clear statement of what this phase delivers]

## Implementation Decisions
### [Category]
- **D-01:** [Decision] — Rationale: [why]

### AI Discretion
[Areas where AI had flexibility and chose approach]

## Existing Code Insights
### Reusable Assets
- [Component/hook/utility]: [How it could be used]

### Established Patterns
- [Pattern]: [How it constrains/enables this phase]

## Specific Ideas
[Any particular approaches derived from codebase analysis]

## Deferred Ideas
[Ideas that came up but belong in other phases]
```
</step>

</process>

<success_criteria>
- Phase validated against roadmap
- Prior context loaded and honored
- Gray areas identified and resolved autonomously
- CONTEXT.md captures actual decisions with rationale
- Scope maintained (no creep into deferred ideas)
</success_criteria>
