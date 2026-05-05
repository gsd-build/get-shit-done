# Requirements: SME Agent Framework

**Defined:** 2026-04-28
**Core Value:** The plan-phase gate: SMEs must catch domain-specific risks and pattern mismatches before code gets written.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Document Format & Schema

- [x] **SCHEMA-01**: SME documents stored in `.planning/smes/{PROCESS_NAME}-SME.md` with structured sections: process overview, identified risks, test gaps, outdated logic, edge cases, known blockers
- [x] **SCHEMA-02**: Each finding in an SME document carries a severity label: BLOCKER, WARNING, or WATCH
- [x] **SCHEMA-03**: SME document frontmatter includes `last_analyzed_commit` hash for staleness tracking
- [x] **SCHEMA-04**: SME document frontmatter includes `block_mode` field (soft | strict) configurable per-process
- [x] **SCHEMA-05**: SME document template available via `gsd-tools template sme`

### Config & Backward Compatibility

- [x] **CONFIG-01**: `workflow.use_sme_agents` config flag (default: false) gates all SME features
- [x] **CONFIG-02**: When `use_sme_agents` is false, all SME workflow steps are unconditionally skipped
- [x] **CONFIG-03**: `sme.blocking` config key controls default block mode for new SMEs (soft | strict)
- [x] **CONFIG-04**: Enabling SMEs mid-project with no existing SME documents emits a warning with `/gsd-create-sme` instructions, never blocks execution

### SME Creator Agent

- [x] **CREATE-01**: `gsd-sme-creator` agent analyzes code paths, git history, PR descriptions, comments, and docs to produce structured SME documents
- [x] **CREATE-02**: Creator uses parallel sub-agent decomposition for large process codepaths (following `gsd-map-codebase` pattern)
- [x] **CREATE-03**: Creator produces a complete `.planning/smes/{PROCESS_NAME}-SME.md` with all required sections and severity-labeled findings
- [x] **CREATE-04**: Creator captures the "why" behind patterns using `git log --follow` and PR descriptions, not just current code state

### SME Creation Command & Workflow

- [x] **CMD-01**: `/gsd-create-sme [process-name]` command creates an SME for the specified process
- [x] **CMD-02**: `/gsd-create-sme` with no arguments presents an interactive menu of detected processes
- [x] **CMD-03**: If SME already exists for the specified process, user is offered: create new or update existing
- [x] **CMD-04**: `create-sme.md` workflow orchestrates SME creation with progress indicators

### SDK Query Handlers

- [x] **SDK-01**: `sme.list` query returns all existing SME documents with metadata
- [x] **SDK-02**: `sme.detect-processes` query identifies which processes a phase touches based on file paths and phase goal keywords
- [x] **SDK-03**: `sme.context-block` query produces XML context blocks for injecting SME findings into agent prompts

### SME Auditor Agent

- [x] **AUDIT-01**: `gsd-sme-auditor` agent reviews PLAN.md against SME domain knowledge with adversarial stance ("assume domain risks ARE present until proven otherwise")
- [x] **AUDIT-02**: Auditor operates in read-only mode — never modifies implementation files
- [x] **AUDIT-03**: Auditor returns structured markers: `## SME_APPROVED` or `## SME_CONCERNS` with severity-classified findings
- [x] **AUDIT-04**: Auditor requires concrete mitigations that name file paths and function calls, not abstract patterns
- [x] **AUDIT-05**: Return markers registered in `agent-contracts.md`

### Plan-Phase Gate

- [x] **GATE-01**: Plan-phase gate runs as step 12.5 (after plan-checker, before finalization) -- implemented as step 12.6 due to existing step 12.5 conflict (Plan Bounce); positional requirement satisfied
- [x] **GATE-02**: Gate detects which processes the current phase touches via `sme.detect-processes`
- [x] **GATE-03**: Gate spawns `gsd-sme-auditor` with relevant SME document(s) and PLAN.md
- [x] **GATE-04**: In soft mode: surface concerns as warnings, allow user to proceed
- [x] **GATE-05**: In strict mode: BLOCKER findings halt plan finalization until user acknowledges or revises
- [x] **GATE-06**: User can override strict mode with `--acknowledge-sme-risk` flag
- [x] **GATE-07**: When no SME exists for a detected process, emit warning with `/gsd-create-sme` instructions — never block
- [x] **GATE-08**: SME BLOCKERs injected at the top of the gate prompt to prevent context window saturation from hiding them

### Discuss-Phase Integration

- [x] **DISCUSS-01**: Before plan-phase, check if milestone.active_smes exist in STATE.md
- [x] **DISCUSS-02**: If active SMEs exist, spawn gsd-sme-auditor with SME context to generate domain-specific probing questions
- [x] **DISCUSS-03**: Append SME insights to `{phase_num}-CONTEXT.md` under a `<sme_context>` block

### Post-Execution Refresh

- [x] **REFRESH-01**: After phase execution completes, determine which processes were affected by modified files
- [x] **REFRESH-02**: Spawn `gsd-sme-creator` in refresh mode to update affected SME documents with new code knowledge
- [x] **REFRESH-03**: Updated SME documents committed as final part of phase completion
- [x] **REFRESH-04**: Staleness pre-flight check in plan-phase gate warns if SME's `last_analyzed_commit` is behind current HEAD

### New-Milestone Process Detection

- [x] **DETECT-01**: During new-milestone setup, scan codebase to identify which processes the milestone touches
- [x] **DETECT-02**: Check if SMEs exist for detected processes in `.planning/smes/`
- [x] **DETECT-03**: If SME exists: surface it and ask user confirmation to use it
- [x] **DETECT-04**: If SME missing: offer to create one per-process (yes/no/skip all)
- [x] **DETECT-05**: Queue selected SMEs in `.planning/STATE.md` under `milestone.active_smes` array

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Token Management

- **TOKEN-01**: Show estimated token cost before SME creation begins
- **TOKEN-02**: Progressive cost tracking during SME creation with running total

### Extended Integration

- **EXT-01**: SME context injection via agent-skills for non-audit agents (planner, executor)
- **EXT-02**: `/gsd-list-smes` command with status, staleness, and finding counts
- **EXT-03**: Cross-project SME export/import for shared domain knowledge

## Out of Scope

| Feature | Reason |
|---------|--------|
| Real-time SME monitoring during execution | Conflicts with parallel worktree isolation model; pre/post gates are sufficient |
| Cross-project SME sharing | Per-project by design; global skills already handle shared context |
| SME conflict resolution when multiple SMEs disagree | Handle manually for v1; rare edge case |
| UI/dashboard for SME findings | CLI output sufficient; GSD is a CLI toolkit |
| SME for non-process concerns (e.g., style, naming) | Covered by existing conventions/linting; SMEs are for domain knowledge |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SCHEMA-01 | Phase 1 | Complete |
| SCHEMA-02 | Phase 1 | Complete |
| SCHEMA-03 | Phase 1 | Complete |
| SCHEMA-04 | Phase 1 | Complete |
| SCHEMA-05 | Phase 1 | Complete |
| CONFIG-01 | Phase 1 | Complete |
| CONFIG-02 | Phase 1 | Complete |
| CONFIG-03 | Phase 1, Phase 10 | Complete |
| CONFIG-04 | Phase 6 | Complete |
| CREATE-01 | Phase 3 | Complete |
| CREATE-02 | Phase 3 | Complete |
| CREATE-03 | Phase 3 | Complete |
| CREATE-04 | Phase 3 | Complete |
| CMD-01 | Phase 4 | Complete |
| CMD-02 | Phase 4 | Complete |
| CMD-03 | Phase 4 | Complete |
| CMD-04 | Phase 4 | Complete |
| SDK-01 | Phase 2 | Complete |
| SDK-02 | Phase 2 | Complete |
| SDK-03 | Phase 2 | Complete |
| AUDIT-01 | Phase 5 | Complete |
| AUDIT-02 | Phase 5 | Complete |
| AUDIT-03 | Phase 5 | Complete |
| AUDIT-04 | Phase 5 | Complete |
| AUDIT-05 | Phase 5 | Complete |
| GATE-01 | Phase 6 | Complete |
| GATE-02 | Phase 6 | Complete |
| GATE-03 | Phase 6 | Complete |
| GATE-04 | Phase 6 | Complete |
| GATE-05 | Phase 6 | Complete |
| GATE-06 | Phase 6 | Complete |
| GATE-07 | Phase 6 | Complete |
| GATE-08 | Phase 6 | Complete |
| DISCUSS-01 | Phase 7 | Complete |
| DISCUSS-02 | Phase 7 | Complete |
| DISCUSS-03 | Phase 7 | Complete |
| REFRESH-01 | Phase 9 | Complete |
| REFRESH-02 | Phase 9 | Complete |
| REFRESH-03 | Phase 9 | Complete |
| REFRESH-04 | Phase 9 | Complete |
| DETECT-01 | Phase 8 | Complete |
| DETECT-02 | Phase 8 | Complete |
| DETECT-03 | Phase 8 | Complete |
| DETECT-04 | Phase 8, Phase 10 | Complete |
| DETECT-05 | Phase 8, Phase 10 | Complete |

**Coverage:**
- v1 requirements: 43 total
- Mapped to phases: 43
- Unmapped: 0

**Note:** CONFIG-04 moved from Phase 1 to Phase 6 during plan revision. CONFIG-04 requires runtime workflow integration (checking for existing SME documents when `use_sme_agents` is enabled and emitting a warning). This behavior is naturally co-located with GATE-07 (identical "no SME exists" warning pattern) and requires the SDK query handlers from Phase 2 (`sme.list` to check for documents). Phase 1 provides the infrastructure (config key with `false` default) that prevents any blocking; Phase 6 implements the actual warning emission.

**Note:** CONFIG-03, DETECT-04, DETECT-05 assigned to Phase 10 (gap closure) after v1.0 milestone audit found integration gaps. CONFIG-03's config key was registered in Phase 1 but the creator agent never consumes it. DETECT-04/05 had unresolved template placeholders and missing completion marker checks in new-milestone/sme-step.md.

---
*Requirements defined: 2026-04-28*
*Last updated: 2026-05-04 after milestone audit gap closure (CONFIG-03, DETECT-04, DETECT-05 → Phase 10)*
