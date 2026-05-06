# GSD CLI Tools Reference

> Surface-area reference for `get-shit-done/bin/gsd-tools.cjs` (legacy Node CLI). Workflows and agents should prefer `gsd-sdk query` or `@gsd-build/sdk` where a handler exists — see [SDK and programmatic access](#sdk-and-programmatic-access). For slash commands and user flows, see [Command Reference](COMMANDS.md).

---

## Overview

`gsd-tools.cjs` centralizes config parsing, model resolution, phase lookup, git commits, summary verification, state management, and template operations across GSD commands, workflows, and agents.


|                    |                                                                                                                                                                                                        |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Shipped path**   | `get-shit-done/bin/gsd-tools.cjs`                                                                                                                                                                      |
| **Implementation** | 20 domain modules under `get-shit-done/bin/lib/` (the directory is authoritative)                                                                                                                        |
| **Status**         | Maintained for parity tests and CJS-only entrypoints; `gsd-sdk query` / SDK registry are the supported path for new orchestration (see [QUERY-HANDLERS.md](../sdk/src/query/QUERY-HANDLERS.md)). |


**Usage (CJS):**

```bash
node gsd-tools.cjs <command> [args] [--raw] [--cwd <path>]
```

**Global flags (CJS):**


| Flag           | Description                                                                  |
| -------------- | ---------------------------------------------------------------------------- |
| `--raw`        | Machine-readable output (JSON or plain text, no formatting)                  |
| `--cwd <path>` | Override working directory (for sandboxed subagents)                         |
| `--ws <name>`  | Workstream context (also honored when the SDK spawns this binary; see below) |


---

## SDK and programmatic access

Use this when authoring workflows, not when you only need the command list below.

**1. CLI — `gsd-sdk query <argv…>`**

- Resolves argv with the same **longest-prefix** rules as the typed registry (`resolveQueryArgv` in `sdk/src/query/registry.ts`). Unregistered commands **fail fast** — use `node …/gsd-tools.cjs` only for handlers not in the registry.
- Full matrix (CJS command → registry key, CLI-only tools, aliases, golden tiers): [sdk/src/query/QUERY-HANDLERS.md](../sdk/src/query/QUERY-HANDLERS.md).

**2. TypeScript — `@gsd-build/sdk` (`GSDTools`, `createRegistry`)**

- `GSDTools` now routes through the **SDK Runtime Bridge Module** (`sdk/src/query-runtime-bridge.ts`). Native registry dispatch is preferred; subprocess fallback is explicit policy (`allowFallbackToSubprocess`) and can be disabled for strict SDK-only execution.
- `strictSdk` mode fails fast when a command has no native adapter, making SDK publish/readiness checks deterministic.
- Structured bridge observability is available via `onDispatchEvent` (dispatch mode, fallback reason, duration, outcome, error kind).
- For direct typed dispatch without `GSDTools`, use `createRegistry()` from `sdk/src/query/index.ts`, or invoke `gsd-sdk query` (see [QUERY-HANDLERS.md](../sdk/src/query/QUERY-HANDLERS.md)).
- Conventions: mutation event wiring, `GSDError` vs `{ data: { error } }`, locks, and stubs — [QUERY-HANDLERS.md](../sdk/src/query/QUERY-HANDLERS.md).

**CJS → SDK examples (same project directory):**


| Legacy CJS                               | Preferred `gsd-sdk query` (examples) |
| ---------------------------------------- | ------------------------------------ |
| `node gsd-tools.cjs init phase-op 12`    | `gsd-sdk query init phase-op 12`     |
| `node gsd-tools.cjs phase-plan-index 12` | `gsd-sdk query phase-plan-index 12`  |
| `node gsd-tools.cjs state json`          | `gsd-sdk query state json`           |
| `node gsd-tools.cjs roadmap analyze`     | `gsd-sdk query roadmap analyze`      |


**SDK state reads:** `state.json` and `state.load` are both registered query handlers with parity coverage. You can invoke them through `gsd-sdk query …` and through the SDK Runtime Bridge (`GSDTools` → `sdk/src/query-runtime-bridge.ts`), honoring `allowFallbackToSubprocess` / `strictSdk` and emitting `onDispatchEvent` observability. For direct typed dispatch, use `createRegistry()` from `sdk/src/query/index.ts`. Full routing and golden rules: [QUERY-HANDLERS.md](../sdk/src/query/QUERY-HANDLERS.md).

**CLI-only (not in registry):** e.g. **graphify**, **from-gsd2** / **gsd2-import** — call `gsd-tools.cjs` until registered.

**Mutation events (SDK):** `QUERY_MUTATION_COMMANDS` in `sdk/src/query/index.ts` lists commands that may emit structured events after a successful dispatch. Exceptions called out in QUERY-HANDLERS: `state validate` (read-only), `skill-manifest` (writes only with `--write`), `intel update` (stub).

**Golden parity:** Policy and CJS↔SDK test categories are documented under **Golden parity** in [QUERY-HANDLERS.md](../sdk/src/query/QUERY-HANDLERS.md).

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

# Phase start — update STATE.md Status/Last activity for a new phase
node gsd-tools.cjs state begin-phase --phase N --name SLUG --plans COUNT

# Agent-discoverable blocker signalling (used by discuss-phase / UI flows)
node gsd-tools.cjs state signal-waiting --type TYPE --question "..." --options "A|B" --phase P
node gsd-tools.cjs state signal-resume
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

> **Mode field (v1.50.0+).** `roadmap get-phase` returns a `mode` field extracted from `**Mode:**` (e.g. `"mvp"`). Lowercased + trimmed; unrecognized values preserved verbatim for forward-compat. The companion `gsd-sdk query phase.mvp-mode <N>` ([MVP Commands](#mvp-commands)) wraps this with the full precedence chain.

---

## MVP Commands

SDK-only verbs that centralize MVP-mode resolution and validation. Three small focused queries; consumed by `/gsd-plan-phase`, `/gsd-execute-phase`, `/gsd-verify-work`, `/gsd-progress`, `/gsd-mvp-phase` and the gsd-executor and gsd-verifier agents. No `gsd-tools.cjs` mirror — these are native SDK handlers (registered in `NO_CJS_SUBPROCESS_REASON`).

### `phase.mvp-mode`

Resolve whether MVP mode applies to a phase. Single canonical seam — workflows call this verb instead of inlining the precedence chain.

**Precedence (first hit wins):**
1. `--cli-flag` arg (caller asserts the user passed `--mvp` on the CLI)
2. ROADMAP.md `**Mode:** mvp` for the phase
3. `workflow.mvp_mode` config (project-wide default)
4. `false`

```bash
# Roadmap + config check (no CLI override)
gsd-sdk query phase.mvp-mode 1

# Caller saw --mvp on CLI — flag wins
gsd-sdk query phase.mvp-mode 1 --cli-flag

# Pluck just the boolean for shell composition
MVP_MODE=$(gsd-sdk query phase.mvp-mode 1 --pick active)
```

**Returns** (`{ data: ... }`):
```json
{
  "active": true,
  "source": "roadmap",
  "roadmap_mode": "mvp",
  "config_mvp_mode": false,
  "cli_flag_present": false
}
```

| Field | Type | Description |
|---|---|---|
| `active` | boolean | True when MVP mode applies. |
| `source` | `cli_flag` \| `roadmap` \| `config` \| `none` | Which signal in the chain decided. |
| `roadmap_mode` | string \| null | Literal value from `**Mode:**` (lowercased), or null when absent. |
| `config_mvp_mode` | boolean | The `workflow.mvp_mode` config value at resolution time. |
| `cli_flag_present` | boolean | True when `--cli-flag` was passed. |

### `task.is-behavior-adding`

Predicate: does this PLAN.md task add user-visible behavior under the MVP+TDD Gate? Three checks, all required: (1) `tdd="true"` frontmatter, (2) non-empty `<behavior>` block, (3) `<files>` includes at least one non-test source file (excludes `*.md`, `*.json`, `*.test.*`, `*.spec.*`). Pure doc-only / config-only / test-only tasks return `false` and are exempt from the gate.

```bash
# From a plan file on disk
gsd-sdk query task.is-behavior-adding ./plans/01-PLAN-auth.md

# From an inline XML snippet
gsd-sdk query task.is-behavior-adding --task-content '<task tdd="true"><behavior>User can log in</behavior><files>src/auth.ts</files></task>'
```

**Returns:**
```json
{
  "is_behavior_adding": true,
  "checks": {
    "tdd_true": true,
    "has_behavior_block": true,
    "has_source_files": true
  },
  "reason": null
}
```

When `is_behavior_adding` is `false`, `reason` is a human-readable diagnostic listing which of the three checks failed — used by the executor's halt-and-report message. Canonical specification: [`get-shit-done/references/execute-mvp-tdd.md`](../get-shit-done/references/execute-mvp-tdd.md).

### `user-story.validate`

Validate that a string matches the canonical User Story format used by MVP-mode phases. Owns the regex `/^As a .+, I want to .+, so that .+\.$/`. Consumed by `gsd-verifier` (phase-goal guard) and `/gsd-mvp-phase` (interactive-prompt validation) — single source of truth so the validator the user sees during `/gsd-mvp-phase` matches the validator the verifier applies later.

```bash
# Positional form
gsd-sdk query user-story.validate "As a user, I want to log in, so that I see my data."

# Flag form (when the story might contain shell metacharacters)
gsd-sdk query user-story.validate --story "As a user, I want to log in, so that I see my data."
```

**Returns when valid:**
```json
{
  "valid": true,
  "input": "As a user, I want to log in, so that I see my data.",
  "slots": {
    "role": "user",
    "capability": "log in",
    "outcome": "I see my data"
  },
  "errors": []
}
```

**Returns when invalid** (e.g. missing the terminal period):
```json
{
  "valid": false,
  "input": "As a user, I want to log in, so that I see my data",
  "slots": null,
  "errors": ["Must end with a period."]
}
```

The `errors[]` array contains specific guidance per missing element (`Must begin with "As a "`, `Must contain ", I want to "`, `Must contain ", so that "`, `Must end with a period.`) so callers can surface targeted re-prompts.

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

# Probe context-window utilization for status-line / hook callers (v1.40.0)
node gsd-tools.cjs validate context
```

`validate context` emits a structured envelope with `utilization`, `status`
(`ok` / `warn` / `critical` at the 60 % / 70 % thresholds), and a
`suggestion` string. The same data backs `/gsd-health --context`.

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

# Workstream-scoped init (SDK --ws flag)
node gsd-tools.cjs init execute-phase <phase> --ws <name>
node gsd-tools.cjs init plan-phase <phase> --ws <name>
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

## Skill Manifest

Pre-compute and cache skill discovery for faster command loading.

```bash
# Generate skill manifest (writes to .claude/skill-manifest.json)
node gsd-tools.cjs skill-manifest

# Generate with custom output path
node gsd-tools.cjs skill-manifest --output <path>
```

Returns JSON mapping of all available GSD skills with their metadata (name, description, file path, argument hints). Used by the installer and session-start hooks to avoid repeated filesystem scans.

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

# Cross-artifact audit queue — scan `.planning/` for unresolved audit items
node gsd-tools.cjs audit-open [--json]

# Reverse-migrate a GSD-2 project into the current structure (backs `/gsd-from-gsd2`)
node gsd-tools.cjs from-gsd2 [--path <dir>] [--force] [--dry-run]

# Git commit with config checks
node gsd-tools.cjs commit <message> [--files f1 f2] [--amend] [--no-verify]
```

> `--no-verify`: Skips pre-commit hooks. Used by parallel executor agents during wave-based execution to avoid build lock contention (e.g., cargo lock fights in Rust projects). The orchestrator runs hooks once after each wave completes. Do not use `--no-verify` during sequential execution — let hooks run normally.

# Web search (requires Brave API key)
node gsd-tools.cjs websearch <query> [--limit N] [--freshness day|week|month]
```

---

## Graphify

Build, query, and inspect the project knowledge graph in `.planning/graphs/`. Requires `graphify.enabled: true` in `config.json` (see [Configuration Reference](CONFIGURATION.md#graphify-settings)). Graphify is **CJS-only**: `gsd-sdk query` does not yet register graphify handlers — always use `node gsd-tools.cjs graphify …`.

```bash
# Build or rebuild the knowledge graph
node gsd-tools.cjs graphify build

# Search the graph for a term
node gsd-tools.cjs graphify query <term>

# Show graph freshness and statistics
node gsd-tools.cjs graphify status

# Show changes since the last build
node gsd-tools.cjs graphify diff

# Write a named snapshot of the current graph
node gsd-tools.cjs graphify snapshot [name]
```

User-facing entry point: `/gsd-graphify` (see [Command Reference](COMMANDS.md#gsd-graphify)).

---

## Module Architecture

| Module | File | Exports |
|--------|------|---------|
| Core | `lib/core.cjs` | `error()`, `output()`, `parseArgs()`, shared utilities, compatibility re-exports |
| State | `lib/state.cjs` | All `state` subcommands, `state-snapshot` |
| Phase | `lib/phase.cjs` | Phase CRUD, `find-phase`, `phase-plan-index`, `phases list` |
| Planning Workspace | `lib/planning-workspace.cjs` | Planning seam: `planningDir`, `planningPaths`, active workstream routing, `.planning/.lock` |
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
| Graphify | `lib/graphify.cjs` | Knowledge graph build/query/status/diff/snapshot (backs `/gsd-graphify`) |
| Learnings | `lib/learnings.cjs` | Extract learnings from phases/SUMMARY artifacts (backs `/gsd-extract-learnings`) |
| Audit | `lib/audit.cjs` | Phase/milestone audit queue handlers; `audit-open` helper |
| GSD2 Import | `lib/gsd2-import.cjs` | Reverse-migration importer from GSD-2 projects (backs `/gsd-from-gsd2`) |
| Intel | `lib/intel.cjs` | Queryable codebase intelligence index (backs `/gsd-map-codebase --query`) |

---

## Reviewer CLI Routing

`review.models.<cli>` maps a reviewer flavor to a shell command invoked by the code-review workflow. Set via [`/gsd-settings-integrations`](COMMANDS.md#gsd-settings-integrations) or directly:

```bash
gsd-sdk query config-set review.models.codex    "codex exec --model gpt-5"
gsd-sdk query config-set review.models.gemini   "gemini -m gemini-2.5-pro"
gsd-sdk query config-set review.models.opencode "opencode run --model claude-sonnet-4"
gsd-sdk query config-set review.models.claude   ""   # clear — fall back to session model
```

Slugs are validated against `[a-zA-Z0-9_-]+`; empty or path-containing slugs are rejected. See [`docs/CONFIGURATION.md`](CONFIGURATION.md#code-review-cli-routing) for the full field reference.

## Secret Handling

API keys configured via `/gsd-settings-integrations` (`brave_search`, `firecrawl`, `exa_search`) are written plaintext to `.planning/config.json` but are masked (`****<last-4>`) in every `config-set` / `config-get` output, confirmation table, and interactive prompt. See `get-shit-done/bin/lib/secrets.cjs` for the masking implementation. The `config.json` file itself is the security boundary — protect it with filesystem permissions and keep it out of git (`.planning/` is gitignored by default).

---

## See also

- [sdk/src/query/QUERY-HANDLERS.md](../sdk/src/query/QUERY-HANDLERS.md) — registry matrix, routing, golden parity, intentional CJS differences
- [Architecture](ARCHITECTURE.md) — where `gsd-sdk query` fits in orchestration
- [Command Reference](COMMANDS.md) — user-facing `/gsd-` commands
