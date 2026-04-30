---
phase: 03-sme-creator-agent
plan: "02"
subsystem: evals
tags: [sme, eval, promptfoo, regression, quality-gate]
dependency_graph:
  requires:
    - 03-01 (gsd-sme-creator and gsd-sme-creator-analyzer agent definitions)
    - 01-01 (SME template schema -- sme.md output format contract)
  provides:
    - evals/sme-creator.promptfooconfig.yaml (Promptfoo regression eval suite for SME creator agent)
  affects:
    - CI/CD quality gate for SME creator agent regressions
    - Phase 6 plan-phase gate (eval suite validates SME document quality before gate use)
tech_stack:
  added: []
  patterns:
    - Promptfoo javascript assertion type for code-based checks (no LLM cost)
    - Promptfoo llm-rubric assertion type for semantic severity calibration
    - Filesystem assertions reading from .planning/smes/ at eval time
key_files:
  created:
    - evals/sme-creator.promptfooconfig.yaml
  modified: []
decisions:
  - "9 javascript + 1 llm-rubric assertions -- code assertions are fast/free; LLM judge reserved for BLOCKER severity calibration only"
  - "Assertions read from first *-SME.md file found in .planning/smes/ -- avoids hardcoding a process name, works with any generated SME document"
  - "fs.accessSync for .tmp cleanup check returns true-on-error (cleaned up) pattern -- aligns with plan spec"
  - "Process boundary check uses 70% threshold -- allows some findings to reference shared utilities while flagging clear scope drift"
metrics:
  duration: "1 minute"
  completed: "2026-04-30"
  tasks_completed: 1
  files_created: 1
  files_modified: 0
---

# Phase 03 Plan 02: Promptfoo Eval Config and Phase 3 Verification Summary

## One-liner

10-test Promptfoo regression eval suite for the SME creator agent covering schema completeness, BLOCKER severity calibration (llm-rubric), finding traceability, hallucinated path detection, process boundary adherence, task completion, and .tmp cleanup verification.

## What Was Built

### evals/sme-creator.promptfooconfig.yaml (182 lines)

The regression eval suite for `gsd-sme-creator`. Key characteristics:

- **Run instructions as comment header** -- `npx promptfoo eval` and `--filter-type javascript` (code-only, no LLM cost)
- **Top-level description** -- `description: SME Creator Agent -- regression eval suite`
- **10 test cases** covering 8 eval dimensions from AI-SPEC Section 5:
  1. Schema: `last_analyzed_commit` as valid git SHA (`[0-9a-f]{7,40}` regex)
  2. Schema: `block_mode: (soft|strict)` present
  3. Schema: `finding_counts:` with `blocker:`, `warning:`, `watch:` all present
  4. Schema: All 6 required H2 section headers present (Process Overview, Identified Risks, Test Gaps, Outdated Logic, Edge Cases, Known Blockers)
  5. BLOCKER severity: `llm-rubric` assertion requiring historical evidence (commit hash, PR, or code comment) for every BLOCKER finding
  6. Finding traceability: Every `[BLOCKER|WARNING|WATCH]` block contains `File:` or backtick-quoted path
  7. Hallucination detection: Every backtick-quoted `.ts` path matching known repo prefixes must pass `fs.statSync`
  8. Process boundary: >= 70% of cited `.ts` paths must contain the process name (hyphens stripped)
  9. Task completion: SME document length > 200 chars and at least one finding marker exists
  10. Cleanup: `.planning/smes/.tmp` directory must NOT exist after agent completion (`fs.accessSync` throws on success)
- **Dynamic SME file discovery** -- reads the first `*-SME.md` file found in `.planning/smes/` to avoid hardcoding a specific process name
- **Graceful missing-directory handling** -- all assertions return `false` (not throw) when `.planning/smes/` doesn't exist yet

## Status Note

Plan 02 reached a `checkpoint:human-verify` at Task 2. Task 1 (eval config creation) was completed and committed. Task 2 awaits human review of all three Phase 3 deliverables.

## Automated Pre-Checks (Task 2)

All pre-checks passed before checkpoint:

| Check | Result |
|-------|--------|
| All 3 deliverable files exist | PASS |
| Orchestrator has Task in tools | PASS (`tools: Read, Bash, Grep, Glob, Write, Task`) |
| Analyzer does NOT have Task in tools | PASS (`tools: Read, Bash, Grep, Glob, Write`) |
| subagent_type name match | PASS (`gsd-sme-creator-analyzer` == `gsd-sme-creator-analyzer`) |
| git log --follow in analyzer | PASS (6 occurrences) |
| Sequential fallback in orchestrator | PASS (4 matches) |
| Severity examples in orchestrator | PASS (2 occurrences) |
| Eval config javascript assertions | PASS (9 assertions) |
| Eval config llm-rubric assertions | PASS (1 assertion) |

## Deviations from Plan

None - plan executed exactly as written.

## Threat Model Coverage

| Threat ID | Disposition | Notes |
|-----------|-------------|-------|
| T-03-06 | accept | JavaScript assertions read .planning/smes/ content (code analysis, no PII). Forbidden_files block in analyzer prevents secrets entering SME docs. |
| T-03-07 | accept | Eval assertions are developer-run CI tools. Promptfoo has built-in timeout per assertion. |

## Known Stubs

None. The eval config reads real SME files from `.planning/smes/` at eval time. No hardcoded mock data.

## Threat Flags

None. The eval config reads local filesystem files only. No new network endpoints, auth paths, or trust boundary surfaces introduced.

## Self-Check

### Files exist:

- evals/sme-creator.promptfooconfig.yaml -- FOUND (182 lines)

### Commits exist:

- 46634eb4: feat(03-02): add Promptfoo regression eval suite for SME creator agent

### Acceptance criteria verification:

- evals/ directory exists: PASS
- evals/sme-creator.promptfooconfig.yaml exists: PASS
- Comment header with run instructions: PASS (lines 1-2)
- Top-level `description: SME Creator Agent`: PASS
- >= 7 `type: javascript` assertions: PASS (9 assertions)
- >= 1 `type: llm-rubric` assertion: PASS (1 assertion)
- `last_analyzed_commit` regex check with `[0-9a-f]{7,40}`: PASS
- `block_mode` check with `(soft|strict)`: PASS
- `finding_counts:` check with blocker, warning, watch: PASS
- All 6 required section headers: PASS (Process Overview, Identified Risks, Test Gaps, Outdated Logic, Edge Cases, Known Blockers)
- Hallucinated file path check using `fs.statSync`: PASS
- `.tmp` cleanup check using `fs.accessSync`: PASS
- YAML syntax valid: PASS (python3 yaml.safe_load confirmed)

## Self-Check: PASSED
