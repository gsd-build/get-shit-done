---
name: gsd:create-roadmap
description: Create roadmap with phases for the project
allowed-tools:
  - Read
  - Write
  - Bash
  - AskUserQuestion
  - Glob
---

<objective>
Create project roadmap with phase breakdown.

Roadmaps define what work happens in what order. Phases map to requirements.

Run after `/gsd:define-requirements`.
</objective>

<execution_context>
@~/.claude/get-shit-done/references/principles.md
@~/.claude/get-shit-done/workflows/create-roadmap.md
@~/.claude/get-shit-done/templates/roadmap.md
@~/.claude/get-shit-done/templates/state.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/config.json
@.planning/REQUIREMENTS.md
@.planning/research/SUMMARY.md (if exists)
</context>

<process>

<step name="validate">
```bash
# Verify project exists
[ -f .planning/PROJECT.md ] || { echo "ERROR: No PROJECT.md found. Run /gsd:new-project first."; exit 1; }

# Verify requirements exist
[ -f .planning/REQUIREMENTS.md ] || { echo "ERROR: No REQUIREMENTS.md found. Run /gsd:define-requirements first."; exit 1; }
```
</step>

<step name="check_existing">
Check if roadmap already exists:

```bash
[ -f .planning/ROADMAP.md ] && echo "ROADMAP_EXISTS" || echo "NO_ROADMAP"
```

**If ROADMAP_EXISTS:**
Use AskUserQuestion:
- header: "Roadmap exists"
- question: "A roadmap already exists. What would you like to do?"
- options:
  - "View existing" - Show current roadmap
  - "Replace" - Create new roadmap (will overwrite)
  - "Cancel" - Keep existing roadmap

If "View existing": `cat .planning/ROADMAP.md` and exit
If "Cancel": Exit
If "Replace": Continue with workflow
</step>

<step name="create_roadmap">
Follow the create-roadmap.md workflow starting from detect_domain step.

The workflow handles:
- Loading requirements
- Domain expertise detection
- Phase identification mapped to requirements
- Requirement coverage validation (no orphaned requirements)
- Research flags for each phase
- Confirmation gates (respecting config mode)
- ROADMAP.md creation with requirement mappings
- STATE.md initialization
- REQUIREMENTS.md traceability update
- Phase directory creation
- Git commit
</step>

<step name="update_metrics_from_roadmap">
**Update metrics.json with roadmap info:**

```bash
# Ensure metrics.json exists (backward compat for projects created before this feature)
if [ ! -f ".planning/metrics.json" ]; then
    cp ~/.claude/get-shit-done/templates/metrics.json .planning/metrics.json
fi

# Count total phases
PHASES_TOTAL=$(grep -c "^## Phase" .planning/ROADMAP.md || true)
PHASES_TOTAL=${PHASES_TOTAL:-0}

jq --arg total "$PHASES_TOTAL" \
   '.overall_progress.phases_total = ($total | tonumber) |
    .overall_progress.percentage = 0 |
    .milestones = [{"name": "v1.0", "status": "planned", "phases": [1]}]' \
   .planning/metrics.json > .planning/metrics.tmp && \
   mv .planning/metrics.tmp .planning/metrics.json
```

</step>

<step name="done">
```
Roadmap created:
- Roadmap: .planning/ROADMAP.md
- State: .planning/STATE.md
- [N] phases defined

---

## ▶ Next Up

**Phase 1: [Name]** — [Goal from ROADMAP.md]

`/gsd:plan-phase 1`

<sub>`/clear` first → fresh context window</sub>

---

**Also available:**
- `/gsd:discuss-phase 1` — gather context first
- `/gsd:research-phase 1` — investigate unknowns
- Review roadmap

---
```
</step>

</process>

<output>
- `.planning/ROADMAP.md`
- `.planning/STATE.md`
- `.planning/phases/XX-name/` directories
</output>

<success_criteria>
- [ ] PROJECT.md validated
- [ ] REQUIREMENTS.md validated
- [ ] All v1 requirements mapped to phases (no orphans)
- [ ] ROADMAP.md created with phases and requirement mappings
- [ ] STATE.md initialized
- [ ] REQUIREMENTS.md traceability section updated
- [ ] Phase directories created
- [ ] metrics.json updated with phases_total and milestones
- [ ] Changes committed
</success_criteria>
