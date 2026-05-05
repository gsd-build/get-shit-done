# Phase 4: Creation Command & Workflow - Pattern Map

**Mapped:** 2026-04-30
**Files analyzed:** 3 new files
**Analogs found:** 3 / 3

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `commands/gsd/create-sme.md` | command (presentation layer) | request-response | `commands/gsd/map-codebase.md` | exact |
| `get-shit-done/workflows/create-sme.md` | workflow (orchestration layer) | event-driven (subagent spawn) | `get-shit-done/workflows/ui-phase.md` | exact |
| `sdk/src/agents/create-sme-workflow-structure.test.ts` | test | N/A | `sdk/src/agents/sme-creator-structure.test.ts` | exact |

---

## Pattern Assignments

### `commands/gsd/create-sme.md` (command, request-response)

**Analog:** `commands/gsd/map-codebase.md` (lines 1-72)

**YAML frontmatter pattern** (map-codebase.md lines 1-12):
```markdown
---
name: gsd:map-codebase
description: Analyze codebase with parallel mapper agents to produce .planning/codebase/ documents
argument-hint: "[optional: specific area to map, e.g., 'api' or 'auth']"
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
  - Write
  - Task
---
```
Copy this pattern exactly. For `create-sme.md` add `AskUserQuestion` to `allowed-tools` (required for CMD-02/CMD-03 interactive menus). See also `commands/gsd/add-tests.md` lines 1-14 for a command that includes `AskUserQuestion` in `allowed-tools`.

**`<objective>` block pattern** (map-codebase.md lines 14-21):
```markdown
<objective>
Analyze existing codebase using parallel gsd-codebase-mapper agents to produce structured codebase documents.

Each mapper agent explores a focus area and **writes documents directly** to `.planning/codebase/`. The orchestrator only receives confirmations, keeping context usage minimal.

Output: .planning/codebase/ folder with 7 structured documents about the codebase state.
</objective>
```
Copy this structure: one-sentence what, one-sentence how, one-line Output:.

**`<execution_context>` pattern** (map-codebase.md lines 23-25):
```markdown
<execution_context>
@~/.claude/get-shit-done/workflows/map-codebase.md
</execution_context>
```
Use `@~/.claude/get-shit-done/workflows/create-sme.md` as the reference path.

**`<context>` with `$ARGUMENTS`** (map-codebase.md lines 27-36):
```markdown
<context>
Focus area: $ARGUMENTS (optional - if provided, tells agents to focus on specific subsystem)

**Load project state if exists:**
Check for .planning/STATE.md - loads context if project already initialized
```
The `create-sme.md` command version: `Process name: $ARGUMENTS (optional - workflow presents interactive menu if not provided)`.

**`<process>` with delegation statement** (add-tests.md lines 38-41):
```markdown
<process>
Execute the add-tests workflow from @~/.claude/get-shit-done/workflows/add-tests.md end-to-end.
Preserve all workflow gates (classification approval, test plan approval, RED-GREEN verification, gap reporting).
</process>
```
Copy this delegation pattern. For `create-sme.md`: "Preserve all workflow gates (validation, existence check, progress indicators, commit)."

---

### `get-shit-done/workflows/create-sme.md` (workflow, event-driven)

**Analog:** `get-shit-done/workflows/ui-phase.md`

**Init context pattern** (map-codebase.md lines 68-77):
```markdown
<step name="init_context" priority="first">
Load codebase mapping context:

```bash
INIT=$(gsd-sdk query init.map-codebase)
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
AGENT_SKILLS_MAPPER=$(gsd-sdk query agent-skills gsd-codebase-mapper)
```

Extract from init JSON: `mapper_model`, `commit_docs`, `codebase_dir`, `existing_maps`, `has_maps`, `codebase_dir_exists`, `subagent_timeout`, `date`.
</step>
```
For `create-sme.md`, use `init.map-codebase` (not `init.phase-op` — that requires a phase number). Resolve model and skills:
```bash
CREATOR_MODEL=$(gsd-sdk query resolve-model gsd-sme-creator --raw)
AGENT_SKILLS_CREATOR=$(gsd-sdk query agent-skills gsd-sme-creator)
```

**`planning_exists` guard pattern** (ui-phase.md lines 55-57):
```markdown
**If `planning_exists` is false:** Error — run `/gsd-new-project` first.
```
Apply the same guard in the first step before any filesystem operations. Display: "No .planning/ directory found. Run /gsd-new-project first."

**Text-mode mandatory block** (quick.md line 44, ui-phase.md line 99):
```markdown
**Text mode (`workflow.text_mode: true` in config or `--text` flag):** Set
`TEXT_MODE=true` if `--text` is present in `$ARGUMENTS` OR `text_mode` from
init JSON is `true`. When TEXT_MODE is active, replace every `AskUserQuestion`
call with a plain-text numbered list and ask the user to type their choice number.
This is required for non-Claude runtimes (OpenAI Codex, Gemini CLI, etc.) where
`AskUserQuestion` is not available.
```
Place this block at the top of the workflow (before any `AskUserQuestion` call). This is the same boilerplate found verbatim in 8+ workflows.

**AskUserQuestion multi-choice pattern** (add-tests.md lines 115-137):
```markdown
AskUserQuestion(
  header: "Test Classification",
  question: |
    ## Files classified for testing

    ### TDD (Unit Tests) — {N} files
    {list of files with brief reason}
    ...
    How would you like to proceed?
  options:
    - "Approve and generate test plan"
    - "Adjust classification (I'll specify changes)"
    - "Cancel"
)
```
Use this three-option structure for both CMD-02 (process selection) and CMD-03 (create/update/cancel choice).

**ASCII banner + progress line pattern** (ui-phase.md lines 116-121):
```markdown
Display:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► UI DESIGN CONTRACT — PHASE {N}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Spawning UI researcher...
```
```
Copy the `━━━` width and `◆ Spawning` line exactly. For `create-sme.md`:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► CREATE SME — {PROCESS_NAME}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ Spawning SME creator...
```

**Blocking Task() invocation pattern** (ui-phase.md lines 159-165):
```markdown
Task(
  prompt=ui_research_prompt,
  subagent_type="gsd-ui-researcher",
  model="{UI_RESEARCHER_MODEL}",
  description="UI Design Contract Phase {N}"
)
```
For `create-sme.md`, use `run_in_background=false` (or omit — false is default). This is a single blocking call, unlike map-codebase's parallel background tasks.

**Codex runtime rule** (ui-phase.md lines 167):
```markdown
> **ORCHESTRATOR RULE — CODEX RUNTIME**: After calling Task() above, stop working
on this task immediately. Do not read more files, edit code, or run tests related
to this task while the subagent is active. Wait for the subagent to return its
result.
```
Include this rule after the Task() call block.

**Return marker handling pattern** (ui-phase.md lines 170-175):
```markdown
## 6. Handle Researcher Return

**If `## UI-SPEC COMPLETE`:**
Display confirmation. Continue to step 7.

**If `## UI-SPEC BLOCKED`:**
Display blocker details and options. Exit workflow.
```
For `create-sme.md`: `## SME Creation Complete` is the success marker (verified from `agents/gsd-sme-creator.md`). Add error case: "If no return marker or error text: Display error. Offer retry or exit."

**Commit pattern** (map-codebase.md lines 377-384):
```markdown
<step name="commit_codebase_map">
Commit the codebase map:

```bash
gsd-sdk query commit "docs: map existing codebase" --files .planning/codebase/*.md
```

Continue to offer_next.
</step>
```
For `create-sme.md`:
```bash
gsd-sdk query commit "feat: create {PROCESS_NAME} SME document" --files ".planning/smes/{PROCESS_NAME}-SME.md"
```
Gate on `commit_docs` from init context before running.

**Offer next steps pattern** (map-codebase.md lines 387-424):
```markdown
<step name="offer_next">
...
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► SME CREATION COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## ▶ Next Up

...
```
```
Use the `## ▶ Next Up` format and `━━━` banner for the completion summary step. Same pattern.

---

### `sdk/src/agents/create-sme-workflow-structure.test.ts` (test, structural)

**Analog:** `sdk/src/agents/sme-creator-structure.test.ts` (all 260 lines)

**File header and imports pattern** (sme-creator-structure.test.ts lines 1-17):
```typescript
/**
 * Structural validation tests for Phase 3 SME creator agent definitions.
 *
 * Tests verify static structure of agent markdown files and eval config — not
 * runtime behavior. All tests read files from the repo root using absolute paths.
 *
 * Requirements covered:
 *   CREATE-01 — ...
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
```
Copy this exact import block. The Phase 4 test covers CMD-01 through CMD-04.

**REPO_ROOT resolution pattern** (sme-creator-structure.test.ts lines 22-27):
```typescript
// The SDK lives at <repo>/sdk; the agent definitions are at <repo>/agents/
// import.meta.dirname = <repo>/sdk/src/agents → up 3 levels = <repo>
const REPO_ROOT = resolve(import.meta.dirname, '..', '..', '..');

const ORCHESTRATOR_PATH = resolve(REPO_ROOT, 'agents', 'gsd-sme-creator.md');
```
For Phase 4, define:
```typescript
const REPO_ROOT = resolve(import.meta.dirname, '..', '..', '..');
const COMMAND_PATH = resolve(REPO_ROOT, 'commands', 'gsd', 'create-sme.md');
const WORKFLOW_PATH = resolve(REPO_ROOT, 'get-shit-done', 'workflows', 'create-sme.md');
```

**Helper functions pattern** (sme-creator-structure.test.ts lines 31-43):
```typescript
function readAgent(path: string): string {
  return readFileSync(path, 'utf-8');
}

function countOccurrences(content: string, needle: string): number {
  let count = 0;
  let pos = 0;
  while ((pos = content.indexOf(needle, pos)) !== -1) {
    count++;
    pos += needle.length;
  }
  return count;
}
```
Copy both helpers. `countOccurrences` is used when a pattern must appear N+ times (e.g., `TEXT_MODE` appearing at least once).

**describe/beforeAll/it pattern** (sme-creator-structure.test.ts lines 47-95):
```typescript
describe('CREATE-01: orchestrator agent structure for complete SME document output', () => {
  let orchestrator: string;

  // Load once, share across tests in this describe block
  beforeAll(() => {
    orchestrator = readAgent(ORCHESTRATOR_PATH);
  });

  it('orchestrator has a <role> block with GSD SME creator identity', () => {
    expect(orchestrator).toContain('<role>');
    expect(orchestrator).toContain('GSD SME creator');
  });
  ...
});
```
Each `describe` block owns one `beforeAll`. Variables declared as `let` at describe scope. Tests use `.toContain()` and `.toMatch()` for string assertions on markdown content.

**Frontmatter field extraction pattern** (sme-creator-structure.test.ts lines 147-153):
```typescript
it('orchestrator YAML frontmatter includes Task in the tools field', () => {
  const toolsLine = orchestrator
    .split('\n')
    .find((line) => line.startsWith('tools:'));
  expect(toolsLine).toBeDefined();
  expect(toolsLine).toContain('Task');
});
```
Use this split-find pattern to validate YAML frontmatter fields. For CMD-01: validate `name: gsd:create-sme` appears in the command file.

**Exact name match pattern** (sme-creator-structure.test.ts lines 178-183):
```typescript
it('analyzer name field in YAML frontmatter is exactly "gsd-sme-creator-analyzer"', () => {
  const nameLine = analyzer
    .split('\n')
    .find((line) => line.startsWith('name:'));
  expect(nameLine).toBeDefined();
  expect(nameLine!.trim()).toBe('name: gsd-sme-creator-analyzer');
});
```
Apply the same `.trim()` + `.toBe()` assertion for verifying the command's `name: gsd:create-sme` field is exact.

---

## Shared Patterns

### Text-Mode Fallback
**Source:** `get-shit-done/workflows/quick.md` line 44; `get-shit-done/workflows/ui-phase.md` line 99
**Apply to:** `create-sme.md` workflow — mandatory at top, before any `AskUserQuestion` call
```markdown
**Text mode (`workflow.text_mode: true` in config or `--text` flag):** Set
`TEXT_MODE=true` if `--text` is present in `$ARGUMENTS` OR `text_mode` from
init JSON is `true`. When TEXT_MODE is active, replace every `AskUserQuestion`
call with a plain-text numbered list and ask the user to type their choice number.
This is required for non-Claude runtimes (OpenAI Codex, Gemini CLI, etc.) where
`AskUserQuestion` is not available.
```

### ASCII Progress Banner
**Source:** `get-shit-done/workflows/ui-phase.md` lines 116-121; `get-shit-done/workflows/add-tests.md` lines 61-66; `get-shit-done/workflows/quick.md` lines 62-67
**Apply to:** Any step in `create-sme.md` that spawns an agent or begins a major phase
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► {CONTEXT}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

◆ {action description}...
```

### Init Context Load
**Source:** `get-shit-done/workflows/map-codebase.md` lines 68-77
**Apply to:** First step of `create-sme.md` workflow
```bash
INIT=$(gsd-sdk query init.map-codebase)
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```
Always check `planning_exists` from init JSON before proceeding. Exit with guidance if false.

### Commit on Success
**Source:** `get-shit-done/workflows/map-codebase.md` lines 377-384
**Apply to:** Post-creation step in `create-sme.md` workflow (gated on `commit_docs`)
```bash
gsd-sdk query commit "feat: create {PROCESS_NAME} SME document" \
  --files ".planning/smes/{PROCESS_NAME}-SME.md"
```

### Codex Runtime Rule
**Source:** `get-shit-done/workflows/ui-phase.md` line 167; `get-shit-done/workflows/map-codebase.md` (step spawn_agents)
**Apply to:** After every `Task()` call in `create-sme.md` workflow
```markdown
> **ORCHESTRATOR RULE — CODEX RUNTIME**: After calling Task() above, stop working
> on this task immediately. Do not read more files, edit code, or run tests related
> to this task while the subagent is active. Wait for the subagent to return its
> result.
```

### Process Name Validation (Security)
**Source:** Phase 1 config schema constraint (`.planning/STATE.md`); RESEARCH.md Pattern 3
**Apply to:** First user-input handling step in `create-sme.md` workflow
```bash
if [[ ! "$PROCESS_NAME" =~ ^[a-zA-Z0-9_-]+$ ]]; then
  echo "ERROR: Process name must contain only letters, digits, hyphens, and underscores."
  exit 1
fi
```
Validate before any use of `$PROCESS_NAME` in file paths or bash commands.

---

## No Analog Found

All three Phase 4 files have strong analogs. No files require fallback to RESEARCH.md patterns only.

---

## Metadata

**Analog search scope:** `commands/gsd/`, `get-shit-done/workflows/`, `sdk/src/agents/`
**Files scanned:** 6 analog files read (map-codebase.md command, add-tests.md command, new-milestone.md command, map-codebase.md workflow, ui-phase.md workflow, add-tests.md workflow, sme-creator-structure.test.ts, quick.md)
**Pattern extraction date:** 2026-04-30
