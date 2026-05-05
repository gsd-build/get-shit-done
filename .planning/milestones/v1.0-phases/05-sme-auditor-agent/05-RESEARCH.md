# Phase 5: SME Auditor Agent - Research

**Researched:** 2026-04-30
**Domain:** AI agent authoring, adversarial review, structured return markers, read-only enforcement
**Confidence:** HIGH

---

## Summary

Phase 5 builds a single markdown agent file: `agents/gsd-sme-auditor.md`. This agent receives one or more `<sme_context>` blocks (produced by the Phase 2 `sme.context-block` query handler) and a `PLAN.md`, and returns either `## SME_APPROVED` or `## SME_CONCERNS` with severity-classified findings. No TypeScript is written in this phase.

The agent's role is structurally analogous to `gsd-plan-checker.md` — adversarial, read-only, returns structured markers — but its subject matter is different: instead of verifying plan completeness against requirements, it verifies plan safety against SME domain knowledge. The key design problem is ensuring the agent maintains a genuine adversarial stance (assumes risks ARE present until proved otherwise) without inflating BLOCKERs into meaningless noise — the same calibration challenge documented in the Phase 3 AI-SPEC.

Four specific behaviors are required by the requirements:

1. **AUDIT-01** — Adversarial stance: default assumption is that domain risks ARE present. The plan must actively prove they are addressed.
2. **AUDIT-02** — Read-only mode: agent never writes or edits implementation files. Only reads PLAN.md and SME documents.
3. **AUDIT-03** — Structured return markers: `## SME_APPROVED` or `## SME_CONCERNS` with BLOCKER/WARNING/WATCH classified findings.
4. **AUDIT-04** — Concrete mitigations: BLOCKER findings must name specific file paths and function calls, not abstract recommendations.
5. **AUDIT-05** — Markers registered in `agent-contracts.md`.

The Phase 2 `sme.context-block` query handler is the upstream data source — it wraps each SME document in `<sme_context process="..." block_mode="...">...</sme_context>` XML. The agent receives this block in its prompt and extracts findings from it. The Phase 6 gate (not in scope here) is responsible for invoking the auditor with the correct SME context block.

**Primary recommendation:** Build one agent markdown file (`agents/gsd-sme-auditor.md`) following the `gsd-plan-checker.md` and `gsd-security-auditor.md` structural patterns, using the adversarial stance pattern, inline severity calibration examples, and a structured `## SME_APPROVED` / `## SME_CONCERNS` return contract. Add the new markers to `get-shit-done/references/agent-contracts.md`. Write structural validation tests in `sdk/src/agents/` following the Phase 3 and 4 precedent. No sub-agent decomposition is needed — the auditor works in a single context.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| SME domain knowledge input | SDK Layer (sme.context-block) | — | Phase 2 query handler produces the XML context block; Phase 5 only consumes it |
| Plan reading | Agent Layer (gsd-sme-auditor) | — | Agent reads PLAN.md directly using Read tool |
| Adversarial finding generation | Agent Layer (gsd-sme-auditor) | — | Core agent function; cross-references SME findings against plan tasks |
| Severity classification | Agent Layer (gsd-sme-auditor) | — | BLOCKER/WARNING/WATCH applied inline by the agent, calibrated by examples |
| Return marker detection | Orchestration Layer (plan-phase.md) | — | Phase 6 scope; gate matches `## SME_APPROVED` or `## SME_CONCERNS` via regex |
| Marker registration | Reference Layer (agent-contracts.md) | — | AUDIT-05 requires adding markers to the agent registry document |
| Structural test coverage | SDK Layer (sdk/src/agents/) | — | Follows Phase 3/4 pattern: Vitest unit tests verify static agent structure |

---

## Standard Stack

### Core (already installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Markdown + YAML frontmatter | N/A | Agent definition format | All agents in `agents/` use this format [VERIFIED: repo scan] |
| `@anthropic-ai/claude-agent-sdk` | 0.2.84 (installed), 0.2.123 (latest) | Agent spawning (used by Phase 6 gate, not this phase directly) | Sole AI dependency in project [VERIFIED: npm view + npm list] |

### Supporting (test infrastructure, already installed)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `vitest` | ^3.1.1 | Structural validation tests | Test agent file structure, required fields, markers |

### No New Packages Required

Phase 5 delivers markdown agent definitions and a test file. No new npm packages are needed.

**Version verification:** `@anthropic-ai/claude-agent-sdk` latest is 0.2.123; installed is ^0.2.84. [VERIFIED: npm view @anthropic-ai/claude-agent-sdk version]

---

## Architecture Patterns

### System Architecture Diagram

```
Phase 6 gate (out of scope for Phase 5) invokes:
            |
            v
  sme.context-block query handler (Phase 2)
            |
            v (XML context block via prompt parameter)
  ┌─────────────────────────────────────────────────────────┐
  │           gsd-sme-auditor.md (Phase 5 deliverable)      │
  │                                                         │
  │  Input (from prompt):                                   │
  │    <sme_context process="..." block_mode="...">         │
  │      {full SME document content}                        │
  │    </sme_context>                                       │
  │    PLAN.md path                                         │
  │                                                         │
  │  [read PLAN.md via Read tool]                           │
  │  [extract SME findings from <sme_context> block]        │
  │  [for each SME finding (BLOCKER/WARNING/WATCH):         │
  │     - search PLAN.md tasks for addressing evidence]     │
  │     - if evidence found: mark ADDRESSED                 │
  │     - if no evidence: flag finding, classify severity]  │
  │  [verify BLOCKER findings have concrete mitigations]    │
  │                                                         │
  │  Return:                                                │
  │    ## SME_APPROVED   (all BLOCKERs addressed)           │
  │    OR                                                   │
  │    ## SME_CONCERNS   (unaddressed BLOCKERs or warnings) │
  │      with severity-classified finding list              │
  └─────────────────────────────────────────────────────────┘
            |
            v
  Phase 6 gate routes: SME_APPROVED → continue
                        SME_CONCERNS → soft warn or strict halt
```

### Recommended Project Structure

Phase 5 delivers only the agent file and the contracts update:

```
agents/
└── gsd-sme-auditor.md           # Phase 5 primary deliverable
get-shit-done/references/
└── agent-contracts.md           # Update: add SME_APPROVED / SME_CONCERNS rows
sdk/src/agents/
└── sme-auditor-structure.test.ts  # Structural validation tests
```

### Pattern 1: Agent Definition Format (from repo)

All agents use YAML frontmatter + `<role>` block. The `name:` field must match the `subagent_type` string used in any `Task()` call from Phase 6. The auditor does NOT need `Task` or `Write` in its tools — it is read-only.

```markdown
<!-- Source: agents/gsd-plan-checker.md, agents/gsd-security-auditor.md [VERIFIED: repo] -->
---
name: gsd-sme-auditor
description: Reviews PLAN.md against SME domain knowledge with adversarial stance. Returns SME_APPROVED or SME_CONCERNS with severity-classified findings. Spawned by plan-phase gate (step 12.5).
tools: Read, Bash, Glob, Grep
color: "#F59E0B"
---
```

The auditor uses only `Read`, `Bash`, `Glob`, `Grep` — no `Write`, no `Edit`, no `Task`. This enforces AUDIT-02 at the tooling level. [VERIFIED: gsd-plan-checker.md uses same read-only tool set, gsd-security-auditor.md uses Write only for SECURITY.md output — the auditor produces no file output, only a return marker]

### Pattern 2: Adversarial Stance Block (from existing auditor agents)

The adversarial stance block is a standard pattern in this codebase. It appears in `gsd-plan-checker.md`, `gsd-nyquist-auditor.md`, `gsd-security-auditor.md`, and `gsd-eval-auditor.md`. [VERIFIED: repo scan]

```markdown
<!-- Source: agents/gsd-security-auditor.md adversarial_stance block [VERIFIED] -->
<adversarial_stance>
**FORCE stance:** Assume every SME risk IS present in the plan until a specific
plan task proves it is addressed. Your starting hypothesis: the plan ignores
domain risks. Surface every unaddressed finding.

**Common failure modes — how SME auditors go soft:**
- Accepting a vague task description as addressing a BLOCKER without finding
  the specific file path or function call the BLOCKER requires
- Treating "general error handling" as addressing a specific edge case BLOCKER
- Downgrading BLOCKERs to WARNING to avoid conflict with the planner
- Marking a finding as ADDRESSED because the domain is mentioned somewhere in
  the plan, even if no task targets the specific risk
- Skipping WATCHes entirely — they are low-severity but must appear in output

**Required finding classification:**
- **BLOCKER** — an SME BLOCKER finding has no addressing task in PLAN.md
- **WARNING** — an SME WARNING finding is unaddressed or partially addressed
- **WATCH** — an SME WATCH finding is not mentioned in PLAN.md
Every SME finding must resolve to ADDRESSED or appear in the output with its severity.
</adversarial_stance>
```

### Pattern 3: Structured Return Markers (from agent-contracts.md)

The existing marker convention [VERIFIED: get-shit-done/references/agent-contracts.md]:
- Standard: ALL-CAPS H2 headings (`## PLANNING COMPLETE`, `## VERIFICATION PASSED`)
- Non-standard: some audit agents use `## PARTIAL` and `## ESCALATE`

For the SME auditor, the markers follow the ALL-CAPS standard:

```markdown
## SME_APPROVED

**Phase:** {phase-name}
**Process(es) audited:** {process names from SME context blocks}
**Findings:** {N} addressed, 0 open BLOCKERs

All domain risks are addressed in the plan. Proceed to execution.
```

```markdown
## SME_CONCERNS

**Phase:** {phase-name}
**Process(es) audited:** {process names}
**Findings:** {B} BLOCKERs, {W} WARNINGs, {Wt} WATCHes

### BLOCKERs (must address before execution)

**1. [BLOCKER] {finding title from SME}**
- SME Evidence: {evidence field from SME finding}
- Required mitigation: {mitigation field from SME finding}
- Plan gap: No task in PLAN.md addresses `{file:function}` — the specific
  mitigation must name this file path and function call

### WARNINGs (should address)

**1. [WARNING] {finding title}**
- SME Evidence: {evidence}
- Plan gap: {what is missing or only partially addressed}

### WATCHes (informational)

**1. [WATCH] {finding title}**
- SME Evidence: {evidence}
- Plan note: {whether mentioned at all}
```

### Pattern 4: SME Context Block Format (from Phase 2)

The auditor receives SME content wrapped by the `sme.context-block` query handler. [VERIFIED: sdk/src/query/sme.ts]

```xml
<sme_context process="contribution" block_mode="soft">
---
process_name: contribution
last_analyzed_commit: abc1234
block_mode: soft
created_date: 2026-04-30
finding_counts:
  blocker: 2
  warning: 1
  watch: 1
---
# contribution SME Document

## Process Overview
...

## Identified Risks

[BLOCKER] **Race condition in lock acquisition** ...
  *Evidence:* `src/contributions/processor.ts:142` ...
  *Mitigation:* Wrap lock check and acquire in a transaction using `SELECT FOR UPDATE` ...

## Test Gaps
...
</sme_context>
```

The auditor must parse findings from all sections (Identified Risks, Test Gaps, Outdated Logic, Edge Cases, Known Blockers) and match their severity labels against plan tasks.

### Pattern 5: Inline Severity Calibration Examples

The Phase 3 AI-SPEC establishes that inline few-shot examples are the most reliable way to calibrate severity judgment. [CITED: .planning/phases/03-sme-creator-agent/03-AI-SPEC.md, Section 1b] The auditor needs examples of what constitutes ADDRESSED vs. UNADDRESSED for each severity level.

```markdown
<severity_examples>
BLOCKER - ADDRESSED example:
> SME finding: [BLOCKER] Race condition in lock acquisition
> Evidence: src/contributions/processor.ts:142 — lock check not atomic
> Plan task: "Wrap lock check in a SELECT FOR UPDATE transaction in
>   src/contributions/processor.ts:handleSubmit() — addresses concurrent
>   access race condition"
> Result: ADDRESSED — task names the file path and function explicitly

BLOCKER - UNADDRESSED example:
> SME finding: [BLOCKER] Race condition in lock acquisition
> Evidence: src/contributions/processor.ts:142 — lock check not atomic
> Plan task: "Add error handling to the contribution processor"
> Result: UNADDRESSED — task does not name the file path or the specific
>   lock acquisition fix; generic error handling is not a race condition mitigation

WARNING - PARTIALLY ADDRESSED example:
> SME finding: [WARNING] No test for concurrent submission
> Evidence: tests/contributions.test.ts:1 — sequential tests only
> Plan task: "Improve test coverage for the contribution module"
> Result: PARTIALLY ADDRESSED — mention of test improvements exists but no
>   task specifically names the concurrent submission scenario; flag as WARNING
</severity_examples>
```

### Pattern 6: Read-Only Enforcement Strategy

AUDIT-02 requires the auditor never modifies implementation files. This is enforced at two levels:

1. **Tooling level:** Exclude `Write`, `Edit`, `MultiEdit` from the agent's YAML `tools:` frontmatter. The SDK will not grant these tools even if the agent attempts to use them. [VERIFIED: gsd-plan-checker.md enforces this with `tools: Read, Bash, Glob, Grep`]
2. **Instruction level:** State explicitly in `<critical_rules>` that the agent produces no file output — only a return marker in its response.

### Pattern 7: Structural Test Pattern (from Phase 3/4)

Phase 3 established the pattern for structural validation tests: `sdk/src/agents/{agent-name}-structure.test.ts` reads the agent markdown file and makes assertions about its content. [VERIFIED: sdk/src/agents/sme-creator-structure.test.ts, create-sme-workflow-structure.test.ts]

```typescript
// Source: sdk/src/agents/sme-creator-structure.test.ts [VERIFIED: repo]
const REPO_ROOT = resolve(import.meta.dirname, '..', '..', '..');
const AUDITOR_PATH = resolve(REPO_ROOT, 'agents', 'gsd-sme-auditor.md');

describe('AUDIT-01: adversarial stance', () => {
  it('agent has <adversarial_stance> block', () => {
    expect(auditor).toContain('<adversarial_stance>');
  });
  it('adversarial stance includes FORCE stance text', () => {
    expect(auditor).toContain('FORCE stance');
  });
});

describe('AUDIT-02: read-only mode', () => {
  it('agent tools frontmatter does not include Write', () => {
    const frontmatterMatch = auditor.match(/^---\n([\s\S]*?)\n---/);
    expect(frontmatterMatch![1]).not.toContain('Write');
  });
});

describe('AUDIT-03: structured return markers', () => {
  it('agent defines ## SME_APPROVED marker', () => {
    expect(auditor).toContain('## SME_APPROVED');
  });
  it('agent defines ## SME_CONCERNS marker', () => {
    expect(auditor).toContain('## SME_CONCERNS');
  });
});

describe('AUDIT-04: concrete mitigations', () => {
  it('agent requires file paths and function calls in BLOCKER mitigations', () => {
    expect(auditor).toMatch(/file path|function call/i);
  });
});
```

### Anti-Patterns to Avoid

- **Including Write in tools frontmatter:** Violates AUDIT-02 read-only requirement. The agent produces its output as a return marker, not a written file.
- **Soft-coding the adversarial stance:** The agent must start from the assumption that risks ARE present. Framing the review as "check if there are risks" allows the agent to default to approval. The stance must be: "risks are present — prove otherwise."
- **Accepting plan intent as plan evidence:** A task title mentioning "error handling" is not evidence that a specific BLOCKER is addressed. The task action must name the specific file path and function from the SME finding.
- **Outputting findings without severity:** Every finding in `## SME_CONCERNS` must carry an explicit BLOCKER/WARNING/WATCH label. Unlabeled findings are not valid output per AUDIT-03.
- **Name mismatch in agent-contracts.md:** The markers `## SME_APPROVED` and `## SME_CONCERNS` must appear exactly as H2 headings in both the agent file and agent-contracts.md. Casing inconsistencies break the gate's regex match (Phase 6 scope, but the contract must be correct now).
- **Conflating block_mode with agent behavior:** The `block_mode` field in the SME frontmatter (soft/strict) controls how the Phase 6 gate *reacts* to `## SME_CONCERNS` — it does NOT change whether the auditor flags findings. The auditor always flags all unaddressed risks regardless of block_mode. Gate routing is Phase 6 scope.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SME content parsing | Custom YAML/markdown parser | Read the `<sme_context>` XML block directly in the agent prompt | Phase 2 `sme.context-block` handler wraps the full document; the auditor just reads the block |
| Severity classification logic | Custom scoring algorithm | Inline few-shot examples in `<severity_examples>` block | LLM calibration via examples is more reliable and easier to update than rules |
| Finding storage | Write findings to a file | Return findings as markdown in the agent's text response | Auditor is stateless — output is the return marker, consumed by Phase 6 gate |
| Concurrent auditing | Sub-agent decomposition | Single-context analysis | SME documents are 1-3KB; a single agent context is more than sufficient for reading one PLAN.md + 1-3 SME documents |
| Agent invocation from TypeScript | Custom query() wrappers | Existing `session-runner.ts` pattern (Phase 6 scope) | Phase 5 delivers the agent definition only; Phase 6 wires the invocation |

**Key insight:** Phase 5 is even simpler than Phase 3 — there are no sub-agents, no temp files, no parallel decomposition. The auditor is a single read-only agent that reads two things (SME context + PLAN.md) and returns a structured marker. The complexity is in the agent instructions, not in the infrastructure.

---

## Common Pitfalls

### Pitfall 1: Adversarial Stance Drift Toward Approval Bias

**What goes wrong:** The agent is instructed to "check for risks" and defaults to finding that all risks are adequately addressed. This is the natural LLM tendency — it summarizes the plan favorably because the plan was written by a skilled engineer.

**Why it happens:** Framing matters. "Check for domain risks" invites a balanced assessment. "Assume risks are present — prove otherwise" inverts the default and produces adversarial output.

**How to avoid:** Use the exact "FORCE stance: assume risks ARE present until a specific plan task proves otherwise" phrasing. This is established in `gsd-plan-checker.md` and proven to work in this codebase. [VERIFIED: gsd-plan-checker.md adversarial_stance block]

**Warning signs:** Agent returns `## SME_APPROVED` on first pass for a plan that has no explicit mitigations for any SME BLOCKER finding. Correct behavior: BLOCKERs with no addressing task must appear in `## SME_CONCERNS`.

### Pitfall 2: BLOCKER Inflation (Same as Phase 3 Calibration Problem)

**What goes wrong:** The agent labels unaddressed WARNINGs or WATCHes as BLOCKERs, or elevates its own opinion of risk beyond the SME's documented severity. Developers see 8 BLOCKERs on first use, most of which were WARNINGs in the SME, and stop trusting the gate.

**Why it happens:** Without calibration, LLMs default to conservative severity escalation. They "round up" to be safe.

**How to avoid:** The auditor must inherit severity from the SME document, not re-assess it. A finding that is [WARNING] in the SME must appear as WARNING in the output, not BLOCKER. The `<severity_examples>` block should make this explicit. [CITED: .planning/phases/03-sme-creator-agent/03-AI-SPEC.md, Section 1b — severity inflation destroys trust]

**Warning signs:** Output shows more BLOCKERs than the SME document's `finding_counts.blocker` frontmatter field. This is definitionally impossible if the agent inherits severity correctly.

### Pitfall 3: Missing from agent-contracts.md Means Gate Breaks

**What goes wrong:** Phase 6 gate workflow matches return markers via regex. If `## SME_APPROVED` is not registered in `agent-contracts.md`, the gate has no documented contract to implement against, and the regex will be written from memory — introducing casing/spacing bugs.

**Why it happens:** agent-contracts.md is a reference document, easy to overlook as "just documentation."

**How to avoid:** Treat the agent-contracts.md update as a required deliverable equal to the agent file itself. AUDIT-05 is explicit about this. [VERIFIED: requirements text and agent-contracts.md purpose description]

**Warning signs:** The structural test suite doesn't assert on agent-contracts.md content. Add a test that verifies both markers appear in that file.

### Pitfall 4: Forgetting block_mode is Gate Logic, Not Auditor Logic

**What goes wrong:** The auditor reads `block_mode` from the SME frontmatter and suppresses BLOCKER findings when `block_mode: soft`. The gate receives `## SME_APPROVED` when BLOCKERs exist, bypassing soft-mode behavior entirely.

**Why it happens:** The distinction between "auditor always reports" vs. "gate decides how to react" is subtle. The `block_mode` field is present in the SME context block the auditor receives.

**How to avoid:** State explicitly in agent instructions: "Report all unaddressed findings regardless of block_mode. block_mode is consumed by the Phase 6 gate, not by this agent." [ASSUMED — this boundary is implied by requirements but not explicitly stated in REQUIREMENTS.md; needs planner confirmation]

**Warning signs:** AUDIT-03 test cases with block_mode: soft show `## SME_APPROVED` when unaddressed BLOCKERs are present.

### Pitfall 5: Accepting Plan Prose as Evidence of Mitigation

**What goes wrong:** The plan says "Ensure robustness in the contribution processor" and the auditor marks a BLOCKER about `src/contributions/processor.ts:142` as ADDRESSED because the word "contribution" appears in the plan.

**Why it happens:** LLMs are good at finding thematic relevance. Adversarial auditing requires finding structural evidence (specific file path, specific function), not thematic relevance.

**How to avoid:** The agent instructions must define "ADDRESSED" as: "a plan task action names the specific file path AND function call cited in the SME finding's Evidence field." Anything short of that is UNADDRESSED. Use the ADDRESSED/UNADDRESSED few-shot examples in `<severity_examples>`. [CITED: REQUIREMENTS.md AUDIT-04]

**Warning signs:** Agent output shows more findings as ADDRESSED than the plan actually covers. Spot-check by searching the plan for the exact file paths from BLOCKER findings.

---

## Code Examples

### Agent Definition Skeleton

```markdown
<!-- Source: agents/gsd-plan-checker.md + agents/gsd-security-auditor.md patterns [VERIFIED: repo] -->
---
name: gsd-sme-auditor
description: Reviews PLAN.md against SME domain knowledge with adversarial stance. Returns SME_APPROVED or SME_CONCERNS with severity-classified findings. Spawned by plan-phase gate (Phase 6).
tools: Read, Bash, Glob, Grep
color: "#F59E0B"
---

<role>
A PLAN.md has been submitted for SME domain review. Verify it addresses known domain
risks — do not credit intent or vague coverage, only verifiable task-level evidence.

Spawned by the plan-phase gate with one or more `<sme_context>` blocks and a PLAN.md path.

**Adversarial mindset:** Your starting assumption is that domain risks ARE present in this
plan — it is your job to prove which ones the plan addresses and which it does not.

**Read-only mode:** You NEVER modify implementation files. You read PLAN.md and SME context.
Your output is a return marker in your response — not a written file.
</role>

<adversarial_stance>
**FORCE stance:** Assume every SME finding is unaddressed in the plan until a specific
plan task proves otherwise. Your starting hypothesis: the plan ignores domain risks.

**Common failure modes — how SME auditors go soft:**
[... per Pattern 2 above ...]
</adversarial_stance>

<severity_examples>
[... per Pattern 5 above ...]
</severity_examples>

<execution_flow>

<step name="load_context">
Read PLAN.md. Extract the <sme_context> blocks from the prompt.
Parse each SME finding (all 5 sections: Identified Risks, Test Gaps, Outdated Logic,
Edge Cases, Known Blockers). Record: severity, title, evidence (file:line), mitigation.
</step>

<step name="cross_reference">
For each SME finding:
1. Search PLAN.md tasks for evidence that the specific file path and function
   from the finding's Evidence field is explicitly named.
2. If found: mark ADDRESSED.
3. If not found: record as unaddressed with its original severity label.
</step>

<step name="determine_outcome">
If zero unaddressed BLOCKERs: return ## SME_APPROVED
Else: return ## SME_CONCERNS with all unaddressed findings
</step>

</execution_flow>

<critical_rules>
**INHERIT SEVERITY FROM SME.** Do not re-assess severity. A [WARNING] in the SME is
WARNING in output. A [BLOCKER] is BLOCKER. Never elevate severity.

**ADDRESSED REQUIRES FILE PATH + FUNCTION.** A plan task ADDRESSES a BLOCKER only when
its action names the specific file path and function call from the finding's Evidence
field. Thematic relevance is not evidence.

**REPORT ALL FINDINGS.** Every SME finding appears in output — either in the
"addressed" tally (if evidence found) or as an explicit finding in ## SME_CONCERNS.

**READ-ONLY.** Produce no file output. Your result is the return marker in your response.

**BLOCK_MODE DOES NOT CHANGE YOUR OUTPUT.** Report all unaddressed findings regardless
of the SME's block_mode value. The gate decides how to react — not you.
</critical_rules>
```

### agent-contracts.md Update

```markdown
<!-- Source: get-shit-done/references/agent-contracts.md [VERIFIED: repo] -->

<!-- Add to Agent Registry table: -->
| gsd-sme-auditor | SME domain audit | `## SME_APPROVED`, `## SME_CONCERNS` |

<!-- Add to Key Handoff Contracts section: -->
### SME Auditor Output Contract

| Marker | Condition | Gate Action |
|--------|-----------|-------------|
| `## SME_APPROVED` | Zero unaddressed BLOCKERs | Gate proceeds unconditionally |
| `## SME_CONCERNS` | One or more unaddressed findings | Gate routes per block_mode (soft/strict) |
```

### Structural Test Skeleton

```typescript
// Source: sdk/src/agents/sme-creator-structure.test.ts pattern [VERIFIED: repo]
// File: sdk/src/agents/sme-auditor-structure.test.ts

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..', '..');
const AUDITOR_PATH = resolve(REPO_ROOT, 'agents', 'gsd-sme-auditor.md');
const CONTRACTS_PATH = resolve(REPO_ROOT, 'get-shit-done', 'references', 'agent-contracts.md');

let auditor: string;
let contracts: string;

beforeAll(() => {
  auditor = readFileSync(AUDITOR_PATH, 'utf-8');
  contracts = readFileSync(CONTRACTS_PATH, 'utf-8');
});

describe('AUDIT-01: adversarial stance', () => {
  it('has <adversarial_stance> block', () => expect(auditor).toContain('<adversarial_stance>'));
  it('adversarial stance uses FORCE stance language', () => expect(auditor).toContain('FORCE stance'));
  it('adversarial stance assumes risks are present', () => expect(auditor).toMatch(/risks ARE present|domain risks.*present/i));
});

describe('AUDIT-02: read-only mode', () => {
  it('tools frontmatter does not include Write', () => {
    const fm = auditor.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '';
    expect(fm).not.toContain('Write');
  });
  it('tools frontmatter does not include Edit', () => {
    const fm = auditor.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '';
    expect(fm).not.toContain('Edit');
  });
  it('critical_rules block states read-only constraint', () => {
    expect(auditor).toContain('<critical_rules>');
    expect(auditor).toMatch(/read-only|never modif|produce no file/i);
  });
});

describe('AUDIT-03: structured return markers', () => {
  it('defines ## SME_APPROVED marker', () => expect(auditor).toContain('## SME_APPROVED'));
  it('defines ## SME_CONCERNS marker', () => expect(auditor).toContain('## SME_CONCERNS'));
  it('output uses BLOCKER/WARNING/WATCH classification', () => {
    expect(auditor).toContain('BLOCKER');
    expect(auditor).toContain('WARNING');
    expect(auditor).toContain('WATCH');
  });
});

describe('AUDIT-04: concrete mitigations with file paths and function calls', () => {
  it('requires file paths in BLOCKER evidence', () => {
    expect(auditor).toMatch(/file path|function call/i);
  });
  it('defines ADDRESSED as requiring specific file and function', () => {
    expect(auditor).toMatch(/ADDRESSED.*file|file.*ADDRESSED/is);
  });
});

describe('AUDIT-05: markers registered in agent-contracts.md', () => {
  it('agent-contracts.md contains gsd-sme-auditor entry', () => {
    expect(contracts).toContain('gsd-sme-auditor');
  });
  it('agent-contracts.md contains ## SME_APPROVED marker', () => {
    expect(contracts).toContain('## SME_APPROVED');
  });
  it('agent-contracts.md contains ## SME_CONCERNS marker', () => {
    expect(contracts).toContain('## SME_CONCERNS');
  });
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| General-purpose code review | Domain-specific adversarial gate with SME-sourced findings | Phase 5 (this phase) | Auditor cross-references against structured domain knowledge, not LLM intuition |
| Plan checker verifies completeness | SME auditor verifies domain safety | Architecture decision | Two separate concerns, two separate agents — plan-checker is requirement-complete, auditor is domain-safe |
| Severity set by auditor's judgment | Severity inherited from SME document | Phase 5 design | Prevents severity drift; SME author's calibration (with git evidence) is more reliable than in-context LLM judgment |

**Deprecated/outdated:**
- Using `Write` in read-only auditor agents: The security auditor (`gsd-security-auditor.md`) writes SECURITY.md as part of its output. The SME auditor does NOT write any file — it produces only a return marker. This is a deliberate difference from the security auditor pattern.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The auditor receives SME context via the prompt parameter (as XML block), not by reading `.planning/smes/` directly | Architecture Patterns | If the auditor reads SME files directly, the Phase 2 `sme.context-block` handler is bypassed and the XML wrapping is lost; Phase 6 gate design depends on the context injection pattern |
| A2 | `block_mode` in the SME frontmatter is consumed by Phase 6 gate, not by the auditor itself | Common Pitfalls | If the auditor suppresses findings based on block_mode, Phase 6 gate receives incorrect signal for strict-mode enforcement |
| A3 | The `## SME_APPROVED` / `## SME_CONCERNS` markers follow the ALL-CAPS H2 standard (not title-case like gsd-verifier) | Standard Stack / Patterns | If Phase 6 gate regex expects different casing, the markers will not match; must be consistent with what Phase 6 implements |
| A4 | No sub-agent decomposition is needed — a single PLAN.md + 1-3 SME documents fits comfortably in one context window | Architecture | If plans become very large or many SME documents are injected simultaneously, context pressure could cause truncation |

---

## Open Questions

1. **How many SME documents can be injected in a single audit call?**
   - What we know: Phase 6 gate uses `sme.detect-processes` to find relevant processes, then `sme.context-block` per process. A phase could touch multiple processes.
   - What's unclear: If 3-4 processes are detected, the prompt could carry 15-25KB of SME context plus PLAN.md. At what size does this become a problem?
   - Recommendation: For Phase 5 scope, design the agent for a single SME context block. Multi-SME behavior is Phase 6 scope. Note this as a Phase 6 consideration.

2. **Should the auditor produce a WATCH-only approval or always use SME_CONCERNS for any open finding?**
   - What we know: AUDIT-03 specifies `## SME_APPROVED` or `## SME_CONCERNS` — binary. WATCH findings are lower severity.
   - What's unclear: Whether `## SME_APPROVED` is valid when WATCHes are unaddressed (BLOCKERs and WARNINGs all addressed). This affects Phase 6 gate behavior.
   - Recommendation: Define `## SME_APPROVED` as "zero unaddressed BLOCKERs" and include WATCHes in the CONCERNS output for awareness. Phase 6 gate can choose to ignore WATCHes in soft mode. The planner should confirm this interpretation.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 5 deliverables are markdown agent definition files and a TypeScript test file. No external dependencies beyond the existing project toolchain.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | vitest test execution | Yes | v20.20.2 | — |
| vitest | Structural test runner | Yes | ^3.1.1 | — |
| git | — | Yes | 2.43.0 | — |

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUDIT-01 | `gsd-sme-auditor` reviews PLAN.md with adversarial stance ("assume domain risks ARE present until proven otherwise") | Fulfilled by `<adversarial_stance>` block with FORCE stance phrasing; few-shot ADDRESSED/UNADDRESSED examples calibrate judgment; standard pattern from gsd-plan-checker.md and gsd-security-auditor.md verified in repo |
| AUDIT-02 | Auditor operates in read-only mode — never modifies implementation files | Fulfilled by excluding Write/Edit from agent YAML `tools:` frontmatter; stated as `<critical_rules>` constraint; enforced at SDK level — tools not listed in frontmatter cannot be granted |
| AUDIT-03 | Auditor returns structured markers: `## SME_APPROVED` or `## SME_CONCERNS` with severity-classified findings | Fulfilled by `<structured_returns>` section in agent definition; markers follow ALL-CAPS H2 convention established in agent-contracts.md; severity labels BLOCKER/WARNING/WATCH inherited from SME document |
| AUDIT-04 | Auditor requires concrete mitigations naming file paths and function calls, not abstract patterns | Fulfilled by `<critical_rules>` definition of ADDRESSED ("names specific file path and function call from Evidence field"); calibrated by ADDRESSED/UNADDRESSED few-shot examples in `<severity_examples>` |
| AUDIT-05 | Return markers registered in `agent-contracts.md` | Fulfilled by updating get-shit-done/references/agent-contracts.md with gsd-sme-auditor row and marker definitions; structural test verifies registration |
</phase_requirements>

---

## Validation Architecture

nyquist_validation is enabled (`workflow.nyquist_validation: true` in `.planning/config.json`). [VERIFIED: .planning/config.json]

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 3.1.1 |
| Config file | `sdk/vitest.config.ts` |
| Quick run command | `cd sdk && npx vitest run --project unit` |
| Full suite command | `cd sdk && npx vitest run` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUDIT-01 | Agent has `<adversarial_stance>` block with FORCE stance | manual/structural | `grep "FORCE stance" agents/gsd-sme-auditor.md` | No — Wave 0 |
| AUDIT-01 | Adversarial stance assumes risks ARE present | structural | `cd sdk && npx vitest run --project unit src/agents/sme-auditor-structure.test.ts` | No — Wave 0 |
| AUDIT-02 | Agent tools frontmatter excludes Write and Edit | structural | `cd sdk && npx vitest run --project unit src/agents/sme-auditor-structure.test.ts` | No — Wave 0 |
| AUDIT-02 | critical_rules block states read-only constraint | structural | `grep "read-only\|produce no file" agents/gsd-sme-auditor.md` | No — Wave 0 |
| AUDIT-03 | Agent defines ## SME_APPROVED marker | structural | `cd sdk && npx vitest run --project unit src/agents/sme-auditor-structure.test.ts` | No — Wave 0 |
| AUDIT-03 | Agent defines ## SME_CONCERNS marker | structural | `cd sdk && npx vitest run --project unit src/agents/sme-auditor-structure.test.ts` | No — Wave 0 |
| AUDIT-03 | Output uses BLOCKER/WARNING/WATCH classification | structural | `cd sdk && npx vitest run --project unit src/agents/sme-auditor-structure.test.ts` | No — Wave 0 |
| AUDIT-04 | BLOCKER ADDRESSED requires file path + function | structural | `cd sdk && npx vitest run --project unit src/agents/sme-auditor-structure.test.ts` | No — Wave 0 |
| AUDIT-05 | gsd-sme-auditor row in agent-contracts.md | structural | `grep "gsd-sme-auditor" get-shit-done/references/agent-contracts.md` | No — Wave 0 |
| AUDIT-05 | SME_APPROVED and SME_CONCERNS in agent-contracts.md | structural | `cd sdk && npx vitest run --project unit src/agents/sme-auditor-structure.test.ts` | No — Wave 0 |

**Note on testing approach:** Phase 5 deliverables are markdown agent files and a contracts document update — not TypeScript runtime code. Structural Vitest tests (following Phase 3/4 pattern) verify static file content. Runtime behavior correctness requires manual agent invocation or a future Promptfoo eval.

### Sampling Rate

- **Per task commit:** `grep "## SME_APPROVED\|## SME_CONCERNS" agents/gsd-sme-auditor.md` (verify return markers)
- **Per wave merge:** `cd sdk && npx vitest run --project unit`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `sdk/src/agents/sme-auditor-structure.test.ts` — covers AUDIT-01/02/03/04/05

*(No existing test file for gsd-sme-auditor)*

---

## Security Domain

security_enforcement is not explicitly set to false — treating as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Internal developer tool, no auth surface |
| V3 Session Management | No | Agent sessions managed by SDK |
| V4 Access Control | No | No multi-user access model |
| V5 Input Validation | Yes | SME context block content comes from developer-authored files at project trust level — no user-supplied untrusted input; process name used in prompt is already validated upstream (Phase 4 workflow validation, `[a-zA-Z0-9_-]+`) |
| V6 Cryptography | No | No cryptographic operations |

### Known Threat Patterns for This Phase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Prompt injection via SME content | Tampering | SME documents are author-created project files at same trust level as PLAN.md (T-02-02 decision from Phase 2, verified in sme.ts comment); no untrusted external content |
| Read-only bypass | Elevation of privilege | Enforce by excluding Write/Edit from agent YAML tools frontmatter — SDK cannot grant tools not listed |
| Severity manipulation via SME content | Tampering | Agent must inherit severity from SME label, not re-assess; `<critical_rules>` enforces this; SME documents are project files authored by the developer running the tool |

**Established security decision from Phase 1/2 (from STATE.md and sme.ts):**
- SME document content is treated at project-file trust level (same as PLAN.md) — T-02-02
- Process name in paths uses `[a-zA-Z0-9_-]+` validation — established in Phase 1

---

## Sources

### Primary (HIGH confidence)

- `agents/gsd-plan-checker.md` — adversarial stance pattern, read-only tools pattern, structured return markers [VERIFIED: repo]
- `agents/gsd-security-auditor.md` — adversarial stance variant, FORCE stance language, structured SECURED/OPEN_THREATS/ESCALATE markers [VERIFIED: repo]
- `agents/gsd-nyquist-auditor.md` — adversarial stance variant, FORCE stance, read-only enforcement pattern [VERIFIED: repo]
- `agents/gsd-eval-auditor.md` — adversarial stance, COVERED/PARTIAL/MISSING finding classification [VERIFIED: repo]
- `get-shit-done/references/agent-contracts.md` — marker registration format, ALL-CAPS convention, registry table structure [VERIFIED: repo]
- `sdk/src/agents/sme-creator-structure.test.ts` — structural test pattern for agent files [VERIFIED: repo]
- `sdk/src/agents/create-sme-workflow-structure.test.ts` — structural test pattern for Phase 4 [VERIFIED: repo]
- `sdk/src/query/sme.ts` — sme.context-block output format; XML wrapping pattern [VERIFIED: repo]
- `get-shit-done/templates/sme.md` — SME document format the auditor must parse [VERIFIED: repo]
- `.planning/phases/03-sme-creator-agent/03-AI-SPEC.md` — severity calibration requirements, BLOCKER inflation risks, false positive adoption failure analysis [VERIFIED: repo]
- `.planning/REQUIREMENTS.md` — AUDIT-01 through AUDIT-05 requirement text [VERIFIED: repo]
- `.planning/config.json` — nyquist_validation: true confirmed [VERIFIED: repo]
- `@anthropic-ai/claude-agent-sdk` latest version: 0.2.123 [VERIFIED: npm view]

### Secondary (MEDIUM confidence)

- `.planning/STATE.md` — security decisions on process name validation, Phase 2 completion status
- `.planning/ROADMAP.md` — phase 5 goal and success criteria; phase boundary confirmation

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified against installed versions and repo scan
- Architecture: HIGH — patterns verified from 4 existing auditor agents in repo
- Pitfalls: HIGH — sourced from AI-SPEC + live repo patterns with phase-specific validation
- Return markers: HIGH — verified against agent-contracts.md format rules

**Research date:** 2026-04-30
**Valid until:** 2026-05-30 (30 days — stable agent SDK, stable project patterns)
