# Spike Execution Reference

## 1. Overview

**Purpose:** Defines spike workflow phases, types, success criteria patterns, iteration rules, and KB integration for structured experimentation that resolves design uncertainty.

**Core Principle:** Spikes produce FINDINGS, not DECISIONS. Existing GSD layers (CONTEXT.md for user decisions, RESEARCH.md for technical recommendations) make decisions based on spike findings. The spike's job is to gather empirical evidence; the decision emerges from that evidence through established GSD flows.

**One Spike = One Question:** Each spike answers a single question. Comparative questions ("Should we use A, B, or C?") are one spike with multiple experiments, not multiple spikes.

**Consumers:**
- `gsd-spike-runner` agent (executes Build/Run/Document phases)
- `/gsd:spike` command (standalone spike invocation)
- `plan-phase.md` orchestrator (triggers spikes after research identifies gaps)
- `new-project.md` orchestrator (triggers spikes during project initialization)

---

## 2. Spike Types

| Type | When to Use | Success Criteria Pattern |
|------|-------------|--------------------------|
| **Binary** | Yes/no feasibility questions | Clear threshold defined upfront (e.g., "latency < 100ms", "memory < 512MB") |
| **Comparative** | Choose between known options | Metrics to compare across options, winner criteria defined (e.g., "fastest wins", "simplest with acceptable perf wins") |
| **Exploratory** | Understand a space | Learning goals defined, can refine during spike as understanding grows |
| **Open Inquiry** | Questions that don't fit above | Flexible structure, Claude's discretion on experiment design |

**Choosing the right type:**
- If answer is yes/no → Binary
- If answer is "A, B, or C" → Comparative
- If answer is "what exists?" or "how does X work?" → Exploratory
- If unsure → Open Inquiry (Claude adapts structure to question)

### Spike Modes

| Mode | Phases | Output | Use Case |
|------|--------|--------|----------|
| **full** (default) | Design -> Build -> Run -> Document | DESIGN.md, FINDINGS.md (optional), DECISION.md, experiments/ | Questions requiring empirical measurement |
| **research** | Design -> Research -> Document | DESIGN.md, DECISION.md | Questions answerable through documentation and codebase analysis |

**Research mode** skips BUILD and RUN phases entirely. Instead of running experiments, the spike investigates the question through codebase analysis, documentation lookup, and web research. The `mode: research` flag appears in DESIGN.md frontmatter. DECISION.md is produced from research findings rather than experimental data.

**Research-mode spikes do NOT produce:**
- `experiments/` directory
- `FINDINGS.md`

**Research-mode spikes still produce:**
- `DESIGN.md` (documents the question)
- `DECISION.md` (documents the answer with `Iterations: 0 (research-only)`)
- KB entry (persists the finding)

---

## 3. Spike Phases

### Design Phase (Cognitive)

**Input:** Open Question from RESEARCH.md or user-provided question via `/gsd:spike`

**Process:**
- Define testable hypothesis
- Establish success criteria with measurable thresholds
- Create experiment plan (what to build, what to measure)

**Output:** `.planning/spikes/{index}-{slug}/DESIGN.md`

**Mode:** Hybrid
- **Interactive:** Orchestrator drafts DESIGN.md, user reviews and confirms
- **YOLO:** Orchestrator drafts DESIGN.md, auto-approves and proceeds

**Executor:** NOT the spike-runner agent. The orchestrator (plan-phase.md, new-project.md, or /gsd:spike command) handles the Design phase.

### Build Phase (Implementation)

**Input:** DESIGN.md experiment plan

**Process:**
- Implement experiment scaffolding in spike workspace
- Create test harnesses, measurement infrastructure
- Build variations for comparative spikes

**Output:** Working experiment code in spike workspace

**Mode:** Agent-driven (gsd-spike-runner)

**Principles:**
- Keep code minimal -- throwaway is fine
- No modification to main project files
- All experiment code lives in spike workspace

### Run Phase (Execution)

**Input:** Built experiments

**Process:**
- Execute each experiment per the plan
- Gather data, metrics, observations
- Measure results against success criteria

**Output:** FINDINGS.md (optional, for complex spikes with lots of data)

**Mode:** Agent-driven (gsd-spike-runner)

**FINDINGS.md Guidance:** Create only when experiments produce substantial data that would clutter DECISION.md. For simple spikes, experiment results go directly into DECISION.md.

### Document Phase (Synthesis)

**Input:** Experiment results

**Process:**
- Analyze findings against hypothesis
- Form conclusion based on evidence
- Document decision with rationale

**Output:** DECISION.md (mandatory)

**Mode:** Agent-driven (gsd-spike-runner)

---

## 4. Workspace Isolation (SPKE-04)

**Spike workspace:** `.planning/spikes/{index}-{slug}/`

**Naming convention:**
- **Index:** 3-digit sequential (001, 002, 003...)
- **Slug:** kebab-case derived from question, user can adjust in interactive mode

**Example:** `.planning/spikes/003-jwt-refresh-strategy/`

**Isolation rules:**
- All spike artifacts contained within workspace directory
- Experiment code lives in spike workspace
- No modification to main project files during spike execution
- Code is throwaway -- not merged into main codebase

**Directory structure:**
```
.planning/spikes/
├── 001-ocr-library-handwritten/
│   ├── DESIGN.md
│   ├── FINDINGS.md    (optional)
│   ├── DECISION.md
│   └── experiments/   (throwaway code)
├── 002-realtime-processing/
│   ├── DESIGN.md
│   └── DECISION.md
```

---

## 5. Iteration Rules (SPKE-06, SPKE-07)

**Maximum 2 rounds per spike** -- prevents rabbit holes while allowing refinement.

### Round 1 Inconclusive

When Round 1 doesn't produce a clear answer:

1. **Agent proposes narrowed hypothesis**
   - Focus on the most uncertain aspect
   - Tighten success criteria if they were too broad
   - Reduce experiment scope if too ambitious

2. **Confirmation**
   - **Interactive:** Checkpoint for user approval of Round 2 plan
   - **YOLO:** Auto-proceed with narrowed scope

3. **Round 2 executes** with focused scope

### Round 2 Inconclusive

When Round 2 also doesn't produce a clear answer:

1. **Document honestly:** "No clear winner"
2. **Decision becomes:** Proceed with default/simplest approach
3. **Still valuable:** Learned there's no empirical differentiator
4. **Outcome field:** `inconclusive`

### Status Tracking

Track iteration state in DESIGN.md frontmatter:

```yaml
---
status: designing | building | running | complete | inconclusive
round: 1 | 2
---
```

---

## 6. DECISION.md Requirements (SPKE-05)

DECISION.md is the primary output of every spike. It must contain a decision, not just a report.

**Mandatory fields:**

| Field | Description |
|-------|-------------|
| Question | The Open Question being answered |
| Answer | One-line decision (the actual answer) |
| Chosen approach | What was decided |
| Rationale | Why, based on evidence |
| Confidence | HIGH, MEDIUM, or LOW |

**Confidence levels:**
- **HIGH:** Strong empirical evidence, clear winner, reproducible results
- **MEDIUM:** Some evidence with inference, slight winner, some uncertainty
- **LOW:** Limited data, educated guess, multiple viable options

**Valid inconclusive decisions:**
- "No clear winner, using default" IS a valid decision
- "All options equivalent, using simplest" IS a valid decision
- Document the reasoning, even if the answer is "doesn't matter"

---

## 7. Sensitivity Settings

Control which gaps trigger spikes based on criticality.

| Setting | What Gets Spiked | Use Case |
|---------|------------------|----------|
| **Conservative** | Only Critical gaps | Ship fast, spike only blockers |
| **Balanced** | Critical + Medium gaps | Default, reasonable coverage |
| **Aggressive** | Any genuine gap | Thorough validation, frontier work |

**Derivation from depth (default):**
- `depth: quick` → `spike_sensitivity: conservative`
- `depth: standard` → `spike_sensitivity: balanced`
- `depth: comprehensive` → `spike_sensitivity: aggressive`

**Override:** Can be set explicitly in `.planning/config.json`:
```json
{
  "depth": "standard",
  "spike_sensitivity": "aggressive"
}
```

**Interaction with autonomy:**

| Sensitivity | Mode | Behavior |
|-------------|------|----------|
| Conservative | YOLO | Auto-spike Critical only |
| Conservative | Interactive | Ask only for Critical |
| Balanced | YOLO | Auto-spike Critical + Medium |
| Balanced | Interactive | Ask for Critical + Medium |
| Aggressive | YOLO | Auto-spike all genuine gaps |
| Aggressive | Interactive | Ask for all genuine gaps |

---

## 8. KB Integration (SPKE-09)

After spike completion, persist results to the Knowledge Base.

**Steps:**

1. **Create spike entry** at `~/.gsd/knowledge/spikes/{project}/`

2. **Use spike body template** from knowledge-store.md:
   ```yaml
   ---
   id: spk-{YYYY-MM-DD}-{slug}
   type: spike
   project: {project-name}
   tags: [{derived-from-question}]
   created: {timestamp}
   updated: {timestamp}
   durability: {workaround|convention|principle}
   status: active
   hypothesis: "{from DESIGN.md}"
   outcome: {confirmed|rejected|partial|inconclusive}
   rounds: {1|2}
   ---
   ```

3. **Frontmatter fields:**
   - `hypothesis`: Copy from DESIGN.md
   - `outcome`: Result of the spike (confirmed/rejected/partial/inconclusive)
   - `rounds`: Number of iteration rounds conducted
   - `tags`: Derive from question keywords

4. **Body content:** Copy key sections from DECISION.md:
   - Hypothesis
   - Experiment summary
   - Results summary
   - Decision
   - Consequences/implications

5. **Rebuild KB index:** Run `bash ~/.gsd/bin/kb-rebuild-index.sh`

---

## 9. Spike Dependencies

Spikes can depend on other spikes via `depends_on` in DESIGN.md.

**Syntax in DESIGN.md:**
```markdown
**Depends on:** 001-framework-choice
```

**Behavior:**
- Dependent spikes run after their dependencies complete
- Orchestrator enforces sequential execution for dependent spikes
- Dependency spike's DECISION.md informs dependent spike's DESIGN.md

**Guidance:** If dependency chains are complex, it's probably one bigger spike with multiple experiments. Complex dependencies are a smell -- consider restructuring.

---

## 10. Anti-Patterns

### Scope Creep
**Symptom:** Trying to answer multiple unrelated questions in one spike.
**Fix:** Split into separate spikes. One spike = one question.

### Analysis Paralysis
**Symptom:** More than 2 iteration rounds. Endless refinement.
**Fix:** Force a decision at Round 2. "Inconclusive" is a valid outcome.

### Gold Plating
**Symptom:** Over-engineering experiment infrastructure. Building production-quality code.
**Fix:** Keep it minimal. Throwaway code is fine. The goal is data, not elegance.

### Missing Decision
**Symptom:** DECISION.md that reads like a report without a clear decision.
**Fix:** Always commit to a decision. "Use the default" or "doesn't matter" are valid decisions.

### Premature Spiking
**Symptom:** Running spikes for questions that normal research could answer.
**Fix:** Research first. Spike only for genuine gaps that research couldn't resolve.

### Spike Sprawl
**Symptom:** Many small spikes that could be experiments within one spike.
**Fix:** Group related experiments. Comparative questions are one spike.

---

## 11. Checkpoint Behaviors

### Checkpoint on Deviation

If experiment doesn't work as planned, spike-runner checkpoints for guidance:
- Build fails unexpectedly
- Experiment produces dramatically different results
- Success criteria ambiguous in practice
- Discovered larger problem than anticipated

### Interactive vs YOLO

| Phase | Interactive | YOLO |
|-------|-------------|------|
| Design | User confirms DESIGN.md before Build | Auto-approve DESIGN.md |
| Round 1 Inconclusive | Checkpoint for approval | Auto-proceed with narrowed scope |
| Deviation | Always checkpoint | Checkpoint (deviations are unexpected) |

**YOLO Mode Boundaries:** Even in YOLO mode, checkpoints occur for:
- Major deviations from expected behavior
- Discovered problems that affect project scope
- Ambiguous success criteria that require clarification

---

*Reference version: 1.0.0*
*Created: 2026-02-05*
*Phase: 03-spike-runner*
