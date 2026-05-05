# Phase 3: SME Creator Agent - Research

**Researched:** 2026-04-29
**Domain:** AI Agent authoring, markdown agent definitions, parallel sub-agent decomposition, git history archaeology, structured output validation
**Confidence:** HIGH

---

## Summary

Phase 3 builds the agent that produces SME documents — the source material all downstream phases (gate, auditor, discuss, refresh) consume. The deliverables are two markdown agent definition files (`agents/gsd-sme-creator.md` and `agents/gsd-sme-creator-analyzer.md`). No TypeScript is required in the agent files themselves; the SDK already handles spawning.

The technical pattern is established and verified in this repo: `get-shit-done/workflows/map-codebase.md` + `agents/gsd-codebase-mapper.md` demonstrate the orchestrator/sub-agent decomposition exactly as required by CREATE-02. The sub-agents write files directly; the orchestrator accumulates only finding counts. This keeps both context windows well below the compaction threshold.

The critical quality requirement is CREATE-04: the agent must use `git log --follow` to extract historical rationale ("why"), not just current code state ("what"). This is the dominant failure mode in code-analysis agents per the AI-SPEC research, and it is enforced by the eval rubric and Promptfoo test suite spec'd in the AI-SPEC.

**Primary recommendation:** Build two agent markdown files following the `gsd-codebase-mapper.md` structural pattern, with the orchestrator managing partition/spawn/collect/synthesize and the analyzer sub-agent running `git log --follow` per file and writing compressed findings to `.planning/smes/.tmp/`. The existing SME template (`get-shit-done/templates/sme.md`) and SDK query infrastructure (Phase 2) are complete prerequisites.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Process file discovery (grep/glob for relevant files) | Agent Layer (gsd-sme-creator) | — | Orchestrator owns process boundary decisions; determines which files belong to the named process |
| File partition management | Agent Layer (gsd-sme-creator) | — | Partition sizing, temp dir creation, sub-agent assignment — all orchestrator-owned coordination |
| Code pattern + git history analysis | Agent Layer (gsd-sme-creator-analyzer) | — | Sub-agent per partition; each has fresh context to read files and run git commands |
| Severity calibration and deduplication | Agent Layer (gsd-sme-creator) | — | Orchestrator synthesizes partial findings and applies BLOCKER/WARNING/WATCH judgment across the full picture |
| SME document write | Agent Layer (gsd-sme-creator) | — | Single atomic Write after all sub-agents complete; prevents partial document in the smes dir |
| Schema validation (section check) | Agent Layer (gsd-sme-creator) | — | Self-check via grep before exiting; workflow-level check on frontmatter completeness |
| Workflow orchestration (progress, user interaction) | Orchestration Layer (create-sme.md) | — | Phase 4 scope; Phase 3 delivers the agents only |
| SDK cost/result extraction | SDK Layer (session-runner.ts) | — | Existing `processQueryStream()` handles stream iteration; no new TypeScript needed in Phase 3 |

---

## Standard Stack

### Core (already installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@anthropic-ai/claude-agent-sdk` | 0.2.84 (installed), 0.2.123 (latest) | Agent spawning, `Task` tool, `query()` stream | Sole AI dependency in this project; all agents use it [VERIFIED: npm registry] |
| Markdown + YAML frontmatter | N/A | Agent definition format | All agents in `agents/` use this format [VERIFIED: repo scan] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `vitest` | ^3.1.1 (installed) | Unit testing | Test any TypeScript helpers added (e.g., Zod validation utilities) [VERIFIED: sdk/package.json] |
| `zod` | Not yet installed | SME frontmatter validation in workflow-level check | Add to `sdk/package.json` if workflow TypeScript validation is implemented in Phase 4; not strictly required in Phase 3 agent-only scope |
| `promptfoo` | 0.121.9 (available via npx) | Eval CI/CD for agent quality regression | Use for eval harness per AI-SPEC Section 5 [VERIFIED: npx promptfoo --version] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Markdown agent definitions | TypeScript agent class | Not the project pattern; all existing agents are markdown files |
| Parallel sub-agent decomposition | Sequential in-context analysis | Falls back to sequential when `Task` unavailable; but parallel is required for CREATE-02 and large codepaths |
| `git log --follow` | `git log` (no follow) | `--follow` is required — without it, file rename history (common in TS refactoring) is invisible |

**Installation:** No new packages required in Phase 3. The agent files are markdown. If eval harness TypeScript is added, run `npm install --save-dev promptfoo` in the project root.

**SDK version note:** Latest on npm is 0.2.123; installed in sdk is 0.2.84. [VERIFIED: npm registry + `npm list`]. The 0.2.84 version fully supports `Task`/`TaskOutput` and sub-agent spawning. No upgrade is required for Phase 3 deliverables, but the version gap should be noted for the planner.

---

## Architecture Patterns

### System Architecture Diagram

```
User invokes /gsd-create-sme [process-name]   (Phase 4 scope)
            |
            v
  create-sme.md workflow                        (Phase 4 scope)
            |
            v (query() call via session-runner.ts)
  ┌─────────────────────────────────────────────────────────┐
  │           gsd-sme-creator.md (Orchestrator)             │
  │                                                         │
  │  [detect capabilities] ──> Task tool available?         │
  │         |                         |                     │
  │       NO (sequential)           YES (parallel)          │
  │         |                         |                     │
  │  [4-pass in-context analysis]   [partition files]       │
  │  Pass 1: code patterns           |                      │
  │  Pass 2: git history      ┌──────┴──────────┐           │
  │  Pass 3: test gaps        |                 |           │
  │  Pass 4: synthesize  Task(analyzer,    Task(analyzer,   │
  │                      partition-1,      partition-N,     │
  │                      background=true)  background=true) │
  │                           |                 |           │
  │                      [TaskOutput]      [TaskOutput]     │
  │                      block=true        block=true       │
  │                           |                 |           │
  │                      reads .tmp file   reads .tmp file  │
  │                           |                 |           │
  │                      [collect, merge, deduplicate]      │
  │                      [apply severity labels]            │
  │                      [self-check: section count >= 4]   │
  │                      [atomic Write to smes/{NAME}-SME.md]│
  │                      [cleanup .tmp/]                    │
  └─────────────────────────────────────────────────────────┘
            ^
            | spawned sub-agent per partition
  ┌─────────────────────────────────────────────────────────┐
  │       gsd-sme-creator-analyzer.md (Sub-Agent)           │
  │                                                         │
  │  Input: file list, output path, process name            │
  │                                                         │
  │  For each file:                                         │
  │    Read file (code pattern analysis)                    │
  │    git log --follow -n 50 <file>  (history)             │
  │    git log --grep="Merge pull request" <file> (PRs)     │
  │    Identify: risks, test gaps, outdated logic, edge cases│
  │                                                         │
  │  Write compressed findings to .planning/smes/.tmp/{N}.md│
  │  Return: finding count (confirmation only)              │
  └─────────────────────────────────────────────────────────┘
            |
            v (output consumed by orchestrator)
  .planning/smes/{PROCESS_NAME}-SME.md
  (frontmatter: process_name, last_analyzed_commit, block_mode,
   generated_at, finding_counts)
```

### Recommended Project Structure

The AI-SPEC specifies the exact file layout. Phase 3 delivers only the agent files:

```
agents/
├── gsd-sme-creator.md           # Orchestrator agent (Phase 3 deliverable)
├── gsd-sme-creator-analyzer.md  # Analyzer sub-agent (Phase 3 deliverable)
get-shit-done/
└── workflows/
    └── create-sme.md            # Workflow (Phase 4 scope)
commands/
└── gsd/
    └── create-sme.md            # CLI command (Phase 4 scope)
.planning/
└── smes/
    ├── .tmp/                    # Temporary partial findings (auto-created by agent, auto-deleted after synthesis)
    └── {PROCESS_NAME}-SME.md    # Final output
evals/
└── sme-creator.promptfooconfig.yaml  # Eval config (Phase 3 deliverable per AI-SPEC)
```

### Pattern 1: Agent Definition Format

All agents in `agents/` use this YAML frontmatter + `<role>` block format. The `name:` field is the `subagent_type` identifier — it must match exactly in any `Task()` call.

```markdown
<!-- Source: agents/gsd-codebase-mapper.md, agents/gsd-executor.md -->
---
name: gsd-sme-creator
description: Analyzes a codebase process and produces a structured SME document.
tools: Read, Bash, Grep, Glob, Write, Task
color: "#F59E0B"
---

<role>
You are a GSD SME creator. Given a PROCESS_NAME...
</role>
```

The analyzer sub-agent does NOT need `Task` in its tools list:

```markdown
---
name: gsd-sme-creator-analyzer
description: Analyzes a file partition for SME risks, test gaps, outdated logic. Writes findings to .tmp file.
tools: Read, Bash, Grep, Glob, Write
color: "#F59E0B"
---
```

[VERIFIED: repo scan of agents/gsd-codebase-mapper.md, agents/gsd-executor.md]

### Pattern 2: Parallel Sub-Agent Decomposition (Task/TaskOutput)

The canonical reference is `get-shit-done/workflows/map-codebase.md`. Key facts verified from that file:

```markdown
<!-- Spawn with run_in_background=true -->
Task(
  subagent_type="gsd-sme-creator-analyzer",
  description="Analyze {process} files partition {N}",
  run_in_background=true,
  prompt="..."
)

<!-- Wait with block=true BEFORE reading output files -->
TaskOutput tool:
  task_id: "{task_id from Task result}"
  block: true
  timeout: 300000
```

Critical constraint: call TaskOutput for all spawned agents in parallel (single message with multiple TaskOutput calls) — verified from `map-codebase.md` `collect_confirmations` step. [VERIFIED: get-shit-done/workflows/map-codebase.md]

### Pattern 3: Sub-Agents Write Files, Orchestrator Reads Summaries

The orchestrator never holds raw code or full git history in its context window. Sub-agents write compressed findings to `.planning/smes/.tmp/{PROCESS_NAME}-part-{N}.md` and return a brief confirmation (finding count only). Orchestrator reads the temp files after `TaskOutput` confirms completion.

This is the same pattern as `gsd-codebase-mapper.md` — the mapper agents write documents directly; the workflow's orchestrator only reads "X lines written" confirmations. [VERIFIED: get-shit-done/workflows/map-codebase.md + agents/gsd-codebase-mapper.md]

### Pattern 4: Sequential Fallback When Task Unavailable

When `Task` tool is not available, the orchestrator performs analysis sequentially in 4 passes, writing partial findings after each pass to stay below 50% context:

1. Pass 1: Code pattern analysis → draft `## Identified Risks` section
2. Pass 2: Git history → annotate findings with "why" evidence (commit hash, PR, comment)
3. Pass 3: Test gap analysis → write `## Test Gaps` section
4. Pass 4: Synthesis → write final `.planning/smes/{PROCESS_NAME}-SME.md`

[VERIFIED: AI-SPEC Section 4 Implementation Guidance]

### Pattern 5: git log --follow for History

```bash
# Required — traces file across renames (common in TS refactoring)
git log --follow -n 50 <file>

# For PR descriptions
git log --grep="Merge pull request" --format="%s%n%b" -n 20 <file>

# NEVER use --all (includes all branches, unbounded output)
```

The `--follow` flag is required for CREATE-04. Without it, the entire pre-rename history of a TypeScript file is invisible — which is exactly when most of the "why" lives (the rename often coincided with the architectural decision that created the pattern). [CITED: AI-SPEC Section 3 Common Pitfalls #4]

### Pattern 6: SME Document Structure (from Phase 1)

The Phase 1 template (`get-shit-done/templates/sme.md`) defines the exact required structure the creator agent must produce:

```yaml
---
process_name: [PROCESS_NAME]
last_analyzed_commit: [COMMIT_HASH]   # git rev-parse HEAD at creation time
block_mode: soft                       # configurable: soft | strict
created_date: [DATE]
finding_counts:
  blocker: 0
  warning: 0
  watch: 0
---
```

Six H2 sections in fixed order: `## Process Overview`, `## Identified Risks`, `## Test Gaps`, `## Outdated Logic`, `## Edge Cases`, `## Known Blockers`.

Finding format: `[SEVERITY] **Bold Title** ... *Evidence:* file:line ... *Mitigation:* ...`

[VERIFIED: get-shit-done/templates/sme.md]

### Pattern 7: Self-Check Before Exit

The agent must verify the document before marking itself complete:

```bash
SECTION_COUNT=$(grep -c "## Process Overview\|## Identified Risks\|## Test Gaps\|## Outdated Logic\|## Edge Cases\|## Known Blockers" \
  .planning/smes/${PROCESS_NAME}-SME.md)
# Must be >= 6 (one per required section)
```

On self-check failure: rewrite missing sections. Maximum 2 repair attempts. On second failure: write document with `## INCOMPLETE` marker, exit with section count in result. [CITED: AI-SPEC Section 4b.1]

### Pattern 8: Severity Calibration via Inline Few-Shot Examples

Include 2-3 inline examples in the agent's `<role>` block covering one BLOCKER, one WARNING, and one WATCH. This calibrates severity judgment more reliably than written rules alone.

BLOCKER criteria: violation would break a known production behavior or data contract.
WARNING criteria: lower-stakes risk or known limitation.
WATCH criteria: code smell or theoretical risk with no current production evidence.

False BLOCKER is the more dangerous error — it erodes trust and causes developers to bypass the gate. [CITED: AI-SPEC Section 1b Severity calibration, Section 3 Common Pitfalls #2]

### Anti-Patterns to Avoid

- **Holding raw code in orchestrator context:** Sub-agents must write findings to temp files. The orchestrator reads only compressed summaries. Holding raw file content in orchestrator context leads to context budget exhaustion (Critical Failure Mode 4).
- **Using `git log` without `--follow`:** History truncates at renames, hiding the "why" the agent needs. This directly violates CREATE-04.
- **Reading output files before TaskOutput:** Reading a sub-agent's temp file before `TaskOutput(block: true)` returns produces empty or partial content. There is no error — it silently returns stale or empty data.
- **`subagent_type` mismatch:** The `subagent_type` string in a `Task()` call must exactly match the `name:` field in the target agent's YAML frontmatter. A mismatch falls back silently to a generic agent with no role instructions. [CITED: AI-SPEC Section 3 Common Pitfalls #2]
- **BLOCKER inflation:** Applying BLOCKER to style issues, missing JSDoc, or theoretical risks with no production evidence. This is the leading adoption failure mode for AI code review tools. [CITED: AI-SPEC Section 1b]
- **Fabricated file paths:** Findings that name real files but describe behavior that does not exist there. Nearly 20% of AI code analysis suggestions reference non-existent patterns per 2025 research. Self-check and workflow-level path validation catch this. [CITED: AI-SPEC Section 1b Known Failure Modes #3]
- **Process boundary over-reach:** Crawling the entire codebase when given a specific process name. The agent must scope discovery to files matching the process name via grep/glob, not a full-repo scan. [CITED: AI-SPEC Section 1b Known Failure Modes #4]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Parallel sub-agent execution | Custom async orchestration in TypeScript | `Task`/`TaskOutput` in agent markdown | SDK manages process lifecycle, context windows, and coordination |
| Agent spawning from TypeScript | Custom `child_process` calls | `query()` in session-runner.ts | Already implemented and tested; just add `allowedTools: ['Task']` |
| SME schema validation | Custom parser | Zod schema (already spec'd in AI-SPEC) or grep-based section check | Edge cases in YAML frontmatter parsing are handled by existing `extractFrontmatter()` |
| Git history parsing | Custom git output parser | Direct bash `git log --follow` in agent Bash tool | The agent can run shell commands; parsing belongs in agent instructions, not custom code |
| Context management | Custom token counting | SDK automatic compaction at 80% + write-to-file-before-60% discipline | SDK handles compaction; sub-agents with fresh 200k context windows solve the budget problem |

**Key insight:** The core complexity in Phase 3 is in the agent instructions (the markdown files), not in TypeScript infrastructure. The SDK, session-runner.ts, and Phase 2 query handlers are complete. Phase 3 is an agent authoring problem, not a systems programming problem.

---

## Common Pitfalls

### Pitfall 1: Omitting Task from allowedTools
**What goes wrong:** Agent markdown includes `Task` in the YAML `tools:` list, but the `query()` call in session-runner.ts does not include `'Task'` in `allowedTools`. The agent receives no error — sub-agent spawning simply doesn't work, and the parallel decomposition silently falls back to nothing (no automatic sequential fallback).
**Why it happens:** Both the agent YAML frontmatter AND the `query()` options must list `Task`. Either alone is insufficient.
**How to avoid:** When writing the Phase 4 workflow that invokes gsd-sme-creator, explicitly add `'Task'` to the `allowedTools` array. In Phase 3, document this as a requirement for Phase 4 to pick up.
**Warning signs:** Agent completes too quickly, output is sequential/incomplete, no sub-agent temp files appear in `.planning/smes/.tmp/`.
[CITED: AI-SPEC Section 3 Common Pitfalls #1]

### Pitfall 2: subagent_type Name Mismatch
**What goes wrong:** The `subagent_type` in a `Task()` call doesn't match the `name:` field in the target agent's YAML frontmatter exactly. The SDK falls back to a generic unspecialized agent with no role instructions — no error or warning.
**Why it happens:** Copy-paste errors, or the agent was renamed after the Task() call was written.
**How to avoid:** Use the exact string from the `name:` field in the agent's frontmatter. For Phase 3: orchestrator uses `subagent_type="gsd-sme-creator-analyzer"`, which must match `name: gsd-sme-creator-analyzer` in the analyzer agent's YAML.
**Warning signs:** Sub-agents produce generic outputs unrelated to SME analysis; findings look like general-purpose code summaries.
[CITED: AI-SPEC Section 3 Common Pitfalls #2]

### Pitfall 3: Reading Sub-Agent Output Before TaskOutput Completes
**What goes wrong:** Orchestrator reads `.planning/smes/.tmp/{N}.md` immediately after spawning sub-agents with `run_in_background=true`, before calling `TaskOutput(block: true)`. Returns empty or partial content silently.
**Why it happens:** Natural to read after spawning; the async contract is non-obvious.
**How to avoid:** Always call `TaskOutput(block: true)` for ALL spawned sub-agents before reading any output files. The `collect_confirmations` step in `map-codebase.md` is the canonical reference.
**Warning signs:** Temp files read as empty; orchestrator synthesizes zero findings; output SME document has empty sections.
[CITED: get-shit-done/workflows/map-codebase.md collect_confirmations step]

### Pitfall 4: git log Without --follow
**What goes wrong:** Agent runs `git log <file>` instead of `git log --follow <file>`. History stops at the most recent file rename. In TypeScript projects with path refactoring (e.g., `sdk/src/sme.ts` → `sdk/src/query/sme.ts`), this hides all pre-rename history — exactly where the "why" behind a pattern lives.
**Why it happens:** `--follow` is easy to omit; `git log <file>` works without it.
**How to avoid:** Enforce `--follow` in analyzer agent instructions. The AI-SPEC makes this explicit. Include it in the mandatory analysis checklist in the agent's `<process>` block.
**Warning signs:** Findings have no historical rationale citations; all findings describe current code state only; no commit hashes or PR numbers appear in evidence.
[CITED: AI-SPEC Section 3 Common Pitfalls #4]

### Pitfall 5: BLOCKER Inflation
**What goes wrong:** Agent labels style issues, missing error handling, or theoretical edge cases as BLOCKER. Developers encounter false BLOCKERs on first use, lose trust in severity labels, and start bypassing the gate — eliminating the system's core value.
**Why it happens:** LLMs trained on code review data tend toward conservative flagging. Without calibration examples, the model defaults to treating any anomaly as high-severity.
**How to avoid:** Include inline few-shot BLOCKER, WARNING, and WATCH examples in the agent's `<role>` block. Define BLOCKER strictly: "violation would break a known production behavior or data contract." Add this as a hard constraint in the agent instructions.
**Warning signs:** First SME run produces > 5 BLOCKERs on a moderately complex process; BLOCKERs reference style issues, JSDoc absence, or generic "no error handling" patterns.
[CITED: AI-SPEC Section 1b Severity calibration]

### Pitfall 6: Context Budget Exhaustion in Orchestrator
**What goes wrong:** Orchestrator reads full file contents + full git history for all files instead of routing analysis to sub-agents. At 25+ files with 50 commits each, the orchestrator context fills before synthesis completes.
**Why it happens:** Temptation to do everything in one agent for simplicity.
**How to avoid:** Enforce the sub-agent pattern: orchestrator discovers files and spawns sub-agents; it never reads file content or git logs directly (in parallel mode). The 5-10 files per partition target keeps each sub-agent at 20-35% context.
**Warning signs:** Agent hits automatic SDK compaction multiple times; output is incomplete; orchestrator runs > 75 turns.
[CITED: AI-SPEC Section 4b.4]

### Pitfall 7: Fabricated File References
**What goes wrong:** Agent generates a finding that names a real file and function but describes behavior that does not exist at that location. The finding looks credible. Developer spends time investigating before discovering the fabrication.
**Why it happens:** LLMs can pattern-match common code structures and apply them to real-looking but incorrect locations. ~20% of AI code analysis suggestions reference non-existent patterns per 2025 research.
**How to avoid:** Require the agent to verify file existence before citing it. Add a pre-write validation step: for each file path cited in a finding, verify it exists with `ls <path>` before writing the finding to the output document. The Promptfoo eval harness also checks this post-run.
**Warning signs:** Findings cite functions that don't exist when you check; file paths look plausible but `ls` fails.
[CITED: AI-SPEC Section 1b Known Failure Modes #3]

---

## Code Examples

### Orchestrator Agent Definition Skeleton

```markdown
<!-- Source: AI-SPEC Section 4 Implementation Guidance + agents/gsd-codebase-mapper.md pattern -->
---
name: gsd-sme-creator
description: Analyzes a codebase process and produces a structured SME document.
tools: Read, Bash, Grep, Glob, Write, Task
color: "#F59E0B"
---

<role>
You are a GSD SME creator. Given PROCESS_NAME, analyze code paths, git history, PR
descriptions, and docs to produce .planning/smes/{PROCESS_NAME}-SME.md.

Sub-agents write directly to .tmp files. You synthesize findings into the final doc.

BLOCKER: Apply ONLY when violation would break a known production behavior or data contract.
WARNING: Apply for lower-stakes risks or known limitations.
WATCH: Apply for code smells or theoretical risks with no current production evidence.
</role>

<severity_examples>
BLOCKER example:
> **BLOCKER: phase-runner.ts allows concurrent phase execution**
> File: sdk/src/phase-runner.ts, function run(), lines 91-200
> Why: Concurrent guard removed in commit a4b2c1d (PR #47) to fix CLI timeout.
> Evidence: git log --grep="concurrent" sdk/src/phase-runner.ts — PR #47: "deferred locking fix"

WARNING example:
> **WARNING: sme.detect-processes uses keyword matching only**
> File: sdk/src/query/sme.ts
> Why: MVP keyword match; abbreviations won't match. Documented in code comment line 47.
> Evidence: // TODO: semantic matching — keyword MVP only (phase-2)
</severity_examples>

<process>

<step name="detect_capabilities">
Check if Task tool is available. If not, perform analysis sequentially (4 passes).
</step>

<step name="partition_code_paths">
Identify files belonging to this process:
```bash
grep -rl "{PROCESS_NAME}" --include="*.ts" sdk/src/ agents/ get-shit-done/
find . -name "*{process_name}*" -not -path "*/node_modules/*" -not -path "*/.planning/*"
```
Group into partitions of 5-10 files.
Create .planning/smes/.tmp/ directory.
Get HEAD commit: git rev-parse HEAD
</step>

<step name="spawn_analyzers" condition="Task tool available">
For each partition N, spawn with run_in_background=true:
Task(
  subagent_type="gsd-sme-creator-analyzer",
  description="Analyze {PROCESS_NAME} files partition {N}",
  run_in_background=true,
  prompt="Process: {PROCESS_NAME}
Files: {comma_separated_file_list}
Output: .planning/smes/.tmp/{PROCESS_NAME}-part-{N}.md
..."
)
</step>

<step name="collect_results">
Call TaskOutput for ALL spawned tasks with block=true, timeout=300000.
Then read each .planning/smes/.tmp/{PROCESS_NAME}-part-{N}.md.
</step>

<step name="synthesize_and_write">
Merge findings. Deduplicate (same file + same line range = same finding).
Apply severity. Write .planning/smes/{PROCESS_NAME}-SME.md atomically.
Self-check: grep -c required section headers (must be >= 6).
Delete .planning/smes/.tmp/ after successful write.
</step>

</process>
```

### Analyzer Sub-Agent Definition Skeleton

```markdown
<!-- Source: AI-SPEC Section 4 Implementation Guidance -->
---
name: gsd-sme-creator-analyzer
description: Analyzes a file partition for SME risks. Writes findings to .tmp file. Spawned by gsd-sme-creator.
tools: Read, Bash, Grep, Glob, Write
color: "#F59E0B"
---

<role>
You are a GSD SME analyzer sub-agent. Analyze a set of files for a named process.
Write compressed findings to the designated output path.
Return finding count only — NOT full content.
</role>

<process>
For each file in the provided file list:
1. Read file for code pattern analysis
2. git log --follow -n 50 <file>      # REQUIRED — traces renames
3. git log --grep="Merge pull request" --format="%s%n%b" -n 20 <file>  # PR descriptions
4. Identify: risks, test gaps, outdated logic, edge cases

For each finding: record file path, function, line range, why (commit/PR/comment), evidence.

Write to designated output path. Return: "N findings written to [path]"
</process>
```

### Process File Discovery Pattern

```bash
# Find files related to a named process (run by orchestrator)
grep -rl "contribution" --include="*.ts" sdk/src/ agents/ get-shit-done/ 2>/dev/null
find . -name "*contribution*" -not -path "*/node_modules/*" -not -path "*/.planning/*" -not -path "*/.claude/*"

# Get HEAD commit for frontmatter
git rev-parse HEAD

# Verify a file path exists before citing it in a finding
ls src/contributions/processor.ts && echo "EXISTS" || echo "NOT FOUND"
```

### Promptfoo Eval Config (from AI-SPEC)

```yaml
# evals/sme-creator.promptfooconfig.yaml
description: SME Creator Agent — regression eval suite

tests:
  - description: "Schema completeness"
    assert:
      - type: javascript
        value: |
          const sme = require('fs').readFileSync(
            '.planning/smes/contribution-processing-SME.md', 'utf-8');
          return /last_analyzed_commit: [0-9a-f]{7,40}/.test(sme);
      - type: javascript
        value: |
          const sme = require('fs').readFileSync(
            '.planning/smes/contribution-processing-SME.md', 'utf-8');
          const headers = (sme.match(/^## /gm) || []).length;
          return headers >= 6;

  - description: "BLOCKER must cite evidence of production failure path"
    assert:
      - type: llm-rubric
        value: |
          Every BLOCKER finding must include a specific commit hash, PR number,
          or code comment as evidence of a real production failure path.
          A BLOCKER without historical evidence is a FAIL.

  - description: "No hallucinated file paths"
    assert:
      - type: javascript
        value: |
          const fs = require('fs');
          const sme = fs.readFileSync(
            '.planning/smes/contribution-processing-SME.md', 'utf-8');
          const paths = [...sme.matchAll(/`((?:src|sdk|agents)[^`]+\.ts)`/g)].map(m => m[1]);
          return paths.every(p => { try { fs.statSync(p); return true; } catch { return false; } });
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single-agent sequential analysis | Parallel sub-agent decomposition via Task/TaskOutput | Established in gsd-map-codebase pattern | Each sub-agent gets a fresh 200k context; no context budget exhaustion on large codepaths |
| Agents hold all data in context | Sub-agents write files; orchestrator reads summaries only | Same | Prevents orchestrator context saturation |

**Deprecated/outdated:**
- `execSync()` in async stream processing: Never use inside a `for await` loop on a `query()` stream — blocks the Node.js event loop. Git commands belong inside the agent's Bash tool calls.

---

## Open Questions

1. **SDK version pin vs. upgrade**
   - What we know: Installed is 0.2.84; latest npm is 0.2.123. Task/TaskOutput work in 0.2.84.
   - What's unclear: Whether 0.2.123 has behavioral changes relevant to sub-agent spawning or budget enforcement.
   - Recommendation: Note for planner; upgrade is not required for Phase 3 to function.

2. **Partition sizing heuristic**
   - What we know: AI-SPEC recommends 5-10 files per partition, and that a single file >500 lines warrants its own sub-agent.
   - What's unclear: How to handle processes where the file set is empty (no files match grep) — new process with no code yet.
   - Recommendation: Orchestrator should handle the zero-file case gracefully: emit a warning, produce a minimal SME doc with "Process not yet implemented" in Process Overview.

3. **Plan count decomposition**
   - What we know: Phase 3 requires two agent markdown files + an eval config.
   - What's unclear: Whether to write these as 1 plan (single task wave) or 2 plans (orchestrator + analyzer separately).
   - Recommendation: 2 plans makes sense — Plan 1: both agent files with integration between them; Plan 2: eval harness setup and validation. Keeps the per-plan scope manageable.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js >= 22 | Agent SDK, SDK tests | Partial | v20.20.2 (below project requirement) | None — CLAUDE.md requires >= 22; flag for planner |
| `@anthropic-ai/claude-agent-sdk` | Agent spawning | Yes | 0.2.84 | — |
| git | `git log --follow` analysis | Yes | 2.43.0 | — |
| Docker | Arize Phoenix tracing | Yes | 28.5.0 | Python `pip install arize-phoenix` (also available) |
| Python 3 | Arize Phoenix setup script | Yes | 3.12.3 | — |
| promptfoo | Eval CI/CD | Yes (via npx) | 0.121.9 | — |
| vitest | Unit tests | Yes | ^3.1.1 | — |

**Missing dependencies with no fallback:**
- Node.js is v20.20.2 but CLAUDE.md specifies >= 22. This is a pre-existing environment mismatch — not introduced by Phase 3. Flag for awareness; tests pass on v20 today.

**Missing dependencies with fallback:**
- None affecting Phase 3 core deliverables (agent markdown files).

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CREATE-01 | `gsd-sme-creator` agent analyzes code paths, git history, PR descriptions, comments, and docs to produce structured SME documents | Fulfilled by gsd-sme-creator.md orchestrator agent using Read/Bash/Grep/Glob tools to discover files + git log in analyzer sub-agents |
| CREATE-02 | Creator uses parallel sub-agent decomposition for large process codepaths (following `gsd-map-codebase` pattern) | Fulfilled by Task/TaskOutput pattern verified in get-shit-done/workflows/map-codebase.md; gsd-sme-creator spawns gsd-sme-creator-analyzer agents per partition |
| CREATE-03 | Creator produces a complete `.planning/smes/{PROCESS_NAME}-SME.md` with all required sections and severity-labeled findings | Fulfilled by orchestrator synthesis step writing a complete document per the Phase 1 template schema (6 H2 sections, frontmatter with last_analyzed_commit) |
| CREATE-04 | Creator captures the "why" behind patterns using `git log --follow` and PR descriptions, not just current code state | Fulfilled by explicit `git log --follow -n 50 <file>` requirement in analyzer agent instructions; inline few-shot examples enforce "why must cite evidence" in findings |
</phase_requirements>

---

## Validation Architecture

nyquist_validation is enabled (workflow.nyquist_validation: true in .planning/config.json).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.1.1 |
| Config file | sdk/vitest.config.ts |
| Quick run command | `cd sdk && npx vitest run --project unit` |
| Full suite command | `cd sdk && npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CREATE-01 | gsd-sme-creator agent file exists with required frontmatter | manual | `ls agents/gsd-sme-creator.md` | No — Wave 0 |
| CREATE-01 | gsd-sme-creator-analyzer agent file exists | manual | `ls agents/gsd-sme-creator-analyzer.md` | No — Wave 0 |
| CREATE-02 | Orchestrator agent includes Task in tools frontmatter | manual | `grep "Task" agents/gsd-sme-creator.md` | No — Wave 0 |
| CREATE-02 | Analyzer agent does NOT include Task in tools frontmatter | manual | `grep -v "Task" agents/gsd-sme-creator-analyzer.md` | No — Wave 0 |
| CREATE-03 | SME document has all 6 required section headers | unit | `cd sdk && npx vitest run --project unit` (no test yet) | No — Wave 0 |
| CREATE-04 | Analyzer instructions include `git log --follow` | manual | `grep "follow" agents/gsd-sme-creator-analyzer.md` | No — Wave 0 |

**Note on testing approach:** Phase 3 deliverables are markdown agent definition files and a Promptfoo eval config — not TypeScript code. Unit tests in Vitest cover TypeScript utilities. The agent behavior correctness is validated via:
1. Manual inspection (agent file structure, required keys)
2. Bash assertions (grep for required sections, tools lists)
3. Promptfoo eval harness (agent behavior against test cases per AI-SPEC Section 5)

The Promptfoo eval is the primary quality gate for agent correctness. Unit tests apply only if TypeScript helpers (e.g., Zod schema for frontmatter validation) are added.

### Sampling Rate
- **Per task commit:** `grep -c "## Process Overview" agents/gsd-sme-creator.md` (structural check)
- **Per wave merge:** `cd sdk && npx vitest run --project unit`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] Promptfoo eval config: `evals/sme-creator.promptfooconfig.yaml` — covers CREATE-01/03/04
- [ ] `evals/` directory creation if not present
- [ ] Any TypeScript Zod schema utilities (only if workflow-level validation is in Phase 3 scope vs. Phase 4)

---

## Security Domain

security_enforcement is not explicitly set to false — treating as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Internal developer tool, no auth surface |
| V3 Session Management | No | Agent sessions are managed by SDK |
| V4 Access Control | No | No multi-user access model |
| V5 Input Validation | Yes | Process name input must be validated (path traversal via process name) |
| V6 Cryptography | No | No cryptographic operations |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal via process name | Tampering | Process name must match `[a-zA-Z0-9_-]+` (same constraint as `sme.processes.{name}.block_mode` per Phase 1 decision) — validate before using in file path construction |
| Git command injection via file paths | Tampering | File paths passed to `git log --follow` should come from grep/glob discovery (repo-controlled), not from user input directly |
| Fabricated findings (hallucination) | Spoofing | Workflow-level file existence check for all cited paths before accepting agent output; `stat()` each path |

**Established security decision from Phase 1 (from STATE.md):**
- `sme.processes.{name}.block_mode` restricted to `[a-zA-Z0-9_-]+` regex — same pattern applies to PROCESS_NAME used in file path construction for the creator agent.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Phase 4 is responsible for the `create-sme.md` workflow and `/gsd-create-sme` command; Phase 3 delivers only the agent markdown files | Scope / Architecture | If Phase 3 is expected to deliver the workflow too, plan needs more tasks |
| A2 | The `Task` tool is available in the Claude Code environment where the SME creator will run | Standard Stack | Sequential fallback handles this, but parallel decomposition (CREATE-02) only works when Task is available |
| A3 | Process name input arrives via the workflow's `prompt` parameter, not embedded in the agent definition | Code Examples | If process name is baked into agent markdown, the agent is not reusable |

**If this table is empty:** All claims were verified. Three assumptions were identified above — all are low-risk given the sequential fallback and Phase 4 boundary is clearly stated in ROADMAP.md.

---

## Sources

### Primary (HIGH confidence)
- `agents/gsd-codebase-mapper.md` — canonical reference for agent definition format, parallel decomposition pattern [VERIFIED: repo]
- `get-shit-done/workflows/map-codebase.md` — canonical Task/TaskOutput pattern, spawn/collect/wait contract [VERIFIED: repo]
- `.planning/phases/03-sme-creator-agent/03-AI-SPEC.md` — implementation guidance, eval strategy, pitfalls, severity calibration [VERIFIED: repo]
- `get-shit-done/templates/sme.md` — Phase 1 output; exact document schema agent must produce [VERIFIED: repo]
- `sdk/src/query/sme.ts` — Phase 2 output; SDK query handlers; confirms sme.list/detect/context-block are complete [VERIFIED: repo]
- `sdk/src/query/index.ts` — confirms sme.* handlers registered in query registry [VERIFIED: repo]
- `sdk/src/session-runner.ts` — query() invocation pattern; allowedTools, settingSources, permissionMode [VERIFIED: repo]
- `@anthropic-ai/claude-agent-sdk@0.2.84` [VERIFIED: npm list in sdk/]
- Latest SDK version: 0.2.123 [VERIFIED: npm view @anthropic-ai/claude-agent-sdk version]

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` — confirmed Phase 2 complete; security decisions on process name validation
- `.planning/ROADMAP.md` — phase boundary confirmation (Phase 3 = agents only, Phase 4 = workflow + command)
- `.planning/REQUIREMENTS.md` — CREATE-01 through CREATE-04 requirement text

### Tertiary (LOW confidence — training knowledge)
- Promptfoo 0.121.9 `llm-rubric` and `model-graded-closedqa` assertion types — verified version via npx but assertion type behavior from training knowledge
- Arize Phoenix OpenTelemetry integration with Claude Agent SDK — from AI-SPEC, not independently verified in this session

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified against installed versions
- Architecture: HIGH — canonical patterns verified from existing repo files
- Pitfalls: HIGH — sourced from AI-SPEC which was researched against primary literature
- Eval tooling: MEDIUM — Promptfoo version verified; LLM judge behavior from AI-SPEC

**Research date:** 2026-04-29
**Valid until:** 2026-05-29 (30 days — stable agent SDK, stable project patterns)
