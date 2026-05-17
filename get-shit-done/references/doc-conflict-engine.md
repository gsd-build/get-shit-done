# Doc Conflict Engine

Shared conflict-detection contract for workflows that ingest external content into `.planning/` (e.g., `/gsd:import`, `/gsd:ingest-docs`). Defines the report format, severity semantics, and safety-gate behavior. The specific checks that populate each severity bucket are workflow-specific and defined by the calling workflow.

---

## Severity Semantics

- **[BLOCKER]** — Unsafe to proceed. The workflow MUST exit without writing any destination files. Used for contradictions of locked decisions, missing prerequisites, and impossible targets.
- **[WARNING]** — Ambiguous or partially overlapping. The workflow MUST surface the warning and obtain explicit user approval before writing. Never auto-approve.
- **[INFO]** — Informational only. No gate; no user prompt required. Included in the report for transparency.

---

## Report Format

Plain-text, never markdown tables (no `|---|`). The report is rendered to the user verbatim.

```
## Conflict Detection Report

### BLOCKERS ({N})

[BLOCKER] {Short title}
  Found: {what the incoming content says}
  Expected: {what existing project context requires}
  → {Specific action to resolve}

### WARNINGS ({N})

[WARNING] {Short title}
  Found: {what was detected}
  Impact: {what could go wrong}
  → {Suggested action}

### INFO ({N})

[INFO] {Short title}
  Note: {relevant information}
```

Every entry requires `Found:` plus one of `Expected:`/`Impact:`/`Note:` plus (for BLOCKER/WARNING) a `→` remediation line.

---

## Safety Gate

**If any [BLOCKER] exists:**

Display:
```
GSD > BLOCKED: {N} blockers must be resolved before {operation} can proceed.
```

Exit WITHOUT writing any destination files. The gate must hold regardless of WARNING/INFO counts.

**If only WARNINGS and/or INFO (no blockers):**

Render the full report, then prompt for approval via the `approve-revise-abort` or `yes-no` pattern from `references/gate-prompts.md`. Respect text mode (see the workflow's own text-mode handling). If the user aborts, exit cleanly with a cancellation message.

**If the report is empty (no entries in any bucket):**

Proceed silently or display `GSD > No conflicts detected.` Either is acceptable; workflows choose based on verbosity context.

---

## Workflow Responsibilities

Each workflow that consumes this contract must define:

1. **Its own check list per bucket** — which conditions are BLOCKER vs WARNING vs INFO. These are domain-specific (plan ingestion checks are not doc ingestion checks).
2. **The loaded context** — what it reads (ROADMAP.md, PROJECT.md, REQUIREMENTS.md, CONTEXT.md, intel files) before running checks.
3. **The operation noun** — substituted into the BLOCKED banner (`import`, `ingest`, etc.).

The workflow MUST NOT:

- Introduce new severity levels beyond BLOCKER/WARNING/INFO
- Render the report as a markdown table
- Write any destination file when BLOCKERs exist
- Auto-approve past WARNINGs without user input

---

## Anti-Patterns

Do NOT:

- Use markdown tables (`|---|`) in the conflict report — use plain-text labels as shown above
- Bypass the safety gate when BLOCKERs exist — no exceptions for "minor" blockers
- Fold WARNINGs into INFO to skip the approval prompt — if user input is needed, it is a WARNING
- Re-invent severity labels per workflow — the three-level taxonomy is fixed
