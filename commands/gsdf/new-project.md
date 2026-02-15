---
name: gsdf:new-project
description: Token-optimized project initialization with conditional skill loading
allowed-tools:
  - Read
  - Bash
  - Write
  - Task
  - AskUserQuestion
---

<objective>
Token-optimized version of `/gsd:new-project`. Uses core agents with conditional skills.

Creates same outputs:
- `.planning/PROJECT.md`
- `.planning/config.json`
- `.planning/research/` (optional)
- `.planning/REQUIREMENTS.md`
- `.planning/ROADMAP.md`
- `.planning/STATE.md`
</objective>

<token_optimization>
| Component | Full GSD | GSDF |
|-----------|----------|----------|
| Researcher prompts | Full templates inline | Core agent + conditional skills |
| Roadmapper | Full planning context | Core methodology only |
| Reference files | Always loaded | Loaded only when needed |
</token_optimization>

<process>

## Phase 1: Setup (same as full)

1. **Abort if project exists:**
   ```bash
   [ -f .planning/PROJECT.md ] && echo "ERROR: Project already initialized. Use /gsd:progress" && exit 1
   ```

2. **Initialize git:**
   ```bash
   [ -d .git ] || [ -f .git ] || git init
   ```

3. **Brownfield detection:**
   ```bash
   CODE_FILES=$(find . -name "*.ts" -o -name "*.js" -o -name "*.py" -o -name "*.go" -o -name "*.rs" -o -name "*.swift" -o -name "*.java" 2>/dev/null | grep -v node_modules | grep -v .git | head -20)
   HAS_PACKAGE=$([ -f package.json ] || [ -f requirements.txt ] || [ -f Cargo.toml ] || [ -f go.mod ] || [ -f Package.swift ] && echo "yes")
   HAS_CODEBASE_MAP=$([ -d .planning/codebase ] && echo "yes")
   ```

If existing code detected and no codebase map:
- Offer `/gsdf:map-codebase` first

## Phase 2: Deep Questioning

Ask "What do you want to build?" and follow threads naturally.

Core questions to cover:
- What problem does this solve?
- Who is the user?
- What's the core value (one thing that must work)?
- What's explicitly out of scope?

Continue until you can write a clear PROJECT.md.

## Phase 3: Write PROJECT.md

**For greenfield projects:**

Create `.planning/PROJECT.md` with:
- What This Is
- Core Value
- Requirements (Active as hypotheses, Out of Scope)
- Key Decisions

**For brownfield projects (codebase map exists):**

Infer Validated requirements from existing code:
1. Read `.planning/codebase/ARCHITECTURE.md` and `STACK.md`
2. Identify what the codebase already does
3. These become the initial Validated set

```markdown
## Requirements

### Validated

- ✓ [Existing capability 1] — existing
- ✓ [Existing capability 2] — existing

### Active

- [ ] [New requirement 1]
- [ ] [New requirement 2]
```

Commit: `docs: initialize project`

## Phase 4: Workflow Preferences

Use AskUserQuestion with 4 questions:
1. Mode: YOLO vs Interactive
2. Depth: Quick vs Standard vs Comprehensive
3. Execution: Parallel vs Sequential
4. Git Tracking: Yes vs No

Then 4 more:
1. Research: Yes vs No
2. Plan Check: Yes vs No
3. Verifier: Yes vs No
4. Model Profile: Quality vs Balanced vs Budget

Create `.planning/config.json`

## Phase 5: Resolve GSDF Model Profile

```bash
# GSDF uses model_profile_gsdf (falls back to model_profile, then "balanced")
MODEL_PROFILE=$(cat .planning/config.json 2>/dev/null | grep -o '"model_profile_gsdf"[[:space:]]*:[[:space:]]*"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"')
[ -z "$MODEL_PROFILE" ] && MODEL_PROFILE=$(cat .planning/config.json 2>/dev/null | grep -o '"model_profile"[[:space:]]*:[[:space:]]*"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"' || echo "balanced")
```

**Lite model lookup:**

| Agent | quality | balanced | budget |
|-------|---------|----------|--------|
| gsd-project-researcher | opus | sonnet | haiku |
| gsd-research-synthesizer | sonnet | haiku | haiku |
| gsd-roadmapper | opus | sonnet | sonnet |

## Phase 6: Research Decision

If "Research first" selected:

```bash
mkdir -p .planning/research
```

Spawn 4 parallel researchers using **core agent** prompts:

```
Task(prompt="Research the standard 2026 stack for [domain].

Focus: What libraries, versions, and patterns are standard?

<downstream_consumer>
Your STACK.md feeds into roadmap creation. Be prescriptive:
- Specific libraries with versions
- Clear rationale for each choice
- What NOT to use and why
</downstream_consumer>

<quality_gate>
- [ ] Versions are current (verify with Context7/official docs, not training data)
- [ ] Rationale explains WHY, not just WHAT
- [ ] Confidence levels assigned to each recommendation
</quality_gate>

<research_methodology>
Treat pre-existing knowledge as hypothesis. Verify before asserting.
Tool strategy: Context7 first for libraries, WebFetch for official docs, WebSearch for ecosystem discovery.
Confidence: HIGH = Context7/official docs, MEDIUM = WebSearch + official verify, LOW = WebSearch only.
</research_methodology>

Write to: .planning/research/STACK.md

Format:
---
researched: [timestamp]
confidence: HIGH/MEDIUM/LOW
---
# Stack Research
## Recommended Stack
| Library | Version | Purpose | Why |
## Don't Hand-Roll
| Need | Use | Rationale |
## Sources
- [URLs with confidence]
", subagent_type="gsd-project-researcher", model="{researcher_model}", description="Stack research")
```

Similar compact prompts for Features, Architecture, Pitfalls research — each with `<downstream_consumer>`, `<quality_gate>`, and `<research_methodology>`.

After all 4 complete, spawn synthesizer for SUMMARY.md.

## Phase 7: Define Requirements

Present features by category, use multi-select to scope:
- Selected → v1
- Unselected table stakes → v2
- Unselected differentiators → out of scope

Create `.planning/REQUIREMENTS.md` with REQ-IDs.

Commit: `docs: define v1 requirements`

## Phase 8: Create Roadmap

Spawn gsd-roadmapper with lean context:

```
Task(prompt="Create roadmap from requirements.

Read:
- .planning/PROJECT.md
- .planning/REQUIREMENTS.md
- .planning/research/SUMMARY.md (if exists)
- .planning/config.json

Instructions:
1. Derive phases from requirements
2. Map every requirement to one phase
3. Derive 2-5 success criteria per phase
4. Write ROADMAP.md, STATE.md immediately
5. Return ROADMAP CREATED with summary

Write files first, then return.
", subagent_type="gsd-roadmapper", model="{roadmapper_model}", description="Create roadmap")
```

**CRITICAL: Ask for approval before committing:**

Use AskUserQuestion:
- header: "Roadmap"
- question: "Does this roadmap structure work for you?"
- options:
  - "Approve" — Commit and continue
  - "Adjust phases" — Tell me what to change
  - "Review full file" — Show raw ROADMAP.md

**If "Adjust phases":** Get feedback, re-spawn roadmapper with revision context, loop until approved.

Commit: `docs: create roadmap ([N] phases)`

## Phase 9: Done

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSDF ► PROJECT INITIALIZED ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**[N] phases** | **[X] requirements** | Ready to build ✓

───────────────────────────────────────────────────────────────

## ▶ Next Up

**Phase 1: [Phase Name]** — [Goal from ROADMAP.md]

/gsd:discuss-phase 1 — gather context and clarify approach

<sub>/clear first → fresh context window</sub>

───────────────────────────────────────────────────────────────

**Also available:**
- /gsdf:plan-phase 1 — skip discussion, plan directly

───────────────────────────────────────────────────────────────
```

</process>

<output>
- `.planning/PROJECT.md`
- `.planning/config.json`
- `.planning/research/` (if research selected)
- `.planning/REQUIREMENTS.md`
- `.planning/ROADMAP.md`
- `.planning/STATE.md`
</output>

<success_criteria>
- [ ] PROJECT.md captures context (greenfield/brownfield distinction) → committed
- [ ] config.json has preferences → committed
- [ ] Research completed (if selected) with downstream_consumer + quality_gate → committed
- [ ] REQUIREMENTS.md with REQ-IDs → committed
- [ ] Roadmap approved by user (with revision loop) → committed
- [ ] STATE.md initialized
</success_criteria>
