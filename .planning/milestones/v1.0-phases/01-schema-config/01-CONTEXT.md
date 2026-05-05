# Phase 1: Schema & Config - Context

**Gathered:** 2026-04-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Define the SME document contract (schema, sections, frontmatter, finding format) and the config feature flags that gate all SME functionality. This phase produces the stable interface that all downstream phases (creator, auditor, gate, refresh) read and write against. No agent logic, no workflow integration — just the document format and config keys.

</domain>

<decisions>
## Implementation Decisions

### Finding Format
- **D-01:** Findings use inline severity tags as bullet prefixes: `- [BLOCKER] **Title** — Description` with `*Evidence:*` and `*Mitigation:*` as italic sub-fields on continuation lines
- **D-02:** All four fields are required for every finding: severity tag, bold title, evidence (file:line reference), and mitigation. No optional fields — forces the creator agent to be specific

### Section Structure
- **D-03:** SME documents use six flat H2 sections in fixed order: Process Overview (prose), Identified Risks, Test Gaps, Outdated Logic, Edge Cases, Known Blockers. No subsystem grouping — findings are organized by type, not by code area
- **D-04:** Frontmatter includes five fields: `process_name`, `last_analyzed_commit`, `block_mode` (soft|strict), `created_date`, and `finding_counts` (blocker/warning/watch tallies). This gives `sme.list` useful metadata without reading the document body

### Config Namespace
- **D-05:** Feature flag lives at `workflow.use_sme_agents` (consistent with other workflow toggles like `workflow.code_review`). SME behavior settings live under a new `sme.*` top-level namespace
- **D-06:** Phase 1 registers all config keys upfront: `workflow.use_sme_agents` (static), `sme.blocking` (static), and `sme.processes.{name}.block_mode` (dynamic pattern in config-schema.cjs). Per-process override logic is wired in later phases but the keys are valid from day one

### Template Delivery
- **D-07:** `gsd-tools template sme` outputs the blank template to stdout. The template file lives at `get-shit-done/templates/sme.md`. Caller captures and writes to the target path
- **D-08:** Template includes HTML-commented example findings per section (`<!-- [BLOCKER] **Example** — ... -->`). Comments guide the creator agent on expected format and are stripped when filled in

### Claude's Discretion
- Process Overview section depth and prose style
- Exact wording of placeholder text in template sections
- Whether finding_counts in frontmatter uses nested YAML or flat keys (e.g., `finding_counts.blocker` vs `blocker_count`)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Config System
- `get-shit-done/bin/lib/config-schema.cjs` — Single source of truth for valid config key paths; adding keys here without docs fails parity test
- `get-shit-done/bin/lib/config.cjs` — Config loading, defaults, and mutation via atomic writes
- `sdk/src/query/config-query.ts` — Config get/set query handlers
- `sdk/src/config.ts` — TypeScript config types and defaults

### Document Patterns
- `get-shit-done/bin/lib/frontmatter.cjs` — YAML frontmatter extraction and mutation (used by all planning documents)
- `get-shit-done/templates/spec.md` — Example of existing template with structured sections and frontmatter
- `get-shit-done/references/agent-contracts.md` — Agent completion markers and handoff schemas (SME auditor markers will be registered here in Phase 5)

### Template System
- `get-shit-done/bin/lib/template.cjs` — Existing template select/fill operations
- `get-shit-done/bin/lib/commands.cjs` — Command registration (template sme needs to be added)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `frontmatter.cjs`: YAML frontmatter extraction/reconstruction — use for parsing SME frontmatter fields
- `config-schema.cjs`: VALID_CONFIG_KEYS set + DYNAMIC_KEY_PATTERNS array — add `sme.blocking` to static set and `sme.processes.{name}.block_mode` as dynamic pattern
- `template.cjs`: Template select/fill infrastructure — extend with a `sme` template type
- `config.cjs`: Atomic config mutation — reuse for `sme.*` key writes

### Established Patterns
- All config toggles follow `workflow.{feature}: boolean` pattern (e.g., `workflow.code_review`, `workflow.ui_phase`)
- Dynamic config patterns use `{ topLevel, test: (k) => regex, description }` objects in DYNAMIC_KEY_PATTERNS
- Templates stored in `get-shit-done/templates/{name}.md` and referenced by template commands
- All planning documents use YAML frontmatter + markdown body with H2 sections

### Integration Points
- `config-schema.cjs` VALID_CONFIG_KEYS set: add `workflow.use_sme_agents` and `sme.blocking`
- `config-schema.cjs` DYNAMIC_KEY_PATTERNS array: add `sme.processes.{name}.block_mode` pattern
- `get-shit-done/templates/`: add `sme.md` template file
- `commands.cjs` or `template.cjs`: add `template sme` command handler
- `.planning/smes/` directory: new directory for SME documents (created on first use)

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-schema-config*
*Context gathered: 2026-04-28*
