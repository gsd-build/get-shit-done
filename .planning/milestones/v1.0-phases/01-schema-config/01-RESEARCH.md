# Phase 1: Schema & Config - Research

**Researched:** 2026-04-28
**Domain:** GSD config system, YAML frontmatter, Markdown template patterns
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01:** Findings use inline severity tags as bullet prefixes: `- [BLOCKER] **Title** — Description` with `*Evidence:*` and `*Mitigation:*` as italic sub-fields on continuation lines

**D-02:** All four fields are required for every finding: severity tag, bold title, evidence (file:line reference), and mitigation. No optional fields — forces the creator agent to be specific

**D-03:** SME documents use six flat H2 sections in fixed order: Process Overview (prose), Identified Risks, Test Gaps, Outdated Logic, Edge Cases, Known Blockers. No subsystem grouping — findings are organized by type, not by code area

**D-04:** Frontmatter includes five fields: `process_name`, `last_analyzed_commit`, `block_mode` (soft|strict), `created_date`, and `finding_counts` (blocker/warning/watch tallies)

**D-05:** Feature flag lives at `workflow.use_sme_agents` (consistent with other workflow toggles). SME behavior settings live under a new `sme.*` top-level namespace

**D-06:** Phase 1 registers all config keys upfront: `workflow.use_sme_agents` (static), `sme.blocking` (static), and `sme.processes.{name}.block_mode` (dynamic pattern). Per-process override logic is wired in later phases but the keys are valid from day one

**D-07:** `gsd-tools template sme` outputs the blank template to stdout. The template file lives at `get-shit-done/templates/sme.md`. Caller captures and writes to the target path

**D-08:** Template includes HTML-commented example findings per section. Comments guide the creator agent on expected format and are stripped when filled in

### Claude's Discretion

- Process Overview section depth and prose style
- Exact wording of placeholder text in template sections
- Whether `finding_counts` in frontmatter uses nested YAML or flat keys

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SCHEMA-01 | SME documents stored in `.planning/smes/{PROCESS_NAME}-SME.md` with structured sections | Section structure, frontmatter format, and template delivery patterns below |
| SCHEMA-02 | Each finding carries a severity label: BLOCKER, WARNING, or WATCH | Finding format pattern (D-01/D-02) locked by user |
| SCHEMA-03 | SME document frontmatter includes `last_analyzed_commit` hash | Frontmatter system (frontmatter.cjs) fully supports this; pattern confirmed |
| SCHEMA-04 | SME document frontmatter includes `block_mode` field (soft or strict) | Config key `sme.processes.{name}.block_mode` registered per D-06 |
| SCHEMA-05 | SME document template available via `gsd-tools template sme` | `template.cjs` extension pattern confirmed; new `template sme` subcommand approach documented |
| CONFIG-01 | `workflow.use_sme_agents` config flag (default: false) gates all SME features | VALID_CONFIG_KEYS extension pattern confirmed in both CJS and SDK files |
| CONFIG-02 | When `use_sme_agents` is false, all SME workflow steps are unconditionally skipped | Config gate pattern (matching `workflow.code_review` guard style) documented |
| CONFIG-03 | `sme.blocking` config key controls default block mode for new SMEs | Dynamic pattern registration approach confirmed |
| CONFIG-04 | Enabling SMEs mid-project with no existing SME documents emits a warning, never blocks | Warning-only emit pattern (matching `GATE-07` requirement spec) documented |
</phase_requirements>

---

## Summary

Phase 1 is a pure schema + config registration phase. No agent logic, no workflow integration — only the document format contract and config key plumbing. The codebase already has all the building blocks needed: `frontmatter.cjs` for YAML parsing, `config-schema.cjs` plus its SDK mirror `config-schema.ts` for key validation, `template.cjs`/`gsd-tools.cjs` for the template command surface, and `docs/CONFIGURATION.md` for the docs-parity CI guard.

There are three parallel work streams: (1) create the SME document template at `get-shit-done/templates/sme.md`, (2) register the new config keys in four files that must stay in sync (CJS schema, SDK schema, `buildNewProjectConfig` in config.cjs, SDK `WorkflowConfig`/`GSDConfig` types, and `docs/CONFIGURATION.md`), and (3) wire `gsd-tools template sme` as a new subcommand in the `template` case block of `gsd-tools.cjs`.

The most important constraint to plan around is the **three-file parity requirement** for config keys: adding a key to `config-schema.cjs` without also adding it to `sdk/src/query/config-schema.ts` and `docs/CONFIGURATION.md` breaks two separate CI tests (`config-schema-docs-parity.test.cjs` and `config-schema-sdk-parity.test.cjs`). Every config key addition must touch all three files atomically.

**Primary recommendation:** Treat the three config key files as a single atomic unit — plan one task that edits all three together, not three separate tasks.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| SME document format/schema | Filesystem (planning docs) | — | Pure markdown + YAML frontmatter; no runtime component |
| Config key registration | Config system (CJS + SDK) | Docs layer | Keys live in config-schema.cjs + SDK mirror; docs-parity enforced by CI |
| Template delivery (`gsd-tools template sme`) | CLI tool (`gsd-tools.cjs`) | Template layer (`template.cjs`) | All template commands route through `gsd-tools.cjs` case block → `template.cjs` |
| Workflow skip guard (`use_sme_agents: false`) | Workflow layer (future phases) | Config system | Guard reads config; workflow wiring is Phase 2+ territory — Phase 1 only registers the key |
| `.planning/smes/` directory creation | Filesystem | — | Created on first use (later phases); Phase 1 does not create it |

---

## Standard Stack

### Core

| File | Purpose | Why Standard |
|------|---------|--------------|
| `get-shit-done/bin/lib/config-schema.cjs` | VALID_CONFIG_KEYS set + DYNAMIC_KEY_PATTERNS | Single source of truth for config-set validation; all new keys go here first |
| `sdk/src/query/config-schema.ts` | SDK mirror of config-schema.cjs | CI parity test (`config-schema-sdk-parity.test.cjs`) enforces identical allowlist |
| `docs/CONFIGURATION.md` | Human-readable config docs | CI parity test (`config-schema-docs-parity.test.cjs`) requires backtick mention for each exact key |
| `get-shit-done/bin/lib/config.cjs` (`buildNewProjectConfig`) | New-project config defaults | The canonical place to add `workflow.use_sme_agents: false` as an explicit default |
| `sdk/src/config.ts` (`WorkflowConfig`, `GSDConfig`) | TypeScript types for config | Add `use_sme_agents?: boolean` to `WorkflowConfig`; add `sme?: Record<string, unknown>` to `GSDConfig` |
| `get-shit-done/bin/lib/frontmatter.cjs` | YAML frontmatter extract/reconstruct | Used for SME doc frontmatter parsing in all later phases |
| `get-shit-done/bin/lib/template.cjs` | Template fill operations | Extend with `sme` template type (or use raw stdout approach per D-07) |
| `get-shit-done/bin/gsd-tools.cjs` (template case) | CLI routing for `template sme` | Add `sme` subcommand to the existing `template` case block |
| `get-shit-done/templates/sme.md` | SME document blank template | New file — follow existing template conventions (`spec.md` as reference) |

### Supporting

| File | Purpose | When to Use |
|------|---------|-------------|
| `get-shit-done/bin/lib/core.cjs` (`atomicWriteFileSync`) | Safe file writes | Template command writes the output file atomically |
| `tests/config-schema-docs-parity.test.cjs` | CI drift guard (docs <-> CJS) | Runs automatically; will fail if docs not updated |
| `tests/config-schema-sdk-parity.test.cjs` | CI drift guard (CJS <-> SDK) | Runs automatically; will fail if SDK not updated |

---

## Architecture Patterns

### System Architecture Diagram

```
User (shell)
    |
    v
gsd-tools.cjs  --"template sme"-->  template.cjs
    |                                   |
    |                                   v
    |                           reads: get-shit-done/templates/sme.md
    |                                   |
    |                                   v
    |                           writes stdout (caller captures)
    |
    v
gsd-tools.cjs  --"config-set workflow.use_sme_agents false"-->  config.cjs
    |                                                                |
    |                                                                v
    |                                                    validates via config-schema.cjs
    |                                                                |
    |                                                                v
    |                                                    writes .planning/config.json
    |
    v
config-schema.cjs  <-- MIRRORED BY -->  sdk/src/query/config-schema.ts
                                                     |
                                                     v
                                             CI parity tests (both)
```

### Recommended Project Structure

No new directory is created in Phase 1. Files touched:

```
get-shit-done/
├── bin/lib/config-schema.cjs      # Add 3 static keys + 1 dynamic pattern
├── bin/lib/config.cjs             # Add use_sme_agents: false to buildNewProjectConfig
├── bin/gsd-tools.cjs              # Add 'sme' to template case block
├── templates/sme.md               # NEW — blank SME document template
sdk/src/
├── query/config-schema.ts         # Mirror the 3 new keys + dynamic pattern
├── config.ts                      # Add use_sme_agents to WorkflowConfig; sme to GSDConfig
docs/
└── CONFIGURATION.md               # Document all 3 new keys in Workflow Toggles table
```

### Pattern 1: Registering a New Workflow Toggle

All workflow feature flags follow this exact pattern. The `workflow.code_review` flag (added v1.34) is the canonical recent reference.

**Step 1 — config-schema.cjs (CJS)**

```javascript
// Source: get-shit-done/bin/lib/config-schema.cjs
const VALID_CONFIG_KEYS = new Set([
  // ... existing keys ...
  'workflow.code_review',       // existing example
  'workflow.use_sme_agents',    // NEW — add here
  'sme.blocking',               // NEW — add here
]);

const DYNAMIC_KEY_PATTERNS = [
  // ... existing patterns ...
  {
    topLevel: 'sme',
    test: (k) => /^sme\.processes\.[a-zA-Z0-9_-]+\.block_mode$/.test(k),
    description: 'sme.processes.<process-name>.block_mode',
  },  // NEW
];
```

**Step 2 — sdk/src/query/config-schema.ts (SDK mirror)**

```typescript
// Source: sdk/src/query/config-schema.ts
export const VALID_CONFIG_KEYS: ReadonlySet<string> = new Set([
  // ... existing keys ...
  'workflow.use_sme_agents',    // NEW — must match CJS exactly
  'sme.blocking',               // NEW — must match CJS exactly
]);

export const DYNAMIC_KEY_PATTERNS: readonly DynamicKeyPattern[] = [
  // ... existing patterns ...
  {
    source: '^sme\\.processes\\.[a-zA-Z0-9_-]+\\.block_mode$',
    description: 'sme.processes.<process-name>.block_mode',
    test: (k) => /^sme\.processes\.[a-zA-Z0-9_-]+\.block_mode$/.test(k),
  },  // NEW
];
```

**Step 3 — docs/CONFIGURATION.md (parity requirement)**

Add to the Workflow Toggles table (backtick-wrapped key name is what the parity test checks):

```markdown
| `workflow.use_sme_agents` | boolean | `false` | ... description ... |
```

Add `sme.blocking` in an SME Settings section.

**Step 4 — config.cjs buildNewProjectConfig (explicit default)**

```javascript
// Source: get-shit-done/bin/lib/config.cjs
const hardcoded = {
  // ...
  workflow: {
    // ... existing workflow flags ...
    use_sme_agents: false,  // NEW — opt-in, default off per D-05
  },
  sme: {
    blocking: 'soft',  // NEW — default block mode per D-06
  },
};
```

**Step 5 — sdk/src/config.ts (TypeScript types)**

```typescript
// Source: sdk/src/config.ts
export interface WorkflowConfig {
  // ... existing fields ...
  use_sme_agents: boolean;  // NEW
}

export interface GSDConfig {
  // ... existing fields ...
  sme?: {
    blocking?: string;  // NEW
    [key: string]: unknown;
  };
}
```

### Pattern 2: Template File + gsd-tools Command

The current `template fill` subcommand in `gsd-tools.cjs` handles `summary`, `plan`, and `verification` types by calling `template.cmdTemplateFill`. Decision D-07 specifies that `gsd-tools template sme` outputs to **stdout** (not writing a file), which is different from `template fill`.

Two approaches exist:

**Approach A (recommended, simpler): Raw file read + stdout**

Add a `sme` branch in the `template` case block that simply reads `get-shit-done/templates/sme.md` and outputs it to stdout. This requires zero changes to `template.cjs` and is consistent with D-07 ("outputs the blank template to stdout; caller captures and writes to the target path").

```javascript
// Source: get-shit-done/bin/gsd-tools.cjs — template case block
case 'template': {
  const subcommand = args[1];
  if (subcommand === 'sme') {
    // D-07: output template to stdout, caller writes to target path
    const tmplPath = path.join(__dirname, '..', 'templates', 'sme.md');
    if (!fs.existsSync(tmplPath)) {
      error('SME template not found at: ' + tmplPath);
    }
    const content = fs.readFileSync(tmplPath, 'utf-8');
    process.stdout.write(content);
    break;
  }
  // ... existing select/fill handling ...
}
```

**Approach B (heavier): Extend template.cjs**

Add a `sme` case to `cmdTemplateFill` in `template.cjs`. This is heavier than needed for a static stdout template and is not recommended for Phase 1.

### Pattern 3: YAML Frontmatter for SME Documents

`frontmatter.cjs` handles nested YAML with up to 3 levels. The `finding_counts` field from D-04 can use either nested or flat keys — this is Claude's discretion. The recommended choice is **nested** for readability:

```yaml
---
process_name: payments
last_analyzed_commit: abc1234
block_mode: soft
created_date: 2026-04-28
finding_counts:
  blocker: 0
  warning: 0
  watch: 0
---
```

`reconstructFrontmatter` in `frontmatter.cjs` handles nested objects correctly (see lines 135-151), so this will round-trip correctly through frontmatter-set/get operations.

### Anti-Patterns to Avoid

- **Adding only to CJS config-schema without updating the SDK mirror:** The `config-schema-sdk-parity.test.cjs` CI test will fail immediately. Always update both files in the same commit.
- **Adding a config key to VALID_CONFIG_KEYS without documenting it in CONFIGURATION.md:** The `config-schema-docs-parity.test.cjs` CI test will fail. The test checks for backtick-wrapped key name in the docs file.
- **Setting `workflow.use_sme_agents` default to `true` in `buildNewProjectConfig`:** This breaks backward compatibility. Existing projects that upgrade GSD would suddenly have SME checks run. Default MUST be `false` per D-05 and CONFIG-01.
- **Using `template fill` infrastructure for the `sme` command:** `cmdTemplateFill` writes directly to a file on disk, which contradicts D-07 (output to stdout). Use the raw file-read approach instead.
- **Writing finding sections without all four required sub-fields:** D-02 requires severity tag, bold title, evidence, and mitigation on every finding. The template's HTML comments must model the complete format to guide the creator agent.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic file writes | Custom write-then-rename | `atomicWriteFileSync` from `core.cjs` | Already handles temp file + rename + cleanup |
| YAML frontmatter parse | Custom YAML parser | `extractFrontmatter` / `spliceFrontmatter` from `frontmatter.cjs` | Handles 3-level nesting, inline arrays, quote-aware split — edge cases are already tested |
| Config key validation | Custom key checker | `isValidConfigKey` from `config-schema.cjs` | Handles both exact and dynamic pattern keys |
| Config read/write with dot-notation | Custom traversal | `cmdConfigGet` / `cmdConfigSet` / `setConfigValue` from `config.cjs` | Handles nested objects, boolean coercion, atomic writes with lock |

**Key insight:** This codebase has a mature, tested CJS utility layer. The Phase 1 work is almost entirely additive — inserting new entries into existing data structures, not building new infrastructure.

---

## Common Pitfalls

### Pitfall 1: Three-File Config Parity Trap

**What goes wrong:** Developer adds `workflow.use_sme_agents` to `config-schema.cjs` but forgets to update `sdk/src/query/config-schema.ts` or `docs/CONFIGURATION.md`. CI fails on parity tests.

**Why it happens:** Three separate files enforce the same invariant from different angles (runtime validation, SDK validation, documentation). The relationship is not obvious from reading any single file.

**How to avoid:** Plan a single task that edits all three files. The task's verification step should run the parity tests before completing.

**Warning signs:** CI test names `config-schema-docs-parity` or `config-schema-sdk-parity` appearing in test output.

### Pitfall 2: Forgetting WorkflowConfig / GSDConfig TypeScript Types

**What goes wrong:** `workflow.use_sme_agents` is added to VALID_CONFIG_KEYS and config-schema.ts but not to the `WorkflowConfig` interface in `sdk/src/config.ts`. TypeScript consumers get `any` type or a type error when accessing `config.workflow.use_sme_agents`.

**Why it happens:** The TypeScript types in `sdk/src/config.ts` are maintained separately from the runtime validation in `config-schema.ts`.

**How to avoid:** Include `sdk/src/config.ts` in the same task as the schema files.

**Warning signs:** TypeScript type errors in SDK consumers after the task completes.

### Pitfall 3: DYNAMIC_KEY_PATTERNS Regex Source String Mismatch

**What goes wrong:** CJS dynamic pattern uses `{ test: (k) => /regex/ }` while SDK mirror uses a different regex source string. The `config-schema-sdk-parity.test.cjs` checks that `DynamicKeyPattern.source` equals the CJS regex `.source` string exactly.

**Why it happens:** TypeScript patterns must include a `source` field that matches the raw regex source string. It's easy to write the regex correctly but use different character escaping.

**How to avoid:** Copy the regex from the CJS file verbatim, then set `source` to the string literal of that regex source. For `sme.processes.*`, the source would be: `^sme\\.processes\\.[a-zA-Z0-9_-]+\\.block_mode$`

**Warning signs:** `config-schema-sdk-parity.test.cjs` failing on dynamic pattern source mismatch.

### Pitfall 4: Template stdout vs. File Write Confusion

**What goes wrong:** `gsd-tools template sme` writes the template directly to disk (like `template fill` does for plan/summary/verification), instead of outputting to stdout for the caller to redirect.

**Why it happens:** The existing `template fill` pattern writes to disk. It's natural to follow the same pattern.

**How to avoid:** D-07 is explicit: stdout output, caller writes the file. Use `process.stdout.write(content)` not `fs.writeFileSync(...)`.

**Warning signs:** `gsd-tools template sme > .planning/smes/foo-SME.md` works but `gsd-tools template sme` creates files in unexpected locations.

### Pitfall 5: `findingCounts` Nested YAML Parse Failure

**What goes wrong:** `finding_counts` is written as a nested YAML object but `extractFrontmatter` parses it incorrectly because of indentation edge cases.

**Why it happens:** `frontmatter.cjs` handles 3-level nesting but has specific requirements for indentation (2 spaces per level).

**How to avoid:** Test the round-trip: write the SME template, run `gsd-tools frontmatter get <file>`, verify `finding_counts` parses as an object with three keys. Alternatively use flat keys (`blocker_count`, `warning_count`, `watch_count`) since that is within Claude's discretion.

---

## Code Examples

### Adding a Static Config Key (Pattern)

```javascript
// Source: get-shit-done/bin/lib/config-schema.cjs (verified by reading file)
// Add to VALID_CONFIG_KEYS Set:
'workflow.use_sme_agents',
'sme.blocking',
```

### Adding a Dynamic Config Pattern (Pattern)

```javascript
// Source: get-shit-done/bin/lib/config-schema.cjs (verified by reading file)
// Add to DYNAMIC_KEY_PATTERNS array:
{
  topLevel: 'sme',
  test: (k) => /^sme\.processes\.[a-zA-Z0-9_-]+\.block_mode$/.test(k),
  description: 'sme.processes.<process-name>.block_mode',
},
```

### SDK Mirror Dynamic Pattern (including required source field)

```typescript
// Source: sdk/src/query/config-schema.ts (verified by reading file)
// Add to DYNAMIC_KEY_PATTERNS array:
{
  source: '^sme\\.processes\\.[a-zA-Z0-9_-]+\\.block_mode$',
  description: 'sme.processes.<process-name>.block_mode',
  test: (k) => /^sme\.processes\.[a-zA-Z0-9_-]+\.block_mode$/.test(k),
},
```

### SME Document Frontmatter Structure (per D-04)

```yaml
---
process_name: payments
last_analyzed_commit: abc1234def5678
block_mode: soft
created_date: 2026-04-28
finding_counts:
  blocker: 0
  warning: 0
  watch: 0
---
```

### Finding Format (per D-01 / D-02)

```markdown
- [BLOCKER] **Race condition in payment lock acquisition** — Concurrent checkout requests can acquire the
  same lock ID when stock falls to exactly 1 unit.
  *Evidence:* `src/payments/checkout.ts:142` — lock check is not atomic
  *Mitigation:* Wrap lock check + acquire in a database transaction with `SELECT FOR UPDATE`
```

### SME Template Section Structure (per D-03 / D-08)

```markdown
---
process_name: [PROCESS_NAME]
last_analyzed_commit: [COMMIT_HASH]
block_mode: soft
created_date: [DATE]
finding_counts:
  blocker: 0
  warning: 0
  watch: 0
---

# [PROCESS_NAME] SME Document

## Process Overview

[Prose description of this process: what it does, who uses it, key invariants,
and the main code paths involved. Written by the creator agent after analysis.]

## Identified Risks

<!-- [BLOCKER] **Example risk title** — Brief description of the risk.
  *Evidence:* `src/path/to/file.ts:LINE` — what makes this a risk
  *Mitigation:* Specific action to address it -->

## Test Gaps

<!-- [WARNING] **Example gap title** — Brief description of what is not tested.
  *Evidence:* `tests/path/to/test.ts:LINE` — what coverage is missing
  *Mitigation:* Specific test or assertion to add -->

## Outdated Logic

<!-- [WATCH] **Example outdated pattern** — Brief description of stale logic.
  *Evidence:* `src/path/to/file.ts:LINE` — the outdated code
  *Mitigation:* How to modernize or document the pattern -->

## Edge Cases

<!-- [WARNING] **Example edge case** — Brief description of the edge case.
  *Evidence:* `src/path/to/file.ts:LINE` — where this can be triggered
  *Mitigation:* Defensive handling required -->

## Known Blockers

<!-- [BLOCKER] **Example blocker** — Brief description of a known blocker.
  *Evidence:* Reference to issue, PR, or code location
  *Mitigation:* What must change before this process can be safely modified -->
```

### gsd-tools template sme Command Wire-Up

```javascript
// Source: get-shit-done/bin/gsd-tools.cjs — insert into 'template' case block
if (subcommand === 'sme') {
  // D-07: output template to stdout; caller redirects to target path
  const tmplPath = path.resolve(__dirname, '..', 'templates', 'sme.md');
  if (!fs.existsSync(tmplPath)) {
    error('SME template not found: ' + tmplPath);
  }
  const content = fs.readFileSync(tmplPath, 'utf-8');
  process.stdout.write(content);
  break;
}
```

---

## State of the Art

| Area | Current Approach | Notes |
|------|------------------|-------|
| Config key validation | Two-layer (CJS + SDK) with three CI parity tests | Stable pattern; new keys must touch all layers |
| Template commands | `template fill` writes to disk; new `template sme` outputs stdout | D-07 intentionally diverges from the fill pattern |
| YAML frontmatter | Custom parser in frontmatter.cjs (not a YAML library) | Handles project's specific 3-level nesting needs |
| Workflow feature flags | `workflow.{feature}: boolean` with absent = enabled as default | `use_sme_agents` is OPT-IN so default must be explicit `false` |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `__dirname` in gsd-tools.cjs correctly resolves to `get-shit-done/bin/` at runtime | Code Examples (template wire-up) | Template file not found; fix path resolution |
| A2 | The `topLevel` field in DYNAMIC_KEY_PATTERNS (CJS) is informational metadata only, not validated by the parity test | Pattern 1 — Dynamic pattern registration | If parity test checks `topLevel`, the SME pattern needs the field |
| A3 | `buildNewProjectConfig` in config.cjs is the canonical location for default values of new workflow keys | Standard Stack | If defaults live elsewhere, new projects may not have `use_sme_agents: false` |

**Note:** A1 and A3 are LOW confidence (training knowledge); A2 is MEDIUM (inferred from reading parity test source which checks `test.source` but not `topLevel`). The planner should verify A1 by checking `__dirname` resolution in an existing template call, and A3 by tracing where `workflow.code_review` gets its default.

---

## Open Questions (RESOLVED)

1. **`finding_counts` — nested vs. flat keys**
   RESOLVED: Use nested YAML (`finding_counts: { blocker: 0, warning: 0, watch: 0 }`). Confirmed that `frontmatter.cjs` `reconstructFrontmatter` handles nested objects correctly (lines 135-151). Nested format is richer for later SDK queries (`sme.list`). If a round-trip failure is discovered during execution, flat keys (`blocker_count`, `warning_count`, `watch_count`) are the fallback — but this is not expected.

2. **`gsd-tools template sme` invocation format**
   RESOLVED: Use `gsd-tools template sme` (positional arg to the `template` case block), NOT `gsd-tools template fill sme`. The `fill` subcommand writes to disk via `cmdTemplateFill`, which contradicts D-07 (stdout output). A separate `sme` subcommand keyword in the existing if/else chain is cleaner and consistent with D-07.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 1 is pure code/config changes. No external tools, services, runtimes, or CLI utilities beyond the project's own Node.js stack are required. Node.js >= 22 is already the project runtime.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (SDK unit/integration) + Node `node:test` (CJS tests) |
| Config file | `vitest.config.ts` (SDK) |
| Quick run command | `npx vitest run --project unit` (SDK) or `node --test tests/config-schema-docs-parity.test.cjs` (CJS) |
| Full suite command | `npx vitest run` (all SDK) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CONFIG-01 | `workflow.use_sme_agents` accepted by `isValidConfigKey` | unit | `node --test tests/config-schema-docs-parity.test.cjs` | Yes (extends existing) |
| CONFIG-01 | `workflow.use_sme_agents` accepted by SDK `isValidConfigKey` | unit | `npx vitest run --project unit sdk/src/query/config-mutation.test.ts` | Yes (extends existing) |
| CONFIG-01 | `workflow.use_sme_agents` documented in CONFIGURATION.md | unit | `node --test tests/config-schema-docs-parity.test.cjs` | Yes (extends existing) |
| CONFIG-03 | `sme.blocking` accepted by config-set | unit | `node --test tests/config-schema-docs-parity.test.cjs` | Yes (extends existing) |
| CONFIG-03 | `sme.processes.*.block_mode` matches dynamic pattern | unit | `npx vitest run --project unit sdk/src/query/config-mutation.test.ts` | Yes (extends existing) |
| SCHEMA-05 | `gsd-tools template sme` outputs non-empty content | smoke | `node get-shit-done/bin/gsd-tools.cjs template sme | head -1` | No (Wave 0) |
| SCHEMA-01 | SME template contains all six H2 sections | unit | manual `grep` check or new test | No (Wave 0) |

### Sampling Rate

- **Per task commit:** `node --test tests/config-schema-docs-parity.test.cjs && node --test tests/config-schema-sdk-parity.test.cjs`
- **Per wave merge:** `npx vitest run` (full SDK suite)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] Smoke test for `gsd-tools template sme` stdout output — covers SCHEMA-05
- [ ] Structural test confirming the template file contains all six H2 section headings — covers SCHEMA-01 (optional; can be verified manually)

*(Existing test infrastructure covers all CONFIG-* requirements through parity tests — no new test files needed for those.)*

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes (minimal) | `process_name` in frontmatter and `sme.processes.{name}` in config use the same character class `[a-zA-Z0-9_-]+` — already validated by dynamic pattern regex |
| V6 Cryptography | no | — |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal in `process_name` (used in file path `.planning/smes/{name}-SME.md`) | Tampering | Enforce `[a-zA-Z0-9_-]+` character class when constructing paths (same guard already used in config dynamic patterns) |
| Template stdout injection (malicious content in sme.md leaking into shell substitution) | Tampering | Template file is project-internal; no untrusted input — risk is negligible for Phase 1 |

---

## Sources

### Primary (HIGH confidence)

- `[VERIFIED: codebase]` `get-shit-done/bin/lib/config-schema.cjs` — Full schema read; VALID_CONFIG_KEYS and DYNAMIC_KEY_PATTERNS structure confirmed
- `[VERIFIED: codebase]` `sdk/src/query/config-schema.ts` — SDK mirror structure, `source` field requirement confirmed
- `[VERIFIED: codebase]` `tests/config-schema-docs-parity.test.cjs` — Backtick-key check logic confirmed
- `[VERIFIED: codebase]` `tests/config-schema-sdk-parity.test.cjs` — CJS<->SDK parity check logic confirmed
- `[VERIFIED: codebase]` `get-shit-done/bin/lib/config.cjs` — `buildNewProjectConfig` structure; where workflow defaults are set
- `[VERIFIED: codebase]` `get-shit-done/bin/lib/frontmatter.cjs` — `extractFrontmatter`/`reconstructFrontmatter`; nested YAML support confirmed
- `[VERIFIED: codebase]` `get-shit-done/bin/lib/template.cjs` — Existing template fill pattern (disk-write); confirmed distinct from stdout approach
- `[VERIFIED: codebase]` `get-shit-done/bin/gsd-tools.cjs` — Template case block routing; confirmed `template sme` does not yet exist
- `[VERIFIED: codebase]` `sdk/src/config.ts` — `WorkflowConfig` interface; confirmed `use_sme_agents` absent
- `[VERIFIED: codebase]` `docs/CONFIGURATION.md` — Workflow Toggles table format; confirmed `use_sme_agents` and `sme.*` keys absent

### Secondary (MEDIUM confidence)

- `[VERIFIED: codebase]` `get-shit-done/templates/spec.md` — Reference template format; HTML comment usage for guidance confirmed
- `[VERIFIED: codebase]` `.planning/config.json` — Active project config; `workflow.use_sme_agents` absent, confirms key does not exist yet

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all files read directly from codebase; no external dependencies
- Architecture: HIGH — all integration points confirmed by reading source files
- Pitfalls: HIGH — derived directly from reading CI test logic and existing patterns

**Research date:** 2026-04-28
**Valid until:** 2026-06-28 (config schema patterns are stable; 60-day validity)
