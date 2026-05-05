# Phase 5: SME Auditor Agent - Pattern Map

**Mapped:** 2026-04-30
**Files analyzed:** 3 new/modified files
**Analogs found:** 3 / 3

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `agents/gsd-sme-auditor.md` | agent (read-only auditor) | request-response | `agents/gsd-plan-checker.md` | exact (same role, same data flow, same read-only stance) |
| `get-shit-done/references/agent-contracts.md` | reference (registry update) | N/A (append row) | `get-shit-done/references/agent-contracts.md` | self (modification of existing document) |
| `sdk/src/agents/sme-auditor-structure.test.ts` | test (structural validation) | N/A (static file read) | `sdk/src/agents/sme-creator-structure.test.ts` | exact (same file path convention, same Vitest pattern) |

---

## Pattern Assignments

### `agents/gsd-sme-auditor.md` (agent, read-only auditor)

**Primary analog:** `agents/gsd-plan-checker.md`
**Secondary analog:** `agents/gsd-security-auditor.md` (adversarial stance variant, non-standard markers)

**Frontmatter pattern** (`agents/gsd-plan-checker.md` lines 1-6):
```markdown
---
name: gsd-plan-checker
description: Verifies plans will achieve phase goal before execution. Goal-backward analysis of plan quality. Spawned by /gsd-plan-phase orchestrator.
tools: Read, Bash, Glob, Grep
color: green
---
```

Copy this pattern for the auditor. Key constraint: `tools:` must list only `Read, Bash, Glob, Grep` — never `Write`, `Edit`, or `Task`. This enforces AUDIT-02 at the SDK level (tools not listed cannot be granted). Use a hex color string (`"#F59E0B"`) as seen in `gsd-security-auditor.md` line 11.

**Role block pattern** (`agents/gsd-plan-checker.md` lines 8-27):
```markdown
<role>
A set of phase plans has been submitted for pre-execution review. Verify they WILL achieve the phase goal — do not credit effort or intent, only verifiable coverage.

Spawned by `/gsd-plan-phase` orchestrator (after planner creates PLAN.md) or re-verification (after planner revises).

**Critical mindset:** Plans describe intent. You verify they deliver. A plan can have all tasks filled in but still miss the goal if:
...

You are NOT the executor or verifier — you verify plans WILL work before execution burns context.
</role>
```

Adapt: state what the auditor receives (SME context block + PLAN.md path), what it does (cross-reference findings against plan tasks), and that it is READ-ONLY (no file output, return marker only).

**Adversarial stance pattern** (`agents/gsd-plan-checker.md` lines 29-43):
```markdown
<adversarial_stance>
**FORCE stance:** Assume every plan set is flawed until evidence proves otherwise. Your starting hypothesis: these plans will not deliver the phase goal. Surface what disqualifies them.

**Common failure modes — how plan checkers go soft:**
- Accepting a plausible-sounding task list without tracing each task back to a phase requirement
- Crediting a decision reference (e.g., "D-26") without verifying the task actually delivers the full decision scope
- Treating scope reduction ("v1", "static for now", "future enhancement") as acceptable when the user's decision demands full delivery
- Letting dimensions that pass anchor judgment — a plan can pass 6 of 7 dimensions and still fail the phase goal on the 7th
- Issuing warnings for what are actually blockers to avoid conflict with the planner

**Required finding classification:** Every issue must carry an explicit severity:
- **BLOCKER** — the phase goal will not be achieved if this is not fixed before execution
- **WARNING** — quality or maintainability is degraded; fix recommended but execution can proceed
Issues without a severity classification are not valid output.
</adversarial_stance>
```

Copy the structure exactly. Replace "plan checkers go soft" with "SME auditors go soft". Replace finding classification text with BLOCKER/WARNING/WATCH for unaddressed SME findings. The "FORCE stance: Assume ... until evidence proves otherwise" phrasing is the tested adversarial trigger — do not soften it.

**Security auditor adversarial stance variant** (`agents/gsd-security-auditor.md` lines 24-38) shows the "FORCE stance: Assume every mitigation is absent until a grep match proves it exists" pattern — also valid as a secondary model for phrasing.

**Execution flow pattern** (`agents/gsd-security-auditor.md` lines 40-82):
```markdown
<execution_flow>

<step name="load_context">
Read ALL files from `<required_reading>`. Extract:
...
</step>

<step name="analyze_threats">
For each threat in `<threat_model>`, determine verification method by disposition:
...
</step>

<step name="verify_and_write">
...
</step>

</execution_flow>
```

Copy the `<execution_flow>` / `<step name="...">` structure. The SME auditor needs three named steps: `load_context` (read PLAN.md, parse SME context block), `cross_reference` (for each finding, search plan tasks for file-path evidence), `determine_outcome` (zero unaddressed BLOCKERs → SME_APPROVED, else SME_CONCERNS).

**Structured returns pattern** (`agents/gsd-plan-checker.md` lines 875-933 and `agents/gsd-security-auditor.md` lines 85-144):

gsd-plan-checker uses `## VERIFICATION PASSED` / `## ISSUES FOUND` (ALL-CAPS H2).
gsd-security-auditor uses `## SECURED` / `## OPEN_THREATS` / `## ESCALATE` (non-standard — documented in agent-contracts.md as intentional).

The SME auditor follows the ALL-CAPS H2 convention: `## SME_APPROVED` / `## SME_CONCERNS`. The marker format from gsd-plan-checker lines 877-901:
```markdown
## VERIFICATION PASSED

**Phase:** {phase-name}
**Plans verified:** {N}
**Status:** All checks passed

### Coverage Summary

| Requirement | Plans | Status |
|-------------|-------|--------|
| {req-1}     | 01    | Covered |
```

Adapt: replace the coverage table with `**Findings:** {N} addressed, 0 open BLOCKERs` for `## SME_APPROVED`, and a BLOCKER/WARNING/WATCH classified list for `## SME_CONCERNS`.

**Success criteria / critical rules pattern** (`agents/gsd-security-auditor.md` lines 147-155):
```markdown
<success_criteria>
- [ ] All `<required_reading>` loaded before any analysis
- [ ] Threat register extracted from PLAN.md `<threat_model>` block
- [ ] Each threat verified by disposition type (mitigate / accept / transfer)
- [ ] Implementation files never modified
- [ ] SECURITY.md written to correct path
- [ ] Structured return: SECURED / OPEN_THREATS / ESCALATE
</success_criteria>
```

The auditor needs `<critical_rules>` (not `<success_criteria>`) following the plan-checker model. Include: severity must be inherited from SME document (not re-assessed), ADDRESSED requires specific file path + function call, read-only constraint, block_mode does not change auditor output.

---

### `get-shit-done/references/agent-contracts.md` (reference, registry append)

**Analog:** `get-shit-done/references/agent-contracts.md` itself (modification)

**Agent Registry table pattern** (lines 10-34):
```markdown
| Agent | Role | Completion Markers |
|-------|------|--------------------|
| gsd-planner | Plan creation | `## PLANNING COMPLETE` |
| gsd-executor | Plan execution | `## PLAN COMPLETE`, `## CHECKPOINT REACHED` |
...
| gsd-security-auditor | Security audit | `## OPEN_THREATS`, `## ESCALATE` (non-standard) |
```

Append one row at the end of the Agent Registry table:
```markdown
| gsd-sme-auditor | SME domain audit | `## SME_APPROVED`, `## SME_CONCERNS` |
```

**Key Handoff Contracts pattern** (lines 44-79): The contracts section documents producer/consumer field contracts. Add a new subsection `### SME Auditor Output Contract` after the existing contracts, following the table format with Marker / Condition / Gate Action columns.

**Marker Rules pattern** (lines 37-43): The `## SME_APPROVED` and `## SME_CONCERNS` markers follow rule 1 (ALL-CAPS standard). No (non-standard) note needed.

---

### `sdk/src/agents/sme-auditor-structure.test.ts` (test, structural validation)

**Analog:** `sdk/src/agents/sme-creator-structure.test.ts` (exact same convention)

**File header pattern** (`sdk/src/agents/sme-creator-structure.test.ts` lines 1-29):
```typescript
/**
 * Structural validation tests for Phase 3 SME creator agent definitions.
 *
 * Tests verify static structure of agent markdown files and eval config — not
 * runtime behavior. All tests read files from the repo root using absolute paths.
 *
 * Requirements covered:
 *   CREATE-01 — Agent produces complete SME document (...)
 *   CREATE-02 — Git history captured in findings (...)
 *   CREATE-03 — Parallel sub-agent decomposition (...)
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ─── File paths (absolute from repo root) ────────────────────────────────────

// The SDK lives at <repo>/sdk; the agent definitions are at <repo>/agents/
// import.meta.dirname = <repo>/sdk/src/agents → up 3 levels = <repo>
const REPO_ROOT = resolve(import.meta.dirname, '..', '..', '..');

const ORCHESTRATOR_PATH = resolve(REPO_ROOT, 'agents', 'gsd-sme-creator.md');
```

Copy exactly. Update the JSDoc header to reference AUDIT-01 through AUDIT-05. Replace path constants with:
```typescript
const AUDITOR_PATH = resolve(REPO_ROOT, 'agents', 'gsd-sme-auditor.md');
const CONTRACTS_PATH = resolve(REPO_ROOT, 'get-shit-done', 'references', 'agent-contracts.md');
```

**beforeAll / file loading pattern** (`sdk/src/agents/sme-creator-structure.test.ts` lines 46-52):
```typescript
describe('CREATE-01: orchestrator agent structure for complete SME document output', () => {
  let orchestrator: string;

  // Load once, share across tests in this describe block
  beforeAll(() => {
    orchestrator = readAgent(ORCHESTRATOR_PATH);
  });
```

Each `describe` block loads the file in `beforeAll`. For the auditor tests, two files are needed (auditor + contracts). Use top-level `let` variables loaded in a top-level `beforeAll`, since all describe blocks share them:
```typescript
let auditor: string;
let contracts: string;

beforeAll(() => {
  auditor = readFileSync(AUDITOR_PATH, 'utf-8');
  contracts = readFileSync(CONTRACTS_PATH, 'utf-8');
});
```

**Frontmatter extraction pattern** (`sdk/src/agents/sme-creator-structure.test.ts` lines 147-155):
```typescript
it('orchestrator YAML frontmatter includes Task in the tools field', () => {
  const toolsLine = orchestrator
    .split('\n')
    .find((line) => line.startsWith('tools:'));
  expect(toolsLine).toBeDefined();
  expect(toolsLine).toContain('Task');
});
```

For AUDIT-02 read-only test, parse frontmatter block (not just tools line) to handle multi-line YAML tools lists:
```typescript
const fm = auditor.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '';
expect(fm).not.toContain('Write');
expect(fm).not.toContain('Edit');
```

**describe block structure** (both test files): Each requirement ID maps to one `describe` block. Tests within each block are focused, named with concrete behavior (`'has <adversarial_stance> block'`, not `'is correct'`). Five describe blocks: AUDIT-01 through AUDIT-05.

---

## Shared Patterns

### Agent File Structure Convention
**Source:** `agents/gsd-plan-checker.md` (lines 1-6) and `agents/gsd-security-auditor.md` (lines 1-12)
**Apply to:** `agents/gsd-sme-auditor.md`

All agent files in this project use YAML frontmatter with exactly these keys in this order: `name`, `description`, `tools`, `color`. The `tools:` field is inline (comma-separated on one line) for read-only agents (`gsd-plan-checker.md`), or block list format for agents with many tools (`gsd-security-auditor.md`). Use inline format for the auditor (it has exactly 4 tools).

### Adversarial Stance XML Block
**Source:** `agents/gsd-plan-checker.md` lines 29-43; `agents/gsd-security-auditor.md` lines 24-38; `agents/gsd-eval-auditor.md` lines 19-34
**Apply to:** `agents/gsd-sme-auditor.md`

The `<adversarial_stance>` block is the single most important structural element of any GSD auditor agent. It must:
1. Open with `**FORCE stance:**` followed by the specific assumption ("Assume every X is Y until evidence proves otherwise")
2. List 4-6 "common failure modes — how [agent type] go soft" as bullets
3. Close with explicit finding classification (severity labels and their definitions)

The wording "FORCE stance" is literal — the structural test (`sme-creator-structure.test.ts` pattern) asserts `expect(auditor).toContain('FORCE stance')`.

### Structured Returns XML Block
**Source:** `agents/gsd-plan-checker.md` lines 875-933; `agents/gsd-security-auditor.md` lines 85-144
**Apply to:** `agents/gsd-sme-auditor.md`

All returning auditor agents use a `<structured_returns>` block containing markdown code-fenced examples of each possible output marker. The block documents the exact H2 heading, the required fields, and what each field contains. This block is parsed by structural tests that assert `expect(auditor).toContain('## SME_APPROVED')`.

### Vitest Test File Conventions
**Source:** `sdk/src/agents/sme-creator-structure.test.ts` lines 14-28; `sdk/src/agents/create-sme-workflow-structure.test.ts` lines 14-28
**Apply to:** `sdk/src/agents/sme-auditor-structure.test.ts`

All structural test files in `sdk/src/agents/` follow this pattern:
- Import block: `{ describe, it, expect, beforeAll }` from vitest, `{ readFileSync }` from `node:fs`, `{ resolve }` from `node:path`
- Path resolution: `const REPO_ROOT = resolve(import.meta.dirname, '..', '..', '..')` (3 levels up from `sdk/src/agents/`)
- Helper function `readAgent(path: string): string` using `readFileSync(path, 'utf-8')`
- One `describe` block per requirement ID, with tests named for the specific behavior

---

## No Analog Found

No files in this phase lack a close codebase analog. All three deliverables have strong existing patterns to copy from.

---

## Metadata

**Analog search scope:** `agents/`, `sdk/src/agents/`, `get-shit-done/references/`
**Files scanned:** 5 (gsd-plan-checker.md, gsd-security-auditor.md, gsd-eval-auditor.md, sme-creator-structure.test.ts, create-sme-workflow-structure.test.ts, agent-contracts.md)
**Pattern extraction date:** 2026-04-30
