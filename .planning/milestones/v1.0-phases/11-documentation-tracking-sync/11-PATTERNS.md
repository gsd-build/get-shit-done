# Phase 11: Documentation & Tracking Sync - Pattern Map

**Mapped:** 2026-05-04
**Files analyzed:** 18 (files to be modified)
**Analogs found:** 18 / 18

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `.planning/REQUIREMENTS.md` | config | transform | `.planning/REQUIREMENTS.md` itself (prior completed entries) | exact |
| `.planning/ROADMAP.md` | config | transform | `.planning/ROADMAP.md` Phase 1 and Phase 10 entries | exact |
| `docs/INVENTORY.md` (agents section) | config | transform | `docs/INVENTORY.md` existing SME creator rows (lines 50-55) | exact |
| `docs/INVENTORY.md` (commands section) | config | transform | `docs/INVENTORY.md` existing command rows (lines 120-178) | exact |
| `docs/COMMANDS.md` | config | transform | `docs/COMMANDS.md` existing command sections (e.g. `/gsd-map-codebase` block) | exact |
| `docs/INVENTORY-MANIFEST.json` | config | batch | `node scripts/gen-inventory-manifest.cjs --write` (script-driven) | exact |
| `.planning/phases/01-schema-config/01-01-SUMMARY.md` | config | transform | `.planning/phases/01-schema-config/01-03-SUMMARY.md` (has `requirements-completed`) | exact |
| `.planning/phases/01-schema-config/01-02-SUMMARY.md` | config | transform | `.planning/phases/01-schema-config/01-03-SUMMARY.md` | exact |
| `.planning/phases/01-schema-config/01-03-SUMMARY.md` | config | transform | itself — already has correct format, needs value change only | exact |
| `.planning/phases/03-sme-creator-agent/03-01-SUMMARY.md` | config | transform | `.planning/phases/09-post-execution-refresh/09-01-SUMMARY.md` (inline array) | exact |
| `.planning/phases/03-sme-creator-agent/03-02-SUMMARY.md` | config | transform | `.planning/phases/09-post-execution-refresh/09-01-SUMMARY.md` | exact |
| `.planning/phases/04-creation-command-workflow/04-01-SUMMARY.md` | config | transform | `.planning/phases/09-post-execution-refresh/09-01-SUMMARY.md` | exact |
| `.planning/phases/05-sme-auditor-agent/05-01-SUMMARY.md` | config | transform | `.planning/phases/08-new-milestone-process-detection/08-01-SUMMARY.md` (block list) | exact |
| `.planning/phases/06-plan-phase-gate/06-01-SUMMARY.md` | config | transform | `.planning/phases/08-new-milestone-process-detection/08-01-SUMMARY.md` | exact |
| `.planning/phases/07-discuss-phase-integration/07-01-SUMMARY.md` | config | transform | `.planning/phases/09-post-execution-refresh/09-01-SUMMARY.md` | exact |
| `.planning/phases/10-fix-new-milestone-sme-creator-integration/10-01-SUMMARY.md` | config | transform | `.planning/phases/09-post-execution-refresh/09-01-SUMMARY.md` | exact |

## Pattern Assignments

### `.planning/REQUIREMENTS.md` (config, transform)

**Analog:** `.planning/REQUIREMENTS.md` lines 12-16 (existing `[x]` checkboxes) and lines 116-123 (Complete traceability rows)

**Checkbox pattern — currently checked entries** (lines 12-16):
```markdown
- [x] **SCHEMA-01**: SME documents stored in `.planning/smes/{PROCESS_NAME}-SME.md`...
- [x] **SCHEMA-02**: Each finding in an SME document carries a severity label...
```

**Checkbox pattern — target state for 35 unchecked items:**
```markdown
- [x] **CONFIG-04**: Enabling SMEs mid-project with no existing SME documents emits a warning...
- [x] **CREATE-01**: `gsd-sme-creator` agent analyzes code paths...
```
Change: `- [ ]` → `- [x]` for all 35 requirements listed in RESEARCH.md Gap 1.

**Traceability table — currently Complete rows** (lines 116-123):
```markdown
| SCHEMA-01 | Phase 1 | Complete |
| SCHEMA-02 | Phase 1 | Complete |
| CONFIG-03 | Phase 1, Phase 10 | Complete |
```

**Traceability table — target state for 35 Pending rows:**
```markdown
| CONFIG-04 | Phase 6 | Complete |
| CREATE-01 | Phase 3 | Complete |
```
Change: `| Pending |` → `| Complete |` for all 35 rows listed in RESEARCH.md Gap 2.

---

### `.planning/ROADMAP.md` (config, transform)

**Analog:** `.planning/ROADMAP.md` lines 15 and 164-166 (existing `[x]` checkboxes)

**Phase list checkbox pattern — currently checked** (line 15):
```markdown
- [x] **Phase 1: Schema & Config** - Define the SME document format...
```

**Target state for Phases 2-9** (lines 16-23):
```markdown
- [x] **Phase 2: SDK Query Handlers** - Implement the three query handlers...
- [x] **Phase 3: SME Creator Agent** - Build the agent that analyzes...
- [x] **Phase 4: Creation Command & Workflow** - Wire the creator into a user-facing...
- [x] **Phase 5: SME Auditor Agent** - Build the adversarial read-only agent...
- [x] **Phase 6: Plan-Phase Gate** - Integrate the auditor as step 12.5...
- [x] **Phase 7: Discuss-Phase Integration** - Inject SME domain probing questions...
- [x] **Phase 8: New-Milestone Process Detection** - Auto-detect processes at milestone start...
- [x] **Phase 9: Post-Execution Refresh** - Refresh stale SME documents after phase execution...
```
Change: `- [ ]` → `- [x]` for each of lines 16-23.

**Phase 11 Plans section — copy-paste error fix** (line 183):
```markdown
# Current (wrong):
- [x] 10-01-PLAN.md — TDD: structural tests (RED) then sme-step.md + gsd-sme-creator.md fixes (GREEN)

# Correct (after fix — Phase 11 plan reference will be populated by planner):
- [ ] 11-01-PLAN.md — [plan description TBD by planner]
```
Change: Replace the erroneous `10-01-PLAN.md` reference with `11-01-PLAN.md`.

---

### `docs/INVENTORY.md` — agents section (config, transform)

**Analog:** `docs/INVENTORY.md` lines 50-51 (existing SME creator inventory-only rows)

**Existing SME agent row pattern** (lines 50-51):
```markdown
| gsd-sme-creator | Analyzes a codebase process and produces a structured SME document by spawning parallel analyzer sub-agents and synthesizing their findings. | `/gsd-create-sme` (Phase 4) | inventory only |
| gsd-sme-creator-analyzer | Analyzes a file partition for SME risks, test gaps, outdated logic, and edge cases. Writes findings to .tmp file. | `gsd-sme-creator` (sub-agent) | inventory only |
```

**New row to add (after line 51):**
```markdown
| gsd-sme-auditor | Reviews PLAN.md against SME domain knowledge with adversarial stance; returns SME_APPROVED or SME_CONCERNS with severity-classified findings. | `/gsd-plan-phase` (step 12.6 SME gate) | inventory only |
```

**Headline update** (line 13):
```markdown
# Before:
## Agents (35 shipped)

# After:
## Agents (36 shipped)
```

**Coverage note update** (line 55):
```markdown
# Before:
...The 2 SME creator agents (`gsd-sme-creator`, `gsd-sme-creator-analyzer`) are inventory-only until Phase 4 integrates them into the create-sme workflow.

# After:
...The 3 SME agents (`gsd-sme-creator`, `gsd-sme-creator-analyzer`, `gsd-sme-auditor`) are inventory-only.
```

---

### `docs/INVENTORY.md` — commands section (config, transform)

**Analog:** `docs/INVENTORY.md` lines 137-145 (Codebase Intelligence command rows)

**Existing command row pattern** (lines 139-145):
```markdown
| `/gsd-map-codebase` | Analyze codebase with parallel mapper agents; produces `.planning/codebase/` documents. | [commands/gsd/map-codebase.md](../commands/gsd/map-codebase.md) |
| `/gsd-scan` | Rapid codebase assessment — lightweight alternative to `/gsd-map-codebase`. | [commands/gsd/scan.md](../commands/gsd/scan.md) |
```

**New command row to add (Codebase Intelligence section or after existing SME entries):**
```markdown
| `/gsd-create-sme` | Create or refresh an SME document for a specified process by running the gsd-sme-creator agent. | [commands/gsd/create-sme.md](../commands/gsd/create-sme.md) |
```

**Headline update** (line 59):
```markdown
# Before:
## Commands (86 shipped)

# After:
## Commands (87 shipped)
```

---

### `docs/COMMANDS.md` (config, transform)

**Analog:** `docs/COMMANDS.md` `/gsd-scan` section (lines 1179-1195) — a concise command section with description, flag table, and usage example

**Existing short command section pattern** (lines 1179-1195):
```markdown
### `/gsd-scan`

Rapid single-focus codebase assessment — lightweight alternative to `/gsd-map-codebase` that spawns one mapper agent instead of four parallel ones.

| Flag | Description |
|------|-------------|
| `--focus tech\|arch\|quality\|concerns\|tech+arch` | Focus area (default: `tech+arch`) |

**Produces:** Targeted document(s) in `.planning/codebase/`

```bash
/gsd-scan                           # Quick tech + arch overview
/gsd-scan --focus quality           # Quality and code health only
```

---
```

**New section to add (in Brownfield Commands or a new SME Management section):**
```markdown
### `/gsd-create-sme`

Create or refresh an SME (Subject Matter Expert) document for a specified process by running the `gsd-sme-creator` agent.

| Argument | Required | Description |
|----------|----------|-------------|
| `process-name` | No | Process to create an SME for (e.g., `contribution`) |

**Prerequisites:** `workflow.use_sme_agents: true` in `config.json`
**Produces:** `.planning/smes/{process-name}-SME.md`

```bash
/gsd-create-sme contribution        # Create SME for contribution process
/gsd-create-sme                     # Interactive menu of detected processes
```

---
```

---

### `docs/INVENTORY-MANIFEST.json` (config, batch)

**Analog:** `node scripts/gen-inventory-manifest.cjs --write` — regenerates the manifest from filesystem deterministically.

**Do not hand-edit.** Run the script:
```bash
node scripts/gen-inventory-manifest.cjs --write
```

**Expected additions after script run:**
```json
"agents/gsd-sme-auditor",
"commands//gsd-create-sme",
"workflows/create-sme.md"
```

Verify with:
```bash
node --test tests/inventory-manifest-sync.test.cjs
```

---

### SUMMARY.md `requirements-completed` frontmatter — inline array pattern

**Analog:** `.planning/phases/09-post-execution-refresh/09-01-SUMMARY.md` line 43 (inline array)
```yaml
requirements-completed: [REFRESH-01, REFRESH-02, REFRESH-03, REFRESH-04]
```

**Analog:** `.planning/phases/01-schema-config/01-03-SUMMARY.md` lines 39-40 (block list variant):
```yaml
requirements-completed:
  - SCHEMA-05
```

**Rule:** Use inline array for brevity. Block list is acceptable for long lists or existing block-list style files.

**The key name uses a hyphen** (`requirements-completed:`), not underscore. The SDK reads it as `fm['requirements-completed']`.

---

### `.planning/phases/01-schema-config/01-01-SUMMARY.md` (config, transform)

**Analog:** `.planning/phases/01-schema-config/01-03-SUMMARY.md` lines 39-40

**Current state:** No `requirements-completed` key in frontmatter.

**Target:** Add before closing `---` of frontmatter block:
```yaml
requirements-completed: [SCHEMA-01, SCHEMA-02, SCHEMA-03, SCHEMA-04]
```

**Insertion point:** After the `metrics:` / `duration:` / `completed:` block, before the closing `---`.

---

### `.planning/phases/01-schema-config/01-02-SUMMARY.md` (config, transform)

**Analog:** `.planning/phases/01-schema-config/01-03-SUMMARY.md`

**Target:** Add before closing `---`:
```yaml
requirements-completed: [CONFIG-01, CONFIG-02, CONFIG-03]
```

---

### `.planning/phases/01-schema-config/01-03-SUMMARY.md` (config, transform)

**Current state** (lines 39-40):
```yaml
requirements-completed:
```
The key exists but has no value (empty).

**Target:** Change to inline array:
```yaml
requirements-completed: [SCHEMA-05]
```

---

### `.planning/phases/03-sme-creator-agent/03-01-SUMMARY.md` (config, transform)

**Analog:** `.planning/phases/09-post-execution-refresh/09-01-SUMMARY.md` line 43

**Target:** Add before closing `---`:
```yaml
requirements-completed: [CREATE-01, CREATE-02, CREATE-03, CREATE-04]
```

---

### `.planning/phases/03-sme-creator-agent/03-02-SUMMARY.md` (config, transform)

**Decision per RESEARCH.md:** Leave with no requirements-completed entries (CREATE-01 through CREATE-04 credited to 03-01; the eval config plan does not own distinct requirements).

**Target:** Either omit the key entirely or add an empty list:
```yaml
requirements-completed: []
```

---

### `.planning/phases/04-creation-command-workflow/04-01-SUMMARY.md` (config, transform)

**Analog:** `.planning/phases/09-post-execution-refresh/09-01-SUMMARY.md` line 43

**Target:** Add before closing `---`:
```yaml
requirements-completed: [CMD-01, CMD-02, CMD-04]
```

Note: CMD-03 is credited to `04-02-SUMMARY.md` (already correct per RESEARCH.md Gap 7).

---

### `.planning/phases/05-sme-auditor-agent/05-01-SUMMARY.md` (config, transform)

**Analog:** `.planning/phases/08-new-milestone-process-detection/08-01-SUMMARY.md` lines 42-47

**Target:** Add before closing `---`:
```yaml
requirements-completed: [AUDIT-01, AUDIT-02, AUDIT-03, AUDIT-04, AUDIT-05]
```

---

### `.planning/phases/06-plan-phase-gate/06-01-SUMMARY.md` (config, transform)

**Analog:** `.planning/phases/08-new-milestone-process-detection/08-01-SUMMARY.md` lines 42-47

**Target:** Add before closing `---`:
```yaml
requirements-completed: [GATE-01, GATE-02, GATE-03, GATE-04, GATE-05, GATE-06, GATE-07, GATE-08, CONFIG-04]
```

---

### `.planning/phases/07-discuss-phase-integration/07-01-SUMMARY.md` (config, transform)

**Analog:** `.planning/phases/09-post-execution-refresh/09-01-SUMMARY.md` line 43

**Target:** Add before closing `---`:
```yaml
requirements-completed: [DISCUSS-01, DISCUSS-02, DISCUSS-03]
```

---

### `.planning/phases/10-fix-new-milestone-sme-creator-integration/10-01-SUMMARY.md` (config, transform)

**Analog:** `.planning/phases/09-post-execution-refresh/09-01-SUMMARY.md` line 43

**Target:** Add before closing `---`:
```yaml
requirements-completed: [CONFIG-03]
```

Note: DETECT-04 and DETECT-05 are already credited to `08-01-SUMMARY.md`. Do not add them here to avoid double-counting.

---

## Shared Patterns

### Checkbox flip pattern
**Source:** `.planning/REQUIREMENTS.md` lines 12-16 (existing `[x]` entries)
**Apply to:** All `[ ]` → `[x]` edits in REQUIREMENTS.md and ROADMAP.md
```markdown
- [ ] **REQ-ID**: Description...
# becomes:
- [x] **REQ-ID**: Description...
```

### Traceability table status pattern
**Source:** `.planning/REQUIREMENTS.md` lines 116-123 (existing Complete rows)
**Apply to:** All 35 Pending rows in traceability table
```markdown
| REQ-ID | Phase N | Pending |
# becomes:
| REQ-ID | Phase N | Complete |
```

### YAML frontmatter insertion point pattern
**Source:** `.planning/phases/08-new-milestone-process-detection/08-01-SUMMARY.md` lines 42-47, `.planning/phases/01-schema-config/01-03-SUMMARY.md` lines 39-40
**Apply to:** All SUMMARY.md files receiving `requirements-completed` key
```yaml
# Add the key before the closing --- of the frontmatter block.
# Preferred placement: after key-decisions/patterns-established/metrics, before ---
requirements-completed: [REQ-ID1, REQ-ID2, ...]
```

### Inventory table row pattern
**Source:** `docs/INVENTORY.md` lines 50-53 (agent rows) and lines 139-145 (command rows)
**Apply to:** New agent row and new command row in INVENTORY.md
```markdown
# Agent row format:
| agent-name | One-line role description. | Spawned-by-context | primary|advanced stub|inventory only |

# Command row format:
| `/gsd-command-name` | One-line role description. | [commands/gsd/file.md](../commands/gsd/file.md) |
```

### Test validation pattern
**Source:** RESEARCH.md Validation Architecture section
**Apply to:** After each group of doc changes
```bash
# After INVENTORY.md + COMMANDS.md edits:
node --test tests/agents-doc-parity.test.cjs
node --test tests/commands-doc-parity.test.cjs
node --test tests/inventory-counts.test.cjs

# After INVENTORY-MANIFEST.json regeneration:
node --test tests/inventory-manifest-sync.test.cjs

# Full pass:
node --test tests/agents-doc-parity.test.cjs tests/commands-doc-parity.test.cjs tests/inventory-counts.test.cjs tests/inventory-manifest-sync.test.cjs
```

---

## No Analog Found

All files to be modified have clear analogs in the existing codebase. No new-pattern files exist in this phase.

---

## Metadata

**Analog search scope:** `.planning/`, `docs/`, `.planning/phases/*/`
**Files scanned:** 20+ (REQUIREMENTS.md, ROADMAP.md, INVENTORY.md, COMMANDS.md, all 15 SUMMARY.md files)
**Pattern extraction date:** 2026-05-04
