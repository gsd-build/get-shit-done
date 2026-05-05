# Phase 1: Schema & Config - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-28
**Phase:** 01-schema-config
**Areas discussed:** Finding format, Section structure, Config namespace, Template delivery

---

## Finding Format

| Option | Description | Selected |
|--------|-------------|----------|
| Inline tags | Bullet with severity tag prefix, grep-friendly, matches existing inline markers | ✓ |
| Table format | Markdown table with Severity, Description, Evidence, Mitigation columns | |
| Structured entries | YAML-like blocks with labeled fields (severity, description, evidence, etc.) | |

**User's choice:** Inline tags
**Notes:** Chosen for grep-friendliness and consistency with existing GSD marker patterns

| Option | Description | Selected |
|--------|-------------|----------|
| All four required | Severity, title, evidence (file:line), mitigation — every finding must be specific | ✓ |
| Evidence required, mitigation optional | Evidence always required, mitigation can be omitted for WATCH-level | |
| Both optional | Only severity and title required | |

**User's choice:** All four required
**Notes:** Forces the creator agent to be specific rather than vague

---

## Section Structure

| Option | Description | Selected |
|--------|-------------|----------|
| Flat sections | Six independent H2 sections in fixed order, predictable and grep-friendly | ✓ |
| Grouped by subsystem | Organized by code area with finding-type sub-sections per subsystem | |
| Hybrid | Flat by default, subsystem sub-headers when section exceeds 10+ findings | |

**User's choice:** Flat sections
**Notes:** User requested elaboration on pros/cons before deciding. Chose flat sections for predictability and consistency with existing GSD document patterns.

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal extras | process_name, created_date, finding_counts alongside required fields | ✓ |
| Rich metadata | Above plus key_paths, related_processes, last_refreshed_by | |
| Just the two required | Only last_analyzed_commit and block_mode | |

**User's choice:** Minimal extras
**Notes:** Gives sme.list useful metadata without over-indexing

---

## Config Namespace

| Option | Description | Selected |
|--------|-------------|----------|
| Split namespace | Feature flag at workflow.use_sme_agents, SME behavior under sme.* | ✓ |
| All under workflow.* | Everything under workflow.* — simpler but crowded namespace | |
| All under sme.* | Everything under sme.* including feature flag — clean but breaks toggle convention | |

**User's choice:** Split namespace
**Notes:** Keeps workflow.* for on/off toggles, sme.* for SME-specific behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Register now | Add all config keys (static + dynamic pattern) in Phase 1 | ✓ |
| Defer to later phase | Only register workflow.use_sme_agents and sme.blocking now | |

**User's choice:** Register now
**Notes:** Prevents config-set rejections when users try to set per-process modes early

---

## Template Delivery

| Option | Description | Selected |
|--------|-------------|----------|
| Stdout output | Print blank template to stdout, caller writes to path | ✓ |
| Write to path | Write directly to specified path with --path flag | |
| Interactive | Prompt for process name, write with pre-filled frontmatter | |

**User's choice:** Stdout output
**Notes:** Simplest, most Unix-y approach

| Option | Description | Selected |
|--------|-------------|----------|
| Commented examples | HTML-commented example findings per section, stripped when filled | ✓ |
| Blank skeleton | Placeholder text only | |
| Real examples | Non-commented examples marked as EXAMPLE | |

**User's choice:** Commented examples
**Notes:** Guides creator agent on expected format without polluting output

---

## Claude's Discretion

- Process Overview section depth and prose style
- Exact wording of placeholder text in template sections
- Whether finding_counts uses nested YAML or flat keys

## Deferred Ideas

None — discussion stayed within phase scope
