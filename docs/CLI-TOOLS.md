# GSD CLI Tools Reference

> Programmatic API reference for `gsd-tools.cjs`. Used by workflows and agents internally. For user-facing commands, see [Command Reference](COMMANDS.md).

---

## Overview

`gsd-tools.cjs` is a Node.js CLI utility that replaces repetitive inline bash patterns across GSD's ~50 command, workflow, and agent files. It centralizes: config parsing, model resolution, phase lookup, git commits, summary verification, state management, and template operations.

**Location:** `get-shit-done/bin/gsd-tools.cjs`
**Modules:** 15 domain modules in `get-shit-done/bin/lib/`

**Usage:**
```bash
node gsd-tools.cjs <command> [args] [--raw] [--cwd <path>]
```

**Global Flags:**
| Flag | Description |
|------|-------------|
| `--raw` | Machine-readable output (JSON or plain text, no formatting) |
| `--cwd <path>` | Override working directory (for sandboxed subagents) |

---

## State Commands

Manage `.planning/STATE.md` — the project's living memory.

```bash
# Load full project config + state as JSON
node gsd-tools.cjs state load

# Output STATE.md frontmatter as JSON
node gsd-tools.cjs state json

# Update a single field
node gsd-tools.cjs state update <field> <value>

# Get STATE.md content or a specific section
node gsd-tools.cjs state get [section]

# Batch update multiple fields
node gsd-tools.cjs state patch --field1 val1 --field2 val2

# Increment plan counter
node gsd-tools.cjs state advance-plan

# Record execution metrics
node gsd-tools.cjs state record-metric --phase N --plan M --duration Xmin [--tasks N] [--files N]

# Recalculate progress bar
node gsd-tools.cjs state update-progress

# Add a decision
node gsd-tools.cjs state add-decision --summary "..." [--phase N] [--rationale "..."]
# Or from files:
node gsd-tools.cjs state add-decision --summary-file path [--rationale-file path]

# Add/resolve blockers
node gsd-tools.cjs state add-blocker --text "..."
node gsd-tools.cjs state resolve-blocker --text "..."

# Record session continuity
node gsd-tools.cjs state record-session --stopped-at "..." [--resume-file path]
```

### State Snapshot

Structured parse of the full STATE.md:

```bash
node gsd-tools.cjs state-snapshot
```

Returns JSON with: current position, phase, plan, status, decisions, blockers, metrics, last activity.

---

## Phase Commands

Manage phases — directories, numbering, and roadmap sync.

```bash
# Find phase directory by number
node gsd-tools.cjs find-phase <phase>

# Calculate next decimal phase number for insertions
node gsd-tools.cjs phase next-decimal <phase>

# Append new phase to roadmap + create directory
node gsd-tools.cjs phase add <description>

# Insert decimal phase after existing
node gsd-tools.cjs phase insert <after> <description>

# Remove phase, renumber subsequent
node gsd-tools.cjs phase remove <phase> [--force]

# Mark phase complete, update state + roadmap
node gsd-tools.cjs phase complete <phase>

# Index plans with waves and status
node gsd-tools.cjs phase-plan-index <phase>

# List phases with filtering
node gsd-tools.cjs phases list [--type planned|executed|all] [--phase N] [--include-archived]
```

---

## Roadmap Commands

Parse and update `ROADMAP.md`.

```bash
# Extract phase section from ROADMAP.md
node gsd-tools.cjs roadmap get-phase <phase>

# Full roadmap parse with disk status
node gsd-tools.cjs roadmap analyze

# Update progress table row from disk
node gsd-tools.cjs roadmap update-plan-progress <N>
```

---

## Config Commands

Read and write `.planning/config.json`.

```bash
# Initialize config.json with defaults
node gsd-tools.cjs config-ensure-section

# Set a config value (dot notation)
node gsd-tools.cjs config-set <key> <value>

# Get a config value
node gsd-tools.cjs config-get <key>

# Set model profile
node gsd-tools.cjs config-set-model-profile <profile>
```

---

## Model Resolution

```bash
# Get model for agent based on current profile
node gsd-tools.cjs resolve-model <agent-name>
# Returns: opus | sonnet | haiku | inherit
```

Agent names: `gsd-planner`, `gsd-executor`, `gsd-phase-researcher`, `gsd-project-researcher`, `gsd-research-synthesizer`, `gsd-verifier`, `gsd-plan-checker`, `gsd-integration-checker`, `gsd-roadmapper`, `gsd-debugger`, `gsd-codebase-mapper`, `gsd-nyquist-auditor`

---

## Verification Commands

Validate plans, phases, references, and commits.

```bash
# Verify SUMMARY.md file
node gsd-tools.cjs verify-summary <path> [--check-count N]

# Check PLAN.md structure + tasks
node gsd-tools.cjs verify plan-structure <file>

# Check all plans have summaries
node gsd-tools.cjs verify phase-completeness <phase>

# Check @-refs + paths resolve
node gsd-tools.cjs verify references <file>

# Batch verify commit hashes
node gsd-tools.cjs verify commits <hash1> [hash2] ...

# Check must_haves.artifacts
node gsd-tools.cjs verify artifacts <plan-file>

# Check must_haves.key_links
node gsd-tools.cjs verify key-links <plan-file>
```

---

## Validation Commands

Check project integrity.

```bash
# Check phase numbering, disk/roadmap sync
node gsd-tools.cjs validate consistency

# Check .planning/ integrity, optionally repair
node gsd-tools.cjs validate health [--repair]
```

---

## Template Commands

Template selection and filling.

```bash
# Select summary template based on granularity
node gsd-tools.cjs template select <type>

# Fill template with variables
node gsd-tools.cjs template fill <type> --phase N [--plan M] [--name "..."] [--type execute|tdd] [--wave N] [--fields '{json}']
```

Template types for `fill`: `summary`, `plan`, `verification`

---

## Frontmatter Commands

YAML frontmatter CRUD operations on any Markdown file.

```bash
# Extract frontmatter as JSON
node gsd-tools.cjs frontmatter get <file> [--field key]

# Update single field
node gsd-tools.cjs frontmatter set <file> --field key --value jsonVal

# Merge JSON into frontmatter
node gsd-tools.cjs frontmatter merge <file> --data '{json}'

# Validate required fields
node gsd-tools.cjs frontmatter validate <file> --schema plan|summary|verification
```

---

## Scaffold Commands

Create pre-structured files and directories.

```bash
# Create CONTEXT.md template
node gsd-tools.cjs scaffold context --phase N

# Create UAT.md template
node gsd-tools.cjs scaffold uat --phase N

# Create VERIFICATION.md template
node gsd-tools.cjs scaffold verification --phase N

# Create phase directory
node gsd-tools.cjs scaffold phase-dir --phase N --name "phase name"
```

---

## Init Commands (Compound Context Loading)

Load all context needed for a specific workflow in one call. Returns JSON with project info, config, state, and workflow-specific data.

```bash
node gsd-tools.cjs init execute-phase <phase>
node gsd-tools.cjs init plan-phase <phase>
node gsd-tools.cjs init new-project
node gsd-tools.cjs init new-milestone
node gsd-tools.cjs init quick <description>
node gsd-tools.cjs init resume
node gsd-tools.cjs init verify-work <phase>
node gsd-tools.cjs init phase-op <phase>
node gsd-tools.cjs init todos [area]
node gsd-tools.cjs init milestone-op
node gsd-tools.cjs init map-codebase
node gsd-tools.cjs init progress
```

**Large payload handling:** When output exceeds ~50KB, the CLI writes to a temp file and returns `@file:/tmp/gsd-init-XXXXX.json`. Workflows check for the `@file:` prefix and read from disk:

```bash
INIT=$(node gsd-tools.cjs init execute-phase "1")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

---

## Milestone Commands

```bash
# Archive milestone
node gsd-tools.cjs milestone complete <version> [--name <name>] [--archive-phases]

# Mark requirements as complete
node gsd-tools.cjs requirements mark-complete <ids>
# Accepts: REQ-01,REQ-02 or REQ-01 REQ-02 or [REQ-01, REQ-02]
```

---

## Utility Commands

```bash
# Convert text to URL-safe slug
node gsd-tools.cjs generate-slug "Some Text Here"
# → some-text-here

# Get timestamp
node gsd-tools.cjs current-timestamp [full|date|filename]

# Count and list pending todos
node gsd-tools.cjs list-todos [area]

# Check file/directory existence
node gsd-tools.cjs verify-path-exists <path>

# Aggregate all SUMMARY.md data
node gsd-tools.cjs history-digest

# Extract structured data from SUMMARY.md
node gsd-tools.cjs summary-extract <path> [--fields field1,field2]

# Project statistics
node gsd-tools.cjs stats [json|table]

# Progress rendering
node gsd-tools.cjs progress [json|table|bar]

# Complete a todo
node gsd-tools.cjs todo complete <filename>

# UAT audit — scan all phases for unresolved items
node gsd-tools.cjs audit-uat

# Git commit with config checks
node gsd-tools.cjs commit <message> [--files f1 f2] [--amend] [--no-verify]
```

> **`--no-verify`**: Skips pre-commit hooks. Used by parallel executor agents during wave-based execution to avoid build lock contention (e.g., cargo lock fights in Rust projects). The orchestrator runs hooks once after each wave completes. Do not use `--no-verify` during sequential execution — let hooks run normally.

# Web search (requires Brave API key)
node gsd-tools.cjs websearch <query> [--limit N] [--freshness day|week|month]
```

---

## Module Architecture

| Module | File | Exports |
|--------|------|---------|
| Core | `lib/core.cjs` | `error()`, `output()`, `parseArgs()`, shared utilities |
| State | `lib/state.cjs` | All `state` subcommands, `state-snapshot` |
| Phase | `lib/phase.cjs` | Phase CRUD, `find-phase`, `phase-plan-index`, `phases list` |
| Roadmap | `lib/roadmap.cjs` | Roadmap parsing, phase extraction, progress updates |
| Config | `lib/config.cjs` | Config read/write, section initialization |
| Verify | `lib/verify.cjs` | All verification and validation commands |
| Template | `lib/template.cjs` | Template selection and variable filling |
| Frontmatter | `lib/frontmatter.cjs` | YAML frontmatter CRUD |
| Init | `lib/init.cjs` | Compound context loading for all workflows |
| Milestone | `lib/milestone.cjs` | Milestone archival, requirements marking |
| Commands | `lib/commands.cjs` | Misc: slug, timestamp, todos, scaffold, stats, websearch |
| Model Profiles | `lib/model-profiles.cjs` | Profile resolution table |
| UAT | `lib/uat.cjs` | Cross-phase UAT/verification audit |
| Profile Output | `lib/profile-output.cjs` | Developer profile formatting |
| Profile Pipeline | `lib/profile-pipeline.cjs` | Session analysis pipeline |
