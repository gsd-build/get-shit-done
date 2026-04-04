---
name: gsd:scan
description: Rapid codebase assessment using a single mapper agent. Lighter than /gsd-map-codebase.
argument-hint: "[--focus tech|arch|quality|concerns]"
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
  - Write
  - Task
---

<objective>
Perform a rapid, focused codebase assessment by spawning a single gsd-codebase-mapper agent for one focus area.

**Default focus:** `tech+arch` (produces STACK.md, INTEGRATIONS.md, ARCHITECTURE.md, STRUCTURE.md)

Use `--focus` to target a specific area:
- `tech` — STACK.md, INTEGRATIONS.md
- `arch` — ARCHITECTURE.md, STRUCTURE.md
- `quality` — CONVENTIONS.md, TESTING.md
- `concerns` — CONCERNS.md

**Scan vs map-codebase:** Scan spawns 1 agent for 1 focus area. Map-codebase spawns 4 parallel agents covering all 7 documents. Use scan for quick targeted assessment; use map-codebase for comprehensive coverage.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/scan.md
</execution_context>

<context>
Arguments: $ARGUMENTS (parsed for --focus flag)

**Load project state if exists:**
Check for .planning/STATE.md - loads context if project already initialized.

**This command can run:**
- Before or after /gsd-new-project
- Anytime to quickly assess or refresh understanding of a specific codebase area
- As a lighter alternative to /gsd-map-codebase when full coverage is not needed
</context>

<when_to_use>
**Use scan for:**
- Quick snapshot of one area (e.g., just the tech stack)
- Rapid orientation in a new codebase
- Refreshing a specific focus area without remapping everything
- When context budget is tight and full map-codebase is too expensive

**Use map-codebase instead for:**
- Comprehensive coverage across all 7 documents
- Initial brownfield project setup (need full picture)
- Before major architecture decisions (need concerns + quality too)
</when_to_use>

<process>
1. Parse `--focus` from arguments (default: `tech+arch`)
2. Validate focus value against allowed list: tech, arch, quality, concerns, tech+arch
3. Check if .planning/codebase/ already has documents for the target focus area
4. Create .planning/codebase/ directory if needed
5. Spawn one gsd-codebase-mapper agent with the resolved focus
6. Verify output documents exist with line counts
7. Run secret scan on output files
8. Commit codebase documents
9. Display summary with files written and next steps
</process>

<success_criteria>
- [ ] .planning/codebase/ directory exists
- [ ] Target documents written for the selected focus area
- [ ] Documents have substantive content (>20 lines each)
- [ ] No secrets detected in output files
- [ ] User sees summary of what was produced and next steps
</success_criteria>
