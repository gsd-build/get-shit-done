# Phase 3: Workflow Integration - Research

**Researched:** 2026-01-19
**Domain:** GSD workflow integration for user documentation access
**Confidence:** HIGH

## Summary

This phase integrates validated user documentation (USER-CONTEXT.md) into three GSD workflows: plan-phase, execute-phase, and discuss-phase. The work is internal to the GSD codebase - modifying existing agent prompts and workflow files to load and present user docs when relevant.

The core challenge is **relevance selection** - determining which sections of USER-CONTEXT.md are useful for a given phase/plan context. The user decisions from CONTEXT.md specify keyword matching against phase name + goal (for planning) or plan content (for execution). The approach is straightforward text matching rather than semantic understanding.

No external libraries or dependencies are needed. This is pure markdown reading, string matching, and template modification. The implementation touches 6 files: 3 command orchestrators and 3 agent definitions.

**Primary recommendation:** Modify existing workflow files and agents to include a "load user docs" step that reads USER-CONTEXT.md, extracts relevant sections via keyword matching, and presents them in a `<user-provided-docs>` block.

## Standard Stack

The established approach for this domain:

### Core
| Component | Version | Purpose | Why Standard |
|-----------|---------|---------|--------------|
| GSD agent system | current | Agent definitions with structured prompts | Already established in phases 1-2 |
| Markdown parsing | native | Read and extract sections from USER-CONTEXT.md | No external parser needed - grep/bash suffice |
| Keyword extraction | native | Match phase keywords to doc categories | Simple string matching, no NLP required |

### Supporting
| Component | Version | Purpose | When to Use |
|-----------|---------|---------|-------------|
| Bash grep/sed | native | Extract document sections by header | Section extraction from USER-CONTEXT.md |
| Read tool | native | Load full file content | Initial document read |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Keyword matching | LLM semantic matching | Overkill for this use case, burns context unnecessarily |
| Session cache | Re-read each time | User decided this is Claude's discretion - recommend re-read for simplicity |

**Installation:**
No installation needed - all native GSD/Claude Code tools.

## Architecture Patterns

### Integration Points

Three workflows need modification:

```
Workflow              What Changes                     Agent Affected
---------------------------------------------------------------------------
plan-phase.md         Add user doc loading step        gsd-phase-researcher.md
                      before researcher spawn          gsd-planner.md

execute-phase.md      Add user doc loading step        gsd-executor.md
                      in Task prompt template

discuss-phase.md      Load user docs at start          discuss-phase.md workflow
                      Check for conflicts
```

### Pattern 1: On-Demand Doc Loading

**What:** Each workflow reads USER-CONTEXT.md when needed, not pre-loaded
**When to use:** Every workflow integration point
**Implementation:**

```bash
# Check for USER-CONTEXT.md existence
if [ -f ".planning/codebase/USER-CONTEXT.md" ]; then
  # File exists - proceed with loading
  USER_DOCS=$(cat .planning/codebase/USER-CONTEXT.md)
else
  # Silent continue - user docs are optional
  USER_DOCS=""
fi
```

### Pattern 2: Keyword-Based Relevance Selection

**What:** Match phase/plan keywords against document categories and content
**When to use:** Filtering which sections to load
**Implementation:**

```bash
# Extract keywords from phase name and goal
PHASE_NAME="authentication"
PHASE_GOAL="JWT auth with refresh token rotation"

# Keywords to match: authentication, auth, jwt, refresh, token, etc.
# Match against USER-CONTEXT.md section headers and content

# For plan-phase: match against phase name + goal
# For execute-phase: match against plan content (objective, tasks)
# For discuss-phase: match against phase name + goal
```

**Matching strategy:**
1. Extract nouns/verbs from phase name (e.g., "authentication" -> auth, authentication)
2. Extract nouns/verbs from goal (e.g., "JWT auth" -> jwt, auth)
3. Search USER-CONTEXT.md for sections containing these keywords
4. Return matched sections, preserving category context

### Pattern 3: Context Block Formatting

**What:** Present user docs in explicit XML block
**When to use:** Injecting docs into agent context
**Implementation:**

```markdown
<user-provided-docs confidence="varies">
## Architecture

### api-architecture.md
**Confidence:** HIGH (verified)

[Content here...]

## API

### endpoints.md
**Confidence:** MEDIUM (version claim - not verified)

[Content here...]

</user-provided-docs>
```

### Pattern 4: Confidence Level Pass-Through

**What:** Include validation confidence levels so agents can weight information
**When to use:** All doc loading
**Implementation:**

Parse the **Validation:** metadata from each document section:
```markdown
**Validation:**
- Status: validated
- Claims: 12 total, 10 HIGH, 2 MEDIUM, 0 LOW
- Validated: 2026-01-19
```

Agents can then:
- Trust HIGH confidence claims as facts
- Treat MEDIUM as guidance (verify if critical)
- Be skeptical of LOW/known stale content

### Anti-Patterns to Avoid

- **Pre-loading all docs into every agent:** Wastes context budget
- **Semantic matching via LLM:** Over-engineered for keyword matching
- **Nagging user about missing docs:** User decided silent continue
- **Caching across sessions:** Re-read is simpler and always current

## Don't Hand-Roll

Problems that look simple but have gotchas:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Section extraction | Custom parser | Grep by markdown headers | USER-CONTEXT.md has consistent structure |
| Keyword extraction | NLP tokenizer | Simple word splitting | Phase names are already semantic |
| Relevance scoring | TF-IDF scoring | Category mapping | Five categories map cleanly to phase types |

**Key insight:** USER-CONTEXT.md is generated by gsd-doc-ingestor with a known, consistent structure. The five categories (architecture, api, setup, reference, general) map directly to phase types (backend phases need api/architecture, setup phases need setup, etc.).

## Common Pitfalls

### Pitfall 1: Loading Too Much Context

**What goes wrong:** Loading all of USER-CONTEXT.md into agent context burns budget
**Why it happens:** Seems simpler than filtering
**How to avoid:** Only load sections that match keywords; if nothing matches, load nothing
**Warning signs:** Agent running out of context, quality degradation in late tasks

### Pitfall 2: Breaking on Missing File

**What goes wrong:** Workflow fails when USER-CONTEXT.md doesn't exist
**Why it happens:** User never ran map-codebase with docs, or docs were never ingested
**How to avoid:** Always check file existence first, silent continue if missing
**Warning signs:** Error messages about missing file

### Pitfall 3: Inconsistent Context Block Formatting

**What goes wrong:** Different workflows format user docs differently, confusing agents
**Why it happens:** Each workflow modified independently without template
**How to avoid:** Define one `<user-provided-docs>` format, use everywhere
**Warning signs:** Agents not recognizing/using user docs correctly

### Pitfall 4: Conflict Detection Complexity

**What goes wrong:** Trying to detect semantic conflicts between user answers and docs
**Why it happens:** CONTEXT.md mentions "check for conflicts with user answers"
**How to avoid:** Start simple - just load docs for reference, let agent notice conflicts naturally
**Warning signs:** Complex conflict resolution logic that rarely fires

## Code Examples

### Example 1: Load and Filter USER-CONTEXT.md

```bash
# Load user docs for plan-phase (researcher/planner)
load_user_docs_for_planning() {
  local phase_name="$1"
  local phase_goal="$2"

  if [ ! -f ".planning/codebase/USER-CONTEXT.md" ]; then
    echo ""  # Silent return - no docs
    return
  fi

  # Simple keyword extraction
  local keywords=$(echo "$phase_name $phase_goal" | tr '[:upper:]' '[:lower:]' | tr -s ' ' '\n' | sort -u)

  # Check if any section matches
  local matches=""
  for kw in $keywords; do
    if grep -qi "$kw" .planning/codebase/USER-CONTEXT.md; then
      matches="yes"
      break
    fi
  done

  if [ -z "$matches" ]; then
    echo ""  # No relevant docs
    return
  fi

  # Return full file for now - section extraction in implementation
  cat .planning/codebase/USER-CONTEXT.md
}
```

### Example 2: Format User Docs for Agent Context

```markdown
# In agent prompt context section:

**User-Provided Documentation (if relevant):**

<user-provided-docs>
{Loaded and filtered content from USER-CONTEXT.md}
{Include confidence annotations}
</user-provided-docs>

Note: These are user-provided docs with varying confidence levels.
HIGH = verified against codebase
MEDIUM = partial verification or version claims
LOW/stale = user chose to keep despite verification issues
```

### Example 3: Category Mapping for Relevance

```
Phase Type          Primary Categories     Secondary Categories
------------------------------------------------------------------------
UI/Frontend         reference, general     setup
API/Backend         api, architecture      reference
Database/Schema     architecture           api, reference
Testing             reference, setup       general
Setup/Config        setup                  reference
Refactoring         architecture           reference
Integration         api, architecture      setup
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No user docs | User docs ingested, validated | Phase 1-2 (2026-01-19) | Docs available in USER-CONTEXT.md |
| Manual context copy | Automated doc loading | This phase | Agents get relevant docs automatically |

**Deprecated/outdated:**
- None - this is new functionality being added

## Open Questions

Things that are Claude's Discretion (per CONTEXT.md):

1. **Caching strategy**
   - What we know: Options are re-read vs session cache
   - Recommendation: Re-read each time. Simpler, always current, no cache invalidation.

2. **Exact keyword extraction algorithm**
   - What we know: Match phase name + goal words
   - Recommendation: Simple word split, lowercase, ignore common words (the, a, an, to, for)

3. **How to weight confidence levels**
   - What we know: Levels are HIGH/MEDIUM/LOW
   - Recommendation: Include level in context, let agent decide how to weight

## Sources

### Primary (HIGH confidence)
- GSD codebase: agents/gsd-doc-ingestor.md - USER-CONTEXT.md format
- GSD codebase: agents/gsd-doc-validator.md - Validation and confidence levels
- GSD codebase: commands/gsd/plan-phase.md - Integration point structure
- GSD codebase: commands/gsd/execute-phase.md - Integration point structure
- GSD codebase: commands/gsd/discuss-phase.md - Integration point structure
- GSD codebase: agents/gsd-planner.md - Agent context loading patterns
- GSD codebase: agents/gsd-executor.md - Agent context loading patterns
- GSD codebase: agents/gsd-phase-researcher.md - Agent context loading patterns

### Secondary (MEDIUM confidence)
- .planning/phases/03-workflow-integration/03-CONTEXT.md - User decisions for this phase

### Tertiary (LOW confidence)
- None - this is internal GSD work with full codebase access

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - examining actual GSD codebase files
- Architecture: HIGH - clear integration points in existing workflows
- Pitfalls: MEDIUM - based on GSD patterns and experience

**Research date:** 2026-01-19
**Valid until:** Indefinite - internal GSD architecture is stable
