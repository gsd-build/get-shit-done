---
name: gsdf:audit-milestone
description: Token-optimized milestone audit
argument-hint: "[version]"
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
  - Task
  - Write
---

<objective>
Token-optimized version of `/gsd:audit-milestone`. Verifies milestone achieved its definition of done.

Checks: requirements coverage, cross-phase integration, E2E flows.
</objective>

<context>
Version: $ARGUMENTS (optional — defaults to current milestone)

@.planning/PROJECT.md
@.planning/REQUIREMENTS.md
@.planning/ROADMAP.md
@.planning/config.json
</context>

<process>

## Step 0: Resolve GSDF Model Profile

```bash
# GSDF uses model_profile_gsdf (falls back to model_profile, then "balanced")
MODEL_PROFILE=$(cat .planning/config.json 2>/dev/null | grep -o '"model_profile_gsdf"[[:space:]]*:[[:space:]]*"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"')
[ -z "$MODEL_PROFILE" ] && MODEL_PROFILE=$(cat .planning/config.json 2>/dev/null | grep -o '"model_profile"[[:space:]]*:[[:space:]]*"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"' || echo "balanced")
```

| Agent | quality | balanced | budget |
|-------|---------|----------|--------|
| gsd-integration-checker | sonnet | sonnet | haiku |

## Step 1: Determine Milestone Scope

```bash
ls -d .planning/phases/*/ | sort -V
```

- Parse version from arguments or detect from ROADMAP.md
- Identify all phase directories
- Extract milestone definition of done

## Step 2: Read All Phase Verifications

```bash
for dir in .planning/phases/*/; do
  cat "${dir}"*-VERIFICATION.md 2>/dev/null
done
```

Extract from each:
- Status: passed | gaps_found
- Critical gaps (blockers)
- Non-critical gaps (tech debt)
- Anti-patterns (TODOs, stubs)
- Requirements coverage

Flag missing VERIFICATION.md as "unverified phase" (blocker).

## Step 3: Spawn Integration Checker

```
Task(prompt="Check cross-phase integration and E2E flows.

Phases: {phase_dirs}
Phase exports: {from SUMMARYs}
API routes: {routes created}

Verify:
1. Cross-phase wiring (exports used by imports)
2. E2E user flows complete
3. No dangling connections

Return structured report.
", subagent_type="gsd-integration-checker", model="{checker_model}", description="Check integration")
```

## Step 4: Collect Results

Combine:
- Phase-level gaps and tech debt
- Integration checker's report

## Step 5: Check Requirements Coverage

For each requirement in REQUIREMENTS.md:
- Find owning phase
- Check phase verification status
- Mark: satisfied | partial | unsatisfied

For REQUIREMENTS.md traceability:
- Check status column: should be "Complete" for all milestone requirements
- Cross-reference with phase VERIFICATIONs
- Flag any "Pending" requirements in completed phases as gaps

## Step 6: Create MILESTONE-AUDIT.md

Write `.planning/v{version}-MILESTONE-AUDIT.md`:

```yaml
---
milestone: {version}
audited: {timestamp}
status: passed | gaps_found | tech_debt
scores:
  requirements: N/M
  phases: N/M
  integration: N/M
  flows: N/M
gaps:
  requirements: [...]
  integration: [...]
tech_debt:
  - phase: 01-auth
    items: [...]
---
```

## Step 6.5: Commit Audit

Check `COMMIT_PLANNING_DOCS` from config.json:
```bash
COMMIT_PLANNING_DOCS=$(cat .planning/config.json 2>/dev/null | grep -o '"commit_docs"[[:space:]]*:[[:space:]]*[^,}]*' | grep -o 'true\|false' || echo "true")
git check-ignore -q .planning 2>/dev/null && COMMIT_PLANNING_DOCS=false
```

If `COMMIT_PLANNING_DOCS=true`:
```bash
git add .planning/v${VERSION}-MILESTONE-AUDIT.md && git commit -m "docs: audit milestone v${VERSION}"
```

## Step 7: Present Results

Route by status:

---

**If passed:**

## ✓ Milestone {version} — Audit Passed

**Score:** {N}/{M} requirements satisfied
**Report:** .planning/v{version}-MILESTONE-AUDIT.md

All requirements covered. Cross-phase integration verified. E2E flows complete.

───────────────────────────────────────────────────────────────

## ▶ Next Up

**Complete milestone** — archive and tag

/gsdf:complete-milestone {version}

<sub>/clear first → fresh context window</sub>

───────────────────────────────────────────────────────────────

---

**If gaps_found:**

## ⚠ Milestone {version} — Gaps Found

**Score:** {N}/{M} requirements satisfied
**Report:** .planning/v{version}-MILESTONE-AUDIT.md

### Unsatisfied Requirements

{For each unsatisfied requirement:}
- **{REQ-ID}: {description}** (Phase {X})
  - {reason}

### Cross-Phase Issues

{For each integration gap:}
- **{from} → {to}:** {issue}

───────────────────────────────────────────────────────────────

## ▶ Next Up

**Plan gap closure** — create phases to complete milestone

/gsdf:plan-milestone-gaps

<sub>/clear first → fresh context window</sub>

───────────────────────────────────────────────────────────────

**Also available:**
- cat .planning/v{version}-MILESTONE-AUDIT.md — see full report
- /gsd:complete-milestone {version} — proceed anyway (accept tech debt)

───────────────────────────────────────────────────────────────

---

**If tech_debt (no blockers but accumulated debt):**

## ⚡ Milestone {version} — Tech Debt Review

**Score:** {N}/{M} requirements satisfied
**Report:** .planning/v{version}-MILESTONE-AUDIT.md

All requirements met. No critical blockers. Accumulated tech debt needs review.

### Tech Debt by Phase

{For each phase with debt:}
**Phase {X}: {name}**
- {item 1}
- {item 2}

### Total: {N} items across {M} phases

───────────────────────────────────────────────────────────────

## ▶ Options

**A. Complete milestone** — accept debt, track in backlog

/gsdf:complete-milestone {version}

**B. Plan cleanup phase** — address debt before completing

/gsdf:plan-milestone-gaps

<sub>/clear first → fresh context window</sub>

───────────────────────────────────────────────────────────────

</process>

<success_criteria>
- [ ] Milestone scope identified
- [ ] VERIFICATION.md files read
- [ ] Integration checker spawned
- [ ] MILESTONE-AUDIT.md created
- [ ] Results presented with next steps (including tech_debt route)
</success_criteria>
