# gsd-project-researcher.md — Enhanced Reference (Code-Verified)

## Metadata
| Attribute | Value |
|-----------|-------|
| **Type** | Agent |
| **Location** | `agents/gsd-project-researcher.md` |
| **Size** | 321 lines |
| **Documentation Tier** | Enhanced Standard |
| **Complexity Score** | 2+2+2+2 = **8/12** |
| **Verified Against** | Source files (2026-01-18): `agents/gsd-project-researcher.md`, `commands/gsd/new-project.md`, `get-shit-done/templates/research-project/*.md` |

---

## Purpose

Researches the domain ecosystem before roadmap creation, producing research artifacts that inform phase structure. Answers "What does this domain ecosystem look like?" by surveying technology landscape, feature categories, architecture patterns, and domain-specific pitfalls.

**Key distinction:** Project-level research (entire domain) vs Phase-researcher (specific implementation).

---

## Critical Behaviors

| Constraint | Rule | Source Section |
|------------|------|----------------|
| Treat training as hypothesis | Training data is 6-18 months stale; verify with Context7/official docs | `<philosophy>` |
| Follow source hierarchy | Context7 → Official Docs → Official GitHub → WebSearch (verified) → WebSearch (unverified) | `<source_hierarchy>` |
| Include confidence levels | HIGH/MEDIUM/LOW on all findings with justification | `<verification_protocol>` & templates |
| Be opinionated | Clear recommendations, not just lists of options | `<downstream_consumer>` / `<success_criteria>` |
| Do not commit | Orchestrator/synthesizer commits; researcher only writes assigned file | `<execution_flow>` Step 6; `/gsd:new-project` Phase 6 |
| Use assigned template | Write to the file specified by the orchestrator prompt | `/gsd:new-project` Phase 6 + templates |

---

## Training as Hypothesis Philosophy (CRITICAL)

**Source:** `<philosophy>`

Claude's training data is 6-18 months stale. Treat pre-existing knowledge as hypothesis, not fact.

**The trap:** Claude "knows" things confidently. But that knowledge may be:
- **Outdated** — Library has new major version
- **Incomplete** — Feature was added after training
- **Wrong** — Claude misremembered or hallucinated

**The discipline:**
1. **Verify before asserting** — Don't state library capabilities without checking Context7 or official docs
2. **Date your knowledge** — "As of my training" is a warning flag, not a confidence marker
3. **Prefer current sources** — Context7 and official docs trump training data
4. **Flag uncertainty** — LOW confidence when only training data supports a claim

---

## Modes/Variants

| Mode | Trigger | Output Focus |
|------|---------|--------------|
| **Ecosystem** (default) | "What tools/approaches exist for X?" | Comprehensive list, popularity, when to use each |
| **Feasibility** | "Can we do X?" or "Is Y possible?" | YES/NO/MAYBE with conditions, blockers, risk factors |
| **Comparison** | "Compare A vs B" | Comparison matrix, clear recommendation with rationale, tradeoffs |

**Actual orchestration note:** `/gsd:new-project` does **not** set these modes. Instead, it spawns four parallel instances that each research a single dimension (stack, features, architecture, pitfalls) and write one file using the corresponding template. SUMMARY.md is produced by `gsd-research-synthesizer`, not by this agent.

---

## Tool Strategy (CRITICAL)

**Source:** `<tool_strategy>`

Execute in this order for each research domain:

```
1. Context7 FIRST
   └── For known technologies
   └── Resolve library, query specific topics
   └── Confidence: HIGH

2. Official Docs (WebFetch)
   └── For authoritative gaps not in Context7
   └── Direct URLs to official documentation
   └── Confidence: HIGH

3. Official GitHub
   └── README, releases, changelogs
   └── Issues for known problems
   └── Confidence: HIGH/MEDIUM depending on content

4. WebSearch
   └── For ecosystem discovery
   └── ALWAYS include current year in query
   └── Cross-reference multiple sources
   └── Confidence: MEDIUM (verified) or LOW (unverified)

5. Verification Pass
   └── Cross-reference all findings
   └── Check for contradictions
   └── Assign final confidence levels
```

---

## Source Hierarchy

**Source:** `<source_hierarchy>`

| Level | Sources | How to Use |
|-------|---------|------------|
| **HIGH** | Context7, official documentation, official releases | State as fact |
| **MEDIUM** | Official GitHub (README/release notes), WebSearch verified with official source, multiple credible sources agree | State with attribution |
| **LOW** | WebSearch only, single source, unverified | Flag as needing validation |

---

## Research Outputs & Data Requirements

**Source:** `/gsd:new-project` Phase 6 + `get-shit-done/templates/research-project/*.md`

### Required Output Files (Project Research)

| File | Produced By | Purpose | Required Sections / Data |
|------|-------------|---------|---------------------------|
| **STACK.md** | `gsd-project-researcher` (stack task) | Recommend standard stack for the domain | Domain, date, confidence; core technologies (versioned); supporting libraries; dev tools; installation; alternatives; what NOT to use; stack patterns by variant; version compatibility; sources |
| **FEATURES.md** | `gsd-project-researcher` (features task) | Map feature landscape | Domain, date, confidence; table stakes; differentiators; anti-features; feature dependencies + notes; MVP definition (Launch/Add After/Future); prioritization matrix; competitor analysis; sources |
| **ARCHITECTURE.md** | `gsd-project-researcher` (architecture task) | Describe standard architecture patterns | Domain, date, confidence; system overview diagram; component responsibilities; recommended project structure + rationale; architectural patterns; data flow; scaling considerations; anti-patterns; integration points; sources |
| **PITFALLS.md** | `gsd-project-researcher` (pitfalls task) | Document domain-specific pitfalls | Domain, date, confidence; critical pitfalls with warning signs + phase to address; technical debt patterns; integration gotchas; performance traps; security mistakes; UX pitfalls; "looks done but isn't" checklist; recovery strategies; pitfall-to-phase mapping; sources |
| **SUMMARY.md** | `gsd-research-synthesizer` (after 4 tasks) | Executive synthesis with roadmap implications | Project, domain, date, confidence; exec summary; key findings by stack/features/architecture/pitfalls; roadmap implications with phases + ordering rationale; research flags; confidence assessment; gaps; sources (tiered) |

### Templates (Authoritative Formats)

All project research files use templates at:
- `get-shit-done/templates/research-project/STACK.md`
- `get-shit-done/templates/research-project/FEATURES.md`
- `get-shit-done/templates/research-project/ARCHITECTURE.md`
- `get-shit-done/templates/research-project/PITFALLS.md`
- `get-shit-done/templates/research-project/SUMMARY.md`

---

## Quality Check Protocol

**Source:** `<verification_protocol>`

Before declaring research complete, verify:

- [ ] All domains investigated for the assigned dimension
- [ ] Negative claims verified with official docs or releases
- [ ] Multiple sources for critical claims
- [ ] URLs provided for authoritative sources
- [ ] Publication dates checked for currency
- [ ] Confidence levels assigned honestly
- [ ] "What might I have missed?" review completed
- [ ] Current year included in WebSearch queries

---

## Execution Flow

**Source:** `<execution_flow>` + `/gsd:new-project` Phase 6

```
Step 1: Receive Project Context
├── Parse PROJECT.md summary (via orchestrator)
├── Understand core value, constraints
└── Identify domain to research

Step 2: Identify Research Dimension
├── Stack (standard stack for domain)
├── Features (table stakes/differentiators/anti-features)
├── Architecture (component boundaries, data flow)
└── Pitfalls (common mistakes)

Step 3: Execute Research Protocol
├── Follow tool strategy in order
├── Document findings with confidence levels
└── Cross-reference all findings

Step 4: Quality Check
├── Run verification protocol checklist
└── Flag gaps or uncertainties

Step 5: Write Output File
├── Write to the file specified by the prompt
└── Use template from get-shit-done/templates/research-project/

Step 6: Return Structured Result
├── DO NOT commit
└── Orchestrator/synthesizer handles commits
```

---

## Interactions

| Category | Details |
|----------|---------|
| **Reads** | Project context (PROJECT.md summary), Context7 docs, official docs, WebSearch results |
| **Writes** | One of `.planning/research/{STACK,FEATURES,ARCHITECTURE,PITFALLS}.md` per task |
| **Spawned By** | `/gsd:new-project`, `/gsd:new-milestone` (per agent definition) |
| **Consumed By** | `gsd-research-synthesizer` (SUMMARY.md), `gsd-roadmapper` (reads SUMMARY.md during roadmap creation) |

---

## Structured Returns

### Research Complete
```markdown
## RESEARCH COMPLETE

**Project:** {project_name}
**Mode:** {ecosystem/feasibility/comparison}
**Confidence:** [HIGH/MEDIUM/LOW]

### Key Findings
- [3-5 bullet points of most important discoveries]

### Files Created
| File | Purpose |
|------|---------|
| .planning/research/STACK.md | Technology recommendations |
| .planning/research/FEATURES.md | Feature landscape |
| .planning/research/ARCHITECTURE.md | Architecture patterns |
| .planning/research/PITFALLS.md | Domain pitfalls |

### Confidence Assessment
| Area | Level | Reason |
|------|-------|--------|

### Roadmap Implications
[Key recommendations for phase structure]

### Open Questions
[Gaps that couldn't be resolved]
```

### Research Blocked
```markdown
## RESEARCH BLOCKED

**Project:** {project_name}
**Blocked by:** [what's preventing progress]

### Attempted
[What was tried]

### Options
1. [Option to resolve]
2. [Alternative approach]

### Awaiting
[What's needed to continue]
```

---

## Anti-Patterns

| Anti-Pattern | Why Bad | Correct Approach |
|--------------|---------|------------------|
| State training knowledge as fact | May be outdated/wrong | Verify with Context7/official docs first |
| Skip Context7 | Miss authoritative current info | Context7 FIRST for known technologies |
| Present LOW confidence as authoritative | Misleads downstream consumers | Flag uncertainty, recommend validation |
| Write SUMMARY.md in project research task | SUMMARY is synthesized later | Only write the assigned dimension file |
| Commit files | Orchestrator/synthesizer handles commits | DO NOT commit |
| Skip version numbers | Incompatible recommendations | Provide versions with rationale |
| Generic recommendations | Not actionable | Opinionated: "Use X because Y" |

---

## Change Impact Analysis

### If gsd-project-researcher Changes:

**Upstream Impact:**
- `/gsd:new-project` — spawns 4 parallel researchers for STACK/FEATURES/ARCHITECTURE/PITFALLS
- `/gsd:new-milestone` — same spawning pattern per agent definition

**Downstream Impact:**
- `gsd-research-synthesizer` — expects STACK/FEATURES/ARCHITECTURE/PITFALLS to build SUMMARY.md
- `gsd-roadmapper` — reads SUMMARY.md during roadmap creation

**Breaking Changes to Watch:**
- Output file names/paths
- Template section structure
- Confidence level values
- File commit behavior (must NOT commit)

---

## Section Index

| Section | Purpose |
|---------|---------|
| `<role>` | Identity, spawners, responsibilities |
| `<philosophy>` | Training as hypothesis, honest reporting |
| `<research_modes>` | Ecosystem, Feasibility, Comparison |
| `<source_hierarchy>` | HIGH/MEDIUM/LOW confidence sources |
| `<tool_strategy>` | Context7 → Official → GitHub → WebSearch order |
| `<verification_protocol>` | Quality check checklist |
| `<output_formats>` | Output templates referenced in agent file |
| `<execution_flow>` | Step-by-step process |
| `<structured_returns>` | Return message formats |
| `<success_criteria>` | Completion checklist |

---

## Quick Reference

```
WHAT:     Domain ecosystem research before roadmap creation
MODES:    Ecosystem (default), Feasibility, Comparison (only if orchestrator sets)
OUTPUT:   .planning/research/ (STACK, FEATURES, ARCHITECTURE, PITFALLS)
SUMMARY:  Written by gsd-research-synthesizer from the four files

CORE RULES:
• Treat training data as hypothesis — verify with Context7/official docs
• Follow source hierarchy: Context7 > Official Docs > Official GitHub > WebSearch verified > unverified
• Include confidence levels on all findings (HIGH/MEDIUM/LOW)
• DO NOT commit — orchestrator handles commits after all researchers complete
• Be opinionated — clear recommendations, not just lists
```
