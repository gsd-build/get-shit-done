---
name: gsdf:research-phase
description: Token-optimized phase research
argument-hint: "[phase]"
allowed-tools:
  - Read
  - Bash
  - Task
---

<objective>
Token-optimized version of `/gsd:research-phase`. Spawns researcher with lean prompts.

Note: For most workflows, use `/gsdf:plan-phase` which integrates research automatically.
</objective>

<process>

## Step 0: Resolve GSDF Model Profile

```bash
# GSDF uses model_profile_gsdf (falls back to model_profile, then "balanced")
MODEL_PROFILE=$(cat .planning/config.json 2>/dev/null | grep -o '"model_profile_gsdf"[[:space:]]*:[[:space:]]*"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"')
[ -z "$MODEL_PROFILE" ] && MODEL_PROFILE=$(cat .planning/config.json 2>/dev/null | grep -o '"model_profile"[[:space:]]*:[[:space:]]*"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"' || echo "balanced")
```

| Agent | quality | balanced | budget |
|-------|---------|----------|--------|
| gsd-phase-researcher | opus | sonnet | haiku |

## Step 1: Normalize and Validate Phase

```bash
# Normalize phase number (8 → 08, but preserve decimals like 2.1 → 02.1)
if [[ "$ARGUMENTS" =~ ^[0-9]+$ ]]; then
  PHASE=$(printf "%02d" "$ARGUMENTS")
elif [[ "$ARGUMENTS" =~ ^([0-9]+)\.([0-9]+)$ ]]; then
  PHASE=$(printf "%02d.%s" "${BASH_REMATCH[1]}" "${BASH_REMATCH[2]}")
else
  PHASE="$ARGUMENTS"
fi

grep -A5 "Phase ${PHASE}:" .planning/ROADMAP.md
```

If not found: Error and exit.

## Step 2: Check Existing Research

```bash
ls .planning/phases/${PHASE}-*/*-RESEARCH.md 2>/dev/null
```

If exists: Offer Update | View | Skip

## Step 3: Gather Phase Context

```bash
grep -A20 "Phase ${PHASE}:" .planning/ROADMAP.md
cat .planning/REQUIREMENTS.md 2>/dev/null
cat .planning/phases/${PHASE}-*/*-CONTEXT.md 2>/dev/null
grep -A30 "### Decisions Made" .planning/STATE.md 2>/dev/null
```

## Step 4: Spawn Researcher (Core Agent)

Research modes: ecosystem (default), feasibility, implementation, comparison.

```
Task(prompt="Research implementation approach for Phase {phase_number}: {phase_name}

Phase goal: {from ROADMAP}
Requirements: {mapped requirements}

Phase context (if exists):
IMPORTANT: If context exists, it contains user decisions from /gsd:discuss-phase.
- Decisions = LOCKED — research THESE deeply, don't explore alternatives
- Claude's Discretion = Your freedom — research options, make recommendations
- Deferred Ideas = Out of scope — ignore completely

{context_content}

Discover:
- Standard architecture pattern
- Recommended libraries (with versions)
- Common pitfalls to avoid
- What NOT to hand-roll

Write to: .planning/phases/${PHASE}-{slug}/${PHASE}-RESEARCH.md

Format:
---
phase: XX-name
researched: [timestamp]
confidence: HIGH/MEDIUM/LOW
---
# Phase {X} Research
## Standard Stack
| Library | Version | Purpose | Why |
## Architecture Patterns
[pattern with code example]
## Don't Hand-Roll
| Need | Use | Why |
## Common Pitfalls
### Pitfall: [Name]
What goes wrong: [description]
Prevention: [how to avoid]
## Sources
- [URLs with confidence]

<downstream_consumer>
Your RESEARCH.md will be loaded by `/gsd:plan-phase` which uses specific sections:
- `## Standard Stack` → Plans use these libraries
- `## Architecture Patterns` → Task structure follows these
- `## Don't Hand-Roll` → Tasks NEVER build custom solutions for listed problems
- `## Common Pitfalls` → Verification steps check for these
- `## Code Examples` → Task actions reference these patterns

Be prescriptive, not exploratory. 'Use X' not 'Consider X or Y.'
</downstream_consumer>

<quality_gate>
Before declaring complete, verify:
- [ ] All domains investigated (not just some)
- [ ] Negative claims verified with official docs
- [ ] Multiple sources for critical claims
- [ ] Confidence levels assigned honestly
- [ ] Section names match what plan-phase expects
</quality_gate>

<research_methodology>
Treat pre-existing knowledge as hypothesis. Verify before asserting.
Tool strategy: Context7 first for libraries, WebFetch for official docs, WebSearch for ecosystem discovery.
Confidence: HIGH = Context7/official docs, MEDIUM = WebSearch + official verify, LOW = WebSearch only.
Flag uncertainty honestly: "couldn't find X" and "LOW confidence" are valuable findings.
</research_methodology>

Return: RESEARCH COMPLETE with summary
", subagent_type="gsd-phase-researcher", model="{researcher_model}", description="Research Phase {phase}")
```

## Step 5: Handle Return

**RESEARCH COMPLETE:**
- Display summary
- Offer: Plan phase | Dig deeper | Review full | Done

**CHECKPOINT REACHED:**
- Present to user
- Get response
- Spawn continuation (see step 6)

**RESEARCH INCONCLUSIVE:**
- Show what was attempted
- Offer: Add context | Different mode | Manual

## Step 6: Spawn Continuation Agent (After Checkpoint)

```markdown
<objective>
Continue research for Phase {phase_number}: {phase_name}
</objective>

<prior_state>
Research file: @.planning/phases/${PHASE}-{slug}/${PHASE}-RESEARCH.md
</prior_state>

<checkpoint_response>
**Type:** {checkpoint_type}
**Response:** {user_response}
</checkpoint_response>
```

```
Task(
  prompt=continuation_prompt,
  subagent_type="gsd-phase-researcher",
  model="{researcher_model}",
  description="Continue research Phase {phase}"
)
```

## Step 7: Commit Research

Check `COMMIT_PLANNING_DOCS` from config.json:
```bash
COMMIT_PLANNING_DOCS=$(cat .planning/config.json 2>/dev/null | grep -o '"commit_docs"[[:space:]]*:[[:space:]]*[^,}]*' | grep -o 'true\|false' || echo "true")
git check-ignore -q .planning 2>/dev/null && COMMIT_PLANNING_DOCS=false
```

If `COMMIT_PLANNING_DOCS=true`:
```bash
git add "${PHASE_DIR}"/*-RESEARCH.md && git commit -m "docs(phase-${PHASE}): research complete"
```

</process>

<success_criteria>
- [ ] Phase validated (including decimal phases)
- [ ] Existing research checked
- [ ] Researcher spawned with downstream_consumer + quality_gate
- [ ] RESEARCH.md created with expected section names
- [ ] Checkpoints handled with continuation template
- [ ] User knows next steps
</success_criteria>
