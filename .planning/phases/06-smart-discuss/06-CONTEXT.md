# Phase 6: Smart Discuss - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase adds smart discuss logic to the autonomous workflow — replacing the interactive per-question grey area resolution with batch proposal + acceptance per area. The output is identical CONTEXT.md format so downstream agents (researcher, planner) work unchanged.
</domain>

<decisions>
## Implementation Decisions

### Answer Proposal Mechanism
- Logic lives inside `get-shit-done/workflows/autonomous.md` — a new step/section within the existing workflow
- Reuses same analysis logic as discuss-phase: `analyze_phase` + `scout_codebase` patterns — analyzes phase goal, codebase, prior decisions, ROADMAP to identify grey areas
- Generates 3-4 grey areas with ~4 questions each, pre-selecting recommended answers with rationale
- Presents proposals in **table format per area** — question, recommended answer (✅), and 1-2 alternatives
- No confidence levels — present ALL proposals equally, user always has control
- Areas presented one at a time for focused review

### User Acceptance UX
- **Per-area batch acceptance** — "Accept all answers for this area?" with option to change specific ones
- If user wants to change: AskUserQuestion for the specific question with alternatives, then re-show updated area summary
- If user wants deeper discussion: switch to interactive per-question mode for that area (like regular discuss-phase)
- Show updated table with final answers before moving to next area
- Pattern: present area → accept/change → confirm → next area

### CONTEXT.md Output & Integration
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
</decisions>

<code_context>
## Existing Code Insights

### Reusable Patterns from discuss-phase.md
- `analyze_phase` step (line 267-297): Domain boundary analysis, grey area identification by category, code context annotations
- `scout_codebase` step (line 225-264): Lightweight codebase scan, codebase maps check, targeted grep
- `present_gray_areas` step (line 299-370): Multi-select presentation with prior decision annotations
- `discuss_areas` step (line 373-436): 4-question loops with AskUserQuestion
- `write_context` step (line 439+): CONTEXT.md template with domain, decisions, code_context, specifics, deferred sections

### Key Patterns to Follow
- Grey areas depend on domain: SEE → layout; CALL → interface; RUN → output; READ → structure; ORGANIZED → criteria
- Prior decisions annotated: "You decided X in Phase N — revisit or keep?"
- Code context annotated: "Card component exists with shadow/rounded variants"
- "You decide" option maps to Claude's Discretion in CONTEXT.md

### Integration Points
- `autonomous.md` workflow already exists (Phase 5) with phase discovery and Skill() calls
- Smart discuss replaces the `Skill(skill="gsd:discuss-phase")` call with inline logic
- CONTEXT.md path follows convention: `{phase_dir}/{padded_phase}-CONTEXT.md`
</code_context>

<specifics>
## Specific References
- `discuss-phase.md:322` — "Highlight the recommended choice with brief explanation why"
- `discuss-phase.md:390` — "2-3 concrete choices, with the recommended choice highlighted"
- `discuss-phase.md:398` — "'You decide' as option → Claude's Discretion"
- `discuss-phase.md:478-479` — Claude's Discretion section in CONTEXT.md
- Phase 5 context — Skill() flat calls, single monolithic workflow
</specifics>

<deferred>
## Deferred Ideas
- Confidence-level marking for proposals (was considered, decided against for simplicity)
- Automatic answer generation without any user confirmation (fully autonomous — too risky)
</deferred>
