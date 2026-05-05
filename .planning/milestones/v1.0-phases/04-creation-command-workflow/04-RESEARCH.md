# Phase 4: Creation Command & Workflow - Research

**Researched:** 2026-04-30
**Domain:** CLI command authoring, workflow markdown orchestration, interactive menus (AskUserQuestion), progress indicators, process detection, SME file lifecycle management
**Confidence:** HIGH

---

## Summary

Phase 4 wires the Phase 3 agent (`gsd-sme-creator`) into a user-facing experience: a `/gsd-create-sme` CLI command backed by a `create-sme.md` workflow. The deliverables are two markdown files — the command definition in `commands/gsd/create-sme.md` and the workflow in `get-shit-done/workflows/create-sme.md`. No TypeScript is required.

The four requirements (CMD-01 through CMD-04) map cleanly onto established GSD patterns. Interactive menus use `AskUserQuestion` (with text-mode fallback). Progress indicators are ASCII banners with `◆ Spawning creator...` lines. Process discovery uses `gsd-sdk query sme.list` (from Phase 2). Existing-SME detection checks for `.planning/smes/{PROCESS_NAME}-SME.md` on disk. The creator agent is spawned via `Task(subagent_type="gsd-sme-creator", ...)` — matching exactly how `ui-phase.md` spawns `gsd-ui-researcher`.

The critical design decision is init context: `create-sme.md` does NOT need a phase number. It uses `gsd-sdk query init.map-codebase` (or a simple `init.ingest-docs`-style handler) to load `commit_docs`, `planning_exists`, `date`, and project metadata. The workflow is self-contained: it reads arguments, queries existing SMEs, presents menus, spawns the creator, waits for completion, and commits.

**Primary recommendation:** Follow the `get-shit-done/workflows/ui-phase.md` structural pattern — AskUserQuestion for interactive choice, ASCII banner before spawning, Task/TaskOutput for creator invocation, commit on success. The Phase 2 `sme.list` query handler provides all data needed for the interactive menu.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| CLI argument parsing (`/gsd-create-sme [process-name]`) | Presentation Layer (commands/gsd/create-sme.md) | — | Entry point; passes `$ARGUMENTS` to workflow |
| Interactive process menu (no-argument case) | Orchestration Layer (create-sme.md workflow) | — | Workflow owns user interaction; queries `sme.list` to get available + already-existing processes |
| Existing-SME detection and choice prompt | Orchestration Layer (create-sme.md workflow) | — | File check + AskUserQuestion; workflow logic |
| Progress indication during creation | Orchestration Layer (create-sme.md workflow) | — | ASCII banner before Task() call; inline text output during wait |
| SME creation execution | Agent Layer (gsd-sme-creator.md) | — | Phase 3 deliverable; workflow spawns via Task() |
| SME document persistence | Agent Layer (gsd-sme-creator.md) | SDK Layer (commit) | Agent writes file; workflow commits on success |
| Process list resolution | SDK Layer (sme.list query) | — | Phase 2 deliverable; already registered |

---

## Standard Stack

### Core (already installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Markdown + YAML frontmatter | N/A | Command and workflow definition format | All commands in `commands/gsd/` and workflows in `get-shit-done/workflows/` use this format [VERIFIED: repo scan] |
| `@anthropic-ai/claude-agent-sdk` | 0.2.84 (installed) | Agent spawning via `Task`/`TaskOutput` | Sole AI dependency; all agent spawning uses this [VERIFIED: sdk/package.json] |
| `gsd-sdk query sme.list` | Phase 2 output | Lists existing SME documents for interactive menu | Registered in `sdk/src/query/index.ts` [VERIFIED: repo scan] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `AskUserQuestion` tool | Built-in | Interactive menu for no-argument case and existing-SME choice | All interactive workflow steps; with text-mode fallback |
| `gsd-sdk query commit` | SDK built-in | Commit the new SME document after creation | Use when `commit_docs: true` in init context |
| `gsd-sdk query resolve-model gsd-sme-creator` | SDK built-in | Resolve model for creator agent | Consistent with `ui-phase.md` pattern |
| `gsd-sdk query agent-skills gsd-sme-creator` | SDK built-in | Load agent skills injection | Consistent with other workflow patterns |
| `vitest` | ^3.1.1 (installed) | Structural validation tests | For `sdk/src/agents/create-sme-workflow-structure.test.ts` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `sme.list` for process discovery | Manual `ls .planning/smes/` bash | `sme.list` returns parsed frontmatter + metadata; bash `ls` only gives filenames |
| `AskUserQuestion` | Plain text enumeration | AskUserQuestion gives richer UI; text-mode fallback handles non-Claude runtimes |
| `Task()` to spawn creator | Inline sequential analysis | Task preserves fresh context for the creator; inline would bloat workflow context |

**Installation:** No new packages required. All dependencies are pre-installed from Phases 1-3.

---

## Architecture Patterns

### System Architecture Diagram

```
User: /gsd-create-sme [contribution]
          |
          v
commands/gsd/create-sme.md
  • passes $ARGUMENTS to workflow
  • @get-shit-done/workflows/create-sme.md
          |
          v
get-shit-done/workflows/create-sme.md
          |
  [parse $ARGUMENTS]
          |
      has process-name?
         / \
        /   \
      YES    NO
       |      |
       |    [gsd-sdk query sme.list]
       |    [build process menu from sme list + known processes]
       |    [AskUserQuestion: choose process]
       |      |
       +------+
          |
  [process_name resolved]
          |
  [check: .planning/smes/{PROCESS_NAME}-SME.md exists?]
         / \
        /   \
      YES    NO
       |      |
  [AskUserQuestion:   |
   create new or      |
   update existing]   |
       |               |
       +---------------+
          |
  [resolve model: gsd-sdk query resolve-model gsd-sme-creator]
          |
  [display ASCII banner: "GSD CREATE SME"]
  [display: "◆ Spawning creator..."]
          |
          v
  Task(
    subagent_type="gsd-sme-creator",
    prompt="{PROCESS_NAME}...",
    run_in_background=false  ← blocking; single creator, no parallel
  )
          |
          v
  [wait for Task completion]
  [parse: "## SME Creation Complete"]
          |
  [if commit_docs: gsd-sdk query commit ...]
          |
  [display completion summary]
  [offer next steps]
```

### Recommended Project Structure

```
commands/gsd/
└── create-sme.md         # CLI command definition (Phase 4 deliverable)

get-shit-done/workflows/
└── create-sme.md         # Workflow orchestration (Phase 4 deliverable)

sdk/src/agents/
└── create-sme-workflow-structure.test.ts  # Structural validation tests (Phase 4)
```

### Pattern 1: Command Definition Format

All commands in `commands/gsd/` follow this YAML frontmatter + body format. The `name:` field is the slash command identifier. `$ARGUMENTS` is the positional string passed by the user.

```markdown
<!-- Source: commands/gsd/map-codebase.md, commands/gsd/new-milestone.md -->
---
name: gsd:create-sme
description: Create or update an SME document for a named process
argument-hint: "[process-name]"
allowed-tools:
  - Read
  - Bash
  - Write
  - Task
  - AskUserQuestion
---

<context>
Process name: $ARGUMENTS (optional - will present menu if not provided)
</context>

<execution_context>
@~/.claude/get-shit-done/workflows/create-sme.md
</execution_context>

<process>
Execute the create-sme workflow from @~/.claude/get-shit-done/workflows/create-sme.md end-to-end.
</process>
```

[VERIFIED: commands/gsd/map-codebase.md, commands/gsd/new-milestone.md — identical pattern]

### Pattern 2: Workflow Init Context

All workflows start by loading an init context via `gsd-sdk query`. The closest analog for a non-phase workflow is `init.map-codebase` (returns `commit_docs`, `planning_exists`, `date`, `project_root`). The create-sme workflow can use `init.map-codebase` or a simple inline bash block since it needs very little context.

```bash
# Source: get-shit-done/workflows/map-codebase.md step init_context
INIT=$(gsd-sdk query init.map-codebase)
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
# Extract: commit_docs, planning_exists, date, project_root
```

[VERIFIED: get-shit-done/workflows/map-codebase.md]

### Pattern 3: Text Mode (Mandatory for All Workflows)

Every workflow that uses `AskUserQuestion` MUST include a text-mode fallback for non-Claude runtimes. This is the universal pattern across all existing workflows.

```markdown
<!-- Source: get-shit-done/workflows/add-tests.md, ui-phase.md, quick.md, etc. -->
**Text mode (`workflow.text_mode: true` in config or `--text` flag):** Set
`TEXT_MODE=true` if `--text` is present in `$ARGUMENTS` OR `text_mode` from
init JSON is `true`. When TEXT_MODE is active, replace every `AskUserQuestion`
call with a plain-text numbered list and ask the user to type their choice number.
```

[VERIFIED: 8+ workflows in get-shit-done/workflows/ use identical boilerplate]

### Pattern 4: Interactive Process Menu (CMD-02)

The no-argument case uses `sme.list` to retrieve existing SMEs, builds a list of selectable process names, and presents via `AskUserQuestion`.

```bash
# Load existing SMEs from Phase 2 query handler
SME_LIST=$(gsd-sdk query sme.list)
# Parse JSON: { enabled, smes: [{ process_name, block_mode, finding_counts, ... }] }
```

```
AskUserQuestion(
  header: "Create SME",
  question: |
    Which process would you like to analyze?

    Existing SMEs:
    {list existing SMEs with finding counts}

    Or enter a new process name below.
  followUp: "Process name (e.g. 'contribution', 'enrollment'):"
)
```

[VERIFIED: AskUserQuestion pattern from get-shit-done/workflows/add-tests.md, quick.md]

### Pattern 5: Existing-SME Detection and Choice (CMD-03)

When a process name is provided or chosen, check if an SME already exists before spawning the creator.

```bash
PROCESS_NAME="contribution"
SME_PATH=".planning/smes/${PROCESS_NAME}-SME.md"

if [ -f "$SME_PATH" ]; then
  # Present choice to user
  AskUserQuestion(
    header: "SME Exists",
    question: "An SME for '${PROCESS_NAME}' already exists. What would you like to do?",
    options:
      - "Update existing — refresh with current code state"
      - "Create new — overwrite with a fresh analysis"
      - "Cancel"
  )
fi
```

The creator agent handles both modes identically — it writes to the same output path. The workflow distinction between "create new" and "update existing" is a UX label only.

[ASSUMED] — the creator agent's behavior for updating vs creating is functionally identical (same Write call to same path). If the distinction matters for auditing, the workflow could pass a `MODE=update|create` hint in the prompt.

### Pattern 6: Progress Indicators (CMD-04)

All workflows that spawn subagents display an ASCII banner before the Task() call. The `◆ Spawning...` line is the standard progress indicator — it appears in the user's terminal immediately before the blocking Task() call.

```markdown
<!-- Source: get-shit-done/workflows/ui-phase.md step spawn_gsd-ui-researcher -->
Display:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► CREATE SME — {PROCESS_NAME}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Spawning SME creator...
```

Then Task() blocks while displaying this. The user sees the banner and knows the agent is working.
```

[VERIFIED: get-shit-done/workflows/ui-phase.md steps 5 and 7; add-tests.md step summary_and_commit]

### Pattern 7: Task() Spawning (Single Creator, Not Background)

Unlike `map-codebase.md` which spawns 4 parallel agents, `create-sme.md` spawns a single creator agent and blocks on its result. Use `run_in_background=false` (or omit it, as false is the default) for a single blocking Task call.

```markdown
<!-- Source: get-shit-done/workflows/ui-phase.md (single blocking Task) -->
Task(
  subagent_type="gsd-sme-creator",
  model="{CREATOR_MODEL}",
  description="Create SME for {PROCESS_NAME}",
  prompt="Process: {PROCESS_NAME}
Today: {date}

Analyze the '{PROCESS_NAME}' process and produce .planning/smes/{PROCESS_NAME}-SME.md.
{if update mode: 'Previous SME exists at .planning/smes/{PROCESS_NAME}-SME.md — refresh with current code state.'}
{AGENT_SKILLS_CREATOR}"
)
```

Return marker from creator agent: `## SME Creation Complete` [VERIFIED: agents/gsd-sme-creator.md step return_confirmation]

### Pattern 8: Return Marker Handling

After Task() returns, the workflow checks the creator's return marker to determine success or failure.

```markdown
**If `## SME Creation Complete`:**
Parse: process name, finding counts (BLOCKERs, WARNINGs, WATCHes), output path.
Continue to commit step.

**If no return marker or error text:**
Display error. Offer retry or exit.
```

[VERIFIED: get-shit-done/workflows/ui-phase.md steps 6 and 8 — identical pattern for UI-SPEC COMPLETE / UI-SPEC BLOCKED]

### Pattern 9: Commit and Next Steps

After successful creation, commit if `commit_docs` is enabled, then present a next-steps block.

```bash
# commit_docs from init context
gsd-sdk query commit "feat: create {PROCESS_NAME} SME document" --files ".planning/smes/{PROCESS_NAME}-SME.md"
```

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► SME CREATION COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Created: .planning/smes/{PROCESS_NAME}-SME.md
Findings: {N} BLOCKERs, {M} WARNINGs, {K} WATCHes

---

## ▶ Next Up

Run plan-phase gate (once Phase 6 is built):
/gsd-plan-phase {N}

To create another SME:
/gsd-create-sme [process-name]
```

[VERIFIED: get-shit-done/workflows/map-codebase.md step offer_next — identical next-steps format]

### Anti-Patterns to Avoid

- **Spawning creator with `run_in_background=true`:** Only use background for parallel agents. With a single creator, use blocking Task() — no TaskOutput call needed.
- **Using init.phase-op:** This init handler requires a phase number. `create-sme` is not a phase-specific command; use `init.map-codebase` or direct bash for init context.
- **Checking `workflow.use_sme_agents` in the workflow:** The command exists specifically to create SMEs regardless of the feature flag. The flag gates downstream integration (gate, discuss). The creation command should work whether or not `use_sme_agents` is true — though a warning is appropriate if it is false.
- **Constructing process name directly into file path without validation:** Process name must match `[a-zA-Z0-9_-]+` before use in `.planning/smes/{PROCESS_NAME}-SME.md`. This constraint was established in Phase 1.
- **Reading the SME document content in the workflow:** The workflow should not read the created document's contents — that's the creator's job. The workflow only checks if the file exists (before creation) and reads the creator's return marker summary.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Process list for interactive menu | Custom file scanner | `gsd-sdk query sme.list` | Phase 2 handler returns parsed frontmatter + metadata; already tested |
| Creator invocation | TypeScript wrapper | `Task(subagent_type="gsd-sme-creator")` | Agent spawning is the established pattern; no custom TS needed |
| Interactive menu | Custom readline input | `AskUserQuestion` tool | Built-in multi-select with text-mode fallback; no dependencies |
| SME file existence check | Complex directory scan | `[ -f ".planning/smes/${PROCESS_NAME}-SME.md" ]` | Simple bash is correct; sme.list is for metadata, not existence checks |
| Progress feedback | Custom spinner library | ASCII banner + `◆ Spawning...` text | Standard GSD pattern; no external dependencies |

**Key insight:** Phase 4 is a workflow authoring problem, not a software engineering problem. Both deliverables are markdown files following patterns that already exist in the codebase. The implementation complexity is in the interactive logic and edge cases, not in infrastructure.

---

## Common Pitfalls

### Pitfall 1: Using `run_in_background=true` for a Single Creator
**What goes wrong:** Workflow spawns creator with `run_in_background=true`, then immediately reads the SME file. File doesn't exist yet (or contains stale content from a previous run). No error is raised — the file read silently returns empty.
**Why it happens:** The `run_in_background` pattern is used for parallel agents in `map-codebase`. A single agent doesn't need background mode.
**How to avoid:** Use `Task()` without `run_in_background` (default is blocking). No `TaskOutput` call needed.
**Warning signs:** Workflow completes in under 5 seconds; no SME file appears; completion summary shows zero findings.

### Pitfall 2: Missing Text-Mode Fallback
**What goes wrong:** `AskUserQuestion` is called without the text-mode guard. On non-Claude runtimes (Codex, Gemini CLI, VS Code Copilot), `AskUserQuestion` is unavailable and the workflow errors.
**Why it happens:** Easy to skip when focused on the happy path.
**How to avoid:** Every workflow that uses `AskUserQuestion` MUST include the standard text-mode block at the top. Check all 8+ existing workflows for the boilerplate — it's identical in each.
**Warning signs:** Workflow works in Claude.ai but fails in VS Code Copilot or Codex environments.

### Pitfall 3: Process Name Used Unsanitized in File Path
**What goes wrong:** User provides `../../../etc/passwd` as process name. Workflow constructs `.planning/smes/../../../etc/passwd-SME.md`. Path traversal.
**Why it happens:** String interpolation without validation.
**How to avoid:** Validate process name matches `[a-zA-Z0-9_-]+` before using in path construction. This constraint is already established in Phase 1 config schema (`sme.processes.{name}.block_mode` regex). Apply the same pattern here.
**Warning signs:** Process name contains `/`, `.`, or shell metacharacters.

### Pitfall 4: sme.list Returns `enabled: false`
**What goes wrong:** Workflow calls `gsd-sdk query sme.list` to populate the interactive menu, gets `{ enabled: false, smes: [] }`. The menu shows no options. User confused.
**Why it happens:** `sme.list` returns `enabled: false` when `workflow.use_sme_agents: false` in config. This is correct behavior per SDK-01 design.
**How to avoid:** Check the `enabled` field from `sme.list`. If false, display a note: "SME agents are disabled (`workflow.use_sme_agents: false`). Creating an SME will work but the gate integration is inactive. Enable in /gsd-settings." Then continue — the creation command works regardless.
**Warning signs:** Interactive menu appears empty even when SME files exist in `.planning/smes/`.

### Pitfall 5: subagent_type Mismatch
**What goes wrong:** `Task(subagent_type="gsd-sme-creator-orchestrator", ...)` — the name doesn't match `name: gsd-sme-creator` in `agents/gsd-sme-creator.md`. Falls back silently to a generic agent.
**Why it happens:** Typo or incorrect assumption about the agent name.
**How to avoid:** The exact `name:` field in `agents/gsd-sme-creator.md` is `gsd-sme-creator`. Use exactly that string.
**Warning signs:** Task completes quickly with generic output; no `.planning/smes/*.md` file written.

### Pitfall 6: No Guard for `planning_exists: false`
**What goes wrong:** User runs `/gsd-create-sme` in a directory without `.planning/`. Workflow attempts to write to `.planning/smes/` which doesn't exist. Creator agent errors.
**Why it happens:** Command-level guard not implemented.
**How to avoid:** Check `planning_exists` from init context. If false, display: "No .planning/ directory found. Run /gsd-new-project first." Exit.

### Pitfall 7: Forgetting `mkdir -p .planning/smes/`
**What goes wrong:** Creator agent tries to write `.planning/smes/{PROCESS_NAME}-SME.md` but `.planning/smes/` doesn't exist yet (no SMEs have ever been created). Write fails.
**Why it happens:** The smes directory is created on demand, not during project initialization.
**How to avoid:** Either (a) the workflow creates the directory before spawning the creator, or (b) the creator agent creates it (agents/gsd-sme-creator.md already creates `.planning/smes/.tmp` but may not create the parent). The workflow should create the directory: `mkdir -p .planning/smes`.
**Warning signs:** Creator agent errors with "directory not found" on first-ever SME creation.

---

## Code Examples

### Command File Skeleton

```markdown
<!-- Source: Pattern from commands/gsd/map-codebase.md, commands/gsd/new-milestone.md -->
---
name: gsd:create-sme
description: Create or update an SME document for a named process
argument-hint: "[process-name, e.g., 'contribution']"
allowed-tools:
  - Read
  - Bash
  - Write
  - Task
  - AskUserQuestion
---

<objective>
Create a Subject Matter Expert (SME) document for a codebase process.
The SME document captures domain-specific risks, test gaps, outdated logic,
and edge cases that the plan-phase gate will enforce.

Output: .planning/smes/{PROCESS_NAME}-SME.md
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/create-sme.md
</execution_context>

<context>
Process name: $ARGUMENTS (optional - workflow presents interactive menu if not provided)
</context>

<process>
Execute the create-sme workflow from
@~/.claude/get-shit-done/workflows/create-sme.md end-to-end.
Preserve all workflow gates (validation, existence check, progress indicators, commit).
</process>
```

### Workflow Init Block

```bash
# Source: Pattern from get-shit-done/workflows/map-codebase.md
INIT=$(gsd-sdk query init.map-codebase)
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi

# Extract from JSON:
# commit_docs, planning_exists, date, project_root, project_title

CREATOR_MODEL=$(gsd-sdk query resolve-model gsd-sme-creator --raw)
AGENT_SKILLS_CREATOR=$(gsd-sdk query agent-skills gsd-sme-creator)
```

### Process Name Validation

```bash
# Source: Pattern from Phase 1 config-schema.ts (T-01-04 mitigation)
# Validate before using in .planning/smes/{PROCESS_NAME}-SME.md path construction
if [[ ! "$PROCESS_NAME" =~ ^[a-zA-Z0-9_-]+$ ]]; then
  echo "ERROR: Process name must contain only letters, digits, hyphens, and underscores."
  exit 1
fi
```

### sme.list Usage for Interactive Menu

```bash
# Source: sdk/src/query/sme.ts -- smeList handler
SME_LIST=$(gsd-sdk query sme.list)
# Returns: { "enabled": bool, "smes": [{ "file", "process_name", "block_mode", "finding_counts": {...} }] }

# If enabled=false, note that use_sme_agents is off but continue
# Build list of existing process names from smes[]
```

### Task() Call for Creator

```markdown
<!-- Source: Pattern from get-shit-done/workflows/ui-phase.md step spawn_gsd-ui-researcher -->
Task(
  subagent_type="gsd-sme-creator",
  model="{CREATOR_MODEL}",
  description="Create SME for {PROCESS_NAME}",
  prompt="Process: {PROCESS_NAME}
Today: {date}

Analyze the '{PROCESS_NAME}' process and produce .planning/smes/{PROCESS_NAME}-SME.md.

{if update_mode: 'UPDATE MODE: An SME already exists at .planning/smes/{PROCESS_NAME}-SME.md.
Refresh it with the current code state. Preserve historical findings that still apply.'}

{AGENT_SKILLS_CREATOR}"
)
```

### Structural Test Pattern (for VALIDATION.md)

```typescript
// Source: Pattern from sdk/src/agents/sme-creator-structure.test.ts
// File: sdk/src/agents/create-sme-workflow-structure.test.ts

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..', '..');
const COMMAND_PATH = resolve(REPO_ROOT, 'commands', 'gsd', 'create-sme.md');
const WORKFLOW_PATH = resolve(REPO_ROOT, 'get-shit-done', 'workflows', 'create-sme.md');

describe('CMD-01: command file structure', () => {
  let command: string;
  beforeAll(() => { command = readFileSync(COMMAND_PATH, 'utf-8'); });

  it('command has name: gsd:create-sme', () => {
    expect(command).toContain('name: gsd:create-sme');
  });
  it('command references create-sme.md workflow', () => {
    expect(command).toContain('workflows/create-sme.md');
  });
  it('command has AskUserQuestion in allowed-tools', () => {
    expect(command).toContain('AskUserQuestion');
  });
});

describe('CMD-02: workflow interactive menu', () => {
  let workflow: string;
  beforeAll(() => { workflow = readFileSync(WORKFLOW_PATH, 'utf-8'); });

  it('workflow queries sme.list for process discovery', () => {
    expect(workflow).toContain('sme.list');
  });
  it('workflow uses AskUserQuestion for process selection', () => {
    expect(workflow).toContain('AskUserQuestion');
  });
  it('workflow has text-mode fallback', () => {
    expect(workflow).toContain('TEXT_MODE');
  });
});

describe('CMD-03: existing SME detection', () => {
  let workflow: string;
  beforeAll(() => { workflow = readFileSync(WORKFLOW_PATH, 'utf-8'); });

  it('workflow checks for existing SME file before creation', () => {
    expect(workflow).toMatch(/-SME\.md/);
  });
  it('workflow presents create/update choice when SME exists', () => {
    expect(workflow).toContain('update');
  });
});

describe('CMD-04: progress indicators', () => {
  let workflow: string;
  beforeAll(() => { workflow = readFileSync(WORKFLOW_PATH, 'utf-8'); });

  it('workflow displays ASCII banner before spawning creator', () => {
    expect(workflow).toContain('━━━');
  });
  it('workflow uses gsd-sme-creator as subagent_type', () => {
    expect(workflow).toContain('subagent_type="gsd-sme-creator"');
  });
  it('workflow shows progress text before Task() call', () => {
    expect(workflow).toMatch(/◆ Spawning/);
  });
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom readline for menus | `AskUserQuestion` tool with text-mode fallback | GSD ecosystem standard | Works across Claude.ai, VS Code Copilot, Codex runtimes |
| Background Task() for all agents | Blocking Task() for single agents | Established via ui-phase.md | Simpler — no TaskOutput needed for a single agent |
| Ad-hoc commit message | `gsd-sdk query commit` with standard format | SDK-managed | Consistent with all other workflow commits |

**Deprecated/outdated:**
- `run_in_background=true` + `TaskOutput` for single-agent workflows: Correct for parallel agents (map-codebase, sme-creator internal), but not for single-step workflows like create-sme.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The creator agent (`gsd-sme-creator`) handles both "create new" and "update existing" identically (same Write call, overwrites the file) — the workflow distinction is UX only | Architecture Patterns Pattern 5 | If the creator needs a mode flag to behave differently for updates, the workflow prompt must pass it explicitly |
| A2 | `init.map-codebase` is an appropriate init handler for create-sme (it returns the fields needed: `commit_docs`, `planning_exists`, `date`) | Architecture Patterns Pattern 2 | If a dedicated `init.create-sme` handler is needed, it requires a TypeScript SDK addition (Phase 4 scope creep) |
| A3 | The creator agent will run within a reasonable time for the workflow to block on it (under 5 minutes) | Code Examples | If creator regularly times out, `run_in_background=true` + TaskOutput would be needed |

**Confidence on A1:** HIGH — `gsd-sme-creator.md` writes atomically to the output path regardless of whether the file previously existed. An UPDATE mode hint in the prompt is a nice-to-have, not a requirement.

**Confidence on A2:** HIGH — `init.map-codebase` returns all needed fields. A dedicated handler would be over-engineering for Phase 4.

**Confidence on A3:** MEDIUM — The creator spawns sub-agents internally and can take 2-5 minutes on a large codebase. The workflow is blocking during this time, which is fine (user sees the banner and waits). The Phase 3 agent has a 300000ms (5-minute) TaskOutput timeout built in, so it should complete within that window.

---

## Open Questions

1. **Process discovery beyond existing SMEs**
   - What we know: `sme.list` returns existing SME documents. CMD-02 ("interactive menu of detected processes") could mean either (a) list existing SMEs or (b) detect processes from the codebase even if no SME exists yet.
   - What's unclear: The requirement says "interactive menu of detected processes" — this implies something more than listing already-created SMEs.
   - Recommendation: Interpret as: show existing SMEs for update, AND allow the user to type a new process name. The "detection" is user-driven (they know their process names) rather than automated code scanning. DETECT-01/02/03/04 (Phase 8) covers automated detection at milestone start — CMD-02 is simpler interactive input.

2. **`use_sme_agents: false` behavior**
   - What we know: `sme.list` returns `{ enabled: false, smes: [] }` when the flag is off. The creation command still works — it just means the gate integration is inactive.
   - What's unclear: Should the workflow warn the user or refuse to proceed when `use_sme_agents: false`?
   - Recommendation: Warn ("SME agents are disabled in config; created document won't be used by the gate") but do not block. The user may be creating an SME in preparation for enabling the feature.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `gsd-sdk query sme.list` | CMD-02 interactive menu | Yes | Phase 2 output [VERIFIED: index.ts] | Manual `ls .planning/smes/` |
| `gsd-sdk query init.map-codebase` | Workflow init context | Yes | SDK built-in [VERIFIED: query/index.ts] | Direct bash config read |
| `gsd-sdk query resolve-model` | Creator model selection | Yes | SDK built-in [VERIFIED: repo] | Hardcode to "claude-sonnet-4-6" |
| `gsd-sdk query agent-skills` | Skills injection | Yes | SDK built-in [VERIFIED: repo] | Omit skills block |
| `gsd-sdk query commit` | Post-creation commit | Yes | SDK built-in [VERIFIED: repo] | Direct git commit |
| `AskUserQuestion` tool | CMD-02, CMD-03 menus | Yes (Claude Code) | Built-in | Text-mode numbered list |
| `agents/gsd-sme-creator.md` | Creator agent spawning | Yes [VERIFIED: ls agents/] | Phase 3 output | None — blocking dependency |
| Node.js | Test runner (vitest) | v20.20.2 (below requirement) | — | Tests pass on v20 today |
| vitest | Structural validation tests | Yes | ^3.1.1 [VERIFIED: sdk/package.json] | — |

**Missing dependencies with no fallback:**
- `agents/gsd-sme-creator.md` must exist (Phase 3 dependency). It does exist. [VERIFIED: `ls agents/gsd-sme-creator.md`]

**Missing dependencies with fallback:**
- Node.js v20.20.2 vs required >=22: pre-existing mismatch, tests pass on v20 today.

---

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CMD-01 | `/gsd-create-sme [process-name]` command creates an SME for the specified process | Fulfilled by `commands/gsd/create-sme.md` + `get-shit-done/workflows/create-sme.md` following command/workflow pair pattern (verified from map-codebase.md, new-milestone.md) |
| CMD-02 | `/gsd-create-sme` with no arguments presents an interactive menu of detected processes | Fulfilled by `sme.list` query + `AskUserQuestion` for process selection; text-mode fallback required |
| CMD-03 | If SME already exists for the specified process, user is offered: create new or update existing | Fulfilled by file existence check (`-f .planning/smes/{PROCESS_NAME}-SME.md`) + `AskUserQuestion` with update/create/cancel options |
| CMD-04 | `create-sme.md` workflow orchestrates SME creation with progress indicators | Fulfilled by ASCII banner (`━━━`) + `◆ Spawning SME creator...` before blocking `Task(subagent_type="gsd-sme-creator")` call |

</phase_requirements>

---

## Validation Architecture

nyquist_validation is enabled (workflow.nyquist_validation: true in .planning/config.json).

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 3.1.1 |
| Config file | sdk/vitest.config.ts |
| Quick run command | `cd sdk && npx vitest run --project unit src/agents/create-sme-workflow-structure.test.ts` |
| Full suite command | `cd sdk && npx vitest run --project unit --reporter=verbose` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CMD-01 | `commands/gsd/create-sme.md` exists with `name: gsd:create-sme` | unit | `cd sdk && npx vitest run --project unit src/agents/create-sme-workflow-structure.test.ts` | No — Wave 0 |
| CMD-01 | Command references `workflows/create-sme.md` | unit | same | No — Wave 0 |
| CMD-01 | `get-shit-done/workflows/create-sme.md` exists | unit | same | No — Wave 0 |
| CMD-02 | Workflow queries `sme.list` for process discovery | unit | same | No — Wave 0 |
| CMD-02 | Workflow uses `AskUserQuestion` for process selection | unit | same | No — Wave 0 |
| CMD-02 | Workflow has text-mode (`TEXT_MODE`) fallback | unit | same | No — Wave 0 |
| CMD-03 | Workflow checks for existing SME file (`-SME.md` pattern) | unit | same | No — Wave 0 |
| CMD-03 | Workflow presents update/create choice | unit | same | No — Wave 0 |
| CMD-04 | Workflow displays ASCII banner (`━━━`) | unit | same | No — Wave 0 |
| CMD-04 | Workflow uses `subagent_type="gsd-sme-creator"` | unit | same | No — Wave 0 |
| CMD-04 | Workflow shows `◆ Spawning` progress text | unit | same | No — Wave 0 |

**Note on testing approach:** Phase 4 deliverables are markdown files (command + workflow). Unit tests in Vitest cover structural assertions (file existence, required strings, pattern matches) — the same approach used successfully in Phase 3's `sme-creator-structure.test.ts`.

### Sampling Rate

- **Per task commit:** `cd sdk && npx vitest run --project unit src/agents/create-sme-workflow-structure.test.ts`
- **Per wave merge:** `cd sdk && npx vitest run --project unit --reporter=verbose`
- **Phase gate:** Full suite green (acknowledging 5 pre-existing failures unrelated to Phase 4) before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `sdk/src/agents/create-sme-workflow-structure.test.ts` — covers CMD-01 through CMD-04

*(No framework or fixture additions needed — same infrastructure as Phase 3)*

---

## Security Domain

security_enforcement is not explicitly set to false — treating as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Internal developer tool, no auth surface |
| V3 Session Management | No | No session state |
| V4 Access Control | No | No multi-user access model |
| V5 Input Validation | Yes | Process name must match `[a-zA-Z0-9_-]+` before file path construction |
| V6 Cryptography | No | No cryptographic operations |

### Known Threat Patterns for CLI Commands + Workflow Orchestration

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal via process name in `$ARGUMENTS` | Tampering | Validate against `[a-zA-Z0-9_-]+` before use in `.planning/smes/{PROCESS_NAME}-SME.md` path. Established constraint from Phase 1 config schema. |
| Shell injection via process name passed to bash | Tampering | Quote all uses of `$PROCESS_NAME` in bash; validate regex first |
| Creator agent subagent_type mismatch (silent fallback) | Spoofing | Use exact string `"gsd-sme-creator"` matching `name:` field in agent frontmatter; structural test verifies this |

**Security decisions inherited from Phase 1 (STATE.md):**
- Process names restricted to `[a-zA-Z0-9_-]+` — apply same constraint to workflow input validation.

**New threat surface in Phase 4:**
- `$ARGUMENTS` is user-controlled input arriving as the process name. This is the primary trust boundary in Phase 4 — validate before any filesystem operation.

---

## Sources

### Primary (HIGH confidence)

- `commands/gsd/map-codebase.md` — canonical command definition format with `$ARGUMENTS` [VERIFIED: repo]
- `commands/gsd/new-milestone.md` — canonical command with AskUserQuestion and allowed-tools [VERIFIED: repo]
- `get-shit-done/workflows/map-codebase.md` — canonical init.map-codebase pattern, commit pattern, next-steps format [VERIFIED: repo]
- `get-shit-done/workflows/ui-phase.md` — canonical single-agent Task() + banner + AskUserQuestion pattern [VERIFIED: repo]
- `get-shit-done/workflows/add-tests.md` — canonical AskUserQuestion multi-choice with text-mode [VERIFIED: repo]
- `sdk/src/query/sme.ts` — sme.list return shape (`{ enabled, smes: [...] }`) [VERIFIED: repo]
- `sdk/src/query/index.ts` — sme.list registered at `sme.list` and `sme list` [VERIFIED: repo]
- `agents/gsd-sme-creator.md` — Phase 3 deliverable; `name: gsd-sme-creator`; return marker `## SME Creation Complete` [VERIFIED: repo]
- `sdk/src/agents/sme-creator-structure.test.ts` — structural test pattern for Phase 4 tests [VERIFIED: repo]
- `.planning/config.json` — `workflow.nyquist_validation: true`, `workflow.use_sme_agents: false` [VERIFIED: repo]
- `.planning/STATE.md` — security constraint: process name `[a-zA-Z0-9_-]+` [VERIFIED: repo]

### Secondary (MEDIUM confidence)

- `.planning/phases/03-sme-creator-agent/03-RESEARCH.md` — Phase 3 research confirming Task/TaskOutput patterns
- `.planning/phases/03-sme-creator-agent/03-SECURITY.md` — established threat register for process name validation
- `.planning/ROADMAP.md` — Phase 4 success criteria and requirement IDs confirmed

### Tertiary (LOW confidence)

- None — all claims in this research are verified from the repository.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all files verified against repo; no external dependencies
- Architecture: HIGH — patterns verified from multiple existing workflows
- Pitfalls: HIGH — derived from verified patterns and established constraints
- Interactive menu design: MEDIUM — `sme.list` + AskUserQuestion approach is sound but the "detected processes" interpretation involves a judgment call (A1 in Assumptions Log)

**Research date:** 2026-04-30
**Valid until:** 2026-05-30 (30 days — stable markdown patterns, stable SDK)
