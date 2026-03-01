# Spike Integration Reference

Specifies where and how to add spike decision points to GSD orchestrators. This document enables orchestrators to read and apply spike integration without modifying their core files.

## Overview

The spike decision point is a step that runs AFTER research completes and BEFORE planning/requirements. It checks for genuine gaps (questions that research couldn't answer) and triggers spikes when appropriate.

**Integration pattern:** Additive step insertion. The spike decision point is a new step added between existing steps, not a modification of existing steps.

**Fork compatibility:** Orchestrators check for this reference doc. If it exists, they apply the spike decision point. If it doesn't exist (upstream GSD), they skip it.

## Open Questions Flow

```
MARK (during Q&A or discuss-phase)
       |
       |  User or system identifies uncertainty
       |  Captured in PROJECT.md or CONTEXT.md
       |
       v
VERIFY (during research)
       |
       |  Researcher reads Open Questions
       |  Attempts to resolve through normal research
       |  Reports outcome in RESEARCH.md
       |
       v
+--------------------------------------+
| SPIKE DECISION POINT                 | <-- THIS IS THE INTEGRATION POINT
|                                      |
| Check RESEARCH.md for Genuine Gaps   |
| Apply sensitivity filter             |
| Apply autonomy mode                  |
| Trigger spikes if approved           |
| Update RESEARCH.md with resolutions  |
+--------------------------------------+
       |
       v
PLAN (planner reads updated RESEARCH.md)
```

## Open Questions Schema

For artifacts that capture Open Questions (PROJECT.md, CONTEXT.md):

```markdown
## Open Questions

| Question | Why It Matters | Criticality | Status |
|----------|----------------|-------------|--------|
| [Clear question] | [Impact if wrong] | Critical/Medium/Low | Pending |
```

For RESEARCH.md (post-verification):

```markdown
## Open Questions

### Resolved
- {Question}: {How research answered it}

### Genuine Gaps
| Question | Criticality | Recommendation |
|----------|-------------|----------------|
| {Question} | Critical/Medium/Low | Spike/Defer/Accept-risk |

### Resolved by Spike
1. **{Question}**
   - Decision: {one-line answer}
   - Evidence: {brief summary}
   - Full analysis: {path to DECISION.md}
   - Confidence: {HIGH|MEDIUM|LOW}

### Still Open
- {Questions that couldn't be resolved - flagged for attention}
```

## plan-phase Integration

### Where to Insert

After research completes (Step 5 in standard plan-phase flow), before planning begins:

```
Step 5: Research completes, RESEARCH.md created
        |
        v
Step 5.5: SPIKE DECISION POINT (NEW)
        |
        v
Step 6: Planner runs with updated RESEARCH.md
```

### Integration Logic

```markdown
## 5.5. Handle Spike Decision Point

**Check for genuine gaps:**

Read `{PHASE_DIR}/*-RESEARCH.md`. Look for "### Genuine Gaps" section.

If no Genuine Gaps section or section is empty: proceed to planning.

If Genuine Gaps exist:

1. **Parse gaps:**
   ```
   For each gap in Genuine Gaps table:
     - question: the question text
     - criticality: Critical | Medium | Low
     - recommendation: Spike | Defer | Accept-risk
   ```

2. **Apply sensitivity filter:**
   ```
   sensitivity = config.spike.sensitivity OR derive from config.depth

   - conservative: only process Critical gaps with Spike recommendation
   - balanced: process Critical + Medium gaps with Spike recommendation
   - aggressive: process all gaps with Spike recommendation
   ```

3. **Apply autonomy mode:**
   ```
   mode = config.mode

   - interactive: present filtered gaps, ask user which to spike
   - yolo: auto-spike all filtered gaps
   ```

4. **Execute spikes:**
   ```
   For each approved spike:
     Invoke get-shit-done/workflows/run-spike.md with:
       - question: gap.question
       - phase: current phase number
   ```

5. **Proceed to planning:**

   RESEARCH.md now contains "Resolved by Spike" entries.
   Planner treats these as locked decisions.
```

### Planner Instruction Addition

When planner reads RESEARCH.md, it should treat spike resolutions as locked decisions:

```markdown
## Reading RESEARCH.md

**Spike Resolutions:** If RESEARCH.md contains "Resolved by Spike" entries,
treat these as locked decisions (same weight as CONTEXT.md user decisions).
Spikes produced empirical evidence -- don't second-guess them.
```

## new-project Integration

### Where to Insert

After project research completes, before requirements definition:

```
Step: Project research completes (4 parallel researchers), SUMMARY.md created
        |
        v
Step: SPIKE DECISION POINT (NEW)
        |
        v
Step: Requirements definition with updated research
```

### Integration Logic

Similar to plan-phase, but reading from project research SUMMARY.md instead of phase RESEARCH.md:

```markdown
## Handle Spike Decision Point (Project Level)

**Check research summary for genuine gaps:**

Read `.planning/research-project/SUMMARY.md`. Look for "Open Questions" section with "Genuine Gaps" subsection.

If no gaps: proceed to requirements.

If gaps exist: apply same sensitivity/autonomy logic as plan-phase.

**Spike workspace naming:**
- Project-level spikes: originating_phase: "project-level"
- No phase RESEARCH.md to update
- Results inform requirements definition directly
```

## Sensitivity Decision Matrix

| Sensitivity | Autonomy | Behavior |
|-------------|----------|----------|
| Conservative | YOLO | Auto-spike Critical gaps only |
| Conservative | Interactive | Ask only for Critical gaps |
| Balanced | YOLO | Auto-spike Critical + Medium gaps |
| Balanced | Interactive | Ask for Critical + Medium gaps |
| Aggressive | YOLO | Auto-spike all genuine gaps |
| Aggressive | Interactive | Ask for all genuine gaps |

**Deriving sensitivity from depth:**
- depth: quick -> spike.sensitivity: conservative
- depth: standard -> spike.sensitivity: balanced
- depth: comprehensive -> spike.sensitivity: aggressive

Explicit `spike.sensitivity` in config.json overrides derivation.

## Plan-Checker Addition

The plan-checker should verify spike decision compliance:

```markdown
## Verification Dimensions

### Spike Decision Compliance

If spike decisions exist for this phase:
- [ ] Plan uses approaches chosen by spikes
- [ ] No contradiction with empirical conclusions
- [ ] Spike decisions referenced where relevant

**Flag example:** "Plan uses Library A, but spike finding chose Library B"
```

## Template Updates

### PROJECT.md Template Addition

Add to project.md template:

```markdown
## Open Questions

| Question | Why It Matters | Criticality | Status |
|----------|----------------|-------------|--------|
| {Question 1} | {Impact} | {Critical/Medium/Low} | Pending |

{Capture uncertainties during project Q&A. Research phase will attempt to resolve.}
```

### CONTEXT.md Template Addition

Add to context.md template:

```markdown
## Open Questions

| Question | Why It Matters | Criticality | Status |
|----------|----------------|-------------|--------|
| {Question 1} | {Impact} | {Critical/Medium/Low} | Pending |

{Capture uncertainties during phase discussion. Research will attempt to resolve.}
```

### RESEARCH.md Template Addition

Add to research.md template:

```markdown
## Open Questions

### Resolved
- {Question}: {How research answered it}

### Genuine Gaps
| Question | Criticality | Recommendation |
|----------|-------------|----------------|
| {Question} | {Critical/Medium/Low} | {Spike/Defer/Accept-risk} |

### Resolved by Spike
{Populated by orchestrator after spike completes}

### Still Open
{Questions that couldn't be resolved}
```

## Orchestrator Detection Pattern

Orchestrators can check if spike integration should be applied:

```bash
# Check if spike integration exists
if [ -f "get-shit-done/references/spike-integration.md" ]; then
  # Apply spike decision point logic
  # Read this reference for integration steps
else
  # Standard flow without spike decision point
  # (upstream GSD without reflect fork)
fi
```

This pattern maintains compatibility with upstream GSD while enabling spike integration in the fork.

---

*Reference version: 1.0.0*
*Created: Phase 03-spike-runner*
