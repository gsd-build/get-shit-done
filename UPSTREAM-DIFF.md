# Upstream Diff: glittercowboy/get-shit-done → ollorin/get-shit-done

Generated: 2026-02-19
Upstream: https://github.com/glittercowboy/get-shit-done
Fork: https://github.com/ollorin/get-shit-done

## Divergence Point

| Item | Value |
|------|-------|
| Divergence commit | `b85247a` — "Add workflow to auto-label new issues with needs-triage" |
| Divergence date | 2026-02-09 |
| Upstream current | `b94a1ca` v1.20.4 (2026-02-17) |
| Fork current | `a6dfad5` v1.18.0 (2026-02-19) |
| Upstream commits ahead | 10 |
| Substantive upstream commits | 4 (others are version bumps and changelogs) |

---

## Structural Note: gsd-tools.cjs vs gsd-tools.js

Upstream renamed `get-shit-done/bin/gsd-tools.cjs` (while our fork keeps `get-shit-done/bin/gsd-tools.js`). All upstream agent and workflow references use `gsd-tools.cjs`; our fork uses `gsd-tools.js`. When porting, every `gsd-tools.cjs` reference in upstream diffs must remain `gsd-tools.js` in this fork. This is a mechanical substitution that applies to all patches.

---

## Upstream Commits Not In Fork

### Substantive Changes (4 commits)

---

#### 1. `9ef582e` — Requirements Verification Loop

**Date:** 2026-02-16
**Message:** `fix: close requirements verification loop and enforce MUST language`
**Category:** `bug-fix`

**What it does:**
- Strengthens the chain from roadmap requirements through planning to verification so requirement IDs cannot silently slip through unchecked.
- `gsd-phase-researcher.md`: Adds a `<phase_requirements>` section to RESEARCH output — researcher now outputs a table mapping each REQ-ID to relevant research findings.
- `gsd-plan-checker.md`: Adds a hard FAIL (blocking, not a warning) if any requirement ID from the roadmap is absent from all plans' `requirements` frontmatter fields.
- `gsd-planner.md`: Changes `requirements:` field from optional/passive comment to "REQUIRED — MUST NOT be empty". Adds Step 0 ("Extract Requirement IDs") before all other planning steps.
- `gsd-verifier.md`: Changes requirements extraction from grepping REQUIREMENTS.md to reading from PLAN.md frontmatter. Changes requirements table schema to include Source Plan, Description, and Evidence columns.
- `get-shit-done/templates/phase-prompt.md`: Same requirements field enforcement as planner.
- `get-shit-done/templates/summary.md`: `requirements-completed` field changes to "REQUIRED — Copy ALL requirement IDs from this plan's requirements frontmatter field".
- `get-shit-done/workflows/execute-phase.md`: Passes phase requirement IDs to the verifier agent prompt. Adds ROADMAP.md and REQUIREMENTS.md to the executor commit file list.
- `get-shit-done/workflows/execute-plan.md`: Adds note that `requirements-completed` MUST copy the PLAN.md requirements array verbatim.

**Files modified in upstream:**
- `agents/gsd-phase-researcher.md`
- `agents/gsd-plan-checker.md`
- `agents/gsd-planner.md`
- `agents/gsd-verifier.md`
- `get-shit-done/templates/phase-prompt.md`
- `get-shit-done/templates/summary.md`
- `get-shit-done/workflows/execute-phase.md`
- `get-shit-done/workflows/execute-plan.md`

**Fork conflict check:**
- Our fork's `execute-plan.md` has Telegram MCP integration and Telegram blocking question sections that were removed in the upstream diff (upstream removed a `<telegram_mcp_integration>` section). Fork must keep this section.
- Our fork's `execute-phase.md` has auto routing logic (model profile detection, task router spawning) that is absent in upstream. Fork must keep this.
- Our fork's agent files (researcher, planner, verifier, plan-checker) have not been modified fork-specifically — they are close to the upstream base. Changes are additive.

**Portability assessment:** `needs-adaptation`
**Rationale:** Changes are beneficial bug fixes but the execute-phase.md and execute-plan.md patches must be applied selectively — upstream removed Telegram MCP integration that our fork keeps, and upstream references `gsd-tools.cjs` paths that our fork keeps as `gsd-tools.js`. The agent file changes (researcher, planner, verifier, plan-checker) can be ported cleanly. Template changes are straightforward. Phase 19 work.

---

#### 2. `e449c5a` — Gemini CLI Shell Variable Escape

**Date:** 2026-02-16
**Message:** `fix(gemini): escape shell variables in agent bodies for Gemini CLI`
**Category:** `bug-fix`

**What it does:**
- In `bin/install.js`, during agent installation for Gemini CLI, replaces all `${VAR}` patterns in agent body text with `$VAR` using `/\$\{(\w+)\}/g` regex.
- Gemini CLI's `templateString()` treats `${WORD}` patterns as template variables and throws "Template validation failed: Missing required input parameters: PHASE" when GSD agents are installed for Gemini because agents use `${PHASE}`, `${PLAN}`, etc. in bash code blocks.
- Complex expansions like `${VAR:-default}` are preserved (they don't match the word-only pattern).

**Files modified in upstream:**
- `bin/install.js`

**Fork conflict check:**
- Our fork's `bin/install.js` has fork-specific additions: dotenv dependency injection into hook package.json (`a6dfad5` — the most recent fork commit). The upstream change modifies the agent body transformation step which is a separate code path from the dotenv fix.
- Our fork does not appear to support Gemini CLI — no Gemini CLI integration in our fork's feature set.

**Portability assessment:** `needs-adaptation`
**Rationale:** The fix addresses a real bug for Gemini CLI users, but our fork's install.js has a conflicting recent change (dotenv dependency fix). If we add Gemini CLI support in the future, this fix should be ported. For now, low priority since the fork is Claude Code-only. Phase 19 work (low priority / optional).

---

#### 3. `2f25895` — Milestone Audit 3-Source Requirements Cross-Reference

**Date:** 2026-02-16
**Message:** `fix: tighten milestone audit requirements verification with 3-source cross-reference`
**Category:** `bug-fix`

**What it does:**
- `agents/gsd-integration-checker.md`: Adds a "Requirements Integration Map" output section — integration checker now receives milestone requirement IDs and must map each REQ-ID to cross-phase wiring (WIRED / PARTIAL / UNWIRED).
- `get-shit-done/workflows/audit-milestone.md`: Replaces simple requirements check with a 3-source cross-reference: (1) VERIFICATION.md must-haves, (2) SUMMARY.md `requirements-completed` frontmatter, (3) REQUIREMENTS.md traceability table. Gap objects carry structured detail (id, status, phase, claimed_by_plans, completed_by_plans, verification_status, evidence). Adds FAIL gate — any unsatisfied requirement forces `gaps_found` status.
- `get-shit-done/workflows/complete-milestone.md`: Adds a requirements completion gate before allowing milestone completion — counts checked-off requirements in REQUIREMENTS.md traceability table, blocks completion if any are unchecked. Also adds optional phase directory archival step (move to `milestones/v[X.Y]-phases/`). Adds `commit_docs` guard when staging files.
- `get-shit-done/workflows/plan-milestone-gaps.md`: Adds "Update REQUIREMENTS.md Traceability Table" step — resets unsatisfied requirements (`[x]` → `[ ]`) and updates coverage count when planning gap closure phases.

**Files modified in upstream:**
- `agents/gsd-integration-checker.md`
- `get-shit-done/workflows/audit-milestone.md`
- `get-shit-done/workflows/complete-milestone.md`
- `get-shit-done/workflows/plan-milestone-gaps.md`

**Fork conflict check:**
- Our fork's `audit-milestone.md` uses absolute paths (`/Users/ollorin/.claude/get-shit-done/...`) and has absolute-path INIT_FILE pattern (temp file approach). Upstream changed to `~/.claude` paths and inline `$()` substitution. Fork keeps absolute paths.
- Our fork's `complete-milestone.md` similarly has absolute paths and the INIT_FILE temp approach.
- These files are not fork-specifically modified beyond path differences — the changes are additive (new requirement checks on top of existing flow).
- The integration checker addition is purely additive.

**Portability assessment:** `needs-adaptation`
**Rationale:** Meaningful quality improvements (catches missed requirements at milestone close). Path references need adjustment (cjs→js, ~/ paths). apply to audit-milestone.md, complete-milestone.md, plan-milestone-gaps.md, and integration-checker.md. Phase 19 work.

---

#### 4. `1764abc` — Executor Per-Plan ROADMAP and Requirements Updates

**Date:** 2026-02-17
**Message:** `fix: executor updates ROADMAP.md and REQUIREMENTS.md per-plan`
**Category:** `bug-fix`

**What it does:**
- `agents/gsd-executor.md`: Adds three significant improvements:
  1. **Scope boundary + fix attempt limit**: New `SCOPE BOUNDARY` section — executor must only fix issues caused by the current task's changes, log out-of-scope discoveries to `deferred-items.md`, and stop after 2 fix attempts.
  2. **Auto-mode detection**: `auto_mode_detection` section — executor checks `workflow.auto_advance` config at start to determine checkpoint behavior.
  3. **Auto-mode checkpoint handling**: When auto mode is active, `checkpoint:human-verify` → auto-approve, `checkpoint:decision` → auto-select first option, `checkpoint:human-action` → always stop.
  4. **ALWAYS use Write tool directive**: New instruction never to use `Bash(cat << 'EOF')` or heredoc for file creation.
  5. **Roadmap + requirements update calls**: After state updates, executor must call `roadmap update-plan-progress` and `requirements mark-complete`.
  6. **ROADMAP.md and REQUIREMENTS.md in final commit**.
- `get-shit-done/bin/gsd-tools.cjs`: Adds `cmdRequirementsMarkComplete` function and `requirements mark-complete` CLI command. Also adds `roadmap update-plan-progress` command (marks plan as complete in ROADMAP.md progress table).
- `get-shit-done/workflows/execute-phase.md`: Updates executor prompt success criteria to include ROADMAP.md update. Adds auto-mode checkpoint handling section.
- `get-shit-done/workflows/execute-plan.md`: Adds `<step name="update_requirements">` — marks completed requirements from PLAN frontmatter after plan completes.

**Files modified in upstream:**
- `agents/gsd-executor.md`
- `get-shit-done/bin/gsd-tools.cjs` (our fork: `gsd-tools.js`)
- `get-shit-done/workflows/execute-phase.md`
- `get-shit-done/workflows/execute-plan.md`

**Fork conflict check:**
- Our fork's `gsd-executor.md` does not have auto-mode detection or scope boundary sections — these are fully additive and safe to apply.
- Our fork's `execute-phase.md` has auto routing (model profile, task router) and execute-roadmap integration that upstream doesn't. The auto-mode checkpoint section in upstream is compatible with fork's existing auto-routing but needs to coexist with the fork's Telegram-based checkpoint handling.
- Our fork's `execute-plan.md` has absolute paths (`/Users/ollorin/.claude/...`) and Telegram MCP integration (removed from upstream). The `update_requirements` step is additive.
- `gsd-tools.js`: The `requirements mark-complete` command and `roadmap update-plan-progress` command are entirely new CLI subcommands not in the fork. These need to be ported from the upstream's `gsd-tools.cjs` additions into our fork's `gsd-tools.js`.

**Portability assessment:** `needs-adaptation`
**Rationale:** The most impactful fix — executors currently never update ROADMAP.md or mark requirements complete, causing planning artifacts to stay stale throughout milestone execution. The gsd-tools.js additions (requirements mark-complete, roadmap update-plan-progress) are pure additions with no conflict. The executor agent and workflow changes need selective application (keep fork's Telegram integration, keep absolute paths, keep auto routing). Phase 19 work.

---

### Non-Substantive Changes (6 commits)

| Commit | Category | Assessment |
|--------|----------|------------|
| `fb50d3a` | docs — CHANGELOG.md for v1.20.2 | `conflicts-with-fork` — our fork has its own version history; do not port upstream changelog |
| `710795c` | version bump — package.json to 1.20.2 | `conflicts-with-fork` — fork has independent version (1.18.0); do not port |
| `95bc5a0` | docs — CHANGELOG.md for v1.20.3 | `conflicts-with-fork` — same as above |
| `c609f3d` | version bump — package.json to 1.20.3 | `conflicts-with-fork` — same as above |
| `8b181f2` | docs — CHANGELOG.md for v1.20.4 | `conflicts-with-fork` — same as above |
| `b94a1ca` | version bump — package.json to 1.20.4 | `conflicts-with-fork` — same as above |

---

## Summary by Phase

### Phase 19: Bug Fixes and Context Window Management

Port these changes (all assessed as `needs-adaptation`):

| Priority | Commit | What to port | Key adaptation |
|----------|--------|--------------|----------------|
| HIGH | `1764abc` | `requirements mark-complete` + `roadmap update-plan-progress` CLI commands | Add to `gsd-tools.js` (not .cjs); skip path changes |
| HIGH | `1764abc` | Executor scope boundary + fix attempt limit section | Add to `agents/gsd-executor.md`; additive |
| HIGH | `1764abc` | Executor ROADMAP/requirements update calls + final commit | Add to `agents/gsd-executor.md` and `execute-plan.md`; keep absolute paths |
| HIGH | `9ef582e` | Plan checker blocking FAIL for missing requirements | Add to `agents/gsd-plan-checker.md`; additive |
| HIGH | `9ef582e` | Planner REQUIRED enforcement on requirements field + Step 0 | Add to `agents/gsd-planner.md`; additive |
| HIGH | `9ef582e` | Verifier requirements extraction from PLAN frontmatter | Update `agents/gsd-verifier.md`; keep existing verification logic |
| HIGH | `9ef582e` | Summary template requirements-completed REQUIRED note | Update `get-shit-done/templates/summary.md`; additive |
| HIGH | `9ef582e` | Phase-prompt template requirements REQUIRED enforcement | Update `get-shit-done/templates/phase-prompt.md`; additive |
| MEDIUM | `9ef582e` | Researcher phase_requirements section | Add to `agents/gsd-phase-researcher.md`; additive |
| MEDIUM | `2f25895` | Integration checker Requirements Integration Map | Add to `agents/gsd-integration-checker.md`; additive |
| MEDIUM | `2f25895` | Audit milestone 3-source cross-reference | Update `get-shit-done/workflows/audit-milestone.md`; adapt paths |
| MEDIUM | `2f25895` | Complete milestone requirements gate + phase archival | Update `get-shit-done/workflows/complete-milestone.md`; adapt paths |
| MEDIUM | `2f25895` | Plan milestone gaps REQUIREMENTS.md reset | Update `get-shit-done/workflows/plan-milestone-gaps.md`; adapt paths |
| LOW | `e449c5a` | Gemini install escape (only if Gemini support added) | Update `bin/install.js`; check against fork's dotenv fix |

**Auto-mode checkpoint handling** (`1764abc` executor + `1764abc` execute-phase): Already partially implemented in our fork's execute-phase.md but not in gsd-executor.md. Port the executor auto-mode detection and checkpoint handling from upstream, ensuring it integrates with the fork's existing execute-roadmap auto-flow.

### Phase 20: Git Branching and Autonomous Execution

No upstream changes map to Phase 20 scope (git branching, autonomous execution flow improvements). Phase 20 work is fork-specific development based on the fork's roadmap requirements (GIT-01, GIT-02, EXEC-01, EXEC-02).

---

## Files to Modify in Phase 19

| File | Upstream Source | Adaptation Needed |
|------|----------------|-------------------|
| `get-shit-done/bin/gsd-tools.js` | `gsd-tools.cjs` additions | Add `requirements mark-complete` + `roadmap update-plan-progress` commands |
| `agents/gsd-executor.md` | `1764abc` + `1764abc` | Add scope boundary, auto-mode detection, ROADMAP/req update calls; keep absolute paths |
| `agents/gsd-planner.md` | `9ef582e` | Add Step 0 (extract requirement IDs), enforce REQUIRED on requirements field |
| `agents/gsd-plan-checker.md` | `9ef582e` | Add blocking FAIL for missing requirement IDs |
| `agents/gsd-verifier.md` | `9ef582e` | Change requirements extraction to read PLAN frontmatter |
| `agents/gsd-phase-researcher.md` | `9ef582e` | Add phase_requirements section template |
| `agents/gsd-integration-checker.md` | `2f25895` | Add Requirements Integration Map output section |
| `get-shit-done/templates/summary.md` | `9ef582e` | Enforce REQUIRED on requirements-completed field |
| `get-shit-done/templates/phase-prompt.md` | `9ef582e` | Enforce REQUIRED on requirements field |
| `get-shit-done/workflows/execute-plan.md` | `1764abc` + `9ef582e` | Add update_requirements step; keep absolute paths, keep Telegram MCP section |
| `get-shit-done/workflows/execute-phase.md` | `1764abc` + `9ef582e` | Add req IDs to verifier prompt, add ROADMAP/req to commit; keep auto routing, keep absolute paths |
| `get-shit-done/workflows/audit-milestone.md` | `2f25895` | Add 3-source cross-reference; adapt absolute paths |
| `get-shit-done/workflows/complete-milestone.md` | `2f25895` | Add requirements gate + phase archival; adapt absolute paths |
| `get-shit-done/workflows/plan-milestone-gaps.md` | `2f25895` | Add REQUIREMENTS.md traceability reset step; adapt paths |

---

## Files NOT to Modify

| File | Reason |
|------|--------|
| `CHANGELOG.md` | Fork maintains its own changelog |
| `package.json` (version) | Fork has independent version 1.18.0 |
| `package-lock.json` | Same reason |
| Any upstream `~/.claude` path references | Fork uses `/Users/ollorin/.claude/` absolute paths |
| `execute-plan.md` Telegram MCP section | Fork-specific; upstream removed it but fork needs it |
| `execute-phase.md` auto-routing section | Fork-specific; not in upstream |
| `execute-phase.md` execute-roadmap integration | Fork-specific; not in upstream |
