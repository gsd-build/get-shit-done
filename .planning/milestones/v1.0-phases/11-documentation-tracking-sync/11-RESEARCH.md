# Phase 11: Documentation & Tracking Sync - Research

**Researched:** 2026-05-04
**Domain:** Planning metadata synchronization — markdown files, YAML frontmatter, CJS parity tests
**Confidence:** HIGH

## Summary

Phase 11 is a pure metadata synchronization phase. No new code or features are being built. All 10 functional phases are complete and verified. The work is entirely confined to updating planning documents to match their verified states and ensuring the CJS documentation parity test suite passes.

The milestone audit (`v1.0-MILESTONE-AUDIT.md`) precisely catalogs every gap. This research confirms those findings against the live filesystem and provides the exact changes needed to close each gap.

The phase has three categories of work:

1. **REQUIREMENTS.md**: Update 35 unchecked `[ ]` requirements to `[x]` and flip 35 traceability table rows from "Pending" to "Complete". (SCHEMA-01 through SCHEMA-05 and CONFIG-01 through CONFIG-03 are already `[x]`, so only 35 remain unchecked.)

2. **ROADMAP.md**: Update 8 phase checkboxes (Phases 2–9) from `[ ]` to `[x]`. Also fix a copy-paste error where Phase 11's plan list incorrectly shows `10-01-PLAN.md` instead of `11-01-PLAN.md`.

3. **INVENTORY.md / COMMANDS.md / INVENTORY-MANIFEST.json**: Add `gsd-sme-auditor` agent row to INVENTORY.md, add `/gsd-create-sme` command to COMMANDS.md, update `INVENTORY-MANIFEST.json` to include the 3 missing entries (`agents/gsd-sme-auditor`, `commands//gsd-create-sme`, `workflows/create-sme.md`), and bump the Agents and Commands headline counts.

4. **SUMMARY.md frontmatter**: Add `requirements-completed:` lists to 13 SUMMARY.md files across phases 1, 3, 4, 5, 6, 7, and 10.

**Primary recommendation:** Execute all changes in a single plan. The changes are all text edits to planning documents — no code changes, no tests to write, no compilation. Run the CJS parity tests before and after each group of changes to validate incrementally.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Requirement checkbox sync | Planning documents | — | Direct edit to .planning/REQUIREMENTS.md |
| Traceability table sync | Planning documents | — | Direct edit to .planning/REQUIREMENTS.md |
| ROADMAP phase completion | Planning documents | — | Direct edit to .planning/ROADMAP.md |
| INVENTORY.md agent roster | Docs layer | — | Direct edit to docs/INVENTORY.md |
| COMMANDS.md command list | Docs layer | — | Direct edit to docs/COMMANDS.md |
| INVENTORY-MANIFEST.json | Docs layer | — | Regenerate via script or direct edit |
| SUMMARY.md frontmatter | Planning documents | — | Direct edit to per-phase SUMMARY.md files |

## Standard Stack

No new libraries needed. All changes are markdown and JSON text edits using the project's existing infrastructure.

### Core
| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| `node --test tests/*.cjs` | Node.js 22 | Run CJS parity tests to verify changes | Existing project test runner |
| `node scripts/gen-inventory-manifest.cjs --write` | Node.js 22 | Regenerate INVENTORY-MANIFEST.json from filesystem | Project-provided script |

### Key Test Files
| Test | What It Validates |
|------|------------------|
| `tests/agents-doc-parity.test.cjs` | Every `agents/gsd-*.md` has a row in `docs/INVENTORY.md` Agents table |
| `tests/commands-doc-parity.test.cjs` | Every `commands/gsd/*.md` is in `docs/COMMANDS.md` heading or `docs/INVENTORY.md` Commands row |
| `tests/inventory-counts.test.cjs` | `docs/INVENTORY.md` headline counts match filesystem counts |
| `tests/inventory-manifest-sync.test.cjs` | `docs/INVENTORY-MANIFEST.json` matches filesystem |

## Gap Inventory (Exact Changes Required)

All data verified against live filesystem and milestone audit. [VERIFIED: direct filesystem inspection]

### Gap 1: REQUIREMENTS.md checkboxes (35 items)

Currently `[ ]` but verified SATISFIED by VERIFICATION.md:

| Requirement | Phase | Currently | Must Become |
|-------------|-------|-----------|-------------|
| CONFIG-04 | 6 | `[ ]` | `[x]` |
| CREATE-01 | 3 | `[ ]` | `[x]` |
| CREATE-02 | 3 | `[ ]` | `[x]` |
| CREATE-03 | 3 | `[ ]` | `[x]` |
| CREATE-04 | 3 | `[ ]` | `[x]` |
| CMD-01 | 4 | `[ ]` | `[x]` |
| CMD-02 | 4 | `[ ]` | `[x]` |
| CMD-03 | 4 | `[ ]` | `[x]` |
| CMD-04 | 4 | `[ ]` | `[x]` |
| SDK-01 | 2 | `[ ]` | `[x]` |
| SDK-02 | 2 | `[ ]` | `[x]` |
| SDK-03 | 2 | `[ ]` | `[x]` |
| AUDIT-01 | 5 | `[ ]` | `[x]` |
| AUDIT-02 | 5 | `[ ]` | `[x]` |
| AUDIT-03 | 5 | `[ ]` | `[x]` |
| AUDIT-04 | 5 | `[ ]` | `[x]` |
| AUDIT-05 | 5 | `[ ]` | `[x]` |
| GATE-01 | 6 | `[ ]` | `[x]` |
| GATE-02 | 6 | `[ ]` | `[x]` |
| GATE-03 | 6 | `[ ]` | `[x]` |
| GATE-04 | 6 | `[ ]` | `[x]` |
| GATE-05 | 6 | `[ ]` | `[x]` |
| GATE-06 | 6 | `[ ]` | `[x]` |
| GATE-07 | 6 | `[ ]` | `[x]` |
| GATE-08 | 6 | `[ ]` | `[x]` |
| DISCUSS-01 | 7 | `[ ]` | `[x]` |
| DISCUSS-02 | 7 | `[ ]` | `[x]` |
| DISCUSS-03 | 7 | `[ ]` | `[x]` |
| REFRESH-01 | 9 | `[ ]` | `[x]` |
| REFRESH-02 | 9 | `[ ]` | `[x]` |
| REFRESH-03 | 9 | `[ ]` | `[x]` |
| REFRESH-04 | 9 | `[ ]` | `[x]` |
| DETECT-01 | 8 | `[ ]` | `[x]` |
| DETECT-02 | 8 | `[ ]` | `[x]` |
| DETECT-03 | 8 | `[ ]` | `[x]` |

Already `[x]` (no change needed): SCHEMA-01, SCHEMA-02, SCHEMA-03, SCHEMA-04, SCHEMA-05, CONFIG-01, CONFIG-02, CONFIG-03, DETECT-04, DETECT-05.

**Note on CONFIG-03**: The milestone audit flagged CONFIG-03 as a "partial" requirement (integration gap). Phase 10 closed that gap (gsd-sme-creator now reads sme.blocking config). The checkbox was already updated to `[x]` at the REQUIREMENTS.md line 22 during Phase 1. Phase 10 VERIFICATION confirms CONFIG-03 as SATISFIED. No checkbox change needed.

### Gap 2: REQUIREMENTS.md traceability table (35 rows)

All 35 requirements above must have their traceability table row updated from "Pending" to "Complete". The traceability table section starts at line 113 of REQUIREMENTS.md.

Additionally, CONFIG-03 traceability entry currently reads "Phase 1, Phase 10 | Complete" — already correct, no change needed.

### Gap 3: ROADMAP.md phase checkboxes (8 items)

Currently `[ ]` but phases are complete:

```
Line 16: - [ ] **Phase 2: SDK Query Handlers**
Line 17: - [ ] **Phase 3: SME Creator Agent**
Line 18: - [ ] **Phase 4: Creation Command & Workflow**
Line 19: - [ ] **Phase 5: SME Auditor Agent**
Line 20: - [ ] **Phase 6: Plan-Phase Gate**
Line 21: - [ ] **Phase 7: Discuss-Phase Integration**
Line 22: - [ ] **Phase 8: New-Milestone Process Detection**
Line 23: - [ ] **Phase 9: Post-Execution Refresh**
```

All must become `[x]`. Note: Phase 10 checkbox is not listed in the top-level phase list (Phases section lines 15-23) — only Phases 1-9 appear there. Phase 10 and 11 appear only in the Phase Details section.

Additionally, the Phase 11 Plans list at the bottom of ROADMAP.md incorrectly shows:
```
- [x] 10-01-PLAN.md — TDD: structural tests (RED) then sme-step.md + gsd-sme-creator.md fixes (GREEN)
```
This is a copy-paste error from Phase 10. Phase 11 has no existing PLAN.md yet. The plan list will be created as part of Phase 11 planning.

### Gap 4: INVENTORY.md — Missing `gsd-sme-auditor` agent row

**Currently:** 35 agents listed (headline: "Agents (35 shipped)")
**Filesystem:** 36 agent files (`ls agents/gsd-*.md | wc -l` = 36)

`gsd-sme-auditor` exists as `agents/gsd-sme-auditor.md` but has no row in the INVENTORY.md Agents table. The two SME creator agents (`gsd-sme-creator`, `gsd-sme-creator-analyzer`) are already listed with "inventory only" primary doc status.

**Fix:** Add a row for `gsd-sme-auditor` to the Agents table:
```
| gsd-sme-auditor | Reviews PLAN.md against SME domain knowledge with adversarial stance; returns SME_APPROVED or SME_CONCERNS with severity-classified findings. | `/gsd-plan-phase` (step 12.6 SME gate) | inventory only |
```

Update headline: "Agents (35 shipped)" → "Agents (36 shipped)"

Update the Coverage note at the bottom of the Agents section to mention all 3 SME agents (currently mentions only the 2 creator agents).

### Gap 5: COMMANDS.md and INVENTORY.md — Missing `/gsd-create-sme` command

**Currently:** 86 commands listed (headline: "Commands (86 shipped)")
**Filesystem:** 87 command files (`ls commands/gsd/*.md | wc -l` = 87)

`commands/gsd/create-sme.md` exists but has no entry in either `docs/COMMANDS.md` (as a `### /gsd-create-sme` heading) or `docs/INVENTORY.md` (as a Commands table row).

**Fix option A (COMMANDS.md heading):** Add a `### /gsd-create-sme` section to COMMANDS.md under an appropriate group (SME / Codebase Intelligence, or a new SME Management group).

**Fix option B (INVENTORY.md row):** Add a row to the Commands table in INVENTORY.md.

Either option satisfies the `commands-doc-parity.test.cjs` test (it checks for EITHER). The INVENTORY.md already has a Commands table — adding the row there is simpler and consistent with how other "advanced" commands without detailed COMMANDS.md entries are handled.

**Recommended:** Add to INVENTORY.md Commands table (consistent with the pattern used for other SME-era commands), AND add a `### /gsd-create-sme` section to COMMANDS.md for discoverability. Update "Commands (86 shipped)" → "Commands (87 shipped)" in INVENTORY.md.

The `/gsd-create-sme` command row for INVENTORY.md:
```
| `/gsd-create-sme` | Create or refresh an SME document for a specified process by running the gsd-sme-creator agent. | [commands/gsd/create-sme.md](../commands/gsd/create-sme.md) |
```

### Gap 6: INVENTORY-MANIFEST.json — 3 missing entries

The manifest was generated 2026-04-27 before Phase 3–5 agents and Phase 4 command were shipped.

**Missing entries (verified by `node --test tests/inventory-manifest-sync.test.cjs`):**
```
+ agents/gsd-sme-auditor
+ commands//gsd-create-sme
+ workflows/create-sme.md
```

**Fix:** Run `node scripts/gen-inventory-manifest.cjs --write` to regenerate the manifest from the filesystem. This script reads every family directory and produces the updated JSON. Verify the output includes all three missing entries before committing.

### Gap 7: SUMMARY.md `requirements-completed` frontmatter (13 files)

The `requirements-completed:` YAML key uses a hyphen (not underscore) in the frontmatter because YAML/JS parses `requirements-completed` as-is. The SDK reads it as `fm['requirements-completed']` and exposes it as `requirements_completed` in the query result.

**Format:** `requirements-completed: [REQ-ID1, REQ-ID2, ...]` (inline YAML array) or YAML block list.

**Current state per SUMMARY.md file:**

| SUMMARY File | Current `requirements-completed` | Must Contain |
|-------------|----------------------------------|--------------|
| `01-01-SUMMARY.md` | (missing key entirely) | `[SCHEMA-01, SCHEMA-02, SCHEMA-03, SCHEMA-04]` |
| `01-02-SUMMARY.md` | (missing key entirely) | `[CONFIG-01, CONFIG-02, CONFIG-03]` |
| `01-03-SUMMARY.md` | empty (`requirements-completed:`) | `[SCHEMA-05]` |
| `03-01-SUMMARY.md` | (missing key entirely) | `[CREATE-01, CREATE-02, CREATE-03, CREATE-04]` |
| `03-02-SUMMARY.md` | (missing key entirely) | (none — Phase 3 Plan 02 was the eval config, reqs already covered by 03-01) |
| `04-01-SUMMARY.md` | (missing key entirely) | `[CMD-01, CMD-02, CMD-04]` |
| `04-02-SUMMARY.md` | `[CMD-03]` | already correct |
| `05-01-SUMMARY.md` | (missing key entirely) | `[AUDIT-01, AUDIT-02, AUDIT-03, AUDIT-04, AUDIT-05]` |
| `06-01-SUMMARY.md` | (missing key entirely) | `[GATE-01, GATE-02, GATE-03, GATE-04, GATE-05, GATE-06, GATE-07, GATE-08, CONFIG-04]` |
| `07-01-SUMMARY.md` | (missing key entirely) | `[DISCUSS-01, DISCUSS-02, DISCUSS-03]` |
| `08-01-SUMMARY.md` | `[DETECT-01, DETECT-02, DETECT-03, DETECT-04, DETECT-05]` | already correct |
| `09-01-SUMMARY.md` | `[REFRESH-01, REFRESH-02, REFRESH-03, REFRESH-04]` | already correct |
| `10-01-SUMMARY.md` | (missing key entirely) | `[CONFIG-03, DETECT-04, DETECT-05]` |

**Note on 03-02-SUMMARY.md:** Phase 3 Plan 02 created the Promptfoo eval config (`evals/sme-creator.promptfooconfig.yaml`). Requirements CREATE-01 through CREATE-04 are credited to Phase 3 as a whole, but the VERIFICATION attributes them to both `03-01-PLAN.md` and `03-02-PLAN.md`. The safest approach: put CREATE-01 through CREATE-04 in `03-01-SUMMARY.md` (the agent definitions plan). Leave `03-02-SUMMARY.md` with either an empty list or omit the key — Phase 3's requirements are already fully covered by 03-01.

**Note on 10-01-SUMMARY.md and CONFIG-03:** Phase 10 closed the integration gap for CONFIG-03. Phase 1 also claims CONFIG-03. To avoid double-counting, add `[CONFIG-03]` to `10-01-SUMMARY.md` since Phase 10 is where the actual config consumption was implemented. The Phase 1 plans can keep CONFIG-03 in `01-02-SUMMARY.md` since they registered the key. This is a documentation judgment call — both plans contributed.

**Note on DETECT-04 and DETECT-05 in 10-01-SUMMARY.md:** Phase 10 VERIFICATION confirms CONFIG-03, DETECT-04, DETECT-05 as SATISFIED. Phase 8 SUMMARY already lists DETECT-04 and DETECT-05. Adding them to `10-01-SUMMARY.md` would create duplicates — the system doesn't validate uniqueness but it could confuse audit tools. Best approach: `10-01-SUMMARY.md` gets `[CONFIG-03]` only (Phase 10's unique contribution). DETECT-04 and DETECT-05 remain credited to Phase 8.

## Architecture Patterns

### Document Edit Pattern

All changes are direct text edits using Read + Write tools. The Edit tool (line-level replace) is appropriate for targeted changes like flipping `[ ]` to `[x]`. The Write tool is appropriate when rewriting a SUMMARY.md frontmatter block.

**For REQUIREMENTS.md**: 35 checkbox flips and 35 traceability table changes. The checkboxes are `- [ ]` → `- [x]`. The traceability table cells are `| Pending |` → `| Complete |`.

**For ROADMAP.md**: 8 checkbox flips in the top-level phase list.

**For INVENTORY.md**: Add 1 agent row, update headline count, update coverage note, add 1 command row, update command headline count.

**For COMMANDS.md**: Add 1 command section.

**For INVENTORY-MANIFEST.json**: Run `node scripts/gen-inventory-manifest.cjs --write`.

**For SUMMARY.md files**: Add or update `requirements-completed:` field in the YAML frontmatter of 11 files.

### Test-Driven Validation Pattern

Run CJS parity tests before making changes to establish baseline, then after each group of changes:

```bash
# Baseline — establish which tests currently fail
node --test tests/agents-doc-parity.test.cjs
node --test tests/commands-doc-parity.test.cjs
node --test tests/inventory-counts.test.cjs
node --test tests/inventory-manifest-sync.test.cjs

# After INVENTORY.md + COMMANDS.md edits
node --test tests/agents-doc-parity.test.cjs
node --test tests/commands-doc-parity.test.cjs
node --test tests/inventory-counts.test.cjs

# After INVENTORY-MANIFEST.json regeneration
node --test tests/inventory-manifest-sync.test.cjs
```

### YAML Frontmatter Format for requirements-completed

The `requirements-completed` key in SUMMARY.md frontmatter accepts either inline array or block list syntax:

```yaml
# Inline array (used in 02-01-SUMMARY.md, 09-01-SUMMARY.md):
requirements-completed: [SDK-01, SDK-02, SDK-03]

# Block list (used in 08-01-SUMMARY.md):
requirements-completed:
  - DETECT-01
  - DETECT-02
```

Both are valid YAML and both parse identically via `coerceFmArray`. Use inline array for brevity unless the list is long.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| INVENTORY-MANIFEST.json updates | Manual JSON editing | `node scripts/gen-inventory-manifest.cjs --write` | Script reads filesystem deterministically, avoids typos and missed entries |

## Common Pitfalls

### Pitfall 1: Off-by-one in INVENTORY.md headline counts
**What goes wrong:** Updating the agent row without updating the "(35 shipped)" → "(36 shipped)" headline, causing `inventory-counts.test.cjs` to fail.
**Why it happens:** The test computes the count from the filesystem and compares it to the headline number in INVENTORY.md.
**How to avoid:** Always update the headline when adding a row.
**Warning signs:** `inventory-counts.test.cjs` "Agents (N shipped) matches agents/" failure.

### Pitfall 2: INVENTORY-MANIFEST.json stale after INVENTORY.md edits
**What goes wrong:** Updating INVENTORY.md agent/command rows but forgetting to regenerate INVENTORY-MANIFEST.json, causing `inventory-manifest-sync.test.cjs` to fail.
**Why it happens:** INVENTORY-MANIFEST.json is a cached snapshot of the filesystem — it must be regenerated whenever new files ship.
**How to avoid:** Run `node scripts/gen-inventory-manifest.cjs --write` after any new agents/commands/workflows are present on disk.
**Warning signs:** `inventory-manifest-sync.test.cjs` "New surfaces not in manifest" failure.

### Pitfall 3: SUMMARY.md frontmatter YAML parse failure
**What goes wrong:** Editing frontmatter with bad indentation or invalid YAML causes `gsd-sdk query summary-extract` to silently return empty `requirements_completed`.
**Why it happens:** YAML is whitespace-sensitive; mixed tabs/spaces or bad nesting break parsing.
**How to avoid:** Use the same inline array format as existing examples (`[REQ-01, REQ-02]`). Verify with `gsd-tools frontmatter get` after editing.
**Warning signs:** `gsd-sdk query summary-extract --fields requirements_completed` returns `[]`.

### Pitfall 4: Double-counting requirements across plans
**What goes wrong:** Adding a requirement ID to multiple SUMMARY.md files causes audit tools to count the same requirement twice.
**Why it happens:** Some requirements span multiple plans (Phase 3 CREATE-* covered by both 03-01 and 03-02).
**How to avoid:** Credit requirements to the plan where the primary implementation shipped. Eval/test plans that don't implement new requirements should have an empty or omitted `requirements-completed` list.

### Pitfall 5: ROADMAP.md Phase 11 plan list has wrong plan ID
**What goes wrong:** The Phase 11 Plans section in ROADMAP.md currently shows `10-01-PLAN.md` (copied from Phase 10) — this is incorrect.
**Why it happens:** Copy-paste error during ROADMAP.md creation.
**How to avoid:** The plan list for Phase 11 should reference `11-01-PLAN.md` once that plan exists.
**Warning signs:** Confusion about which plan belongs to which phase.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node.js built-in `node:test` |
| Config file | none — tests run directly with `node --test` |
| Quick run command | `node --test tests/agents-doc-parity.test.cjs tests/commands-doc-parity.test.cjs tests/inventory-counts.test.cjs tests/inventory-manifest-sync.test.cjs` |
| Full suite command | `node --test tests/*.cjs` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SC-1 (43 checkboxes correct) | REQUIREMENTS.md `[x]` state matches VERIFICATION | manual inspection | `grep -c "\- \[ \]" .planning/REQUIREMENTS.md` (should be 0) | N/A — grep command |
| SC-2 (traceability Complete) | Traceability table shows Complete for all | manual inspection | `grep "Pending" .planning/REQUIREMENTS.md` (should be 0 in traceability) | N/A |
| SC-3 (ROADMAP [x] phases 2-9) | ROADMAP phase list checkboxes | manual inspection | `grep "\- \[ \]" .planning/ROADMAP.md` (should be 0) | N/A |
| SC-4 (INVENTORY.md agents) | gsd-sme-creator, gsd-sme-creator-analyzer, gsd-sme-auditor in INVENTORY | automated | `node --test tests/agents-doc-parity.test.cjs` | ✅ |
| SC-5 (COMMANDS.md /gsd-create-sme) | /gsd-create-sme documented | automated | `node --test tests/commands-doc-parity.test.cjs` | ✅ |
| SC-6 (CJS parity tests pass) | 0 failures in doc parity tests | automated | `node --test tests/agents-doc-parity.test.cjs tests/commands-doc-parity.test.cjs tests/inventory-counts.test.cjs tests/inventory-manifest-sync.test.cjs` | ✅ |
| SC-7 (SUMMARY requirements_completed) | requirements-completed populated | manual inspection | `grep -l "requirements-completed:" .planning/phases/*/*-SUMMARY.md` | N/A |

### Sampling Rate
- **Per task commit:** `node --test tests/agents-doc-parity.test.cjs tests/commands-doc-parity.test.cjs tests/inventory-counts.test.cjs tests/inventory-manifest-sync.test.cjs`
- **Per wave merge:** `node --test tests/*.cjs` (full CJS suite)
- **Phase gate:** All 4 targeted parity tests green + all 43 REQUIREMENTS.md checkboxes `[x]` before `/gsd-verify-work`

### Wave 0 Gaps
None — existing test infrastructure covers all phase requirements. No new test files needed for this phase.

## Environment Availability

Step 2.6: SKIPPED — phase has no external dependencies beyond Node.js (already confirmed available, Node.js 22 runtime is the project standard).

```bash
node --version  # v22.x confirmed by project runtime requirement
```

## Security Domain

Step skipped — this phase makes no changes to authentication, session management, access control, input validation, cryptography, or any security-sensitive code path. All changes are documentation/metadata updates to `.planning/` files.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual INVENTORY.md updates | `node scripts/gen-inventory-manifest.cjs --write` | Phase 4 era | Script regenerates JSON deterministically — use it instead of manual JSON editing |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Phase 3 Plan 02 (03-02-SUMMARY.md) does not need requirements-completed since CREATE-01 through CREATE-04 are the agent definitions from 03-01 | Gap 7 | Low — if wrong, add same list to 03-02, which is additive and harmless |
| A2 | DETECT-04 and DETECT-05 should NOT be added to 10-01-SUMMARY.md since they are already in 08-01-SUMMARY.md | Gap 7 | Low — if wrong, adding them to 10-01 is harmless (no deduplication validation) |
| A3 | The Phase 11 Plans section in ROADMAP.md should reference 11-01-PLAN.md, not 10-01-PLAN.md | ROADMAP pitfall | Low — this will be corrected in the plan document anyway |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed. (3 assumptions present, all low-risk.)

## Open Questions (RESOLVED)

1. **Does 03-02-SUMMARY.md need any requirements-completed entries?**
   - What we know: 03-02-PLAN.md created the eval config, not the agent definitions. CREATE-01 through CREATE-04 are agent behavioral requirements satisfied by the agent definitions in 03-01.
   - What's unclear: Whether the eval config counts as "satisfying" CREATE-01 (which mentions analyzing code/git/docs — the eval validates this capability).
   - RESOLVED: Leave 03-02-SUMMARY.md with no requirements-completed (or an empty list). The VERIFICATION.md credits both plans for CREATE-01 through CREATE-04, but the primary implementation is in 03-01.

## Sources

### Primary (HIGH confidence)
- Direct filesystem inspection of `.planning/phases/*/0*-VERIFICATION.md` — all 10 verification files read and requirements coverage tables extracted
- Direct inspection of `.planning/REQUIREMENTS.md` — current checkbox states confirmed (lines 12-83)
- Direct inspection of `.planning/ROADMAP.md` — current phase checkbox states confirmed (lines 15-23)
- Direct inspection of `docs/INVENTORY.md` — current agent/command counts and roster confirmed
- Direct inspection of `docs/INVENTORY-MANIFEST.json` — current manifest contents confirmed
- `node --test tests/agents-doc-parity.test.cjs` — live test run confirming `gsd-sme-auditor` failure
- `node --test tests/commands-doc-parity.test.cjs` — live test run confirming `/gsd-create-sme` failure
- `node --test tests/inventory-manifest-sync.test.cjs` — live test run confirming 3 missing manifest entries
- `.planning/v1.0-MILESTONE-AUDIT.md` — milestone audit document confirming all gap categories
- Direct inspection of all 15 SUMMARY.md files for `requirements-completed` field state

### Secondary (MEDIUM confidence)
- None needed — all findings verified directly.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Gap inventory: HIGH — all gaps verified by live test runs and direct file inspection
- Fix approach: HIGH — standard markdown edits, script-driven JSON regeneration
- SUMMARY.md assignment: MEDIUM — judgment calls on which plan "owns" multi-plan requirements

**Research date:** 2026-05-04
**Valid until:** Phase 11 complete (static metadata sync — does not drift)
