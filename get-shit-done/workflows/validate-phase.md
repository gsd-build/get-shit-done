<purpose>
Retroactively audit Nyquist validation coverage for a completed phase. Detects existing test coverage, maps gaps to phase requirements, writes missing tests via gsd-nyquist-auditor, and produces or updates {phase}-VALIDATION.md from existing artifacts.

Works mid-milestone and post-milestone. Handles three input states: VALIDATION.md exists (audit + update), no VALIDATION.md but SUMMARY.md exists (reconstruct), phase not yet executed (exit with guidance).
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context before starting.

@~/.claude/get-shit-done/references/ui-brand.md
</required_reading>

<process>

## 0. Initialize Phase Context

Load phase operation context:

```bash
INIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init phase-op "${PHASE_ARG}")
```

Parse JSON for: `phase_dir`, `phase_number`, `phase_name`, `phase_slug`, `padded_phase`.

Resolve auditor model:

```bash
AUDITOR_MODEL=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" resolve-model gsd-nyquist-auditor --raw)
```

Check nyquist config:

```bash
NYQUIST_CFG=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" config get workflow.nyquist_validation --raw)
```

**If `NYQUIST_CFG` is explicitly `false`:** Exit with:
```
Nyquist validation is disabled. Enable via /gsd:settings.
```

Display banner:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD > VALIDATE PHASE {N}: {name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## 1. Detect Input State

```bash
VALIDATION_FILE=$(ls "${PHASE_DIR}"/*-VALIDATION.md 2>/dev/null | head -1)
SUMMARY_FILES=$(ls "${PHASE_DIR}"/*-SUMMARY.md 2>/dev/null)
PLAN_FILES=$(ls "${PHASE_DIR}"/*-PLAN.md 2>/dev/null)
```

Classify state:

- **State A:** `VALIDATION_FILE` non-empty — audit existing VALIDATION.md and fill gaps
- **State B:** `VALIDATION_FILE` empty, `SUMMARY_FILES` non-empty — reconstruct from PLAN + SUMMARY artifacts
- **State C:** `SUMMARY_FILES` empty — phase not executed. Exit with:

```
Phase {N} has not been executed yet. Run /gsd:execute-phase {N} first.
```

## 2. Discovery

### 2a. Read Phase Artifacts

Read all PLAN and SUMMARY files in the phase directory. Extract:
- Task lists (task IDs, objectives, file modifications)
- Requirement IDs referenced in plan frontmatter
- Key-files changed (from SUMMARY frontmatter or body)
- Verify blocks (automated commands from plan tasks)

### 2b. Build Requirement-to-Task Map

For each task across all plans, build a structured map:

```
{ task_id, plan_id, wave, requirement_ids, has_automated_command }
```

This map drives gap analysis — every requirement must have at least one automated check.

### 2c. Detect Test Infrastructure

**If State A** (existing VALIDATION.md): Parse from the existing VALIDATION.md Test Infrastructure table — extract framework, config file, quick run command, full suite command.

**If State B** (reconstructing): Filesystem scan:

```bash
find . -name "pytest.ini" -o -name "jest.config.*" -o -name "vitest.config.*" -o -name "pyproject.toml" 2>/dev/null | head -10
find . \( -name "*.test.*" -o -name "*.spec.*" -o -name "test_*" \) -not -path "*/node_modules/*" 2>/dev/null | head -40
```

Identify: framework, config path, runner commands, naming conventions.

### 2d. Cross-Reference Tests Against Requirements

For each requirement in the map, search for existing test files that target the behavior:
- Match by filename, import paths, test descriptions
- Check if tests actually run (not just exist)
- Record: requirement_id → test_file → status (exists/runs/passes)

## 3. Gap Analysis

For each phase requirement, classify coverage:

| Classification | Criteria |
|----------------|----------|
| **COVERED** | Test file exists, clearly targets the behavior, command runs green |
| **PARTIAL** | Test exists but failing or incomplete coverage |
| **MISSING** | No test found for this requirement |

Build gap list with structure:
```
{ task_id, requirement, gap_type, suggested_test_path, suggested_command }
```

**If no gaps found:** Skip to Step 6 — update `nyquist_compliant: true` in VALIDATION.md frontmatter.

## 4. Present Gap Plan (USER GATE)

Use AskUserQuestion:

```
AskUserQuestion(
  header: "Validation Gaps",
  question: |
    ## Nyquist Validation Gaps — Phase {N}

    | # | Task | Requirement | Gap Type | Suggested Test |
    |---|------|-------------|----------|----------------|
    {gap table rows}

    **{total} gaps found.** How would you like to proceed?
  options:
    - "Fix all gaps (spawn auditor)"
    - "Skip — mark as manual-only"
    - "Cancel"
)
```

- **Fix all gaps:** Continue to Step 5
- **Skip — mark as manual-only:** Add all gaps to Manual-Only Verifications section, proceed to Step 6
- **Cancel:** Exit workflow

## 5. Spawn gsd-nyquist-auditor

Spawn via Task tool:

```markdown
<objective>
Fill Nyquist validation gaps for Phase {N}: {name}.
For each gap, generate the minimal test that verifies the requirement behavior, run it, debug if needed (max 3 iterations), and report results.
</objective>

<files_to_read>
- {PLAN files}
- {SUMMARY files}
- {implementation files from key-files}
- {existing VALIDATION.md if State A}
</files_to_read>

<gaps>
{structured gap list from Step 3}
</gaps>

<test_infrastructure>
- Framework: {framework}
- Config: {config path}
- Quick command: {quick command}
- Full suite: {full suite command}
- Conventions: {naming patterns from discovery}
</test_infrastructure>

<constraints>
- NEVER modify implementation files (src/, lib/, app/, components/, etc.)
- Only create/modify: test files, fixtures, VALIDATION.md
- Max 3 debug iterations per gap
- If test fails due to implementation bug: ESCALATE (do not fix)
</constraints>
```

```
Task(
  prompt="First, read ~/.claude/agents/gsd-nyquist-auditor.md for your role and instructions.\n\n" + auditor_prompt,
  subagent_type="gsd-nyquist-auditor",
  model="{AUDITOR_MODEL}",
  description="Fill Nyquist validation gaps for Phase {N}"
)
```

### Handle Auditor Return

- **`## GAPS FILLED`:** All gaps resolved with green tests. Record all test files and verification map updates. Proceed to Step 6.
- **`## PARTIAL`:** Some resolved, some escalated. Record resolved gaps as green, move escalated to Manual-Only Verifications. Proceed to Step 6.
- **`## ESCALATE`:** All gaps failed. Move all to Manual-Only Verifications with reasons. Proceed to Step 6.

## 6. Generate/Update VALIDATION.md

### State B — Create New

1. Read template from `~/.claude/get-shit-done/templates/VALIDATION.md`
2. Fill all sections from discovery + auditor results:
   - Frontmatter: phase, slug, status, nyquist_compliant, wave_0_complete, created date
   - Test Infrastructure table from Step 2c
   - Per-Task Verification Map from requirement-to-task map + auditor results
   - Wave 0 Requirements (empty if infrastructure exists)
   - Manual-Only Verifications from escalated gaps
   - Validation Sign-Off checklist
3. Write to `${PHASE_DIR}/${PADDED_PHASE}-VALIDATION.md`

### State A — Update Existing

1. Edit existing VALIDATION.md:
   - Update Per-Task Verification Map statuses (pending → green for resolved gaps)
   - Add escalated items to Manual-Only Verifications
   - Update frontmatter: `nyquist_compliant` (true if all gaps resolved), `wave_0_complete`
2. Append audit trail section:

```markdown
## Validation Audit {date}

| Metric | Count |
|--------|-------|
| Gaps found | {N} |
| Gaps resolved | {M} |
| Gaps escalated | {K} |
| Full suite result | {pass/fail} |
```

## 7. Commit

Stage and commit test files (if any were created by the auditor):

```bash
git add {test_files}
git commit -m "test(phase-${PHASE}): add Nyquist validation tests"
```

Commit VALIDATION.md via gsd-tools (respects `commit_docs` config):

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit-docs "docs(phase-${PHASE}): add/update validation strategy"
```

## 8. Present Results + Routing

Three routes based on outcome:

**All compliant (no gaps or all resolved):**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD > PHASE {N} IS NYQUIST-COMPLIANT ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

All requirements have automated verification.

▶ Next: /gsd:audit-milestone — verify cross-phase coverage
```

**Partial (some manual-only items):**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD > PHASE {N} VALIDATED (PARTIAL)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{M} requirements automated, {K} manual-only.

Manual items:
{list of manual-only verifications}

▶ Retry: /gsd:validate-phase {N}
```

**Display /clear reminder:**

```
/clear first — fresh context window
```

</process>

<success_criteria>
- [ ] Phase context initialized via gsd-tools
- [ ] Nyquist config checked (exit if disabled)
- [ ] Input state correctly detected (A/B/C)
- [ ] State C exits cleanly with guidance
- [ ] All PLAN and SUMMARY files read during discovery
- [ ] Requirement-to-task map built completely
- [ ] Test infrastructure detected (from VALIDATION.md or filesystem)
- [ ] Existing tests cross-referenced against requirements
- [ ] Gap analysis classifies every requirement
- [ ] User gate presented with gap table and options
- [ ] gsd-nyquist-auditor spawned with complete context
- [ ] Auditor return handled for all three formats
- [ ] VALIDATION.md created (State B) or updated (State A)
- [ ] Test files committed separately from VALIDATION.md
- [ ] Results presented with correct routing
</success_criteria>
