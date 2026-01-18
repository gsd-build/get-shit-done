# gsd-integration-checker.md — Standard Reference

## Metadata
| Attribute | Value |
|-----------|-------|
| **Type** | Agent |
| **Location** | `agents/gsd-integration-checker.md` |
| **Size** | 423 lines |
| **Documentation Tier** | Standard |
| **Complexity Score** | 2+2+2+1 = **7/12** |

### Complexity Breakdown
- **Centrality: 2** — Spawned by audit-milestone, outputs consumed by milestone auditor
- **Complexity: 2** — Multiple verification steps, bash patterns, flow tracing, report generation
- **Failure Impact: 2** — Missed integration issues = broken system shipped despite passing phase verification
- **Novelty: 1** — Integration testing patterns are industry standard

---

## Purpose

Verifies cross-phase integration and E2E flows work together as a system. Individual phases can pass verification while the overall system fails due to broken wiring—this agent catches those gaps. The key insight: **Existence ≠ Integration**. A component can exist without being imported, an API can exist without being called.

---

## Critical Behaviors

- **Check connections, not existence** — Files existing is phase-level; files connecting is integration-level
- **Trace full paths** — Component → API → DB → Response → Display; break at any point = broken flow
- **Check both directions** — Export exists AND import exists AND import is used AND used correctly
- **Be specific about breaks** — "Dashboard doesn't work" is useless; "Dashboard.tsx line 45 fetches /api/users but doesn't await response" is actionable
- **Return structured data** — Milestone auditor aggregates findings; use consistent format

---

## Core Principle

**Existence ≠ Integration**

Integration verification checks four connection types:

| Connection Type | What It Checks |
|-----------------|----------------|
| Exports → Imports | Phase 1 exports `getCurrentUser`, Phase 3 imports and calls it? |
| APIs → Consumers | `/api/users` route exists, something fetches from it? |
| Forms → Handlers | Form submits to API, API processes, result displays? |
| Data → Display | Database has data, UI renders it? |

---

## Verification Process
Extract from phase SUMMARY.md files what each phase provides vs consumes.

### Step 1: Build Export/Import Map
Extract from phase SUMMARYs what each phase provides vs consumes.

### Step 2: Verify Export Usage
For each phase's exports, verify they're imported AND used (not just imported).

| Status | Meaning |
|--------|---------|
| CONNECTED | Imported and used |
| IMPORTED_NOT_USED | Imported but never called |
| ORPHANED | Never imported |

### Step 3: Verify API Coverage
Find all API routes, check each has consumers (fetch/axios calls).

### Step 4: Verify Auth Protection
Check sensitive routes (dashboard, settings, profile) actually check auth.

### Step 5: Verify E2E Flows
Trace common flows: Auth flow, Data display flow, Form submission flow.

### Step 6: Compile Integration Report
Structure findings for milestone auditor as a markdown report (not YAML).

---

## Interactions

| Reads | Writes | Spawned By | Consumed By |
|-------|--------|------------|-------------|
| Phase SUMMARYs | Integration report | `/gsd:audit-milestone` | Milestone auditor |
| Codebase (`src/`) | | | |
| API routes | | | |

---

## Output Format

Structured markdown report with sections:

| Section | Contents |
|---------|----------|
| **Wiring Summary** | Connected/Orphaned/Missing counts |
| **API Coverage** | Consumed/Orphaned route counts |
| **Auth Protection** | Protected/Unprotected counts |
| **E2E Flows** | Complete/Broken flow counts |
| **Detailed Findings** | Orphaned exports, missing connections, broken flows, unprotected routes |

### Expected Markdown Skeleton
```markdown
## Integration Check Complete

### Wiring Summary

**Connected:** {N} exports properly used
**Orphaned:** {N} exports created but unused
**Missing:** {N} expected connections not found

### API Coverage

**Consumed:** {N} routes have callers
**Orphaned:** {N} routes with no callers

### Auth Protection

**Protected:** {N} sensitive areas check auth
**Unprotected:** {N} sensitive areas missing auth

### E2E Flows

**Complete:** {N} flows work end-to-end
**Broken:** {N} flows have breaks

### Detailed Findings

#### Orphaned Exports
{List each with from/reason}

#### Missing Connections
{List each with from/to/expected/reason}

#### Broken Flows
{List each with name/broken_at/reason/missing_steps}

#### Unprotected Routes
{List each with path/reason}
```

---

## Success Criteria

- [ ] Export/import map built from SUMMARYs
- [ ] All key exports checked for usage
- [ ] All API routes checked for consumers
- [ ] Auth protection verified on sensitive routes
- [ ] E2E flows traced and status determined
- [ ] Orphaned code identified
- [ ] Missing connections identified
- [ ] Broken flows identified with specific break points
- [ ] Structured report returned to auditor

---

## Quick Reference

```
WHAT:     Cross-phase integration and E2E flow verification
MODES:    Single mode (integration check)
OUTPUT:   Structured integration report to milestone auditor

CORE RULES:
• Check CONNECTIONS not existence (existence is phase-level)
• Trace full paths: Component → API → DB → Response → Display
• Be specific about breaks with file/line references
• Return the structured markdown report for aggregation

SPAWNED BY: /gsd:audit-milestone
CONSUMED BY: Milestone auditor (aggregates with phase verification)
```
