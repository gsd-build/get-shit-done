# Phase 5: Skill Scaffolding & Phase Discovery - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase creates the `gsd:autonomous` command and workflow files following existing project conventions, and implements ROADMAP.md phase discovery so the workflow can determine which phases to execute. No execution logic beyond phase discovery — the actual discuss/plan/execute chaining comes in Phases 6-8.
</domain>

<decisions>
## Implementation Decisions

### Command Interface Design
- Command name: `gsd:autonomous` (installer generates `gsd-autonomous` skill automatically)
- Single optional flag: `[--from N]` to resume from a specific phase number
- No `--dry-run` flag — ROADMAP.md and `/gsd-progress` already serve this purpose
- No skip flags (`--skip-discuss`, `--skip-validation`) — autonomous means autonomous; use individual commands for granular control
- Minimal argument-hint: `"[--from N]"`

### Phase Discovery Strategy
- Initial discovery: Use `gsd-tools.cjs roadmap analyze` for full ROADMAP parse (returns all phases + status as JSON)
- Per-phase details: Use `gsd-tools.cjs roadmap get-phase N` to get goal, requirements, success criteria
- Re-read ROADMAP.md after each phase completes to catch decimal phases (2.1) inserted mid-execution
- Skip completed phases automatically — only iterate phases with incomplete status
- On phase blocker: Pause and ask user — offer "Fix and retry" / "Skip this phase" / "Stop autonomous mode"

### Delegation Pattern
- Use `Skill()` flat calls (not `Task()`) for invoking discuss/plan/execute — avoids nesting issue #686
- Build own orchestration loop — do NOT reuse existing `--auto` chain mechanism (would lose control)
- Single monolithic workflow file — matches existing patterns (new-milestone.md, execute-phase.md)
- Read STATE.md fresh before each phase — don't cache state in-workflow

### Progress Reporting
- GSD branded banner with milestone progress between phases: `GSD ► AUTONOMOUS ▸ Phase 6/8: [Name] [████░░░░] 75%`
- Show milestone-level progress bar (completed/total phases + percentage)
- Brief transition summaries: "Phase 5 ✅ → Phase 6: Smart Discuss" with 1-line outcome
- No elapsed time tracking — user watches in real-time

### Claude's Discretion
- Exact YAML frontmatter fields for `commands/gsd/autonomous.md` (follow existing patterns)
- Workflow internal section names and XML structure
- ROADMAP parsing implementation details (how to extract phase lists from JSON)
- Error message wording for edge cases
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `gsd-tools.cjs roadmap analyze` — Full ROADMAP parse, returns JSON with all phases and statuses
- `gsd-tools.cjs roadmap get-phase N` — Single phase extraction as JSON
- `gsd-tools.cjs init phase-op N` — Phase operation bootstrap
- `gsd-tools.cjs init milestone-op` — Milestone-level bootstrap
- `gsd-tools.cjs config-get/config-set` — Config management

### Established Patterns
- **Command file structure:** YAML frontmatter (name, description, argument-hint, allowed-tools) + XML sections (objective, execution_context, context, process, success_criteria)
- **Workflow file structure:** `<purpose>`, `<required_reading>`, `<process>` with numbered steps
- **Skill() invocation:** `Skill(skill="gsd:command-name", args="arguments")` for flat chaining
- **Banner format:** `━━━ GSD ► [ACTION] ━━━` with subtext
- **Init pattern:** `INIT=$(node "..." init {type} "{arg}")` at start of every workflow

### Integration Points
- Commands live in `commands/gsd/` — installer reads these to generate skills
- Workflows live in `get-shit-done/workflows/` — referenced by `@~/.claude/get-shit-done/workflows/*.md` or runtime equivalent
- `execution_context` references use `@` prefix with runtime-resolved paths
- Existing auto-advance chain: `discuss → plan → execute → transition` (each calls next via Skill)
</code_context>

<specifics>
## Specific References
- `discuss-phase.md:622` — `Skill(skill="gsd:plan-phase", args="${PHASE} --auto")` — flat chaining pattern
- `plan-phase.md:480` — `Skill(skill="gsd:execute-phase", args="${PHASE} --auto --no-transition")` — flat chaining
- `execute-phase.md:30-33` — Auto chain flag sync pattern
- `new-milestone.md` — Full orchestrator command example (questioning → research → requirements → roadmap)
- Issue #686 — Why `Skill()` instead of `Task()` for chaining (nesting freezes)
</specifics>

<deferred>
## Deferred Ideas
- Integration with `gsd-verify-work` for user acceptance testing (Phase 7-8)
- Smart discuss grey area proposal logic (Phase 6)
- Multi-phase orchestration loop with audit/complete/cleanup (Phase 8)
</deferred>
