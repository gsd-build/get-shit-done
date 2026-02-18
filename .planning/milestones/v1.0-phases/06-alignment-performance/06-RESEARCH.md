# Phase 6: Alignment + Performance - Research

**Researched:** 2026-02-17
**Domain:** Drift detection, occurrence checking, and performance computation in a declarative DAG system
**Confidence:** HIGH

## Summary

Phase 6 adds the "alignment layer" to the existing Declare system. The core insight: the graph engine (`DeclareDag`) already detects orphan nodes via `validate()`, the trace command already walks causation paths upward, and the status command already aggregates integrity counts. Phase 6 wires these primitives together into drift detection during execution, occurrence checks during verification, performance scoring in status output, and a renegotiation flow for declarations that are no longer true.

The implementation is primarily orchestration-level work (CJS commands + slash command meta-prompts), not deep algorithmic work. The graph engine needs only minor additions (a `findOrphans()` convenience method and an archive-aware future parser). The heaviest new logic is the alignment assessment (hybrid structural + AI) and the renegotiation flow (archive + replace + orphan flagging).

**Primary recommendation:** Build on existing primitives. The graph engine's `validate()` already finds orphans, `traceUpward()` already walks causation paths, and `runStatus()` already aggregates integrity. Wire these together with new CJS commands (`check-drift`, `check-occurrence`, `compute-performance`, `renegotiate`) and extend the execute/status slash commands.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Drift surfacing
- Drift checks run automatically during /declare:execute (not on-demand)
- Soft block on drift: show warning + ask "continue anyway?" before proceeding with drifted action
- Contextual detail: show drifted node + parent milestone + suggestion ("connect to declaration X or remove")
- Scope covers both orphaned actions AND orphaned milestones (anything without a causation path to a declaration)

#### Performance display
- Performance score appears in /declare:status output (no standalone command)
- Per-declaration granularity: each declaration gets its own alignment x integrity score, plus a project rollup
- Alignment assessed via hybrid approach: structural causation coverage as baseline, AI assessment to catch semantic drift (actions exist but don't actually serve the declaration)
- Plain text labels: "Performance: HIGH (alignment: HIGH x integrity: HIGH)" format
- Integrity component uses factual counts from Phase 5 (verified/kept/honored)

#### Renegotiation flow
- Triggered as part of occurrence checks -- when "no longer true" -> automatically enters renegotiation flow
- Archive + replace: old declaration archived with date, new one created, history preserved
- Archived declarations live in a separate file (e.g., FUTURE-ARCHIVE.md) keeping FUTURE.md clean with only active declarations
- Orphaned milestones from replaced declarations flagged for manual user review (reassign, archive, or delete)

### Claude's Discretion
- Occurrence check trigger mechanism (how/when checks are prompted)
- Exact AI assessment prompting for semantic drift detection
- Archive file format and naming
- How orphaned node review is presented to the user

### Deferred Ideas (OUT OF SCOPE)
- **Visual UI for the declaration graph** -- deferred, out of scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ALGN-01 | Shared future document (FUTURE.md) is referenced by all agents as the source of truth | FUTURE.md already exists and is parsed by `parseFutureFile()`. Phase 6 formalizes FUTURE.md as canonical reference by ensuring all slash commands load it via `buildDagFromDisk()` and adding FUTURE-ARCHIVE.md for renegotiated declarations. |
| ALGN-02 | System performs occurrence checks -- AI periodically asks "does this still occur as what we declared?" | New `check-occurrence` CJS command provides declaration data + trace context. Slash command orchestration (in execute or dedicated prompt) performs the AI assessment. Trigger mechanism is Claude's discretion. |
| ALGN-03 | System detects drift when actions have no causation path to a declaration | Graph engine's `validate()` already detects orphans. New `check-drift` CJS command wraps orphan detection with contextual suggestions. Execute slash command calls it pre-wave and surfaces warnings with soft-block UX. |
| ALGN-04 | Performance is computed as alignment x integrity (qualitative: HIGH/MEDIUM/LOW) | New `compute-performance` CJS command combines structural coverage (from graph traversal) with integrity counts (from Phase 5's status aggregation). Status slash command renders per-declaration and rollup performance. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| node:test | built-in | Unit testing | Already used across all test files in the project |
| node:assert/strict | built-in | Assertions | Already used, zero-dependency pattern |
| node:fs | built-in | File I/O for FUTURE-ARCHIVE.md | Already used everywhere |
| node:path | built-in | Path resolution | Already used everywhere |
| esbuild | ^0.24.2 | CJS bundling | Already configured in esbuild.config.js |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none) | -- | -- | Zero runtime dependencies is a project constraint |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom orphan finder | External graph library | Overkill -- DAG is small, `validate()` already works |
| Numeric scoring | Qualitative labels | User decision: qualitative only (HIGH/MEDIUM/LOW) |

**Installation:**
No new dependencies. Zero-runtime-dependency constraint maintained.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── artifacts/
│   ├── future.js              # EXISTING - add FUTURE-ARCHIVE.md parser/writer
│   └── verification.js        # EXISTING - already handles verification state
├── commands/
│   ├── check-drift.js         # NEW - orphan detection with contextual suggestions
│   ├── check-occurrence.js    # NEW - occurrence check data provider
│   ├── compute-performance.js # NEW - alignment x integrity computation
│   ├── renegotiate.js         # NEW - archive + replace declaration flow
│   └── status.js              # MODIFY - add performance section to output
├── graph/
│   └── engine.js              # MODIFY - add findOrphans() convenience method
└── declare-tools.js           # MODIFY - register new subcommands
```

### Pattern 1: Data Provider CJS + AI Orchestration Meta-Prompt
**What:** Each CJS command computes deterministic data, returns JSON. Slash command meta-prompt handles AI assessment and user interaction.
**When to use:** Always -- this is the established project pattern.
**Example:**
```javascript
// check-drift.js (CJS data provider)
function runCheckDrift(cwd) {
  const graphResult = buildDagFromDisk(cwd);
  if ('error' in graphResult) return graphResult;
  const { dag } = graphResult;

  const validation = dag.validate();
  const orphans = validation.errors.filter(e => e.type === 'orphan');

  // Enrich with context: what milestone/declaration is nearby
  const driftedNodes = orphans.map(o => {
    const node = dag.getNode(o.node);
    // For actions: find sibling actions' milestones as suggestions
    // For milestones: find sibling milestones' declarations as suggestions
    return {
      id: o.node,
      type: node.type,
      title: node.title,
      suggestions: findNearestConnections(dag, o.node),
    };
  });

  return { hasDrift: driftedNodes.length > 0, driftedNodes };
}
```

### Pattern 2: Hybrid Assessment (Structural + AI)
**What:** Structural computation provides a baseline score, AI assessment catches semantic drift that structure can't detect.
**When to use:** Performance/alignment scoring where purely structural analysis misses intent misalignment.
**Example:**
```javascript
// compute-performance.js returns structural data; slash command adds AI layer
function runComputePerformance(cwd) {
  const graphResult = buildDagFromDisk(cwd);
  const { dag } = graphResult;

  const declarations = dag.getDeclarations();
  const perDeclaration = declarations.map(d => {
    const milestones = dag.getDownstream(d.id);
    const actions = milestones.flatMap(m => dag.getDownstream(m.id));

    // Structural alignment: coverage ratio
    const totalMilestones = milestones.length;
    const connectedActions = actions.filter(a =>
      dag.getUpstream(a.id).length > 0
    ).length;

    // Integrity from factual counts
    const integrityData = computeIntegrityCounts(milestones);

    return {
      declarationId: d.id,
      declarationTitle: d.title,
      statement: d.statement,
      structuralAlignment: { totalMilestones, connectedActions, ... },
      integrity: integrityData,
      // AI assessment placeholder -- slash command fills this
    };
  });

  return { perDeclaration, projectRollup: aggregatePerformance(perDeclaration) };
}
```

### Pattern 3: Archive + Replace for Renegotiation
**What:** Old declaration archived to FUTURE-ARCHIVE.md with timestamp, new declaration created in FUTURE.md, graph edges preserved where possible.
**When to use:** When an occurrence check reveals a declaration is no longer true.
**Example:**
```javascript
// renegotiate.js
function runRenegotiate(cwd, args) {
  const declarationId = parseFlag(args, 'declaration');

  // 1. Read current FUTURE.md
  // 2. Find and remove the declaration
  // 3. Append to FUTURE-ARCHIVE.md with date and reason
  // 4. Update declaration status to RENEGOTIATED
  // 5. Find orphaned milestones (those that only realized this declaration)
  // 6. Return orphan list for user review

  return {
    archived: { id: declarationId, archivedAt: new Date().toISOString() },
    orphanedMilestones: [...],
    nextStep: 'Create replacement declaration or reassign milestones'
  };
}
```

### Anti-Patterns to Avoid
- **Numeric scoring for performance:** User decision explicitly says qualitative labels only. Never compute percentages or decimal scores for user-facing output.
- **Standalone performance command:** User decided performance appears in /declare:status only, not as a separate command.
- **Hard blocking on drift:** User decided soft block (warning + continue anyway?), not hard block.
- **Automatic orphan reassignment:** User decided flagging for manual review, not auto-reassignment.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Orphan detection | Custom graph traversal | `dag.validate()` orphan errors | Already implemented, tested, handles edge cases |
| Causation path tracing | BFS/DFS from scratch | `traceUpward()` from trace.js | Already handles multi-path, truncation |
| Integrity aggregation | New counting logic | `runStatus()` integrity object | Phase 5 already aggregates KEPT/HONORED/BROKEN counts |
| DAG construction from disk | New file readers | `buildDagFromDisk()` | Handles FUTURE.md + MILESTONES.md + PLAN.md loading |
| File path detection | New heuristic | `looksLikeFilePath()` from verify-wave.js | Already tested, handles edge cases |

**Key insight:** Phase 6 is largely an integration phase. Nearly every primitive it needs already exists in the codebase. The new work is wiring them together and adding the AI orchestration layer.

## Common Pitfalls

### Pitfall 1: Conflating Structural Alignment with Semantic Alignment
**What goes wrong:** A declaration has milestones and actions connected, so structural coverage says HIGH. But the actions don't actually serve the declaration's intent -- they've drifted semantically.
**Why it happens:** Graph structure only sees edges, not meaning.
**How to avoid:** The hybrid approach (user decision): structural provides baseline, AI catches semantic drift. The CJS command returns structural data + the declaration statement + action descriptions, and the slash command meta-prompt performs semantic assessment.
**Warning signs:** All declarations showing HIGH alignment despite obviously misaligned work.

### Pitfall 2: Occurrence Check Fatigue
**What goes wrong:** Occurrence checks fire too frequently, user ignores them (alarm fatigue).
**Why it happens:** Over-eager triggering, especially for stable declarations.
**How to avoid:** Trigger occurrence checks strategically: at milestone completion (natural checkpoint), not on every action. Consider a cooldown or "last checked" timestamp per declaration.
**Warning signs:** User dismissing occurrence checks without reading them.

### Pitfall 3: Archive File Growing Without Bound
**What goes wrong:** FUTURE-ARCHIVE.md grows indefinitely, making it hard to find relevant history.
**Why it happens:** No cleanup or summarization strategy.
**How to avoid:** Keep FUTURE-ARCHIVE.md structured with clear sections per archived declaration, including date, reason, and replacement ID (if any). Don't over-engineer -- this file is for human reference, not machine parsing.
**Warning signs:** Archive file exceeding 100+ entries.

### Pitfall 4: Renegotiation Creating Orphan Cascades
**What goes wrong:** Archiving a declaration orphans its milestones, which orphans their actions, creating a large orphan cascade that overwhelms the user.
**Why it happens:** Declarations are graph roots -- removing one can disconnect entire subgraphs.
**How to avoid:** The renegotiate command should find ALL transitively orphaned nodes (not just direct milestone children). Present them grouped by milestone for easier review. Offer batch operations (reassign all to new declaration, archive milestone group, etc.).
**Warning signs:** Renegotiation producing 10+ orphan nodes requiring individual review.

### Pitfall 5: Performance Score Inflation
**What goes wrong:** Performance always shows HIGH because structural coverage is good and integrity has no broken milestones (they're all still PENDING).
**Why it happens:** PENDING milestones haven't been verified yet, so they can't be BROKEN. Integrity counts only verified milestones.
**How to avoid:** Factor in verification coverage: if most milestones are unverified (PENDING/ACTIVE/DONE), integrity should reflect that uncertainty. Consider: only milestones past DONE contribute to integrity scoring.
**Warning signs:** Early projects always showing HIGH performance despite no verification having occurred.

## Code Examples

### Finding Orphans from Existing Validate
```javascript
// Source: src/graph/engine.js validate() method
// The engine already detects orphans -- just filter the validation errors
function findOrphans(dag) {
  const validation = dag.validate();
  return validation.errors
    .filter(e => e.type === 'orphan')
    .map(e => {
      const node = dag.getNode(e.node);
      return { id: e.node, type: node.type, title: node.title, status: node.status };
    });
}
```

### Computing Structural Alignment per Declaration
```javascript
// Source: derived from existing graph traversal patterns in trace.js and status.js
function computeStructuralAlignment(dag, declarationId) {
  const milestones = dag.getDownstream(declarationId)
    .filter(n => n.type === 'milestone');

  if (milestones.length === 0) return 'LOW'; // No milestones at all

  const actions = milestones.flatMap(m =>
    dag.getDownstream(m.id).filter(n => n.type === 'action')
  );

  // Coverage: do all milestones have actions?
  const milestonesWithActions = milestones.filter(m =>
    dag.getDownstream(m.id).filter(n => n.type === 'action').length > 0
  );

  const coverage = milestonesWithActions.length / milestones.length;
  if (coverage >= 0.8) return 'HIGH';
  if (coverage >= 0.5) return 'MEDIUM';
  return 'LOW';
}
```

### Computing Integrity from Factual Counts
```javascript
// Source: derived from existing status.js integrity aggregation
function computeIntegrityLevel(milestones) {
  const verified = milestones.filter(m =>
    ['KEPT', 'HONORED', 'RENEGOTIATED'].includes(m.status)
  );
  const broken = milestones.filter(m => m.status === 'BROKEN');
  const total = milestones.length;

  if (total === 0) return 'HIGH'; // No milestones = vacuously true

  const verifiedRatio = verified.length / total;
  const brokenRatio = broken.length / total;

  if (brokenRatio > 0.3) return 'LOW';
  if (verifiedRatio >= 0.7 && brokenRatio === 0) return 'HIGH';
  if (verifiedRatio >= 0.4) return 'MEDIUM';
  return 'LOW';
}
```

### FUTURE-ARCHIVE.md Format
```markdown
# Future Archive

## Archived: D-03 -- Original Title
**Statement:** Original present-tense declaration
**Archived:** 2026-02-17
**Reason:** No longer true -- market shifted
**Replaced By:** D-05
**Status at Archive:** RENEGOTIATED

---

## Archived: D-01 -- Another Title
**Statement:** Another declaration
**Archived:** 2026-01-15
**Reason:** Scope reduced
**Replaced By:** (none)
**Status at Archive:** RENEGOTIATED
```

### Enriching Drift Output with Suggestions
```javascript
// Source: derived from existing graph traversal patterns
function findNearestConnections(dag, orphanId) {
  const node = dag.getNode(orphanId);
  const suggestions = [];

  if (node.type === 'action') {
    // Find milestones that sibling actions connect to
    const allMilestones = dag.getMilestones();
    for (const m of allMilestones) {
      const mActions = dag.getDownstream(m.id).filter(n => n.type === 'action');
      if (mActions.length > 0) {
        suggestions.push({
          type: 'connect',
          target: m.id,
          targetTitle: m.title,
          reason: `Milestone has ${mActions.length} existing actions`,
        });
      }
    }
  } else if (node.type === 'milestone') {
    // Find declarations as connection targets
    const allDeclarations = dag.getDeclarations();
    for (const d of allDeclarations) {
      suggestions.push({
        type: 'connect',
        target: d.id,
        targetTitle: d.title,
        reason: 'Active declaration',
      });
    }
  }

  return suggestions.slice(0, 3); // Limit suggestions
}
```

### Occurrence Check Data Provider
```javascript
// Source: derived from existing buildDagFromDisk and parseFutureFile patterns
function runCheckOccurrence(cwd, args) {
  const declarationId = parseFlag(args, 'declaration');
  const graphResult = buildDagFromDisk(cwd);
  if ('error' in graphResult) return graphResult;

  const { dag } = graphResult;
  const declaration = dag.getNode(declarationId);
  if (!declaration) return { error: `Declaration not found: ${declarationId}` };

  // Gather context for AI assessment
  const milestones = dag.getDownstream(declarationId)
    .filter(n => n.type === 'milestone');
  const actions = milestones.flatMap(m =>
    dag.getDownstream(m.id).filter(n => n.type === 'action')
  );

  return {
    declarationId,
    statement: declaration.metadata.statement || declaration.title,
    status: declaration.status,
    milestoneCount: milestones.length,
    milestones: milestones.map(m => ({
      id: m.id, title: m.title, status: m.status,
    })),
    actionSummary: {
      total: actions.length,
      completed: actions.filter(a => isCompleted(a.status)).length,
    },
    // AI uses this to ask: "Does this still occur as what we declared?"
  };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No drift detection | validate() finds orphans | Phase 3 (graph engine) | Foundation exists, needs UX layer |
| No performance concept | Integrity counts in status | Phase 5 | Integrity half of formula exists |
| Declarations immutable | (Phase 6 adds renegotiation) | Phase 6 | Enables declaration lifecycle |
| Status shows graph health only | (Phase 6 adds performance) | Phase 6 | Alignment visibility |

**Deprecated/outdated:**
- None. All existing code is current and well-maintained.

## Claude's Discretion Recommendations

### Occurrence Check Trigger Mechanism
**Recommendation:** Trigger occurrence checks at milestone completion (inside /declare:execute, after Step 4 marks milestone DONE). This is a natural checkpoint where the user has just completed meaningful work and can reflect on whether declarations still hold. Add a `lastChecked` timestamp to declaration metadata to avoid re-checking recently verified declarations (cooldown of 7 days).

**Rationale:** Checking at every action would be too frequent. Checking only on-demand would mean it never happens. Milestone completion is the sweet spot -- significant enough to warrant reflection, infrequent enough to avoid fatigue.

### AI Assessment Prompting for Semantic Drift
**Recommendation:** The slash command meta-prompt should receive the declaration statement, all connected milestones/actions with titles and statuses, and ask a focused question:

```
Given this declaration: "[statement]"
And these milestones/actions working toward it:
[list with titles and statuses]

Assessment questions:
1. Do all connected milestones genuinely advance this declaration?
2. Are any milestones connected by structure but not by intent?
3. Rate alignment: HIGH (all work serves declaration) / MEDIUM (some drift) / LOW (significant disconnect)
```

Keep the prompt short and focused. The CJS command provides the data; the slash command provides the judgment.

### Archive File Format and Naming
**Recommendation:** Use `FUTURE-ARCHIVE.md` in the `.planning/` directory, same level as `FUTURE.md`. Format: one `## Archived: D-XX` section per archived declaration with fields for Statement, Archived date, Reason, Replaced By, and Status at Archive. Simple, grep-friendly, human-readable.

### Orphaned Node Review Presentation
**Recommendation:** Present orphans grouped by their former parent milestone in the renegotiation output:

```
## Orphaned by Renegotiation of D-03

### Milestone M-05: "User onboarding flow"
- A-12: Design onboarding screens [PENDING]
- A-13: Implement welcome wizard [PENDING]

### Milestone M-06: "Analytics dashboard"
- A-14: Create dashboard layout [DONE]

Options per milestone:
1. Reassign to declaration D-XX
2. Archive milestone and its actions
3. Leave for now (will appear as drift in next check)
```

The user reviews one milestone group at a time, making decisions manageable rather than overwhelming.

## Open Questions

1. **Declaration metadata for statement field**
   - What we know: `parseFutureFile()` extracts `statement` as a top-level field on the declaration object. The graph engine stores it as part of the node's `metadata` object (or as a direct field).
   - What's unclear: Currently `addNode()` stores metadata as a generic object. The `statement` field may need explicit handling when adding declarations to the DAG to ensure it's accessible for occurrence checks.
   - Recommendation: Verify during implementation. If `statement` isn't in node metadata, add it in `buildDagFromDisk()` when creating declaration nodes: `dag.addNode(d.id, 'declaration', d.title, d.status, { statement: d.statement })`.

2. **Performance thresholds for qualitative labels**
   - What we know: User wants HIGH/MEDIUM/LOW only. The integrity formula uses factual counts.
   - What's unclear: Exact thresholds for converting structural coverage ratios to qualitative labels. Is 80% coverage HIGH? 50% MEDIUM?
   - Recommendation: Start with the thresholds in the code examples above (80%+ = HIGH, 50%+ = MEDIUM, below = LOW). Adjust based on real-world feel. These are internal implementation details, not user-facing, so easy to tune.

3. **Interaction between RENEGOTIATED status and existing VALID_STATUSES**
   - What we know: RENEGOTIATED is already in VALID_STATUSES in engine.js. It's used at the milestone level (Phase 5).
   - What's unclear: How does RENEGOTIATED apply to declarations? Currently declarations have PENDING status. Phase 6 needs declarations to transition to RENEGOTIATED before archival.
   - Recommendation: Set declaration status to RENEGOTIATED before archiving, then archive. This maintains audit trail in the graph before the node is removed to the archive file.

## Sources

### Primary (HIGH confidence)
- `src/graph/engine.js` - DeclareDag class, validate(), orphan detection, VALID_STATUSES, COMPLETED_STATUSES, isCompleted()
- `src/commands/trace.js` - traceUpward() for causation path walking
- `src/commands/status.js` - runStatus() with integrity aggregation and health computation
- `src/commands/build-dag.js` - buildDagFromDisk() for complete graph construction
- `src/commands/execute.js` - runExecute() for milestone execution data
- `src/commands/verify-milestone.js` - runVerifyMilestone() for truth verification
- `src/commands/verify-wave.js` - runVerifyWave() for post-wave checks
- `src/artifacts/future.js` - parseFutureFile(), writeFutureFile()
- `src/artifacts/verification.js` - parseVerificationFile(), writeVerificationFile()
- `src/artifacts/milestones.js` - parseMilestonesFile(), writeMilestonesFile()
- `src/artifacts/plan.js` - parsePlanFile(), writePlanFile()
- `src/declare-tools.js` - CLI dispatch pattern for subcommands
- `.claude/commands/declare/execute.md` - Execute slash command meta-prompt
- `.claude/commands/declare/status.md` - Status slash command meta-prompt

### Secondary (MEDIUM confidence)
- `esbuild.config.js` - Bundle configuration (single entry point, CJS output)
- `package.json` - Zero runtime dependencies, node:test for testing

### Tertiary (LOW confidence)
- Performance threshold calibration (80%/50% breakpoints) - needs validation with real project data

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Zero new dependencies, all built on existing node:* modules and project patterns
- Architecture: HIGH - All patterns directly derived from existing codebase (data provider CJS + meta-prompt orchestration)
- Pitfalls: HIGH - Derived from hands-on analysis of actual graph traversal behavior in the codebase

**Research date:** 2026-02-17
**Valid until:** 2026-03-19 (stable domain, no external dependency changes expected)
