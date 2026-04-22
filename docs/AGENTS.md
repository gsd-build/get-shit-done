# GSD Agent Reference

> Full role cards for 21 primary agents plus concise stubs for 10 advanced/specialized agents (31 shipped agents total). The `agents/` directory and [`docs/INVENTORY.md`](INVENTORY.md) are the authoritative roster; see [Architecture](ARCHITECTURE.md) for context.

---

## Overview

GSD uses a multi-agent architecture where thin orchestrators (workflow files) spawn specialized agents with fresh context windows. Each agent has a focused role, limited tool access, and produces specific artifacts.

### Agent Categories

> The table below covers the **21 primary agents** detailed in this section. Ten additional shipped agents (pattern-mapper, debug-session-manager, code-reviewer, code-fixer, ai-researcher, domain-researcher, eval-planner, eval-auditor, framework-selector, intel-updater) have concise stubs in the [Advanced and Specialized Agents](#advanced-and-specialized-agents) section below. For the authoritative 31-agent roster, see [`docs/INVENTORY.md`](INVENTORY.md) and the `agents/` directory.

| Category | Count | Agents |
|----------|-------|--------|
| Researchers | 3 | project-researcher, phase-researcher, ui-researcher |
| Analyzers | 2 | assumptions-analyzer, advisor-researcher |
| Synthesizers | 1 | research-synthesizer |
| Planners | 1 | planner |
| Roadmappers | 1 | roadmapper |
| Executors | 1 | executor |
| Checkers | 3 | plan-checker, integration-checker, ui-checker |
| Verifiers | 1 | verifier |
| Auditors | 3 | nyquist-auditor, ui-auditor, security-auditor |
| Mappers | 1 | codebase-mapper |
| Debuggers | 1 | debugger |
| Doc Writers | 2 | doc-writer, doc-verifier |
| Profilers | 1 | user-profiler |

---

## Agent Details

### gsd-project-researcher

**Role:** Researches domain ecosystem before roadmap creation.

| Property | Value |
|----------|-------|
| **Spawned by** | `/gsd-new-project`, `/gsd-new-milestone` |
| **Parallelism** | 4 instances (stack, features, architecture, pitfalls) |
| **Tools** | Read, Write, Bash, Grep, Glob, WebSearch, WebFetch, mcp (context7) |
| **Model (balanced)** | Sonnet |
| **Produces** | `.planning/research/STACK.md`, `FEATURES.md`, `ARCHITECTURE.md`, `PITFALLS.md` |

**Capabilities:**
- Web search for current ecosystem information
- Context7 MCP integration for library documentation
- Writes research documents directly to disk (reduces orchestrator context load)

---

### gsd-phase-researcher

**Role:** Researches how to implement a specific phase before planning.

| Property | Value |
|----------|-------|
| **Spawned by** | `/gsd-plan-phase` |
| **Parallelism** | 4 instances (same focus areas as project researcher) |
| **Tools** | Read, Write, Bash, Grep, Glob, WebSearch, WebFetch, mcp (context7) |
| **Model (balanced)** | Sonnet |
| **Produces** | `{phase}-RESEARCH.md` |

**Capabilities:**
- Reads CONTEXT.md to focus research on user's decisions
- Investigates implementation patterns for the specific phase domain
- Detects test infrastructure for Nyquist validation mapping

---

### gsd-ui-researcher

**Role:** Produces UI design contracts for frontend phases.

| Property | Value |
|----------|-------|
| **Spawned by** | `/gsd-ui-phase` |
| **Parallelism** | Single instance |
| **Tools** | Read, Write, Bash, Grep, Glob, WebSearch, WebFetch, mcp (context7) |
| **Model (balanced)** | Sonnet |
| **Color** | `#E879F9` (fuchsia) |
| **Produces** | `{phase}-UI-SPEC.md` |

**Capabilities:**
- Detects design system state (shadcn components.json, Tailwind config, existing tokens)
- Offers shadcn initialization for React/Next.js/Vite projects
- Asks only unanswered design contract questions
- Enforces registry safety gate for third-party components

---

### gsd-assumptions-analyzer

**Role:** Deeply analyzes codebase for a phase and returns structured assumptions with evidence, confidence levels, and consequences if wrong.

| Property | Value |
|----------|-------|
| **Spawned by** | `discuss-phase-assumptions` workflow (when `workflow.discuss_mode = 'assumptions'`) |
| **Parallelism** | Single instance |
| **Tools** | Read, Bash, Grep, Glob |
| **Model (balanced)** | Sonnet |
| **Color** | Cyan |
| **Produces** | Structured assumptions with decision statements, evidence file paths, confidence levels |

**Key behaviors:**
- Reads ROADMAP.md phase description and prior CONTEXT.md files
- Searches codebase for files related to the phase (components, patterns, similar features)
- Reads 5-15 most relevant source files to form evidence-based assumptions
- Classifies confidence: Confident (clear from code), Likely (reasonable inference), Unclear (could go multiple ways)
- Flags topics that need external research (library compatibility, ecosystem best practices)
- Output calibrated by tier: full_maturity (3-5 areas), standard (3-4), minimal_decisive (2-3)

---

### gsd-advisor-researcher

**Role:** Researches a single gray area decision during discuss-phase advisor mode and returns a structured comparison table.

| Property | Value |
|----------|-------|
| **Spawned by** | `discuss-phase` workflow (when ADVISOR_MODE = true) |
| **Parallelism** | Multiple instances (one per gray area) |
| **Tools** | Read, Bash, Grep, Glob, WebSearch, WebFetch, mcp (context7) |
| **Model (balanced)** | Sonnet |
| **Color** | Cyan |
| **Produces** | 5-column comparison table (Option / Pros / Cons / Complexity / Recommendation) with rationale paragraph |

**Key behaviors:**
- Researches a single assigned gray area using Claude's knowledge, Context7, and web search
- Produces genuinely viable options — no padding with filler alternatives
- Complexity column uses impact surface + risk (never time estimates)
- Recommendations are conditional ("Rec if X", "Rec if Y") — never single-winner ranking
- Output calibrated by tier: full_maturity (3-5 options with maturity signals), standard (2-4), minimal_decisive (2 options, decisive recommendation)

---

### gsd-research-synthesizer

**Role:** Combines outputs from parallel researchers into a unified summary.

| Property | Value |
|----------|-------|
| **Spawned by** | `/gsd-new-project` (after 4 researchers complete) |
| **Parallelism** | Single instance (sequential after researchers) |
| **Tools** | Read, Write, Bash |
| **Model (balanced)** | Sonnet |
| **Color** | Purple |
| **Produces** | `.planning/research/SUMMARY.md` |

---

### gsd-planner

**Role:** Creates executable phase plans with task breakdown, dependency analysis, and goal-backward verification.

| Property | Value |
|----------|-------|
| **Spawned by** | `/gsd-plan-phase`, `/gsd-quick` |
| **Parallelism** | Single instance |
| **Tools** | Read, Write, Bash, Glob, Grep, WebFetch, mcp (context7) |
| **Model (balanced)** | Opus |
| **Color** | Green |
| **Produces** | `{phase}-{N}-PLAN.md` files |

**Key behaviors:**
- Reads PROJECT.md, REQUIREMENTS.md, CONTEXT.md, RESEARCH.md
- Creates 2-3 atomic task plans sized for single context windows
- Uses XML structure with `<task>` elements
- Includes `read_first` and `acceptance_criteria` sections
- Groups plans into dependency waves
- Performs reachability check to validate plan steps reference accessible files and APIs (v1.32)

---

### gsd-roadmapper

**Role:** Creates project roadmaps with phase breakdown and requirement mapping.

| Property | Value |
|----------|-------|
| **Spawned by** | `/gsd-new-project` |
| **Parallelism** | Single instance |
| **Tools** | Read, Write, Bash, Glob, Grep |
| **Model (balanced)** | Sonnet |
| **Color** | Purple |
| **Produces** | `ROADMAP.md` |

**Key behaviors:**
- Maps requirements to phases (traceability)
- Derives success criteria from requirements
- Respects granularity setting for phase count
- Validates coverage (every v1 requirement mapped to a phase)

---

### gsd-executor

**Role:** Executes GSD plans with atomic commits, deviation handling, and checkpoint protocols.

| Property | Value |
|----------|-------|
| **Spawned by** | `/gsd-execute-phase`, `/gsd-quick` |
| **Parallelism** | Multiple (parallel within waves, sequential across waves) |
| **Tools** | Read, Write, Edit, Bash, Grep, Glob |
| **Model (balanced)** | Sonnet |
| **Color** | Yellow |
| **Produces** | Code changes, git commits, `{phase}-{N}-SUMMARY.md` |

**Key behaviors:**
- Fresh 200K context window per plan
- Follows XML task instructions precisely
- Atomic git commit per completed task
- Handles checkpoint types: auto, human-verify, decision, human-action
- Reports deviations from plan in SUMMARY.md
- Invokes node repair on verification failure

---

### gsd-plan-checker

**Role:** Verifies plans will achieve phase goals before execution.

| Property | Value |
|----------|-------|
| **Spawned by** | `/gsd-plan-phase` (verification loop, max 3 iterations) |
| **Parallelism** | Single instance (iterative) |
| **Tools** | Read, Bash, Glob, Grep |
| **Model (balanced)** | Sonnet |
| **Color** | Green |
| **Produces** | PASS/FAIL verdict with specific feedback |

**8 Verification Dimensions:**
1. Requirement coverage
2. Task atomicity
3. Dependency ordering
4. File scope
5. Verification commands
6. Context fit
7. Gap detection
8. Nyquist compliance (when enabled)

---

### gsd-integration-checker

**Role:** Verifies cross-phase integration and end-to-end flows.

| Property | Value |
|----------|-------|
| **Spawned by** | `/gsd-audit-milestone` |
| **Parallelism** | Single instance |
| **Tools** | Read, Bash, Grep, Glob |
| **Model (balanced)** | Sonnet |
| **Color** | Blue |
| **Produces** | Integration verification report |

---

### gsd-ui-checker

**Role:** Validates UI-SPEC.md design contracts against quality dimensions.

| Property | Value |
|----------|-------|
| **Spawned by** | `/gsd-ui-phase` (validation loop, max 2 iterations) |
| **Parallelism** | Single instance |
| **Tools** | Read, Bash, Glob, Grep |
| **Model (balanced)** | Sonnet |
| **Color** | `#22D3EE` (cyan) |
| **Produces** | BLOCK/FLAG/PASS verdict |

---

### gsd-verifier

**Role:** Verifies phase goal achievement through goal-backward analysis.

| Property | Value |
|----------|-------|
| **Spawned by** | `/gsd-execute-phase` (after all executors complete) |
| **Parallelism** | Single instance |
| **Tools** | Read, Write, Bash, Grep, Glob |
| **Model (balanced)** | Sonnet |
| **Color** | Green |
| **Produces** | `{phase}-VERIFICATION.md` |

**Key behaviors:**
- Checks codebase against phase goals, not just task completion
- PASS/FAIL with specific evidence
- Logs issues for `/gsd-verify-work` to address
- Milestone scope filtering: gaps addressed in later phases are marked as "deferred", not reported as failures (v1.32)
- **Test quality audit** (v1.32): verifies that tests prove what they claim by checking for disabled/skipped tests on requirements, circular test patterns (system generating its own expected values), assertion strength (existence vs. value vs. behavioral), and expected value provenance. Blockers from test quality audit override an otherwise passing verification

---

### gsd-nyquist-auditor

**Role:** Fills Nyquist validation gaps by generating tests.

| Property | Value |
|----------|-------|
| **Spawned by** | `/gsd-validate-phase` |
| **Parallelism** | Single instance |
| **Tools** | Read, Write, Edit, Bash, Grep, Glob |
| **Model (balanced)** | Sonnet |
| **Produces** | Test files, updated `VALIDATION.md` |

**Key behaviors:**
- Never modifies implementation code — only test files
- Max 3 attempts per gap
- Flags implementation bugs as escalations for user

---

### gsd-ui-auditor

**Role:** Retroactive 6-pillar visual audit of implemented frontend code.

| Property | Value |
|----------|-------|
| **Spawned by** | `/gsd-ui-review` |
| **Parallelism** | Single instance |
| **Tools** | Read, Write, Bash, Grep, Glob |
| **Model (balanced)** | Sonnet |
| **Color** | `#F472B6` (pink) |
| **Produces** | `{phase}-UI-REVIEW.md` with scores |

**6 Audit Pillars (scored 1-4):**
1. Copywriting
2. Visuals
3. Color
4. Typography
5. Spacing
6. Experience Design

---

### gsd-codebase-mapper

**Role:** Explores codebase and writes structured analysis documents.

| Property | Value |
|----------|-------|
| **Spawned by** | `/gsd-map-codebase` |
| **Parallelism** | 4 instances (tech, architecture, quality, concerns) |
| **Tools** | Read, Bash, Grep, Glob, Write |
| **Model (balanced)** | Haiku |
| **Color** | Cyan |
| **Produces** | `.planning/codebase/*.md` (7 documents) |

**Key behaviors:**
- Read-only exploration + structured output
- Writes documents directly to disk
- No reasoning required — pattern extraction from file contents

---

### gsd-debugger

**Role:** Investigates bugs using scientific method with persistent state.

| Property | Value |
|----------|-------|
| **Spawned by** | `/gsd-debug`, `/gsd-verify-work` (for failures) |
| **Parallelism** | Single instance (interactive) |
| **Tools** | Read, Write, Edit, Bash, Grep, Glob, WebSearch |
| **Model (balanced)** | Sonnet |
| **Color** | Orange |
| **Produces** | `.planning/debug/*.md`, knowledge-base updates |

**Debug Session Lifecycle:**
`gathering` → `investigating` → `fixing` → `verifying` → `awaiting_human_verify` → `resolved`

**Key behaviors:**
- Tracks hypotheses, evidence, and eliminated theories
- State persists across context resets
- Requires human verification before marking resolved
- Appends to persistent knowledge base on resolution
- Consults knowledge base on new sessions

---

### gsd-user-profiler

**Role:** Analyzes session messages across 8 behavioral dimensions to produce a scored developer profile.

| Property | Value |
|----------|-------|
| **Spawned by** | `/gsd-profile-user` |
| **Parallelism** | Single instance |
| **Tools** | Read |
| **Model (balanced)** | Sonnet |
| **Color** | Magenta |
| **Produces** | `USER-PROFILE.md`, `/gsd-dev-preferences`, `CLAUDE.md` profile section |

**Behavioral Dimensions:**
Communication style, decision patterns, debugging approach, UX preferences, vendor choices, frustration triggers, learning style, explanation depth.

**Key behaviors:**
- Read-only agent — analyzes extracted session data, does not modify files
- Produces scored dimensions with confidence levels and evidence citations
- Questionnaire fallback when session history is unavailable

---

### gsd-doc-writer

**Role:** Writes and updates project documentation. Spawned with a doc_assignment block specifying doc type, mode, and project context.

| Property | Value |
|----------|-------|
| **Spawned by** | `/gsd-docs-update` |
| **Parallelism** | Multiple instances (one per doc type) |
| **Tools** | Read, Write, Bash, Grep, Glob |
| **Model (balanced)** | Sonnet |
| **Color** | Purple |
| **Produces** | Project documentation files (README, architecture, API docs, etc.) |

**Key behaviors:**
- Supports modes: create, update, supplement, fix
- Handles doc types: readme, architecture, getting_started, development, testing, api, configuration, deployment, contributing, custom
- Monorepo-aware: can generate per-package READMEs
- Fix mode accepts failure objects from gsd-doc-verifier for targeted corrections
- Writes directly to disk — does not return content to orchestrator

---

### gsd-doc-verifier

**Role:** Verifies factual claims in generated documentation against the live codebase.

| Property | Value |
|----------|-------|
| **Spawned by** | `/gsd-docs-update` (after doc-writer completes) |
| **Parallelism** | Multiple instances (one per doc file) |
| **Tools** | Read, Write, Bash, Grep, Glob |
| **Model (balanced)** | Sonnet |
| **Color** | Orange |
| **Produces** | Structured JSON verification results per doc |

**Key behaviors:**
- Extracts checkable claims (file paths, function names, CLI commands, config keys)
- Verifies each claim against filesystem using tools only — no assumptions
- Writes structured JSON result file for orchestrator to process
- Failed claims feed back to doc-writer in fix mode

---

### gsd-security-auditor

**Role:** Verifies threat mitigations from PLAN.md threat model exist in implemented code.

| Property | Value |
|----------|-------|
| **Spawned by** | `/gsd-secure-phase` |
| **Parallelism** | Single instance |
| **Tools** | Read, Write, Edit, Bash, Glob, Grep |
| **Model (balanced)** | Sonnet |
| **Color** | `#EF4444` (red) |
| **Produces** | `{phase}-SECURITY.md` |

**Key behaviors:**
- Verifies each threat by its declared disposition (mitigate / accept / transfer)
- Does NOT scan blindly for new vulnerabilities — verifies declared mitigations only
- Implementation files are read-only — never patches implementation code
- Unmitigated threats reported as OPEN_THREATS or ESCALATE
- Supports ASVS levels 1/2/3 for verification depth

---

## Advanced and Specialized Agents

Ten additional agents ship under `agents/gsd-*.md` and are used by specialty workflows (`/gsd-ai-integration-phase`, `/gsd-eval-review`, `/gsd-code-review`, `/gsd-code-review-fix`, `/gsd-debug`, `/gsd-intel`, `/gsd-select-framework`) and by the planner pipeline. Each carries full frontmatter in its agent file; the stubs below are concise by design. The authoritative roster (with spawner and primary-doc status per agent) lives in [`docs/INVENTORY.md`](INVENTORY.md).

### gsd-pattern-mapper

**Role:** Read-only codebase analysis that maps files-to-be-created or modified to their closest existing analogs, producing `PATTERNS.md` for the planner to consume.

| Property | Value |
|----------|-------|
| **Spawned by** | `/gsd-plan-phase` (between research and planning) |
| **Parallelism** | Single instance |
| **Tools** | Read, Bash, Glob, Grep, Write |
| **Model (balanced)** | Sonnet |
| **Color** | Magenta |
| **Produces** | `PATTERNS.md` in the phase directory |

**Key behaviors:**
- Extracts file list from CONTEXT.md and RESEARCH.md; classifies each by role (controller, component, service, model, middleware, utility, config, test) and data flow (CRUD, streaming, file I/O, event-driven, request-response)
- Searches for the closest existing analog per file and extracts concrete code excerpts (imports, auth patterns, core pattern, error handling)
- Strictly read-only against source; only writes `PATTERNS.md`

---

### gsd-debug-session-manager

**Role:** Runs the full `/gsd-debug` checkpoint-and-continuation loop in an isolated context so the orchestrator's main context stays lean; spawns `gsd-debugger` agents, dispatches specialist skills, and handles user checkpoints via AskUserQuestion.

| Property | Value |
|----------|-------|
| **Spawned by** | `/gsd-debug` |
| **Parallelism** | Single instance (interactive, stateful) |
| **Tools** | Read, Write, Bash, Grep, Glob, Task, AskUserQuestion |
| **Model (balanced)** | Sonnet |
| **Color** | Orange |
| **Produces** | Compact summary returned to main context; evolves the `.planning/debug/{slug}.md` session file |

**Key behaviors:**
- Reads the debug session file first; passes file paths (not inlined contents) to spawned agents to respect context budget
- Treats all user-supplied AskUserQuestion content as data-only, wrapped in DATA_START/DATA_END markers
- Coordinates TDD gates and reasoning checkpoints introduced in v1.36.0

---

### gsd-code-reviewer

**Role:** Reviews source files for bugs, security vulnerabilities, and code-quality problems; produces a structured `REVIEW.md` with severity-classified findings.

| Property | Value |
|----------|-------|
| **Spawned by** | `/gsd-code-review` |
| **Parallelism** | Typically single instance per review scope |
| **Tools** | Read, Write, Bash, Grep, Glob |
| **Model (balanced)** | Sonnet |
| **Color** | `#F59E0B` (amber) |
| **Produces** | `REVIEW.md` in the phase directory |

**Key behaviors:**
- Detects bugs (logic errors, null/undefined checks, off-by-one, type mismatches, unreachable code), security issues (injection, XSS, hardcoded secrets, insecure crypto), and quality issues
- Honors `CLAUDE.md` project conventions and `.claude/skills/` / `.agents/skills/` rules when present
- Read-only against implementation source — never modifies code under review

---

### gsd-code-fixer

**Role:** Applies fixes to findings from `REVIEW.md` with intelligent (non-blind) patching and atomic per-fix commits; produces `REVIEW-FIX.md`.

| Property | Value |
|----------|-------|
| **Spawned by** | `/gsd-code-review-fix` |
| **Parallelism** | Single instance |
| **Tools** | Read, Edit, Write, Bash, Grep, Glob |
| **Model (balanced)** | Sonnet |
| **Color** | `#10B981` (emerald) |
| **Produces** | `REVIEW-FIX.md`; one atomic git commit per applied fix |

**Key behaviors:**
- Treats `REVIEW.md` suggestions as guidance, not a patch to apply literally
- Commits each fix atomically so review and rollback stay granular
- Honors `CLAUDE.md` and project-skill rules during fixes

---

### gsd-ai-researcher

**Role:** Researches a chosen AI/LLM framework's official documentation and distills it into implementation-ready guidance — framework quick reference, patterns, and pitfalls — for the Section 3–4b body of `AI-SPEC.md`.

| Property | Value |
|----------|-------|
| **Spawned by** | `/gsd-ai-integration-phase` |
| **Parallelism** | Single instance (sequential with domain-researcher / eval-planner) |
| **Tools** | Read, Write, Bash, Grep, Glob, WebFetch, WebSearch, mcp (context7) |
| **Model (balanced)** | Sonnet |
| **Color** | `#34D399` (green) |
| **Produces** | Sections 3–4b of `AI-SPEC.md` (framework quick reference + implementation guidance) |

**Key behaviors:**
- Uses Context7 MCP when available; falls back to the `ctx7` CLI via Bash when MCP tools are stripped from the agent
- Anchors guidance to the specific use case, not generic framework overviews

---

### gsd-domain-researcher

**Role:** Surfaces the business-domain and real-world evaluation context for an AI system — expert rubric ingredients, failure modes, regulatory context — before the eval-planner turns it into measurable rubrics. Writes Section 1b of `AI-SPEC.md`.

| Property | Value |
|----------|-------|
| **Spawned by** | `/gsd-ai-integration-phase` |
| **Parallelism** | Single instance |
| **Tools** | Read, Write, Bash, Grep, Glob, WebSearch, WebFetch, mcp (context7) |
| **Model (balanced)** | Sonnet |
| **Color** | `#A78BFA` (violet) |
| **Produces** | Section 1b of `AI-SPEC.md` |

**Key behaviors:**
- Researches the domain, not the technical framework — its output feeds the eval-planner downstream
- Produces rubric ingredients that downstream evaluators can turn into measurable criteria

---

### gsd-eval-planner

**Role:** Designs the structured evaluation strategy for an AI phase — failure modes, eval dimensions with rubrics, tooling, reference dataset, guardrails, production monitoring. Writes Sections 5–7 of `AI-SPEC.md`.

| Property | Value |
|----------|-------|
| **Spawned by** | `/gsd-ai-integration-phase` |
| **Parallelism** | Single instance (sequential after domain-researcher) |
| **Tools** | Read, Write, Bash, Grep, Glob, AskUserQuestion |
| **Model (balanced)** | Sonnet |
| **Color** | `#F59E0B` (amber) |
| **Produces** | Sections 5–7 of `AI-SPEC.md` (Evaluation Strategy, Guardrails, Production Monitoring) |

**Required reading:** `get-shit-done/references/ai-evals.md` (evaluation framework).

**Key behaviors:**
- Turns domain-researcher rubric ingredients into measurable, tooled evaluation criteria
- Does not re-derive domain context — reads Section 1 and 1b of `AI-SPEC.md` as established input

---

### gsd-eval-auditor

**Role:** Retroactive audit of an implemented AI phase's evaluation coverage against its planned `AI-SPEC.md` eval strategy. Scores each eval dimension `COVERED` / `PARTIAL` / `MISSING` and produces `EVAL-REVIEW.md`.

| Property | Value |
|----------|-------|
| **Spawned by** | `/gsd-eval-review` |
| **Parallelism** | Single instance |
| **Tools** | Read, Write, Bash, Grep, Glob |
| **Model (balanced)** | Sonnet |
| **Color** | `#EF4444` (red) |
| **Produces** | `EVAL-REVIEW.md` with dimension scores, findings, and remediation guidance |

**Required reading:** `get-shit-done/references/ai-evals.md`.

**Key behaviors:**
- Compares the implemented codebase against the planned eval strategy — never re-plans
- Reads implementation files incrementally to respect context budget

---

### gsd-framework-selector

**Role:** Interactive decision-matrix agent that runs a ≤6-question interview, scores candidate AI/LLM frameworks, and returns a ranked recommendation with rationale.

| Property | Value |
|----------|-------|
| **Spawned by** | `/gsd-ai-integration-phase`, `/gsd-select-framework` |
| **Parallelism** | Single instance (interactive) |
| **Tools** | Read, Bash, Grep, Glob, WebSearch, AskUserQuestion |
| **Model (balanced)** | Sonnet |
| **Color** | `#38BDF8` (sky blue) |
| **Produces** | Scored ranked recommendation (structured return to orchestrator) |

**Required reading:** `get-shit-done/references/ai-frameworks.md` (decision matrix).

**Key behaviors:**
- Scans `package.json`, `pyproject.toml`, `requirements*.txt` for existing AI libraries before the interview to avoid recommending a rejected framework
- Asks only what the codebase scan and CONTEXT.md have not already answered

---

### gsd-intel-updater

**Role:** Reads project source and writes structured intel (JSON + Markdown) into `.planning/intel/`, building a queryable codebase knowledge base that other agents use instead of performing expensive fresh exploration.

| Property | Value |
|----------|-------|
| **Spawned by** | `/gsd-intel` (refresh / update flows) |
| **Parallelism** | Single instance |
| **Tools** | Read, Write, Bash, Glob, Grep |
| **Model (balanced)** | Sonnet |
| **Color** | Cyan |
| **Produces** | `.planning/intel/*.json` (and companion Markdown) consumed by `gsd-sdk query intel` |

**Key behaviors:**
- Writes current state only — no temporal language, every claim references an actual file path
- Uses Glob / Read / Grep for cross-platform correctness; Bash is reserved for `gsd-sdk query intel` CLI calls

---

### gsd-doc-classifier

**Role:** Classifies a single planning document as ADR, PRD, SPEC, DOC, or UNKNOWN. Extracts title, scope summary, and cross-references. Writes a JSON classification file used by `gsd-doc-synthesizer` to build a consolidated context.

| Property | Value |
|----------|-------|
| **Spawned by** | `/gsd-ingest-docs` (parallel fan-out over the doc corpus) |
| **Parallelism** | One instance per input document |
| **Tools** | Read, Write, Grep, Glob |
| **Model (balanced)** | Haiku |
| **Color** | Yellow |
| **Produces** | One JSON classification file per input doc (type, title, scope, refs) |

**Key behaviors:**
- Single-doc scope — never synthesizes or resolves conflicts (that is the synthesizer's job)
- Heuristic-first classification; returns UNKNOWN when the doc lacks type signals rather than guessing

---

### gsd-doc-synthesizer

**Role:** Synthesizes classified planning docs into a single consolidated context. Applies precedence rules, detects cross-reference cycles, enforces LOCKED-vs-LOCKED hard-blocks, and writes `INGEST-CONFLICTS.md` with three buckets (auto-resolved, competing-variants, unresolved-blockers).

| Property | Value |
|----------|-------|
| **Spawned by** | `/gsd-ingest-docs` (after classifier fan-in) |
| **Parallelism** | Single instance |
| **Tools** | Read, Write, Grep, Glob, Bash |
| **Model (balanced)** | Sonnet |
| **Color** | Orange |
| **Produces** | Consolidated context for `.planning/` plus `INGEST-CONFLICTS.md` report |

**Key behaviors:**
- Hard-blocks on LOCKED-vs-LOCKED ADR contradictions instead of silently picking a winner
- Follows the `references/doc-conflict-engine.md` contract so `/gsd-import` and `/gsd-ingest-docs` produce consistent conflict reports

---

## Agent Tool Permissions Summary

> **Scope:** this table covers the 21 primary agents only. The 12 advanced/specialized agents listed above carry their own tool surfaces in their `agents/gsd-*.md` frontmatter (summarized in the per-agent stubs above and in [`docs/INVENTORY.md`](INVENTORY.md)).

| Agent | Read | Write | Edit | Bash | Grep | Glob | WebSearch | WebFetch | MCP |
|-------|------|-------|------|------|------|------|-----------|----------|-----|
| project-researcher | ✓ | ✓ | | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| phase-researcher | ✓ | ✓ | | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| ui-researcher | ✓ | ✓ | | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| assumptions-analyzer | ✓ | | | ✓ | ✓ | ✓ | | | |
| advisor-researcher | ✓ | | | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| research-synthesizer | ✓ | ✓ | | ✓ | | | | | |
| planner | ✓ | ✓ | | ✓ | ✓ | ✓ | | ✓ | ✓ |
| roadmapper | ✓ | ✓ | | ✓ | ✓ | ✓ | | | |
| executor | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | | | |
| plan-checker | ✓ | | | ✓ | ✓ | ✓ | | | |
| integration-checker | ✓ | | | ✓ | ✓ | ✓ | | | |
| ui-checker | ✓ | | | ✓ | ✓ | ✓ | | | |
| verifier | ✓ | ✓ | | ✓ | ✓ | ✓ | | | |
| nyquist-auditor | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | | | |
| ui-auditor | ✓ | ✓ | | ✓ | ✓ | ✓ | | | |
| codebase-mapper | ✓ | ✓ | | ✓ | ✓ | ✓ | | | |
| debugger | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | | |
| user-profiler | ✓ | | | | | | | | |
| doc-writer | ✓ | ✓ | | ✓ | ✓ | ✓ | | | |
| doc-verifier | ✓ | ✓ | | ✓ | ✓ | ✓ | | | |
| security-auditor | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | | | |

**Principle of Least Privilege:**
- Checkers are read-only (no Write/Edit) — they evaluate, never modify
- Researchers have web access — they need current ecosystem information
- Executors have Edit — they modify code but not web access
- Mappers have Write — they write analysis documents but not Edit (no code changes)
