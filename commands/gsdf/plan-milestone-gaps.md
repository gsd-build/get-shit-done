---
name: gsdf:plan-milestone-gaps
description: Token-optimized gap closure planning
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
---

<objective>
Token-optimized version of `/gsd:plan-milestone-gaps`. Creates phases to close audit gaps.

Reads MILESTONE-AUDIT.md, groups gaps, creates phase entries.
</objective>

<context>
@.planning/PROJECT.md
@.planning/REQUIREMENTS.md
@.planning/ROADMAP.md
@.planning/STATE.md
</context>

<process>

## Step 1: Load Audit Results

```bash
ls -t .planning/v*-MILESTONE-AUDIT.md 2>/dev/null | head -1
```

Parse YAML frontmatter for gaps:
- `gaps.requirements`
- `gaps.integration`
- `gaps.flows`

If no gaps: "No gaps found. Run /gsdf:audit-milestone first."

## Step 2: Prioritize Gaps

Group by priority from REQUIREMENTS.md:

| Priority | Action |
|----------|--------|
| must | Create phase, blocks milestone |
| should | Create phase, recommended |
| nice | Ask user: include or defer? |

## Step 3: Group Gaps into Phases

Cluster related gaps:
- Same affected phase → combine
- Same subsystem → combine
- Dependency order (fix stubs before wiring)
- Keep phases focused: 2-4 tasks each

## Step 4: Calculate Phase Numbers

```bash
ls -d .planning/phases/*/ | sort -V | tail -1
```

Continue from highest existing.

## Step 5: Present Gap Closure Plan

```markdown
## Gap Closure Plan

**Gaps to close:** {N} requirements, {M} integration, {K} flows

### Proposed Phases

**Phase {N}: {Name}**
Closes:
- {REQ-ID}: {description}
- Integration: {from} → {to}

**Phase {N+1}: {Name}**
Closes:
- {REQ-ID}: {description}

---

Create these {X} phases? (yes / adjust / defer optional)
```

## Step 6: Update ROADMAP.md

Add new phases:

```markdown
### Phase {N}: {Name}
**Goal:** {derived from gaps}
**Requirements:** {REQ-IDs}
**Gap Closure:** Closes gaps from audit
```

## Step 7: Create Phase Directories

```bash
for phase in {new_phases}; do
  mkdir -p ".planning/phases/${phase}"
done
```

## Step 8: Commit

Check `COMMIT_PLANNING_DOCS` from config.json (default: true):
```bash
COMMIT_PLANNING_DOCS=$(cat .planning/config.json 2>/dev/null | grep -o '"commit_docs"[[:space:]]*:[[:space:]]*[^,}]*' | grep -o 'true\|false' || echo "true")
git check-ignore -q .planning 2>/dev/null && COMMIT_PLANNING_DOCS=false
```

If `COMMIT_PLANNING_DOCS=false`: Skip git operations.
If `COMMIT_PLANNING_DOCS=true`:
```bash
git add .planning/ROADMAP.md
git commit -m "docs(roadmap): add gap closure phases {N}-{M}"
```

## Step 9: Done

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSDF ► GAP CLOSURE PHASES CREATED ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Phases added: {N} - {M}

───────────────────────────────────────────────────────────────

## ▶ Next Up

**Plan first gap closure phase**

/gsdf:plan-phase {N}

<sub>/clear first → fresh context window</sub>

───────────────────────────────────────────────────────────────

**Also available:**
- cat .planning/ROADMAP.md — see updated roadmap

───────────────────────────────────────────────────────────────

**After all gap phases complete:**

/gsdf:audit-milestone — re-audit to verify gaps closed
/gsd:complete-milestone {version} — archive when audit passes
```

</process>

<gap_to_phase_mapping>

## How Gaps Become Tasks

**Requirement gap → Tasks:**
```yaml
gap:
  id: DASH-01
  description: "User sees their data"
  reason: "Dashboard exists but doesn't fetch from API"
  missing:
    - "useEffect with fetch to /api/user/data"
    - "State for user data"
    - "Render user data in JSX"

becomes:

phase: "Wire Dashboard Data"
tasks:
  - name: "Add data fetching"
    files: [src/components/Dashboard.tsx]
    action: "Add useEffect that fetches /api/user/data on mount"

  - name: "Add state management"
    files: [src/components/Dashboard.tsx]
    action: "Add useState for userData, loading, error states"

  - name: "Render user data"
    files: [src/components/Dashboard.tsx]
    action: "Replace placeholder with userData.map rendering"
```

**Integration gap → Tasks:**
```yaml
gap:
  from_phase: 1
  to_phase: 3
  connection: "Auth token → API calls"
  reason: "Dashboard API calls don't include auth header"

becomes:

phase: "Add Auth to Dashboard API Calls"
tasks:
  - name: "Add auth header to fetches"
    files: [src/components/Dashboard.tsx, src/lib/api.ts]
    action: "Include Authorization header with token in all API calls"

  - name: "Handle 401 responses"
    files: [src/lib/api.ts]
    action: "Add interceptor to refresh token or redirect to login on 401"
```

**Flow gap → Tasks:**
```yaml
gap:
  name: "User views dashboard after login"
  broken_at: "Dashboard data load"
  reason: "No fetch call"

# Usually same phase as requirement/integration gap
# Flow gaps often overlap with other gap types
```

</gap_to_phase_mapping>

<success_criteria>
- [ ] MILESTONE-AUDIT.md loaded
- [ ] Gaps prioritized (must/should/nice)
- [ ] Gaps grouped into phases (with dependency ordering)
- [ ] User confirmed phase plan
- [ ] ROADMAP.md updated
- [ ] Phase directories created
- [ ] Committed (if config allows)
</success_criteria>
