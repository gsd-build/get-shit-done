# Run Spike Workflow

Orchestrates the full spike flow: workspace creation, Design phase (DESIGN.md), agent spawn for Build/Run/Document, and RESEARCH.md integration.

## References

@get-shit-done/references/spike-execution.md
@.claude/agents/gsd-spike-runner.md
@.claude/agents/kb-templates/spike-design.md
@.claude/agents/kb-templates/spike-decision.md
@.claude/agents/knowledge-store.md

## Inputs

| Input | Source | Required |
|-------|--------|----------|
| question | /gsd:spike argument or user prompt | yes |
| phase | /gsd:spike --phase argument | no |
| mode | .planning/config.json "mode" field | no (default: interactive) |
| sensitivity | .planning/config.json "spike_sensitivity" or derived from depth | no |
| spike_mode | --mode argument or research-first advisory selection | no (default: full) |

## Execution Flow

### 1. Parse Inputs

```bash
# Get question from argument or prompt
QUESTION="${1:-}"
if [ -z "$QUESTION" ]; then
  # Interactive: prompt user for question
  echo "What question would you like to investigate?"
  read QUESTION
fi

# Get phase linkage
PHASE="${2:-project-level}"

# Get mode
MODE=$(cat .planning/config.json 2>/dev/null | grep -o '"mode"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4)
MODE="${MODE:-interactive}"
```

### 2. Research-First Advisory

Before creating a workspace or drafting DESIGN.md, assess whether the question is better suited to research or experimentation.

**Research indicators** (question may not need a spike):
- Asks about capabilities, features, or API support ("Does X support Y?")
- Answer likely exists in official documentation or changelogs
- Asks WHAT exists rather than HOW it performs empirically
- No measurement under specific conditions is needed

**Spike indicators** (question genuinely needs experimentation):
- Requires empirical measurement ("Is X faster than Y for our workload?")
- Depends on conditions that documentation cannot address
- Tests performance, reliability, or compatibility under specific constraints
- Official documentation is ambiguous or contradictory

**If mode == interactive AND question appears research-suitable:**

Present advisory to user:

```
This question may be answerable through documentation research rather
than empirical experimentation. The spike anti-pattern "Premature Spiking"
(spike-execution.md Section 10) warns against running spikes for questions
that normal research could resolve.

Options:
1. Proceed with spike (you know your intent best)
2. Cancel -- try research first (/gsd:research-phase)
3. Rephrase question to focus on the empirical aspect
4. Run as lightweight research spike (Question -> Research -> Decision, no BUILD/RUN)

Select [1/2/3/4]:
```

If user selects 1: proceed to workspace creation.
If user selects 2: exit workflow, suggest `/gsd:research-phase`.
If user selects 3: prompt for rephrased question, restart from Step 1.
If user selects 4: set SPIKE_MODE='research', proceed to workspace creation.

**If mode == yolo OR question appears spike-suitable:**

Log a brief one-line assessment ("Question assessed as spike-suitable, proceeding to design") and continue. Do NOT present a checkpoint or pause.

**Note:** This advisory only applies to standalone `/gsd:spike` invocations. Orchestrator-triggered spikes (via plan-phase) already have research-before-spike flow from spike-integration.md.

### 3. Create Workspace

```bash
# Find next index
EXISTING=$(ls -d .planning/spikes/[0-9][0-9][0-9]-* 2>/dev/null | wc -l | tr -d ' ')
NEXT_INDEX=$(printf "%03d" $((EXISTING + 1)))

# Generate slug from question
SLUG=$(echo "$QUESTION" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//;s/-$//' | cut -c1-40)

# Create workspace
WORKSPACE=".planning/spikes/${NEXT_INDEX}-${SLUG}"
mkdir -p "$WORKSPACE"
```

### 4. Draft DESIGN.md (Design Phase)

Using the spike-design template, create DESIGN.md with:

- **Question:** {from input}
- **Type:** Infer from question patterns:
  - "Which/what/best" -> Comparative
  - "Can/is/does/will" -> Binary
  - "How does/why/explore" -> Exploratory
  - Other -> Open Inquiry (user can adjust)
- **Hypothesis:** Draft initial hypothesis from question
- **Success Criteria:** Draft measurable criteria based on type
- **Experiment Plan:** Draft 2-3 experiments

Write to `$WORKSPACE/DESIGN.md`.

### 5. User Confirmation (Interactive Mode)

**If mode == interactive:**

Present DESIGN.md to user:

```markdown
## SPIKE DESIGN

**Workspace:** {workspace path}
**Question:** {question}
**Type:** {inferred type}

### Hypothesis

{drafted hypothesis}

### Success Criteria

{drafted criteria}

### Experiment Plan

{drafted experiments}

---

**Options:**
1. Approve and proceed to Build phase
2. Edit DESIGN.md (opens for modification)
3. Cancel spike

Select [1/2/3]:
```

Wait for user response. If option 2, allow edits, then re-present.

**If mode == yolo:**

Auto-approve DESIGN.md, proceed immediately.

### 5b. Lightweight Research Mode

**If SPIKE_MODE == "research":**

Skip Step 6 (do NOT spawn gsd-spike-runner for BUILD/RUN phases).

Instead, perform research inline:
1. Add `mode: research` to DESIGN.md frontmatter
2. Investigate the question using available tools:
   - Codebase analysis (Grep, Glob, Read)
   - Web research (WebSearch, WebFetch)
   - Documentation lookup (Context7 if available)
3. Gather evidence to answer the question
4. Create DECISION.md in the spike workspace using the standard template from spike-execution.md Section 6
   - Question, Answer, Summary, Findings (from research), Analysis, Decision, Confidence, Implications
   - Set metadata: `Iterations: 0 (research-only)`
5. Update DESIGN.md status to `complete`
6. Proceed to KB persistence (same as Step 7 result handling, but with outcome from research)
7. Continue to Step 8 (Update RESEARCH.md if phase-linked) and Step 9 (Report)

**IMPORTANT:** The lightweight mode still creates:
- DESIGN.md (documents the question)
- DECISION.md (documents the answer)
- KB entry (persists the finding)

It does NOT create:
- experiments/ directory
- FINDINGS.md

### 6. Spawn Spike Runner Agent

```markdown
**Spawning gsd-spike-runner agent**

@.claude/agents/gsd-spike-runner.md

Execute Build -> Run -> Document phases for:
- Workspace: {workspace path}
- DESIGN.md: {workspace}/DESIGN.md

Return when complete with outcome and decision summary.
```

### 7. Handle Agent Result

Parse agent output:
- outcome: confirmed | rejected | partial | inconclusive
- decision: one-line summary
- kb_entry: path to KB spike entry

### 8. Update RESEARCH.md (If Phase-Linked)

**If phase was specified:**

Read `{PHASE_DIR}/*-RESEARCH.md` and add/update "Resolved by Spike" section:

```markdown
## Open Questions

### Resolved by Spike

1. **{Question}**
   - Decision: {one-line answer from DECISION.md}
   - Evidence: {brief summary}
   - Full analysis: {path to DECISION.md}
   - Confidence: {HIGH|MEDIUM|LOW}
```

If RESEARCH.md doesn't exist yet, note that spike resolution should be added when it's created.

### 9. Report Result

```markdown
## SPIKE COMPLETE

**Spike:** {index}-{slug}
**Outcome:** {outcome}
**Decision:** {one-line decision}

### Artifacts

- Workspace: {workspace path}
- DESIGN.md: {workspace}/DESIGN.md
- DECISION.md: {workspace}/DECISION.md
- KB Entry: {kb_entry path}

{If phase-linked:}
### Integration

RESEARCH.md updated with spike resolution at:
{phase RESEARCH.md path}
```

## Error Handling

- **No .planning/ directory:** Error - run from project root with GSD initialized
- **Agent checkpoint:** Surface to user, await guidance
- **KB write failure:** Log warning, spike artifacts still valid in workspace

## Mode Behaviors

| Mode | Design Confirmation | BUILD/RUN | DECISION.md |
|------|---------------------|-----------|-------------|
| full (default) | User confirms (interactive) / auto (yolo) | Yes | From experiments |
| research | User confirms (interactive) / auto (yolo) | Skipped | From research |

### Inconclusive Handling (Full Mode Only)

| Mode | Inconclusive Round 1 |
|------|----------------------|
| interactive | Checkpoint for narrowing approval |
| yolo | Auto-proceed with agent's narrowed hypothesis |

## Sensitivity Behaviors

Sensitivity affects spike triggering from orchestrators (plan-phase, new-project), not this manual command. /gsd:spike always runs the requested spike regardless of sensitivity setting.
