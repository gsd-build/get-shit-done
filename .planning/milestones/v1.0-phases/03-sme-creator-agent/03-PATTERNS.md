# Phase 3: SME Creator Agent - Pattern Map

**Mapped:** 2026-04-29
**Files analyzed:** 3 new files (2 agent definitions + 1 eval config)
**Analogs found:** 2 / 3 (1 file type has no close analog in codebase)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `agents/gsd-sme-creator.md` | agent (orchestrator) | event-driven, file-I/O | `get-shit-done/workflows/map-codebase.md` + `agents/gsd-codebase-mapper.md` | exact — same Task/TaskOutput spawn/collect/synthesize pattern |
| `agents/gsd-sme-creator-analyzer.md` | agent (sub-agent) | file-I/O, batch | `agents/gsd-codebase-mapper.md` | exact — same sub-agent write-files-directly / return-confirmation-only pattern |
| `evals/sme-creator.promptfooconfig.yaml` | config (eval harness) | batch | none — no eval configs exist in repo yet | no analog |

---

## Pattern Assignments

### `agents/gsd-sme-creator.md` (agent, orchestrator, event-driven + file-I/O)

**Primary analog:** `get-shit-done/workflows/map-codebase.md`
**Secondary analog:** `agents/gsd-codebase-mapper.md` (for agent file format)

---

#### Frontmatter pattern

**Source:** `agents/gsd-codebase-mapper.md` lines 1-12 AND `agents/gsd-executor.md` lines 1-12

```markdown
---
name: gsd-sme-creator
description: Analyzes a codebase process and produces a structured SME document.
tools: Read, Bash, Grep, Glob, Write, Task
color: "#F59E0B"
# hooks:
#   PostToolUse:
#     - matcher: "Write|Edit"
#       hooks:
#         - type: command
#           command: "npx eslint --fix $FILE 2>/dev/null || true"
---
```

Key facts from analogs:
- `name:` must exactly match what callers use in `subagent_type="..."` — verified in `map-codebase.md` where `subagent_type="gsd-codebase-mapper"` matches `name: gsd-codebase-mapper` in the agent file
- Orchestrators that spawn sub-agents include `Task` in the `tools:` list; sub-agents that only write files do NOT
- `color:` is a display hint — use `"#F59E0B"` (amber) per RESEARCH.md spec; analogs use `cyan`, `yellow`, `green` per role

---

#### Role block pattern (inline few-shot examples)

**Source:** `agents/gsd-codebase-mapper.md` lines 14-28 (role block structure); severity examples are specific to SME domain per RESEARCH.md Pattern 8

The `<role>` block announces identity, summarizes job, and provides calibration examples. Copy the structure from `gsd-codebase-mapper.md` lines 14-28:

```markdown
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
```

---

#### Capability detection + sequential fallback pattern

**Source:** `get-shit-done/workflows/map-codebase.md` lines 130-137 (`detect_runtime_capabilities` step)

```markdown
<step name="detect_capabilities">
Before spawning agents, detect whether the current runtime supports the `Task` tool
for subagent delegation.

If you do NOT have a `Task`/`task` tool:
→ Skip spawn_analyzers and collect_results — go directly to sequential_analysis instead.

CRITICAL: Never use `browser_subagent` or `Explore` as a substitute for `Task`.
</step>
```

---

#### Process step structure pattern

**Source:** `agents/gsd-codebase-mapper.md` lines 87-199 (`<process>` block with named `<step>` elements); `get-shit-done/workflows/map-codebase.md` lines 28-432

The process uses named `<step>` elements with optional `condition=` attributes. Copy this structure exactly:

```markdown
<process>

<step name="detect_capabilities">
...
</step>

<step name="partition_code_paths">
...
</step>

<step name="spawn_analyzers" condition="Task tool available">
...
</step>

<step name="sequential_analysis" condition="Task tool is NOT available">
...
</step>

<step name="collect_results">
...
</step>

<step name="synthesize_and_write">
...
</step>

</process>
```

---

#### Parallel spawn pattern (Task/TaskOutput)

**Source:** `get-shit-done/workflows/map-codebase.md` lines 139-252 (`spawn_agents` and `collect_confirmations` steps)

This is the exact spawn pattern verified in the codebase — copy it directly:

```markdown
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

> ORCHESTRATOR RULE: After calling all Task() calls above with run_in_background=true,
> do NOT read any output files while sub-agents are active. Wait for all TaskOutput
> calls to complete before reading .tmp files.
</step>

<step name="collect_results">
Call TaskOutput for ALL spawned tasks with block=true, timeout=300000.
Call ALL TaskOutput calls in parallel (single message with N TaskOutput calls).

TaskOutput tool:
  task_id: "{task_id from Task result}"
  block: true
  timeout: 300000

Then — and ONLY then — read each .planning/smes/.tmp/{PROCESS_NAME}-part-{N}.md.
</step>
```

**Critical contract** (from `map-codebase.md` lines 255-289): Call TaskOutput for ALL spawned agents in a single message (parallel), not sequentially. This is the `collect_confirmations` step in the canonical analog.

---

#### File discovery bash pattern

**Source:** RESEARCH.md Pattern 5 + `agents/gsd-codebase-mapper.md` lines 113-167 (explore_codebase bash patterns)

```markdown
<step name="partition_code_paths">
Identify files belonging to this process:
```bash
grep -rl "{PROCESS_NAME}" --include="*.ts" sdk/src/ agents/ get-shit-done/
find . -name "*{process_name}*" -not -path "*/node_modules/*" -not -path "*/.planning/*"
```

Group into partitions of 5-10 files (files >500 lines get their own partition).
Create .planning/smes/.tmp/ directory.
Get HEAD commit: git rev-parse HEAD

Handle zero-file case: if no files match, emit warning and produce minimal SME doc
with "Process not yet implemented" in ## Process Overview.
</step>
```

---

#### Self-check pattern

**Source:** RESEARCH.md Pattern 7 (no direct codebase analog exists — this is spec'd in AI-SPEC)

```markdown
<step name="synthesize_and_write">
Merge findings. Deduplicate (same file + same line range = same finding).
Apply severity. Write .planning/smes/{PROCESS_NAME}-SME.md atomically.

Self-check:
```bash
SECTION_COUNT=$(grep -c "## Process Overview\|## Identified Risks\|## Test Gaps\|## Outdated Logic\|## Edge Cases\|## Known Blockers" \
  .planning/smes/${PROCESS_NAME}-SME.md)
# Must be >= 6
```

On failure: rewrite missing sections. Maximum 2 repair attempts.
On second failure: write document with ## INCOMPLETE marker, exit with section count.

Delete .planning/smes/.tmp/ after successful write.
</step>
```

---

#### Return confirmation pattern

**Source:** `agents/gsd-codebase-mapper.md` lines 183-199 (`return_confirmation` step)

Sub-agents return confirmation only — orchestrators return a brief summary. The orchestrator here collects sub-agent confirmations (finding counts) and then synthesizes:

```markdown
<step name="return_confirmation">
Return a brief confirmation. DO NOT include document contents.

Format:
```
## SME Creation Complete

**Process:** {PROCESS_NAME}
**Output:** `.planning/smes/{PROCESS_NAME}-SME.md`
**Findings:** {blocker_count} BLOCKERs, {warning_count} WARNINGs, {watch_count} WATCHes
**Commit:** {last_analyzed_commit}
```
</step>
```

---

#### Critical rules block pattern

**Source:** `agents/gsd-codebase-mapper.md` lines 830-844 (`<critical_rules>` block)

```markdown
<critical_rules>

**SUB-AGENTS WRITE FILES DIRECTLY.** Do not hold raw code or full git history in orchestrator
context. Route all file analysis to sub-agents. Orchestrator reads only compressed summaries.

**ALWAYS CALL TaskOutput(block=true) BEFORE READING OUTPUT FILES.** Reading a .tmp file before
the sub-agent completes returns empty or partial content silently.

**subagent_type MUST MATCH name: EXACTLY.** Use "gsd-sme-creator-analyzer" — any mismatch
silently falls back to a generic agent with no role instructions.

**BLOCKER SEVERITY IS STRICT.** Only apply BLOCKER when violation would break a known production
behavior or data contract. BLOCKER inflation destroys trust in the gate.

**VALIDATE FILE PATHS BEFORE CITING.** For each file path in a finding, verify existence with
`ls <path>` before writing the finding to the output document.

</critical_rules>
```

---

### `agents/gsd-sme-creator-analyzer.md` (agent, sub-agent, file-I/O + batch)

**Analog:** `agents/gsd-codebase-mapper.md`

---

#### Frontmatter pattern

**Source:** `agents/gsd-codebase-mapper.md` lines 1-12

Sub-agents do NOT include `Task` in tools — they only need file and bash access:

```markdown
---
name: gsd-sme-creator-analyzer
description: Analyzes a file partition for SME risks, test gaps, outdated logic, and edge cases. Writes findings to .tmp file. Spawned by gsd-sme-creator.
tools: Read, Bash, Grep, Glob, Write
color: "#F59E0B"
---
```

---

#### Role block pattern

**Source:** `agents/gsd-codebase-mapper.md` lines 14-36

```markdown
<role>
You are a GSD SME analyzer sub-agent. Analyze a set of files for a named process.
Write compressed findings to the designated output path.
Return finding count only — NOT full content.

Your job: Read files + git history, identify risks, write findings to .tmp file, confirm count.
</role>
```

---

#### Core analysis process pattern

**Source:** `agents/gsd-codebase-mapper.md` lines 113-167 (explore_codebase step patterns) + RESEARCH.md Pattern 5

```markdown
<process>

For each file in the provided file list:
1. Read file for code pattern analysis
2. Verify file path exists: `ls <file>` — do NOT analyze or cite files that don't exist
3. ```bash
   git log --follow -n 50 <file>      # REQUIRED — traces renames; --follow is mandatory
   git log --grep="Merge pull request" --format="%s%n%b" -n 20 <file>  # PR descriptions
   ```
   NOTE: NEVER use `git log --all` — includes all branches, unbounded output.
4. Identify: risks, test gaps, outdated logic, edge cases

For each finding:
- Record file path, function name, line range
- Record WHY (commit hash, PR number, or code comment) — not just WHAT
- Apply severity: BLOCKER / WARNING / WATCH per definitions in orchestrator prompt

For BLOCKER findings: must include a specific commit hash, PR number, or code comment
as evidence of a real production failure path. A BLOCKER without historical evidence
is malformed — downgrade to WARNING.

Write to designated output path. Return ONLY: "N findings written to [path]"
</process>
```

---

#### File output pattern

**Source:** `agents/gsd-codebase-mapper.md` lines 170-181 (`write_documents` step) — sub-agents write files directly, return confirmation only

```markdown
Write compressed findings to `.planning/smes/.tmp/{PROCESS_NAME}-part-{N}.md`.

Use this structure per finding:
```
[SEVERITY] **Bold Title**
File: `path/to/file.ts`, function `name()`, lines X-Y
Why: [commit hash or PR or comment that explains the pattern]
Evidence: [specific git log output, code comment, or PR description]
Mitigation: [concrete action]
```

Return: "N findings written to .planning/smes/.tmp/{PROCESS_NAME}-part-{N}.md"
```

---

#### Forbidden files pattern

**Source:** `agents/gsd-codebase-mapper.md` lines 808-828 (`<forbidden_files>` block)

Copy this block verbatim into the analyzer agent to prevent secrets leakage into findings:

```markdown
<forbidden_files>
NEVER read or quote contents from: .env, .env.*, *.env, credentials.*, secrets.*,
*secret*, *credential*, *.pem, *.key, .npmrc, serviceAccountKey.json.

If you encounter these files: note EXISTENCE only, never quote contents.
</forbidden_files>
```

---

#### Return confirmation pattern (sub-agent)

**Source:** `agents/gsd-codebase-mapper.md` lines 183-199

```markdown
<step name="return_confirmation">
Return a brief confirmation. DO NOT include findings content.

Format:
```
N findings written to .planning/smes/.tmp/{PROCESS_NAME}-part-{N}.md
```
</step>
```

---

### `evals/sme-creator.promptfooconfig.yaml` (config, eval harness, batch)

**Analog:** None — no eval configs exist in this repo yet.

Use the RESEARCH.md Code Examples section (Promptfoo Eval Config from AI-SPEC) as the primary reference. The file structure comes from Promptfoo 0.121.9 documentation.

**Key structural facts from RESEARCH.md:**
- Top-level `description:` field
- `tests:` array of test case objects
- Each test has `description:` and `assert:` array
- Assert types: `javascript` (for file content checks), `llm-rubric` (for behavior quality)
- `llm-rubric` checks agent output quality against a natural-language rubric
- The eval runs against a real SME document produced by the agent (file-based assertion)

```yaml
# evals/sme-creator.promptfooconfig.yaml
description: SME Creator Agent — regression eval suite

tests:
  - description: "Schema completeness — frontmatter has last_analyzed_commit"
    assert:
      - type: javascript
        value: |
          const sme = require('fs').readFileSync(
            '.planning/smes/contribution-processing-SME.md', 'utf-8');
          return /last_analyzed_commit: [0-9a-f]{7,40}/.test(sme);

  - description: "Schema completeness — document has all 6 required section headers"
    assert:
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
          return paths.every(p => {
            try { fs.statSync(p); return true; } catch { return false; }
          });
```

---

## Shared Patterns

### Agent file structure
**Source:** All agent files in `agents/` (canonical: `agents/gsd-codebase-mapper.md`)
**Apply to:** Both `agents/gsd-sme-creator.md` and `agents/gsd-sme-creator-analyzer.md`

Every agent file uses this document structure:
1. YAML frontmatter block with `name:`, `description:`, `tools:`, `color:`
2. `<role>` block — identity, job summary, key constraints
3. Optional domain-specific blocks (e.g., `<severity_examples>`, `<forbidden_files>`)
4. `<process>` block with named `<step>` elements (some with `condition=` attributes)
5. `<critical_rules>` block — hard constraints in bold
6. `<success_criteria>` block — checklist format

### Parallel spawn / wait / read contract
**Source:** `get-shit-done/workflows/map-codebase.md` lines 139-289
**Apply to:** `agents/gsd-sme-creator.md` (orchestrator step: `spawn_analyzers` and `collect_results`)

Three-phase contract that must not be broken:
1. Spawn ALL sub-agents with `run_in_background=true` in a single step
2. Call `TaskOutput(block=true)` for ALL tasks in a single message (parallel) — do not call one at a time
3. Only AFTER all TaskOutput calls return — read the output files

### Sub-agent writes files; orchestrator reads summaries
**Source:** `agents/gsd-codebase-mapper.md` (agent writes docs directly, returns `## Mapping Complete` confirmation); `get-shit-done/workflows/map-codebase.md` lines 254-289 (orchestrator collects line counts, not file contents)
**Apply to:** Both agent files

- Analyzer sub-agent: writes full findings to `.planning/smes/.tmp/{PROCESS_NAME}-part-{N}.md`; returns only `"N findings written to [path]"`
- Orchestrator: never reads raw file content or git logs directly (in parallel mode); reads only compressed `.tmp` findings after TaskOutput completes

### Sequential fallback when Task unavailable
**Source:** `get-shit-done/workflows/map-codebase.md` lines 130-137 and lines 290-322 (`sequential_mapping` step)
**Apply to:** `agents/gsd-sme-creator.md`

Detect Task availability first. If absent, perform analysis in 4 sequential passes (code patterns → git history → test gaps → synthesis), writing partial findings to keep context below 50%. This exactly mirrors the `sequential_mapping` step in `map-codebase.md`.

### Forbidden file safety block
**Source:** `agents/gsd-codebase-mapper.md` lines 808-828
**Apply to:** `agents/gsd-sme-creator-analyzer.md`

Copy the `<forbidden_files>` block verbatim. The analyzer reads production code and git history — high surface area for accidentally touching credential files.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `evals/sme-creator.promptfooconfig.yaml` | config | batch | No eval configs or Promptfoo configs exist in this repo yet. Use RESEARCH.md Code Examples section (sourced from AI-SPEC) as the template. The `evals/` directory must be created. |

---

## Metadata

**Analog search scope:** `agents/`, `get-shit-done/workflows/`, `get-shit-done/templates/`
**Files scanned:** 6 analog files read (gsd-codebase-mapper.md, map-codebase.md, gsd-executor.md, gsd-phase-researcher.md, gsd-verifier.md, gsd-pattern-mapper.md)
**Pattern extraction date:** 2026-04-29

**Name-match verification (critical):**
- `agents/gsd-sme-creator.md` must have `name: gsd-sme-creator` in frontmatter
- `agents/gsd-sme-creator-analyzer.md` must have `name: gsd-sme-creator-analyzer` in frontmatter
- Any `Task()` call in gsd-sme-creator must use `subagent_type="gsd-sme-creator-analyzer"` — exactly this string
